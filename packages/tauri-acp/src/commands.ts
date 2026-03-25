import { invoke } from "@tauri-apps/api/core";
import type { AgentSpec, ResolvedAgent, SessionInfo } from "./types";

export async function spawnAgent(spec: AgentSpec): Promise<string> {
  return invoke<string>("plugin:acp|acp_spawn_agent", { spec });
}

export async function startSession(agentId: string, cwd: string): Promise<SessionInfo> {
  return invoke<SessionInfo>("plugin:acp|acp_start_session", { agentId, cwd });
}

export async function setModel(sessionId: string, modelId: string): Promise<void> {
  return invoke<void>("plugin:acp|acp_set_model", { sessionId, modelId });
}

export async function sendPrompt(sessionId: string, prompt: string): Promise<string> {
  return invoke<string>("plugin:acp|acp_send_prompt", { sessionId, prompt });
}

export async function cancel(sessionId: string): Promise<void> {
  return invoke<void>("plugin:acp|acp_cancel", { sessionId });
}

export async function respondPermission(
  sessionId: string,
  requestId: number,
  optionId: string,
): Promise<void> {
  return invoke<void>("plugin:acp|acp_respond_permission", { sessionId, requestId, optionId });
}

export async function terminateAgent(agentId: string): Promise<void> {
  return invoke<void>("plugin:acp|acp_terminate_agent", { agentId });
}

export async function downloadAgent(agentId: string): Promise<ResolvedAgent> {
  return invoke<ResolvedAgent>("plugin:acp|acp_download_agent", { agentId });
}

export async function getCliVersion(executable: string): Promise<string | null> {
  return invoke<string | null>("plugin:acp|acp_get_cli_version", { executable });
}
