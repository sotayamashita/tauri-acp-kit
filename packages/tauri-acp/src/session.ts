import * as commands from "./commands";
import { onAcpEvent } from "./events";
import type { AcpEvent, StopReason, UnlistenFn } from "./types";

export class AcpSession {
  private _id: string;
  private _agentId: string;

  constructor(id: string, agentId: string) {
    this._id = id;
    this._agentId = agentId;
  }

  get id(): string {
    return this._id;
  }

  get agentId(): string {
    return this._agentId;
  }

  async sendPrompt(prompt: string): Promise<string> {
    return commands.sendPrompt(this._id, prompt);
  }

  async cancel(): Promise<void> {
    return commands.cancel(this._id);
  }

  async onDelta(callback: (text: string) => void): Promise<UnlistenFn> {
    return onAcpEvent((event: AcpEvent) => {
      if (event.type === "delta" && event.session_id === this._id) {
        callback(event.text);
      }
    });
  }

  async onComplete(callback: (reason: StopReason) => void): Promise<UnlistenFn> {
    return onAcpEvent((event: AcpEvent) => {
      if (event.type === "complete" && event.session_id === this._id) {
        callback(event.stop_reason as StopReason);
      }
    });
  }

  async onError(callback: (message: string) => void): Promise<UnlistenFn> {
    return onAcpEvent((event: AcpEvent) => {
      if (
        event.type === "error" &&
        (event.session_id === this._id || event.session_id === undefined)
      ) {
        callback(event.message);
      }
    });
  }
}
