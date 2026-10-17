'use client';

import React, { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-xl' }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${width} bg-white rounded-xl border border-[#e4e4e7] shadow-2xl animate-pop-in max-h-[90vh] flex flex-col`}
      >
        <div className="px-5 pt-5 pb-3 pr-12">
          <h2 className="text-sm font-semibold text-[#09090b] tracking-tight">{title}</h2>
          {description && <div className="text-xs text-[#71717a] mt-1 leading-relaxed">{description}</div>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md text-[#71717a] hover:text-[#09090b] hover:bg-[#f4f4f5] cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        {children && <div className="px-5 pb-4 overflow-y-auto">{children}</div>}
        {footer && (
          <div className="px-5 py-3.5 border-t border-[#f0f0f2] bg-[#fafafa] rounded-b-xl flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  loading = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
