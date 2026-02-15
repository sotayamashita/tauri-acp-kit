import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReasoningLevel } from "./useReasoningLevel";

describe("useReasoningLevel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when supportsReasoningLevel is false", () => {
    const { result } = renderHook(() =>
      useReasoningLevel({ agentId: "test", supportsReasoningLevel: false }),
    );
    expect(result.current.reasoningLevel).toBeNull();
  });

  it("defaults to medium when supportsReasoningLevel is true", () => {
    const { result } = renderHook(() =>
      useReasoningLevel({ agentId: "test", supportsReasoningLevel: true }),
    );
    expect(result.current.reasoningLevel).toBe("medium");
  });

  it("restores from localStorage when available", () => {
    localStorage.setItem("acp-reasoning-level:test", "high");

    const { result } = renderHook(() =>
      useReasoningLevel({ agentId: "test", supportsReasoningLevel: true }),
    );
    expect(result.current.reasoningLevel).toBe("high");
  });

  it("ignores invalid localStorage values", () => {
    localStorage.setItem("acp-reasoning-level:test", "invalid");

    const { result } = renderHook(() =>
      useReasoningLevel({ agentId: "test", supportsReasoningLevel: true }),
    );
    expect(result.current.reasoningLevel).toBe("medium");
  });

  it("persists to localStorage on change", () => {
    const { result } = renderHook(() =>
      useReasoningLevel({ agentId: "test", supportsReasoningLevel: true }),
    );

    act(() => {
      result.current.setReasoningLevel("low");
    });

    expect(result.current.reasoningLevel).toBe("low");
    expect(localStorage.getItem("acp-reasoning-level:test")).toBe("low");
  });

  it("getWireModelId appends reasoning level when supported", () => {
    const { result } = renderHook(() =>
      useReasoningLevel({ agentId: "test", supportsReasoningLevel: true }),
    );
    expect(result.current.getWireModelId("claude-sonnet-4")).toBe("claude-sonnet-4/medium");
  });

  it("getWireModelId returns plain modelId when not supported", () => {
    const { result } = renderHook(() =>
      useReasoningLevel({ agentId: "test", supportsReasoningLevel: false }),
    );
    expect(result.current.getWireModelId("claude-sonnet-4")).toBe("claude-sonnet-4");
  });

  it("getWireModelId uses updated reasoning level after change", () => {
    const { result } = renderHook(() =>
      useReasoningLevel({ agentId: "test", supportsReasoningLevel: true }),
    );

    act(() => {
      result.current.setReasoningLevel("high");
    });

    expect(result.current.getWireModelId("claude-sonnet-4")).toBe("claude-sonnet-4/high");
  });
});
