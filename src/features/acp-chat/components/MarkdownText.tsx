import type { Components } from "react-markdown";
import { memo, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";

// Custom light theme matching the Zed AI style
const customTheme: Record<string, React.CSSProperties> = {
  'code[class*="language-"]': {
    color: "#2D2D2D",
    background: "none",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "13px",
    textAlign: "left",
    whiteSpace: "pre",
    wordSpacing: "normal",
    wordBreak: "normal",
    wordWrap: "normal",
    lineHeight: "1.5",
    tabSize: 2,
  },
  'pre[class*="language-"]': {
    color: "#2D2D2D",
    background: "#E5DFD0",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "13px",
    textAlign: "left",
    whiteSpace: "pre",
    wordSpacing: "normal",
    wordBreak: "normal",
    wordWrap: "normal",
    lineHeight: "1.5",
    tabSize: 2,
    overflow: "auto",
    padding: "12px 16px",
    margin: 0,
  },
  comment: { color: "#8B7355" },
  prolog: { color: "#8B7355" },
  doctype: { color: "#8B7355" },
  cdata: { color: "#8B7355" },
  punctuation: { color: "#5C5C5C" },
  property: { color: "#8B5555" },
  tag: { color: "#8B5555" },
  boolean: { color: "#8B5555" },
  number: { color: "#8B5555" },
  constant: { color: "#8B5555" },
  symbol: { color: "#8B5555" },
  deleted: { color: "#8B5555" },
  selector: { color: "#4A7C4E" },
  "attr-name": { color: "#4A7C4E" },
  string: { color: "#4A7C4E" },
  char: { color: "#4A7C4E" },
  builtin: { color: "#4A7C4E" },
  inserted: { color: "#4A7C4E" },
  operator: { color: "#5C5C5C" },
  entity: { color: "#5C5C5C", cursor: "help" },
  url: { color: "#5C5C5C" },
  atrule: { color: "#6B5C8B" },
  "attr-value": { color: "#6B5C8B" },
  keyword: { color: "#6B5C8B" },
  function: { color: "#2D5B8B" },
  "class-name": { color: "#2D5B8B" },
  regex: { color: "#8B7355" },
  important: { color: "#8B7355", fontWeight: "bold" },
  variable: { color: "#8B7355" },
  bold: { fontWeight: "bold" },
  italic: { fontStyle: "italic" },
};

interface CodeBlockProps {
  language: string;
  children: string;
}

function CodeBlock({ language, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  return (
    <div className="code-block">
      <div className="code-header">
        <span className="code-language">{language || "text"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="code-copy-button"
          title={copied ? "Copied!" : "Copy"}
        >
          {copied ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="14"
              height="14"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="14"
              height="14"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          )}
        </button>
      </div>
      <SyntaxHighlighter style={customTheme} language={language || "text"} PreTag="div">
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

// Hoisted to module level to avoid re-creation on every render (rendering-hoist-jsx)
const REMARK_PLUGINS = [remarkGfm];

const MARKDOWN_COMPONENTS: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const isInline = !match && !className;

    if (isInline) {
      return (
        <code className="inline-code" {...props}>
          {children}
        </code>
      );
    }

    return <CodeBlock language={match?.[1] || ""} children={String(children).replace(/\n$/, "")} />;
  },
  p({ children }) {
    return <p className="markdown-paragraph">{children}</p>;
  },
  ul({ children }) {
    return <ul className="markdown-list">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="markdown-list markdown-list-ordered">{children}</ol>;
  },
  li({ children }) {
    return <li className="markdown-list-item">{children}</li>;
  },
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="markdown-link">
        {children}
      </a>
    );
  },
  blockquote({ children }) {
    return <blockquote className="markdown-blockquote">{children}</blockquote>;
  },
  table({ children }) {
    return (
      <div className="markdown-table-wrapper">
        <table className="markdown-table">{children}</table>
      </div>
    );
  },
};

interface MarkdownTextProps {
  content: string;
}

export const MarkdownText = memo(function MarkdownText({ content }: MarkdownTextProps) {
  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
      {content}
    </ReactMarkdown>
  );
});
