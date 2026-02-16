import type { DownloadProgress as DownloadProgressType } from "tauri-acp";
import { Download } from "lucide-react";

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
    <div className="download-progress" role="status" aria-live="polite">
      <Download size={24} className="download-progress-icon" aria-hidden="true" />
      <h2 className="download-progress-title">Setting up {label}</h2>
      <p className="download-progress-phase">{phase}</p>
      {progress.phase === "downloading" && (
        <div
          className="download-progress-bar"
          role="progressbar"
          aria-valuenow={percentage ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="download-progress-fill"
            style={{ width: percentage !== null ? `${percentage}%` : "30%" }}
          />
        </div>
      )}
    </div>
  );
}
