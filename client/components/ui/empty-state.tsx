import React, { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  children,
}: EmptyStateProps) {
  return (
    <div className="bg-white border border-[#e4e4e7] rounded-xl p-10 text-center flex flex-col items-center justify-center max-w-lg mx-auto shadow-2xs">
      {Icon && (
        <div className="w-11 h-11 rounded-xl bg-[#f4f4f5] text-[#71717a] border border-[#e4e4e7] flex items-center justify-center mb-3.5">
          <Icon className="w-5 h-5" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-[#09090b] tracking-tight mb-1">
        {title}
      </h3>
      <p className="text-xs text-[#71717a] leading-relaxed max-w-sm mb-5">
        {description}
      </p>
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}
