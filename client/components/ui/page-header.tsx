import React, { ReactNode } from 'react';

interface PageHeaderProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  icon,
  title,
  description,
  badge,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#e4e4e7] ${className}`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          {icon && (
            <div className="w-8 h-8 rounded-lg bg-[#09090b] text-white flex items-center justify-center shrink-0 shadow-2xs">
              {icon}
            </div>
          )}
          <h1 className="text-xl font-bold tracking-tight text-[#09090b]">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="text-xs text-[#71717a] leading-relaxed max-w-2xl">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap sm:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
