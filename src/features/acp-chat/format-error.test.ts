import { describe, it, expect } from "vitest";
import { formatAcpError } from "./format-error";

describe("formatAcpError", () => {
  it("rewrites spawn 'No such file or directory' to a user-friendly message", () => {
    const msg = "Process spawn failed: No such file or directory (os error 2)";
    const result = formatAcpError(msg, "codex-acp");
    expect(result).toContain("codex-acp");
    expect(result).toContain("not found");
    expect(result).not.toContain("os error");
  });

  it("rewrites spawn 'permission denied' to a user-friendly message", () => {
    const msg = "Process spawn failed: Permission denied (os error 13)";
    const result = formatAcpError(msg, "claude-code-acp");
    expect(result).toContain("claude-code-acp");
    expect(result).toContain("permission");
  });

  it("passes through unknown errors unchanged", () => {
    const msg = "Protocol error: unexpected response";
    const result = formatAcpError(msg, "codex-acp");
    expect(result).toBe(msg);
  });
});
