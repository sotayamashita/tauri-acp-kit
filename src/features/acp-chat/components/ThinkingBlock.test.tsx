import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThinkingBlock } from "./ThinkingBlock";

describe("ThinkingBlock", () => {
  it("renders 'Thinking' as trigger text", () => {
    render(<ThinkingBlock text="some reasoning" />);
    expect(screen.getByText("Thinking")).toBeInTheDocument();
  });

  it("content is hidden by default", () => {
    render(<ThinkingBlock text="deep reasoning here" />);
    expect(screen.queryByText("deep reasoning here")).not.toBeInTheDocument();
  });

  it("shows content when trigger is clicked", () => {
    render(<ThinkingBlock text="deep reasoning here" />);
    fireEvent.click(screen.getByText("Thinking"));
    expect(screen.getByText("deep reasoning here")).toBeInTheDocument();
  });
});
