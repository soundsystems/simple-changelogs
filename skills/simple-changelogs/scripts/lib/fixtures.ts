import {
  cp,
  lstat,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawn } from "bun";
import type { EvalAssertion, JsonValue, RunnerResponse } from "./types.ts";

const FIXTURE_PREFIX = "simple-changelogs-eval-";
const PATH_SEPARATOR_PATTERN = /[\\/]/u;
const DETERMINISTIC_GIT_DATE = "2000-01-01T00:00:00+00:00";

const compareText = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
};

export interface AssertionContext {
  response: RunnerResponse;
  workspace: string;
}

export interface AssertionResult {
  code?: string;
  kind: string;
  message: string;
  passed: boolean;
  target?: string;
}

export interface CleanupOptions {
  failed: boolean;
  keepFailures: boolean;
}

interface CommandExpectation {
  argv: string[];
  exitCode: number;
  stderrMatches?: string;
  stdoutMatches?: string;
}

interface ChangedPathsExpectation {
  allowed?: string[];
  forbidden?: string[];
  required?: string[];
}

interface RepoStateExpectation {
  branch?: string;
  clean?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const validateFixtureName = (name: string): void => {
  if (
    name.length === 0 ||
    isAbsolute(name) ||
    name.includes("/") ||
    name.includes("\\") ||
    name === "." ||
    name === ".."
  ) {
    throw new Error(`Unsafe fixture name: ${name}`);
  }
};

const assertNoSymlinks = async (root: string): Promise<void> => {
  const entries = await readdir(root, { withFileTypes: true });
  entries.sort((left, right) => compareText(left.name, right.name));
  await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Fixture contains a symlink: ${path}`);
      }
      if (entry.isDirectory()) {
        await assertNoSymlinks(path);
      }
    })
  );
};

const runCommand = async (
  argv: string[],
  cwd: string,
  env?: Record<string, string | undefined>
): Promise<{ exitCode: number; stderr: string; stdout: string }> => {
  if (argv.length === 0) {
    throw new Error("Command argv must not be empty");
  }
  const process = spawn(argv, {
    cwd,
    ...(env ? { env } : {}),
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stderr, stdout] = await Promise.all([
    process.exited,
    new Response(process.stderr).text(),
    new Response(process.stdout).text(),
  ]);
  return { exitCode, stderr, stdout };
};

const runGit = async (
  workspace: string,
  args: string[],
  env?: Record<string, string | undefined>
): Promise<string> => {
  const result = await runCommand(["git", ...args], workspace, env);
  if (result.exitCode !== 0) {
    const diagnostics = [result.stderr.trim(), result.stdout.trim()]
      .filter((message) => message.length > 0)
      .join("\n");
    throw new Error(
      `git ${args.join(" ")} failed${diagnostics ? `: ${diagnostics}` : ""}`
    );
  }
  return result.stdout.trim();
};

export const createFixtureWorkspace = async (
  fixturesRoot: string,
  fixtureName: string
): Promise<string> => {
  validateFixtureName(fixtureName);
  const canonicalRoot = await realpath(fixturesRoot);
  const source = resolve(canonicalRoot, fixtureName);
  const sourceRelative = relative(canonicalRoot, source);
  if (sourceRelative.startsWith(`..${sep}`) || sourceRelative === "..") {
    throw new Error(`Unsafe fixture name: ${fixtureName}`);
  }
  const sourceStat = await lstat(source);
  if (sourceStat.isSymbolicLink() || !sourceStat.isDirectory()) {
    throw new Error(
      `Fixture must be a real directory, not a symlink: ${source}`
    );
  }
  await assertNoSymlinks(source);
  const workspace = await mkdtemp(join(tmpdir(), FIXTURE_PREFIX));
  try {
    await cp(source, workspace, { recursive: true });
    return workspace;
  } catch (error) {
    await rm(workspace, { force: true, recursive: true });
    throw error;
  }
};

export const initializeFixtureGit = async (
  workspace: string
): Promise<string> => {
  await runGit(workspace, ["init", "-b", "main"]);
  await runGit(workspace, ["config", "user.name", "Simple Changelogs Eval"]);
  await runGit(workspace, [
    "config",
    "user.email",
    "eval@simple-changelogs.invalid",
  ]);
  await runGit(workspace, ["add", "--all"]);
  await runGit(workspace, ["commit", "-m", "eval fixture baseline"], {
    ...process.env,
    GIT_AUTHOR_DATE: DETERMINISTIC_GIT_DATE,
    GIT_COMMITTER_DATE: DETERMINISTIC_GIT_DATE,
  });
  return runGit(workspace, ["rev-parse", "HEAD"]);
};

const safeWorkspacePath = async (
  workspace: string,
  target: string
): Promise<{ path: string } | { error: string }> => {
  if (isAbsolute(target)) {
    return { error: `Unsafe absolute assertion path: ${target}` };
  }
  const segments = target.split(PATH_SEPARATOR_PATTERN);
  if (
    segments.some(
      (segment) => segment === "" || segment === "." || segment === ".."
    )
  ) {
    return { error: `Unsafe assertion path: ${target}` };
  }
  const canonicalWorkspace = await realpath(workspace);
  const paths: string[] = [];
  let current = canonicalWorkspace;
  for (const segment of segments) {
    current = join(current, segment);
    paths.push(current);
  }
  const inspections = await Promise.all(
    paths.map(async (path) => {
      try {
        const item = await lstat(path);
        return { path, symlink: item.isSymbolicLink() };
      } catch (error) {
        const code = isRecord(error) ? error.code : undefined;
        if (code !== "ENOENT") {
          throw new Error(`Unable to inspect assertion path ${target}`, {
            cause: error,
          });
        }
        return { path, symlink: false };
      }
    })
  );
  if (inspections.some((inspection) => inspection.symlink)) {
    return { error: `Assertion path traverses a symlink: ${target}` };
  }
  const targetRelative = relative(canonicalWorkspace, current);
  if (targetRelative.startsWith(`..${sep}`) || targetRelative === "..") {
    return { error: `Unsafe assertion path: ${target}` };
  }
  return { path: current };
};

const changedPaths = async (workspace: string): Promise<string[]> => {
  const result = await runCommand(
    ["git", "status", "--porcelain=v1", "--untracked-files=all"],
    workspace
  );
  if (result.exitCode !== 0) {
    throw new Error(`git status failed: ${result.stderr.trim()}`);
  }
  const output = result.stdout.trimEnd();
  if (output.length === 0) {
    return [];
  }
  return output
    .split("\n")
    .map((line) => line.slice(3).split(" -> ").at(-1) ?? "")
    .filter((path) => path.length > 0)
    .sort();
};

const jsonPointer = (
  value: JsonValue,
  pointer: string
): JsonValue | undefined => {
  if (pointer === "" || pointer === "/") {
    return value;
  }
  let current: JsonValue | undefined = value;
  for (const rawPart of pointer.split("/").slice(1)) {
    const part = rawPart.replaceAll("~1", "/").replaceAll("~0", "~");
    if (Array.isArray(current)) {
      const index = Number(part);
      current = Number.isSafeInteger(index) ? current[index] : undefined;
    } else if (isRecord(current)) {
      current = current[part] as JsonValue | undefined;
    } else {
      return;
    }
  }
  return current;
};

const changedExpectation = (
  value: JsonValue
): ChangedPathsExpectation | undefined => {
  if (!isRecord(value)) {
    return;
  }
  const { allowed, forbidden, required } = value;
  if (
    (allowed !== undefined && !isStringArray(allowed)) ||
    (forbidden !== undefined && !isStringArray(forbidden)) ||
    (required !== undefined && !isStringArray(required))
  ) {
    return;
  }
  return {
    ...(allowed ? { allowed } : {}),
    ...(forbidden ? { forbidden } : {}),
    ...(required ? { required } : {}),
  };
};

const repoExpectation = (
  value: JsonValue
): RepoStateExpectation | undefined => {
  if (!isRecord(value)) {
    return;
  }
  const { branch, clean } = value;
  if (
    (branch !== undefined && typeof branch !== "string") ||
    (clean !== undefined && typeof clean !== "boolean")
  ) {
    return;
  }
  return {
    ...(branch === undefined ? {} : { branch }),
    ...(clean === undefined ? {} : { clean }),
  };
};

const commandExpectation = (
  value: JsonValue
): CommandExpectation | undefined => {
  if (!isRecord(value)) {
    return;
  }
  const { argv, exitCode, stderrMatches, stdoutMatches } = value;
  if (
    !isStringArray(argv) ||
    typeof exitCode !== "number" ||
    (stderrMatches !== undefined && typeof stderrMatches !== "string") ||
    (stdoutMatches !== undefined && typeof stdoutMatches !== "string")
  ) {
    return;
  }
  return {
    argv,
    exitCode,
    ...(stderrMatches === undefined ? {} : { stderrMatches }),
    ...(stdoutMatches === undefined ? {} : { stdoutMatches }),
  };
};

const matches = (text: string, pattern: JsonValue): boolean =>
  typeof pattern === "string" && new RegExp(pattern, "u").test(text);

const pass = (assertion: EvalAssertion, message: string): AssertionResult => ({
  kind: assertion.kind,
  message,
  passed: true,
  ...(assertion.target ? { target: assertion.target } : {}),
});

const fail = (
  assertion: EvalAssertion,
  message: string,
  code?: string
): AssertionResult => ({
  ...(code ? { code } : {}),
  kind: assertion.kind,
  message,
  passed: false,
  ...(assertion.target ? { target: assertion.target } : {}),
});

const evaluatePathAssertion = async (
  assertion: EvalAssertion,
  context: AssertionContext
): Promise<AssertionResult> => {
  if (!assertion.target) {
    return fail(assertion, `${assertion.kind} requires target`);
  }
  const resolved = await safeWorkspacePath(context.workspace, assertion.target);
  if ("error" in resolved) {
    return fail(assertion, resolved.error);
  }
  let exists = true;
  try {
    await lstat(resolved.path);
  } catch {
    exists = false;
  }
  const expectedExists = assertion.kind === "path.exists";
  return exists === expectedExists
    ? pass(assertion, `${assertion.target} existence matched`)
    : fail(assertion, `${assertion.target} existence did not match`);
};

const evaluateFileAssertion = async (
  assertion: EvalAssertion,
  context: AssertionContext
): Promise<AssertionResult> => {
  if (!assertion.target) {
    return fail(assertion, `${assertion.kind} requires target`);
  }
  const paths = await changedPaths(context.workspace);
  const isChanged = paths.includes(assertion.target);
  const expectedChanged = assertion.kind === "file.changed";
  return isChanged === expectedChanged
    ? pass(assertion, `${assertion.target} change state matched`)
    : fail(assertion, `${assertion.target} change state did not match`);
};

const readAssertionFile = async (
  assertion: EvalAssertion,
  context: AssertionContext
): Promise<{ error: AssertionResult } | { text: string }> => {
  if (!assertion.target) {
    return { error: fail(assertion, `${assertion.kind} requires target`) };
  }
  const resolved = await safeWorkspacePath(context.workspace, assertion.target);
  if ("error" in resolved) {
    return { error: fail(assertion, resolved.error) };
  }
  try {
    return { text: await readFile(resolved.path, "utf8") };
  } catch {
    return { error: fail(assertion, `Unable to read ${assertion.target}`) };
  }
};

const evaluateTextAssertion = async (
  assertion: EvalAssertion,
  context: AssertionContext
): Promise<AssertionResult> => {
  const file = await readAssertionFile(assertion, context);
  if ("error" in file) {
    return file.error;
  }
  let matched = false;
  try {
    matched = matches(file.text, assertion.expected);
  } catch {
    return fail(assertion, "Invalid text assertion pattern");
  }
  const expectedMatch = assertion.kind === "text.match";
  return matched === expectedMatch
    ? pass(assertion, "Text pattern state matched")
    : fail(assertion, "Text pattern state did not match");
};

const evaluateJsonAssertion = async (
  assertion: EvalAssertion,
  context: AssertionContext
): Promise<AssertionResult> => {
  if (!assertion.target) {
    return fail(assertion, "json.path requires file#/pointer target");
  }
  const separator = assertion.target.indexOf("#");
  const fileTarget =
    separator >= 0 ? assertion.target.slice(0, separator) : assertion.target;
  const pointer = separator >= 0 ? assertion.target.slice(separator + 1) : "";
  const file = await readAssertionFile(
    { ...assertion, target: fileTarget },
    context
  );
  if ("error" in file) {
    return file.error;
  }
  try {
    const value = JSON.parse(file.text) as JsonValue;
    return JSON.stringify(jsonPointer(value, pointer)) ===
      JSON.stringify(assertion.expected)
      ? pass(assertion, "JSON pointer matched")
      : fail(assertion, "JSON pointer did not match");
  } catch {
    return fail(assertion, `Invalid JSON in ${fileTarget}`);
  }
};

const evaluateReportAssertion = (
  assertion: EvalAssertion,
  response: RunnerResponse
): AssertionResult => {
  const { expected } = assertion;
  let matched = false;
  switch (assertion.kind) {
    case "report.status":
      matched = response.status === expected;
      break;
    case "report.decision":
      matched =
        typeof expected === "string" &&
        response.evaluationReport.decisionCodes.includes(expected);
      break;
    case "report.authorization":
      matched =
        typeof expected === "string" &&
        response.evaluationReport.authorizationRecords.some(
          (record) => record.code === expected
        );
      break;
    case "report.versionMap":
      matched =
        typeof expected === "string" &&
        response.evaluationReport.versionMap.some(
          (record) => record.path === expected
        );
      break;
    default:
      matched =
        typeof expected === "string" &&
        response.evaluationReport.verificationResults.some(
          (record) => record.code === expected
        );
  }
  return matched
    ? pass(assertion, "Report assertion matched")
    : fail(assertion, "Report assertion did not match");
};

const evaluateActivationAssertion = (
  assertion: EvalAssertion,
  response: RunnerResponse
): AssertionResult => {
  const evidence = response.evaluationReport.nativeActivationEvidence;
  if (!evidence) {
    return fail(
      assertion,
      "Activation evidence is unavailable",
      "CAPABILITY_ACTIVATION_TRACE_UNAVAILABLE"
    );
  }
  return evidence.activated === assertion.expected
    ? pass(assertion, "Activation evidence matched")
    : fail(assertion, "Activation evidence did not match");
};

const evaluateRepoAssertion = async (
  assertion: EvalAssertion,
  context: AssertionContext
): Promise<AssertionResult> => {
  const expected = repoExpectation(assertion.expected);
  if (!expected) {
    return fail(assertion, "repo.state expected value is invalid");
  }
  const [branch, paths] = await Promise.all([
    runGit(context.workspace, ["branch", "--show-current"]),
    changedPaths(context.workspace),
  ]);
  const branchMatches =
    expected.branch === undefined || expected.branch === branch;
  const cleanMatches =
    expected.clean === undefined || expected.clean === (paths.length === 0);
  return branchMatches && cleanMatches
    ? pass(assertion, "Repository state matched")
    : fail(assertion, "Repository state did not match");
};

const evaluateChangedPathsAssertion = async (
  assertion: EvalAssertion,
  workspace: string
): Promise<AssertionResult> => {
  const expected = changedExpectation(assertion.expected);
  if (!expected) {
    return fail(assertion, "git.changedPaths expected value is invalid");
  }
  const paths = await changedPaths(workspace);
  const { allowed } = expected;
  const requiredMatch = (expected.required ?? []).every((path) =>
    paths.includes(path)
  );
  const forbiddenMatch = (expected.forbidden ?? []).every(
    (path) => !paths.includes(path)
  );
  const allowedMatch =
    allowed === undefined || paths.every((path) => allowed.includes(path));
  return requiredMatch && forbiddenMatch && allowedMatch
    ? pass(assertion, "Changed paths matched")
    : fail(assertion, `Changed paths did not match: ${paths.join(", ")}`);
};

const evaluateCommandAssertion = async (
  assertion: EvalAssertion,
  workspace: string
): Promise<AssertionResult> => {
  const expected = commandExpectation(assertion.expected);
  if (!expected) {
    return fail(assertion, "command.exit expected value is invalid");
  }
  try {
    const result = await runCommand(expected.argv, workspace);
    const exitMatches = result.exitCode === expected.exitCode;
    const stdoutMatches =
      expected.stdoutMatches === undefined ||
      matches(result.stdout, expected.stdoutMatches);
    const stderrMatches =
      expected.stderrMatches === undefined ||
      matches(result.stderr, expected.stderrMatches);
    return exitMatches && stdoutMatches && stderrMatches
      ? pass(assertion, "Command result matched")
      : fail(
          assertion,
          `Command result did not match (exit ${result.exitCode})`
        );
  } catch (error) {
    return fail(
      assertion,
      `Command execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

const evaluateAssertion = (
  assertion: EvalAssertion,
  context: AssertionContext
): AssertionResult | Promise<AssertionResult> => {
  if (assertion.kind === "path.exists" || assertion.kind === "path.absent") {
    return evaluatePathAssertion(assertion, context);
  }
  if (
    assertion.kind === "file.changed" ||
    assertion.kind === "file.unchanged"
  ) {
    return evaluateFileAssertion(assertion, context);
  }
  if (assertion.kind === "text.match" || assertion.kind === "text.notMatch") {
    return evaluateTextAssertion(assertion, context);
  }
  if (assertion.kind === "json.path") {
    return evaluateJsonAssertion(assertion, context);
  }
  if (assertion.kind.startsWith("report.")) {
    return evaluateReportAssertion(assertion, context.response);
  }
  if (assertion.kind === "activation") {
    return evaluateActivationAssertion(assertion, context.response);
  }
  if (assertion.kind === "repo.state") {
    return evaluateRepoAssertion(assertion, context);
  }
  if (assertion.kind === "git.changedPaths") {
    return evaluateChangedPathsAssertion(assertion, context.workspace);
  }
  if (assertion.kind === "command.exit") {
    return evaluateCommandAssertion(assertion, context.workspace);
  }
  return fail(assertion, `Unsupported assertion kind: ${assertion.kind}`);
};

export const evaluateAssertions = async (
  assertions: EvalAssertion[],
  context: AssertionContext
): Promise<AssertionResult[]> =>
  Promise.all(
    assertions.map((assertion) => evaluateAssertion(assertion, context))
  );

export const cleanupFixtureWorkspace = async (
  workspace: string,
  options: CleanupOptions
): Promise<void> => {
  if (options.failed && options.keepFailures) {
    return;
  }
  try {
    await lstat(workspace);
  } catch (error) {
    const code = isRecord(error) ? error.code : undefined;
    if (code === "ENOENT") {
      return;
    }
    throw new Error(`Unable to inspect fixture workspace ${workspace}`, {
      cause: error,
    });
  }
  const [canonicalTemporaryRoot, canonicalWorkspace] = await Promise.all([
    realpath(tmpdir()),
    realpath(workspace),
  ]);
  const temporaryRelative = relative(
    canonicalTemporaryRoot,
    canonicalWorkspace
  );
  const isOwnedWorkspace =
    temporaryRelative.length > 0 &&
    !temporaryRelative.startsWith(`..${sep}`) &&
    temporaryRelative !== ".." &&
    !temporaryRelative.includes(sep) &&
    basename(canonicalWorkspace).startsWith(FIXTURE_PREFIX);
  if (!isOwnedWorkspace) {
    throw new Error(
      `Refusing to delete non-evaluator workspace: ${canonicalWorkspace}`
    );
  }
  await rm(canonicalWorkspace, { force: true, recursive: true });
};
