import { describe, it, expect } from "vitest";
import { parseReasoningModels } from "./parseReasoningModels";

describe("parseReasoningModels", () => {
  it("returns models as-is when supportsReasoningLevel is false", () => {
    const models = [
      { id: "claude-3", name: "Claude 3" },
      { id: "gpt-4", name: "GPT-4" },
    ];
    const result = parseReasoningModels(models, "claude-3", false);
    expect(result).toEqual({
      displayModels: models,
      reasoningLevelsMap: null,
      baseModelId: "claude-3",
    });
  });

  it("deduplicates compound model IDs into base entries with reasoning levels map", () => {
    const models = [
      { id: "claude/high", name: "claude/high" },
      { id: "claude/medium", name: "claude/medium" },
      { id: "claude/low", name: "claude/low" },
      { id: "gpt-4", name: "GPT-4" },
    ];
    const result = parseReasoningModels(models, "claude/high", true);

    expect(result.displayModels).toEqual([
      { id: "gpt-4", name: "GPT-4" },
      { id: "claude", name: "claude" },
    ]);
    expect(result.reasoningLevelsMap).toEqual(new Map([["claude", ["high", "medium", "low"]]]));
    expect(result.baseModelId).toBe("claude");
  });

  it("extracts baseModelId from compound currentModelId", () => {
    const models = [{ id: "claude/high", name: "claude/high" }];
    const result = parseReasoningModels(models, "claude/high", true);
    expect(result.baseModelId).toBe("claude");
  });

  it("returns currentModelId unchanged when it has no separator", () => {
    const models = [{ id: "gpt-4", name: "GPT-4" }];
    const result = parseReasoningModels(models, "gpt-4", true);
    expect(result.baseModelId).toBe("gpt-4");
  });

  it("handles null currentModelId", () => {
    const models = [{ id: "claude/high", name: "claude/high" }];
    const result = parseReasoningModels(models, null, true);
    expect(result.baseModelId).toBeNull();
  });
});
