import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTauriMocks, cleanupTauriMocks } from "../../test/tauri-mocks";
import { AcpAgent } from "tauri-acp";

describe("AcpSession with models", () => {
  beforeEach(() => {
    setupTauriMocks({
      "plugin:acp|acp_spawn_agent": () => "test-agent-id",
      "plugin:acp|acp_start_session": () => ({
        sessionId: "test-session-id",
        models: [
          { id: "claude-sonnet-4", name: "Claude Sonnet 4" },
          { id: "claude-opus-4", name: "Claude Opus 4", description: "Most capable" },
        ],
        currentModelId: "claude-sonnet-4",
      }),
      "plugin:acp|acp_set_model": () => undefined,
      "plugin:acp|acp_terminate_agent": () => undefined,
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
});
