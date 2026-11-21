"use client";

import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AppModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode | undefined;
  description?: React.ReactNode | undefined;
  size?: ("sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full") | undefined;
  children: React.ReactNode;
  footer?: React.ReactNode | undefined;
  className?: string | undefined;
  contentClassName?: string | undefined;
}

const sizeClasses: Record<NonNullable<AppModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  "2xl": "max-w-3xl",
  "3xl": "max-w-4xl",
  "4xl": "max-w-5xl",
  "5xl": "max-w-6xl",
  full: "max-w-7xl",
};

export function AppModal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
  className,
  contentClassName,
}: AppModalProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 overflow-y-auto">
          <DialogPrimitive.Content
            className={cn(
              "relative w-full bg-card border border-border/50 shadow-level-3 p-5 sm:p-6 flex flex-col max-h-[88vh] overflow-hidden focus:outline-none transition-all duration-200",
              // Mobile bottom-sheet pattern, desktop centered modal
              "max-sm:rounded-t-3xl max-sm:rounded-b-none max-sm:max-w-none max-sm:border-b-0 max-sm:animate-sheet-up",
              "sm:rounded-2xl sm:my-auto sm:data-[state=open]:animate-fade-scale-in",
              sizeClasses[size],
              className
            )}
          >
            {/* Mobile Sheet Drag Handle */}
            <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 mx-auto mb-3 sm:hidden shrink-0" aria-hidden="true" />

            {/* Header */}
            {(title || description) && (
              <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-3.5 mb-4 shrink-0">
                <div className="space-y-1 min-w-0 pr-2">
                  {title && (
                    <DialogPrimitive.Title className="text-base sm:text-lg font-semibold text-foreground tracking-tight leading-tight">
                      {title}
                    </DialogPrimitive.Title>
                  )}
                  {description && (
                    <DialogPrimitive.Description className="text-xs text-muted-foreground">
                      {description}
                    </DialogPrimitive.Description>
                  )}
                </div>
                <DialogPrimitive.Close
                  type="button"
                  onClick={onClose}
                  className="rounded-xl p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition -mr-1 -mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </DialogPrimitive.Close>
              </div>
            )}

            {/* Content Body */}
            <div className={cn("flex-1 overflow-y-auto pr-0.5", contentClassName)}>
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="border-t border-border/40 pt-3.5 mt-4 flex items-center justify-end gap-2.5 shrink-0">
                {footer}
              </div>
            )}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export default AppModal;
