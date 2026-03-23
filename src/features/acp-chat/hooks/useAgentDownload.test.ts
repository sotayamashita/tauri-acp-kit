import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { DownloadProgress } from "tauri-acp";

// Capture the event callback so we can simulate progress events
let progressCallback: ((p: DownloadProgress) => void) | null = null;
const mockUnlisten = vi.fn();
const mockDownloadAgent = vi.fn();

// Controls for deferred listener registration
let deferredResolve: ((fn: () => void) => void) | null = null;
let useDeferred = false;

vi.mock("tauri-acp", () => ({
  downloadAgent: (...args: unknown[]) => mockDownloadAgent(...args),
  onDownloadProgress: (cb: (p: DownloadProgress) => void) => {
    progressCallback = cb;
    if (useDeferred) {
      return new Promise<() => void>((resolve) => {
        deferredResolve = resolve;
      });
    }
    return Promise.resolve(mockUnlisten);
  },
}));

// Import after mock setup
import { useAgentDownload } from "./useAgentDownload";

function makeProgress(overrides: Partial<DownloadProgress> = {}): DownloadProgress {
  return {
    agentId: "codex-acp",
    bytesDownloaded: 0,
    totalBytes: null,
    phase: "resolving",
    ...overrides,
  };
}

describe("useAgentDownload", () => {
  beforeEach(() => {
    progressCallback = null;
    deferredResolve = null;
    useDeferred = false;
    mockUnlisten.mockClear();
    mockDownloadAgent.mockReset();
    mockDownloadAgent.mockResolvedValue({
      agentId: "codex-acp",
      executablePath: "/usr/local/bin/codex-acp",
    });
  });

  it("returns initial state with no progress and not downloading", () => {
    const { result } = renderHook(() => useAgentDownload("codex-acp"));

    expect(result.current.progress).toBeNull();
    expect(result.current.isDownloading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("registers an event listener on mount", () => {
    renderHook(() => useAgentDownload("codex-acp"));

    expect(progressCallback).toBeInstanceOf(Function);
  });

  it("calls unlisten on unmount", async () => {
    const { unmount } = renderHook(() => useAgentDownload("codex-acp"));

    // Wait for the async onDownloadProgress promise to resolve
    await act(async () => {});

    unmount();

    // Cleanup is async (promise.then), wait for microtask
    await act(async () => {});
    expect(mockUnlisten).toHaveBeenCalled();
  });

  it("calls unlisten even when unmounted before promise resolves", async () => {
    useDeferred = true;
    const delayedUnlisten = vi.fn();

    const { unmount } = renderHook(() => useAgentDownload("test-agent"));

    // Unmount BEFORE promise resolves — this is the race condition
    unmount();

    // Now resolve the listener registration after unmount
    deferredResolve?.(delayedUnlisten);
    await act(async () => {});

    expect(delayedUnlisten).toHaveBeenCalledOnce();
  });

  it("download calls downloadAgent with agentId", async () => {
    const { result } = renderHook(() => useAgentDownload("codex-acp"));

    await act(async () => {
      await result.current.download();
    });

    expect(mockDownloadAgent).toHaveBeenCalledWith("codex-acp");
  });

  it("download sets isDownloading to true", async () => {
    // Make downloadAgent hang so we can check the intermediate state
    mockDownloadAgent.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAgentDownload("codex-acp"));

    act(() => {
      result.current.download();
    });

    expect(result.current.isDownloading).toBe(true);
  });

  it("download sets error on failure", async () => {
    mockDownloadAgent.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAgentDownload("codex-acp"));

    await act(async () => {
      await result.current.download();
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.isDownloading).toBe(false);
  });

  it("download clears previous error", async () => {
    mockDownloadAgent.mockRejectedValueOnce(new Error("First error"));

    const { result } = renderHook(() => useAgentDownload("codex-acp"));

    await act(async () => {
      await result.current.download();
    });

    expect(result.current.error).toBe("First error");

    mockDownloadAgent.mockReturnValue(new Promise(() => {}));

    act(() => {
      result.current.download();
    });

    expect(result.current.error).toBeNull();
  });

  it("updates progress when matching agentId event arrives", () => {
    const { result } = renderHook(() => useAgentDownload("codex-acp"));

    const progress = makeProgress({ phase: "downloading", bytesDownloaded: 500, totalBytes: 1000 });

    act(() => {
      progressCallback?.(progress);
    });

    expect(result.current.progress).toEqual(progress);
    expect(result.current.isDownloading).toBe(true);
  });

  it("ignores progress events for different agentId", () => {
    const { result } = renderHook(() => useAgentDownload("codex-acp"));

    act(() => {
      progressCallback?.(makeProgress({ agentId: "other-agent", phase: "downloading" }));
    });

    expect(result.current.progress).toBeNull();
    expect(result.current.isDownloading).toBe(false);
  });

  it("sets isDownloading to false on complete phase", () => {
    const { result } = renderHook(() => useAgentDownload("codex-acp"));

    act(() => {
      progressCallback?.(makeProgress({ phase: "downloading" }));
    });

    expect(result.current.isDownloading).toBe(true);

    act(() => {
      progressCallback?.(makeProgress({ phase: "complete" }));
    });

    expect(result.current.isDownloading).toBe(false);
  });

  it("sets error and stops downloading on failed phase", () => {
    const { result } = renderHook(() => useAgentDownload("codex-acp"));

    act(() => {
      progressCallback?.(makeProgress({ phase: "downloading" }));
    });

    act(() => {
      progressCallback?.(makeProgress({ phase: "failed" }));
    });

    expect(result.current.isDownloading).toBe(false);
    expect(result.current.error).toBe("Download failed");
  });
});
