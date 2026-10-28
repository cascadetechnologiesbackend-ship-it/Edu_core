"use client";

import React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreVertical } from "lucide-react";

export interface ActionMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  isDestructive?: boolean;
  disabled?: boolean;
}

export interface ActionMenuProps {
  items: ActionMenuItem[];
  triggerLabel?: string;
  className?: string;
}

export function ActionMenu({
  items,
  triggerLabel = "Open actions menu",
  className = "",
}: ActionMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={triggerLabel}
          className={`h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${className}`}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-[160px] bg-popover text-popover-foreground border border-border rounded-xl shadow-lg p-1 animate-in fade-in-80 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
        >
          {items.map((item, idx) => (
            <DropdownMenu.Item
              key={idx}
              disabled={item.disabled ?? false}
              onSelect={item.onClick}
              className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg cursor-pointer outline-none transition-colors select-none ${
                item.isDestructive
                  ? "text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
                  : "text-foreground hover:bg-accent focus:bg-accent"
              } ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {item.icon && <span className="h-3.5 w-3.5 shrink-0">{item.icon}</span>}
              <span>{item.label}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
