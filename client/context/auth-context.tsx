'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, AuthData, User, VentureMembership, VentureRole } from '@/lib/api';

/** Routes that render without an employee session (/dev has its own developer login). */
const PUBLIC_PREFIXES = ['/login', '/dev'];
const ACTIVE_VENTURE_KEY = 'meda_active_venture_id';

export interface AuthContextType {
  user: User | null;
  /** Every venture the user can work in (admins: all active ventures). */
  memberships: VentureMembership[];
  activeMembership: VentureMembership | null;
  activeVenture: VentureMembership['venture'] | null;
  /** Role in the active venture. */
  role: VentureRole | null;
  setActiveVenture: (ventureIdOrSlug: string) => void;
  departmentsLed: string[];
  teamsLed: string[];
  isAdmin: boolean;
  /** Admin, department head or team head anywhere — may open people management. */
  isLeader: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readStoredVenture(): string | null {
  try {
    return localStorage.getItem(ACTIVE_VENTURE_KEY);
  } catch {
    return null;
  }
}

function storeVenture(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_VENTURE_KEY, id);
    else localStorage.removeItem(ACTIVE_VENTURE_KEY);
  } catch {
    // storage unavailable (private mode) — selection just won't persist
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AuthData | null>(null);
  const [activeVentureId, setActiveVentureId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const apply = useCallback((next: AuthData | null) => {
    setData(next);
    if (!next) {
      setActiveVentureId(null);
      return;
    }
    setActiveVentureId((prev) => {
      const candidate = prev ?? readStoredVenture();
      const valid = next.ventures.find((m) => m.venture.id === candidate);
      const chosen = valid?.venture.id ?? next.ventures[0]?.venture.id ?? null;
      storeVenture(chosen);
      return chosen;
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply(await api.auth.me());
    } catch {
      apply(null);
    }
  }, [apply]);

  // Resolve the session once on load.
  useEffect(() => {
    let ignore = false;
    api.auth
      .me()
      .then((me) => !ignore && apply(me))
      .catch(() => !ignore && apply(null))
      .finally(() => !ignore && setIsLoading(false));
    return () => {
      ignore = true;
    };
  }, [apply]);

  // Bounce signed-out visitors to the login page.
  useEffect(() => {
    if (!isLoading && !data && !isPublic) router.replace('/login');
  }, [isLoading, data, isPublic, router]);

  const login = useCallback(
    async (email: string, password: string) => {
      apply(await api.auth.login(email, password));
      router.replace('/');
    },
    [apply, router]
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      apply(null);
      storeVenture(null);
      router.replace('/login');
    }
  }, [apply, router]);

  const setActiveVenture = useCallback(
    (idOrSlug: string) => {
      const match = data?.ventures.find((m) => m.venture.id === idOrSlug || m.venture.slug === idOrSlug);
      if (!match) return;
      storeVenture(match.venture.id);
      setActiveVentureId(match.venture.id);
    },
    [data]
  );

  const value = useMemo<AuthContextType>(() => {
    const memberships = data?.ventures ?? [];
    const activeMembership = memberships.find((m) => m.venture.id === activeVentureId) ?? memberships[0] ?? null;
    const isAdmin = data?.user.isAdmin === true;
    return {
      user: data?.user ?? null,
      memberships,
      activeMembership,
      activeVenture: activeMembership?.venture ?? null,
      role: activeMembership?.role ?? null,
      setActiveVenture,
      departmentsLed: data?.departmentsLed ?? [],
      teamsLed: data?.teamsLed ?? [],
      isAdmin,
      isLeader: isAdmin || !!data?.isDepartmentHead || !!data?.isTeamHead,
      isLoading,
      login,
      logout,
      refresh,
    };
  }, [data, activeVentureId, setActiveVenture, isLoading, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export const ROLE_LABEL: Record<VentureRole, string> = {
  admin: 'Administrator',
  department_head: 'Department head',
  team_head: 'Team head',
  member: 'Member',
};
