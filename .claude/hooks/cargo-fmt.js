#!/usr/bin/env node
/**
 * @fileoverview PostToolUse hook for cargo fmt
 * @description Runs cargo fmt on edited/written Rust files to auto-format.
 *              Errors are output to stderr so Claude can see and fix them.
 * @see https://doc.rust-lang.org/cargo/commands/cargo-fmt.html
 */
import { execSync } from "node:child_process";
import fs from "node:fs";

/** @constant {RegExp} Pattern to match Rust files in src-tauri/ or crates/ */
const FILE_PATTERN = /\/(src-tauri|crates)\/.*\.rs$/;

let data = "";
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", () => {
  /** @type {{ tool_input?: { file_path?: string } }} */
  const input = JSON.parse(data);
  const filePath = input.tool_input?.file_path;

  // Skip if file doesn't match pattern
  if (!filePath || !FILE_PATTERN.test(filePath)) {
    console.log(data);
    return;
  }

  if (fs.existsSync(filePath)) {
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
