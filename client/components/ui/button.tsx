import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'default',
      size = 'default',
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      default:
        'bg-[#09090b] text-white hover:bg-[#27272a] shadow-xs active:bg-[#18181b]',
      secondary:
        'bg-white text-[#18181b] border border-[#e4e4e7] hover:bg-[#f4f4f5] shadow-2xs active:bg-[#ebebeb]',
      outline:
        'bg-transparent text-[#18181b] border border-[#e4e4e7] hover:bg-[#f4f4f5] active:bg-[#ebebeb]',
      ghost:
        'bg-transparent text-[#52525b] hover:text-[#09090b] hover:bg-[#f4f4f5] active:bg-[#ebebeb]',
      destructive:
        'bg-red-600 text-white hover:bg-red-700 shadow-xs active:bg-red-800',
      link: 'text-[#09090b] underline-offset-4 hover:underline p-0 h-auto bg-transparent',
    }[variant];

    const sizeStyles = {
      default: 'h-8.5 px-3.5 py-1.5 text-xs rounded-lg gap-2',
      sm: 'h-7.5 px-2.5 text-xs rounded-md gap-1.5',
      lg: 'h-10 px-5 text-sm rounded-lg gap-2',
      icon: 'h-8.5 w-8.5 p-0 rounded-lg justify-center',
    }[size];

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center font-medium transition-colors select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#09090b] focus-visible:ring-offset-1 ${variantStyles} ${sizeStyles} ${className}`}
        {...props}
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
