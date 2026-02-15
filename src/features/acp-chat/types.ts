import type { AgentSpec, AcpModel } from "tauri-acp";
import type { ReasoningLevel } from "./providers";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export interface UseAcpChatOptions {
  agentSpec: AgentSpec;
  cwd?: string;
  supportsReasoningLevel?: boolean;
  onError?: (error: Error) => void;
}

export interface UseAcpChatReturn {
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  error: Error | null;
  isReady: boolean;
  availableModels: AcpModel[];
  currentModelId: string | null;
  reasoningLevel: ReasoningLevel | null;
  append: (content: string) => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
  setModel: (modelId: string) => Promise<void>;
  setReasoningLevel: (level: ReasoningLevel) => Promise<void>;
}
