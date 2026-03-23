import { Plus } from "lucide-react";
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
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="acp-chat-header-btn"
        title="Switch provider"
      >
        <Plus size={16} />
      </button>
      {isOpen && (
        <div className="acp-chat-dropdown-menu acp-chat-provider-dropdown" role="listbox">
          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={p.id === selectedProviderId}
              className={`acp-chat-dropdown-item ${p.id === selectedProviderId ? "selected" : ""}`}
              onClick={() => onSelect(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
