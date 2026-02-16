import { useState, useEffect, useRef, useCallback } from "react";
import { AcpAgent, AcpSession } from "tauri-acp";
import type { AcpModel } from "tauri-acp";
import type { Message } from "../types";
import { formatAcpError } from "../format-error";
import { useAcpEventListeners } from "./useAcpEventListeners";

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
  spawnFailed: boolean;
  retry: () => void;
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
  const [spawnFailed, setSpawnFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [session, setSession] = useState<AcpSession | null>(null);

  const agentRef = useRef<AcpAgent | null>(null);
  const streamingContentRef = useRef("");
  const streamingThoughtRef = useRef("");
  const globalUnlistenRef = useRef<(() => void) | null>(null);

  const retry = useCallback(() => {
    setSpawnFailed(false);
    setError(null);
    setIsReady(false);
    setRetryCount((c) => c + 1);
  }, []);

  // Agent lifecycle: spawn agent and create session
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
        globalUnlistenRef.current = globalUnlisten;

        const cwd = options.cwd || ".";
        const newSession = await agent.startSession(cwd);

        if (!mounted) {
          await agent.terminate();
          return;
        }

        setSession(newSession);
        setAvailableModels(newSession.models);
        setCurrentModelId(newSession.currentModelId);
        setIsReady(true);
      } catch (err) {
        if (mounted) {
          const raw = err as Error;
          const rawMsg = raw.message ?? String(err);
          const friendly = new Error(formatAcpError(rawMsg, options.agentSpec.executable));
          setError(friendly);
          if (rawMsg.includes("No such file or directory") || rawMsg.includes("not found")) {
            setSpawnFailed(true);
          }
          options.onError?.(friendly);
        }
      }
    };

    init();

    return () => {
      mounted = false;
      globalUnlistenRef.current?.();
      globalUnlistenRef.current = null;

      if (agentRef.current) {
        agentRef.current.terminate().catch(console.error);
        agentRef.current = null;
        setSession(null);
      }
    };
  }, [options.agentSpec.id, options.agentSpec.executable, options.cwd, retryCount]);

  // Event listeners: delegated to focused hook
  useAcpEventListeners(
    session,
    setMessages,
    setIsLoading,
    setError,
    streamingContentRef,
    streamingThoughtRef,
  );

  return {
    session,
    isReady,
    availableModels,
    currentModelId,
    error,
    spawnFailed,
    retry,
    setError,
    setCurrentModelId,
    setMessages,
    setIsLoading,
    streamingContentRef,
  };
}
