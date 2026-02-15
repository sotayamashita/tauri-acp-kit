import type { KeyboardEvent } from "react";
import { useRef, useState, useCallback } from "react";
import type { AcpModel } from "tauri-acp";
import type { ProviderConfig, ReasoningLevel } from "../providers";
import { REASONING_LEVELS } from "../providers";
import { Play, Square } from "lucide-react";
import { formatModelId } from "../format-model-id";
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
  onModelSelect: (modelId: string) => void;
  selectedProvider?: ProviderConfig;
  reasoningLevel: ReasoningLevel | null;
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
  onModelSelect,
  selectedProvider,
  reasoningLevel,
  onReasoningSelect,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

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
      <div className={`acp-chat-input-container ${isFocused ? "focused" : ""}`}>
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
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={isReady ? `Message ${selectedProvider?.label || "AI"}` : "Connecting..."}
            disabled={!isReady}
            className="acp-chat-textarea"
            rows={1}
          />
          {isLoading ? (
            <button type="button" onClick={onStop} className="acp-chat-send-btn stop" title="Stop">
              <Square size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={submitMessage}
              disabled={!isReady || !input.trim()}
              className={`acp-chat-send-btn ${input.trim() ? "active" : ""}`}
              title="Send"
            >
              <Play size={16} />
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
              renderLabel={(m) => formatModelId(m.id)}
              getItemId={(m) => m.id}
              triggerLabel={currentModelId ? formatModelId(currentModelId) : "Default"}
              disabled={!isReady || availableModels.length === 0}
            />

            {selectedProvider?.supportsReasoningLevel ? (
              <DropdownSelect
                items={REASONING_LEVEL_ITEMS}
                selectedId={reasoningLevel}
                onSelect={(level) => onReasoningSelect(level)}
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
