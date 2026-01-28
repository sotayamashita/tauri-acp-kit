#!/usr/bin/env node
/**
 * @fileoverview PostToolUse hook for oxlint
 * @description Runs oxlint --fix on edited/written files and reports errors to Claude.
 *              Errors are output to stderr so Claude can see and fix them.
 * @see https://oxc.rs/docs/guide/usage/linter
 */
import { execSync } from "node:child_process";
import fs from "node:fs";

/** @constant {string} Path to oxlint binary */
const OXLINT_BIN = "./node_modules/.bin/oxlint";

/** @constant {RegExp} Pattern to match JS/TS files in src/ or packages/ */
const FILE_PATTERN = /\/(src|packages)\/.*\.(ts|tsx|js|jsx)$/;

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
