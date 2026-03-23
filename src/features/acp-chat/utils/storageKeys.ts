export const THEME_STORAGE_KEY = "acp-theme";

export function reasoningLevelKey(agentId: string): string {
  return `acp-reasoning-level:${agentId}`;
}
