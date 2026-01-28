import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";
import { setupTauriMocks, cleanupTauriMocks } from "./test/tauri-mocks";

describe("App", () => {
  beforeEach(() => {
    setupTauriMocks({
      "plugin:acp|acp_spawn_agent": () => "test-agent-id",
      "plugin:acp|acp_start_session": () => "test-session-id",
      "plugin:acp|acp_terminate_agent": () => undefined,
    });
  });

  afterEach(() => {
    cleanupTauriMocks();
  });

  it("renders the ACP Chat", () => {
    render(<App />);
    expect(screen.getByText("New Thread")).toBeInTheDocument();
  });
});
