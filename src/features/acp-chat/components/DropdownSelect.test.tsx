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
  it("renders trigger button with triggerLabel and aria attributes", () => {
    renderDropdown({ triggerLabel: "Pick one" });
    const btn = screen.getByText("Pick one");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-haspopup", "menu");
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("clicking trigger opens the dropdown menu", () => {
    renderDropdown();
    const trigger = screen.getByText("Select");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems).toHaveLength(3);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("clicking an item calls onSelect and closes the menu", () => {
    const onSelect = vi.fn();
    renderDropdown({ onSelect });
    fireEvent.click(screen.getByText("Select"));
    fireEvent.click(screen.getByText("Beta"));
    expect(onSelect).toHaveBeenCalledWith(items[1]);
    expect(screen.getByText("Select")).toHaveAttribute("aria-expanded", "false");
  });

  it("clicking outside closes the menu", () => {
    renderDropdown();
    fireEvent.click(screen.getByText("Select"));
    expect(screen.getByText("Select")).toHaveAttribute("aria-expanded", "true");
    fireEvent.mouseDown(document.body);
    expect(screen.getByText("Select")).toHaveAttribute("aria-expanded", "false");
  });

  it("Escape key closes the menu", () => {
    renderDropdown();
    fireEvent.click(screen.getByText("Select"));
    expect(screen.getByText("Select")).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByText("Select")).toHaveAttribute("aria-expanded", "false");
  });

  it("disabled dropdown does not open on click", () => {
    renderDropdown({ disabled: true });
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  });

  it("selected item has selected class", () => {
    renderDropdown({ selectedId: "b" });
    fireEvent.click(screen.getByText("Select"));
    const menuItems = screen.getAllByRole("menuitem");
    const beta = menuItems.find((el) => el.textContent === "Beta");
    expect(beta?.className).toContain("selected");
    const alpha = menuItems.find((el) => el.textContent === "Alpha");
    expect(alpha?.className).not.toContain("selected");
  });

  it("empty items array keeps menu closed", () => {
    renderDropdown({ items: [] });
    fireEvent.click(screen.getByText("Select"));
    expect(screen.getByText("Select")).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  });

  it("custom renderLabel controls item display", () => {
    renderDropdown({
      renderLabel: (item: TestItem) => `>> ${item.name} <<`,
    });
    fireEvent.click(screen.getByText("Select"));
    expect(screen.getByText(">> Alpha <<")).toBeInTheDocument();
  });
});
