import { useState, useCallback } from "react";
import type { Message, UseAcpChatOptions, UseAcpChatReturn } from "../types";
import { useAcpSession } from "./useAcpSession";
import { useReasoningLevel } from "./useReasoningLevel";

export function useAcpChat(options: UseAcpChatOptions): UseAcpChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const {
    session,
    isReady,
    availableModels,
    currentModelId,
    error,
    setError,
    setCurrentModelId,
    streamingContentRef,
  } = useAcpSession(
    {
      agentSpec: options.agentSpec,
      cwd: options.cwd,
      onError: options.onError,
    },
    setMessages,
    setIsLoading,
  );

  const { reasoningLevel, setReasoningLevel, getWireModelId } = useReasoningLevel({
    agentId: options.agentSpec.id,
    supportsReasoningLevel: options.supportsReasoningLevel,
  });

  const append = useCallback(
    async (content: string) => {
      if (!session || isLoading) return;

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
        await session.sendPrompt(content);
      } catch (err) {
        setError(err as Error);
        setIsLoading(false);
      }
    },
    [session, isLoading, setMessages, setError, setIsLoading, streamingContentRef],
  );

  const stop = useCallback(async () => {
    if (!session) return;
    try {
      await session.cancel();
    } catch (err) {
      console.error("Failed to cancel:", err);
    }
  }, [session]);

  const reset = useCallback(() => {
    setMessages([]);
    setInput("");
    setError(null);
    streamingContentRef.current = "";
  }, [setMessages, setError, streamingContentRef]);

  const handleSetModel = useCallback(
    async (modelId: string) => {
      if (!session) return;
      await session.setModel(getWireModelId(modelId));
      setCurrentModelId(modelId);
    },
    [session, getWireModelId, setCurrentModelId],
  );

  const handleSetReasoningLevel = useCallback(
    async (level: typeof reasoningLevel & string) => {
      setReasoningLevel(level);
      if (!session || !currentModelId) return;
      await session.setModel(`${currentModelId}/${level}`);
    },
    [session, currentModelId, setReasoningLevel],
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
