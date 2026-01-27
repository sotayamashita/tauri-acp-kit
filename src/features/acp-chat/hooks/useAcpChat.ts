import { useState, useEffect, useCallback, useRef } from "react";
import { AcpAgent, AcpSession } from "tauri-acp";
import type { Message, UseAcpChatOptions, UseAcpChatReturn } from "../types";

export function useAcpChat(options: UseAcpChatOptions): UseAcpChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isReady, setIsReady] = useState(false);

  const agentRef = useRef<AcpAgent | null>(null);
  const sessionRef = useRef<AcpSession | null>(null);
  const streamingContentRef = useRef("");
  const unlistenersRef = useRef<Array<() => void>>([]);

  // Initialize agent and session on mount
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

        const cwd = options.cwd || ".";
        const session = await agent.startSession(cwd);

        if (!mounted) {
          await agent.terminate();
          return;
        }

        sessionRef.current = session;

        // Subscribe to events
        const deltaUnlisten = await session.onDelta((text) => {
          streamingContentRef.current += text;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [...prev.slice(0, -1), { ...last, content: streamingContentRef.current }];
            }
            return prev;
          });
        });
        unlistenersRef.current.push(deltaUnlisten);

        const completeUnlisten = await session.onComplete(() => {
          setIsLoading(false);
          streamingContentRef.current = "";
        });
        unlistenersRef.current.push(completeUnlisten);

        const errorUnlisten = await session.onError((msg) => {
          setError(new Error(msg));
          setIsLoading(false);
        });
        unlistenersRef.current.push(errorUnlisten);

        setIsReady(true);
      } catch (err) {
        if (mounted) {
          const error = err as Error;
          setError(error);
          options.onError?.(error);
        }
      }
    };

    init();

    return () => {
      mounted = false;

      // Cleanup listeners
      for (const unlisten of unlistenersRef.current) {
        unlisten();
      }
      unlistenersRef.current = [];

      // Terminate agent
      if (agentRef.current) {
        agentRef.current.terminate().catch(console.error);
        agentRef.current = null;
        sessionRef.current = null;
      }
    };
  }, [options.agentSpec.id, options.agentSpec.executable, options.cwd]);

  const append = useCallback(
    async (content: string) => {
      if (!sessionRef.current || isLoading) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        createdAt: new Date(),
      };

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);
      setError(null);
      streamingContentRef.current = "";

      try {
        await sessionRef.current.sendPrompt(content);
      } catch (err) {
        setError(err as Error);
        setIsLoading(false);
      }
    },
    [isLoading],
  );

  const stop = useCallback(async () => {
    if (!sessionRef.current) return;
    try {
      await sessionRef.current.cancel();
    } catch (err) {
      console.error("Failed to cancel:", err);
    }
  }, []);

  return { messages, input, setInput, isLoading, error, isReady, append, stop };
}
