import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatMessageList } from "./ChatMessageList";
import type { Message } from "../types";

function makeMessage(overrides: Partial<Message> & Pick<Message, "role" | "blocks">): Message {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date(),
    ...overrides,
  };
}

function renderList(overrides: Partial<Parameters<typeof ChatMessageList>[0]> = {}) {
  const defaults = {
    messages: [] as Message[],
    isReady: true,
    isLoading: false,
  };
  const props = { ...defaults, ...overrides };
  return { ...render(<ChatMessageList {...props} />), props };
}

describe("ChatMessageList", () => {
  it("renders messages with correct role attribution", () => {
    const messages: Message[] = [
      makeMessage({ role: "user", blocks: [{ type: "text", text: "Hello from user" }] }),
      makeMessage({ role: "assistant", blocks: [{ type: "text", text: "Hello from AI" }] }),
    ];
    renderList({ messages });
    expect(screen.getByText("Hello from user")).toBeInTheDocument();
    expect(screen.getByText("Hello from AI")).toBeInTheDocument();
  });

  it("empty state shows cwd when provided", () => {
    renderList({ messages: [], isReady: true, cwd: "/Users/test/project" });
    expect(screen.getByText("Your working directory is /Users/test/project")).toBeInTheDocument();
  });

  it("empty state shows 'Waiting for connection…' when isReady=false", () => {
    renderList({ messages: [], isReady: false });
    expect(screen.getByText("Waiting for connection…")).toBeInTheDocument();
  });

  it("shows typing indicator when loading and last message is empty assistant", () => {
    const messages: Message[] = [makeMessage({ role: "assistant", blocks: [] })];
    renderList({ messages, isLoading: true });
    const dots = document.querySelectorAll(".typing-dot");
    expect(dots).toHaveLength(3);
  });

  it("does not show typing indicator when not loading", () => {
    const messages: Message[] = [makeMessage({ role: "assistant", blocks: [] })];
    renderList({ messages, isLoading: false });
    const dots = document.querySelectorAll(".typing-dot");
    expect(dots).toHaveLength(0);
  });

  it("renders multiple content blocks within a single message", () => {
    const messages: Message[] = [
      makeMessage({
        role: "assistant",
        blocks: [
          { type: "text", text: "Here is the result" },
          {
            type: "tool_call",
            toolCallId: "tc-1",
            title: "Read",
            kind: "read",
            status: "completed",
          },
        ],
      }),
    ];
    renderList({ messages });
    expect(screen.getByText("Here is the result")).toBeInTheDocument();
    expect(screen.getByText("Read")).toBeInTheDocument();
  });

  it("scroll-to-bottom FAB is hidden initially", () => {
    const messages: Message[] = [
      makeMessage({ role: "user", blocks: [{ type: "text", text: "Hello" }] }),
    ];
    renderList({ messages });
    const fab = screen.getByLabelText("Scroll to bottom");
    expect(fab).toBeInTheDocument();
    expect(fab.className).toContain("opacity-0");
  });

  it("calls scrollIntoView on mount", () => {
    const messages: Message[] = [
      makeMessage({ role: "user", blocks: [{ type: "text", text: "Hello" }] }),
    ];
    renderList({ messages });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
