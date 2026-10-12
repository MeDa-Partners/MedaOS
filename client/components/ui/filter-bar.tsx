import React, { ReactNode } from 'react';
import { Search, X } from 'lucide-react';

interface FilterBarProps {
  search?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  count?: number;
  totalCount?: number;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  children,
  count,
  totalCount,
  onClearFilters,
  hasActiveFilters = false,
}: FilterBarProps) {
  return (
    <div className="bg-white border border-[#e4e4e7] rounded-xl p-3 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 min-w-0">
        {/* Search Input */}
        {onSearchChange !== undefined && (
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-3.5 h-3.5 text-[#a1a1aa] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-8.5 pl-8.5 pr-8 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-lg placeholder:text-[#a1a1aa] focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#09090b] focus:border-[#09090b] transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a1a1aa] hover:text-[#09090b] p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Dropdown Filters slot */}
        {children && (
          <div className="flex items-center gap-2 flex-wrap">
            {children}
          </div>
        )}

        {/* Reset filter button */}
        {hasActiveFilters && onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-[11px] text-[#71717a] hover:text-[#09090b] underline underline-offset-2 flex items-center gap-1 cursor-pointer"
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Item counter */}
      {count !== undefined && (
        <div className="text-[11px] font-mono text-[#71717a] flex items-center gap-1.5 self-end lg:self-center shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
          <span>
            Showing <strong className="text-[#09090b] font-semibold">{count}</strong>
            {totalCount !== undefined && totalCount !== count ? (
              <span> of {totalCount}</span>
            ) : null}{' '}
            items
          </span>
        </div>
      )}
    </div>
  );
}

interface FilterSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: ReactNode;
  label?: string;
}

export function FilterSelect({
  icon,
  label,
  children,
  className = '',
  ...props
}: FilterSelectProps) {
  return (
    <div className="relative inline-flex items-center" title={label}>
      {icon && (
        <span className="absolute left-2.5 text-[#71717a] pointer-events-none">
          {icon}
        </span>
      )}
      <select
        aria-label={label}
        className={`h-8.5 ${icon ? 'pl-7.5' : 'pl-3'} pr-8 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-lg text-[#18181b] hover:bg-white focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#09090b] focus:border-[#09090b] cursor-pointer transition-all ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
