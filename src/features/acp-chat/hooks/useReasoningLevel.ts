import { useState, useCallback, useRef } from "react";
import { REASONING_LEVELS, type ReasoningLevel } from "../providers";

function loadReasoningLevel(agentId: string): ReasoningLevel | null {
  try {
    const stored = localStorage.getItem(`acp-reasoning-level:${agentId}`);
    if (stored && (REASONING_LEVELS as readonly string[]).includes(stored)) {
      return stored as ReasoningLevel;
    }
  } catch {
    // localStorage unavailable (incognito/private browsing, quota exceeded)
  }
  return null;
}

export interface UseReasoningLevelOptions {
  agentId: string;
  supportsReasoningLevel?: boolean;
}

export interface UseReasoningLevelReturn {
  reasoningLevel: ReasoningLevel | null;
  setReasoningLevel: (level: ReasoningLevel) => void;
  getWireModelId: (modelId: string) => string;
}

export function useReasoningLevel(options: UseReasoningLevelOptions): UseReasoningLevelReturn {
  const [reasoningLevel, setReasoningLevelState] = useState<ReasoningLevel | null>(() => {
    if (!options.supportsReasoningLevel) return null;
    return loadReasoningLevel(options.agentId) || "medium";
  });

  const reasoningLevelRef = useRef(reasoningLevel);
  reasoningLevelRef.current = reasoningLevel;

  const setReasoningLevel = useCallback(
    (level: ReasoningLevel) => {
      setReasoningLevelState(level);
      try {
        localStorage.setItem(`acp-reasoning-level:${options.agentId}`, level);
      } catch {
        // localStorage unavailable (incognito/private browsing, quota exceeded)
      }
    },
    [options.agentId],
  );

  const getWireModelId = useCallback(
    (modelId: string): string => {
      if (options.supportsReasoningLevel && reasoningLevelRef.current) {
        return `${modelId}/${reasoningLevelRef.current}`;
      }
      return modelId;
    },
    [options.supportsReasoningLevel],
  );

  return { reasoningLevel, setReasoningLevel, getWireModelId };
}
