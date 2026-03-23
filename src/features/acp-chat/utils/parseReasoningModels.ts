import type { AcpModel } from "tauri-acp";

export function parseReasoningModels(
  availableModels: AcpModel[],
  currentModelId: string | null,
  supportsReasoningLevel?: boolean,
): {
  displayModels: AcpModel[];
  reasoningLevelsMap: Map<string, string[]> | null;
  baseModelId: string | null;
} {
  if (!supportsReasoningLevel) {
    return {
      displayModels: availableModels,
      reasoningLevelsMap: null,
      baseModelId: currentModelId,
    };
  }

  const map = new Map<string, string[]>();
  const nonCompound: AcpModel[] = [];
  for (const m of availableModels) {
    const slash = m.id.indexOf("/");
    if (slash === -1) {
      nonCompound.push(m);
      continue;
    }
    const base = m.id.substring(0, slash);
    const level = m.id.substring(slash + 1);
    if (!map.has(base)) map.set(base, []);
    map.get(base)!.push(level);
  }

  const dedup: AcpModel[] = [...nonCompound, ...[...map.keys()].map((id) => ({ id, name: id }))];

  let base = currentModelId;
  const slash = currentModelId?.indexOf("/") ?? -1;
  if (slash !== -1) {
    base = currentModelId!.substring(0, slash);
  }

  return { displayModels: dedup, reasoningLevelsMap: map, baseModelId: base };
}
