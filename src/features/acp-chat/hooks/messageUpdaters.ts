import type { ContentBlock, Message, ToolCallStatus } from "../types";

export function updateLastAssistant(
  messages: Message[],
  updater: (last: Message) => Message,
): Message[] {
  const last = messages[messages.length - 1];
  if (last?.role !== "assistant") return messages;
  return [...messages.slice(0, -1), updater(last)];
}

export function mapAcpStatus(status: string): ToolCallStatus {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "in_progress") return "running";
  return "pending";
}

export function appendTextToLastAssistant(messages: Message[], text: string): Message[] {
  return updateLastAssistant(messages, (last) => ({
    ...last,
    blocks: [{ type: "text" as const, text }],
  }));
}

export function appendThinkingToLastAssistant(
  messages: Message[],
  thinkingText: string,
): Message[] {
  return updateLastAssistant(messages, (last) => {
    const thinkingBlock: ContentBlock = { type: "thinking", text: thinkingText };
    const lastBlock = last.blocks[last.blocks.length - 1];

    if (lastBlock?.type === "thinking") {
      return { ...last, blocks: [...last.blocks.slice(0, -1), thinkingBlock] };
    }
    return { ...last, blocks: [...last.blocks, thinkingBlock] };
  });
}

export function appendToolCallToLastAssistant(
  messages: Message[],
  toolCallId: string,
  toolName: string,
  status: string,
): Message[] {
  return updateLastAssistant(messages, (last) => {
    const block: ContentBlock = {
      type: "tool_call",
      toolCallId,
      title: toolName,
      kind: "unknown",
      status: mapAcpStatus(status),
    };
    return { ...last, blocks: [...last.blocks, block] };
  });
}

export function updateToolCallStatus(
  messages: Message[],
  toolCallId: string,
  newStatus: string,
): Message[] {
  return updateLastAssistant(messages, (last) => {
    const mappedStatus = mapAcpStatus(newStatus);
    const blocks = last.blocks.map((b) => {
      if (b.type === "tool_call" && b.toolCallId === toolCallId) {
        return { ...b, status: mappedStatus } as ContentBlock;
      }
      return b;
    });
    return { ...last, blocks };
  });
}

export function updateOrAppendPlan(
  messages: Message[],
  tasks: Array<{ id: string; title: string; status: string }>,
): Message[] {
  return updateLastAssistant(messages, (last) => {
    const planBlock: ContentBlock = {
      type: "plan",
      tasks: tasks.map((t) => ({
        id: String(t.id ?? ""),
        title: String(t.title ?? ""),
        status: (t.status as "pending" | "in_progress" | "completed") ?? "pending",
      })),
    };

    const planIdx = last.blocks.findIndex((b) => b.type === "plan");
    const blocks =
      planIdx >= 0
        ? [...last.blocks.slice(0, planIdx), planBlock, ...last.blocks.slice(planIdx + 1)]
        : [...last.blocks, planBlock];

    return { ...last, blocks };
  });
}
