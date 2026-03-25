import { useState, useCallback } from "react";
import type { ToolCallStatus } from "../types";
import { ChevronDown, ChevronUp, Check, X } from "lucide-react";

interface ToolCallCardProps {
  toolCallId: string;
  title: string;
  status: ToolCallStatus;
  input?: string;
  output?: string;
  onApprove?: (toolCallId: string) => void;
  onReject?: (toolCallId: string) => void;
}

function StatusIcon({ status }: { status: ToolCallStatus }) {
  switch (status) {
    case "pending":
      return <span className="tool-call-status-icon pending" aria-label="Pending" />;
    case "waiting_confirmation":
      return (
        <span className="tool-call-status-icon waiting" aria-label="Waiting for confirmation" />
      );
    case "running":
      return <span className="tool-call-status-icon running" aria-label="Running" />;
    case "completed":
      return (
        <span className="tool-call-status-icon completed" aria-label="Completed">
          <Check size={10} />
        </span>
      );
    case "failed":
      return (
        <span className="tool-call-status-icon failed" aria-label="Failed">
          <X size={10} />
        </span>
      );
    case "rejected":
      return (
        <span className="tool-call-status-icon rejected" aria-label="Rejected">
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
    <div className="tool-call-card" data-status={status}>
      <button
        type="button"
        className="tool-call-header"
        onClick={() => hasCollapsibleContent && setIsOpen(!isOpen)}
        aria-expanded={isExpanded}
        disabled={!hasCollapsibleContent}
      >
        <StatusIcon status={status} />
        <span className="tool-call-name">{title}</span>
        {hasCollapsibleContent && (isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
      </button>
      {isWaiting && input && (
        <div className="tool-call-content">
          <pre>{input}</pre>
        </div>
      )}
      {isWaiting && (
        <div className="tool-call-actions">
          <button
            type="button"
            className="tool-call-action-btn approve"
            onClick={handleApprove}
            disabled={actionTaken}
          >
            Approve
          </button>
          <button
            type="button"
            className="tool-call-action-btn reject"
            onClick={handleReject}
            disabled={actionTaken}
          >
            Reject
          </button>
        </div>
      )}
      {isOpen && output && !isWaiting && (
        <div className="tool-call-content">
          <pre>{output}</pre>
        </div>
      )}
    </div>
  );
}
