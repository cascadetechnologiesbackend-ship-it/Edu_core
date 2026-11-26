"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Command,
  Printer,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VoucherModal } from "./VoucherModal";

export interface QuickActionItem {
  id: string;
  label: string;
  icon?: React.ComponentType<any>;
  shortcut?: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "outline" | "success" | "danger";
  rolesAllowed?: string[];
}

export interface QuickActionBarProps {
  actions?: QuickActionItem[];
  userRole?: string;
  onOpenCommandPalette?: () => void;
  onOpenCollect?: () => void;
  onOpenExpense?: () => void;
  onOpenIncome?: () => void;
  onOpenVoucher?: () => void;
  onPrintLastReceipt?: () => void;
  onOpenBRS?: () => void;
  onExport?: () => void;
  className?: string;
}

export function QuickActionBar({
  actions,
  userRole = "ACCOUNTANT",
  onOpenCommandPalette,
  onOpenCollect,
  onOpenExpense,
  onOpenIncome,
  onOpenVoucher,
  onPrintLastReceipt,
  onOpenBRS,
  onExport,
  className,
}: QuickActionBarProps) {
  const router = useRouter();
  const [internalVoucherOpen, setInternalVoucherOpen] = useState(false);

  const handleOpenVoucher = () => {
    if (onOpenVoucher) {
      onOpenVoucher();
    } else if (onOpenIncome) {
      onOpenIncome();
    } else {
      setInternalVoucherOpen(true);
    }
  };

  const handlePrintLastReceipt = () => {
    if (onPrintLastReceipt) {
      onPrintLastReceipt();
    } else {
      router.push("/school/transactions");
    }
  };

  const handleOpenBRS = () => {
    if (onOpenBRS) {
      onOpenBRS();
    } else {
      router.push("/school/accounts/bank-reconciliation");
    }
  };

  // AM-03: Default actions for ACCOUNTANT role must be exactly:
  // 1. "Misc income voucher" (triggers onOpenVoucher || onOpenIncome || internal VoucherModal)
  // 2. "Print last receipt" (triggers onPrintLastReceipt || navigates to /school/transactions)
  // 3. "Open BRS preview" (triggers onOpenBRS || navigates to /school/accounts/bank-reconciliation)
  const accountantDefaultActions: QuickActionItem[] = [
    {
      id: "voucher",
      label: "Misc income voucher",
      icon: ArrowDownRight,
      shortcut: "V",
      onClick: handleOpenVoucher,
      variant: "success",
      rolesAllowed: ["ACCOUNTANT", "SUPER_ADMIN", "SCHOOL_ADMIN"],
    },
    {
      id: "print-receipt",
      label: "Print last receipt",
      icon: Printer,
      shortcut: "P",
      onClick: handlePrintLastReceipt,
      variant: "outline",
      rolesAllowed: ["ACCOUNTANT", "SUPER_ADMIN", "SCHOOL_ADMIN"],
    },
    {
      id: "brs-preview",
      label: "Open BRS preview",
      icon: ArrowLeftRight,
      shortcut: "B",
      onClick: handleOpenBRS,
      variant: "secondary",
      rolesAllowed: ["ACCOUNTANT", "SUPER_ADMIN", "SCHOOL_ADMIN"],
    },
  ];

  // Admin default actions if not in ACCOUNTANT mode
  const adminDefaultActions: QuickActionItem[] = [
    ...(onOpenCollect
      ? [
          {
            id: "collect",
            label: "Collect Fee",
            icon: CreditCard,
            shortcut: "C",
            onClick: onOpenCollect,
            variant: "primary" as const,
            rolesAllowed: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"],
          },
        ]
      : []),
    ...(onOpenIncome
      ? [
          {
            id: "income",
            label: "+ Income",
            icon: ArrowDownRight,
            shortcut: "I",
            onClick: onOpenIncome,
            variant: "success" as const,
            rolesAllowed: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"],
          },
        ]
      : []),
    ...(onOpenExpense
      ? [
          {
            id: "expense",
            label: "+ Expense",
            icon: ArrowUpRight,
            shortcut: "E",
            onClick: onOpenExpense,
            variant: "secondary" as const,
            rolesAllowed: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
          },
        ]
      : []),
    ...(onExport
      ? [
          {
            id: "export",
            label: "Export",
            icon: Download,
            shortcut: "X",
            onClick: onExport,
            variant: "outline" as const,
            rolesAllowed: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
          },
        ]
      : []),
  ];

  const defaultActions =
    userRole === "ACCOUNTANT" ? accountantDefaultActions : adminDefaultActions;

  const items = actions || defaultActions;

  // Filter actions allowed by role
  const allowedItems = items.filter(
    (item) => !item.rolesAllowed || item.rolesAllowed.includes(userRole)
  );

  return (
    <>
      <div className={cn("flex items-center gap-2 flex-wrap", className)}>
        {allowedItems.map((item) => {
          const Icon = item.icon || Plus;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl text-xs md:text-sm font-semibold transition-all duration-150 active:scale-95 shadow-sm",
                item.variant === "primary" &&
                  "bg-[#248A3D] hover:bg-[#1f7232] dark:bg-[#30D158] dark:hover:bg-[#28b84d] text-white dark:text-black shadow-sm",
                item.variant === "success" &&
                  "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20",
                item.variant === "secondary" &&
                  "bg-muted/60 hover:bg-card text-foreground dark:bg-muted dark:hover:bg-muted/80",
                item.variant === "danger" &&
                  "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20",
                (!item.variant || item.variant === "outline") &&
                  "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 dark:bg-card dark:hover:bg-muted/60 dark:text-foreground dark:border-border/40"
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
              {item.shortcut && (
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/10 dark:bg-white/10 opacity-80">
                  {item.shortcut}
                </span>
              )}
            </button>
          );
        })}

        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="inline-flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-xl text-xs md:text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-muted/40 dark:hover:bg-muted dark:text-muted-foreground transition-all border border-transparent dark:border-border/40/50"
            title="Open Command Palette (Cmd+K)"
          >
            <Command className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Quick Jump</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-card text-gray-500 rounded border border-border/40">
              ⌘K
            </kbd>
          </button>
        )}
      </div>

      <VoucherModal
        open={internalVoucherOpen}
        onClose={() => setInternalVoucherOpen(false)}
        isIncome={true}
        onSuccess={() => {
          setInternalVoucherOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
