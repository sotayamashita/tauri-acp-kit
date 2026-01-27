import { invoke } from "@tauri-apps/api/core";
import type { AgentSpec } from "./types";

export async function spawnAgent(spec: AgentSpec): Promise<string> {
  return invoke<string>("plugin:acp|acp_spawn_agent", { spec });
}

export async function startSession(agentId: string, cwd: string): Promise<string> {
  return invoke<string>("plugin:acp|acp_start_session", { agentId, cwd });
}

export async function sendPrompt(sessionId: string, prompt: string): Promise<string> {
  return invoke<string>("plugin:acp|acp_send_prompt", { sessionId, prompt });
}

export async function cancel(sessionId: string): Promise<void> {
  return invoke<void>("plugin:acp|acp_cancel", { sessionId });
}

export async function terminateAgent(agentId: string): Promise<void> {
  return invoke<void>("plugin:acp|acp_terminate_agent", { agentId });
}
