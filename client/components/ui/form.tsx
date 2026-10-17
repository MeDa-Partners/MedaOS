import React, { forwardRef, ReactNode, SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-[#09090b]">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-[#71717a] leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
}

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', children, ...props }, ref) => (
    <div className={`relative ${className}`}>
      <select
        ref={ref}
        className="w-full h-8.5 appearance-none pl-3 pr-8 text-xs bg-white text-[#09090b] border border-[#e4e4e7] rounded-lg cursor-pointer transition-colors hover:border-[#d4d4d8] focus:outline-hidden focus:ring-1 focus:ring-[#09090b] focus:border-[#09090b] disabled:bg-[#f4f4f5] disabled:text-[#71717a] disabled:cursor-not-allowed"
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="w-3.5 h-3.5 text-[#71717a] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  )
);
Select.displayName = 'Select';

export function Checkbox({
  checked,
  onChange,
  disabled,
  label,
  description,
  title,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  title?: string;
}) {
  const box = (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      title={title}
      onChange={(e) => onChange(e.target.checked)}
      className="peer w-4 h-4 shrink-0 rounded-[5px] border border-[#d4d4d8] accent-[#09090b] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
  if (!label) return box;
  return (
    <label
      title={title}
      className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-[#f4f4f5]'
      }`}
    >
      <span className="pt-0.5">{box}</span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-[#09090b]">{label}</span>
        {description && <span className="block text-[11px] text-[#71717a] mt-0.5">{description}</span>}
      </span>
    </label>
  );
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'info' | 'warning'; children: ReactNode }) {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
  }[tone];
  return <div className={`rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${styles}`}>{children}</div>;
}
