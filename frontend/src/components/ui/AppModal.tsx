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
  size?: ("sm" | "md" | "lg" | "xl") | undefined;
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
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          <DialogPrimitive.Content
            className={cn(
              "relative w-full rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-2xl p-5 md:p-6 flex flex-col max-h-[90vh] overflow-hidden my-auto focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200",
              sizeClasses[size],
              className
            )}
          >
            {/* Header */}
            {(title || description) && (
              <div className="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-slate-800/80 pb-3.5 mb-4 shrink-0">
                <div className="space-y-1 min-w-0 pr-2">
                  {title && (
                    <DialogPrimitive.Title className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight">
                      {title}
                    </DialogPrimitive.Title>
                  )}
                  {description && (
                    <DialogPrimitive.Description className="text-xs text-gray-500 dark:text-gray-400">
                      {description}
                    </DialogPrimitive.Description>
                  )}
                </div>
                <DialogPrimitive.Close
                  type="button"
                  onClick={onClose}
                  className="rounded-xl p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition -mr-1 -mt-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
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
              <div className="border-t border-gray-100 dark:border-slate-800/80 pt-3.5 mt-4 flex items-center justify-end gap-2.5 shrink-0">
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
