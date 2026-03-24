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
  | { type: "thought_delta"; session_id: string; text: string }
  | {
      type: "tool_call";
      session_id: string;
      tool_call_id: string;
      tool_name: string;
      status: string;
      input?: unknown;
      content?: unknown;
    }
  | {
      type: "tool_call_update";
      session_id: string;
      tool_call_id: string;
      status: string;
      content?: unknown;
    }
  | { type: "plan_update"; session_id: string; tasks: unknown }
  | { type: "complete"; session_id: string; stop_reason: string }
  | { type: "error"; session_id?: string; message: string }
  | { type: "agent_spawned"; agent_id: string }
  | { type: "session_ready"; session_id: string; agent_id: string }
  | { type: "agent_terminated"; agent_id: string; exit_code?: number }
  | {
      type: "permission_request";
      session_id: string;
      request_id: number;
      tool_call_id: string;
      title: string;
      raw_input?: unknown;
      options: PermissionOption[];
    };

export interface PermissionOption {
  option_id: string;
  name: string;
  kind: string;
}

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

export type AgentStatus =
  | { status: "not_installed" }
  | { status: "downloading"; progress: number }
  | { status: "installed"; version: string; executable_path: string }
  | { status: "failed"; error: string };

export interface DownloadProgress {
  agentId: string;
  bytesDownloaded: number;
  totalBytes: number | null;
  phase: "resolving" | "downloading" | "verifying" | "extracting" | "complete" | "failed";
}

export interface ResolvedAgent {
  executable: string;
  args: string[];
  version: string;
}

export interface AgentRegistryEntry {
  id: string;
  label: string;
  distribution:
    | { type: "github_release"; owner: string; repo: string; asset_template: string }
    | { type: "npm_package"; package_name: string; entry_point: string };
  versionPolicy: "latest" | { pinned: string };
}
