import type { FormEvent } from "react";
import { useAcpChat } from "../hooks/useAcpChat";
import type { AgentSpec } from "tauri-acp";
import "./AcpChat.css";

interface AcpChatProps {
  agentSpec: AgentSpec;
  cwd?: string;
}

export function AcpChat({ agentSpec, cwd }: AcpChatProps) {
  const { messages, input, setInput, isLoading, error, isReady, append, stop } = useAcpChat({
    agentSpec,
    cwd,
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      append(input);
      setInput("");
    }
  };

  return (
    <div className="acp-chat">
      <div className="acp-chat-header">
        <h3>ACP Chat</h3>
        <span className={`status ${isReady ? "ready" : "connecting"}`}>
          {isReady ? "Connected" : "Connecting..."}
        </span>
      </div>

      <div className="acp-chat-messages">
        {messages.length === 0 && (
          <div className="acp-chat-empty">
            {isReady ? "Send a message to start chatting" : "Waiting for agent..."}
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`acp-chat-message ${msg.role}`}>
            <div className="acp-chat-message-role">{msg.role === "user" ? "You" : "Assistant"}</div>
            <div className="acp-chat-message-content">
              {msg.content || (msg.role === "assistant" && isLoading && "...")}
            </div>
          </div>
        ))}
      </div>

      {error && <div className="acp-chat-error">{error.message}</div>}

      <form onSubmit={handleSubmit} className="acp-chat-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isReady ? "Type a message..." : "Connecting..."}
          disabled={!isReady || isLoading}
          className="acp-chat-input"
        />
        {isLoading ? (
          <button type="button" onClick={stop} className="acp-chat-button stop">
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!isReady || !input.trim()}
            className="acp-chat-button send"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
