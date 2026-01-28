import type { AgentSpec } from "tauri-acp";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export interface UseAcpChatOptions {
  agentSpec: AgentSpec;
  cwd?: string;
  onError?: (error: Error) => void;
}

export interface UseAcpChatReturn {
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  error: Error | null;
  isReady: boolean;
  append: (content: string) => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
}
