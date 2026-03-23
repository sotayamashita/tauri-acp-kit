import type { ContentBlock, Message, ToolCallStatus } from "../types";

/** Map ACP wire status strings to UI-facing ToolCallStatus. */
export function mapAcpStatus(status: string): ToolCallStatus {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "in_progress") return "running";
  return "pending";
}

/** Append (or replace) the text block on the last assistant message. */
export function appendTextToLastAssistant(messages: Message[], text: string): Message[] {
  const last = messages[messages.length - 1];
  if (last?.role !== "assistant") return messages;
  return [...messages.slice(0, -1), { ...last, blocks: [{ type: "text" as const, text }] }];
}

/** Append or update the thinking block on the last assistant message. */
export function appendThinkingToLastAssistant(
  messages: Message[],
  thinkingText: string,
): Message[] {
  const last = messages[messages.length - 1];
  if (last?.role !== "assistant") return messages;

  const thinkingBlock: ContentBlock = { type: "thinking", text: thinkingText };
  const lastBlock = last.blocks[last.blocks.length - 1];

  if (lastBlock?.type === "thinking") {
    return [
      ...messages.slice(0, -1),
      { ...last, blocks: [...last.blocks.slice(0, -1), thinkingBlock] },
    ];
  }
  return [...messages.slice(0, -1), { ...last, blocks: [...last.blocks, thinkingBlock] }];
}

/** Append a tool_call block to the last assistant message. */
export function appendToolCallToLastAssistant(
  messages: Message[],
  toolCallId: string,
  toolName: string,
  status: string,
): Message[] {
  const last = messages[messages.length - 1];
  if (last?.role !== "assistant") return messages;

  const block: ContentBlock = {
    type: "tool_call",
    toolCallId,
    title: toolName,
    kind: "unknown",
    status: mapAcpStatus(status),
  };
  return [...messages.slice(0, -1), { ...last, blocks: [...last.blocks, block] }];
}

/** Update the status of a specific tool call in the last assistant message. */
export function updateToolCallStatus(
  messages: Message[],
  toolCallId: string,
  newStatus: string,
): Message[] {
  const last = messages[messages.length - 1];
  if (last?.role !== "assistant") return messages;

  const mappedStatus = mapAcpStatus(newStatus);

  const blocks = last.blocks.map((b) => {
    if (b.type === "tool_call" && b.toolCallId === toolCallId) {
      return { ...b, status: mappedStatus } as ContentBlock;
    }
    return b;
  });
  return [...messages.slice(0, -1), { ...last, blocks }];
}

/** Update or append a plan block on the last assistant message. */
export function updateOrAppendPlan(
  messages: Message[],
  tasks: Array<{ id: string; title: string; status: string }>,
): Message[] {
  const last = messages[messages.length - 1];
  if (last?.role !== "assistant") return messages;

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

  return [...messages.slice(0, -1), { ...last, blocks }];
}
