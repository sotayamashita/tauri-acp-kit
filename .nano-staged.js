export default {
  "*": ["secretlint", "oxfmt --no-error-on-unmatched-pattern"],
  "*.{ts,tsx}": (api) => [
    `oxlint --fix ${api.filenames.join(" ")}`,
    "pnpm typecheck",
    `vitest related --run ${api.filenames.join(" ")}`,
  ],
};
