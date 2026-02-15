import type { FormEvent, KeyboardEvent } from "react";
import { useRef, useEffect, useState } from "react";
import { useAcpChat } from "../hooks/useAcpChat";
import { MarkdownText } from "./MarkdownText";
import { TypingIndicator } from "./TypingIndicator";
import type { AgentSpec } from "tauri-acp";
import type { ProviderConfig } from "../providers";
import { REASONING_LEVELS, type ReasoningLevel } from "../providers";
import { Plus, Play, Square, ChevronDown, AlertCircle } from "lucide-react";
import { formatModelId } from "../format-model-id";
import "./AcpChat.css";

interface AcpChatProps {
  agentSpec: AgentSpec;
  cwd?: string;
  providers?: ProviderConfig[];
  selectedProviderId?: string;
  onProviderChange?: (providerId: string) => void;
}

export function AcpChat({
  agentSpec,
  cwd,
  providers,
  selectedProviderId,
  onProviderChange,
}: AcpChatProps) {
  const selectedProvider = providers?.find((p) => p.id === selectedProviderId);

  const {
    messages,
    input,
    setInput,
    isLoading,
    error,
    isReady,
    availableModels,
    currentModelId,
    reasoningLevel,
    append,
    stop,
    setModel,
    setReasoningLevel,
  } = useAcpChat({
    agentSpec,
    cwd,
    supportsReasoningLevel: selectedProvider?.supportsReasoningLevel,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(false);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading && isReady) {
      append(input);
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  const handleModelSelect = async (modelId: string) => {
    setModelOpen(false);
    await setModel(modelId);
  };

  const handleReasoningSelect = async (level: ReasoningLevel) => {
    setReasoningOpen(false);
    await setReasoningLevel(level);
  };

  const lastMessage = messages[messages.length - 1];
  const showTypingIndicator =
    isLoading && lastMessage?.role === "assistant" && !lastMessage.content;

  const reasoningLabel = reasoningLevel
    ? reasoningLevel.charAt(0).toUpperCase() + reasoningLevel.slice(1)
    : "Medium";

  return (
    <div className="acp-chat">
      {/* Header */}
      <header className="acp-chat-header">
        <div className="acp-chat-header-left">
          <span className="acp-chat-header-title">{selectedProvider?.label || "Chat"}</span>
          <span className={`acp-chat-status ${isReady ? "ready" : "connecting"}`}>
            {isReady ? "" : "Connecting..."}
          </span>
        </div>
        <div className="acp-chat-header-right">
          <div className="acp-chat-dropdown-wrapper">
            <button
              type="button"
              onClick={() => setProviderOpen(!providerOpen)}
              className="acp-chat-reset-btn"
              title="Switch provider"
            >
              <Plus size={16} />
            </button>
            {providerOpen && providers && (
              <div className="acp-chat-dropdown-menu acp-chat-provider-dropdown" role="listbox">
                {providers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={p.id === selectedProviderId}
                    className={`acp-chat-dropdown-item ${p.id === selectedProviderId ? "selected" : ""}`}
                    onClick={() => {
                      onProviderChange?.(p.id);
                      setProviderOpen(false);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Message Area */}
      <div className="acp-chat-messages">
        {messages.length === 0 && (
          <div className="acp-chat-empty">
            {isReady ? "Send a message to start chatting" : "Waiting for connection..."}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`acp-chat-message ${msg.role}`}>
            {msg.role === "assistant" ? (
              <div className="acp-chat-message-ai">
                {msg.content ? (
                  <MarkdownText content={msg.content} />
                ) : (
                  showTypingIndicator && <TypingIndicator />
                )}
              </div>
            ) : (
              <div className="acp-chat-message-user">
                <span>{msg.content}</span>
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="acp-chat-error">
          <AlertCircle size={14} />
          <span>{error.message}</span>
        </div>
      )}

      {/* Input Area */}
      <div className="acp-chat-input-area">
        <div className={`acp-chat-input-container ${isFocused ? "focused" : ""}`}>
          {/* Input Row */}
          <div className="acp-chat-input-row">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={isReady ? `Message ${selectedProvider?.label || "AI"}` : "Connecting..."}
              disabled={!isReady}
              className="acp-chat-textarea"
              rows={1}
            />
            {isLoading ? (
              <button type="button" onClick={stop} className="acp-chat-send-btn stop" title="Stop">
                <Square size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
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
              {/* Model Dropdown */}
              <div className="acp-chat-dropdown-wrapper">
                <button
                  type="button"
                  className="acp-chat-dropdown"
                  onClick={() => setModelOpen(!modelOpen)}
                  disabled={!isReady || availableModels.length === 0}
                >
                  {currentModelId ? formatModelId(currentModelId) : "Default"}
                  <ChevronDown size={12} />
                </button>
                {modelOpen && availableModels.length > 0 && (
                  <div className="acp-chat-dropdown-menu" role="listbox">
                    {availableModels.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        role="option"
                        aria-selected={m.id === currentModelId}
                        className={`acp-chat-dropdown-item ${m.id === currentModelId ? "selected" : ""}`}
                        onClick={() => handleModelSelect(m.id)}
                      >
                        {formatModelId(m.id)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Reasoning Level Dropdown (Codex only) */}
              {selectedProvider?.supportsReasoningLevel && (
                <div className="acp-chat-dropdown-wrapper">
                  <button
                    type="button"
                    className="acp-chat-dropdown"
                    onClick={() => setReasoningOpen(!reasoningOpen)}
                    disabled={!isReady || availableModels.length === 0}
                  >
                    {reasoningLabel}
                    <ChevronDown size={12} />
                  </button>
                  {reasoningOpen && (
                    <div className="acp-chat-dropdown-menu" role="listbox">
                      {REASONING_LEVELS.map((level) => (
                        <button
                          key={level}
                          type="button"
                          role="option"
                          aria-selected={level === reasoningLevel}
                          className={`acp-chat-dropdown-item ${level === reasoningLevel ? "selected" : ""}`}
                          onClick={() => handleReasoningSelect(level)}
                        >
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
