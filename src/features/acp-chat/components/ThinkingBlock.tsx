import { MarkdownText } from "./MarkdownText";

interface ThinkingBlockProps {
  text: string;
}

export function ThinkingBlock({ text }: ThinkingBlockProps) {
  return (
    <details className="thinking-block">
      <summary className="thinking-block-summary">Thinking</summary>
      <div className="thinking-block-content">
        <MarkdownText content={text} />
      </div>
    </details>
  );
}
