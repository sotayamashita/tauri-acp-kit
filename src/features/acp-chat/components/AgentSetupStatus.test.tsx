import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgentSetupStatus } from "./AgentSetupStatus";

describe("AgentSetupStatus", () => {
  const mockOnCheckAgain = vi.fn();

  beforeEach(() => {
    mockOnCheckAgain.mockClear();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("renders setup title with provider label for codex-acp", () => {
    render(
      <AgentSetupStatus
        agentId="codex-acp"
        label="Codex"
        executable="codex-acp"
        onCheckAgain={mockOnCheckAgain}
      />,
    );

    expect(screen.getByText("Setting up Codex")).toBeInTheDocument();
  });

  it("renders setup title with provider label for claude-code-acp", () => {
    render(
      <AgentSetupStatus
        agentId="claude-code-acp"
        label="Claude Code"
        executable="claude-code-acp"
        onCheckAgain={mockOnCheckAgain}
      />,
    );

    expect(screen.getByText("Setting up Claude Code")).toBeInTheDocument();
  });

  it("shows GitHub download instructions for codex-acp", () => {
    render(
      <AgentSetupStatus
        agentId="codex-acp"
        label="Codex"
        executable="codex-acp"
        onCheckAgain={mockOnCheckAgain}
      />,
    );

    expect(screen.getByText(/codex-acp is not installed/)).toBeInTheDocument();
    expect(screen.getByText(/Download it from GitHub/)).toBeInTheDocument();
  });

  it("shows npm install instructions for claude-code-acp", () => {
    render(
      <AgentSetupStatus
        agentId="claude-code-acp"
        label="Claude Code"
        executable="claude-code-acp"
        onCheckAgain={mockOnCheckAgain}
      />,
    );

    expect(screen.getByText(/claude-code-acp is not installed/)).toBeInTheDocument();
    expect(screen.getByText(/npm install -g @zed-industries\/claude-code-acp/)).toBeInTheDocument();
  });

  it("renders Check Again button that calls onCheckAgain", () => {
    render(
      <AgentSetupStatus
        agentId="codex-acp"
        label="Codex"
        executable="codex-acp"
        onCheckAgain={mockOnCheckAgain}
      />,
    );

    const checkBtn = screen.getByRole("button", { name: /Check Again/i });
    expect(checkBtn).toBeInTheDocument();
    fireEvent.click(checkBtn);
    expect(mockOnCheckAgain).toHaveBeenCalledOnce();
  });

  it("renders Copy Command button that copies install command", async () => {
    render(
      <AgentSetupStatus
        agentId="claude-code-acp"
        label="Claude Code"
        executable="claude-code-acp"
        onCheckAgain={mockOnCheckAgain}
      />,
    );

    const copyBtn = screen.getByRole("button", { name: /Copy Command/i });
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "npm install -g @zed-industries/claude-code-acp",
    );
  });

  it("shows generic instructions for unknown agents", () => {
    render(
      <AgentSetupStatus
        agentId="unknown-agent"
        label="Unknown"
        executable="unknown-agent"
        onCheckAgain={mockOnCheckAgain}
      />,
    );

    expect(screen.getByText("Setting up Unknown")).toBeInTheDocument();
    expect(screen.getByText(/unknown-agent is not installed/)).toBeInTheDocument();
  });
});
