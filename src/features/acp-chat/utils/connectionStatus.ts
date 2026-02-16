export type ConnectionStatus = "error" | "downloading" | "connecting" | "generating" | "ready";

export function deriveConnectionStatus(state: {
  error: Error | null;
  spawnFailed: boolean;
  isDownloading: boolean;
  isReady: boolean;
  isLoading: boolean;
}): ConnectionStatus {
  if (state.error && !state.spawnFailed) return "error";
  if (state.isDownloading) return "downloading";
  if (!state.isReady && !state.spawnFailed) return "connecting";
  if (state.isLoading) return "generating";
  if (state.spawnFailed) return "error";
  return "ready";
}
