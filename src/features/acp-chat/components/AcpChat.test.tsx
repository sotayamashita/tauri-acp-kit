import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AcpChat } from "./AcpChat";
import { setupTauriMocks, cleanupTauriMocks } from "../../../test/tauri-mocks";
import type { ProviderConfig } from "../providers";

const mockModels = [
  { id: "claude-sonnet-4", name: "Claude Sonnet 4" },
  { id: "claude-opus-4", name: "Claude Opus 4" },
];

const mockProviders: ProviderConfig[] = [
  {
    id: "claude-code-acp",
    label: "Claude Code",
    agentSpec: { id: "claude-code-acp", executable: "claude-code-acp", args: [] },
    supportsReasoningLevel: false,
  },
  {
    id: "codex-acp",
    label: "Codex",
    agentSpec: { id: "codex-acp", executable: "codex-acp", args: [] },
    supportsReasoningLevel: true,
  },
];

describe("AcpChat — Phase 17 interactions", () => {
  beforeEach(() => {
    localStorage.clear();
    setupTauriMocks({
      "plugin:acp|acp_spawn_agent": () => "test-agent-id",
      "plugin:acp|acp_start_session": () => ({
        sessionId: "test-session-id",
        models: mockModels,
        currentModelId: "claude-sonnet-4",
      }),
      "plugin:acp|acp_set_model": () => undefined,
      "plugin:acp|acp_terminate_agent": () => undefined,
      "plugin:acp|acp_send_prompt": () => undefined,
    });
  });

  afterEach(() => {
    cleanupTauriMocks();
    localStorage.clear();
  });

  // --- Step 17.1: New Chat button ---

  it("shows New Chat button in header that is disabled when no messages", async () => {
    render(
      <AcpChat
        agentSpec={mockProviders[0].agentSpec}
        providers={mockProviders}
        selectedProviderId="claude-code-acp"
      />,
    );

    const newChatBtn = screen.getByTitle("New Chat (Cmd+Shift+N)");
    expect(newChatBtn).toBeInTheDocument();
    expect(newChatBtn).toBeDisabled();
  });

  it("New Chat button clears messages after sending a message", async () => {
    render(
      <AcpChat
        agentSpec={mockProviders[0].agentSpec}
        providers={mockProviders}
        selectedProviderId="claude-code-acp"
      />,
    );

    // Wait for session to be ready
    await screen.findByRole("button", { name: /Sonnet 4/i });

    // Send a message
    const textarea = screen.getByPlaceholderText(/Message Claude Code/i);
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.click(screen.getByTitle("Send"));

    // Wait for message to appear
    await waitFor(() => {
      expect(screen.getByText("Hello")).toBeInTheDocument();
    });

    // New Chat button should now be enabled
    const newChatBtn = screen.getByTitle("New Chat (Cmd+Shift+N)");
    expect(newChatBtn).not.toBeDisabled();

    // Click New Chat
    fireEvent.click(newChatBtn);

    // Messages should be cleared
    await waitFor(() => {
      expect(screen.queryByText("Hello")).not.toBeInTheDocument();
    });
  });

  it("Cmd+Shift+N keyboard shortcut triggers new chat", async () => {
    render(
      <AcpChat
        agentSpec={mockProviders[0].agentSpec}
        providers={mockProviders}
        selectedProviderId="claude-code-acp"
      />,
    );

    // Wait for session ready
    await screen.findByRole("button", { name: /Sonnet 4/i });

    // Send a message
    const textarea = screen.getByPlaceholderText(/Message Claude Code/i);
    fireEvent.change(textarea, { target: { value: "Test message" } });
    fireEvent.click(screen.getByTitle("Send"));

    await waitFor(() => {
      expect(screen.getByText("Test message")).toBeInTheDocument();
    });

    // Press Cmd+Shift+N
    fireEvent.keyDown(document, {
      key: "N",
      shiftKey: true,
      metaKey: true,
    });

    // Messages should be cleared
    await waitFor(() => {
      expect(screen.queryByText("Test message")).not.toBeInTheDocument();
    });
  });

  // --- Step 17.3: Empty state ---

  it("empty state shows provider name and suggested prompts when ready", async () => {
    render(
      <AcpChat
        agentSpec={mockProviders[0].agentSpec}
        providers={mockProviders}
        selectedProviderId="claude-code-acp"
      />,
    );

    // Wait for session ready
    await screen.findByRole("button", { name: /Sonnet 4/i });

    // Empty state should show provider name (also in header, so use class selector)
    const emptyTitle = document.querySelector(".acp-chat-empty-title");
    expect(emptyTitle).toBeInTheDocument();
    expect(emptyTitle!.textContent).toBe("Claude Code");

    // Should show suggested prompts
    expect(screen.getByText("Read a file")).toBeInTheDocument();
    expect(screen.getByText("Explain code")).toBeInTheDocument();
    expect(screen.getByText("Help me debug")).toBeInTheDocument();
  });

  it("clicking a prompt chip populates the input", async () => {
    render(
      <AcpChat
        agentSpec={mockProviders[0].agentSpec}
        providers={mockProviders}
        selectedProviderId="claude-code-acp"
      />,
    );

    // Wait for session ready
    await screen.findByRole("button", { name: /Sonnet 4/i });

    // Click "Read a file" chip
    fireEvent.click(screen.getByText("Read a file"));

    // Input should be populated
    const textarea = screen.getByPlaceholderText(/Message Claude Code/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe("Read the file src/App.tsx");
  });

  it("empty state shows 'Waiting for connection…' before ready", () => {
    // Don't set up mocks for spawn/session so isReady stays false
    cleanupTauriMocks();
    setupTauriMocks({
      "plugin:acp|acp_spawn_agent": () => new Promise(() => {}), // never resolves
      "plugin:acp|acp_terminate_agent": () => undefined,
    });

    render(
      <AcpChat
        agentSpec={mockProviders[0].agentSpec}
        providers={mockProviders}
        selectedProviderId="claude-code-acp"
      />,
    );

    expect(screen.getByText("Waiting for connection…")).toBeInTheDocument();
  });

  // --- Step 17.4: Status lifecycle ---

  it("status shows 'Connecting…' before session is ready", () => {
    cleanupTauriMocks();
    setupTauriMocks({
      "plugin:acp|acp_spawn_agent": () => new Promise(() => {}), // never resolves
      "plugin:acp|acp_terminate_agent": () => undefined,
    });

    render(
      <AcpChat
        agentSpec={mockProviders[0].agentSpec}
        providers={mockProviders}
        selectedProviderId="claude-code-acp"
      />,
    );

    expect(screen.getByText("Connecting…")).toBeInTheDocument();
  });

  it("status shows green dot when session is ready", async () => {
    render(
      <AcpChat
        agentSpec={mockProviders[0].agentSpec}
        providers={mockProviders}
        selectedProviderId="claude-code-acp"
      />,
    );

    // Wait for ready
    await screen.findByRole("button", { name: /Sonnet 4/i });

    // Should have a ready status dot
    const statusDot = document.querySelector(".acp-chat-status-dot.ready");
    expect(statusDot).toBeInTheDocument();
  });

  it("status has role=status and aria-live=polite for accessibility", async () => {
    render(
      <AcpChat
        agentSpec={mockProviders[0].agentSpec}
        providers={mockProviders}
        selectedProviderId="claude-code-acp"
      />,
    );

    const statusEl = screen.getByRole("status");
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveAttribute("aria-live", "polite");
  });
});
