import type { KeyboardEvent } from "react";
import { useRef, useCallback } from "react";
import type { AcpModel } from "tauri-acp";
import type { ProviderConfig, ReasoningLevel } from "../providers";
import { REASONING_LEVELS } from "../providers";
import { ArrowUp, Square } from "lucide-react";
import { DropdownSelect } from "./DropdownSelect";

// Hoisted to module level to avoid re-creating array on every render (rerender-memo-with-default-value)
const REASONING_LEVEL_ITEMS: ReasoningLevel[] = [...REASONING_LEVELS];

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  isReady: boolean;
  isLoading: boolean;
  onSubmit: (content: string) => void;
  onStop: () => void;
  availableModels: AcpModel[];
  currentModelId: string | null;
  currentModelName: string | null;
  onModelSelect: (modelId: string) => void;
  selectedProvider?: ProviderConfig;
  reasoningLevel: ReasoningLevel | null;
  reasoningLevels: string[] | null;
  onReasoningSelect: (level: ReasoningLevel) => void;
}

export function ChatInput({
  input,
  setInput,
  isReady,
  isLoading,
  onSubmit,
  onStop,
  availableModels,
  currentModelId,
  currentModelName,
  onModelSelect,
  selectedProvider,
  reasoningLevel,
  reasoningLevels,
  onReasoningSelect,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, []);

  const submitMessage = useCallback(() => {
    if (input.trim() && !isLoading && isReady) {
      onSubmit(input);
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  }, [input, isLoading, isReady, onSubmit, setInput]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      submitMessage();
    }
  };

  const reasoningLabel = reasoningLevel
    ? reasoningLevel.charAt(0).toUpperCase() + reasoningLevel.slice(1)
    : "Medium";

  return (
    <div className="acp-chat-input-area">
      <div className="acp-chat-input-container">
        {/* Input Row */}
        <div className="acp-chat-input-row">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              resizeTextarea();
            }}
            onKeyDown={handleKeyDown}
            placeholder={isReady ? `Message ${selectedProvider?.label || "AI"}` : "Connecting..."}
            disabled={!isReady}
            className="acp-chat-textarea"
            rows={1}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={onStop}
              className="acp-chat-send-btn stop"
              title="Stop"
              aria-label="Stop generation"
            >
              <Square size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={submitMessage}
              disabled={!isReady || !input.trim()}
              className={`acp-chat-send-btn ${input.trim() ? "active" : ""}`}
              title="Send"
              aria-label="Send message"
            >
              <ArrowUp size={16} />
            </button>
          )}
        </div>

        {/* Toolbar Row */}
        <div className="acp-chat-toolbar">
          <div className="acp-chat-toolbar-left">
            <DropdownSelect
              items={availableModels}
              selectedId={currentModelId}
              onSelect={(m) => onModelSelect(m.id)}
              renderLabel={(m) =>
                m.description ? (
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-[11px] leading-tight text-muted-foreground">
                      {m.description}
                    </span>
                  </span>
                ) : (
                  m.name
                )
              }
              getItemId={(m) => m.id}
              triggerLabel={currentModelName ?? "Default"}
              disabled={!isReady || availableModels.length === 0}
            />

            {selectedProvider?.supportsReasoningLevel ? (
              <DropdownSelect
                items={reasoningLevels ?? REASONING_LEVEL_ITEMS}
                selectedId={reasoningLevel}
                onSelect={(level) => onReasoningSelect(level as ReasoningLevel)}
                renderLabel={(level) => level.charAt(0).toUpperCase() + level.slice(1)}
                getItemId={(level) => level}
                triggerLabel={reasoningLabel}
                disabled={!isReady || availableModels.length === 0}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
