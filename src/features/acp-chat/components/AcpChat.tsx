import type { FormEvent, KeyboardEvent } from "react";
import { useRef, useEffect, useState } from "react";
import { useAcpChat } from "../hooks/useAcpChat";
import { MarkdownText } from "./MarkdownText";
import { TypingIndicator } from "./TypingIndicator";
import type { AgentSpec } from "tauri-acp";
import { Plus, Play, Square, ChevronDown, AlertCircle } from "lucide-react";
import "./AcpChat.css";

interface AcpChatProps {
  agentSpec: AgentSpec;
  cwd?: string;
}

export function AcpChat({ agentSpec, cwd }: AcpChatProps) {
  const { messages, input, setInput, isLoading, error, isReady, append, stop, reset } = useAcpChat({
    agentSpec,
    cwd,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

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

  const lastMessage = messages[messages.length - 1];
  const showTypingIndicator =
    isLoading && lastMessage?.role === "assistant" && !lastMessage.content;

  return (
    <div className="acp-chat">
      {/* Header */}
      <header className="acp-chat-header">
        <div className="acp-chat-header-left">
          <span className="acp-chat-header-title">New Thread</span>
          <span className={`acp-chat-status ${isReady ? "ready" : "connecting"}`}>
            {isReady ? "" : "Connecting..."}
          </span>
        </div>
        <div className="acp-chat-header-right">
          <button
            type="button"
            onClick={reset}
            className="acp-chat-reset-btn"
            title="New conversation"
            disabled={!isReady || messages.length === 0}
          >
            <Plus size={16} />
          </button>
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
              placeholder={isReady ? "Message Codex" : "Connecting..."}
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
              <button type="button" className="acp-chat-dropdown">
                Default
                <ChevronDown size={12} />
              </button>
              <button type="button" className="acp-chat-dropdown">
                Default (recommended)
                <ChevronDown size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
