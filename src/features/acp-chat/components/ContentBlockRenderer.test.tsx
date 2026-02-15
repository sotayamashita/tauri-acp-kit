import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContentBlockRenderer } from "./ContentBlockRenderer";
import type { ContentBlock } from "../types";

describe("ContentBlockRenderer", () => {
  it("renders text block as markdown", () => {
    const block: ContentBlock = { type: "text", text: "Hello world" };
    render(<ContentBlockRenderer block={block} />);
    expect(screen.getByText("Hello world")).toBeTruthy();
  });

  it("renders nothing for empty text block", () => {
    const block: ContentBlock = { type: "text", text: "" };
    const { container } = render(<ContentBlockRenderer block={block} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders thinking block as details element", () => {
    const block: ContentBlock = { type: "thinking", text: "Let me think..." };
    render(<ContentBlockRenderer block={block} />);
    expect(screen.getByText("Thinking")).toBeTruthy();
    expect(screen.getByText("Let me think...")).toBeTruthy();
    const details = document.querySelector("details.thinking-block");
    expect(details).toBeTruthy();
    expect(details?.hasAttribute("open")).toBe(true);
  });

  it("renders tool call card with status", () => {
    const block: ContentBlock = {
      type: "tool_call",
      toolCallId: "tc-1",
      title: "Read",
      kind: "read",
      status: "completed",
    };
    render(<ContentBlockRenderer block={block} />);
    expect(screen.getByText("Read")).toBeTruthy();
    expect(screen.getByLabelText("Completed")).toBeTruthy();
  });

  it("renders tool call card with pending status", () => {
    const block: ContentBlock = {
      type: "tool_call",
      toolCallId: "tc-2",
      title: "Bash",
      kind: "terminal",
      status: "pending",
    };
    render(<ContentBlockRenderer block={block} />);
    expect(screen.getByText("Bash")).toBeTruthy();
    expect(screen.getByLabelText("Pending")).toBeTruthy();
  });

  it("renders tool call card with running status", () => {
    const block: ContentBlock = {
      type: "tool_call",
      toolCallId: "tc-3",
      title: "Write",
      kind: "write",
      status: "running",
    };
    render(<ContentBlockRenderer block={block} />);
    expect(screen.getByLabelText("Running")).toBeTruthy();
  });

  it("renders tool call card with failed status", () => {
    const block: ContentBlock = {
      type: "tool_call",
      toolCallId: "tc-4",
      title: "Edit",
      kind: "write",
      status: "failed",
    };
    render(<ContentBlockRenderer block={block} />);
    expect(screen.getByLabelText("Failed")).toBeTruthy();
  });

  it("tool call card toggles content on click when output exists", () => {
    const block: ContentBlock = {
      type: "tool_call",
      toolCallId: "tc-5",
      title: "Read",
      kind: "read",
      status: "completed",
      output: "file contents here",
    };
    render(<ContentBlockRenderer block={block} />);
    expect(screen.queryByText("file contents here")).toBeNull();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("file contents here")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByText("file contents here")).toBeNull();
  });

  it("tool call header has aria-expanded attribute", () => {
    const block: ContentBlock = {
      type: "tool_call",
      toolCallId: "tc-6",
      title: "Bash",
      kind: "terminal",
      status: "completed",
      output: "output text",
    };
    render(<ContentBlockRenderer block={block} />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("renders plan view with tasks", () => {
    const block: ContentBlock = {
      type: "plan",
      tasks: [
        { id: "t1", title: "Read file", status: "completed" },
        { id: "t2", title: "Write file", status: "pending" },
        { id: "t3", title: "Run tests", status: "in_progress" },
      ],
    };
    render(<ContentBlockRenderer block={block} />);
    expect(screen.getByText("Plan")).toBeTruthy();
    expect(screen.getByText("Read file")).toBeTruthy();
    expect(screen.getByText("Write file")).toBeTruthy();
    expect(screen.getByText("Run tests")).toBeTruthy();
  });

  it("plan view renders nothing for empty tasks", () => {
    const block: ContentBlock = {
      type: "plan",
      tasks: [],
    };
    const { container } = render(<ContentBlockRenderer block={block} />);
    expect(container.innerHTML).toBe("");
  });

  it("thinking block is keyboard-operable via details/summary", () => {
    const block: ContentBlock = { type: "thinking", text: "reasoning text" };
    render(<ContentBlockRenderer block={block} />);
    const summary = screen.getByText("Thinking");
    expect(summary.tagName.toLowerCase()).toBe("summary");
  });
});
