import type { ReactNode } from "react";
import { useState, useRef, useCallback } from "react";
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

  const closeDropdown = useCallback(() => setOpen(false), []);
  useClickOutside(wrapperRef, closeDropdown, open);

  return (
    <div className={`acp-chat-dropdown-wrapper ${className ?? ""}`} ref={wrapperRef}>
      <button
        type="button"
        className="acp-chat-dropdown"
        onClick={() => setOpen(!open)}
        disabled={disabled}
      >
        {triggerLabel}
        <ChevronDown size={12} />
      </button>
      {open && items.length > 0 && (
        <div className="acp-chat-dropdown-menu" role="listbox">
          {items.map((item) => {
            const id = getItemId(item);
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={id === selectedId}
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
      )}
    </div>
  );
}
