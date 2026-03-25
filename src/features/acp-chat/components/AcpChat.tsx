import { useEffect, useCallback } from "react";
import { useAcpChat } from "../hooks/useAcpChat";
import { useTheme } from "../hooks/useTheme";
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
import { Info, RotateCcw, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
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
    cliVersion,
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
    cliExecutable: selectedProvider?.cliExecutable,
  });

  const { theme, toggleTheme } = useTheme();

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
    },
    [onProviderChange],
  );

  return (
    <TooltipProvider>
      <div className="acp-chat" data-theme={theme}>
        <header className="acp-chat-header">
          <div className="acp-chat-header-left">
            <span className="acp-chat-header-title">
              {selectedProvider?.label || "Chat"}
              {(cliVersion || agentVersion) && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="ml-1 inline-flex cursor-default items-center text-muted-foreground">
                        <Info size={13} />
                      </span>
                    }
                  />
                  <TooltipContent
                    side="bottom"
                    align="start"
                    className="grid grid-cols-[auto_auto] gap-x-2 gap-y-0.5"
                  >
                    {cliVersion && (
                      <>
                        <span>{selectedProvider?.label || "CLI"}</span>
                        <span>{cliVersion}</span>
                      </>
                    )}
                    {agentVersion && (
                      <>
                        <span>ACP adapter</span>
                        <span>{agentVersion}</span>
                      </>
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
            </span>
            <StatusBar connectionStatus={connectionStatus} />
          </div>

          <div className="acp-chat-header-right">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={reset}
                    aria-label="New Chat"
                    disabled={messages.length === 0}
                  >
                    <RotateCcw size={14} />
                  </Button>
                }
              />
              <TooltipContent>New Chat (Cmd+Shift+N)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={toggleTheme}
                    aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
                  >
                    {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
                  </Button>
                }
              />
              <TooltipContent>
                {theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              </TooltipContent>
            </Tooltip>
            <ProviderDropdown
              providers={providers ?? []}
              selectedProviderId={selectedProviderId}
              onSelect={handleProviderSelect}
            />
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
    </TooltipProvider>
  );
}
