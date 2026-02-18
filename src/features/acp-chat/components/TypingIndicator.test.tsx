import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TypingIndicator } from "./TypingIndicator";

describe("TypingIndicator", () => {
  it("renders exactly 3 dots", () => {
    render(<TypingIndicator />);
    const dots = document.querySelectorAll(".typing-dot");
    expect(dots).toHaveLength(3);
  });

  it("has container with class typing-indicator", () => {
    render(<TypingIndicator />);
    const container = document.querySelector(".typing-indicator");
    expect(container).toBeInTheDocument();
  });
});
