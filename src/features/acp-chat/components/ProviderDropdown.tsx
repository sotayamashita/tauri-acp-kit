import { ChevronDown } from "lucide-react";
import type { ProviderConfig } from "../providers";

interface ProviderDropdownProps {
  providers: ProviderConfig[];
  selectedProviderId?: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (providerId: string) => void;
}

export function ProviderDropdown({
  providers,
  selectedProviderId,
  isOpen,
  onToggle,
  onSelect,
}: ProviderDropdownProps) {
  const selectedLabel = providers.find((p) => p.id === selectedProviderId)?.label ?? "Provider";

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="acp-chat-provider-btn"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Switch provider, current: ${selectedLabel}`}
      >
        {selectedLabel}
        <ChevronDown size={14} />
      </button>
      <div
        className={`acp-chat-dropdown-menu acp-chat-provider-dropdown ${isOpen ? "open" : ""}`}
        role="menu"
      >
        {providers.map((p) => (
          <button
            key={p.id}
            type="button"
            role="menuitem"
            className={`acp-chat-dropdown-item ${p.id === selectedProviderId ? "selected" : ""}`}
            onClick={() => onSelect(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </>
  );
}
