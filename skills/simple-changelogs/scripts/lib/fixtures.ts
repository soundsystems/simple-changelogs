import type { Stats } from "node:fs";
import {
  chmod,
  cp,
  lstat,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawn } from "bun";
import type { EvalAssertion, JsonValue, RunnerResponse } from "./types.ts";

const FIXTURE_PREFIX = "simple-changelogs-eval-";
const FIXTURE_SKILL_FILENAME = "SKILL.fixture.md";
const WORKSPACE_SKILL_FILENAME = "SKILL.md";
const PATH_SEPARATOR_PATTERN = /[\\/]/u;
const ARRAY_INDEX_PATTERN = /^(?:0|[1-9]\d*)$/u;
const DETERMINISTIC_GIT_DATE = "2000-01-01T00:00:00+00:00";
const DEFAULT_COMMAND_TIMEOUT_MS = 30_000;
const MAX_COMMAND_TIMEOUT_MS = 2_147_483_647;
const OUTPUT_DRAIN_GRACE_MS = 250;
const PROCESS_EXIT_GRACE_MS = 1000;
const USE_POSIX_PROCESS_GROUP = process.platform !== "win32";
const NULL_DEVICE = process.platform === "win32" ? "NUL" : "/dev/null";
const ownedWorkspaces = new Map<string, { device: number; inode: number }>();

const compareText = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
};

const isPermissionError = (error: unknown): boolean =>
  isRecord(error) && (error.code === "EACCES" || error.code === "EPERM");

const makeDirectoriesWritable = async (root: string): Promise<void> => {
  const metadata = await lstat(root);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    return;
  }
  await chmod(root, 0o700);
  const entries = await readdir(root, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
      .map((entry) => makeDirectoriesWritable(join(root, entry.name)))
  );
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

const hasOnlyKeys = (
  value: Record<string, unknown>,
  allowed: string[]
): boolean => Object.keys(value).every((key) => allowed.includes(key));

const isRecordWithOnlyKeys = (
  value: unknown,
  allowed: string[]
): value is Record<string, unknown> =>
  isRecord(value) && hasOnlyKeys(value, allowed);

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

// Bundled fixtures store skill files as SKILL.fixture.md so installed
// packages never expose extra discoverable SKILL.md entries to skill loaders.
// Materialized workspaces restore the canonical filename the cases assert on.
const restoreFixtureSkillFiles = async (root: string): Promise<void> => {
  const entries = await readdir(root, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        await restoreFixtureSkillFiles(path);
        return;
      }
      if (entry.isFile() && entry.name === FIXTURE_SKILL_FILENAME) {
        await rename(path, join(root, WORKSPACE_SKILL_FILENAME));
      }
    })
  );
};

interface CommandResult {
  exitCode: number;
  stderr: string;
  stdout: string;
  timedOut: boolean;
}

interface OutputCapture {
  cancel: () => Promise<void>;
  completed: Promise<void>;
  error: () => string | undefined;
  text: () => string;
}

const captureOutput = (stream: ReadableStream<Uint8Array>): OutputCapture => {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let output = "";
  let readError: string | undefined;
  const readNextChunk = async (): Promise<void> => {
    const { done, value } = await reader.read();
    if (done) {
      output += decoder.decode();
      return;
    }
    output += decoder.decode(value, { stream: true });
    await readNextChunk();
  };
  const completed = readNextChunk()
    .catch((error) => {
      readError = error instanceof Error ? error.message : String(error);
    })
    .finally(() => {
      try {
        reader.releaseLock();
      } catch {
        // Cancellation may already have released the reader.
      }
    });
  return {
    cancel: async () => {
      try {
        await reader.cancel();
      } catch {
        // The reader may already be released after normal completion.
      }
    },
    completed,
    error: () => readError,
    text: () => output,
  };
};

const waitFor = async (
  promise: Promise<unknown>,
  timeoutMs: number
): Promise<boolean> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const elapsed = new Promise<false>((resolveElapsed) => {
    timer = setTimeout(() => resolveElapsed(false), timeoutMs);
  });
  const completed = promise.then(
    () => true as const,
    () => true as const
  );
  const result = await Promise.race([completed, elapsed]);
  if (timer !== undefined) {
    clearTimeout(timer);
  }
  return result;
};

const spawnCommand = (
  argv: string[],
  cwd: string,
  env?: Record<string, string | undefined>
) =>
  spawn({
    cmd: argv,
    cwd,
    detached: USE_POSIX_PROCESS_GROUP,
    ...(env ? { env } : {}),
    stderr: "pipe",
    stdin: "ignore",
    stdout: "pipe",
  });

type CommandProcess = ReturnType<typeof spawnCommand>;

interface KillableProcess {
  kill: (signal?: number | NodeJS.Signals) => void;
}

const killDirectProcess = (child: KillableProcess): void => {
  try {
    child.kill("SIGKILL");
  } catch {
    // The process may already have exited.
  }
};

const killCommandTree = async (child: CommandProcess): Promise<void> => {
  if (USE_POSIX_PROCESS_GROUP) {
    try {
      process.kill(-child.pid, "SIGKILL");
      return;
    } catch {
      killDirectProcess(child);
      return;
    }
  }
  try {
    const terminator = spawn({
      cmd: ["taskkill.exe", "/PID", String(child.pid), "/T", "/F"],
      stderr: "ignore",
      stdin: "ignore",
      stdout: "ignore",
    });
    if (await waitFor(terminator.exited, PROCESS_EXIT_GRACE_MS)) {
      if (terminator.exitCode === 0) {
        return;
      }
    } else {
      killDirectProcess(terminator);
    }
  } catch {
    // Fall through to direct-child termination.
  }
  killDirectProcess(child);
};

const runCommand = async (
  argv: string[],
  cwd: string,
  options: {
    env?: Record<string, string | undefined>;
    timeoutMs?: number;
  } = {}
): Promise<CommandResult> => {
  if (argv.length === 0) {
    throw new Error("Command argv must not be empty");
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > MAX_COMMAND_TIMEOUT_MS
  ) {
    throw new Error(
      `Command timeout must be an integer from 1 to ${MAX_COMMAND_TIMEOUT_MS}`
    );
  }
  const child = spawnCommand(argv, cwd, options.env);
  const stderr = captureOutput(child.stderr);
  const stdout = captureOutput(child.stdout);
  const { exited } = child;
  const completedBeforeTimeout = await waitFor(exited, timeoutMs);
  if (!completedBeforeTimeout) {
    await killCommandTree(child);
    await waitFor(exited, PROCESS_EXIT_GRACE_MS);
  }
  const captures = [stderr, stdout];
  if (
    !(await waitFor(
      Promise.all(captures.map((capture) => capture.completed)),
      OUTPUT_DRAIN_GRACE_MS
    ))
  ) {
    await killCommandTree(child);
    await Promise.all(captures.map((capture) => capture.cancel()));
  }
  const captureError = captures
    .map((capture) => capture.error())
    .find((error) => error !== undefined);
  if (captureError) {
    throw new Error(`Unable to capture command output: ${captureError}`);
  }
  return {
    exitCode: completedBeforeTimeout ? (child.exitCode ?? -1) : -1,
    stderr: stderr.text(),
    stdout: stdout.text(),
    timedOut: !completedBeforeTimeout,
  };
};

const createGitEnvironment = (
  env?: Record<string, string | undefined>
): Record<string, string | undefined> => {
  const gitEnv = { ...process.env };
  for (const key of Object.keys(gitEnv)) {
    if (
      key === "GIT_CONFIG_COUNT" ||
      key === "GIT_CONFIG_PARAMETERS" ||
      key.startsWith("GIT_CONFIG_KEY_") ||
      key.startsWith("GIT_CONFIG_VALUE_") ||
      [
        "GIT_ALTERNATE_OBJECT_DIRECTORIES",
        "GIT_COMMON_DIR",
        "GIT_DIR",
        "GIT_INDEX_FILE",
        "GIT_NAMESPACE",
        "GIT_OBJECT_DIRECTORY",
        "GIT_WORK_TREE",
      ].includes(key)
    ) {
      delete gitEnv[key];
    }
  }
  Object.assign(gitEnv, env, {
    GIT_CONFIG_GLOBAL: NULL_DEVICE,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_SYSTEM: NULL_DEVICE,
  });
  return gitEnv;
};

const runGit = async (
  workspace: string,
  args: string[],
  env?: Record<string, string | undefined>
): Promise<string> => {
  const gitEnv = createGitEnvironment(env);
  const result = await runCommand(["git", ...args], workspace, { env: gitEnv });
  if (result.timedOut || result.exitCode !== 0) {
    const diagnostics = [result.stderr.trim(), result.stdout.trim()]
      .filter((message) => message.length > 0)
      .join("\n");
    throw new Error(
      `git ${args.join(" ")} ${result.timedOut ? "timed out" : "failed"}${diagnostics ? `: ${diagnostics}` : ""}`
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
    await restoreFixtureSkillFiles(workspace);
    const workspaceStat = await lstat(workspace);
    ownedWorkspaces.set(workspace, {
      device: workspaceStat.dev,
      inode: workspaceStat.ino,
    });
    return workspace;
  } catch (error) {
    await rm(workspace, { force: true, recursive: true });
    throw error;
  }
};

export const initializeFixtureGit = async (
  workspace: string
): Promise<string> => {
  await runGit(workspace, ["init", "--initial-branch=main", "--template="]);
  await runGit(workspace, ["config", "user.name", "Simple Changelogs Eval"]);
  await runGit(workspace, [
    "config",
    "user.email",
    "eval@simple-changelogs.invalid",
  ]);
  await runGit(workspace, ["add", "--all"]);
  await runGit(
    workspace,
    [
      "-c",
      `core.hooksPath=${NULL_DEVICE}`,
      "-c",
      "commit.gpgSign=false",
      "commit",
      "--no-gpg-sign",
      "--no-verify",
      "-m",
      "eval fixture baseline",
    ],
    {
      GIT_AUTHOR_DATE: DETERMINISTIC_GIT_DATE,
      GIT_COMMITTER_DATE: DETERMINISTIC_GIT_DATE,
    }
  );
  return runGit(workspace, ["rev-parse", "HEAD"]);
};

const safeWorkspacePath = async (
  workspace: string,
  target: string
): Promise<{ path: string; relative: string } | { error: string }> => {
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
  const inspectPath = async (
    index: number
  ): Promise<{ error: string } | undefined> => {
    const path = paths[index];
    if (!path) {
      return;
    }
    try {
      const item = await lstat(path);
      if (item.isSymbolicLink()) {
        return { error: `Assertion path traverses a symlink: ${target}` };
      }
    } catch (error) {
      const code = isRecord(error) ? error.code : undefined;
      if (code !== "ENOENT") {
        throw new Error(`Unable to inspect assertion path ${target}`, {
          cause: error,
        });
      }
    }
    return inspectPath(index + 1);
  };
  const inspection = await inspectPath(0);
  if (inspection) {
    return inspection;
  }
  const targetRelative = relative(canonicalWorkspace, current);
  if (targetRelative.startsWith(`..${sep}`) || targetRelative === "..") {
    return { error: `Unsafe assertion path: ${target}` };
  }
  return { path: current, relative: segments.join("/") };
};

const changedPaths = async (workspace: string): Promise<string[]> => {
  const result = await runCommand(
    ["git", "status", "--porcelain=v1", "-z", "--untracked-files=all"],
    workspace,
    { env: createGitEnvironment() }
  );
  if (result.timedOut || result.exitCode !== 0) {
    throw new Error(`git status failed: ${result.stderr.trim()}`);
  }
  if (result.stdout.length === 0) {
    return [];
  }
  const records = result.stdout.split("\0");
  const paths: string[] = [];
  let index = 0;
  while (index < records.length) {
    const record = records[index] ?? "";
    if (record.length === 0) {
      index += 1;
      continue;
    }
    const status = record.slice(0, 2);
    const path = record.slice(3);
    if (path.length > 0) {
      paths.push(path);
    }
    index += status.includes("R") || status.includes("C") ? 2 : 1;
  }
  return paths.sort(compareText);
};

const jsonPointer = (
  value: JsonValue,
  pointer: string
): JsonValue | undefined => {
  if (pointer === "") {
    return value;
  }
  if (!pointer.startsWith("/")) {
    return;
  }
  let current: JsonValue | undefined = value;
  for (const rawPart of pointer.split("/").slice(1)) {
    const part = rawPart.replaceAll("~1", "/").replaceAll("~0", "~");
    if (Array.isArray(current)) {
      const index = ARRAY_INDEX_PATTERN.test(part) ? Number(part) : -1;
      current = Number.isSafeInteger(index) ? current[index] : undefined;
    } else if (isRecord(current)) {
      current = current[part] as JsonValue | undefined;
    } else {
      return;
    }
  }
  return current;
};

const jsonEquals = (left: JsonValue | undefined, right: JsonValue): boolean => {
  if (left === right) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((item, index) => jsonEquals(item, right[index] as JsonValue))
    );
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left).sort(compareText);
    const rightKeys = Object.keys(right).sort(compareText);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key, index) =>
          key === rightKeys[index] &&
          jsonEquals(
            left[key] as JsonValue | undefined,
            right[key] as JsonValue
          )
      )
    );
  }
  return false;
};

const changedExpectation = (
  value: JsonValue
): ChangedPathsExpectation | undefined => {
  if (!isRecordWithOnlyKeys(value, ["allowed", "forbidden", "required"])) {
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
  if (!isRecordWithOnlyKeys(value, ["branch", "clean"])) {
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

interface AuthorizationExpectation {
  code: string;
  source?: string;
  status: string;
}

interface VerificationExpectation {
  code: string;
  status: string;
}

interface VersionMapExpectation {
  path: string;
  role?: string;
  version?: string;
}

interface ActivationExpectation {
  activated: boolean;
  excludes: string[];
  includes: string[];
}

const authorizationExpectation = (
  value: JsonValue
): AuthorizationExpectation | undefined => {
  if (typeof value === "string") {
    return { code: value, status: "granted" };
  }
  if (
    !isRecordWithOnlyKeys(value, ["code", "source", "status"]) ||
    typeof value.code !== "string" ||
    (value.source !== undefined && typeof value.source !== "string") ||
    (value.status !== undefined && typeof value.status !== "string")
  ) {
    return;
  }
  return {
    code: value.code,
    ...(value.source === undefined ? {} : { source: value.source }),
    status: value.status ?? "granted",
  };
};

const verificationExpectation = (
  value: JsonValue
): VerificationExpectation | undefined => {
  if (typeof value === "string") {
    return { code: value, status: "passed" };
  }
  if (
    !isRecordWithOnlyKeys(value, ["code", "status"]) ||
    typeof value.code !== "string" ||
    (value.status !== undefined && typeof value.status !== "string")
  ) {
    return;
  }
  return { code: value.code, status: value.status ?? "passed" };
};

const versionMapExpectation = (
  value: JsonValue
): VersionMapExpectation | undefined => {
  if (typeof value === "string") {
    return { path: value };
  }
  if (
    !isRecordWithOnlyKeys(value, ["path", "role", "version"]) ||
    typeof value.path !== "string" ||
    (value.role !== undefined && typeof value.role !== "string") ||
    (value.version !== undefined && typeof value.version !== "string")
  ) {
    return;
  }
  return {
    path: value.path,
    ...(value.role === undefined ? {} : { role: value.role }),
    ...(value.version === undefined ? {} : { version: value.version }),
  };
};

const activationExpectation = (
  value: JsonValue
): ActivationExpectation | undefined => {
  if (typeof value === "boolean") {
    return { activated: value, excludes: [], includes: [] };
  }
  if (
    !isRecordWithOnlyKeys(value, ["activated", "excludes", "includes"]) ||
    typeof value.activated !== "boolean" ||
    (value.excludes !== undefined && !isStringArray(value.excludes)) ||
    (value.includes !== undefined && !isStringArray(value.includes))
  ) {
    return;
  }
  return {
    activated: value.activated,
    excludes: value.excludes ?? [],
    includes: value.includes ?? [],
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
  const resolved = await safeWorkspacePath(context.workspace, assertion.target);
  if ("error" in resolved) {
    return fail(assertion, resolved.error);
  }
  const paths = await changedPaths(context.workspace);
  const isChanged = paths.includes(resolved.relative);
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
    return jsonEquals(jsonPointer(value, pointer), assertion.expected)
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
    case "report.authorization": {
      const authorization = authorizationExpectation(expected);
      matched =
        authorization !== undefined &&
        response.evaluationReport.authorizationRecords.some(
          (record) =>
            record.code === authorization.code &&
            record.status === authorization.status &&
            (authorization.source === undefined ||
              record.source === authorization.source)
        );
      break;
    }
    case "report.versionMap": {
      const version = versionMapExpectation(expected);
      matched =
        version !== undefined &&
        response.evaluationReport.versionMap.some(
          (record) =>
            record.path === version.path &&
            (version.role === undefined || record.role === version.role) &&
            (version.version === undefined ||
              record.version === version.version)
        );
      break;
    }
    case "report.verification": {
      const verification = verificationExpectation(expected);
      matched =
        verification !== undefined &&
        response.evaluationReport.verificationResults.some(
          (record) =>
            record.code === verification.code &&
            record.status === verification.status
        );
      break;
    }
    default:
      return fail(assertion, `Unsupported assertion kind: ${assertion.kind}`);
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
  const expected = activationExpectation(assertion.expected);
  if (!expected) {
    return fail(assertion, "Activation assertion expected value is invalid");
  }
  const includesMatch = expected.includes.every((expectedTrace) =>
    evidence.trace.some((trace) => trace.includes(expectedTrace))
  );
  const excludesMatch = expected.excludes.every((expectedTrace) =>
    evidence.trace.every((trace) => !trace.includes(expectedTrace))
  );
  return evidence.activated === expected.activated &&
    includesMatch &&
    excludesMatch
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
  const expectationEntries = (
    ["allowed", "forbidden", "required"] as const
  ).flatMap((kind) => (expected[kind] ?? []).map((path) => ({ kind, path })));
  const resolvedExpectations = await Promise.all(
    expectationEntries.map(async (entry) => ({
      ...entry,
      resolved: await safeWorkspacePath(workspace, entry.path),
    }))
  );
  const unsafe = resolvedExpectations.find(
    (entry) => "error" in entry.resolved
  );
  if (unsafe && "error" in unsafe.resolved) {
    return fail(assertion, unsafe.resolved.error);
  }
  const normalized: ChangedPathsExpectation = {};
  for (const kind of ["allowed", "forbidden", "required"] as const) {
    const values = resolvedExpectations
      .filter((entry) => entry.kind === kind)
      .map((entry) =>
        "relative" in entry.resolved ? entry.resolved.relative : ""
      );
    if (expected[kind] !== undefined) {
      normalized[kind] = values;
    }
  }
  const paths = await changedPaths(workspace);
  const { allowed } = normalized;
  const requiredMatch = (normalized.required ?? []).every((path) =>
    paths.includes(path)
  );
  const forbiddenMatch = (normalized.forbidden ?? []).every(
    (path) => !paths.includes(path)
  );
  const allowedMatch =
    allowed === undefined || paths.every((path) => allowed.includes(path));
  return requiredMatch && forbiddenMatch && allowedMatch
    ? pass(assertion, "Changed paths matched")
    : fail(assertion, `Changed paths did not match: ${paths.join(", ")}`);
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
  if (
    assertion.kind === "report.status" ||
    assertion.kind === "report.decision" ||
    assertion.kind === "report.authorization" ||
    assertion.kind === "report.versionMap" ||
    assertion.kind === "report.verification"
  ) {
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
  return fail(assertion, `Unsupported assertion kind: ${assertion.kind}`);
};

export const evaluateAssertions = async (
  assertions: EvalAssertion[],
  context: AssertionContext
): Promise<AssertionResult[]> =>
  assertions.reduce<Promise<AssertionResult[]>>(
    async (pendingResults, assertion) => {
      const results = await pendingResults;
      results.push(await evaluateAssertion(assertion, context));
      return results;
    },
    Promise.resolve([])
  );

export const cleanupFixtureWorkspace = async (
  workspace: string,
  options: CleanupOptions
): Promise<void> => {
  const ownership = ownedWorkspaces.get(workspace);
  if (!ownership) {
    throw new Error(`Refusing to delete non-evaluator workspace: ${workspace}`);
  }
  let workspaceStat: Stats;
  try {
    workspaceStat = await lstat(workspace);
  } catch (error) {
    const code = isRecord(error) ? error.code : undefined;
    if (code === "ENOENT") {
      ownedWorkspaces.delete(workspace);
      return;
    }
    throw new Error(`Unable to inspect fixture workspace ${workspace}`, {
      cause: error,
    });
  }
  if (
    workspaceStat.isSymbolicLink() ||
    !workspaceStat.isDirectory() ||
    workspaceStat.dev !== ownership.device ||
    workspaceStat.ino !== ownership.inode
  ) {
    throw new Error(
      `Refusing to delete replaced evaluator workspace: ${workspace}`
    );
  }
  if (options.failed && options.keepFailures) {
    return;
  }
  try {
    await rm(workspace, { force: true, recursive: true });
  } catch (error) {
    if (!isPermissionError(error)) {
      throw error;
    }
    await makeDirectoriesWritable(workspace);
    await rm(workspace, { force: true, recursive: true });
  }
  ownedWorkspaces.delete(workspace);
};
