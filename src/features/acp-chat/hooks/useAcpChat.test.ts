import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { setupTauriMocks, cleanupTauriMocks } from "../../../test/tauri-mocks";
import { useAcpChat } from "./useAcpChat";
import type { AgentSpec } from "tauri-acp";

const testAgentSpec: AgentSpec = {
  id: "claude-code-acp",
  executable: "claude-code-acp",
  args: [],
};

const codexAgentSpec: AgentSpec = {
  id: "codex-acp",
  executable: "codex-acp",
  args: [],
};

const mockModels = [
  { id: "claude-sonnet-4", name: "Claude Sonnet 4" },
  { id: "claude-opus-4", name: "Claude Opus 4", description: "Most capable" },
];

describe("useAcpChat model support", () => {
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

  it("exposes availableModels from session after initialization", async () => {
    const { result } = renderHook(() => useAcpChat({ agentSpec: testAgentSpec }));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.availableModels).toHaveLength(2);
    expect(result.current.availableModels[0].id).toBe("claude-sonnet-4");
    expect(result.current.availableModels[1].id).toBe("claude-opus-4");
  });

  it("exposes currentModelId from session after initialization", async () => {
    const { result } = renderHook(() => useAcpChat({ agentSpec: testAgentSpec }));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.currentModelId).toBe("claude-sonnet-4");
  });

  it("setModel updates currentModelId", async () => {
    const { result } = renderHook(() => useAcpChat({ agentSpec: testAgentSpec }));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.setModel("claude-opus-4");
    });

    expect(result.current.currentModelId).toBe("claude-opus-4");
  });
});

describe("useAcpChat reasoning level", () => {
  let setModelArgs: Array<{ sessionId: string; modelId: string }>;

  beforeEach(() => {
    setModelArgs = [];
    setupTauriMocks({
      "plugin:acp|acp_spawn_agent": () => "test-agent-id",
      "plugin:acp|acp_start_session": () => ({
        sessionId: "test-session-id",
        models: mockModels,
        currentModelId: "claude-sonnet-4",
      }),
      "plugin:acp|acp_set_model": (args: unknown) => {
        setModelArgs.push(args as { sessionId: string; modelId: string });
        return undefined;
      },
      "plugin:acp|acp_terminate_agent": () => undefined,
    });
  });

  afterEach(() => {
    cleanupTauriMocks();
  });

  it("reasoningLevel is null for providers without reasoning support", async () => {
    const { result } = renderHook(() =>
      useAcpChat({ agentSpec: testAgentSpec, supportsReasoningLevel: false }),
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.reasoningLevel).toBeNull();
  });

  it("reasoningLevel defaults to medium for providers with reasoning support", async () => {
    const { result } = renderHook(() =>
      useAcpChat({ agentSpec: codexAgentSpec, supportsReasoningLevel: true }),
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.reasoningLevel).toBe("medium");
  });

  it("setModel sends plain modelId when reasoning is not supported", async () => {
    const { result } = renderHook(() =>
      useAcpChat({ agentSpec: testAgentSpec, supportsReasoningLevel: false }),
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.setModel("claude-opus-4");
    });

    expect(setModelArgs).toHaveLength(1);
    expect(setModelArgs[0].modelId).toBe("claude-opus-4");
  });

  it("setModel sends combined modelId/level when reasoning is supported", async () => {
    const { result } = renderHook(() =>
      useAcpChat({ agentSpec: codexAgentSpec, supportsReasoningLevel: true }),
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.setModel("claude-opus-4");
    });

    expect(setModelArgs).toHaveLength(1);
    expect(setModelArgs[0].modelId).toBe("claude-opus-4/medium");
  });

  it("setReasoningLevel updates state and sends combined modelId", async () => {
    const { result } = renderHook(() =>
      useAcpChat({ agentSpec: codexAgentSpec, supportsReasoningLevel: true }),
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.setReasoningLevel("high");
    });

    expect(result.current.reasoningLevel).toBe("high");
    expect(setModelArgs).toHaveLength(1);
    expect(setModelArgs[0].modelId).toBe("claude-sonnet-4/high");
  });
});
