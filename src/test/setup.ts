import { beforeAll, afterEach, vi } from "vitest";
import { randomFillSync } from "crypto";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// jsdom requires WebCrypto implementation for Tauri API
beforeAll(() => {
  Object.defineProperty(window, "crypto", {
    value: {
      getRandomValues: (buffer: NodeJS.ArrayBufferView) => randomFillSync(buffer),
    },
  });

  // Mock scrollIntoView for jsdom (not implemented)
  Element.prototype.scrollIntoView = vi.fn();

  // Mock Tauri event plugin internals for listen/unlisten.
  (window as unknown as Record<string, unknown>).__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    convertFileSrc: (filePath: string) => filePath,
    registerListener: () => {},
    unregisterListener: () => {},
  };
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
