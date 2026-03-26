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

  it("provider button in header renders with selected provider name", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /Claude Code/i })).toBeInTheDocument();
  });

  it("selecting a provider updates header and localStorage", async () => {
    render(<App />);
    const providerBtn = screen.getByRole("button", { name: /Claude Code/i });
    fireEvent.click(providerBtn);

    // DropdownMenu renders via portal — find the Codex option
    const codexOption = await screen.findByRole("menuitemradio", { name: /Codex/i });
    fireEvent.click(codexOption);

    await waitFor(() => {
      expect(localStorage.getItem("acp-provider")).toBe("codex-acp");
    });
    const headerTitle = document.querySelector(".acp-chat-header-title");
    expect(headerTitle!.textContent).toContain("Codex");
  });

  it("toolbar has no provider dropdown (moved to header)", () => {
    render(<App />);
    const toolbar = document.querySelector(".acp-chat-toolbar");
    expect(toolbar).toBeTruthy();
    const providerBtns = toolbar!.querySelectorAll("button");
    for (const btn of providerBtns) {
      expect(btn.textContent).not.toMatch(/Claude Code|Codex/);
    }
  });

  it("shows model dropdown after session is ready", async () => {
    render(<App />);
    const combobox = await screen.findByRole("combobox");
    expect(combobox).toBeInTheDocument();
  });

  it("shows reasoning level dropdown for Codex provider", async () => {
    localStorage.setItem("acp-provider", "codex-acp");
    render(<App />);

    await waitFor(() => {
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes.length).toBe(2);
    });
  });

  it("does not show reasoning level dropdown for Claude Code provider", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBe(1);
  });

  it("persists provider selection to localStorage", async () => {
    render(<App />);
    expect(localStorage.getItem("acp-provider")).toBeNull();

    const providerBtn = screen.getByRole("button", { name: /Claude Code/i });
    fireEvent.click(providerBtn);

    const codexOption = await screen.findByRole("menuitemradio", { name: /Codex/i });
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

    await waitFor(() => {
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes.length).toBe(2);
    });
  });

  it("restores reasoning level from localStorage on mount", async () => {
    localStorage.setItem("acp-provider", "codex-acp");
    localStorage.setItem("acp-reasoning-level:codex-acp", "high");
    render(<App />);

    await waitFor(() => {
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes.length).toBe(2);
    });
  });
});
