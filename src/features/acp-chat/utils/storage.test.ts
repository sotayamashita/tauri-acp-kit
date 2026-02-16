import { describe, it, expect, vi, afterEach } from "vitest";
import { safeGetItem, safeSetItem } from "./storage";

describe("safeLocalStorage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("safeGetItem returns value when localStorage works", () => {
    localStorage.setItem("test-key", "test-value");
    expect(safeGetItem("test-key")).toBe("test-value");
    localStorage.removeItem("test-key");
  });

  it("safeGetItem returns null when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(safeGetItem("test-key")).toBeNull();
  });

  it("safeSetItem writes when localStorage works", () => {
    safeSetItem("test-key", "test-value");
    expect(localStorage.getItem("test-key")).toBe("test-value");
    localStorage.removeItem("test-key");
  });

  it("safeSetItem does not throw when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() => safeSetItem("test-key", "test-value")).not.toThrow();
  });
});
