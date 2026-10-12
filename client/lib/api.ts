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

export interface Department {
  id: string;
  ventureId: string;
  ventureName: string;
  ventureSlug: string;
  name: string;
  slug: string;
  headUserId: string | null;
  headUserName?: string | null;
  headUserEmail?: string | null;
  headUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  status: 'active' | 'inactive';
  teamCount: number;
  sectionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  departmentId: string;
  departmentName?: string;
  departmentSlug?: string;
  ventureId: string;
  ventureName?: string;
  ventureSlug?: string;
  name: string;
  slug: string;
  headUserId: string | null;
  headUserName?: string | null;
  headUserEmail?: string | null;
  headUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  status: 'active' | 'inactive';
  memberCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Venture {
  id: string;
  name: string;
  slug: string;
  status?: string;
  departmentCount?: number;
  teamCount?: number;
  sectionCount?: number;
  sections?: Section[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Section {
  id: string;
  departmentId: string;
  departmentName?: string;
  departmentSlug?: string;
  ventureId?: string;
  ventureName?: string;
  ventureSlug?: string;
  name: string;
  slug: string;
  route: string;
  status: 'active' | 'inactive';
  userCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserVentureMembership {
  venture: {
    id: string;
    name: string;
    slug: string;
    status?: string;
    sections?: Section[];
  };
  department?: {
    id: string;
    ventureId: string;
    name: string;
    slug: string;
    headUserId: string | null;
  } | null;
  team?: {
    id: string;
    departmentId?: string;
    ventureId?: string;
    name: string;
    slug: string;
    headUserId?: string | null;
  } | null;
  sections: Section[];
}

export interface AuthData {
  user: User;
  ventures: UserVentureMembership[];
  allVentures?: Venture[];
  allSections?: Section[];
  departmentsLed?: string[];
  teamsLed?: string[];
  isDepartmentHead?: boolean;
  isTeamHead?: boolean;
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
    departmentId: string;
    departmentName: string;
    departmentSlug: string;
    isDepartmentHead?: boolean;
    teamId: string;
    teamName: string;
    teamSlug: string;
    isTeamHead?: boolean;
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

export interface DevVentureOverviewItem {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  isSupportedInCode: boolean;
  employeeCount: number;
  departmentCount: number;
  departments: {
    id: string;
    ventureId: string;
    name: string;
    slug: string;
    headUserId: string | null;
    status: 'active' | 'inactive';
    createdAt: string;
    updatedAt: string;
    employeeCount: number;
    teamCount: number;
    sectionCount: number;
    teams: {
      id: string;
      departmentId: string;
      name: string;
      slug: string;
      headUserId: string | null;
      status: 'active' | 'inactive';
      employeeCount: number;
    }[];
    sections: {
      id: string;
      departmentId: string;
      name: string;
      slug: string;
      status: 'active' | 'inactive';
      createdAt: string;
      updatedAt: string;
      isImplementedInCode: boolean;
      route: string;
      assignedUserCount: number;
    }[];
  }[];
}

export interface DevCatalogOverview {
  registry: {
    sections: {
      key: string;
      name: string;
      description: string;
      routeTemplate: string;
      status: string;
    }[];
    ventures: {
      slug: string;
      name: string;
      description: string;
      supportedSectionKeys: string[];
    }[];
  };
  ventures: DevVentureOverviewItem[];
  summary: {
    totalVentures: number;
    totalDepartments: number;
    totalTeams: number;
    totalSections: number;
  };
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

// Direct backend API endpoint URL resolution
export function getBaseUrl(): string {
  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:5000/api/v1';
  let cleanedUrl = rawApiUrl.replace(/\/+$/, '');
  if (!cleanedUrl.endsWith('/api/v1')) {
    cleanedUrl = `${cleanedUrl}/api/v1`;
  }

  // If in browser and accessed via LAN IP or custom domain, dynamically map localhost to current host
  if (typeof window !== 'undefined' && window.location) {
    const currentHost = window.location.hostname;
    if (
      currentHost &&
      currentHost !== 'localhost' &&
      currentHost !== '127.0.0.1' &&
      (cleanedUrl.includes('localhost') || cleanedUrl.includes('127.0.0.1'))
    ) {
      cleanedUrl = cleanedUrl
        .replace('//localhost:', `//${currentHost}:`)
        .replace('//localhost/', `//${currentHost}/`)
        .replace('//127.0.0.1:', `//${currentHost}:`)
        .replace('//127.0.0.1/', `//${currentHost}/`);
    }
  }

  return cleanedUrl;
}

let activeVentureHeader: string | null = null;

export function setActiveVentureHeader(ventureId: string | null) {
  activeVentureHeader = ventureId;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${getBaseUrl()}${cleanEndpoint}`;

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

  departments: {
    list: (ventureId?: string) => {
      const qs = ventureId && ventureId !== 'undefined' && ventureId !== 'null' ? `?ventureId=${encodeURIComponent(ventureId)}` : '';
      return request<Department[]>(`/departments${qs}`);
    },
    getById: (id: string) => request<Department>(`/departments/${id}`),
    create: (data: {
      ventureId: string;
      name: string;
      slug?: string;
      headUserId?: string | null;
      status?: 'active' | 'inactive';
    }) =>
      request<Department>('/departments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: {
        name?: string;
        slug?: string;
        headUserId?: string | null;
        status?: 'active' | 'inactive';
      }
    ) =>
      request<Department>(`/departments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    assignHead: (id: string, headUserId: string | null) =>
      request<Department>(`/departments/${id}/head`, {
        method: 'PATCH',
        body: JSON.stringify({ headUserId }),
      }),
  },

  teams: {
    list: (options?: { departmentId?: string; ventureId?: string } | string) => {
      let qs = '';
      if (typeof options === 'string' && options && options !== 'undefined' && options !== 'null') {
        qs = `?ventureId=${encodeURIComponent(options)}`;
      } else if (options && typeof options === 'object') {
        const params = new URLSearchParams();
        if (options.departmentId && options.departmentId !== 'undefined' && options.departmentId !== 'null') {
          params.set('departmentId', options.departmentId);
        }
        if (options.ventureId && options.ventureId !== 'undefined' && options.ventureId !== 'null') {
          params.set('ventureId', options.ventureId);
        }
        qs = params.toString() ? `?${params.toString()}` : '';
      }
      return request<Team[]>(`/teams${qs}`);
    },
    getById: (id: string) => request<Team>(`/teams/${id}`),
    create: (data: {
      departmentId: string;
      name: string;
      slug?: string;
      headUserId?: string | null;
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
        headUserId?: string | null;
        status?: 'active' | 'inactive';
      }
    ) =>
      request<Team>(`/teams/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    assignHead: (id: string, headUserId: string | null) =>
      request<Team>(`/teams/${id}/head`, {
        method: 'PATCH',
        body: JSON.stringify({ headUserId }),
      }),
  },

  ventures: {
    list: () => request<Venture[]>('/ventures'),
    getById: (id: string) => request<Venture>(`/ventures/${id}`),
    create: (data: {
      name: string;
      slug: string;
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
    testAccess: (ventureId: string) =>
      request<{ allowed: boolean; message: string; ventureId: string }>(
        `/ventures/${ventureId}/test-access`
      ),
  },

  sections: {
    list: (options?: { departmentId?: string; ventureId?: string }) => {
      let qs = '';
      if (options) {
        const params = new URLSearchParams();
        if (options.departmentId && options.departmentId !== 'undefined' && options.departmentId !== 'null') {
          params.set('departmentId', options.departmentId);
        }
        if (options.ventureId && options.ventureId !== 'undefined' && options.ventureId !== 'null') {
          params.set('ventureId', options.ventureId);
        }
        qs = params.toString() ? `?${params.toString()}` : '';
      }
      return request<Section[]>(`/sections${qs}`);
    },
    getById: (id: string) => request<Section>(`/sections/${id}`),
    create: (data: {
      departmentId: string;
      name: string;
      slug?: string;
      status?: 'active' | 'inactive';
    }) =>
      request<Section>('/sections', {
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
      request<Section>(`/sections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    updateStatus: (id: string, status: 'active' | 'inactive') =>
      request<Section>(`/sections/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    checkAccess: (sectionSlug: string) =>
      request<{
        allowed: boolean;
        section: string;
        userId?: string;
        ventureId?: string;
        message: string;
      }>(`/sections/${sectionSlug}/access-check`),
  },

  employees: {
    list: (params: {
      page?: number;
      limit?: number;
      search?: string;
      ventureId?: string;
      departmentId?: string;
      teamId?: string;
    } = {}) => {
      const query = new URLSearchParams();
      if (params.page) query.set('page', params.page.toString());
      if (params.limit) query.set('limit', params.limit.toString());
      if (params.search && params.search.trim()) query.set('search', params.search.trim());
      if (params.ventureId && params.ventureId !== 'undefined' && params.ventureId !== 'null') {
        query.set('ventureId', params.ventureId);
      }
      if (params.departmentId && params.departmentId !== 'undefined' && params.departmentId !== 'null') {
        query.set('departmentId', params.departmentId);
      }
      if (params.teamId && params.teamId !== 'undefined' && params.teamId !== 'null') {
        query.set('teamId', params.teamId);
      }
      const qs = query.toString() ? `?${query.toString()}` : '';
      return request<EmployeeListResponse>(`/users${qs}`);
    },

    getById: (id: string) => request<EmployeeResponseItem>(`/users/${id}`),

    create: (data: {
      name: string;
      email: string;
      password: string;
      ventureId?: string;
      departmentId?: string;
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

    assignMembership: (
      id: string,
      data: { ventureId: string; departmentId: string; teamId: string }
    ) =>
      request<EmployeeResponseItem>(`/users/${id}/membership`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    assignTeam: (id: string, data: { ventureId: string; departmentId: string; teamId: string }) =>
      request<EmployeeResponseItem>(`/users/${id}/membership`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    removeMembership: (id: string, ventureId: string) =>
      request<EmployeeResponseItem>(`/users/${id}/membership/${ventureId}`, {
        method: 'DELETE',
      }),

    removeVenture: (id: string, ventureId: string) =>
      request<EmployeeResponseItem>(`/users/${id}/membership/${ventureId}`, {
        method: 'DELETE',
      }),

    assignSections: (id: string, data: { ventureId?: string; sectionIds: string[] }) =>
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

  dev: {
    login: (credentials: { username: string; password: string }) =>
      request<{ username: string; isDeveloper: boolean }>('/dev/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),

    logout: () =>
      request<null>('/dev/auth/logout', {
        method: 'POST',
      }),

    me: () =>
      request<{ username: string; isDeveloper: boolean }>('/dev/auth/me'),

    getRegistry: () =>
      request<{ sections: unknown[]; ventures: unknown[] }>('/dev/registry'),

    getCatalogOverview: () =>
      request<DevCatalogOverview>('/dev/overview'),

    ventures: {
      list: () => request<Venture[]>('/dev/ventures'),
      create: (data: { name: string; slug?: string; status?: 'active' | 'inactive' }) =>
        request<Venture>('/dev/ventures', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (id: string, data: { name?: string; slug?: string; status?: 'active' | 'inactive' }) =>
        request<Venture>(`/dev/ventures/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        }),
      delete: (id: string, force?: boolean) =>
        request<null>(`/dev/ventures/${id}${force ? '?force=true' : ''}`, {
          method: 'DELETE',
        }),
    },

    departments: {
      list: (ventureId?: string) =>
        request<Department[]>(`/dev/departments${ventureId ? `?ventureId=${ventureId}` : ''}`),
      create: (data: { ventureId: string; name: string; slug?: string; status?: 'active' | 'inactive' }) =>
        request<Department>('/dev/departments', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (id: string, data: { name?: string; slug?: string; status?: 'active' | 'inactive' }) =>
        request<Department>(`/dev/departments/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        }),
      delete: (id: string, force?: boolean) =>
        request<null>(`/dev/departments/${id}${force ? '?force=true' : ''}`, {
          method: 'DELETE',
        }),
    },

    sections: {
      list: (options?: { departmentId?: string; ventureId?: string }) => {
        let qs = '';
        if (options) {
          const params = new URLSearchParams();
          if (options.departmentId) params.set('departmentId', options.departmentId);
          if (options.ventureId) params.set('ventureId', options.ventureId);
          qs = params.toString() ? `?${params.toString()}` : '';
        }
        return request<Section[]>(`/dev/sections${qs}`);
      },
      create: (data: { departmentId: string; name: string; slug?: string; status?: 'active' | 'inactive' }) =>
        request<Section>('/dev/sections', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (id: string, data: { name?: string; slug?: string; status?: 'active' | 'inactive' }) =>
        request<Section>(`/dev/sections/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        }),
      delete: (id: string, force?: boolean) =>
        request<null>(`/dev/sections/${id}${force ? '?force=true' : ''}`, {
          method: 'DELETE',
        }),
    },
  },

  // Alias users to employees
  get users() {
    return this.employees;
  },
};
