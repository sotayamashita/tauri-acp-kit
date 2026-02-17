/**
 * Pick the best display name for a model.
 * Uses model.name when it's a proper display name (multi-word),
 * otherwise falls back to formatModelId(model.id).
 */
export function getDisplayName(model: { id: string; name: string }): string {
  if (model.name !== model.id && model.name.includes(" ")) {
    return model.name;
  }
  return formatModelId(model.id);
}

/**
 * Format a model ID into a human-readable display name.
 *
 * Examples:
 *   "claude-sonnet-4"          → "Sonnet 4"
 *   "claude-opus-4-6"          → "Opus 4.6"
 *   "claude-sonnet-4-20250514" → "Sonnet 4"
 *   "claude-3-5-haiku"         → "3.5 Haiku"
 *   "default"                  → "Default"
 */
export function formatModelId(id: string): string {
  if (id === "default") return "Default";

  const parts = id.split("-");

  // Strip "claude" prefix
  const start = parts[0] === "claude" ? 1 : 0;
  const rest = parts.slice(start);

  // Strip date suffix (8-digit number like 20250514)
  if (rest.length > 0 && /^\d{8}$/.test(rest[rest.length - 1])) {
    rest.pop();
  }

  // Identify version segments: consecutive numeric parts at the boundary
  // e.g. ["sonnet", "4"] or ["opus", "4", "6"] or ["3", "5", "haiku"]
  const words: string[] = [];
  let i = 0;
  while (i < rest.length) {
    if (/^\d+$/.test(rest[i])) {
      // Collect consecutive numeric parts into a version string
      const versionParts: string[] = [];
      while (i < rest.length && /^\d+$/.test(rest[i])) {
        versionParts.push(rest[i]);
        i++;
      }
      words.push(versionParts.join("."));
    } else {
      words.push(rest[i].charAt(0).toUpperCase() + rest[i].slice(1));
      i++;
    }
  }

  return words.join(" ");
}
