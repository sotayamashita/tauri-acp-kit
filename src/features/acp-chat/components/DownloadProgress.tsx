import type { DownloadProgress as DownloadProgressType } from "tauri-acp";
import { Download } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface DownloadProgressProps {
  progress: DownloadProgressType;
  label: string;
}

function phaseLabel(phase: DownloadProgressType["phase"], percentage: number | null): string {
  switch (phase) {
    case "resolving":
      return "Resolving latest version…";
    case "downloading":
      return percentage !== null ? `Downloading… ${percentage}%` : "Downloading…";
    case "verifying":
      return "Verifying…";
    case "extracting":
      return "Extracting…";
    case "complete":
      return "Download complete";
    case "failed":
      return "Download failed";
  }
}

export function DownloadProgress({ progress, label }: DownloadProgressProps) {
  const percentage =
    progress.totalBytes && progress.bytesDownloaded > 0
      ? Math.round((progress.bytesDownloaded / progress.totalBytes) * 100)
      : null;

  const phase = phaseLabel(progress.phase, percentage);

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
      role="status"
      aria-live="polite"
    >
      <Download size={24} className="animate-pulse text-muted-foreground" aria-hidden="true" />
      <h2 className="text-lg font-semibold">Setting up {label}</h2>
      <p className="text-sm text-muted-foreground">{phase}</p>
      {progress.phase === "downloading" && (
        <Progress value={percentage ?? 0} className="w-full max-w-xs" />
      )}
    </div>
  );
}
