import type { AgentSpec, AcpModel, DownloadProgress } from "tauri-acp";
import type { ReasoningLevel } from "./providers";

// --- Content Block types ---

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ThinkingBlock {
  type: "thinking";
  text: string;
}

export type ToolCallStatus =
  | "pending"
  | "waiting_confirmation"
  | "running"
  | "completed"
  | "failed"
  | "rejected";
export type ToolKind = "read" | "write" | "terminal" | "browser" | "unknown";

export interface ToolCallBlock {
  type: "tool_call";
  toolCallId: string;
  title: string;
  kind: ToolKind;
  status: ToolCallStatus;
  input?: string;
  output?: string;
  permissionRequestId?: number;
}

export interface PlanTask {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed";
}

export interface PlanBlock {
  type: "plan";
  tasks: PlanTask[];
}

export type ContentBlock = TextBlock | ThinkingBlock | ToolCallBlock | PlanBlock;

// --- Message types ---

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  blocks: ContentBlock[];
  createdAt: Date;
}

/** Extract all text from a message's blocks. */
export function getMessageText(msg: Message): string {
  return msg.blocks
    .filter((b): b is TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// --- Hook types ---

export interface UseAcpChatOptions {
  agentSpec: AgentSpec;
  cwd?: string;
  supportsReasoningLevel?: boolean;
  cliExecutable?: string;
  onError?: (error: Error) => void;
}

export interface UseAcpChatReturn {
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  error: Error | null;
  isReady: boolean;
  spawnFailed: boolean;
  retry: () => void;
  availableModels: AcpModel[];
  currentModelId: string | null;
  currentModelName: string | null;
  reasoningLevel: ReasoningLevel | null;
  reasoningLevels: string[] | null;
  resolvedCwd: string | null;
  agentVersion: string | null;
  cliVersion: string | null;
  downloadProgress: DownloadProgress | null;
  isDownloading: boolean;
  download: () => Promise<void>;
  approveToolCall: (toolCallId: string) => void;
  rejectToolCall: (toolCallId: string) => void;
  append: (content: string) => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
  setModel: (modelId: string) => Promise<void>;
  setReasoningLevel: (level: ReasoningLevel) => Promise<void>;
}
