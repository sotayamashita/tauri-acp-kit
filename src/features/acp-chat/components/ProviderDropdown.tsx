import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProviderConfig } from "../providers";

interface ProviderDropdownProps {
  providers: ProviderConfig[];
  selectedProviderId?: string;
  onSelect: (providerId: string) => void;
}

export function ProviderDropdown({
  providers,
  selectedProviderId,
  onSelect,
}: ProviderDropdownProps) {
  const selectedLabel = providers.find((p) => p.id === selectedProviderId)?.label ?? "Provider";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-1 text-xs font-medium">
            {selectedLabel}
            <ChevronDown data-icon="inline-end" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={selectedProviderId ?? ""}
          onValueChange={(value) => {
            if (value) onSelect(value);
          }}
        >
          {providers.map((p) => (
            <DropdownMenuRadioItem key={p.id} value={p.id}>
              {p.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
