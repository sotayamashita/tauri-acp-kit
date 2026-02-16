import type { ContentBlock } from "../types";
import { MarkdownText } from "./MarkdownText";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallCard } from "./ToolCallCard";
import { PlanView } from "./PlanView";

interface ContentBlockRendererProps {
  block: ContentBlock;
}

export function ContentBlockRenderer({ block }: ContentBlockRendererProps) {
  switch (block.type) {
    case "text":
      return block.text ? <MarkdownText content={block.text} /> : null;
    case "thinking":
      return <ThinkingBlock text={block.text} />;
    case "tool_call":
      return (
        <ToolCallCard
          toolCallId={block.toolCallId}
          title={block.title}
          status={block.status}
          input={block.input}
          output={block.output}
        />
      );
    case "plan":
      return <PlanView tasks={block.tasks} />;
    default:
      return null;
  }
}
