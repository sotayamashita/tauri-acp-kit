#!/usr/bin/env node
/**
 * @fileoverview PostToolUse hook for oxlint
 * @description Runs oxlint --fix on edited/written files and reports errors to Claude.
 *              Errors are output to stderr so Claude can see and fix them.
 * @see https://oxc.rs/docs/guide/usage/linter
 */
const { execSync } = require("child_process");
const fs = require("fs");

/** @constant {string} Path to oxlint binary */
const OXLINT_BIN = "./node_modules/.bin/oxlint";

let data = "";
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", () => {
  /** @type {{ tool_input?: { file_path?: string } }} */
  const input = JSON.parse(data);
  const filePath = input.tool_input?.file_path;

  if (filePath && fs.existsSync(filePath)) {
    try {
      execSync(`${OXLINT_BIN} --fix "${filePath}"`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (e) {
      // oxlint returns non-zero exit code when there are unfixable errors
      const output = e.stdout || e.stderr || "";
      if (output.trim()) {
        // Output to stderr so Claude receives the feedback
        console.error(`[oxlint] ${filePath}:\n${output}`);
      }
    }
  }

  // Return original input (required for hooks)
  console.log(data);
});
