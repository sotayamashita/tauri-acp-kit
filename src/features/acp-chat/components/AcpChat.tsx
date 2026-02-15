import { useState, useRef, useEffect, useCallback } from "react";
import { useAcpChat } from "../hooks/useAcpChat";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";
import type { AgentSpec } from "tauri-acp";
import type { ProviderConfig } from "../providers";
import { Plus, AlertCircle } from "lucide-react";
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

  const [providerOpen, setProviderOpen] = useState(false);
  const providerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (providerRef.current && !providerRef.current.contains(e.target as Node)) {
      setProviderOpen(false);
    }
  }, []);

  useEffect(() => {
    if (providerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [providerOpen, handleClickOutside]);

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
          <div className="acp-chat-dropdown-wrapper" ref={providerRef}>
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
      <ChatMessageList messages={messages} isReady={isReady} isLoading={isLoading} />

      {/* Error */}
      {error && (
        <div className="acp-chat-error">
          <AlertCircle size={14} />
          <span>{error.message}</span>
        </div>
      )}

      {/* Input Area */}
      <ChatInput
        input={input}
        setInput={setInput}
        isReady={isReady}
        isLoading={isLoading}
        onSubmit={append}
        onStop={stop}
        availableModels={availableModels}
        currentModelId={currentModelId}
        onModelSelect={setModel}
        selectedProvider={selectedProvider}
        reasoningLevel={reasoningLevel}
        onReasoningSelect={setReasoningLevel}
      />
    </div>
  );
}
