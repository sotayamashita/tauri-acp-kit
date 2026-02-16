import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useClickOutside } from "./useClickOutside";

function createRef(element: HTMLElement): React.RefObject<HTMLElement> {
  return { current: element };
}

describe("useClickOutside", () => {
  it("calls callback on outside click", () => {
    const callback = vi.fn();
    const element = document.createElement("div");
    document.body.appendChild(element);
    const ref = createRef(element);

    renderHook(() => useClickOutside(ref, callback));

    const outsideEvent = new MouseEvent("mousedown", { bubbles: true });
    document.body.dispatchEvent(outsideEvent);

    expect(callback).toHaveBeenCalledOnce();
    document.body.removeChild(element);
  });

  it("does not call callback on inside click", () => {
    const callback = vi.fn();
    const element = document.createElement("div");
    const child = document.createElement("span");
    element.appendChild(child);
    document.body.appendChild(element);
    const ref = createRef(element);

    renderHook(() => useClickOutside(ref, callback));

    const insideEvent = new MouseEvent("mousedown", { bubbles: true });
    child.dispatchEvent(insideEvent);

    expect(callback).not.toHaveBeenCalled();
    document.body.removeChild(element);
  });

  it("does not listen when active is false", () => {
    const callback = vi.fn();
    const element = document.createElement("div");
    document.body.appendChild(element);
    const ref = createRef(element);

    renderHook(() => useClickOutside(ref, callback, false));

    const outsideEvent = new MouseEvent("mousedown", { bubbles: true });
    document.body.dispatchEvent(outsideEvent);

    expect(callback).not.toHaveBeenCalled();
    document.body.removeChild(element);
  });
});
