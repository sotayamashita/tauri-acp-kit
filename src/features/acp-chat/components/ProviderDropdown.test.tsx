import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  it("renders the + button", () => {
    render(
      <ProviderDropdown
        providers={mockProviders}
        selectedProviderId="claude-code-acp"
        isOpen={false}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTitle("Switch provider")).toBeInTheDocument();
  });

  it("shows provider list when isOpen is true", () => {
    render(
      <ProviderDropdown
        providers={mockProviders}
        selectedProviderId="claude-code-acp"
        isOpen={true}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Claude Code")).toBeInTheDocument();
    expect(screen.getByText("Codex")).toBeInTheDocument();
  });

  it("does not show provider list when isOpen is false", () => {
    render(
      <ProviderDropdown
        providers={mockProviders}
        selectedProviderId="claude-code-acp"
        isOpen={false}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("clicking a provider calls onSelect with provider id", () => {
    const onSelect = vi.fn();
    render(
      <ProviderDropdown
        providers={mockProviders}
        selectedProviderId="claude-code-acp"
        isOpen={true}
        onToggle={vi.fn()}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText("Codex"));
    expect(onSelect).toHaveBeenCalledWith("codex-acp");
  });

  it("marks selected provider with aria-selected", () => {
    render(
      <ProviderDropdown
        providers={mockProviders}
        selectedProviderId="claude-code-acp"
        isOpen={true}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const selected = screen.getByRole("option", { selected: true });
    expect(selected).toHaveTextContent("Claude Code");
  });
});
