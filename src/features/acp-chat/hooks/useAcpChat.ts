import { useState, useCallback, useMemo } from "react";
import type { Message, UseAcpChatOptions, UseAcpChatReturn } from "../types";
import { parseReasoningModels } from "../utils/parseReasoningModels";
import { useAcpSession } from "./useAcpSession";
import { useAgentDownload } from "./useAgentDownload";
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
    spawnFailed,
    retry,
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

  const {
    progress: downloadProgress,
    isDownloading,
    download,
  } = useAgentDownload(options.agentSpec.id);

  const { reasoningLevel, setReasoningLevel, getWireModelId } = useReasoningLevel({
    agentId: options.agentSpec.id,
    supportsReasoningLevel: options.supportsReasoningLevel,
  });

  const { displayModels, reasoningLevelsMap, baseModelId } = useMemo(
    () => parseReasoningModels(availableModels, currentModelId, options.supportsReasoningLevel),
    [availableModels, currentModelId, options.supportsReasoningLevel],
  );

  const append = useCallback(
    async (content: string) => {
      if (!session || isLoading) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        blocks: [{ type: "text", text: content }],
        createdAt: new Date(),
      };

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        blocks: [],
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

  const effectiveModelId = baseModelId ?? currentModelId;
  const currentModelName = displayModels.find((m) => m.id === effectiveModelId)?.name ?? null;

  return {
    messages,
    input,
    setInput,
    isLoading,
    error,
    isReady,
    spawnFailed,
    retry,
    availableModels: displayModels,
    currentModelId: effectiveModelId,
    currentModelName,
    reasoningLevel,
    reasoningLevels: reasoningLevelsMap?.get(effectiveModelId ?? "") ?? null,
    downloadProgress,
    isDownloading,
    download,
    append,
    stop,
    reset,
    setModel: handleSetModel,
    setReasoningLevel: handleSetReasoningLevel,
  };
}
