import { describe, it, expect } from "vitest";
import { formatModelId, getDisplayName } from "./format-model-id";

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

describe("getDisplayName", () => {
  it("returns model.name when name contains a space (proper display name)", () => {
    expect(getDisplayName({ id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5" })).toBe(
      "Claude Sonnet 4.5",
    );
  });

  it("returns formatModelId(model.id) when name has no space (alias)", () => {
    expect(getDisplayName({ id: "claude-sonnet-4-5-20250929", name: "Sonnet" })).toBe("Sonnet 4.5");
  });

  it("returns formatModelId(model.id) when name equals id", () => {
    expect(getDisplayName({ id: "gpt-5.3-codex", name: "gpt-5.3-codex" })).toBe("Gpt 5.3 Codex");
  });

  it("returns model.name for codex compound display names", () => {
    expect(getDisplayName({ id: "gpt-5.3-codex/medium", name: "gpt-5.3-codex (medium)" })).toBe(
      "gpt-5.3-codex (medium)",
    );
  });

  it("returns Default for default model alias", () => {
    expect(getDisplayName({ id: "default", name: "Default" })).toBe("Default");
  });
});
