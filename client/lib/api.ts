/**
 * MeDa Partners Operating System — API Client
 *
 * Communicates directly with the Express backend via the configured NEXT_PUBLIC_API_URL.
 * Uses credentials: 'include' for secure HTTP-only cookie session authentication and CORS.
 * No JWTs, no localStorage, no direct database connections.
 */

export interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  status: 'active' | 'inactive';
}

export interface Team {
  id: string;
  ventureId: string;
  name: string;
  slug: string;
  status?: string;
  venture?: {
    id: string;
    name: string;
    slug: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface Venture {
  id: string;
  name: string;
  slug: string;
  status?: string;
  sections?: Section[];
  teams?: {
    id: string;
    name: string;
    slug: string;
    status: string;
  }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Section {
  id: string;
  name: string;
  slug: string;
  route: string;
  status?: string;
}

export interface UserVentureMembership {
  venture: {
    id: string;
    name: string;
    slug: string;
    status?: string;
    sections?: Section[];
  };
  team: {
    id: string;
    ventureId: string;
    name: string;
    slug: string;
  };
  sections: Section[];
}

export interface AuthData {
  user: User;
  ventures: UserVentureMembership[];
  allVentures?: Venture[];
  allSections?: Section[];
}

export interface EmployeeResponseItem {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  ventures: {
    ventureId: string;
    ventureName: string;
    ventureSlug: string;
    teamId: string;
    teamName: string;
    teamSlug: string;
    sections: {
      id: string;
      name: string;
      slug: string;
      route: string;
    }[];
  }[];
}

export interface EmployeeListResponse {
  users: EmployeeResponseItem[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
  error?: {
    message: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  public statusCode: number;
  public details?: unknown;

  constructor(message: string, statusCode: number = 500, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Direct backend API endpoint URL (configured via NEXT_PUBLIC_API_URL in .env / .env.local)
// Automatically ensures the /api/v1 route prefix is present even if omitted in deployment settings
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
const cleanedUrl = (rawApiUrl || 'http://localhost:5000/api/v1').replace(/\/+$/, '');
const BASE_URL = cleanedUrl.endsWith('/api/v1') ? cleanedUrl : `${cleanedUrl}/api/v1`;

let activeVentureHeader: string | null = null;

export function setActiveVentureHeader(ventureId: string | null) {
  activeVentureHeader = ventureId;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${BASE_URL}${cleanEndpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(activeVentureHeader ? { 'X-Venture-Id': activeVentureHeader } : {}),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Always send and receive HTTP-only session cookies
  });

  let json: ApiResponse<T>;
  try {
    json = await response.json();
  } catch {
    throw new ApiError(
      `Network response could not be parsed (${response.statusText})`,
      response.status
    );
  }

  if (!response.ok || !json.success) {
    const errorMsg = json?.error?.message || json?.message || 'Request failed';
    throw new ApiError(errorMsg, response.status, json?.error?.details);
  }

  return json.data;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<AuthData>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    logout: () =>
      request<null>('/auth/logout', {
        method: 'POST',
      }),

    me: () => request<AuthData>('/auth/me', { method: 'GET' }),

    changePassword: (currentPassword: string, newPassword: string) =>
      request<null>('/auth/change-password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
  },

  employees: {
    list: (params: {
      page?: number;
      limit?: number;
      search?: string;
      ventureId?: string;
      teamId?: string;
    } = {}) => {
      const query = new URLSearchParams();
      if (params.page) query.set('page', params.page.toString());
      if (params.limit) query.set('limit', params.limit.toString());
      if (params.search) query.set('search', params.search);
      if (params.ventureId) query.set('ventureId', params.ventureId);
      if (params.teamId) query.set('teamId', params.teamId);
      const qs = query.toString() ? `?${query.toString()}` : '';
      return request<EmployeeListResponse>(`/users${qs}`);
    },

    getById: (id: string) => request<EmployeeResponseItem>(`/users/${id}`),

    create: (data: {
      name: string;
      email: string;
      password: string;
      ventureId?: string;
      teamId?: string;
      sectionIds?: string[];
      status?: 'active' | 'inactive';
    }) =>
      request<EmployeeResponseItem>('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: { name?: string; email?: string }) =>
      request<EmployeeResponseItem>(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    updateStatus: (id: string, status: 'active' | 'inactive') =>
      request<EmployeeResponseItem>(`/users/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),

    assignTeam: (id: string, data: { ventureId: string; teamId: string }) =>
      request<EmployeeResponseItem>(`/users/${id}/team`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    removeVenture: (id: string, ventureId: string) =>
      request<EmployeeResponseItem>(`/users/${id}/assignment/${ventureId}`, {
        method: 'DELETE',
      }),

    assignSections: (id: string, data: { ventureId: string; sectionIds: string[] }) =>
      request<EmployeeResponseItem>(`/users/${id}/sections`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    resetPassword: (id: string, newPassword: string) =>
      request<null>(`/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      }),
  },

  // Alias users to employees
  get users() {
    return this.employees;
  },

  teams: {
    list: (ventureId?: string) => {
      const qs = ventureId ? `?ventureId=${encodeURIComponent(ventureId)}` : '';
      return request<Team[]>(`/teams${qs}`);
    },
    getById: (id: string) => request<Team>(`/teams/${id}`),
    create: (data: {
      ventureId: string;
      name: string;
      slug: string;
      status?: 'active' | 'inactive';
    }) =>
      request<Team>('/teams', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: {
        name?: string;
        slug?: string;
        status?: 'active' | 'inactive';
      }
    ) =>
      request<Team>(`/teams/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  ventures: {
    list: () => request<Venture[]>('/ventures'),
    getById: (id: string) => request<Venture>(`/ventures/${id}`),
    create: (data: {
      name: string;
      slug: string;
      sectionIds?: string[];
      status?: 'active' | 'inactive';
    }) =>
      request<Venture>('/ventures', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: {
        name?: string;
        slug?: string;
        status?: 'active' | 'inactive';
      }
    ) =>
      request<Venture>(`/ventures/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    setSections: (id: string, sectionIds: string[]) =>
      request<Venture>(`/ventures/${id}/sections`, {
        method: 'PATCH',
        body: JSON.stringify({ sectionIds }),
      }),
    testAccess: (ventureId: string) =>
      request<{ allowed: boolean; message: string; ventureId: string }>(
        `/ventures/${ventureId}/test-access`
      ),
  },

  sections: {
    list: () => request<Section[]>('/sections'),
    checkAccess: (sectionSlug: string) =>
      request<{
        allowed: boolean;
        section: string;
        userId?: string;
        ventureId?: string;
        message: string;
      }>(`/sections/${sectionSlug}/access-check`),
  },
};
