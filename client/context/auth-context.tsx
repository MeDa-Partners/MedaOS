'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  api,
  User,
  Venture,
  Section,
  UserVentureMembership,
  AuthData,
  setActiveVentureHeader,
} from '@/lib/api';

export interface AuthContextType {
  user: User | null;
  ventures: UserVentureMembership[];
  activeMembership: UserVentureMembership | null;
  activeVenture: { id: string; name: string; slug: string; status?: string; sections?: Section[] } | null;
  activeDepartment: { id: string; ventureId: string; name: string; slug: string; headUserId: string | null } | null;
  activeTeam: { id: string; departmentId?: string; ventureId?: string; name: string; slug: string; headUserId?: string | null } | null;
  activeSections: Section[];
  allVentures: Venture[];
  allSections: Section[];
  departmentsLed: string[];
  teamsLed: string[];
  isDepartmentHead: boolean;
  isTeamHead: boolean;
  setActiveVentureId: (ventureId: string) => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  hasEmployeeManagementAccess: boolean;
  login: (email: string, password: string) => Promise<AuthData>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_ROUTES = ['/login'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ventures, setVentures] = useState<UserVentureMembership[]>([]);
  const [allVentures, setAllVentures] = useState<Venture[]>([]);
  const [allSections, setAllSections] = useState<Section[]>([]);
  const [departmentsLed, setDepartmentsLed] = useState<string[]>([]);
  const [teamsLed, setTeamsLed] = useState<string[]>([]);
  const [activeVentureId, setActiveVentureIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const router = useRouter();
  const pathname = usePathname();

  const setAuthData = useCallback((data: AuthData | null) => {
    if (data) {
      setUser(data.user);
      setVentures(data.ventures);
      setAllVentures(data.allVentures || []);
      setAllSections(data.allSections || []);
      setDepartmentsLed(data.departmentsLed || []);
      setTeamsLed(data.teamsLed || []);

      // Retain or select active venture ID
      setActiveVentureIdState((prev) => {
        if (prev && data.ventures.some((m) => m.venture.id === prev)) {
          setActiveVentureHeader(prev);
          return prev;
        }
        const defaultId = data.ventures.length > 0 ? data.ventures[0].venture.id : null;
        setActiveVentureHeader(defaultId);
        return defaultId;
      });
    } else {
      setUser(null);
      setVentures([]);
      setAllVentures([]);
      setAllSections([]);
      setDepartmentsLed([]);
      setTeamsLed([]);
      setActiveVentureIdState(null);
      setActiveVentureHeader(null);
    }
  }, []);

  const setActiveVentureId = useCallback(
    (ventureId: string) => {
      setActiveVentureIdState(ventureId);
      setActiveVentureHeader(ventureId);
    },
    []
  );

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.auth.me();
      setAuthData(data);
    } catch {
      setAuthData(null);
      if (!PUBLIC_ROUTES.includes(pathname)) {
        router.push('/login');
      }
    } finally {
      setIsLoading(false);
    }
  }, [pathname, router, setAuthData]);

  // Initial session authentication check
  useEffect(() => {
    let ignore = false;

    api.auth
      .me()
      .then((data) => {
        if (!ignore) {
          setAuthData(data);
        }
      })
      .catch(() => {
        if (!ignore) {
          setAuthData(null);
          if (!PUBLIC_ROUTES.includes(pathname)) {
            router.push('/login');
          }
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [pathname, router, setAuthData]);

  const login = async (email: string, password: string): Promise<AuthData> => {
    setIsLoading(true);
    try {
      const data = await api.auth.login(email, password);
      setAuthData(data);
      router.push('/');
      return data;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      setAuthData(null);
      router.push('/login');
    }
  };

  const activeMembership =
    ventures.find((m) => m.venture.id === activeVentureId) ||
    (ventures.length > 0 ? ventures[0] : null);

  const activeVentureConfig = allVentures.find(
    (v) => v.id === activeMembership?.venture.id
  );

  const activeVenture = activeMembership
    ? {
        ...activeMembership.venture,
        sections:
          activeMembership.venture.sections &&
          activeMembership.venture.sections.length > 0
            ? activeMembership.venture.sections
            : activeVentureConfig?.sections || [],
      }
    : null;

  const activeDepartment = activeMembership?.department || null;
  const activeTeam = activeMembership?.team || null;
  const activeSections = activeMembership ? activeMembership.sections : [];

  const isAdmin = user?.isAdmin === true;
  const isDepartmentHead = departmentsLed.length > 0;
  const isTeamHead = teamsLed.length > 0;

  // Management access granted to Global Admin, Department Heads, and Team Heads
  const hasEmployeeManagementAccess = isAdmin || isDepartmentHead || isTeamHead;

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        ventures,
        activeMembership,
        activeVenture,
        activeDepartment,
        activeTeam,
        activeSections,
        allVentures,
        allSections,
        departmentsLed,
        teamsLed,
        isDepartmentHead,
        isTeamHead,
        setActiveVentureId,
        isLoading,
        isAuthenticated,
        isAdmin,
        hasEmployeeManagementAccess,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
