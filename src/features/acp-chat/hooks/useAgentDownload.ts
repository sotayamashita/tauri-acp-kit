import { useState, useEffect, useCallback } from "react";
import { downloadAgent, onDownloadProgress } from "tauri-acp";
import type { DownloadProgress } from "tauri-acp";

export interface UseAgentDownloadReturn {
  progress: DownloadProgress | null;
  isDownloading: boolean;
  error: string | null;
  download: () => Promise<void>;
}

export function useAgentDownload(agentId: string): UseAgentDownloadReturn {
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const promise = onDownloadProgress((p) => {
      if (p.agentId === agentId) {
        setProgress(p);
        if (p.phase === "complete") {
          setIsDownloading(false);
        } else if (p.phase === "failed") {
          setIsDownloading(false);
          setError("Download failed");
        } else {
          setIsDownloading(true);
        }
      }
    });

    return () => {
      promise.then((unlisten) => unlisten());
    };
  }, [agentId]);

  const download = useCallback(async () => {
    setError(null);
    setIsDownloading(true);
    try {
      await downloadAgent(agentId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setIsDownloading(false);
    }
  }, [agentId]);

  return { progress, isDownloading, error, download };
}
