"use client";

import React, { useState, useRef, useEffect, useMemo, useId } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, X, Search, Plus } from "lucide-react";

export interface ComboboxOption {
  value: string;
  label: string;
  labelHi?: string | undefined;
  group?: string | undefined;
  description?: string | undefined;
  badge?: string | undefined;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  searchPlaceholder?: string | undefined;
  emptyText?: string | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  allowCreate?: boolean | undefined;
  createLabel?: string | undefined;
  onCreateNew?: ((searchQuery: string) => void) | undefined;
  activeGroup?: string | undefined;
  showAllGroupsToggle?: boolean | undefined;
  isHindi?: boolean | undefined;
  clearable?: boolean | undefined;
  id?: string | undefined;
  name?: string | undefined;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Type to search...",
  emptyText = "No results found",
  disabled = false,
  className = "",
  allowCreate = false,
  createLabel = "Create new",
  onCreateNew,
  activeGroup,
  showAllGroupsToggle = false,
  isHindi = false,
  clearable = true,
  id,
  name,
}: ComboboxProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Fix mouse-wheel scrolling when rendered inside Radix Dialog / AppModal modals
  useEffect(() => {
    if (!open) return;
    const contentEl = contentRef.current;
    const listEl = listRef.current;
    if (!contentEl || !listEl) return;

    const handleWheel = (e: WheelEvent) => {
      // Prevent parent dialog / react-remove-scroll from intercepting the wheel event
      e.stopPropagation();

      const { scrollTop, scrollHeight, clientHeight } = listEl;
      const canScrollDown = e.deltaY > 0 && scrollTop + clientHeight < scrollHeight;
      const canScrollUp = e.deltaY < 0 && scrollTop > 0;

      if (canScrollDown || canScrollUp) {
        e.preventDefault();
        listEl.scrollTop += e.deltaY;
      }
    };

    contentEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      contentEl.removeEventListener("wheel", handleWheel);
    };
  }, [open]);

  // Group filtering
  const visibleOptions = useMemo(() => {
    let list = options;
    if (activeGroup && !showAll) {
      list = list.filter((opt) => !opt.group || opt.group === activeGroup);
    }
    if (!query.trim()) return list;

    const q = query.toLowerCase().trim();
    return list.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(q);
      const matchHi = opt.labelHi?.toLowerCase().includes(q);
      const matchVal = opt.value.toLowerCase().includes(q);
      const matchDesc = opt.description?.toLowerCase().includes(q);
      return matchLabel || matchHi || matchVal || matchDesc;
    });
  }, [options, activeGroup, showAll, query]);

  // Grouped structure
  const groupedOptions = useMemo(() => {
    const hasGroups = visibleOptions.some((opt) => !!opt.group);
    if (!hasGroups) {
      return [{ group: null, items: visibleOptions }];
    }

    const groupsMap = new Map<string, ComboboxOption[]>();
    for (const opt of visibleOptions) {
      const g = opt.group || "Other";
      if (!groupsMap.has(g)) {
        groupsMap.set(g, []);
      }
      groupsMap.get(g)!.push(opt);
    }

    return Array.from(groupsMap.entries()).map(([group, items]) => ({
      group,
      items,
    }));
  }, [visibleOptions]);

  // Flattened for keyboard navigation
  const flatItems = useMemo(() => {
    return visibleOptions;
  }, [visibleOptions]);

  // Selected option label
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  const displayLabel = useMemo(() => {
    if (!selectedOption) return "";
    if (isHindi && selectedOption.labelHi) {
      return `${selectedOption.labelHi} (${selectedOption.label})`;
    }
    if (selectedOption.labelHi && selectedOption.labelHi !== selectedOption.label) {
      return `${selectedOption.label} · ${selectedOption.labelHi}`;
    }
    return selectedOption.label;
  }, [selectedOption, isHindi]);

  // Reset highlight on query or open
  useEffect(() => {
    if (open) {
      setHighlightedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setQuery("");
    }
  }, [open]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < flatItems.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : Math.max(0, flatItems.length - 1)
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatItems.length > 0 && flatItems[highlightedIndex]) {
        const item = flatItems[highlightedIndex]!;
        onChange(item.value);
        setOpen(false);
      } else if (allowCreate && query.trim() && onCreateNew) {
        onCreateNew(query.trim());
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div className={`relative inline-block w-full text-left ${className}`}>
      {name && <input type="hidden" name={name} value={value || ""} />}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild disabled={disabled}>
          <button
            id={inputId}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${inputId}-listbox`}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className={`w-full flex items-center justify-between min-h-[40px] px-3 py-2 text-xs md:text-sm font-medium rounded-xl border transition-all duration-150 outline-hidden ${
              disabled
                ? "bg-gray-100 dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-400 cursor-not-allowed"
                : "bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-slate-600 focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-xs"
            }`}
          >
            <span className={`truncate text-left ${!selectedOption ? "text-gray-400 dark:text-gray-500" : ""}`}>
              {selectedOption ? displayLabel : placeholder}
            </span>
            <div className="flex items-center gap-1 ml-2 shrink-0">
              {clearable && selectedOption && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleClear}
                  onKeyDown={(e) => e.key === "Enter" && handleClear(e as any)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  title="Clear selection"
                >
                  <X className="w-3.5 h-3.5" />
                </span>
              )}
              <ChevronsUpDown className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
            </div>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            ref={contentRef}
            align="start"
            sideOffset={4}
            data-radix-scroll-lock-ignore="true"
            data-scroll-lock-ignore="true"
            className="z-50 w-(--radix-popover-trigger-width) min-w-[240px] max-w-[420px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-xl p-1 text-xs md:text-sm animate-in fade-in-0 zoom-in-95"
            onKeyDown={handleKeyDown}
          >
            {/* Search Input */}
            <div className="flex items-center px-2 py-1.5 border-b border-gray-100 dark:border-slate-800 mb-1">
              <Search className="w-3.5 h-3.5 text-gray-400 mr-2 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Optional Group Switcher */}
            {activeGroup && showAllGroupsToggle && (
              <div className="px-2 py-1 flex items-center justify-between text-[11px] bg-gray-50 dark:bg-slate-800/50 rounded-lg mb-1">
                <span className="text-gray-500 dark:text-gray-400 font-medium">
                  Showing: <span className="font-semibold text-gray-800 dark:text-gray-200">{showAll ? "All groups" : activeGroup}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowAll(!showAll)}
                  className="text-primary hover:underline font-bold"
                >
                  {showAll ? `Filter by ${activeGroup}` : "Show all"}
                </button>
              </div>
            )}

            {/* Options List */}
            <div
              ref={listRef}
              id={`${inputId}-listbox`}
              role="listbox"
              data-radix-scroll-lock-ignore="true"
              data-scroll-lock-ignore="true"
              onWheel={(e) => e.stopPropagation()}
              className="max-h-60 overflow-y-auto overflow-x-hidden space-y-0.5 p-0.5"
            >
              {groupedOptions.map((g, gIdx) => (
                <div key={g.group || `group-${gIdx}`} className="space-y-0.5">
                  {g.group && (
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 sticky top-0 bg-white dark:bg-slate-900">
                      {g.group}
                    </div>
                  )}
                  {g.items.map((opt) => {
                    const itemFlatIndex = flatItems.indexOf(opt);
                    const isSelected = opt.value === value;
                    const isHighlighted = itemFlatIndex === highlightedIndex;

                    return (
                      <div
                        key={opt.value}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(opt.value)}
                        onMouseEnter={() => setHighlightedIndex(itemFlatIndex)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-xs ${
                          isSelected
                            ? "bg-primary/10 text-primary font-bold"
                            : isHighlighted
                            ? "bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="truncate">{opt.label}</span>
                            {opt.labelHi && (
                              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-normal">
                                {opt.labelHi}
                              </span>
                            )}
                            {opt.badge && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 rounded-md">
                                {opt.badge}
                              </span>
                            )}
                          </div>
                          {opt.description && (
                            <span className="text-[10px] text-gray-400 truncate">
                              {opt.description}
                            </span>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Empty state */}
              {visibleOptions.length === 0 && !allowCreate && (
                <div className="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
                  {emptyText}
                </div>
              )}

              {/* Create new row */}
              {allowCreate && query.trim() && onCreateNew && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onCreateNew(query.trim());
                    setOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-2 mt-1 rounded-lg cursor-pointer bg-primary/5 hover:bg-primary/10 text-primary font-semibold text-xs transition-colors border-t border-gray-100 dark:border-slate-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {createLabel} &quot;<span className="underline">{query.trim()}</span>&quot;
                  </span>
                </div>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
