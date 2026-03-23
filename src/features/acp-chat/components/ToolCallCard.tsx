import { useState } from "react";
import type { ToolCallStatus } from "../types";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ToolCallCardProps {
  toolCallId: string;
  title: string;
  status: ToolCallStatus;
  output?: string;
}

function StatusIcon({ status }: { status: ToolCallStatus }) {
  switch (status) {
    case "pending":
      return <span className="tool-call-status-icon pending" aria-label="Pending" />;
    case "running":
      return <span className="tool-call-status-icon running" aria-label="Running" />;
    case "completed":
      return (
        <span className="tool-call-status-icon completed" aria-label="Completed">
          ✓
        </span>
      );
    case "failed":
      return (
        <span className="tool-call-status-icon failed" aria-label="Failed">
          ✕
        </span>
      );
  }
}

export function ToolCallCard({ title, status, output }: ToolCallCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasContent = Boolean(output);

  return (
    <div className="tool-call-card" data-status={status}>
      <button
        type="button"
        className="tool-call-header"
        onClick={() => hasContent && setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        disabled={!hasContent}
      >
        <StatusIcon status={status} />
        <span className="tool-call-name">{title}</span>
        {hasContent && (isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
      </button>
      {isOpen && output && (
        <div className="tool-call-content">
          <pre>{output}</pre>
        </div>
      )}
    </div>
  );
}
