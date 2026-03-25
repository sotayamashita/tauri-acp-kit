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
  it("renders a labeled button with selected provider name", () => {
    render(
      <ProviderDropdown
        providers={mockProviders}
        selectedProviderId="claude-code-acp"
        isOpen={false}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /Claude Code/ });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-haspopup", "menu");
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("renders menu items when isOpen is true", () => {
    render(
      <ProviderDropdown
        providers={mockProviders}
        selectedProviderId="claude-code-acp"
        isOpen={true}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Claude Code");
    expect(items[1]).toHaveTextContent("Codex");
  });

  it("sets aria-expanded to true when open", () => {
    render(
      <ProviderDropdown
        providers={mockProviders}
        selectedProviderId="claude-code-acp"
        isOpen={true}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /Claude Code/ });
    expect(btn).toHaveAttribute("aria-expanded", "true");
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

  it("marks selected provider with selected class", () => {
    render(
      <ProviderDropdown
        providers={mockProviders}
        selectedProviderId="claude-code-acp"
        isOpen={true}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const items = screen.getAllByRole("menuitem");
    expect(items[0].className).toContain("selected");
    expect(items[1].className).not.toContain("selected");
  });
});
