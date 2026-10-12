import React, { InputHTMLAttributes, forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error = false, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={`w-full h-8.5 px-3 py-1.5 text-xs bg-white text-[#09090b] placeholder:text-[#a1a1aa] border rounded-lg transition-all focus:outline-hidden focus:ring-1 focus:ring-[#09090b] focus:border-[#09090b] disabled:bg-[#f4f4f5] disabled:cursor-not-allowed ${
          error ? 'border-red-500 ring-1 ring-red-500' : 'border-[#e4e4e7]'
        } ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
