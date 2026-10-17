'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/auth-context';

/**
 * For pages under /[ventureSlug]: makes the URL's venture the active one and returns the
 * caller's membership in it (null while loading or when the caller has no access).
 */
export function useVentureFromSlug(ventureSlug: string) {
  const { memberships, activeVenture, setActiveVenture, isLoading } = useAuth();
  const membership = memberships.find((m) => m.venture.slug === ventureSlug) ?? null;

  useEffect(() => {
    if (membership && activeVenture?.id !== membership.venture.id) setActiveVenture(membership.venture.id);
  }, [membership, activeVenture?.id, setActiveVenture]);

  return { membership, ready: !isLoading };
}
