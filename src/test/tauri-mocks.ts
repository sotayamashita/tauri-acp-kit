import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";

export function setupTauriMocks(handlers: Record<string, (args: unknown) => unknown>) {
  mockIPC((cmd, args) => {
    if (handlers[cmd]) return handlers[cmd](args);
    console.warn(`Unmocked Tauri command: ${cmd}`);
  });
}

export function cleanupTauriMocks() {
  clearMocks();
}
