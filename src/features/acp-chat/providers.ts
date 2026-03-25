import type { AgentSpec } from "tauri-acp";

export interface ProviderConfig {
  id: string;
  label: string;
  agentSpec: AgentSpec;
  supportsReasoningLevel: boolean;
  cliExecutable?: string;
}

export const REASONING_LEVELS = ["low", "medium", "high"] as const;
export type ReasoningLevel = (typeof REASONING_LEVELS)[number];

export const PROVIDERS: ProviderConfig[] = [
  {
    id: "claude-code-acp",
    label: "Claude Code",
    agentSpec: { id: "claude-code-acp", executable: "claude-code-acp", args: [] },
    supportsReasoningLevel: false,
    cliExecutable: "claude",
  },
  {
    id: "codex-acp",
    label: "Codex",
    agentSpec: { id: "codex-acp", executable: "codex-acp", args: [] },
    supportsReasoningLevel: true,
    cliExecutable: "codex",
  },
];
