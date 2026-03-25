import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThinkingBlock } from "./ThinkingBlock";

describe("ThinkingBlock", () => {
  it("renders 'Thinking' as summary text", () => {
    render(<ThinkingBlock text="some reasoning" />);
    const summary = screen.getByText("Thinking");
    expect(summary).toBeInTheDocument();
    expect(summary.tagName.toLowerCase()).toBe("summary");
  });

  it("details element is closed by default", () => {
    render(<ThinkingBlock text="reasoning" />);
    const details = document.querySelector("details.thinking-block");
    expect(details).toBeInTheDocument();
    expect(details!.hasAttribute("open")).toBe(false);
  });

  it("renders content text inside the block", () => {
    render(<ThinkingBlock text="deep reasoning here" />);
    expect(screen.getByText("deep reasoning here")).toBeInTheDocument();
  });
});
