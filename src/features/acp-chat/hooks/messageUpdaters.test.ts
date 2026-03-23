import { describe, it, expect } from "vitest";
import type { Message } from "../types";
import {
  appendTextToLastAssistant,
  appendThinkingToLastAssistant,
  appendToolCallToLastAssistant,
  updateToolCallStatus,
  updateOrAppendPlan,
  mapAcpStatus,
  updateLastAssistant,
} from "./messageUpdaters";

function makeAssistantMessage(blocks: Message["blocks"] = []): Message {
  return {
    id: "msg-1",
    role: "assistant",
    blocks,
    createdAt: new Date("2026-01-01"),
  };
}

function makeUserMessage(): Message {
  return {
    id: "msg-0",
    role: "user",
    blocks: [{ type: "text", text: "hello" }],
    createdAt: new Date("2026-01-01"),
  };
}

describe("messageUpdaters", () => {
  describe("updateLastAssistant", () => {
    it("returns messages unchanged when last message is not assistant", () => {
      const messages: Message[] = [makeUserMessage()];
      const updater = (msg: Message) => ({ ...msg, blocks: [] });
      const result = updateLastAssistant(messages, updater);
      expect(result).toBe(messages);
    });

    it("applies updater to last assistant message and returns new array", () => {
      const messages: Message[] = [
        makeUserMessage(),
        makeAssistantMessage([{ type: "text", text: "old" }]),
      ];
      const result = updateLastAssistant(messages, (msg) => ({
        ...msg,
        blocks: [{ type: "text" as const, text: "new" }],
      }));
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(messages[0]);
      expect(result[1].blocks).toEqual([{ type: "text", text: "new" }]);
    });

    it("returns messages unchanged for empty array", () => {
      const messages: Message[] = [];
      const result = updateLastAssistant(messages, (msg) => msg);
      expect(result).toBe(messages);
    });
  });

  describe("appendTextToLastAssistant", () => {
    it("updates text block on last assistant message", () => {
      const messages: Message[] = [
        makeUserMessage(),
        makeAssistantMessage([{ type: "text", text: "old" }]),
      ];
      const result = appendTextToLastAssistant(messages, "new text");
      expect(result[1].blocks).toEqual([{ type: "text", text: "new text" }]);
    });

    it("returns unchanged if last message is not assistant", () => {
      const messages: Message[] = [makeUserMessage()];
      const result = appendTextToLastAssistant(messages, "text");
      expect(result).toBe(messages);
    });
  });

  describe("appendThinkingToLastAssistant", () => {
    it("appends new thinking block when none exists", () => {
      const messages: Message[] = [makeAssistantMessage([{ type: "text", text: "hi" }])];
      const result = appendThinkingToLastAssistant(messages, "thinking...");
      expect(result[0].blocks).toHaveLength(2);
      expect(result[0].blocks[1]).toEqual({ type: "thinking", text: "thinking..." });
    });

    it("updates existing thinking block", () => {
      const messages: Message[] = [
        makeAssistantMessage([
          { type: "text", text: "hi" },
          { type: "thinking", text: "old thought" },
        ]),
      ];
      const result = appendThinkingToLastAssistant(messages, "new thought");
      expect(result[0].blocks).toHaveLength(2);
      expect(result[0].blocks[1]).toEqual({ type: "thinking", text: "new thought" });
    });
  });

  describe("appendToolCallToLastAssistant", () => {
    it("appends tool call block to assistant message", () => {
      const messages: Message[] = [makeAssistantMessage([{ type: "text", text: "let me check" }])];
      const result = appendToolCallToLastAssistant(messages, "tc-1", "Read", "pending");
      expect(result[0].blocks).toHaveLength(2);
      expect(result[0].blocks[1]).toMatchObject({
        type: "tool_call",
        toolCallId: "tc-1",
        title: "Read",
        status: "pending",
      });
    });

    it("maps in_progress status to running", () => {
      const messages: Message[] = [makeAssistantMessage()];
      const result = appendToolCallToLastAssistant(messages, "tc-1", "Bash", "in_progress");
      expect(result[0].blocks[0]).toMatchObject({ status: "running" });
    });
  });

  describe("updateToolCallStatus", () => {
    it("finds and updates the correct tool call", () => {
      const messages: Message[] = [
        makeAssistantMessage([
          {
            type: "tool_call",
            toolCallId: "tc-1",
            title: "Read",
            kind: "unknown",
            status: "running",
          },
        ]),
      ];
      const result = updateToolCallStatus(messages, "tc-1", "completed");
      expect(result[0].blocks[0]).toMatchObject({
        toolCallId: "tc-1",
        status: "completed",
      });
    });

    it("does not modify unrelated tool calls", () => {
      const messages: Message[] = [
        makeAssistantMessage([
          {
            type: "tool_call",
            toolCallId: "tc-1",
            title: "Read",
            kind: "unknown",
            status: "running",
          },
          {
            type: "tool_call",
            toolCallId: "tc-2",
            title: "Bash",
            kind: "unknown",
            status: "pending",
          },
        ]),
      ];
      const result = updateToolCallStatus(messages, "tc-1", "completed");
      expect(result[0].blocks[1]).toMatchObject({ toolCallId: "tc-2", status: "pending" });
    });
  });

  describe("mapAcpStatus", () => {
    it("maps completed to completed", () => {
      expect(mapAcpStatus("completed")).toBe("completed");
    });

    it("maps failed to failed", () => {
      expect(mapAcpStatus("failed")).toBe("failed");
    });

    it("maps in_progress to running", () => {
      expect(mapAcpStatus("in_progress")).toBe("running");
    });

    it("returns pending for unknown status", () => {
      expect(mapAcpStatus("queued")).toBe("pending");
    });
  });

  describe("updateOrAppendPlan", () => {
    it("appends plan when none exists", () => {
      const messages: Message[] = [makeAssistantMessage([{ type: "text", text: "planning..." }])];
      const tasks = [{ id: "t1", title: "Do thing", status: "pending" }];
      const result = updateOrAppendPlan(messages, tasks);
      expect(result[0].blocks).toHaveLength(2);
      expect(result[0].blocks[1]).toMatchObject({
        type: "plan",
        tasks: [{ id: "t1", title: "Do thing", status: "pending" }],
      });
    });

    it("replaces existing plan", () => {
      const messages: Message[] = [
        makeAssistantMessage([
          { type: "text", text: "planning..." },
          { type: "plan", tasks: [{ id: "t1", title: "Old", status: "pending" }] },
        ]),
      ];
      const tasks = [{ id: "t1", title: "New", status: "completed" }];
      const result = updateOrAppendPlan(messages, tasks);
      expect(result[0].blocks).toHaveLength(2);
      expect(result[0].blocks[1]).toMatchObject({
        type: "plan",
        tasks: [{ id: "t1", title: "New", status: "completed" }],
      });
    });
  });
});
