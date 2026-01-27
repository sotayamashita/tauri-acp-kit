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
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
