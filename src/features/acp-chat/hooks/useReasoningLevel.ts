import { useState, useCallback, useRef } from "react";
import { REASONING_LEVELS, type ReasoningLevel } from "../providers";
import { safeGetItem, safeSetItem } from "../utils/storage";
import { reasoningLevelKey } from "../utils/storageKeys";

function loadReasoningLevel(agentId: string): ReasoningLevel | null {
  const stored = safeGetItem(reasoningLevelKey(agentId));
  if (stored && (REASONING_LEVELS as readonly string[]).includes(stored)) {
    return stored as ReasoningLevel;
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
      safeSetItem(reasoningLevelKey(options.agentId), level);
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
