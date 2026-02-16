import { useState, useEffect, useRef } from "react";
import { AcpAgent, AcpSession } from "tauri-acp";
import type { AcpModel } from "tauri-acp";
import type { ContentBlock, Message } from "../types";
import { formatAcpError } from "../format-error";

export interface UseAcpSessionOptions {
  agentSpec: { id: string; executable: string; args?: string[] };
  cwd?: string;
  onError?: (error: Error) => void;
}

export interface UseAcpSessionReturn {
  session: AcpSession | null;
  isReady: boolean;
  availableModels: AcpModel[];
  currentModelId: string | null;
  error: Error | null;
  setError: React.Dispatch<React.SetStateAction<Error | null>>;
  setCurrentModelId: React.Dispatch<React.SetStateAction<string | null>>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  streamingContentRef: React.MutableRefObject<string>;
}

export function useAcpSession(
  options: UseAcpSessionOptions,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
): UseAcpSessionReturn {
  const [isReady, setIsReady] = useState(false);
  const [availableModels, setAvailableModels] = useState<AcpModel[]>([]);
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const agentRef = useRef<AcpAgent | null>(null);
  const sessionRef = useRef<AcpSession | null>(null);
  const streamingContentRef = useRef("");
  const streamingThoughtRef = useRef("");
  const unlistenersRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const agent = new AcpAgent();
        await agent.spawn(options.agentSpec);

        if (!mounted) {
          await agent.terminate();
          return;
        }

        agentRef.current = agent;

        const globalUnlisten = await agent.onEvent((event) => {
          console.log("[AcpChat] Global event received:", event);
        });
        unlistenersRef.current.push(globalUnlisten);

        const cwd = options.cwd || ".";
        const session = await agent.startSession(cwd);

        if (!mounted) {
          await agent.terminate();
          return;
        }

        sessionRef.current = session;

        const deltaUnlisten = await session.onDelta((text) => {
          streamingContentRef.current += text;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [
                ...prev.slice(0, -1),
                { ...last, blocks: [{ type: "text" as const, text: streamingContentRef.current }] },
              ];
            }
            return prev;
          });
        });
        unlistenersRef.current.push(deltaUnlisten);

        const thoughtUnlisten = await session.onThoughtDelta((text) => {
          streamingThoughtRef.current += text;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role !== "assistant") return prev;
            const existingBlocks = last.blocks;
            const lastBlock = existingBlocks[existingBlocks.length - 1];
            const thinkingBlock: ContentBlock = {
              type: "thinking",
              text: streamingThoughtRef.current,
            };
            if (lastBlock?.type === "thinking") {
              return [
                ...prev.slice(0, -1),
                { ...last, blocks: [...existingBlocks.slice(0, -1), thinkingBlock] },
              ];
            }
            return [...prev.slice(0, -1), { ...last, blocks: [...existingBlocks, thinkingBlock] }];
          });
        });
        unlistenersRef.current.push(thoughtUnlisten);

        const toolCallUnlisten = await session.onToolCall((event) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role !== "assistant") return prev;
            const block: ContentBlock = {
              type: "tool_call",
              toolCallId: event.tool_call_id,
              title: event.tool_name,
              kind: "unknown",
              status: event.status === "in_progress" ? "running" : "pending",
            };
            return [...prev.slice(0, -1), { ...last, blocks: [...last.blocks, block] }];
          });
        });
        unlistenersRef.current.push(toolCallUnlisten);

        const toolCallUpdateUnlisten = await session.onToolCallUpdate((event) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role !== "assistant") return prev;
            const blocks = last.blocks.map((b) => {
              if (b.type === "tool_call" && b.toolCallId === event.tool_call_id) {
                const status =
                  event.status === "completed"
                    ? "completed"
                    : event.status === "failed"
                      ? "failed"
                      : event.status === "in_progress"
                        ? "running"
                        : b.status;
                return { ...b, status } as ContentBlock;
              }
              return b;
            });
            return [...prev.slice(0, -1), { ...last, blocks }];
          });
        });
        unlistenersRef.current.push(toolCallUpdateUnlisten);

        const planUnlisten = await session.onPlanUpdate((event) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role !== "assistant") return prev;
            const tasks = Array.isArray(event.tasks) ? event.tasks : [];
            const planBlock: ContentBlock = {
              type: "plan",
              tasks: tasks.map((t: Record<string, unknown>) => ({
                id: String(t.id ?? ""),
                title: String(t.title ?? ""),
                status: (t.status as "pending" | "in_progress" | "completed") ?? "pending",
              })),
            };
            const existingBlocks = last.blocks;
            const planIdx = existingBlocks.findIndex((b) => b.type === "plan");
            const blocks =
              planIdx >= 0
                ? [
                    ...existingBlocks.slice(0, planIdx),
                    planBlock,
                    ...existingBlocks.slice(planIdx + 1),
                  ]
                : [...existingBlocks, planBlock];
            return [...prev.slice(0, -1), { ...last, blocks }];
          });
        });
        unlistenersRef.current.push(planUnlisten);

        const completeUnlisten = await session.onComplete(() => {
          setIsLoading(false);
          streamingContentRef.current = "";
          streamingThoughtRef.current = "";
        });
        unlistenersRef.current.push(completeUnlisten);

        const errorUnlisten = await session.onError((msg) => {
          setError(new Error(msg));
          setIsLoading(false);
        });
        unlistenersRef.current.push(errorUnlisten);

        setAvailableModels(session.models);
        setCurrentModelId(session.currentModelId);
        setIsReady(true);
      } catch (err) {
        if (mounted) {
          const raw = err as Error;
          const friendly = new Error(
            formatAcpError(raw.message ?? String(err), options.agentSpec.executable),
          );
          setError(friendly);
          options.onError?.(friendly);
        }
      }
    };

    init();

    return () => {
      mounted = false;

      for (const unlisten of unlistenersRef.current) {
        unlisten();
      }
      unlistenersRef.current = [];

      if (agentRef.current) {
        agentRef.current.terminate().catch(console.error);
        agentRef.current = null;
        sessionRef.current = null;
      }
    };
  }, [options.agentSpec.id, options.agentSpec.executable, options.cwd]);

  return {
    session: sessionRef.current,
    isReady,
    availableModels,
    currentModelId,
    error,
    setError,
    setCurrentModelId,
    setMessages,
    setIsLoading,
    streamingContentRef,
  };
}
