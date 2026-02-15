import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AcpEvent } from "./types";

export const ACP_EVENT_CHANNEL = "acp://event";

export async function onAcpEvent(callback: (event: AcpEvent) => void): Promise<UnlistenFn> {
  return listen<AcpEvent>(ACP_EVENT_CHANNEL, (event) => {
    callback(event.payload);
  });
}
