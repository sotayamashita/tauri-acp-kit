#!/usr/bin/env node
/**
 * @fileoverview PostToolUse hook for cargo fmt
 * @description Runs cargo fmt on edited/written Rust files to auto-format.
 *              Errors are output to stderr so Claude can see and fix them.
 * @see https://doc.rust-lang.org/cargo/commands/cargo-fmt.html
 */
const { execSync } = require("child_process");
const fs = require("fs");

let data = "";
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", () => {
  /** @type {{ tool_input?: { file_path?: string } }} */
  const input = JSON.parse(data);
  const filePath = input.tool_input?.file_path;

  if (filePath && fs.existsSync(filePath)) {
    try {
      execSync(`cargo fmt -- "${filePath}"`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (e) {
      const output = e.stdout || e.stderr || "";
      if (output.trim()) {
        // Output to stderr so Claude receives the feedback
        console.error(`[cargo fmt] ${filePath}:\n${output}`);
      }
    }
  }

  // Return original input (required for hooks)
  console.log(data);
});
