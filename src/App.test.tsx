import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";
import { setupTauriMocks, cleanupTauriMocks } from "./test/tauri-mocks";

describe("App", () => {
  beforeEach(() => {
    setupTauriMocks({
      greet: (args) => `Hello, ${(args as { name: string }).name}!`,
    });
  });

  afterEach(() => {
    cleanupTauriMocks();
  });

  it("renders the welcome message", () => {
    render(<App />);
    expect(screen.getByText("Welcome to Tauri + React")).toBeInTheDocument();
  });
});
