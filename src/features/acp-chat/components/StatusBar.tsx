import type { ConnectionStatus } from "../utils/connectionStatus";

export function StatusBar({ connectionStatus }: { connectionStatus: ConnectionStatus }) {
  return (
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
          <span className="sr-only">Ready</span>
        </>
      )}
    </span>
  );
}
