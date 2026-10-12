'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { X } from 'lucide-react';

interface SheetContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SheetContext = createContext<SheetContextType | null>(null);

export function useSheet() {
  const context = useContext(SheetContext);
  if (!context) {
    throw new Error('useSheet must be used within a Sheet');
  }
  return context;
}

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function Sheet({ open = false, onOpenChange = () => {}, children }: SheetProps) {
  return (
    <SheetContext.Provider value={{ open, onOpenChange }}>
      {children}
    </SheetContext.Provider>
  );
}

interface SheetTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

export function SheetTrigger({ asChild, children }: SheetTriggerProps) {
  const { onOpenChange } = useSheet();

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>;
    return React.cloneElement(child, {
      onClick: (e: React.MouseEvent) => {
        child.props?.onClick?.(e);
        onOpenChange(true);
      },
    });
  }

  return (
    <button type="button" onClick={() => onOpenChange(true)}>
      {children}
    </button>
  );
}

interface SheetContentProps {
  side?: 'right' | 'left' | 'bottom';
  className?: string;
  children: ReactNode;
  showClose?: boolean;
}

export function SheetContent({
  side = 'right',
  className = '',
  children,
  showClose = true,
}: SheetContentProps) {
  const { open, onOpenChange } = useSheet();
  const contentRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Handle ESC key press
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  if (!open) return null;

  const sideClasses = {
    right:
      'inset-y-0 right-0 h-full w-full sm:max-w-lg border-l border-[#e4e4e7] animate-in slide-in-from-right duration-200',
    left:
      'inset-y-0 left-0 h-full w-full sm:max-w-lg border-r border-[#e4e4e7] animate-in slide-in-from-left duration-200',
    bottom:
      'inset-x-0 bottom-0 max-h-[90vh] w-full border-t border-[#e4e4e7] rounded-t-2xl animate-in slide-in-from-bottom duration-200',
  }[side];

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 cursor-pointer"
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        className={`fixed z-50 bg-white shadow-2xl flex flex-col focus:outline-hidden ${sideClasses} ${className}`}
      >
        {showClose && (
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 rounded-md text-[#71717a] hover:text-[#09090b] hover:bg-[#f4f4f5] transition-colors cursor-pointer z-10"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

export function SheetHeader({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`px-6 py-5 border-b border-[#f0f0f2] flex flex-col gap-1.5 shrink-0 bg-white ${className}`}
    >
      {children}
    </div>
  );
}

export function SheetTitle({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <h2
      className={`text-base font-semibold text-[#09090b] tracking-tight ${className}`}
    >
      {children}
    </h2>
  );
}

export function SheetDescription({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <p className={`text-xs text-[#71717a] leading-relaxed ${className}`}>
      {children}
    </p>
  );
}

export function SheetBody({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`p-6 overflow-y-auto flex-1 min-h-0 ${className}`}>
      {children}
    </div>
  );
}

export function SheetFooter({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`px-6 py-4 border-t border-[#f0f0f2] bg-[#fafafa] flex items-center justify-end gap-2.5 shrink-0 ${className}`}
    >
      {children}
    </div>
  );
}

export function SheetClose({
  asChild,
  children,
}: {
  asChild?: boolean;
  children: React.ReactNode;
}) {
  const { onOpenChange } = useSheet();

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>;
    return React.cloneElement(child, {
      onClick: (e: React.MouseEvent) => {
        child.props?.onClick?.(e);
        onOpenChange(false);
      },
    });
  }

  return (
    <button type="button" onClick={() => onOpenChange(false)}>
      {children}
    </button>
  );
}
