import { useState, useCallback } from "react";
import type { ToolCallStatus } from "../types";
import { ChevronDown, ChevronUp, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ToolCallCardProps {
  toolCallId: string;
  title: string;
  status: ToolCallStatus;
  input?: string;
  output?: string;
  onApprove?: (toolCallId: string) => void;
  onReject?: (toolCallId: string) => void;
}

const STATUS_DOT = "inline-block size-2.5 shrink-0 rounded-full";

function StatusIcon({ status }: { status: ToolCallStatus }) {
  switch (status) {
    case "pending":
      return (
        <span
          className={cn(STATUS_DOT, "bg-[var(--chat-tool-pending)] animate-pulse")}
          aria-label="Pending"
        />
      );
    case "waiting_confirmation":
      return (
        <span
          className={cn(STATUS_DOT, "bg-[var(--chat-tool-waiting)] animate-pulse")}
          aria-label="Waiting for confirmation"
        />
      );
    case "running":
      return (
        <span
          className={cn(STATUS_DOT, "bg-[var(--chat-tool-running)] animate-pulse")}
          aria-label="Running"
        />
      );
    case "completed":
      return (
        <span className="shrink-0 text-[var(--chat-tool-completed)]" aria-label="Completed">
          <Check size={10} />
        </span>
      );
    case "failed":
      return (
        <span className="shrink-0 text-[var(--chat-tool-failed)]" aria-label="Failed">
          <X size={10} />
        </span>
      );
    case "rejected":
      return (
        <span className="shrink-0 text-[var(--chat-tool-rejected)]" aria-label="Rejected">
          <X size={10} />
        </span>
      );
  }
}

export function ToolCallCard({
  toolCallId,
  title,
  status,
  input,
  output,
  onApprove,
  onReject,
}: ToolCallCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [actionTaken, setActionTaken] = useState(false);
  const isWaiting = status === "waiting_confirmation";
  const hasOutput = Boolean(output);
  const hasCollapsibleContent = hasOutput && !isWaiting;
  const isExpanded = isWaiting || isOpen;

  const handleApprove = useCallback(() => {
    setActionTaken(true);
    onApprove?.(toolCallId);
  }, [onApprove, toolCallId]);

  const handleReject = useCallback(() => {
    setActionTaken(true);
    onReject?.(toolCallId);
  }, [onReject, toolCallId]);

  return (
    <div
      className={cn(
        "my-1 overflow-hidden rounded-md border",
        isWaiting && "border-[var(--chat-tool-waiting)] bg-[var(--chat-accent-alpha-06)]",
      )}
      data-status={status}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm font-medium touch-manipulation disabled:cursor-default"
        onClick={() => hasCollapsibleContent && setIsOpen(!isOpen)}
        aria-expanded={isExpanded}
        disabled={!hasCollapsibleContent}
      >
        <StatusIcon status={status} />
        <span className={cn("flex-1 truncate", status === "rejected" && "text-muted-foreground")}>
          {title}
        </span>
        {hasCollapsibleContent && (isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
      </button>
      {isWaiting && input && (
        <div className="overflow-x-auto border-t bg-[var(--chat-tool-content-bg)] px-2.5 py-2">
          <pre className="m-0 text-[13px] break-all whitespace-pre-wrap">{input}</pre>
        </div>
      )}
      {isWaiting && (
        <div className="flex gap-2 border-t px-2.5 py-2">
          <Button size="sm" onClick={handleApprove} disabled={actionTaken}>
            Approve
          </Button>
          <Button variant="outline" size="sm" onClick={handleReject} disabled={actionTaken}>
            Reject
          </Button>
        </div>
      )}
      {isOpen && output && !isWaiting && (
        <div className="overflow-x-auto border-t bg-[var(--chat-tool-content-bg)] px-2.5 py-2">
          <pre className="m-0 text-[13px] break-all whitespace-pre-wrap">{output}</pre>
        </div>
      )}
    </div>
  );
}
