import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { setupTauriMocks, cleanupTauriMocks } from "../../../test/tauri-mocks";
import { useAcpSession } from "./useAcpSession";
import type { Message } from "../types";

const testAgentSpec = { id: "test-agent", executable: "test-agent", args: [] as string[] };
const mockModels = [
  { id: "claude-sonnet-4", name: "Claude Sonnet 4" },
  { id: "claude-opus-4", name: "Claude Opus 4" },
];

describe("useAcpSession", () => {
  beforeEach(() => {
    setupTauriMocks({
      "plugin:acp|acp_spawn_agent": () => "test-agent-id",
      "plugin:acp|acp_start_session": () => ({
        sessionId: "test-session-id",
        models: mockModels,
        currentModelId: "claude-sonnet-4",
      }),
      "plugin:acp|acp_terminate_agent": () => undefined,
    });
  });

  afterEach(() => {
    cleanupTauriMocks();
  });

  it("initializes session and sets isReady to true", async () => {
    const setMessages = vi.fn();
    const setIsLoading = vi.fn();
    const { result } = renderHook(() =>
      useAcpSession({ agentSpec: testAgentSpec }, setMessages, setIsLoading),
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.availableModels).toHaveLength(2);
    expect(result.current.currentModelId).toBe("claude-sonnet-4");
    expect(result.current.error).toBeNull();
  });

  it("sets error on spawn failure and isReady remains false", async () => {
    cleanupTauriMocks();
    setupTauriMocks({
      "plugin:acp|acp_spawn_agent": () => {
        throw new Error("No such file or directory");
      },
      "plugin:acp|acp_terminate_agent": () => undefined,
    });

    const setMessages = vi.fn();
    const setIsLoading = vi.fn();
    const { result } = renderHook(() =>
      useAcpSession({ agentSpec: testAgentSpec }, setMessages, setIsLoading),
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.isReady).toBe(false);
    expect(result.current.error?.message).toContain("not found");
  });

  it("calls onError callback on initialization failure", async () => {
    cleanupTauriMocks();
    setupTauriMocks({
      "plugin:acp|acp_spawn_agent": () => {
        throw new Error("Permission denied");
      },
      "plugin:acp|acp_terminate_agent": () => undefined,
    });

    const onError = vi.fn();
    const setMessages = vi.fn();
    const setIsLoading = vi.fn();
    renderHook(() =>
      useAcpSession({ agentSpec: testAgentSpec, onError }, setMessages, setIsLoading),
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });

    expect(onError.mock.calls[0][0].message).toContain("permission");
  });

  it("terminates agent on unmount", async () => {
    const terminateCalls: unknown[] = [];
    cleanupTauriMocks();
    setupTauriMocks({
      "plugin:acp|acp_spawn_agent": () => "test-agent-id",
      "plugin:acp|acp_start_session": () => ({
        sessionId: "test-session-id",
        models: mockModels,
        currentModelId: "claude-sonnet-4",
      }),
      "plugin:acp|acp_terminate_agent": (args: unknown) => {
        terminateCalls.push(args);
        return undefined;
      },
    });

    const setMessages = vi.fn() as React.Dispatch<React.SetStateAction<Message[]>>;
    const setIsLoading = vi.fn() as React.Dispatch<React.SetStateAction<boolean>>;
    const { result, unmount } = renderHook(() =>
      useAcpSession({ agentSpec: testAgentSpec }, setMessages, setIsLoading),
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    unmount();

    await waitFor(() => {
      expect(terminateCalls.length).toBeGreaterThan(0);
    });
  });
});
