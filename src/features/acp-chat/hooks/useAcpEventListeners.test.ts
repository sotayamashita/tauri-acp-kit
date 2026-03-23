import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAcpEventListeners } from "./useAcpEventListeners";
import type { Message } from "../types";

type Callback = (...args: unknown[]) => void;

function createMockSession() {
  const listeners: Record<string, Callback> = {};
  return {
    onDelta: vi.fn(async (cb: Callback) => {
      listeners.delta = cb;
      return vi.fn();
    }),
    onThoughtDelta: vi.fn(async (cb: Callback) => {
      listeners.thought = cb;
      return vi.fn();
    }),
    onToolCall: vi.fn(async (cb: Callback) => {
      listeners.toolCall = cb;
      return vi.fn();
    }),
    onToolCallUpdate: vi.fn(async (cb: Callback) => {
      listeners.toolCallUpdate = cb;
      return vi.fn();
    }),
    onPlanUpdate: vi.fn(async (cb: Callback) => {
      listeners.plan = cb;
      return vi.fn();
    }),
    onComplete: vi.fn(async (cb: Callback) => {
      listeners.complete = cb;
      return vi.fn();
    }),
    onError: vi.fn(async (cb: Callback) => {
      listeners.error = cb;
      return vi.fn();
    }),
    listeners,
  };
}

function createRenderArgs(session: ReturnType<typeof createMockSession> | null = null) {
  return {
    session: session as Parameters<typeof useAcpEventListeners>[0],
    setMessages: vi.fn() as React.Dispatch<React.SetStateAction<Message[]>>,
    setIsLoading: vi.fn() as React.Dispatch<React.SetStateAction<boolean>>,
    setError: vi.fn() as React.Dispatch<React.SetStateAction<Error | null>>,
    streamingContentRef: { current: "" },
    streamingThoughtRef: { current: "" },
  };
}

describe("useAcpEventListeners", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when session is null", () => {
    const args = createRenderArgs(null);
    renderHook(() =>
      useAcpEventListeners(
        args.session,
        args.setMessages,
        args.setIsLoading,
        args.setError,
        args.streamingContentRef,
        args.streamingThoughtRef,
      ),
    );
    expect(args.setMessages).not.toHaveBeenCalled();
  });

  it("registers all event listeners when session is provided", async () => {
    const session = createMockSession();
    const args = createRenderArgs(session);
    renderHook(() =>
      useAcpEventListeners(
        args.session,
        args.setMessages,
        args.setIsLoading,
        args.setError,
        args.streamingContentRef,
        args.streamingThoughtRef,
      ),
    );

    // Allow the async setup to complete
    await vi.waitFor(() => {
      expect(session.onDelta).toHaveBeenCalledOnce();
      expect(session.onThoughtDelta).toHaveBeenCalledOnce();
      expect(session.onToolCall).toHaveBeenCalledOnce();
      expect(session.onToolCallUpdate).toHaveBeenCalledOnce();
      expect(session.onPlanUpdate).toHaveBeenCalledOnce();
      expect(session.onComplete).toHaveBeenCalledOnce();
      expect(session.onError).toHaveBeenCalledOnce();
    });
  });

  it("onDelta callback appends text and calls setMessages", async () => {
    const session = createMockSession();
    const args = createRenderArgs(session);
    renderHook(() =>
      useAcpEventListeners(
        args.session,
        args.setMessages,
        args.setIsLoading,
        args.setError,
        args.streamingContentRef,
        args.streamingThoughtRef,
      ),
    );

    await vi.waitFor(() => expect(session.onDelta).toHaveBeenCalledOnce());
    session.listeners.delta("hello");
    expect(args.streamingContentRef.current).toBe("hello");
    expect(args.setMessages).toHaveBeenCalled();
  });

  it("onThoughtDelta callback appends thinking text", async () => {
    const session = createMockSession();
    const args = createRenderArgs(session);
    renderHook(() =>
      useAcpEventListeners(
        args.session,
        args.setMessages,
        args.setIsLoading,
        args.setError,
        args.streamingContentRef,
        args.streamingThoughtRef,
      ),
    );

    await vi.waitFor(() => expect(session.onThoughtDelta).toHaveBeenCalledOnce());
    session.listeners.thought("thinking...");
    expect(args.streamingThoughtRef.current).toBe("thinking...");
    expect(args.setMessages).toHaveBeenCalled();
  });

  it("onToolCall callback calls setMessages", async () => {
    const session = createMockSession();
    const args = createRenderArgs(session);
    renderHook(() =>
      useAcpEventListeners(
        args.session,
        args.setMessages,
        args.setIsLoading,
        args.setError,
        args.streamingContentRef,
        args.streamingThoughtRef,
      ),
    );

    await vi.waitFor(() => expect(session.onToolCall).toHaveBeenCalledOnce());
    session.listeners.toolCall({
      tool_call_id: "tc-1",
      tool_name: "Read",
      status: "pending",
    });
    expect(args.setMessages).toHaveBeenCalled();
  });

  it("onToolCallUpdate callback calls setMessages", async () => {
    const session = createMockSession();
    const args = createRenderArgs(session);
    renderHook(() =>
      useAcpEventListeners(
        args.session,
        args.setMessages,
        args.setIsLoading,
        args.setError,
        args.streamingContentRef,
        args.streamingThoughtRef,
      ),
    );

    await vi.waitFor(() => expect(session.onToolCallUpdate).toHaveBeenCalledOnce());
    session.listeners.toolCallUpdate({
      tool_call_id: "tc-1",
      status: "completed",
    });
    expect(args.setMessages).toHaveBeenCalled();
  });

  it("onComplete callback resets refs and loading state", async () => {
    const session = createMockSession();
    const args = createRenderArgs(session);
    args.streamingContentRef.current = "some content";
    args.streamingThoughtRef.current = "some thought";

    renderHook(() =>
      useAcpEventListeners(
        args.session,
        args.setMessages,
        args.setIsLoading,
        args.setError,
        args.streamingContentRef,
        args.streamingThoughtRef,
      ),
    );

    await vi.waitFor(() => expect(session.onComplete).toHaveBeenCalledOnce());
    session.listeners.complete();
    expect(args.streamingContentRef.current).toBe("");
    expect(args.streamingThoughtRef.current).toBe("");
    expect(args.setIsLoading).toHaveBeenCalledWith(false);
  });

  it("cleanup calls all unlisteners even when unmounted before setup completes", async () => {
    // Create a session where listener registration is delayed
    const unlistenFns = Array.from({ length: 7 }, () => vi.fn());
    let resolvers: Array<() => void> = [];
    const delayedSession = {
      onDelta: vi.fn(() => new Promise<() => void>((r) => resolvers.push(() => r(unlistenFns[0])))),
      onThoughtDelta: vi.fn(
        () => new Promise<() => void>((r) => resolvers.push(() => r(unlistenFns[1]))),
      ),
      onToolCall: vi.fn(
        () => new Promise<() => void>((r) => resolvers.push(() => r(unlistenFns[2]))),
      ),
      onToolCallUpdate: vi.fn(
        () => new Promise<() => void>((r) => resolvers.push(() => r(unlistenFns[3]))),
      ),
      onPlanUpdate: vi.fn(
        () => new Promise<() => void>((r) => resolvers.push(() => r(unlistenFns[4]))),
      ),
      onComplete: vi.fn(
        () => new Promise<() => void>((r) => resolvers.push(() => r(unlistenFns[5]))),
      ),
      onError: vi.fn(() => new Promise<() => void>((r) => resolvers.push(() => r(unlistenFns[6])))),
    };
    const args = createRenderArgs(
      delayedSession as unknown as ReturnType<typeof createMockSession>,
    );

    const { unmount } = renderHook(() =>
      useAcpEventListeners(
        args.session,
        args.setMessages,
        args.setIsLoading,
        args.setError,
        args.streamingContentRef,
        args.streamingThoughtRef,
      ),
    );

    // Unmount immediately BEFORE any promises resolve
    unmount();

    // Now resolve all the listener registrations
    resolvers.forEach((r) => r());

    // Wait for the cleanup promise chain to execute
    await vi.waitFor(() => {
      for (const fn of unlistenFns) {
        expect(fn).toHaveBeenCalledOnce();
      }
    });
  });

  it("onError callback sets error and stops loading", async () => {
    const session = createMockSession();
    const args = createRenderArgs(session);
    renderHook(() =>
      useAcpEventListeners(
        args.session,
        args.setMessages,
        args.setIsLoading,
        args.setError,
        args.streamingContentRef,
        args.streamingThoughtRef,
      ),
    );

    await vi.waitFor(() => expect(session.onError).toHaveBeenCalledOnce());
    session.listeners.error("something went wrong");
    expect(args.setError).toHaveBeenCalled();
    const errorArg = (args.setError as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toBe("something went wrong");
    expect(args.setIsLoading).toHaveBeenCalledWith(false);
  });
});
