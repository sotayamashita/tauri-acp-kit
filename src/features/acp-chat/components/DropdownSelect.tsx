import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DropdownSelectProps<T> {
  items: T[];
  selectedId: string | null;
  onSelect: (item: T) => void;
  renderLabel: (item: T) => ReactNode;
  getItemId: (item: T) => string;
  triggerLabel: string;
  disabled?: boolean;
}

export function DropdownSelect<T>({
  items,
  selectedId,
  onSelect,
  renderLabel,
  getItemId,
  triggerLabel,
  disabled = false,
}: DropdownSelectProps<T>) {
  const handleValueChange = (value: string | null) => {
    if (!value) return;
    const item = items.find((i) => getItemId(i) === value);
    if (item) onSelect(item);
  };

  return (
    <Select value={selectedId ?? undefined} onValueChange={handleValueChange} disabled={disabled}>
      <SelectTrigger
        size="sm"
        className="border-0 bg-transparent text-xs text-muted-foreground shadow-none"
      >
        <SelectValue placeholder={triggerLabel} />
      </SelectTrigger>
      <SelectContent
        side="top"
        align="start"
        className="w-auto min-w-44"
        alignItemWithTrigger={false}
      >
        <SelectGroup>
          {items.map((item) => {
            const id = getItemId(item);
            return (
              <SelectItem key={id} value={id}>
                {renderLabel(item)}
              </SelectItem>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
