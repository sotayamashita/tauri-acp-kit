import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBar } from "./StatusBar";

describe("StatusBar", () => {
  it("renders sr-only 'Ready' text when status is ready", () => {
    render(<StatusBar connectionStatus="ready" />);
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("renders 'Connecting…' when status is connecting", () => {
    render(<StatusBar connectionStatus="connecting" />);
    expect(screen.getByText("Connecting…")).toBeInTheDocument();
  });

  it("renders 'Disconnected' when status is error", () => {
    render(<StatusBar connectionStatus="error" />);
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
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
