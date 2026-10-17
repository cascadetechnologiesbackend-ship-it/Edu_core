"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Search,
  GraduationCap,
  BookOpen,
  User,
  PlusCircle,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { searchEverything, type SearchResultItem } from "@/app/(admin)/actions/searchEverything";
import { cn } from "@/lib/utils";

export interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: CommandPaletteProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isPending, startTransition] = useTransition();

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setOpen = (open: boolean) => {
    if (isControlled && setControlledOpen) {
      setControlledOpen(open);
    } else {
      setInternalOpen(open);
    }
  };

  // Global keydown: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !isOpen)) {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        setOpen(!isOpen);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Initial load or search debounced
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      startTransition(async () => {
        const items = await searchEverything(query);
        setResults(items);
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [isOpen, query]);

  if (!isOpen) return null;

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const jumpToItems = results.filter((r) => r.category === "Jump to");
  const actionItems = results.filter((r) => r.category === "Actions");

  const getItemIcon = (item: SearchResultItem) => {
    if (item.badge === "Class") return <GraduationCap className="w-4 h-4 text-blue-500" />;
    if (item.badge === "Subject") return <BookOpen className="w-4 h-4 text-purple-500" />;
    if (item.badge === "Student 360") return <User className="w-4 h-4 text-emerald-500" />;
    if (item.badge === "Setup") return <PlusCircle className="w-4 h-4 text-primary" />;
    if (item.badge === "Matrix") return <Layers className="w-4 h-4 text-indigo-500" />;
    return <Sparkles className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          label="Global Command Palette"
          className="w-full flex flex-col focus:outline-none"
        >
          {/* Input Header */}
          <div className="flex items-center px-4 py-3.5 border-b border-gray-100 dark:border-slate-800 gap-2.5">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search classes, subjects, students or run actions..."
              className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
              autoFocus
            />
            {isPending && (
              <span className="text-[10px] text-gray-400 animate-pulse">Searching…</span>
            )}
            <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-400">
              ESC
            </kbd>
          </div>

          {/* Results List */}
          <Command.List className="max-h-80 overflow-y-auto p-2 space-y-2">
            <Command.Empty className="py-8 text-center text-xs text-gray-400">
              No matching classes, subjects, students or actions found.
            </Command.Empty>

            {/* Jump To Group */}
            {jumpToItems.length > 0 && (
              <Command.Group
                heading="Jump to"
                className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 py-1"
              >
                {jumpToItems.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`${item.title} ${item.subtitle || ""}`}
                    onSelect={() => handleSelect(item.href)}
                    className="p-2.5 rounded-xl flex items-center justify-between text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition aria-selected:bg-gray-100 dark:aria-selected:bg-slate-800 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 shrink-0">
                        {getItemIcon(item)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 dark:text-white truncate">
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div className="text-[11px] text-gray-400 truncate">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {item.badge && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300">
                          {item.badge}
                        </span>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary transition" />
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Actions Group */}
            {actionItems.length > 0 && (
              <Command.Group
                heading="Actions"
                className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 py-1"
              >
                {actionItems.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`${item.title} ${item.subtitle || ""}`}
                    onSelect={() => handleSelect(item.href)}
                    className="p-2.5 rounded-xl flex items-center justify-between text-xs cursor-pointer hover:bg-blue-50/60 dark:hover:bg-slate-800 transition aria-selected:bg-blue-50/60 dark:aria-selected:bg-slate-800 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-primary dark:text-blue-400 shrink-0">
                        {getItemIcon(item)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 dark:text-white truncate">
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div className="text-[11px] text-gray-400 truncate">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-primary dark:text-blue-400 shrink-0">
                      Run →
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-900/60 flex items-center justify-between text-[11px] text-gray-400">
            <span>Fast navigation across school data</span>
            <div className="flex items-center gap-2">
              <span>Navigate: ↑↓</span>
              <span>Select: ↵</span>
            </div>
          </div>
        </Command>
      </div>
    </div>
  );
}

export default CommandPalette;
