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
 * Uses Promise.all with a cancelled flag to ensure listeners are always
 * cleaned up, even if the component unmounts before async registration
 * completes.
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

    const promise = Promise.all([
      session.onDelta((text) => {
        streamingContentRef.current += text;
        setMessages((prev) => appendTextToLastAssistant(prev, streamingContentRef.current));
      }),
      session.onThoughtDelta((text) => {
        streamingThoughtRef.current += text;
        setMessages((prev) => appendThinkingToLastAssistant(prev, streamingThoughtRef.current));
      }),
      session.onToolCall((event) => {
        setMessages((prev) =>
          appendToolCallToLastAssistant(prev, event.tool_call_id, event.tool_name, event.status),
        );
      }),
      session.onToolCallUpdate((event) => {
        setMessages((prev) => updateToolCallStatus(prev, event.tool_call_id, event.status));
      }),
      session.onPlanUpdate((event) => {
        const tasks = Array.isArray(event.tasks) ? event.tasks : [];
        setMessages((prev) =>
          updateOrAppendPlan(prev, tasks as Array<{ id: string; title: string; status: string }>),
        );
      }),
      session.onComplete(() => {
        setIsLoading(false);
        streamingContentRef.current = "";
        streamingThoughtRef.current = "";
      }),
      session.onError((msg) => {
        setError(new Error(msg));
        setIsLoading(false);
      }),
    ]);

    return () => {
      promise.then((unlisteners) => unlisteners.forEach((fn) => fn()));
    };
  }, [session, setMessages, setIsLoading, setError, streamingContentRef, streamingThoughtRef]);
}
