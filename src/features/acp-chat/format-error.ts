/**
 * Convert raw ACP/Tauri error messages into user-friendly text.
 */
export function formatAcpError(message: string, executable: string): string {
  if (message.includes("No such file or directory")) {
    return `"${executable}" was not found. Please install it or check your PATH.`;
  }

  if (message.toLowerCase().includes("permission denied")) {
    return `"${executable}" exists but permission was denied. Check file permissions.`;
  }

  return message;
}
