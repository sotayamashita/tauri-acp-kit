import * as commands from "./commands";
import { onAcpEvent } from "./events";
import type { AcpEvent, AcpModel, StopReason, UnlistenFn } from "./types";

export class AcpSession {
  private _id: string;
  private _agentId: string;
  private _models: AcpModel[];
  private _currentModelId: string | null;

  constructor(
    id: string,
    agentId: string,
    models: AcpModel[] = [],
    currentModelId: string | null = null,
  ) {
    this._id = id;
    this._agentId = agentId;
    this._models = models;
    this._currentModelId = currentModelId;
  }

  get id(): string {
    return this._id;
  }

  get agentId(): string {
    return this._agentId;
  }

  get models(): AcpModel[] {
    return this._models;
  }

  get currentModelId(): string | null {
    return this._currentModelId;
  }

  async setModel(modelId: string): Promise<void> {
    await commands.setModel(this._id, modelId);
    this._currentModelId = modelId;
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
