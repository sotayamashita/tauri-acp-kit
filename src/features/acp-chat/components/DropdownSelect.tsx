import type { ReactNode } from "react";
import { useState, useRef, useCallback, useEffect } from "react";
import { useClickOutside } from "../hooks/useClickOutside";
import { ChevronDown } from "lucide-react";

interface DropdownSelectProps<T> {
  items: T[];
  selectedId: string | null;
  onSelect: (item: T) => void;
  renderLabel: (item: T) => ReactNode;
  getItemId: (item: T) => string;
  triggerLabel: string;
  disabled?: boolean;
  className?: string;
}

export function DropdownSelect<T>({
  items,
  selectedId,
  onSelect,
  renderLabel,
  getItemId,
  triggerLabel,
  disabled = false,
  className,
}: DropdownSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeDropdown = useCallback(() => setOpen(false), []);
  useClickOutside(wrapperRef, closeDropdown, open);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className={`acp-chat-dropdown-wrapper ${className ?? ""}`} ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        className="acp-chat-dropdown"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {triggerLabel}
        <ChevronDown size={12} />
      </button>
      <div
        className={`acp-chat-dropdown-menu ${open && items.length > 0 ? "open" : ""}`}
        role="menu"
      >
        {items.map((item) => {
          const id = getItemId(item);
          return (
            <button
              key={id}
              type="button"
              role="menuitem"
              className={`acp-chat-dropdown-item ${id === selectedId ? "selected" : ""}`}
              onClick={() => {
                onSelect(item);
                setOpen(false);
              }}
            >
              {renderLabel(item)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
