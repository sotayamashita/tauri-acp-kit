import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";
import { setupTauriMocks, cleanupTauriMocks } from "./test/tauri-mocks";

const mockModels = [
  { id: "claude-sonnet-4", name: "Claude Sonnet 4" },
  { id: "claude-opus-4", name: "Claude Opus 4" },
];

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    setupTauriMocks({
      "plugin:acp|acp_spawn_agent": () => "test-agent-id",
      "plugin:acp|acp_start_session": () => ({
        sessionId: "test-session-id",
        cwd: "/tmp/test",
        agentVersion: "1.0.0",
        models: mockModels,
        currentModelId: "claude-sonnet-4",
      }),
      "plugin:acp|acp_set_model": () => undefined,
      "plugin:acp|acp_terminate_agent": () => undefined,
    });
  });

  afterEach(() => {
    cleanupTauriMocks();
    localStorage.clear();
  });

  it("header shows current provider name instead of New Thread", () => {
    render(<App />);
    const headerTitle = document.querySelector(".acp-chat-header-title");
    expect(headerTitle).toBeInTheDocument();
    expect(headerTitle!.textContent).toBe("Claude Code");
    expect(screen.queryByText("New Thread")).not.toBeInTheDocument();
  });

  it("+ button in header opens provider dropdown", () => {
    render(<App />);
    const plusBtn = screen.getByTitle("Switch provider");
    fireEvent.click(plusBtn);

    expect(screen.getByRole("option", { name: /Claude Code/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Codex/i })).toBeInTheDocument();
  });

  it("selecting a provider from header dropdown calls onProviderChange", async () => {
    render(<App />);
    const plusBtn = screen.getByTitle("Switch provider");
    fireEvent.click(plusBtn);

    const codexOption = screen.getByRole("option", { name: /Codex/i });
    fireEvent.click(codexOption);

    await waitFor(() => {
      expect(localStorage.getItem("acp-provider")).toBe("codex-acp");
    });
    const headerTitle = document.querySelector(".acp-chat-header-title");
    expect(headerTitle!.textContent).toContain("Codex");
  });

  it("toolbar has no provider dropdown (moved to header)", () => {
    render(<App />);
    // The toolbar should not contain a provider selector button
    const toolbar = document.querySelector(".acp-chat-toolbar");
    expect(toolbar).toBeTruthy();
    const providerBtns = toolbar!.querySelectorAll("button");
    // Only model dropdown button should be in toolbar (no provider button)
    for (const btn of providerBtns) {
      expect(btn.textContent).not.toMatch(/Claude Code|Codex/);
    }
  });

  it("shows model dropdown after session is ready", async () => {
    render(<App />);
    const modelButton = await screen.findByRole("button", { name: /Sonnet 4/i });
    expect(modelButton).toBeInTheDocument();
  });

  it("shows reasoning level dropdown for Codex provider", async () => {
    localStorage.setItem("acp-provider", "codex-acp");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Medium/i })).toBeInTheDocument();
    });
  });

  it("does not show reasoning level dropdown for Claude Code provider", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Sonnet 4/i })).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /Medium/i })).not.toBeInTheDocument();
  });

  it("persists provider selection to localStorage", async () => {
    render(<App />);
    expect(localStorage.getItem("acp-provider")).toBeNull();

    const plusBtn = screen.getByTitle("Switch provider");
    fireEvent.click(plusBtn);

    const codexOption = screen.getByRole("option", { name: /Codex/i });
    fireEvent.click(codexOption);

    await waitFor(() => {
      expect(localStorage.getItem("acp-provider")).toBe("codex-acp");
    });
  });

  it("restores provider from localStorage on mount", () => {
    localStorage.setItem("acp-provider", "codex-acp");
    render(<App />);
    const headerTitle = document.querySelector(".acp-chat-header-title");
    expect(headerTitle!.textContent).toContain("Codex");
  });

  it("persists reasoning level to localStorage when changed", async () => {
    localStorage.setItem("acp-provider", "codex-acp");
    render(<App />);

    // Wait for session to be ready and reasoning level dropdown to appear
    const reasoningBtn = await screen.findByRole("button", { name: /Medium/i });
    fireEvent.click(reasoningBtn);

    const highOption = screen.getByRole("option", { name: /High/i });
    fireEvent.click(highOption);

    await waitFor(() => {
      expect(localStorage.getItem("acp-reasoning-level:codex-acp")).toBe("high");
    });
  });

  it("restores reasoning level from localStorage on mount", async () => {
    localStorage.setItem("acp-provider", "codex-acp");
    localStorage.setItem("acp-reasoning-level:codex-acp", "high");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /High/i })).toBeInTheDocument();
    });
  });
});
