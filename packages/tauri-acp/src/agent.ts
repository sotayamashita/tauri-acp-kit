import * as commands from "./commands";
import { onAcpEvent } from "./events";
import { AcpSession } from "./session";
import type { AgentSpec, AcpEvent, UnlistenFn } from "./types";

export class AcpAgent {
  private _id: string | null = null;
  private _spec: AgentSpec | null = null;

  get id(): string | null {
    return this._id;
  }

  get spec(): AgentSpec | null {
    return this._spec;
  }

  async spawn(spec: AgentSpec): Promise<string> {
    this._spec = spec;
    this._id = await commands.spawnAgent(spec);
    return this._id;
  }

  async startSession(cwd: string): Promise<AcpSession> {
    if (!this._id) {
      throw new Error("Agent not spawned");
    }
    const info = await commands.startSession(this._id, cwd);
    return new AcpSession(
      info.sessionId,
      this._id,
      info.cwd,
      info.agentVersion,
      info.models,
      info.currentModelId,
    );
  }

  async terminate(): Promise<void> {
    if (!this._id) {
      throw new Error("Agent not spawned");
    }
    await commands.terminateAgent(this._id);
    this._id = null;
  }

  async onEvent(callback: (event: AcpEvent) => void): Promise<UnlistenFn> {
    return onAcpEvent((event: AcpEvent) => {
      // Filter events for this agent
      if ("agent_id" in event && event.agent_id === this._id) {
        callback(event);
      } else if ("session_id" in event) {
        // Session events are associated with this agent
        callback(event);
      }
    });
  }
}
