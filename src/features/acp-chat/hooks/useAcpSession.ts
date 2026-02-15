import { useState, useEffect, useRef } from "react";
import { AcpAgent, AcpSession } from "tauri-acp";
import type { AcpModel } from "tauri-acp";
import type { Message } from "../types";
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
