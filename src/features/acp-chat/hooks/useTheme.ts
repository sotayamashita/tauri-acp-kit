import { useState, useEffect, useCallback } from "react";
import { safeGetItem, safeSetItem } from "../utils/storage";

type Theme = "light" | "dark";

const STORAGE_KEY = "acp-theme";

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme(): Theme | null {
  const stored = safeGetItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme() ?? getSystemTheme());

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "light" ? "dark" : "light";
      safeSetItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (!getStoredTheme()) {
        setThemeState(mq.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return { theme, toggleTheme } as const;
}
