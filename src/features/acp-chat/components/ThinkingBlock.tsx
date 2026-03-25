import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { MarkdownText } from "./MarkdownText";

interface ThinkingBlockProps {
  text: string;
}

export function ThinkingBlock({ text }: ThinkingBlockProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="my-1 border-l-3 border-[var(--chat-thinking-border)] rounded"
    >
      <CollapsibleTrigger className="flex items-center gap-1 px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground select-none hover:text-foreground">
        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
        Thinking
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2.5 pb-2 text-sm text-muted-foreground">
        <MarkdownText content={text} />
      </CollapsibleContent>
    </Collapsible>
  );
}
