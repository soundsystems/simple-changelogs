import { afterEach, describe, expect, test } from "bun:test";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildClaudeCommand,
  buildClaudeInvocation,
  buildClaudeSandboxSettings,
  extractClaudeFinalResponse,
  prepareClaudeResponseSchema,
} from "../adapters/claude.ts";
import {
  buildCodexCommand,
  extractCodexFinalResponse,
} from "../adapters/codex.ts";
import {
  buildAdapterPrompt,
  createReadOnlySkillSnapshot,
  normalizeAdapterResponse,
  normalizeVendorFailure,
  runVendorProcess,
} from "../adapters/shared.ts";
import type { RunnerRequest, RunnerResponse } from "../lib/types.ts";

const temporaryDirectories: string[] = [];

const request: RunnerRequest = {
  activationMode: "explicit",
  case: {
    activationMode: "explicit",
    fixture: "dual-changelog",
    id: "adapter-behavior",
    suite: "behavior",
    tags: ["adapters"],
    turns: [
      {
        assertions: [{ expected: "CHANGELOG_UPDATED", kind: "decision-code" }],
        prompt: "Update the pending changelog.",
      },
    ],
  },
  prompt: "Update the pending changelog.",
  protocolVersion: 1,
  responseSchema: "/portable-skill/evals/schemas/runner-response.schema.json",
  skillDirectory: "/portable-skill",
  timeoutMs: 30_000,
  transcript: [
    { content: "First request", role: "user" },
    { content: "First response", role: "assistant" },
  ],
  turnIndex: 1,
  workspace: "/tmp/simple-changelogs-workspace",
};

const response: RunnerResponse = {
  evaluationReport: {
    authorizationRecords: [],
    decisionCodes: ["CHANGELOG_UPDATED"],
    reasonCodes: ["USER_VISIBLE_CHANGE"],
    verificationResults: [],
    versionMap: [],
  },
  finalResponse: "Updated the pending changelog.",
  protocolVersion: 1,
  status: "completed",
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

describe("vendor command builders", () => {
  test("builds the Codex CLI 0.41.0 argument array", () => {
    expect(buildCodexCommand(request, "/tmp/codex-last-message.json")).toEqual([
      "codex",
      "exec",
      "--config",
      "mcp_servers={}",
      "--cd",
      request.workspace,
      "--sandbox",
      "workspace-write",
      "--json",
      "--output-schema",
      request.responseSchema,
      "--output-last-message",
      "/tmp/codex-last-message.json",
      "-",
    ]);
    expect(
      buildCodexCommand(
        request,
        "/tmp/codex-last-message.json",
        "codex",
        "available-codex-model"
      )
    ).toEqual([
      "codex",
      "exec",
      "--config",
      "mcp_servers={}",
      "--model",
      "available-codex-model",
      "--cd",
      request.workspace,
      "--sandbox",
      "workspace-write",
      "--json",
      "--output-schema",
      request.responseSchema,
      "--output-last-message",
      "/tmp/codex-last-message.json",
      "-",
    ]);
  });

  test("builds the Claude Code 2.1.177 argument array", () => {
    const responseSchema = '{"type":"object"}';
    const sandboxSettings = buildClaudeSandboxSettings(request);

    expect(buildClaudeCommand(request, responseSchema)).toEqual([
      "claude",
      "--print",
      "--output-format",
      "json",
      "--safe-mode",
      "--no-session-persistence",
      "--no-chrome",
      "--permission-mode",
      "dontAsk",
      "--tools",
      "Read,Glob,Grep,Edit,Write,Bash",
      "--allowedTools",
      "Read,Glob,Grep,Edit,Write,Bash",
      "--settings",
      sandboxSettings,
      "--json-schema",
      responseSchema,
    ]);
    const modelCommand = buildClaudeCommand(
      request,
      responseSchema,
      "claude",
      "available-claude-model"
    );
    const modelIndex = modelCommand.indexOf("--model");
    expect(modelCommand.slice(modelIndex, modelIndex + 2)).toEqual([
      "--model",
      "available-claude-model",
    ]);
    expect(buildClaudeInvocation(request, responseSchema).cwd).toBe(
      request.workspace
    );
    expect(buildClaudeCommand(request, responseSchema)).toContain(
      "Read,Glob,Grep,Edit,Write,Bash"
    );
    expect(JSON.parse(sandboxSettings)).toEqual({
      sandbox: {
        allowUnsandboxedCommands: false,
        enabled: true,
        failIfUnavailable: true,
        filesystem: {
          allowWrite: [request.workspace],
          denyWrite: [request.skillDirectory],
        },
      },
    });
  });

  test("dereferences the neutral response schema for Claude structured output", () => {
    const prepared = JSON.parse(
      prepareClaudeResponseSchema(
        JSON.stringify({
          $defs: { value: { minLength: 1, type: "string" } },
          $schema: "https://json-schema.org/draft/2020-12/schema",
          additionalProperties: false,
          properties: { answer: { $ref: "#/$defs/value" } },
          required: ["answer"],
          type: "object",
        })
      )
    );

    expect(prepared).toEqual({
      additionalProperties: false,
      properties: { answer: { minLength: 1, type: "string" } },
      required: ["answer"],
      type: "object",
    });
  });
});

describe("portable adapter prompt", () => {
  test("explicit mode names the copied local skill", () => {
    const prompt = buildAdapterPrompt(request, '{"type":"object"}');

    expect(prompt).toContain(
      `Use the local simple-changelogs skill at ${request.skillDirectory}/SKILL.md`
    );
    expect(prompt).toContain(request.workspace);
    expect(prompt).toContain("Treat the skill directory as read-only");
    expect(prompt).toContain(request.prompt);
    expect(prompt).toContain("First request");
    expect(prompt).toContain('{"type":"object"}');
  });

  test("discover mode asks the runtime to classify activation", () => {
    const prompt = buildAdapterPrompt(
      {
        ...request,
        activationMode: "discover",
        case: { ...request.case, activationMode: "discover", suite: "trigger" },
        transcript: undefined,
      },
      '{"type":"object"}'
    );

    expect(prompt).toContain(
      "decide whether the supplied skill metadata applies"
    );
    expect(prompt).toContain("native activation trace");
    expect(prompt).not.toContain("Use the local simple-changelogs skill");
  });
});

describe("vendor response extraction", () => {
  test("extracts Codex's output-last-message response", () => {
    expect(extractCodexFinalResponse(JSON.stringify(response))).toEqual(
      response
    );
  });

  test("extracts Claude's print-mode result response", () => {
    expect(
      extractClaudeFinalResponse(
        JSON.stringify({
          is_error: false,
          result: JSON.stringify(response),
          subtype: "success",
          type: "result",
        })
      )
    ).toEqual(response);
  });

  test("extracts Claude's schema-validated structured output", () => {
    expect(
      extractClaudeFinalResponse(
        JSON.stringify({
          is_error: false,
          structured_output: response,
          subtype: "success",
          type: "result",
        })
      )
    ).toEqual(response);
  });

  test("validates extracted output against the neutral response contract", () => {
    expect(() =>
      extractCodexFinalResponse(
        JSON.stringify({ ...response, protocolVersion: 2 })
      )
    ).toThrow("neutral protocol");
  });
});

describe("activation normalization", () => {
  test("marks discover mode unsupported without a native trace", () => {
    const normalized = normalizeAdapterResponse(
      {
        ...request,
        activationMode: "discover",
        case: { ...request.case, activationMode: "discover", suite: "trigger" },
      },
      response,
      "Example Runtime"
    );

    expect(normalized.status).toBe("skipped");
    expect(normalized.diagnostics).toContainEqual({
      code: "CAPABILITY_ACTIVATION_TRACE_UNAVAILABLE",
      message: "Example Runtime did not provide a native activation trace",
    });
  });

  test("preserves real discover-mode runtime errors", () => {
    const normalized = normalizeAdapterResponse(
      {
        ...request,
        activationMode: "discover",
        case: { ...request.case, activationMode: "discover", suite: "trigger" },
      },
      {
        ...response,
        diagnostics: [{ code: "MODEL_ERROR", message: "runtime failed" }],
        status: "error",
      },
      "Example Runtime"
    );

    expect(normalized.status).toBe("error");
    expect(normalized.diagnostics).toEqual([
      { code: "MODEL_ERROR", message: "runtime failed" },
    ]);
  });
});

describe("Claude skill snapshot isolation", () => {
  test("copies the skill under the workspace as read-only and cleans it", async () => {
    const directory = await mkdtemp(join(tmpdir(), "adapter-snapshot-"));
    temporaryDirectories.push(directory);
    const source = join(directory, "source-skill");
    const workspace = join(directory, "workspace");
    await Promise.all([
      mkdir(join(source, "references"), { recursive: true }),
      mkdir(workspace),
    ]);
    await Promise.all([
      writeFile(join(source, "SKILL.md"), "# Source skill\n"),
      writeFile(join(source, "references", "setup.md"), "# Setup\n"),
    ]);

    const snapshot = await createReadOnlySkillSnapshot(source, workspace);
    const copiedSkill = join(snapshot.path, "SKILL.md");
    try {
      expect(snapshot.path.startsWith(`${await realpath(workspace)}/`)).toBe(
        true
      );
      expect((await lstat(copiedSkill)).mode % 0o1000).toBe(0o444);
      await expect(writeFile(copiedSkill, "mutated\n")).rejects.toThrow();
      expect(await readFile(join(source, "SKILL.md"), "utf8")).toBe(
        "# Source skill\n"
      );
    } finally {
      await snapshot.cleanup();
    }
    await expect(lstat(snapshot.path)).rejects.toThrow();
  });
});

describe("vendor process failures", () => {
  test("normalizes a missing CLI", () => {
    const failure = normalizeVendorFailure("Codex CLI", {
      error: { code: "ENOENT", message: "spawn codex ENOENT" },
      stderr: "",
      stdout: "",
    });

    expect(failure).toEqual({
      code: "CLI_NOT_FOUND",
      message: "Codex CLI executable was not found",
    });
  });

  test("normalizes authentication and configuration failures", () => {
    expect(
      normalizeVendorFailure("Claude Code", {
        exitCode: 1,
        stderr: "Authentication failed: please run /login",
        stdout: "",
      }).code
    ).toBe("AUTHENTICATION_REQUIRED");
    expect(
      normalizeVendorFailure("Claude Code", {
        exitCode: 1,
        stderr: "Invalid configuration file",
        stdout: "",
      }).code
    ).toBe("INVALID_CONFIGURATION");
    expect(
      normalizeVendorFailure("Codex CLI", {
        exitCode: 2,
        stderr: "The selected model requires a newer version of Codex",
        stdout: "",
      }).code
    ).toBe("INVALID_CONFIGURATION");
  });

  test("preserves vendor stdout and stderr without a shell", async () => {
    const directory = await mkdtemp(join(tmpdir(), "adapter-vendor-process-"));
    temporaryDirectories.push(directory);

    const result = await runVendorProcess({
      cmd: [
        process.execPath,
        "-e",
        'process.stdout.write("vendor event\\n"); process.stderr.write("vendor log\\n")',
      ],
      cwd: directory,
      input: "adapter prompt",
    });

    expect(result).toMatchObject({
      exitCode: 0,
      stderr: "vendor log\n",
      stdout: "vendor event\n",
    });
  });
});
