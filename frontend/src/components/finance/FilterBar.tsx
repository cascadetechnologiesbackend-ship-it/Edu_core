"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X, RotateCcw } from "lucide-react";

export interface FilterOption {
  key: string;
  label: string;
  options: Array<{ label: string; value: string }>;
  placeholder?: string;
}

export interface FilterBarProps {
  searchKey?: string;
  searchPlaceholder?: string;
  filters?: FilterOption[];
  onSearchChange?: (val: string) => void;
  className?: string;
}

export function FilterBar({
  searchKey = "q",
  searchPlaceholder = "Search by name, ID, or receipt...",
  filters = [],
  onSearchChange,
  className,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = useState(searchParams.get(searchKey) || "");

  // Debounced search sync to URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = searchParams.get(searchKey) || "";
      if (searchTerm !== current) {
        const params = new URLSearchParams(searchParams.toString());
        if (searchTerm.trim()) {
          params.set(searchKey, searchTerm.trim());
        } else {
          params.delete(searchKey);
        }
        params.delete("page"); // reset to page 1
        router.push(`${pathname}?${params.toString()}` as any);
        if (onSearchChange) onSearchChange(searchTerm.trim());
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm, searchKey, pathname, router, searchParams, onSearchChange]);

  const handleFilterSelect = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}` as any);
  };

  const handleClearAll = () => {
    setSearchTerm("");
    router.push(pathname as any);
    if (onSearchChange) onSearchChange("");
  };

  const hasActiveFilters = Array.from(searchParams.entries()).length > 0;

  return (
    <div className={`space-y-3 ${className || ""}`}>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-9 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dynamic Select Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {filters.map((filter) => {
            const currentValue = searchParams.get(filter.key) || "ALL";
            return (
              <select
                key={filter.key}
                value={currentValue}
                onChange={(e) => handleFilterSelect(filter.key, e.target.value)}
                className="px-3 py-2 text-xs md:text-sm font-medium rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
              >
                <option value="ALL">
                  {filter.placeholder || `All ${filter.label}`}
                </option>
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            );
          })}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
