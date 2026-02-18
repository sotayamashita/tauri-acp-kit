import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
    providerLabel: "Claude Code",
    modelId: null as string | null,
    modelDisplayName: null as string | null,
    onSuggestClick: vi.fn(),
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

  it("empty state shows provider label and suggestion chips when isReady=true", () => {
    renderList({ messages: [], isReady: true, providerLabel: "Claude Code" });
    const emptyTitle = document.querySelector(".acp-chat-empty-title");
    expect(emptyTitle).toBeInTheDocument();
    expect(emptyTitle!.textContent).toBe("Claude Code");
    expect(screen.getByText("Read a file")).toBeInTheDocument();
    expect(screen.getByText("Explain code")).toBeInTheDocument();
    expect(screen.getByText("Help me debug")).toBeInTheDocument();
  });

  it("empty state shows 'Waiting for connection…' when isReady=false", () => {
    renderList({ messages: [], isReady: false });
    expect(screen.getByText("Waiting for connection…")).toBeInTheDocument();
  });

  it("clicking a suggestion chip calls onSuggestClick with correct text", () => {
    const onSuggestClick = vi.fn();
    renderList({ messages: [], isReady: true, onSuggestClick });
    fireEvent.click(screen.getByText("Read a file"));
    expect(onSuggestClick).toHaveBeenCalledWith("Read the file src/App.tsx");
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

  it("model display name shown when modelId and modelDisplayName provided", () => {
    renderList({
      messages: [],
      isReady: true,
      modelId: "claude-sonnet-4",
      modelDisplayName: "Sonnet 4",
    });
    expect(screen.getByText("Sonnet 4")).toBeInTheDocument();
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

  it("scroll-to-bottom FAB is not visible initially", () => {
    const messages: Message[] = [
      makeMessage({ role: "user", blocks: [{ type: "text", text: "Hello" }] }),
    ];
    renderList({ messages });
    expect(screen.queryByLabelText("Scroll to bottom")).not.toBeInTheDocument();
  });

  it("calls scrollIntoView on mount", () => {
    const messages: Message[] = [
      makeMessage({ role: "user", blocks: [{ type: "text", text: "Hello" }] }),
    ];
    renderList({ messages });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
