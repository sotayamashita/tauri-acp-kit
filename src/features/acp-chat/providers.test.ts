import { describe, it, expect } from "vitest";
import { PROVIDERS, REASONING_LEVELS, type ProviderConfig, type ReasoningLevel } from "./providers";

describe("PROVIDERS", () => {
  it("contains claude-code-acp and codex-acp providers", () => {
    expect(PROVIDERS).toHaveLength(2);

    const ids = PROVIDERS.map((p: ProviderConfig) => p.id);
    expect(ids).toContain("claude-code-acp");
    expect(ids).toContain("codex-acp");
  });

  it("each provider has a valid agentSpec with executable", () => {
    for (const provider of PROVIDERS) {
      expect(provider.id).toBeTruthy();
      expect(provider.label).toBeTruthy();
      expect(provider.agentSpec).toBeDefined();
      expect(provider.agentSpec.id).toBe(provider.id);
      expect(provider.agentSpec.executable).toBeTruthy();
    }
  });

  it("claude-code-acp is listed first as default provider", () => {
    expect(PROVIDERS[0].id).toBe("claude-code-acp");
    expect(PROVIDERS[0].label).toBe("Claude Code");
  });

  it("claude-code-acp does not support reasoning level", () => {
    const cc = PROVIDERS.find((p) => p.id === "claude-code-acp")!;
    expect(cc.supportsReasoningLevel).toBe(false);
  });

  it("codex-acp supports reasoning level", () => {
    const codex = PROVIDERS.find((p) => p.id === "codex-acp")!;
    expect(codex.supportsReasoningLevel).toBe(true);
  });
});

describe("REASONING_LEVELS", () => {
  it("contains low, medium, and high", () => {
    expect(REASONING_LEVELS).toEqual(["low", "medium", "high"]);
  });

  it("ReasoningLevel type accepts valid values", () => {
    const level: ReasoningLevel = "medium";
    expect(REASONING_LEVELS).toContain(level);
  });
});
