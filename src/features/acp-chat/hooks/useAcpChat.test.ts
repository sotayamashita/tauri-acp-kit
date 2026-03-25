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
        cwd: "/tmp/test",
        agentVersion: "1.0.0",
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

  it("exposes currentModelName from model.name after initialization", async () => {
    const { result } = renderHook(() => useAcpChat({ agentSpec: testAgentSpec }));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.currentModelName).toBe("Claude Sonnet 4");
  });

  it("currentModelName updates when model changes", async () => {
    const { result } = renderHook(() => useAcpChat({ agentSpec: testAgentSpec }));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.setModel("claude-opus-4");
    });

    expect(result.current.currentModelName).toBe("Claude Opus 4");
  });

  it("currentModelName is null when no model is matched", async () => {
    const { result } = renderHook(() => useAcpChat({ agentSpec: testAgentSpec }));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.setModel("nonexistent-model");
    });

    expect(result.current.currentModelName).toBeNull();
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

const codexModels = [
  { id: "gpt-5.3-codex/low", name: "gpt-5.3-codex (low)" },
  { id: "gpt-5.3-codex/medium", name: "gpt-5.3-codex (medium)" },
  { id: "gpt-5.3-codex/high", name: "gpt-5.3-codex (high)" },
  { id: "o4-mini/low", name: "o4-mini (low)" },
  { id: "o4-mini/medium", name: "o4-mini (medium)" },
  { id: "o4-mini/high", name: "o4-mini (high)" },
];

describe("useAcpChat compound model deduplication", () => {
  beforeEach(() => {
    setupTauriMocks({
      "plugin:acp|acp_spawn_agent": () => "test-agent-id",
      "plugin:acp|acp_start_session": () => ({
        sessionId: "test-session-id",
        cwd: "/tmp/test",
        agentVersion: "1.0.0",
        models: codexModels,
        currentModelId: "gpt-5.3-codex/medium",
      }),
      "plugin:acp|acp_set_model": () => undefined,
      "plugin:acp|acp_terminate_agent": () => undefined,
    });
  });

  afterEach(() => {
    cleanupTauriMocks();
  });

  it("deduplicates compound model IDs when supportsReasoningLevel is true", async () => {
    const { result } = renderHook(() =>
      useAcpChat({ agentSpec: codexAgentSpec, supportsReasoningLevel: true }),
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.availableModels).toHaveLength(2);
    expect(result.current.availableModels[0].id).toBe("gpt-5.3-codex");
    expect(result.current.availableModels[1].id).toBe("o4-mini");
  });

  it("derives base model ID from compound currentModelId", async () => {
    const { result } = renderHook(() =>
      useAcpChat({ agentSpec: codexAgentSpec, supportsReasoningLevel: true }),
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    // currentModelId should be the base model, not the compound ID
    expect(result.current.currentModelId).toBe("gpt-5.3-codex");
  });

  it("exposes reasoning levels for the current model", async () => {
    const { result } = renderHook(() =>
      useAcpChat({ agentSpec: codexAgentSpec, supportsReasoningLevel: true }),
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.reasoningLevels).toEqual(["low", "medium", "high"]);
  });

  it("currentModelName uses base model name for compound IDs", async () => {
    const { result } = renderHook(() =>
      useAcpChat({ agentSpec: codexAgentSpec, supportsReasoningLevel: true }),
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.currentModelName).toBe("gpt-5.3-codex");
  });

  it("does not deduplicate when supportsReasoningLevel is false", async () => {
    const { result } = renderHook(() =>
      useAcpChat({ agentSpec: codexAgentSpec, supportsReasoningLevel: false }),
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    // All 6 models should be present without deduplication
    expect(result.current.availableModels).toHaveLength(6);
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
        cwd: "/tmp/test",
        agentVersion: "1.0.0",
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

describe("useAcpChat message operations", () => {
  let sendPromptArgs: Array<{ sessionId: string; prompt: string }>;
  let cancelCalls: unknown[];

  beforeEach(() => {
    sendPromptArgs = [];
    cancelCalls = [];
    setupTauriMocks({
      "plugin:acp|acp_spawn_agent": () => "test-agent-id",
      "plugin:acp|acp_start_session": () => ({
        sessionId: "test-session-id",
        cwd: "/tmp/test",
        agentVersion: "1.0.0",
        models: mockModels,
        currentModelId: "claude-sonnet-4",
      }),
      "plugin:acp|acp_set_model": () => undefined,
      "plugin:acp|acp_send_prompt": (args: unknown) => {
        sendPromptArgs.push(args as { sessionId: string; prompt: string });
        return "response-id";
      },
      "plugin:acp|acp_cancel": (args: unknown) => {
        cancelCalls.push(args);
        return undefined;
      },
      "plugin:acp|acp_terminate_agent": () => undefined,
    });
  });

  afterEach(() => {
    cleanupTauriMocks();
  });

  it("append adds user and assistant messages", async () => {
    const { result } = renderHook(() => useAcpChat({ agentSpec: testAgentSpec }));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.append("Hello");
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe("user");
    expect(result.current.messages[0].blocks).toEqual([{ type: "text", text: "Hello" }]);
    expect(result.current.messages[1].role).toBe("assistant");
  });

  it("append is a no-op before session is ready", async () => {
    const { result } = renderHook(() => useAcpChat({ agentSpec: testAgentSpec }));

    // Don't wait for ready
    await act(async () => {
      await result.current.append("Hello");
    });

    expect(result.current.messages).toHaveLength(0);
    expect(sendPromptArgs).toHaveLength(0);
  });

  it("stop calls cancel on the session", async () => {
    const { result } = renderHook(() => useAcpChat({ agentSpec: testAgentSpec }));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.stop();
    });

    expect(cancelCalls).toHaveLength(1);
  });

  it("reset clears messages, input, and error", async () => {
    const { result } = renderHook(() => useAcpChat({ agentSpec: testAgentSpec }));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.append("Hello");
    });

    expect(result.current.messages.length).toBeGreaterThan(0);

    act(() => {
      result.current.reset();
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.input).toBe("");
    expect(result.current.error).toBeNull();
  });

  it("exposes approveToolCall and rejectToolCall functions", async () => {
    const { result } = renderHook(() => useAcpChat({ agentSpec: testAgentSpec }));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(typeof result.current.approveToolCall).toBe("function");
    expect(typeof result.current.rejectToolCall).toBe("function");
  });
});
