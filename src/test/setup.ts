import { beforeAll, afterEach, vi } from "vitest";
import { randomFillSync } from "crypto";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// jsdom requires WebCrypto implementation for Tauri API
beforeAll(() => {
  Object.defineProperty(window, "crypto", {
    value: {
      getRandomValues: (buffer: NodeJS.ArrayBufferView) => randomFillSync(buffer),
      randomUUID: () => {
        const bytes = new Uint8Array(16);
        randomFillSync(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      },
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
