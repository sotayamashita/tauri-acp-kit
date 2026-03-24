import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToolCallCard } from "./ToolCallCard";
import type { ToolCallStatus } from "../types";

function renderCard(overrides: Partial<Parameters<typeof ToolCallCard>[0]> = {}) {
  const defaults = {
    toolCallId: "tc-1",
    title: "Read",
    status: "completed" as ToolCallStatus,
    output: undefined as string | undefined,
    input: undefined as string | undefined,
    onApprove: undefined as ((id: string) => void) | undefined,
    onReject: undefined as ((id: string) => void) | undefined,
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
    const statuses: ToolCallStatus[] = [
      "pending",
      "waiting_confirmation",
      "running",
      "completed",
      "failed",
      "rejected",
    ];
    const labels = [
      "Pending",
      "Waiting for confirmation",
      "Running",
      "Completed",
      "Failed",
      "Rejected",
    ];

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

  describe("waiting_confirmation status", () => {
    it("renders approve and reject buttons", () => {
      renderCard({ status: "waiting_confirmation" });
      expect(screen.getByText("Approve")).toBeInTheDocument();
      expect(screen.getByText("Reject")).toBeInTheDocument();
    });

    it("clicking approve calls onApprove with toolCallId", () => {
      const onApprove = vi.fn();
      renderCard({ status: "waiting_confirmation", toolCallId: "tc-42", onApprove });
      fireEvent.click(screen.getByText("Approve"));
      expect(onApprove).toHaveBeenCalledOnce();
      expect(onApprove).toHaveBeenCalledWith("tc-42");
    });

    it("clicking reject calls onReject with toolCallId", () => {
      const onReject = vi.fn();
      renderCard({ status: "waiting_confirmation", toolCallId: "tc-42", onReject });
      fireEvent.click(screen.getByText("Reject"));
      expect(onReject).toHaveBeenCalledOnce();
      expect(onReject).toHaveBeenCalledWith("tc-42");
    });

    it("card is always expanded when waiting for confirmation", () => {
      renderCard({ status: "waiting_confirmation" });
      const header = screen.getByRole("button", { name: /waiting for confirmation/i });
      expect(header).toHaveAttribute("aria-expanded", "true");
    });

    it("header is not collapsible when waiting for confirmation", () => {
      renderCard({ status: "waiting_confirmation" });
      const header = screen.getByRole("button", { name: /waiting for confirmation/i });
      expect(header).toBeDisabled();
    });

    it("shows input content when waiting and input provided", () => {
      renderCard({ status: "waiting_confirmation", input: '{"file": "test.ts"}' });
      expect(screen.getByText('{"file": "test.ts"}')).toBeInTheDocument();
    });

    it("does not show input when input is not provided", () => {
      renderCard({ status: "waiting_confirmation" });
      expect(document.querySelector(".tool-call-content")).not.toBeInTheDocument();
    });
  });

  it("does not render approve/reject buttons for completed status", () => {
    renderCard({ status: "completed" });
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
    expect(screen.queryByText("Reject")).not.toBeInTheDocument();
  });

  it("does not render approve/reject buttons for rejected status", () => {
    renderCard({ status: "rejected" });
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
    expect(screen.queryByText("Reject")).not.toBeInTheDocument();
  });
});
