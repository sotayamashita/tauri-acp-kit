import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTauriMocks, cleanupTauriMocks } from "../../test/tauri-mocks";
import { AcpAgent } from "tauri-acp";

const mockModels = [
  { id: "claude-sonnet-4", name: "Claude Sonnet 4" },
  { id: "claude-opus-4", name: "Claude Opus 4", description: "Most capable" },
];

describe("AcpAgent", () => {
  beforeEach(() => {
    setupTauriMocks({
      "plugin:acp|acp_spawn_agent": () => "test-agent-id",
      "plugin:acp|acp_start_session": () => ({
        sessionId: "test-session-id",
        models: mockModels,
        currentModelId: "claude-sonnet-4",
      }),
      "plugin:acp|acp_set_model": () => undefined,
      "plugin:acp|acp_terminate_agent": () => undefined,
    });
  });

  afterEach(() => {
    cleanupTauriMocks();
  });

  it("spawn stores agent id and spec", async () => {
    const agent = new AcpAgent();
    expect(agent.id).toBeNull();
    expect(agent.spec).toBeNull();

    const id = await agent.spawn({ id: "test", executable: "test", args: [] });

    expect(id).toBe("test-agent-id");
    expect(agent.id).toBe("test-agent-id");
    expect(agent.spec?.id).toBe("test");
  });

  it("terminate clears agent id", async () => {
    const agent = new AcpAgent();
    await agent.spawn({ id: "test", executable: "test", args: [] });
    expect(agent.id).toBe("test-agent-id");

    await agent.terminate();
    expect(agent.id).toBeNull();
  });

  it("terminate throws if agent not spawned", async () => {
    const agent = new AcpAgent();
    await expect(agent.terminate()).rejects.toThrow("Agent not spawned");
  });

  it("startSession throws if agent not spawned", async () => {
    const agent = new AcpAgent();
    await expect(agent.startSession(".")).rejects.toThrow("Agent not spawned");
  });
});

describe("AcpSession with models", () => {
  beforeEach(() => {
    setupTauriMocks({
      "plugin:acp|acp_spawn_agent": () => "test-agent-id",
      "plugin:acp|acp_start_session": () => ({
        sessionId: "test-session-id",
        models: mockModels,
        currentModelId: "claude-sonnet-4",
      }),
      "plugin:acp|acp_set_model": () => undefined,
      "plugin:acp|acp_terminate_agent": () => undefined,
      "plugin:acp|acp_cancel": () => undefined,
      "plugin:acp|acp_send_prompt": () => "response-id",
    });
  });

  afterEach(() => {
    cleanupTauriMocks();
  });

  it("startSession returns session with models and currentModelId", async () => {
    const agent = new AcpAgent();
    await agent.spawn({ id: "test", executable: "test", args: [] });
    const session = await agent.startSession(".");

    expect(session.id).toBe("test-session-id");
    expect(session.models).toHaveLength(2);
    expect(session.models[0].id).toBe("claude-sonnet-4");
    expect(session.models[0].name).toBe("Claude Sonnet 4");
    expect(session.models[1].description).toBe("Most capable");
    expect(session.currentModelId).toBe("claude-sonnet-4");
  });

  it("setModel sends the correct command and updates currentModelId", async () => {
    const agent = new AcpAgent();
    await agent.spawn({ id: "test", executable: "test", args: [] });
    const session = await agent.startSession(".");

    expect(session.currentModelId).toBe("claude-sonnet-4");

    await session.setModel("claude-opus-4");

    expect(session.currentModelId).toBe("claude-opus-4");
  });

  it("sendPrompt sends the prompt and returns response id", async () => {
    const agent = new AcpAgent();
    await agent.spawn({ id: "test", executable: "test", args: [] });
    const session = await agent.startSession(".");

    const responseId = await session.sendPrompt("Hello");
    expect(responseId).toBe("response-id");
  });

  it("cancel sends the cancel command", async () => {
    const agent = new AcpAgent();
    await agent.spawn({ id: "test", executable: "test", args: [] });
    const session = await agent.startSession(".");

    // Should not throw
    await session.cancel();
  });

  it("session exposes agentId", async () => {
    const agent = new AcpAgent();
    await agent.spawn({ id: "test", executable: "test", args: [] });
    const session = await agent.startSession(".");

    expect(session.agentId).toBe("test-agent-id");
  });
});
