import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MarkdownText } from "./MarkdownText";

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("MarkdownText", () => {
  it("renders plain text", () => {
    render(<MarkdownText content="Hello world" />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders a heading", () => {
    render(<MarkdownText content="# Title" />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Title");
  });

  it("renders inline code with inline-code class", () => {
    render(<MarkdownText content="Use `foo` here" />);
    const code = document.querySelector("code.inline-code");
    expect(code).toBeInTheDocument();
    expect(code!.textContent).toBe("foo");
  });

  it("renders a fenced code block with language label", () => {
    const content = "```js\nconsole.log('hi')\n```";
    render(<MarkdownText content={content} />);
    expect(screen.getByText("js")).toBeInTheDocument();
    // SyntaxHighlighter splits code into token spans, so use textContent on the container
    const codeBlock = document.querySelector(".code-block");
    expect(codeBlock).toBeInTheDocument();
    expect(codeBlock!.textContent).toContain("console.log('hi')");
  });

  it("copy button copies code to clipboard", async () => {
    const content = "```js\nconst x = 1\n```";
    render(<MarkdownText content={content} />);
    const copyBtn = screen.getByTitle("Copy");
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("const x = 1");
    });
  });

  it("copy button shows check icon after copying then reverts", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const content = "```js\nconst x = 1\n```";
    render(<MarkdownText content={content} />);

    await act(async () => {
      fireEvent.click(screen.getByTitle("Copy"));
    });

    expect(screen.getByTitle("Copied!")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTitle("Copy")).toBeInTheDocument();

    vi.useRealTimers();
  });
});
