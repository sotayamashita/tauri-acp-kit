import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProviderDropdown } from "./ProviderDropdown";
import type { ProviderConfig } from "../providers";

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

describe("ProviderDropdown", () => {
  it("renders a button with selected provider name", () => {
    render(
      <ProviderDropdown
        providers={mockProviders}
        selectedProviderId="claude-code-acp"
        onSelect={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /Claude Code/ });
    expect(btn).toBeInTheDocument();
  });

  it("shows 'Provider' when no provider is selected", () => {
    render(<ProviderDropdown providers={mockProviders} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Provider/ })).toBeInTheDocument();
  });

  it("renders all providers as options", () => {
    render(
      <ProviderDropdown
        providers={mockProviders}
        selectedProviderId="claude-code-acp"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Claude Code")).toBeInTheDocument();
  });
});
