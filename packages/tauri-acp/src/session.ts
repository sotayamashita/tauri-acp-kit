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

  private onSessionEvent<T>(
    eventType: string,
    extract: (event: AcpEvent) => T | undefined,
    callback: (data: T) => void,
  ): Promise<UnlistenFn> {
    return onAcpEvent((event: AcpEvent) => {
      if (event.type !== eventType) return;
      if ("session_id" in event && event.session_id !== this._id) return;
      const data = extract(event);
      if (data !== undefined) callback(data);
    });
  }

  async onDelta(callback: (text: string) => void): Promise<UnlistenFn> {
    return this.onSessionEvent(
      "delta",
      (event) => (event.type === "delta" ? event.text : undefined),
      callback,
    );
  }

  async onComplete(callback: (reason: StopReason) => void): Promise<UnlistenFn> {
    return this.onSessionEvent(
      "complete",
      (event) => (event.type === "complete" ? (event.stop_reason as StopReason) : undefined),
      callback,
    );
  }

  async onError(callback: (message: string) => void): Promise<UnlistenFn> {
    return onAcpEvent((event: AcpEvent) => {
      if (event.type !== "error") return;
      if (event.session_id !== undefined && event.session_id !== this._id) return;
      callback(event.message);
    });
  }

  async onThoughtDelta(callback: (text: string) => void): Promise<UnlistenFn> {
    return this.onSessionEvent(
      "thought_delta",
      (event) => (event.type === "thought_delta" ? event.text : undefined),
      callback,
    );
  }

  async onToolCall(
    callback: (event: Extract<AcpEvent, { type: "tool_call" }>) => void,
  ): Promise<UnlistenFn> {
    return this.onSessionEvent(
      "tool_call",
      (event) => (event.type === "tool_call" ? event : undefined),
      callback,
    );
  }

  async onToolCallUpdate(
    callback: (event: Extract<AcpEvent, { type: "tool_call_update" }>) => void,
  ): Promise<UnlistenFn> {
    return this.onSessionEvent(
      "tool_call_update",
      (event) => (event.type === "tool_call_update" ? event : undefined),
      callback,
    );
  }

  async respondPermission(requestId: number, optionId: string): Promise<void> {
    return commands.respondPermission(this._id, requestId, optionId);
  }

  async onPermissionRequest(
    callback: (event: Extract<AcpEvent, { type: "permission_request" }>) => void,
  ): Promise<UnlistenFn> {
    return this.onSessionEvent(
      "permission_request",
      (event) => (event.type === "permission_request" ? event : undefined),
      callback,
    );
  }

  async onPlanUpdate(
    callback: (event: Extract<AcpEvent, { type: "plan_update" }>) => void,
  ): Promise<UnlistenFn> {
    return this.onSessionEvent(
      "plan_update",
      (event) => (event.type === "plan_update" ? event : undefined),
      callback,
    );
  }
}
