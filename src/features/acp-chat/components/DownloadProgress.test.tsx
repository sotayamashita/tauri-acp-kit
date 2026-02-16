import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DownloadProgress } from "./DownloadProgress";
import type { DownloadProgress as DownloadProgressType } from "tauri-acp";

function makeProgress(overrides: Partial<DownloadProgressType> = {}): DownloadProgressType {
  return {
    agentId: "codex-acp",
    bytesDownloaded: 0,
    totalBytes: null,
    phase: "resolving",
    ...overrides,
  };
}

describe("DownloadProgress", () => {
  it("renders resolving phase", () => {
    render(<DownloadProgress progress={makeProgress({ phase: "resolving" })} label="Codex" />);
    expect(screen.getByText("Setting up Codex")).toBeInTheDocument();
    expect(screen.getByText("Resolving latest version…")).toBeInTheDocument();
  });

  it("renders downloading phase with percentage", () => {
    render(
      <DownloadProgress
        progress={makeProgress({
          phase: "downloading",
          bytesDownloaded: 5000000,
          totalBytes: 20000000,
        })}
        label="Codex"
      />,
    );
    expect(screen.getByText("Downloading… 25%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders downloading phase without total bytes", () => {
    render(
      <DownloadProgress
        progress={makeProgress({ phase: "downloading", bytesDownloaded: 1000, totalBytes: null })}
        label="Codex"
      />,
    );
    expect(screen.getByText("Downloading…")).toBeInTheDocument();
  });

  it("renders extracting phase", () => {
    render(<DownloadProgress progress={makeProgress({ phase: "extracting" })} label="Codex" />);
    expect(screen.getByText("Extracting…")).toBeInTheDocument();
  });

  it("renders complete phase", () => {
    render(<DownloadProgress progress={makeProgress({ phase: "complete" })} label="Codex" />);
    expect(screen.getByText("Download complete")).toBeInTheDocument();
  });

  it("renders failed phase", () => {
    render(<DownloadProgress progress={makeProgress({ phase: "failed" })} label="Codex" />);
    expect(screen.getByText("Download failed")).toBeInTheDocument();
  });

  it("has accessible status role", () => {
    render(<DownloadProgress progress={makeProgress()} label="Codex" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("does not show progress bar during resolving", () => {
    render(<DownloadProgress progress={makeProgress({ phase: "resolving" })} label="Codex" />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
