import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ErrorBanner({ error }: { error: Error | null }) {
  if (!error) return null;

  return (
    <Alert variant="destructive" className="mx-4 shrink-0">
      <AlertCircle />
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}
