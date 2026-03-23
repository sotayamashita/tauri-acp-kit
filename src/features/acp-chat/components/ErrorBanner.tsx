import { AlertCircle } from "lucide-react";

export function ErrorBanner({ error }: { error: Error | null }) {
  if (!error) return null;

  return (
    <div className="acp-chat-error">
      <AlertCircle size={14} />
      <span>{error.message}</span>
    </div>
  );
}
