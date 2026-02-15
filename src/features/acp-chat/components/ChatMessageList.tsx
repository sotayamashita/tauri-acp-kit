import { useRef, useEffect } from "react";
import type { Message } from "../types";
import { getMessageText } from "../types";
import { MarkdownText } from "./MarkdownText";
import { TypingIndicator } from "./TypingIndicator";

interface ChatMessageListProps {
  messages: Message[];
  isReady: boolean;
  isLoading: boolean;
}

export function ChatMessageList({ messages, isReady, isLoading }: ChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const lastMessage = messages[messages.length - 1];
  const showTypingIndicator =
    isLoading && lastMessage?.role === "assistant" && lastMessage.blocks.length === 0;

  return (
    <div className="acp-chat-messages">
      {messages.length === 0 && (
        <div className="acp-chat-empty">
          {isReady ? "Send a message to start chatting" : "Waiting for connection..."}
        </div>
      )}

      {messages.map((msg) => {
        const text = getMessageText(msg);
        return (
          <div key={msg.id} className={`acp-chat-message ${msg.role}`}>
            {msg.role === "assistant" ? (
              <div className="acp-chat-message-ai">
                {text ? (
                  <MarkdownText content={text} />
                ) : showTypingIndicator && msg === lastMessage ? (
                  <TypingIndicator />
                ) : null}
              </div>
            ) : (
              <div className="acp-chat-message-user">
                <span>{text}</span>
              </div>
            )}
          </div>
        );
      })}

      <div ref={messagesEndRef} />
    </div>
  );
}
