import { describe, expect, test } from "bun:test";
import {
  buildHermesEnvironment,
  buildHermesInvocation,
  buildHermesPromptRequest,
  extractHermesFinalResponse,
} from "../adapters/hermes.ts";
import type { RunnerRequest, RunnerResponse } from "../lib/types.ts";

const request: RunnerRequest = {
  activationMode: "explicit",
  case: {
    activationMode: "explicit",
    fixture: "dual-changelog",
    id: "hermes-adapter-behavior",
    suite: "behavior",
    tags: ["adapters", "hermes"],
    turns: [
      {
        assertions: [
          { expected: "CHANGELOG_UPDATED", kind: "report.decision" },
        ],
        prompt: "Update the pending changelog.",
      },
    ],
  },
  prompt: "Update the pending changelog.",
  protocolVersion: 1,
  responseSchema: "/portable-skill/evals/schemas/runner-response.schema.json",
  skillDirectory: "/portable-skill",
  timeoutMs: 30_000,
  turnIndex: 0,
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

describe("Hermes adapter", () => {
  test("builds a quiet, safe-mode, Docker-isolated invocation", () => {
    const prompt = "Return the neutral response JSON.";

    expect(
      buildHermesInvocation(request, prompt, {
        model: "available-hermes-model",
        provider: "nous",
      })
    ).toEqual({
      cmd: [
        "hermes",
        "chat",
        "--safe-mode",
        "--quiet",
        "--toolsets",
        "terminal",
        "--source",
        "tool",
        "--max-turns",
        "90",
        "--provider",
        "nous",
        "--model",
        "available-hermes-model",
        "--query",
        prompt,
      ],
      cwd: request.workspace,
      env: {
        TERMINAL_CONTAINER_PERSISTENT: "false",
        TERMINAL_DOCKER_MOUNT_CWD_TO_WORKSPACE: "true",
        TERMINAL_DOCKER_NETWORK: "false",
        TERMINAL_DOCKER_PERSIST_ACROSS_PROCESSES: "false",
        TERMINAL_ENV: "docker",
      },
      input: "",
      removeEnvKeys: ["HERMES_DOCKER_BINARY"],
      removeEnvPrefixes: ["TERMINAL_"],
    });
  });

  test("rejects non-isolated terminal backends", () => {
    expect(() => buildHermesEnvironment("local")).toThrow(
      "requires the Docker terminal backend"
    );
    expect(() => buildHermesEnvironment("ssh")).toThrow(
      "requires the Docker terminal backend"
    );
  });

  test("uses only relative paths inside the mounted workspace", () => {
    expect(
      buildHermesPromptRequest(
        request,
        `${request.workspace}/.simple-changelogs-skill-test`
      )
    ).toMatchObject({
      skillDirectory: "./.simple-changelogs-skill-test",
      workspace: ".",
    });
    expect(() =>
      buildHermesPromptRequest(request, "/tmp/outside-skill")
    ).toThrow("must remain inside the evaluation workspace");
  });

  test("validates one-shot output against the neutral response", () => {
    expect(extractHermesFinalResponse(JSON.stringify(response))).toEqual(
      response
    );
    expect(() => extractHermesFinalResponse("not JSON")).toThrow(
      "not valid JSON"
    );
  });
});
