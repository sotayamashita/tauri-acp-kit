import { useRef, useEffect, useState, useCallback } from "react";
import type { Message } from "../types";
import { getMessageText } from "../types";
import { ContentBlockRenderer } from "./ContentBlockRenderer";
import { TypingIndicator } from "./TypingIndicator";
import { ArrowDown } from "lucide-react";
import { formatModelId } from "../format-model-id";

// Hoisted to module level to avoid re-creation on every render (rendering-hoist-jsx)
const SUGGESTED_PROMPTS = [
  { label: "Read a file", text: "Read the file src/App.tsx" },
  { label: "Explain code", text: "Explain this codebase" },
  { label: "Help me debug", text: "Help me debug this issue" },
];

interface ChatMessageListProps {
  messages: Message[];
  isReady: boolean;
  isLoading: boolean;
  providerLabel?: string;
  modelId?: string | null;
  onSuggestClick?: (text: string) => void;
}

export function ChatMessageList({
  messages,
  isReady,
  isLoading,
  providerLabel,
  modelId,
  onSuggestClick,
}: ChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollFab, setShowScrollFab] = useState(false);

  // Auto-scroll on new messages when already at bottom
  useEffect(() => {
    if (!showScrollFab) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, showScrollFab]);

  // IntersectionObserver to detect when user scrolls away from bottom
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowScrollFab(!entry.isIntersecting);
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const lastMessage = messages[messages.length - 1];
  const showTypingIndicator =
    isLoading && lastMessage?.role === "assistant" && lastMessage.blocks.length === 0;

  return (
    <div className="acp-chat-messages" ref={containerRef}>
      {messages.length === 0 ? (
        <div className="acp-chat-empty">
          {isReady ? (
            <div className="acp-chat-empty-content">
              <p className="acp-chat-empty-title">{providerLabel || "Chat"}</p>
              {modelId ? <p className="acp-chat-empty-model">{formatModelId(modelId)}</p> : null}
              <div className="acp-chat-suggest-chips">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.label}
                    type="button"
                    className="acp-chat-suggest-chip"
                    onClick={() => onSuggestClick?.(prompt.text)}
                  >
                    {prompt.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            "Waiting for connection…"
          )}
        </div>
      ) : null}

      {messages.map((msg) => (
        <div key={msg.id} className={`acp-chat-message ${msg.role}`}>
          {msg.role === "assistant" ? (
            <div className="acp-chat-message-ai">
              {msg.blocks.length > 0 ? (
                msg.blocks.map((block, i) => (
                  <ContentBlockRenderer key={`${msg.id}-${i}`} block={block} />
                ))
              ) : showTypingIndicator && msg === lastMessage ? (
                <TypingIndicator />
              ) : null}
            </div>
          ) : (
            <div className="acp-chat-message-user">
              <span>{getMessageText(msg)}</span>
            </div>
          )}
        </div>
      ))}

      {/* Sentinel for IntersectionObserver */}
      <div ref={sentinelRef} aria-hidden="true" />
      <div ref={messagesEndRef} />

      {/* Scroll-to-bottom FAB */}
      {showScrollFab && messages.length > 0 ? (
        <button
          type="button"
          className="acp-chat-scroll-fab"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
          title="Scroll to bottom"
        >
          <ArrowDown size={16} />
        </button>
      ) : null}
    </div>
  );
}
