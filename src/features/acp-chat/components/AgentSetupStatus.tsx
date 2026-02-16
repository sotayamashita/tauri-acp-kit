import { useCallback, useState } from "react";
import { Copy, Check, RefreshCw, Download } from "lucide-react";

interface AgentSetupStatusProps {
  agentId: string;
  label: string;
  executable: string;
  onCheckAgain: () => void;
  onDownload?: () => void;
  isDownloading?: boolean;
}

interface InstallInfo {
  description: string;
  command: string;
}

function getInstallInfo(agentId: string, executable: string): InstallInfo {
  switch (agentId) {
    case "codex-acp":
      return {
        description: `${executable} is not installed. Download it from GitHub:`,
        command:
          "curl -fsSL https://github.com/zed-industries/codex-acp/releases/latest/download/codex-acp-aarch64-apple-darwin.tar.gz | tar xz && chmod +x codex-acp && sudo mv codex-acp /usr/local/bin/",
      };
    case "claude-code-acp":
      return {
        description: `${executable} is not installed. Install it via npm:`,
        command: "npm install -g @zed-industries/claude-code-acp",
      };
    default:
      return {
        description: `${executable} is not installed. Please install it and ensure it is on your PATH.`,
        command: "",
      };
  }
}

export function AgentSetupStatus({
  agentId,
  label,
  executable,
  onCheckAgain,
  onDownload,
  isDownloading = false,
}: AgentSetupStatusProps) {
  const [copied, setCopied] = useState(false);
  const info = getInstallInfo(agentId, executable);

  const handleCopy = useCallback(() => {
    if (!info.command) return;
    navigator.clipboard.writeText(info.command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [info.command]);

  return (
    <div className="agent-setup-status">
      <h2 className="agent-setup-status-title">Setting up {label}</h2>
      <p className="agent-setup-status-description">{info.description}</p>

      {info.command && (
        <pre className="agent-setup-status-command">
          <code>{info.command}</code>
        </pre>
      )}

      <div className="agent-setup-status-actions">
        {onDownload && (
          <button
            type="button"
            className="agent-setup-status-btn agent-setup-status-btn-primary"
            onClick={onDownload}
            disabled={isDownloading}
            aria-label="Download"
          >
            <Download size={14} />
            {isDownloading ? "Downloading…" : "Download"}
          </button>
        )}
        {info.command && (
          <button
            type="button"
            className="agent-setup-status-btn agent-setup-status-btn-secondary"
            onClick={handleCopy}
            aria-label="Copy Command"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy Command"}
          </button>
        )}
        <button
          type="button"
          className="agent-setup-status-btn agent-setup-status-btn-secondary"
          onClick={onCheckAgain}
          aria-label="Check Again"
        >
          <RefreshCw size={14} />
          Check Again
        </button>
      </div>
    </div>
  );
}
