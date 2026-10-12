import React, { HTMLAttributes } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'secondary'
    | 'outline'
    | 'success'
    | 'warning'
    | 'destructive'
    | 'venture'
    | 'mono';
  dot?: boolean;
}

export function Badge({
  variant = 'default',
  dot = false,
  className = '',
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: 'bg-[#09090b] text-white border-transparent',
    secondary: 'bg-[#f4f4f5] text-[#18181b] border-[#e4e4e7]',
    outline: 'bg-white text-[#52525b] border-[#e4e4e7]',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-800 border-amber-200/80',
    destructive: 'bg-red-50 text-red-700 border-red-200/80',
    venture: 'bg-blue-50 text-blue-700 border-blue-200/80',
    mono: 'bg-[#fafafa] text-[#3f3f46] border-[#e4e4e7] font-mono text-[10px]',
  }[variant];

  const dotStyles = {
    default: 'bg-white',
    secondary: 'bg-[#71717a]',
    outline: 'bg-[#71717a]',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    destructive: 'bg-red-500',
    venture: 'bg-blue-500',
    mono: 'bg-zinc-400',
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border tracking-tight transition-colors ${variantStyles} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotStyles}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
