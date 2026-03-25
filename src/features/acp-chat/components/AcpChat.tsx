import { useState, useRef, useEffect, useCallback } from "react";
import { useAcpChat } from "../hooks/useAcpChat";
import { useTheme } from "../hooks/useTheme";
import { useClickOutside } from "../hooks/useClickOutside";
import { deriveConnectionStatus } from "../utils/connectionStatus";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";
import { StatusBar } from "./StatusBar";
import { ProviderDropdown } from "./ProviderDropdown";
import { ErrorBanner } from "./ErrorBanner";
import type { AgentSpec } from "tauri-acp";
import type { ProviderConfig } from "../providers";
import { AgentSetupStatus } from "./AgentSetupStatus";
import { DownloadProgress } from "./DownloadProgress";
import { RotateCcw, Sun, Moon } from "lucide-react";
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
    currentModelName,
    reasoningLevel,
    reasoningLevels,
    resolvedCwd,
    agentVersion,
    approveToolCall,
    rejectToolCall,
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
  const closeProviderDropdown = useCallback(() => setProviderOpen(false), []);
  useClickOutside(providerRef, closeProviderDropdown, providerOpen);

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

  const connectionStatus = deriveConnectionStatus({
    error,
    spawnFailed,
    isDownloading,
    isReady,
    isLoading,
  });

  const handleProviderSelect = useCallback(
    (providerId: string) => {
      onProviderChange?.(providerId);
      setProviderOpen(false);
    },
    [onProviderChange],
  );

  return (
    <div className="acp-chat" data-theme={theme}>
      <header className="acp-chat-header">
        <div className="acp-chat-header-left">
          <span className="acp-chat-header-title">
            {selectedProvider?.label || "Chat"}
            {agentVersion ? (
              <span className="acp-chat-header-version">({agentVersion})</span>
            ) : null}
          </span>
          <StatusBar connectionStatus={connectionStatus} />
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
            <ProviderDropdown
              providers={providers ?? []}
              selectedProviderId={selectedProviderId}
              isOpen={providerOpen}
              onToggle={() => setProviderOpen(!providerOpen)}
              onSelect={handleProviderSelect}
            />
          </div>
        </div>
      </header>

      {isDownloading && downloadProgress && (
        <DownloadProgress
          progress={downloadProgress}
          label={selectedProvider?.label || agentSpec.id}
        />
      )}

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

      {!spawnFailed && !isDownloading && (
        <ChatMessageList
          messages={messages}
          isReady={isReady}
          isLoading={isLoading}
          cwd={resolvedCwd ?? undefined}
          onApproveToolCall={approveToolCall}
          onRejectToolCall={rejectToolCall}
        />
      )}

      <ErrorBanner error={error} />

      <ChatInput
        input={input}
        setInput={setInput}
        isReady={isReady}
        isLoading={isLoading}
        onSubmit={append}
        onStop={stop}
        availableModels={availableModels}
        currentModelId={currentModelId}
        currentModelName={currentModelName}
        onModelSelect={setModel}
        selectedProvider={selectedProvider}
        reasoningLevel={reasoningLevel}
        reasoningLevels={reasoningLevels}
        onReasoningSelect={setReasoningLevel}
      />
    </div>
  );
}
