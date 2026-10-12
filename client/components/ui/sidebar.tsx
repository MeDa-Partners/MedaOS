'use client';

import React, { createContext, useContext, forwardRef } from 'react';

// Context for sidebar state
interface SidebarContextValue {
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error('useSidebar must be used within a Sidebar component');
  }
  return ctx;
}

// ===================== ROOT SIDEBAR =====================
export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  children: React.ReactNode;
}

export const Sidebar = forwardRef<HTMLElement, SidebarProps>(
  ({ mobileOpen = false, onCloseMobile, className = '', children, ...props }, ref) => {
    return (
      <SidebarContext.Provider
        value={{
          isMobileOpen: mobileOpen,
          setIsMobileOpen: (open) => {
            if (!open && onCloseMobile) onCloseMobile();
          },
        }}
      >
        {/* Mobile backdrop */}
        {mobileOpen && (
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs lg:hidden transition-opacity duration-200"
            aria-hidden="true"
          />
        )}

        <aside
          ref={ref}
          data-mobile-open={mobileOpen}
          className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-[#e4e4e7] flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 shrink-0 font-sans ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          } ${className}`}
          {...props}
        >
          {children}
        </aside>
      </SidebarContext.Provider>
    );
  }
);
Sidebar.displayName = 'Sidebar';

// ===================== SIDEBAR HEADER =====================
export const SidebarHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`p-3 border-b border-[#f0f0f2] shrink-0 flex flex-col gap-2 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SidebarHeader.displayName = 'SidebarHeader';

// ===================== SIDEBAR CONTENT =====================
export const SidebarContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex-1 min-h-0 overflow-y-auto px-2 py-3 space-y-4 scrollbar-thin scrollbar-thumb-zinc-200 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SidebarContent.displayName = 'SidebarContent';

// ===================== SIDEBAR FOOTER =====================
export const SidebarFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`p-3 border-t border-[#f0f0f2] bg-[#fafafa] shrink-0 flex flex-col gap-2 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SidebarFooter.displayName = 'SidebarFooter';

// ===================== SIDEBAR GROUP =====================
export const SidebarGroup = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`space-y-1 ${className}`} {...props}>
        {children}
      </div>
    );
  }
);
SidebarGroup.displayName = 'SidebarGroup';

// ===================== SIDEBAR GROUP LABEL =====================
export interface SidebarGroupLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  badge?: React.ReactNode;
}

export const SidebarGroupLabel = forwardRef<HTMLDivElement, SidebarGroupLabelProps>(
  ({ className = '', children, badge, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider text-[#71717a] font-medium flex items-center justify-between select-none ${className}`}
        {...props}
      >
        <span className="truncate">{children}</span>
        {badge && <span className="ml-auto shrink-0">{badge}</span>}
      </div>
    );
  }
);
SidebarGroupLabel.displayName = 'SidebarGroupLabel';

// ===================== SIDEBAR GROUP CONTENT =====================
export const SidebarGroupContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`space-y-0.5 ${className}`} {...props}>
        {children}
      </div>
    );
  }
);
SidebarGroupContent.displayName = 'SidebarGroupContent';

// ===================== SIDEBAR MENU =====================
export const SidebarMenu = forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <ul ref={ref} className={`space-y-0.5 list-none m-0 p-0 ${className}`} {...props}>
        {children}
      </ul>
    );
  }
);
SidebarMenu.displayName = 'SidebarMenu';

// ===================== SIDEBAR MENU ITEM =====================
export const SidebarMenuItem = forwardRef<HTMLLIElement, React.HTMLAttributes<HTMLLIElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <li ref={ref} className={`list-none ${className}`} {...props}>
        {children}
      </li>
    );
  }
);
SidebarMenuItem.displayName = 'SidebarMenuItem';

// ===================== SIDEBAR MENU BUTTON =====================
export interface SidebarMenuButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  isActive?: boolean;
  asChild?: boolean;
  size?: 'default' | 'sm' | 'lg';
}

export const SidebarMenuButton = forwardRef<HTMLDivElement, SidebarMenuButtonProps>(
  ({ className = '', isActive = false, size = 'default', children, onKeyDown, ...props }, ref) => {
    const sizeClasses = {
      sm: 'px-2 py-1.5 text-[11px]',
      default: 'px-2.5 py-2 text-xs',
      lg: 'px-3 py-2.5 text-sm',
    }[size];

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        data-active={isActive}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.currentTarget.click();
          }
          onKeyDown?.(e);
        }}
        className={`w-full ${sizeClasses} rounded-lg flex items-center gap-2.5 text-left font-medium transition-colors cursor-pointer select-none group ${
          isActive
            ? 'bg-[#09090b] text-white shadow-xs'
            : 'text-[#52525b] hover:text-[#09090b] hover:bg-[#f4f4f5]'
        } ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SidebarMenuButton.displayName = 'SidebarMenuButton';

// ===================== SIDEBAR MENU SUB (INDENTED RAIL) =====================
export const SidebarMenuSub = forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <ul
        ref={ref}
        className={`list-none m-0 border-l border-[#e4e4e7] ml-3.5 pl-2 my-1 space-y-0.5 ${className}`}
        {...props}
      >
        {children}
      </ul>
    );
  }
);
SidebarMenuSub.displayName = 'SidebarMenuSub';

// ===================== SIDEBAR MENU SUB ITEM =====================
export const SidebarMenuSubItem = forwardRef<HTMLLIElement, React.HTMLAttributes<HTMLLIElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <li ref={ref} className={`list-none ${className}`} {...props}>
        {children}
      </li>
    );
  }
);
SidebarMenuSubItem.displayName = 'SidebarMenuSubItem';

// ===================== SIDEBAR MENU SUB BUTTON =====================
export interface SidebarMenuSubButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  isActive?: boolean;
}

export const SidebarMenuSubButton = forwardRef<HTMLDivElement, SidebarMenuSubButtonProps>(
  ({ className = '', isActive = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-active={isActive}
        className={`w-full px-2 py-1.5 text-xs rounded-md flex items-center gap-2 font-medium transition-colors cursor-pointer select-none ${
          isActive
            ? 'bg-[#f4f4f5] text-[#09090b] font-semibold'
            : 'text-[#71717a] hover:text-[#09090b] hover:bg-[#f4f4f5]/60'
        } ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SidebarMenuSubButton.displayName = 'SidebarMenuSubButton';

// ===================== SIDEBAR MENU BADGE =====================
export const SidebarMenuBadge = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`ml-auto text-[10px] font-mono px-1.5 py-0.2 rounded-sm bg-[#f4f4f5] text-[#71717a] border border-[#e4e4e7] shrink-0 ${className}`}
        {...props}
      >
        {children}
      </span>
    );
  }
);
SidebarMenuBadge.displayName = 'SidebarMenuBadge';

// ===================== SIDEBAR SEPARATOR =====================
export const SidebarSeparator = forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(
  ({ className = '', ...props }, ref) => {
    return <hr ref={ref} className={`border-0 h-px bg-[#f0f0f2] my-2 ${className}`} {...props} />;
  }
);
SidebarSeparator.displayName = 'SidebarSeparator';
