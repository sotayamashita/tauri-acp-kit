import { useEffect } from "react";
import type { AcpSession } from "tauri-acp";
import type { Message } from "../types";
import {
  appendTextToLastAssistant,
  appendThinkingToLastAssistant,
  appendToolCallToLastAssistant,
  updateToolCallStatus,
  updateOrAppendPlan,
} from "./messageUpdaters";

/**
 * Register all ACP session event listeners and clean them up on unmount.
 *
 * This hook listens for delta, thought, toolCall, toolCallUpdate, plan,
 * complete, and error events on the given session. The streaming refs are
 * used to accumulate content across multiple delta events.
 */
export function useAcpEventListeners(
  session: AcpSession | null,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setError: React.Dispatch<React.SetStateAction<Error | null>>,
  streamingContentRef: React.MutableRefObject<string>,
  streamingThoughtRef: React.MutableRefObject<string>,
): void {
  useEffect(() => {
    if (!session) return;

    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      const deltaUnlisten = await session.onDelta((text) => {
        streamingContentRef.current += text;
        setMessages((prev) => appendTextToLastAssistant(prev, streamingContentRef.current));
      });
      unlisteners.push(deltaUnlisten);

      const thoughtUnlisten = await session.onThoughtDelta((text) => {
        streamingThoughtRef.current += text;
        setMessages((prev) => appendThinkingToLastAssistant(prev, streamingThoughtRef.current));
      });
      unlisteners.push(thoughtUnlisten);

      const toolCallUnlisten = await session.onToolCall((event) => {
        setMessages((prev) =>
          appendToolCallToLastAssistant(prev, event.tool_call_id, event.tool_name, event.status),
        );
      });
      unlisteners.push(toolCallUnlisten);

      const toolCallUpdateUnlisten = await session.onToolCallUpdate((event) => {
        setMessages((prev) => updateToolCallStatus(prev, event.tool_call_id, event.status));
      });
      unlisteners.push(toolCallUpdateUnlisten);

      const planUnlisten = await session.onPlanUpdate((event) => {
        const tasks = Array.isArray(event.tasks) ? event.tasks : [];
        setMessages((prev) =>
          updateOrAppendPlan(prev, tasks as Array<{ id: string; title: string; status: string }>),
        );
      });
      unlisteners.push(planUnlisten);

      const completeUnlisten = await session.onComplete(() => {
        setIsLoading(false);
        streamingContentRef.current = "";
        streamingThoughtRef.current = "";
      });
      unlisteners.push(completeUnlisten);

      const errorUnlisten = await session.onError((msg) => {
        setError(new Error(msg));
        setIsLoading(false);
      });
      unlisteners.push(errorUnlisten);
    };

    setup();

    return () => {
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, [session, setMessages, setIsLoading, setError, streamingContentRef, streamingThoughtRef]);
}
