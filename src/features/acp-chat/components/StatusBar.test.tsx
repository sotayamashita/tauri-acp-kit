import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBar } from "./StatusBar";

describe("StatusBar", () => {
  it("renders green dot and sr-only 'Ready' text when status is ready", () => {
    render(<StatusBar connectionStatus="ready" />);
    const dot = document.querySelector(".acp-chat-status-dot.ready");
    expect(dot).toBeInTheDocument();
    const srOnly = document.querySelector(".sr-only");
    expect(srOnly).toBeInTheDocument();
    expect(srOnly).toHaveTextContent("Ready");
  });

  it("renders 'Connecting…' when status is connecting", () => {
    render(<StatusBar connectionStatus="connecting" />);
    expect(screen.getByText("Connecting…")).toBeInTheDocument();
  });

  it("renders 'Disconnected' with error dot when status is error", () => {
    render(<StatusBar connectionStatus="error" />);
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
    const dot = document.querySelector(".acp-chat-status-dot.error");
    expect(dot).toBeInTheDocument();
  });

  it("renders 'Downloading…' when status is downloading", () => {
    render(<StatusBar connectionStatus="downloading" />);
    expect(screen.getByText("Downloading…")).toBeInTheDocument();
  });

  it("renders 'Generating…' when status is generating", () => {
    render(<StatusBar connectionStatus="generating" />);
    expect(screen.getByText("Generating…")).toBeInTheDocument();
  });

  it("has role=status and aria-live=polite", () => {
    render(<StatusBar connectionStatus="ready" />);
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("aria-live", "polite");
  });
});
