#!/usr/bin/env bun

import { stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ContractConfigurationError } from "./lib/contract-files.ts";
import {
  type ContractEvaluationOptions,
  type ContractFinding,
  evaluateContracts,
} from "./lib/contracts.ts";
import {
  type CaseEvaluationReport,
  evaluateModelCases,
  ModelEvaluationConfigurationError,
  type ModelEvaluationResult,
} from "./lib/model-eval.ts";

const REPORT_VERSION = 1;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 2_147_483_647;
const COMMANDS = ["contract", "trigger", "behavior", "all"] as const;
const FORMATS = ["text", "json"] as const;

type Command = (typeof COMMANDS)[number];
type OutputFormat = (typeof FORMATS)[number];

interface CliOptions {
  adapter?: string;
  cases: string[];
  command: Command;
  format: OutputFormat;
  keepFailures: boolean;
  skillDirectory: string;
  timeoutMs: number;
}

export interface EvalCliDependencies {
  contractOptions?: ContractEvaluationOptions;
}

interface EvaluationReport {
  cases?: CaseEvaluationReport[];
  counts: {
    assertions?: ModelEvaluationResult["counts"]["assertions"];
    failed: number;
    findings: number;
    passed: number;
    total: number;
  };
  findings: ContractFinding[];
  reportVersion: 1;
  status: "fail" | "pass";
  suite: Command;
}

type ParseResult =
  | { ok: true; options: CliOptions }
  | { error: string; format: OutputFormat; ok: false };

type OptionResult =
  | { error: string; ok: false }
  | { nextIndex: number; ok: true };

const defaultSkillDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  ".."
);

const isCommand = (value: string): value is Command =>
  COMMANDS.some((command) => command === value);

const isFormat = (value: string): value is OutputFormat =>
  FORMATS.some((format) => format === value);

const requiredValue = (
  args: string[],
  index: number,
  option: string
): { error: string } | { value: string } => {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    return { error: `${option} requires a value` };
  }
  return { value };
};

const requestedOutputFormat = (args: string[]): OutputFormat => {
  const formatIndex = args.indexOf("--format");
  return formatIndex >= 0 && args[formatIndex + 1] === "json" ? "json" : "text";
};

const setValueOption = (
  option: string,
  value: string,
  options: CliOptions
): string | undefined => {
  switch (option) {
    case "--adapter":
      options.adapter = value;
      return;
    case "--case":
      options.cases.push(value);
      return;
    case "--format":
      if (!isFormat(value)) {
        return "--format must be text or json";
      }
      options.format = value;
      return;
    case "--skill-directory":
      options.skillDirectory = resolve(value);
      return;
    default: {
      const timeoutMs = Number(value);
      if (
        !Number.isInteger(timeoutMs) ||
        timeoutMs < 1 ||
        timeoutMs > MAX_TIMEOUT_MS
      ) {
        return `--timeout-ms must be an integer from 1 to ${MAX_TIMEOUT_MS}`;
      }
      options.timeoutMs = timeoutMs;
    }
  }
};

const parseOption = (
  args: string[],
  index: number,
  options: CliOptions
): OptionResult => {
  const option = args[index];
  if (option === "--keep-failures") {
    options.keepFailures = true;
    return { nextIndex: index + 1, ok: true };
  }
  if (
    option !== "--adapter" &&
    option !== "--case" &&
    option !== "--format" &&
    option !== "--skill-directory" &&
    option !== "--timeout-ms"
  ) {
    return { error: `Unknown option: ${option ?? ""}`, ok: false };
  }
  const candidate = requiredValue(args, index, option);
  if ("error" in candidate) {
    return { error: candidate.error, ok: false };
  }
  const error = setValueOption(option, candidate.value, options);
  return error ? { error, ok: false } : { nextIndex: index + 2, ok: true };
};

const parseArguments = (args: string[]): ParseResult => {
  const requestedFormat = requestedOutputFormat(args);
  const [commandValue] = args;
  if (!(commandValue && isCommand(commandValue))) {
    return {
      error: commandValue
        ? `Unknown command: ${commandValue}`
        : "Missing command; expected contract, trigger, behavior, or all",
      format: requestedFormat,
      ok: false,
    };
  }

  const options: CliOptions = {
    cases: [],
    command: commandValue,
    format: "text",
    keepFailures: false,
    skillDirectory: defaultSkillDirectory,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  let index = 1;
  while (index < args.length) {
    const result = parseOption(args, index, options);
    if (!result.ok) {
      return {
        error: result.error,
        format: requestedFormat,
        ok: false,
      };
    }
    index = result.nextIndex;
  }

  return { ok: true, options };
};

const pathIsFile = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
};

const validateModelConfiguration = async (
  options: CliOptions
): Promise<string | undefined> => {
  if (options.command === "contract") {
    return;
  }
  if (!options.adapter) {
    return `${options.command} requires --adapter <path>`;
  }
  const adapterPath = resolve(options.adapter);
  if (!(await pathIsFile(adapterPath))) {
    return `Adapter does not exist: ${adapterPath}`;
  }
};

const reportFor = (
  suite: Command,
  findings: ContractFinding[],
  model?: ModelEvaluationResult
): EvaluationReport => {
  const contractTotal = suite === "contract" || suite === "all" ? 1 : 0;
  const contractFailed = findings.length === 0 ? 0 : contractTotal;
  const modelCounts = model?.counts;
  const failed = contractFailed + (modelCounts?.failed ?? 0);
  const report: EvaluationReport = {
    ...(model ? { cases: model.cases } : {}),
    counts: {
      ...(model ? { assertions: model.counts.assertions } : {}),
      failed,
      findings: findings.length,
      passed: contractTotal - contractFailed + (modelCounts?.passed ?? 0),
      total: contractTotal + (modelCounts?.total ?? 0),
    },
    findings,
    reportVersion: REPORT_VERSION,
    status: failed === 0 ? "pass" : "fail",
    suite,
  };
  return report;
};

const writeReport = (report: EvaluationReport, format: OutputFormat): void => {
  if (format === "json") {
    process.stdout.write(`${JSON.stringify(report)}\n`);
    return;
  }

  const lines = [
    `Suite: ${report.suite}`,
    `Status: ${report.status}`,
    `Counts: ${report.counts.total} total, ${report.counts.passed} passed, ${report.counts.failed} failed`,
    `Findings: ${report.counts.findings}`,
  ];
  if (report.cases && report.counts.assertions) {
    lines.push(
      `Cases: ${report.cases.length} total, ${report.cases.filter((item) => item.status === "passed").length} passed, ${report.cases.filter((item) => item.status !== "passed").length} failed`,
      `Assertions: ${report.counts.assertions.total} total, ${report.counts.assertions.passed} passed, ${report.counts.assertions.failed} failed`
    );
    for (const item of report.cases) {
      lines.push(`- [${item.status}] ${item.id}`);
      if (item.workspace) {
        lines.push(`  Workspace: ${item.workspace}`);
      }
    }
  }
  for (const item of report.findings) {
    lines.push(`- [${item.code}] ${item.path}: ${item.message}`);
  }
  process.stdout.write(`${lines.join("\n")}\n`);
};

const writeConfigurationError = (
  message: string,
  format: OutputFormat
): void => {
  if (format === "json") {
    process.stdout.write(
      `${JSON.stringify({
        error: { code: "INVALID_CONFIGURATION", message },
        reportVersion: REPORT_VERSION,
        status: "error",
      })}\n`
    );
    return;
  }
  process.stderr.write(`Configuration error: ${message}\n`);
};

export const runCli = async (
  args: string[],
  dependencies: EvalCliDependencies = {}
): Promise<number> => {
  const parsed = parseArguments(args);
  if (!parsed.ok) {
    writeConfigurationError(parsed.error, parsed.format);
    return 2;
  }

  const configurationError = await validateModelConfiguration(parsed.options);
  if (configurationError) {
    writeConfigurationError(configurationError, parsed.options.format);
    return 2;
  }

  try {
    const findings =
      parsed.options.command === "contract" || parsed.options.command === "all"
        ? await evaluateContracts(
            parsed.options.skillDirectory,
            dependencies.contractOptions
          )
        : [];
    const model =
      parsed.options.command === "contract"
        ? undefined
        : await evaluateModelCases({
            adapterPath: resolve(parsed.options.adapter ?? ""),
            caseIds: parsed.options.cases,
            keepFailures: parsed.options.keepFailures,
            skillDirectory: parsed.options.skillDirectory,
            suite: parsed.options.command,
            timeoutMs: parsed.options.timeoutMs,
          });
    const report = reportFor(parsed.options.command, findings, model);
    writeReport(report, parsed.options.format);
    return report.status === "pass" ? 0 : 1;
  } catch (error) {
    writeConfigurationError(
      error instanceof ContractConfigurationError ||
        error instanceof ModelEvaluationConfigurationError
        ? error.message
        : `Evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
      parsed.options.format
    );
    return 2;
  }
};

if (import.meta.main) {
  process.exitCode = await runCli(process.argv.slice(2));
}
