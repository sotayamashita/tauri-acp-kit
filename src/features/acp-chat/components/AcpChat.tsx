import { useState, useRef, useEffect, useCallback } from "react";
import { useAcpChat } from "../hooks/useAcpChat";
import { useTheme } from "../hooks/useTheme";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";
import type { AgentSpec } from "tauri-acp";
import type { ProviderConfig } from "../providers";
import { AgentSetupStatus } from "./AgentSetupStatus";
import { DownloadProgress } from "./DownloadProgress";
import { Plus, AlertCircle, Sun, Moon, RotateCcw } from "lucide-react";
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
    spawnFailed,
    retry,
    downloadProgress,
    isDownloading,
    download,
    availableModels,
    currentModelId,
    reasoningLevel,
    append,
    stop,
    reset,
    setModel,
    setReasoningLevel,
  } = useAcpChat({
    agentSpec,
    cwd,
    supportsReasoningLevel: selectedProvider?.supportsReasoningLevel,
  });

  const { theme, toggleTheme } = useTheme();
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

  // Cmd+Shift+N (macOS) / Ctrl+Shift+N (other) → new chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.metaKey || e.ctrlKey) && e.key === "N") {
        e.preventDefault();
        reset();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [reset]);

  // Derive connection status for header display
  const connectionStatus =
    error && !spawnFailed
      ? "error"
      : isDownloading
        ? "downloading"
        : !isReady && !spawnFailed
          ? "connecting"
          : isLoading
            ? "generating"
            : spawnFailed
              ? "error"
              : "ready";

  const handleSuggestClick = useCallback(
    (text: string) => {
      setInput(text);
    },
    [setInput],
  );

  return (
    <div className="acp-chat" data-theme={theme}>
      {/* Header */}
      <header className="acp-chat-header">
        <div className="acp-chat-header-left">
          <span className="acp-chat-header-title">{selectedProvider?.label || "Chat"}</span>
          <span className={`acp-chat-status ${connectionStatus}`} role="status" aria-live="polite">
            {connectionStatus === "downloading" ? (
              "Downloading…"
            ) : connectionStatus === "connecting" ? (
              "Connecting…"
            ) : connectionStatus === "generating" ? (
              "Generating…"
            ) : connectionStatus === "error" ? (
              <>
                <span className="acp-chat-status-dot error" aria-hidden="true" />
                Disconnected
              </>
            ) : (
              <>
                <span className="acp-chat-status-dot ready" aria-hidden="true" />
              </>
            )}
          </span>
        </div>
        <div className="acp-chat-header-right">
          <button
            type="button"
            onClick={reset}
            className="acp-chat-header-btn"
            title="New Chat (Cmd+Shift+N)"
            aria-label="New Chat"
            disabled={messages.length === 0}
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="acp-chat-header-btn"
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
          </button>
          <div className="acp-chat-dropdown-wrapper" ref={providerRef}>
            <button
              type="button"
              onClick={() => setProviderOpen(!providerOpen)}
              className="acp-chat-header-btn"
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

      {/* Download Progress */}
      {isDownloading && downloadProgress && (
        <DownloadProgress
          progress={downloadProgress}
          label={selectedProvider?.label || agentSpec.id}
        />
      )}

      {/* Setup Status (when agent binary is missing) */}
      {spawnFailed && !isDownloading && (
        <AgentSetupStatus
          agentId={agentSpec.id}
          label={selectedProvider?.label || agentSpec.id}
          executable={agentSpec.executable}
          onCheckAgain={retry}
          onDownload={download}
          isDownloading={isDownloading}
        />
      )}

      {/* Message Area */}
      {!spawnFailed && !isDownloading && (
        <ChatMessageList
          messages={messages}
          isReady={isReady}
          isLoading={isLoading}
          providerLabel={selectedProvider?.label}
          modelId={currentModelId}
          onSuggestClick={handleSuggestClick}
        />
      )}

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
