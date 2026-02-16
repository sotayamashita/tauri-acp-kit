/** Safely read from localStorage, returning null if unavailable. */
export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Safely write to localStorage, silently ignoring failures. */
export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage unavailable (SSR, private browsing quota)
  }
}
