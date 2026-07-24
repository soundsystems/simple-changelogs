import { lstat, readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { runAdapter } from "./adapter.ts";
import {
  type AssertionResult,
  cleanupFixtureWorkspace,
  createFixtureWorkspace,
  evaluateAssertions,
  initializeFixtureGit,
} from "./fixtures.ts";
import {
  type EvalCase,
  type EvalManifest,
  type EvalSuite,
  type EvalTurn,
  PROTOCOL_VERSION,
  type RunnerMessage,
  type RunnerRequest,
  type RunnerResponse,
} from "./types.ts";
import { validateManifest } from "./validate.ts";

export type CaseStatus =
  | "error"
  | "failed"
  | "passed"
  | "skipped"
  | "unsupported";

export interface TurnEvaluationReport {
  adapterStatus: RunnerResponse["status"];
  assertions: AssertionResult[];
  diagnostics: NonNullable<RunnerResponse["diagnostics"]>;
  finalResponse: string;
  index: number;
  stderr?: string;
}

export interface CaseEvaluationReport {
  assertions: AssertionCounts;
  id: string;
  reasonCodes: string[];
  status: CaseStatus;
  suite: EvalSuite;
  turns: TurnEvaluationReport[];
  workspace?: string;
}

export interface ModelEvaluationResult {
  cases: CaseEvaluationReport[];
  counts: {
    assertions: AssertionCounts;
    failed: number;
    passed: number;
    total: number;
  };
}

export interface ModelEvaluationOptions {
  adapterPath: string;
  caseIds: string[];
  evaluationDirectory: string;
  keepFailures: boolean;
  skillDirectory: string;
  suite: EvalSuite | "all";
  timeoutMs: number;
}

interface AssertionCounts {
  failed: number;
  passed: number;
  total: number;
}

interface EvaluationBundle {
  fixturesRoot: string;
  manifest: EvalManifest;
  responseSchema: string;
  skillDirectory: string;
}

interface CaseRuntime {
  bundle: EvaluationBundle;
  item: EvalCase;
  options: ModelEvaluationOptions;
  reasonCodes: Set<string>;
  status: CaseStatus;
  transcript: RunnerMessage[];
  turns: TurnEvaluationReport[];
  workspace: string;
}

export class ModelEvaluationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelEvaluationConfigurationError";
  }
}

const configurationError = (message: string): never => {
  throw new ModelEvaluationConfigurationError(message);
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const compareText = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
};

const canonicalSkillDirectory = async (
  skillDirectory: string
): Promise<string> => {
  try {
    const sourceStat = await lstat(skillDirectory);
    if (sourceStat.isSymbolicLink() || !sourceStat.isDirectory()) {
      return configurationError(
        `Skill directory must be a real directory: ${skillDirectory}`
      );
    }
    return await realpath(skillDirectory);
  } catch (error) {
    return configurationError(
      `Unable to inspect skill directory ${skillDirectory}: ${errorMessage(error)}`
    );
  }
};

const loadManifestText = async (
  manifestPath: string,
  responseSchema: string,
  fixturesRoot: string
): Promise<string> => {
  try {
    const [manifestStat, schemaStat, fixtureStat] = await Promise.all([
      lstat(manifestPath),
      lstat(responseSchema),
      lstat(fixturesRoot),
    ]);
    if (manifestStat.isSymbolicLink() || !manifestStat.isFile()) {
      return configurationError(
        `Manifest must be a real file: ${manifestPath}`
      );
    }
    if (schemaStat.isSymbolicLink() || !schemaStat.isFile()) {
      return configurationError(
        `Runner response schema must be a real file: ${responseSchema}`
      );
    }
    if (fixtureStat.isSymbolicLink() || !fixtureStat.isDirectory()) {
      return configurationError(
        `Fixture root must be a real directory: ${fixturesRoot}`
      );
    }
    return await readFile(manifestPath, "utf8");
  } catch (error) {
    return configurationError(
      `Unable to load evaluation bundle: ${errorMessage(error)}`
    );
  }
};

const parseManifest = (manifestText: string): EvalManifest => {
  let manifestInput: unknown;
  try {
    manifestInput = JSON.parse(manifestText);
  } catch (error) {
    return configurationError(
      `Invalid evaluation manifest JSON: ${errorMessage(error)}`
    );
  }
  const validation = validateManifest(manifestInput);
  if (!validation.ok) {
    return configurationError(
      `Invalid evaluation manifest: ${validation.errors.join("; ")}`
    );
  }
  const counts = validation.value.cases.reduce<Map<string, number>>(
    (caseCounts, item) =>
      caseCounts.set(item.id, (caseCounts.get(item.id) ?? 0) + 1),
    new Map()
  );
  const duplicateIds = [...counts]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort(compareText);
  if (duplicateIds.length > 0) {
    return configurationError(
      `Evaluation case IDs must be unique: ${duplicateIds.join(", ")}`
    );
  }
  return validation.value;
};

const readManifest = async (
  skillDirectory: string,
  evaluationDirectory: string
): Promise<EvaluationBundle> => {
  const [canonicalSkill, canonicalEvaluation] = await Promise.all([
    canonicalSkillDirectory(skillDirectory),
    canonicalSkillDirectory(evaluationDirectory),
  ]);
  const manifestPath = join(canonicalEvaluation, "evals", "cases.json");
  const responseSchema = join(
    canonicalEvaluation,
    "evals",
    "schemas",
    "runner-response.schema.json"
  );
  const fixturesRoot = join(canonicalEvaluation, "evals", "fixtures");
  const manifestText = await loadManifestText(
    manifestPath,
    responseSchema,
    fixturesRoot
  );
  return {
    fixturesRoot,
    manifest: parseManifest(manifestText),
    responseSchema,
    skillDirectory: canonicalSkill,
  };
};

const selectCases = (
  manifest: EvalManifest,
  suite: EvalSuite | "all",
  requestedIds: string[]
): EvalCase[] => {
  const suiteCases = manifest.cases.filter(
    (item) => suite === "all" || item.suite === suite
  );
  const requested = new Set(requestedIds);
  if (requested.size === 0) {
    if (suiteCases.length === 0) {
      return configurationError(`No ${suite} evaluation cases are defined`);
    }
    return suiteCases;
  }
  const available = new Set(suiteCases.map((item) => item.id));
  const unknown = [...requested]
    .filter((id) => !available.has(id))
    .sort(compareText);
  if (unknown.length > 0) {
    return configurationError(
      `Unknown ${suite} case IDs: ${unknown.join(", ")}`
    );
  }
  return suiteCases.filter((item) => requested.has(item.id));
};

const countAssertions = (results: AssertionResult[]): AssertionCounts => {
  const passed = results.filter((result) => result.passed).length;
  return {
    failed: results.length - passed,
    passed,
    total: results.length,
  };
};

const assertionsFor = (turns: TurnEvaluationReport[]): AssertionCounts =>
  countAssertions(turns.flatMap((turn) => turn.assertions));

const adapterFailureMessage = (
  caseId: string,
  turnIndex: number,
  result: Awaited<ReturnType<typeof runAdapter>>
): string => {
  if (result.ok) {
    return "";
  }
  const detail =
    result.error.kind === "protocol"
      ? ` (${result.error.errors.join("; ")})`
      : "";
  const stderr = result.stderr.trim();
  return `Adapter failed for ${caseId} turn ${turnIndex}: ${result.error.message}${detail}${stderr ? `; stderr: ${stderr}` : ""}`;
};

const prepareWorkspace = async (
  bundle: EvaluationBundle,
  item: EvalCase
): Promise<string> => {
  let workspace: string;
  try {
    workspace = await createFixtureWorkspace(bundle.fixturesRoot, item.fixture);
  } catch (error) {
    return configurationError(
      `Unable to copy fixture ${item.fixture} for ${item.id}: ${errorMessage(error)}`
    );
  }
  try {
    await initializeFixtureGit(workspace);
    return workspace;
  } catch (error) {
    await cleanupFixtureWorkspace(workspace, {
      failed: true,
      keepFailures: false,
    });
    return configurationError(
      `Unable to initialize fixture ${item.fixture} for ${item.id}: ${errorMessage(error)}`
    );
  }
};

const requestFor = (
  runtime: CaseRuntime,
  turn: EvalTurn,
  turnIndex: number
): RunnerRequest => ({
  activationMode: runtime.item.activationMode,
  case: runtime.item,
  prompt: turn.prompt,
  protocolVersion: PROTOCOL_VERSION,
  responseSchema: runtime.bundle.responseSchema,
  skillDirectory: runtime.bundle.skillDirectory,
  timeoutMs: runtime.options.timeoutMs,
  ...(runtime.transcript.length === 0
    ? {}
    : { transcript: [...runtime.transcript] }),
  turnIndex,
  workspace: runtime.workspace,
});

const addDiagnosticReasons = (
  runtime: CaseRuntime,
  diagnostics: NonNullable<RunnerResponse["diagnostics"]>
): void => {
  if (
    diagnostics.some(
      (item) => item.code === "CAPABILITY_ACTIVATION_TRACE_UNAVAILABLE"
    )
  ) {
    runtime.reasonCodes.add("CAPABILITY_ACTIVATION_TRACE_UNAVAILABLE");
    runtime.status = "unsupported";
  }
  if (
    diagnostics.some(
      (item) => item.code === "CAPABILITY_MULTI_STEP_UNAVAILABLE"
    )
  ) {
    runtime.reasonCodes.add("CAPABILITY_MULTI_STEP_UNAVAILABLE");
    runtime.status = "unsupported";
  }
};

const evaluateCompletedTurn = async (
  runtime: CaseRuntime,
  turn: EvalTurn,
  response: RunnerResponse
): Promise<AssertionResult[]> => {
  const results = await evaluateAssertions(turn.assertions, {
    response,
    workspace: runtime.workspace,
  });
  if (
    results.some(
      (result) => result.code === "CAPABILITY_ACTIVATION_TRACE_UNAVAILABLE"
    )
  ) {
    runtime.reasonCodes.add("CAPABILITY_ACTIVATION_TRACE_UNAVAILABLE");
    runtime.status = "unsupported";
  } else if (
    runtime.status === "passed" &&
    results.some((result) => !result.passed)
  ) {
    runtime.status = "failed";
  }
  runtime.transcript.push(
    { content: turn.prompt, role: "user" },
    { content: response.finalResponse, role: "assistant" }
  );
  return results;
};

const appendTurnReport = (
  runtime: CaseRuntime,
  response: RunnerResponse,
  assertions: AssertionResult[],
  stderr: string,
  turnIndex: number
): void => {
  runtime.turns.push({
    adapterStatus: response.status,
    assertions,
    diagnostics: response.diagnostics ?? [],
    finalResponse: response.finalResponse,
    index: turnIndex,
    ...(stderr.length === 0 ? {} : { stderr }),
  });
};

const executeTurn = async (
  runtime: CaseRuntime,
  turnIndex: number
): Promise<void> => {
  const turn = runtime.item.turns[turnIndex];
  if (!turn) {
    return;
  }
  const adapterResult = await runAdapter(
    runtime.options.adapterPath,
    requestFor(runtime, turn, turnIndex),
    { timeoutMs: runtime.options.timeoutMs }
  );
  if (!adapterResult.ok) {
    return configurationError(
      adapterFailureMessage(runtime.item.id, turnIndex, adapterResult)
    );
  }
  const { response } = adapterResult;
  addDiagnosticReasons(runtime, response.diagnostics ?? []);
  const assertions =
    response.status === "completed"
      ? await evaluateCompletedTurn(runtime, turn, response)
      : [];
  if (response.status !== "completed" && runtime.status !== "unsupported") {
    runtime.status = response.status;
  }
  appendTurnReport(
    runtime,
    response,
    assertions,
    adapterResult.stderr,
    turnIndex
  );
  if (response.status === "completed") {
    await executeTurn(runtime, turnIndex + 1);
  }
};

const skippedCase = (item: EvalCase): CaseEvaluationReport => ({
  assertions: { failed: 0, passed: 0, total: 0 },
  id: item.id,
  reasonCodes: ["MANIFEST_SKIP"],
  status: "skipped",
  suite: item.suite,
  turns: [],
});

const reportForRuntime = (runtime: CaseRuntime): CaseEvaluationReport => ({
  assertions: assertionsFor(runtime.turns),
  id: runtime.item.id,
  reasonCodes: [...runtime.reasonCodes].sort(),
  status: runtime.status,
  suite: runtime.item.suite,
  turns: runtime.turns,
  ...(runtime.status !== "passed" && runtime.options.keepFailures
    ? { workspace: runtime.workspace }
    : {}),
});

const runCase = async (
  item: EvalCase,
  bundle: EvaluationBundle,
  options: ModelEvaluationOptions
): Promise<CaseEvaluationReport> => {
  if (item.skip) {
    return skippedCase(item);
  }
  const workspace = await prepareWorkspace(bundle, item);
  const runtime: CaseRuntime = {
    bundle,
    item,
    options,
    reasonCodes: new Set(),
    status: "passed",
    transcript: [],
    turns: [],
    workspace,
  };
  try {
    await executeTurn(runtime, 0);
  } catch (error) {
    await cleanupFixtureWorkspace(workspace, {
      failed: true,
      keepFailures: false,
    });
    if (error instanceof ModelEvaluationConfigurationError) {
      throw error;
    }
    return configurationError(
      `Evaluation failed for ${item.id}: ${errorMessage(error)}`
    );
  }
  const report = reportForRuntime(runtime);
  await cleanupFixtureWorkspace(workspace, {
    failed: runtime.status !== "passed",
    keepFailures: options.keepFailures,
  });
  return report;
};

const runCasesSequentially = async (
  selected: EvalCase[],
  bundle: EvaluationBundle,
  options: ModelEvaluationOptions,
  index = 0,
  reports: CaseEvaluationReport[] = []
): Promise<CaseEvaluationReport[]> => {
  const item = selected[index];
  if (!item) {
    return reports;
  }
  reports.push(await runCase(item, bundle, options));
  return runCasesSequentially(selected, bundle, options, index + 1, reports);
};

const cleanupRetainedReports = async (
  reports: CaseEvaluationReport[]
): Promise<void> => {
  const retained = reports.flatMap((report) =>
    report.workspace ? [report.workspace] : []
  );
  await Promise.all(
    retained.map((workspace) =>
      cleanupFixtureWorkspace(workspace, {
        failed: true,
        keepFailures: false,
      })
    )
  );
};

export const evaluateModelCases = async (
  options: ModelEvaluationOptions
): Promise<ModelEvaluationResult> => {
  const bundle = await readManifest(
    options.skillDirectory,
    options.evaluationDirectory
  );
  const selected = selectCases(bundle.manifest, options.suite, options.caseIds);
  const cases: CaseEvaluationReport[] = [];
  try {
    await runCasesSequentially(selected, bundle, options, 0, cases);
  } catch (error) {
    await cleanupRetainedReports(cases);
    throw error;
  }
  const assertionResults = cases.flatMap((item) =>
    item.turns.flatMap((turn) => turn.assertions)
  );
  const assertions = countAssertions(assertionResults);
  const passed = cases.filter((item) => item.status === "passed").length;
  return {
    cases,
    counts: {
      assertions,
      failed: cases.length - passed,
      passed,
      total: cases.length,
    },
  };
};
