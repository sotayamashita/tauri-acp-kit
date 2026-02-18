import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  it("renders trigger button with triggerLabel", () => {
    renderDropdown({ triggerLabel: "Pick one" });
    expect(screen.getByText("Pick one")).toBeInTheDocument();
  });

  it("clicking trigger opens the dropdown menu", () => {
    renderDropdown();
    fireEvent.click(screen.getByText("Select"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("clicking an item calls onSelect and closes the menu", () => {
    const onSelect = vi.fn();
    renderDropdown({ onSelect });
    fireEvent.click(screen.getByText("Select"));
    fireEvent.click(screen.getByText("Beta"));
    expect(onSelect).toHaveBeenCalledWith(items[1]);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("clicking outside closes the menu", () => {
    renderDropdown();
    fireEvent.click(screen.getByText("Select"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("disabled dropdown does not open on click", () => {
    renderDropdown({ disabled: true });
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("selected item has aria-selected='true'", () => {
    renderDropdown({ selectedId: "b" });
    fireEvent.click(screen.getByText("Select"));
    const selected = screen.getByRole("option", { name: "Beta" });
    expect(selected).toHaveAttribute("aria-selected", "true");
    const notSelected = screen.getByRole("option", { name: "Alpha" });
    expect(notSelected).toHaveAttribute("aria-selected", "false");
  });

  it("empty items array shows no menu even when clicked", () => {
    renderDropdown({ items: [] });
    fireEvent.click(screen.getByText("Select"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("custom renderLabel controls item display", () => {
    renderDropdown({
      renderLabel: (item: TestItem) => `>> ${item.name} <<`,
    });
    fireEvent.click(screen.getByText("Select"));
    expect(screen.getByText(">> Alpha <<")).toBeInTheDocument();
  });
});
