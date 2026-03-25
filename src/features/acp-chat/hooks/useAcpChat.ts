import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { Message, ToolCallStatus, UseAcpChatOptions, UseAcpChatReturn } from "../types";
import { parseReasoningModels } from "../utils/parseReasoningModels";
import { setToolCallStatus } from "./messageUpdaters";
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
    permissionRequestMap.current.clear();
  }, [setMessages, setError, streamingContentRef]);

  const handleSetModel = useCallback(
    async (modelId: string) => {
      if (!session) return;
      await session.setModel(getWireModelId(modelId));
      setCurrentModelId(modelId);
    },
    [session, getWireModelId, setCurrentModelId],
  );

  const permissionRequestMap = useRef(new Map<string, number>());

  useEffect(() => {
    if (!session) return;
    const promise = session.onPermissionRequest((event) => {
      permissionRequestMap.current.set(event.tool_call_id, event.request_id);
    });
    return () => {
      promise.then((unlisten) => unlisten());
    };
  }, [session]);

  const respondToPermission = useCallback(
    (toolCallId: string, optionId: string, uiStatus: ToolCallStatus) => {
      const requestId = permissionRequestMap.current.get(toolCallId);
      if (requestId != null && session) {
        session.respondPermission(requestId, optionId).catch((err: unknown) => {
          console.error("Failed to send permission response:", err);
        });
        permissionRequestMap.current.delete(toolCallId);
      }
      setMessages((prev) => setToolCallStatus(prev, toolCallId, uiStatus));
    },
    [session, setMessages],
  );

  const approveToolCall = useCallback(
    (toolCallId: string) => respondToPermission(toolCallId, "allow", "running"),
    [respondToPermission],
  );

  const rejectToolCall = useCallback(
    (toolCallId: string) => respondToPermission(toolCallId, "reject", "rejected"),
    [respondToPermission],
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
    resolvedCwd: session?.cwd ?? null,
    agentVersion: session?.agentVersion ?? null,
    downloadProgress,
    isDownloading,
    download,
    approveToolCall,
    rejectToolCall,
    append,
    stop,
    reset,
    setModel: handleSetModel,
    setReasoningLevel: handleSetReasoningLevel,
  };
}
