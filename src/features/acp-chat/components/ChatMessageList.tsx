import { useRef, useEffect, useState, useCallback } from "react";
import type { Message } from "../types";
import { getMessageText } from "../types";
import { ContentBlockRenderer } from "./ContentBlockRenderer";
import { TypingIndicator } from "./TypingIndicator";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ChatMessageListProps {
  messages: Message[];
  isReady: boolean;
  isLoading: boolean;
  cwd?: string;
  onApproveToolCall?: (toolCallId: string) => void;
  onRejectToolCall?: (toolCallId: string) => void;
}

export function ChatMessageList({
  messages,
  isReady,
  isLoading,
  cwd,
  onApproveToolCall,
  onRejectToolCall,
}: ChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollFab, setShowScrollFab] = useState(false);

  useEffect(() => {
    if (!showScrollFab) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, showScrollFab]);

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

  const fabVisible = showScrollFab && messages.length > 0;

  return (
    <div className="acp-chat-messages" ref={containerRef}>
      {messages.length === 0 ? (
        <div className="acp-chat-empty">
          {isReady ? (
            <div className="acp-chat-empty-content">
              <p className="acp-chat-empty-hint">Ask a question or describe a task</p>
              {cwd ? <p className="acp-chat-empty-cwd">Your working directory is {cwd}</p> : null}
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
                  <ContentBlockRenderer
                    key={`${msg.id}-${i}`}
                    block={block}
                    onApproveToolCall={onApproveToolCall}
                    onRejectToolCall={onRejectToolCall}
                  />
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

      <div ref={sentinelRef} aria-hidden="true" />
      <div ref={messagesEndRef} />

      <Button
        variant="outline"
        size="icon-sm"
        className={cn(
          "sticky bottom-2 self-end rounded-full transition-opacity",
          fabVisible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={scrollToBottom}
        aria-label="Scroll to bottom"
        tabIndex={fabVisible ? 0 : -1}
      >
        <ArrowDown size={16} />
      </Button>
    </div>
  );
}
