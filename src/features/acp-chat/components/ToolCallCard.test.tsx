import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToolCallCard } from "./ToolCallCard";
import type { ToolCallStatus } from "../types";

function renderCard(overrides: Partial<Parameters<typeof ToolCallCard>[0]> = {}) {
  const defaults = {
    toolCallId: "tc-1",
    title: "Read",
    status: "completed" as ToolCallStatus,
    output: undefined as string | undefined,
  };
  const props = { ...defaults, ...overrides };
  return render(<ToolCallCard {...props} />);
}

describe("ToolCallCard", () => {
  it("renders title text", () => {
    renderCard({ title: "Read" });
    expect(screen.getByText("Read")).toBeInTheDocument();
  });

  it("shows correct icon for each status", () => {
    const statuses: ToolCallStatus[] = ["pending", "running", "completed", "failed"];
    const labels = ["Pending", "Running", "Completed", "Failed"];

    for (let i = 0; i < statuses.length; i++) {
      const { unmount } = renderCard({ status: statuses[i] });
      expect(screen.getByLabelText(labels[i])).toBeInTheDocument();
      unmount();
    }
  });

  it("header button is disabled when no output", () => {
    renderCard({ output: undefined });
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("header button is enabled when output exists", () => {
    renderCard({ output: "result" });
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("clicking header toggles output visibility and aria-expanded", () => {
    renderCard({ output: "result text" });
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("result text")).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("result text")).toBeInTheDocument();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("result text")).not.toBeInTheDocument();
  });

  it("output displayed in pre element", () => {
    renderCard({ output: "output content" });
    fireEvent.click(screen.getByRole("button"));
    const pre = document.querySelector("pre");
    expect(pre).toBeInTheDocument();
    expect(pre!.textContent).toBe("output content");
  });
});
