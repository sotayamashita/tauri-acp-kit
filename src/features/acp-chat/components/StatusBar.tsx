import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { ConnectionStatus } from "../utils/connectionStatus";

export function StatusBar({ connectionStatus }: { connectionStatus: ConnectionStatus }) {
  return (
    <Badge
      variant="ghost"
      className={cn(
        "gap-1.5 text-xs font-normal tabular-nums",
        (connectionStatus === "connecting" || connectionStatus === "generating") && "animate-pulse",
        connectionStatus === "error" && "text-destructive",
      )}
      role="status"
      aria-live="polite"
    >
      {connectionStatus === "downloading" ? (
        "Downloading…"
      ) : connectionStatus === "connecting" ? (
        "Connecting…"
      ) : connectionStatus === "generating" ? (
        "Generating…"
      ) : connectionStatus === "error" ? (
        <>
          <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
          Disconnected
        </>
      ) : (
        <>
          <span className="size-1.5 rounded-full bg-[var(--chat-success)]" aria-hidden="true" />
          <span className="sr-only">Ready</span>
        </>
      )}
    </Badge>
  );
}
