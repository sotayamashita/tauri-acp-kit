import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlanView } from "./PlanView";
import type { PlanTask } from "../types";

describe("PlanView", () => {
  it("returns null for empty tasks array", () => {
    const { container } = render(<PlanView tasks={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders all tasks with titles", () => {
    const tasks: PlanTask[] = [
      { id: "1", title: "Read file", status: "completed" },
      { id: "2", title: "Write file", status: "pending" },
      { id: "3", title: "Run tests", status: "in_progress" },
    ];
    render(<PlanView tasks={tasks} />);
    expect(screen.getByText("Read file")).toBeInTheDocument();
    expect(screen.getByText("Write file")).toBeInTheDocument();
    expect(screen.getByText("Run tests")).toBeInTheDocument();
  });

  it("each task has correct data-status attribute", () => {
    const tasks: PlanTask[] = [
      { id: "1", title: "Done task", status: "completed" },
      { id: "2", title: "Pending task", status: "pending" },
      { id: "3", title: "Active task", status: "in_progress" },
    ];
    render(<PlanView tasks={tasks} />);
    const items = document.querySelectorAll("li[data-status]");
    expect(items[0]).toHaveAttribute("data-status", "completed");
    expect(items[1]).toHaveAttribute("data-status", "pending");
    expect(items[2]).toHaveAttribute("data-status", "in_progress");
  });
});
