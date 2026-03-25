import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatInput } from "./ChatInput";
import type { AcpModel } from "tauri-acp";
import type { ProviderConfig, ReasoningLevel } from "../providers";

const mockModels: AcpModel[] = [
  { id: "claude-sonnet-4", name: "Sonnet 4" },
  { id: "claude-opus-4", name: "Opus 4" },
];

const mockProvider: ProviderConfig = {
  id: "claude-code-acp",
  label: "Claude Code",
  agentSpec: { id: "claude-code-acp", executable: "claude-code-acp", args: [] },
  supportsReasoningLevel: false,
};

const reasoningProvider: ProviderConfig = {
  id: "codex-acp",
  label: "Codex",
  agentSpec: { id: "codex-acp", executable: "codex-acp", args: [] },
  supportsReasoningLevel: true,
};

function renderChatInput(overrides: Partial<Parameters<typeof ChatInput>[0]> = {}) {
  const defaults = {
    input: "",
    setInput: vi.fn(),
    isReady: true,
    isLoading: false,
    onSubmit: vi.fn(),
    onStop: vi.fn(),
    availableModels: mockModels,
    currentModelId: "claude-sonnet-4",
    currentModelName: "Sonnet 4",
    onModelSelect: vi.fn(),
    selectedProvider: mockProvider,
    reasoningLevel: null as ReasoningLevel | null,
    reasoningLevels: null as string[] | null,
    onReasoningSelect: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  return { ...render(<ChatInput {...props} />), props };
}

describe("ChatInput", () => {
  it("renders textarea with correct placeholder using provider label", () => {
    renderChatInput();
    expect(screen.getByPlaceholderText("Message Claude Code")).toBeInTheDocument();
  });

  it("textarea is disabled and shows 'Connecting...' when isReady=false", () => {
    renderChatInput({ isReady: false });
    const textarea = screen.getByPlaceholderText("Connecting...");
    expect(textarea).toBeDisabled();
  });

  it("typing updates input via setInput callback", () => {
    const setInput = vi.fn();
    renderChatInput({ setInput });
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "hello" },
    });
    expect(setInput).toHaveBeenCalledWith("hello");
  });

  it("Enter key calls onSubmit with input value", () => {
    const onSubmit = vi.fn();
    renderChatInput({ input: "hello", onSubmit });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("hello");
  });

  it("Shift+Enter does not submit", () => {
    const onSubmit = vi.fn();
    renderChatInput({ input: "hello", onSubmit });
    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Enter",
      shiftKey: true,
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Meta+Enter does not submit", () => {
    const onSubmit = vi.fn();
    renderChatInput({ input: "hello", onSubmit });
    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Enter",
      metaKey: true,
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Ctrl+Enter does not submit", () => {
    const onSubmit = vi.fn();
    renderChatInput({ input: "hello", onSubmit });
    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Enter",
      ctrlKey: true,
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("send button is disabled when input is empty", () => {
    renderChatInput({ input: "" });
    expect(screen.getByTitle("Send")).toBeDisabled();
  });

  it("send button click calls onSubmit", () => {
    const onSubmit = vi.fn();
    renderChatInput({ input: "test", onSubmit });
    fireEvent.click(screen.getByTitle("Send"));
    expect(onSubmit).toHaveBeenCalledWith("test");
  });

  it("stop button appears during loading and calls onStop", () => {
    const onStop = vi.fn();
    renderChatInput({ isLoading: true, onStop });
    const stopBtn = screen.getByTitle("Stop");
    expect(stopBtn).toBeInTheDocument();
    fireEvent.click(stopBtn);
    expect(onStop).toHaveBeenCalled();
  });

  it("model dropdown renders when availableModels is non-empty", () => {
    renderChatInput();
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThanOrEqual(1);
  });

  it("reasoning level dropdown renders when provider supports reasoning", () => {
    renderChatInput({
      selectedProvider: reasoningProvider,
      reasoningLevel: "medium",
      reasoningLevels: ["low", "medium", "high"],
    });
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBe(2);
  });
});
