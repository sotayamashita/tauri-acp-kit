import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";

declare global {
  interface Window {
    __TAURI_INTERNALS__: Record<string, unknown>;
  }
}

export function setupTauriMocks(handlers: Record<string, (args: unknown) => unknown>) {
  mockIPC((cmd, args) => {
    if (handlers[cmd]) return handlers[cmd](args);
    if (cmd === "plugin:event|listen") return undefined;
    console.warn(`Unmocked Tauri command: ${cmd}`);
  });
}

export function cleanupTauriMocks() {
  // clearMocks() deletes individual properties (invoke, unregisterListener, etc.)
  // from __TAURI_INTERNALS__ and __TAURI_EVENT_PLUGIN_INTERNALS__ objects.
  // React effect cleanup runs later (setup.ts afterEach → cleanup()) and calls
  // unlisten()/terminate() which need these functions. Save and restore them.
  const internals = window.__TAURI_INTERNALS__ as Record<string, unknown> | undefined;
  const eventInternals = window.__TAURI_EVENT_PLUGIN_INTERNALS__ as
    | Record<string, unknown>
    | undefined;

  const savedInvoke = internals?.invoke;
  const savedTransformCallback = internals?.transformCallback;
  const savedUnregisterCallback = internals?.unregisterCallback;
  const savedRunCallback = internals?.runCallback;
  const savedCallbacks = internals?.callbacks;
  const savedUnregisterListener = eventInternals?.unregisterListener;

  clearMocks();

  if (internals) {
    internals.invoke = savedInvoke;
    internals.transformCallback = savedTransformCallback;
    internals.unregisterCallback = savedUnregisterCallback;
    internals.runCallback = savedRunCallback;
    internals.callbacks = savedCallbacks;
  }
  if (eventInternals) {
    eventInternals.unregisterListener = savedUnregisterListener;
  }
}
