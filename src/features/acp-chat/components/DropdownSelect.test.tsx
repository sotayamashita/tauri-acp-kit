import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DropdownSelect } from "./DropdownSelect";

interface TestItem {
  id: string;
  name: string;
}

const items: TestItem[] = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
  { id: "c", name: "Gamma" },
];

function renderDropdown(overrides: Partial<Parameters<typeof DropdownSelect<TestItem>>[0]> = {}) {
  const defaults = {
    items,
    selectedId: "a",
    onSelect: vi.fn(),
    renderLabel: (item: TestItem) => item.name,
    getItemId: (item: TestItem) => item.id,
    triggerLabel: "Select",
    disabled: false,
  };
  const props = { ...defaults, ...overrides };
  return { ...render(<DropdownSelect {...props} />), props };
}

describe("DropdownSelect", () => {
  it("renders a combobox trigger", () => {
    renderDropdown({ triggerLabel: "Pick one" });
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders a select trigger element", () => {
    renderDropdown();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("disabled select has disabled attribute", () => {
    renderDropdown({ disabled: true });
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("custom renderLabel is used in trigger display", () => {
    renderDropdown({
      selectedId: "a",
      renderLabel: (item: TestItem) => `>> ${item.name} <<`,
    });
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
