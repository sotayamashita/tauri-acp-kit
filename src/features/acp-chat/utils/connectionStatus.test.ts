import { describe, it, expect } from "vitest";
import { deriveConnectionStatus } from "./connectionStatus";

const base = {
  error: null,
  spawnFailed: false,
  isDownloading: false,
  isReady: true,
  isLoading: false,
};

describe("deriveConnectionStatus", () => {
  it("returns 'ready' when all nominal", () => {
    expect(deriveConnectionStatus(base)).toBe("ready");
  });

  it("returns 'error' when error exists and spawn did not fail", () => {
    expect(deriveConnectionStatus({ ...base, error: new Error("oops"), isReady: false })).toBe(
      "error",
    );
  });

  it("returns 'downloading' when downloading", () => {
    expect(deriveConnectionStatus({ ...base, isDownloading: true, isReady: false })).toBe(
      "downloading",
    );
  });

  it("returns 'connecting' when not ready and spawn did not fail", () => {
    expect(deriveConnectionStatus({ ...base, isReady: false })).toBe("connecting");
  });

  it("returns 'generating' when loading", () => {
    expect(deriveConnectionStatus({ ...base, isLoading: true })).toBe("generating");
  });

  it("returns 'error' when spawnFailed", () => {
    expect(deriveConnectionStatus({ ...base, spawnFailed: true })).toBe("error");
  });
});
