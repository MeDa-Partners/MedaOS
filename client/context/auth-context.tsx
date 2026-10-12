'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
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

const ACTIVE_VENTURE_KEY = 'meda_active_venture_id';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ventures, setVentures] = useState<UserVentureMembership[]>([]);
  const [allVentures, setAllVentures] = useState<Venture[]>([]);
  const [allSections, setAllSections] = useState<Section[]>([]);
  const [departmentsLed, setDepartmentsLed] = useState<string[]>([]);
  const [teamsLed, setTeamsLed] = useState<string[]>([]);
  const [activeVentureId, setActiveVentureIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(ACTIVE_VENTURE_KEY);
    }
    return null;
  });
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
        const stored = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_VENTURE_KEY) : null;
        const candidateId = prev || stored;

        const allVentureOptions = [
          ...(data.allVentures || []),
          ...(data.ventures || []).map((m) => m.venture),
        ];

        if (candidateId && allVentureOptions.some((v) => v.id === candidateId)) {
          setActiveVentureHeader(candidateId);
          return candidateId;
        }

        const defaultId =
          data.ventures.length > 0
            ? data.ventures[0].venture.id
            : data.allVentures && data.allVentures.length > 0
            ? data.allVentures[0].id
            : null;

        setActiveVentureHeader(defaultId);
        if (defaultId && typeof window !== 'undefined') {
          try {
            localStorage.setItem(ACTIVE_VENTURE_KEY, defaultId);
          } catch {
            // ignore
          }
        }
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
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(ACTIVE_VENTURE_KEY);
        } catch {
          // ignore
        }
      }
    }
  }, []);

  const setActiveVentureId = useCallback(
    (ventureId: string) => {
      setActiveVentureIdState(ventureId);
      setActiveVentureHeader(ventureId);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(ACTIVE_VENTURE_KEY, ventureId);
        } catch {
          // ignore
        }
      }
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

  // 1. Explicit membership for active venture
  const activeMembership = useMemo(() => {
    return ventures.find((m) => m.venture.id === activeVentureId) || null;
  }, [ventures, activeVentureId]);

  // 2. Venture config from allVentures or fallback
  const selectedVentureFromAll = useMemo(() => {
    return allVentures.find((v) => v.id === activeVentureId) || null;
  }, [allVentures, activeVentureId]);

  const defaultVenture = useMemo(() => {
    return ventures.length > 0 ? ventures[0].venture : allVentures[0] || null;
  }, [ventures, allVentures]);

  // 3. Complete activeVenture entity
  const activeVenture = useMemo(() => {
    if (activeMembership) {
      const config = allVentures.find((v) => v.id === activeMembership.venture.id);
      return {
        ...activeMembership.venture,
        sections:
          activeMembership.venture.sections && activeMembership.venture.sections.length > 0
            ? activeMembership.venture.sections
            : config?.sections || [],
      };
    }
    if (selectedVentureFromAll) {
      return {
        ...selectedVentureFromAll,
        sections: selectedVentureFromAll.sections || [],
      };
    }
    if (defaultVenture) {
      const config = allVentures.find((v) => v.id === defaultVenture.id);
      return {
        ...defaultVenture,
        sections:
          defaultVenture.sections && defaultVenture.sections.length > 0
            ? defaultVenture.sections
            : config?.sections || [],
      };
    }
    return null;
  }, [activeMembership, selectedVentureFromAll, defaultVenture, allVentures]);

  const activeDepartment = activeMembership?.department || null;
  const activeTeam = activeMembership?.team || null;

  // 4. Complete activeSections list (Admins or direct assignments inherit sections in the active venture)
  const activeSections = useMemo(() => {
    if (activeMembership && activeMembership.sections.length > 0) {
      return activeMembership.sections;
    }
    if (activeVenture?.sections && activeVenture.sections.length > 0) {
      return activeVenture.sections;
    }
    return [];
  }, [activeMembership, activeVenture]);

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
