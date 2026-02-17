import { describe, it, expect } from "vitest";
import { formatModelId } from "./format-model-id";

describe("formatModelId", () => {
  it("formats claude-sonnet-4 as Sonnet 4", () => {
    expect(formatModelId("claude-sonnet-4")).toBe("Sonnet 4");
  });

  it("formats claude-opus-4-6 with sub-version as Opus 4.6", () => {
    expect(formatModelId("claude-opus-4-6")).toBe("Opus 4.6");
  });

  it("formats default as Default", () => {
    expect(formatModelId("default")).toBe("Default");
  });

  it("formats claude-3-5-haiku as 3.5 Haiku", () => {
    expect(formatModelId("claude-3-5-haiku")).toBe("3.5 Haiku");
  });

  it("formats claude-sonnet-4-20250514 stripping date suffix", () => {
    expect(formatModelId("claude-sonnet-4-20250514")).toBe("Sonnet 4");
  });

  it("returns original string capitalized for unknown formats", () => {
    expect(formatModelId("some-custom-model")).toBe("Some Custom Model");
  });
});
