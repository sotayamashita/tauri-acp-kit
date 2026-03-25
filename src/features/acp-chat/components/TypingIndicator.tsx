import { memo } from "react";

export const TypingIndicator = memo(function TypingIndicator() {
  return (
    <div className="typing-indicator" role="status" aria-label="Generating response">
      <span className="typing-dot" aria-hidden="true" />
      <span className="typing-dot" aria-hidden="true" />
      <span className="typing-dot" aria-hidden="true" />
    </div>
  );
});
