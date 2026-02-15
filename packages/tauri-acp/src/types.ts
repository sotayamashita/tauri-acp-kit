export interface AgentSpec {
  id: string;
  executable: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export type StopReason = "end_turn" | "cancelled" | "max_tokens" | "error";

export type AcpEvent =
  | { type: "delta"; session_id: string; text: string }
  | { type: "complete"; session_id: string; stop_reason: string }
  | { type: "error"; session_id?: string; message: string }
  | { type: "agent_spawned"; agent_id: string }
  | { type: "session_ready"; session_id: string; agent_id: string }
  | { type: "agent_terminated"; agent_id: string; exit_code?: number };

export interface AcpModel {
  id: string;
  name: string;
  description?: string;
}

export interface SessionInfo {
  sessionId: string;
  models: AcpModel[];
  currentModelId: string | null;
}

export type UnlistenFn = () => void;
