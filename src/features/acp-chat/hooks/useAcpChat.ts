import { useState, useEffect, useCallback, useRef } from "react";
import { AcpAgent, AcpSession } from "tauri-acp";
import type { AcpModel } from "tauri-acp";
import type { Message, UseAcpChatOptions, UseAcpChatReturn } from "../types";
import { REASONING_LEVELS, type ReasoningLevel } from "../providers";
import { formatAcpError } from "../format-error";

function loadReasoningLevel(agentId: string): ReasoningLevel | null {
  const stored = localStorage.getItem(`acp-reasoning-level:${agentId}`);
  if (stored && (REASONING_LEVELS as readonly string[]).includes(stored)) {
    return stored as ReasoningLevel;
  }
  return null;
}

export function useAcpChat(options: UseAcpChatOptions): UseAcpChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [availableModels, setAvailableModels] = useState<AcpModel[]>([]);
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  const [reasoningLevel, setReasoningLevelState] = useState<ReasoningLevel | null>(() => {
    if (!options.supportsReasoningLevel) return null;
    return loadReasoningLevel(options.agentSpec.id) || "medium";
  });

  const agentRef = useRef<AcpAgent | null>(null);
  const sessionRef = useRef<AcpSession | null>(null);
  const streamingContentRef = useRef("");
  const unlistenersRef = useRef<Array<() => void>>([]);

  // Initialize agent and session on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        console.log("[AcpChat] Spawning agent:", options.agentSpec);
        const agent = new AcpAgent();
        await agent.spawn(options.agentSpec);
        console.log("[AcpChat] Agent spawned successfully");

        if (!mounted) {
          await agent.terminate();
          return;
        }

        agentRef.current = agent;

        // Subscribe to ALL agent events for debugging
        const globalUnlisten = await agent.onEvent((event) => {
          console.log("[AcpChat] Global event received:", event);
        });
        unlistenersRef.current.push(globalUnlisten);

        const cwd = options.cwd || ".";
        console.log("[AcpChat] Starting session with cwd:", cwd);
        const session = await agent.startSession(cwd);
        console.log("[AcpChat] Session started:", session.id);

        if (!mounted) {
          await agent.terminate();
          return;
        }

        sessionRef.current = session;

        // Subscribe to events
        console.log("[AcpChat] Subscribing to events for session:", session.id);

        const deltaUnlisten = await session.onDelta((text) => {
          console.log(
            "[AcpChat] Delta received:",
            text.substring(0, 50) + (text.length > 50 ? "..." : ""),
          );
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

        const completeUnlisten = await session.onComplete((reason) => {
          console.log("[AcpChat] Complete received:", reason);
          setIsLoading(false);
          streamingContentRef.current = "";
        });
        unlistenersRef.current.push(completeUnlisten);

        const errorUnlisten = await session.onError((msg) => {
          console.log("[AcpChat] Error received:", msg);
          setError(new Error(msg));
          setIsLoading(false);
        });
        unlistenersRef.current.push(errorUnlisten);

        setAvailableModels(session.models);
        setCurrentModelId(session.currentModelId);
        console.log("[AcpChat] Ready!");
        setIsReady(true);
      } catch (err) {
        console.error("[AcpChat] Initialization failed:", err);
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

  const reset = useCallback(() => {
    setMessages([]);
    setInput("");
    setError(null);
    streamingContentRef.current = "";
  }, []);

  const reasoningLevelRef = useRef(reasoningLevel);
  reasoningLevelRef.current = reasoningLevel;

  const handleSetModel = useCallback(
    async (modelId: string) => {
      if (!sessionRef.current) return;
      const wireModelId =
        options.supportsReasoningLevel && reasoningLevelRef.current
          ? `${modelId}/${reasoningLevelRef.current}`
          : modelId;
      await sessionRef.current.setModel(wireModelId);
      setCurrentModelId(modelId);
    },
    [options.supportsReasoningLevel],
  );

  const handleSetReasoningLevel = useCallback(
    async (level: ReasoningLevel) => {
      setReasoningLevelState(level);
      localStorage.setItem(`acp-reasoning-level:${options.agentSpec.id}`, level);
      if (!sessionRef.current || !currentModelId) return;
      const wireModelId = `${currentModelId}/${level}`;
      await sessionRef.current.setModel(wireModelId);
    },
    [currentModelId, options.agentSpec.id],
  );

  return {
    messages,
    input,
    setInput,
    isLoading,
    error,
    isReady,
    availableModels,
    currentModelId,
    reasoningLevel,
    append,
    stop,
    reset,
    setModel: handleSetModel,
    setReasoningLevel: handleSetReasoningLevel,
  };
}
