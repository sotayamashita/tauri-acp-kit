import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AcpEvent, DownloadProgress } from "./types";

export const ACP_EVENT_CHANNEL = "acp://event";
export const DOWNLOAD_PROGRESS_CHANNEL = "acp://download-progress";

export async function onAcpEvent(callback: (event: AcpEvent) => void): Promise<UnlistenFn> {
  return listen<AcpEvent>(ACP_EVENT_CHANNEL, (event) => {
    callback(event.payload);
  });
}

export async function onDownloadProgress(
  callback: (progress: DownloadProgress) => void,
): Promise<UnlistenFn> {
  return listen<DownloadProgress>(DOWNLOAD_PROGRESS_CHANNEL, (event) => {
    callback(event.payload);
  });
}
