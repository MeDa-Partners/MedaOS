import React, { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: ReactNode;
  hoverable?: boolean;
}

export function Card({
  className = '',
  children,
  hoverable = false,
  ...props
}: CardProps) {
  return (
    <div
      className={`bg-white border border-[#e4e4e7] rounded-xl text-[#09090b] shadow-xs ${
        hoverable
          ? 'hover:border-[#d4d4d8] hover:shadow-sm transition-all duration-150'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`p-5 pb-3 border-b border-[#f4f4f5] flex flex-col gap-1.5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`text-sm font-semibold text-[#09090b] tracking-tight leading-snug ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={`text-xs text-[#71717a] leading-relaxed ${className}`}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`px-5 py-3 border-t border-[#f4f4f5] bg-[#fafafa]/50 rounded-b-xl flex items-center justify-between gap-3 text-xs ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
