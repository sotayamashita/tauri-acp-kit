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
  if (status === "waiting_confirmation") return "waiting_confirmation";
  if (status === "rejected") return "rejected";
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
  input?: string,
): Message[] {
  return updateLastAssistant(messages, (last) => {
    const existing = last.blocks.find((b) => b.type === "tool_call" && b.toolCallId === toolCallId);
    if (existing) {
      const blocks = last.blocks.map((b) => {
        if (b.type === "tool_call" && b.toolCallId === toolCallId) {
          return { ...b, title: toolName, ...(input != null && { input }) } as ContentBlock;
        }
        return b;
      });
      return { ...last, blocks };
    }
    const block: ContentBlock = {
      type: "tool_call",
      toolCallId,
      title: toolName,
      kind: "unknown",
      status: "waiting_confirmation",
      input,
    };
    return { ...last, blocks: [...last.blocks, block] };
  });
}

export function updateToolCallStatus(
  messages: Message[],
  toolCallId: string,
  newStatus: string,
  output?: string,
): Message[] {
  return updateLastAssistant(messages, (last) => {
    const mappedStatus = mapAcpStatus(newStatus);
    const blocks = last.blocks.map((b) => {
      if (b.type === "tool_call" && b.toolCallId === toolCallId) {
        return { ...b, status: mappedStatus, ...(output != null && { output }) } as ContentBlock;
      }
      return b;
    });
    return { ...last, blocks };
  });
}

export function setToolCallStatus(
  messages: Message[],
  toolCallId: string,
  newStatus: ToolCallStatus,
): Message[] {
  return updateLastAssistant(messages, (last) => {
    const blocks = last.blocks.map((b) => {
      if (b.type === "tool_call" && b.toolCallId === toolCallId) {
        return { ...b, status: newStatus } as ContentBlock;
      }
      return b;
    });
    return { ...last, blocks };
  });
}

export function setPermissionRequest(
  messages: Message[],
  toolCallId: string,
  requestId: number,
  input?: string,
): Message[] {
  return updateLastAssistant(messages, (last) => {
    const blocks = last.blocks.map((b) => {
      if (b.type === "tool_call" && b.toolCallId === toolCallId) {
        return {
          ...b,
          status: "waiting_confirmation" as const,
          permissionRequestId: requestId,
          ...(input != null && { input }),
        } as ContentBlock;
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
