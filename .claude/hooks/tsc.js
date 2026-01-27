#!/usr/bin/env node
/**
 * @fileoverview PostToolUse hook for TypeScript type checking
 * @description Runs tsc --noEmit after editing .ts/.tsx files and reports type errors to Claude.
 *              Only errors related to the edited file are shown (max 10 lines).
 * @see https://www.typescriptlang.org/docs/handbook/compiler-options.html
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

/** @constant {string} Path to tsc binary */
const TSC_BIN = "./node_modules/.bin/tsc";

/** @constant {number} Maximum number of error lines to show */
const MAX_ERROR_LINES = 10;

/**
 * Find the nearest directory containing tsconfig.json
 * @param {string} filePath - Starting file path
 * @returns {string|null} Directory containing tsconfig.json or null
 */
function findTsConfigDir(filePath) {
  let dir = path.dirname(filePath);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "tsconfig.json"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

let data = "";
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", () => {
  /** @type {{ tool_input?: { file_path?: string } }} */
  const input = JSON.parse(data);
  const filePath = input.tool_input?.file_path;

  if (filePath && fs.existsSync(filePath)) {
    const tsConfigDir = findTsConfigDir(filePath);

    if (tsConfigDir) {
      try {
        execSync(`${TSC_BIN} --noEmit --pretty false 2>&1`, {
          cwd: tsConfigDir,
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (e) {
        // tsc returns non-zero exit code when there are type errors
        const output = e.stdout || "";
        // Filter errors related to the edited file only
        const lines = output
          .split("\n")
          .filter((line) => line.includes(filePath))
          .slice(0, MAX_ERROR_LINES);

        if (lines.length) {
          // Output to stderr so Claude receives the feedback
          console.error(`[tsc] Type errors in ${filePath}:\n${lines.join("\n")}`);
        }
      }
    }
  }

  // Return original input (required for hooks)
  console.log(data);
});
