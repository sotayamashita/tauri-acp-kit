#!/usr/bin/env node
/**
 * @fileoverview PostToolUse hook for oxfmt
 * @description Runs oxfmt on edited/written files to auto-format.
 *              Errors are output to stderr so Claude can see and fix them.
 * @see https://oxc.rs/docs/guide/usage/formatter
 */
import { execSync } from "node:child_process";
import fs from "node:fs";

/** @constant {string} Path to oxfmt binary */
const OXFMT_BIN = "./node_modules/.bin/oxfmt";

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
      execSync(`${OXFMT_BIN} --write "${filePath}"`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (e) {
      const output = e.stdout || e.stderr || "";
      if (output.trim()) {
        // Output to stderr so Claude receives the feedback
        console.error(`[oxfmt] ${filePath}:\n${output}`);
      }
    }
  }

  // Return original input (required for hooks)
  console.log(data);
});
