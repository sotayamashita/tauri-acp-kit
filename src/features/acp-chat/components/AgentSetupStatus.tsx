import { useCallback, useState } from "react";
import { Copy, Check, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold">Setting up {label}</h2>
      <p className="max-w-[480px] text-sm leading-relaxed text-muted-foreground">
        {info.description}
      </p>

      {info.command && (
        <pre className="w-full max-w-[480px] overflow-x-auto rounded-md border bg-muted p-3 text-left font-mono text-[13px] break-all whitespace-pre-wrap">
          <code>{info.command}</code>
        </pre>
      )}

      <div className="mt-2 flex gap-2">
        {onDownload && (
          <Button onClick={onDownload} disabled={isDownloading} aria-label="Download">
            <Download data-icon="inline-start" />
            {isDownloading ? "Downloading…" : "Download"}
          </Button>
        )}
        {info.command && (
          <Button variant="outline" onClick={handleCopy} aria-label="Copy Command">
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
            {copied ? "Copied!" : "Copy Command"}
          </Button>
        )}
        <Button variant="outline" onClick={onCheckAgain} aria-label="Check Again">
          <RefreshCw data-icon="inline-start" />
          Check Again
        </Button>
      </div>
    </div>
  );
}
