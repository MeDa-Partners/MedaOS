/**
 * MeDa OS — API client.
 *
 * Talks to the Express backend at NEXT_PUBLIC_API_URL with the HttpOnly session cookie
 * (credentials: 'include'). Permission rules live on the server; the client only reads the
 * capability flags the server returns.
 */

// ───────────────────────── Types ─────────────────────────

export type Status = 'active' | 'inactive';
export type VentureRole = 'admin' | 'department_head' | 'team_head' | 'member';

export interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  status: Status;
}

export interface Venture {
  id: string;
  name: string;
  slug: string;
  status: Status;
  departmentCount?: number;
  employeeCount?: number;
}

export interface SectionRef {
  id: string;
  departmentId: string;
  departmentName: string;
  departmentSlug: string;
  name: string;
  slug: string;
  route: string;
  status: Status;
}

export interface VentureMembership {
  venture: Venture;
  department: { id: string; ventureId: string; name: string; slug: string; headUserId: string | null } | null;
  team: { id: string; departmentId: string; name: string; slug: string; headUserId: string | null } | null;
  role: VentureRole;
  sections: SectionRef[];
}

export interface AuthData {
  user: User;
  ventures: VentureMembership[];
  departmentsLed: string[];
  teamsLed: string[];
  isDepartmentHead: boolean;
  isTeamHead: boolean;
}

export interface PersonRef {
  id: string;
  name: string;
  email: string;
}

export interface Department {
  id: string;
  ventureId: string;
  ventureName: string;
  ventureSlug: string;
  name: string;
  slug: string;
  headUserId: string | null;
  headUser: PersonRef | null;
  status: Status;
  teamCount: number;
  sectionCount: number;
  memberCount: number;
  canManage: boolean;
}

export interface Team {
  id: string;
  departmentId: string;
  departmentName: string;
  ventureId: string;
  ventureSlug: string;
  name: string;
  slug: string;
  headUserId: string | null;
  headUser: PersonRef | null;
  status: Status;
  memberCount: number;
  canManage: boolean;
  members?: (PersonRef & { status: Status; isTeamHead: boolean })[];
}

export interface Section {
  id: string;
  departmentId: string;
  departmentName: string;
  ventureId: string;
  ventureSlug: string;
  name: string;
  slug: string;
  route: string;
  status: Status;
  userCount: number;
}

export interface EmployeeMembership {
  ventureId: string;
  ventureName: string;
  ventureSlug: string;
  departmentId: string;
  departmentName: string;
  isDepartmentHead: boolean;
  teamId: string | null;
  teamName: string | null;
  isTeamHead: boolean;
  sections: { id: string; name: string; slug: string; route: string }[];
  capabilities: {
    canChangeTeam: boolean;
    canManageSections: boolean;
    /** null = every section of the department. */
    grantableSectionIds: string[] | null;
    canRemove: boolean;
  };
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  status: Status;
  createdAt: string;
  ventures: EmployeeMembership[];
  canEditAccount: boolean;
}

export interface EmployeeList {
  users: Employee[];
  total: number;
  page: number;
  limit: number;
}

export interface SectionAccessResult {
  allowed: boolean;
  reason?: string;
  section?: {
    id: string;
    name: string;
    slug: string;
    status: Status;
    departmentId: string;
    departmentName: string;
    ventureId: string;
    ventureName: string;
    ventureSlug: string;
  };
}

export interface DevSection {
  id: string;
  departmentId: string;
  name: string;
  slug: string;
  description: string | null;
  status: Status;
  route: string;
  assignedUserCount: number;
}

export interface DevDepartment {
  id: string;
  ventureId: string;
  name: string;
  slug: string;
  headUserId: string | null;
  status: Status;
  employeeCount: number;
  teamCount: number;
  sectionCount: number;
  sections: DevSection[];
}

export interface DevVenture {
  id: string;
  name: string;
  slug: string;
  status: Status;
  employeeCount: number;
  departmentCount: number;
  departments: DevDepartment[];
}

export interface DevCatalog {
  ventures: DevVenture[];
  summary: { totalVentures: number; totalDepartments: number; totalTeams: number; totalSections: number };
}

// ── Orders (WayVeda COD verification) ──

export type OrderView = 'all' | 'my_pending' | 'delayed' | 'converted' | 'cancelled' | 'follow_up' | 'completed';
/** Which screen is asking: each is guarded by its own section on the server. */
export type OrderScope = 'orders' | 'verification' | 'portal';
export type OrderStep = 'verification' | 'portal';
export type OrderStage = 'new' | 'verification_pending' | 'portal_pending' | 'done' | 'closed';
/** overdue = open and past its deadline (amber); late = finished after its deadline (red). */
export type DelayStatus = 'overdue' | 'late' | null;

export interface OrderListItem {
  id: string;
  taskId: string | null;
  orderNumber: string;
  orderDate: string;
  customerName: string | null;
  phone: string | null;
  products: string | null;
  totalAmount: number;
  stage: OrderStage;
  assigneeName: string | null;
  /** Minutes past the planned time of an open step; null when on time or no TAT is set. */
  delayMinutes: number | null;
  /** Planned time of the step the order is waiting on. */
  plannedAt: string | null;
  delayStatus: DelayStatus;
  followUpRequired: boolean;
  followUpDone: boolean;
}

export interface OrderListResult {
  orders: OrderListItem[];
  /** The tabs this screen shows, in order. */
  views: OrderView[];
  counts: Partial<Record<OrderView, number>>;
}

export interface OrderTimelineEntry {
  id: string;
  step: string;
  event: string;
  at: string;
  note: string | null;
  byUserName: string | null;
}

export interface OrderDetail {
  id: string;
  taskId: string | null;
  shopifyOrderId: string;
  orderNumber: string;
  orderDate: string;
  customerName: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  products: string | null;
  totalQty: number;
  totalAmount: number;
  paymentMethod: string;
  channel: string | null;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  cancelledInShopify: boolean;
  stage: OrderStage;
  scanOutcome: string | null;
  scanAt: string | null;
  finalResponse: string | null;
  collectedAmount: number | null;
  balanceAmount: number | null;
  addressConfirmed: boolean | null;
  newAddress: string | null;
  screenshotUrl: string | null;
  crmRemarks: string | null;
  portalAction: string | null;
  portalDone: boolean;
  adminRemarks: string | null;
  followUpRequired: boolean;
  followUpDone: boolean;
  followUpNotes: string | null;
  verificationAssignee: { id: string; name: string } | null;
  verificationPlannedAt: string | null;
  verificationActualAt: string | null;
  portalAssignee: { id: string; name: string } | null;
  portalPlannedAt: string | null;
  portalActualAt: string | null;
  delayMinutes: number | null;
  delayStatus: DelayStatus;
  createdAt: string;
  updatedAt: string;
  timeline: OrderTimelineEntry[];
  capabilities: OrderCapabilities;
}

/** What the current user may do with one order (from the server; never re-derived here). */
export interface OrderCapabilities {
  canEditVerification: boolean;
  canEditPortal: boolean;
  canEditFollowUp: boolean;
  /** The step that may be reassigned, or null. */
  reassignStep: OrderStep | null;
}

export interface VerificationUpdate {
  scanOutcome?: string;
  finalResponse?: string;
  collectedAmount?: number | null;
  balanceAmount?: number | null;
  addressConfirmed?: boolean | null;
  newAddress?: string | null;
  crmRemarks?: string | null;
}

export interface ShiftRow {
  id?: string;
  name: string;
  startTime: string;
  endTime: string;
  assigneeUserId: string | null;
  assigneeName?: string | null;
}

export interface StepShifts {
  shifts: ShiftRow[];
  candidates: { userId: string; name: string }[];
  unassigned: number;
  pendingByOwner: { userId: string; name: string; pending: number }[];
  problems: string[];
}

export interface ShiftsOverview {
  steps: Record<OrderStep, StepShifts>;
  capabilities: { canEditShifts: boolean };
}

export interface SyncHealth {
  provider: 'shopify';
  configured: boolean;
  scheduleEnabled: boolean;
  lastSuccessAt: string | null;
  lastRunAt: string | null;
  lastError: string | null;
  ordersSynced: number;
  /** No successful run in the last 15 minutes. */
  stale: boolean;
}

// ───────────────────────── Transport ─────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getBaseUrl(): string {
  let url = (process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:5000/api/v1').replace(/\/+$/, '');
  if (!url.endsWith('/api/v1')) url = `${url}/api/v1`;

  // When the app is opened over the LAN, point "localhost" at the same host.
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      url = url.replace(/\/\/(localhost|127\.0\.0\.1)([:/])/, `//${host}$2`);
    }
  }
  return url;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) },
    credentials: 'include',
  });

  let json: { success?: boolean; data?: T; message?: string; error?: { message: string; details?: unknown } };
  try {
    json = await response.json();
  } catch {
    throw new ApiError(`Server returned an unreadable response (${response.status})`, response.status);
  }

  if (!response.ok || !json.success) {
    throw new ApiError(json?.error?.message || json?.message || 'Request failed', response.status, json?.error?.details);
  }
  return json.data as T;
}

const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
};

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body !== undefined && { body: JSON.stringify(body) }),
});

export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  return err instanceof Error ? err.message : fallback;
}

// ───────────────────────── Endpoints ─────────────────────────

export const api = {
  auth: {
    login: (email: string, password: string) => request<AuthData>('/auth/login', send('POST', { email, password })),
    logout: () => request<null>('/auth/logout', send('POST')),
    me: () => request<AuthData>('/auth/me'),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<null>('/auth/change-password', send('PATCH', { currentPassword, newPassword })),
  },

  ventures: {
    list: () => request<Venture[]>('/ventures'),
  },

  departments: {
    list: (ventureId?: string) => request<Department[]>(`/departments${qs({ ventureId })}`),
    assignHead: (id: string, headUserId: string | null) =>
      request<Department>(`/departments/${id}/head`, send('PATCH', { headUserId })),
  },

  teams: {
    list: (params: { ventureId?: string; departmentId?: string } = {}) => request<Team[]>(`/teams${qs(params)}`),
    get: (id: string) => request<Team>(`/teams/${id}`),
    create: (data: { departmentId: string; name: string }) => request<Team>('/teams', send('POST', data)),
    update: (id: string, data: { name?: string; status?: Status }) => request<Team>(`/teams/${id}`, send('PATCH', data)),
    assignHead: (id: string, headUserId: string | null) =>
      request<Team>(`/teams/${id}/head`, send('PATCH', { headUserId })),
    remove: (id: string) => request<null>(`/teams/${id}`, send('DELETE')),
  },

  sections: {
    list: (params: { ventureId?: string; departmentId?: string } = {}) => request<Section[]>(`/sections${qs(params)}`),
    checkAccess: (ventureSlug: string, sectionSlug: string) =>
      request<SectionAccessResult>(`/sections/${encodeURIComponent(sectionSlug)}/access-check${qs({ ventureId: ventureSlug })}`),
  },

  employees: {
    list: (params: {
      ventureId?: string;
      departmentId?: string;
      teamId?: string;
      search?: string;
      includeUnassigned?: boolean;
      page?: number;
      limit?: number;
    } = {}) => request<EmployeeList>(`/users${qs(params)}`),
    get: (id: string) => request<Employee>(`/users/${id}`),
    create: (data: {
      name: string;
      email: string;
      password: string;
      departmentId?: string;
      teamId?: string | null;
      sectionIds?: string[];
    }) => request<Employee>('/users', send('POST', data)),
    update: (id: string, data: { name?: string; email?: string }) => request<Employee>(`/users/${id}`, send('PATCH', data)),
    setStatus: (id: string, status: Status) => request<Employee>(`/users/${id}/status`, send('PATCH', { status })),
    resetPassword: (id: string, newPassword: string) =>
      request<null>(`/users/${id}/reset-password`, send('POST', { newPassword })),
    setMembership: (id: string, data: { departmentId: string; teamId: string | null }) =>
      request<Employee>(`/users/${id}/membership`, send('PUT', data)),
    removeMembership: (id: string, ventureId: string) =>
      request<Employee>(`/users/${id}/membership/${ventureId}`, send('DELETE')),
    setSections: (id: string, departmentId: string, sectionIds: string[]) =>
      request<Employee>(`/users/${id}/sections`, send('PUT', { departmentId, sectionIds })),
    grantSection: (id: string, sectionId: string) => request<Employee>(`/users/${id}/sections/${sectionId}`, send('POST')),
    revokeSection: (id: string, sectionId: string) =>
      request<Employee>(`/users/${id}/sections/${sectionId}`, send('DELETE')),
  },

  orders: {
    list: (
      ventureId: string,
      params: { scope?: OrderScope; view?: OrderView; search?: string; limit?: number; offset?: number } = {}
    ) => request<OrderListResult>(`/orders${qs({ ventureId, ...params })}`),
    get: (ventureId: string, id: string, scope: OrderScope = 'orders') =>
      request<OrderDetail>(`/orders/${id}${qs({ ventureId, scope })}`),
    updateVerification: (ventureId: string, id: string, data: VerificationUpdate) =>
      request<OrderDetail>(`/orders/${id}/verification${qs({ ventureId, scope: 'verification' })}`, send('PATCH', data)),
    updatePortal: (ventureId: string, id: string, data: { portalAction?: string; portalDone?: boolean; adminRemarks?: string | null }) =>
      request<OrderDetail>(`/orders/${id}/portal${qs({ ventureId, scope: 'portal' })}`, send('PATCH', data)),
    updateFollowUp: (ventureId: string, id: string, data: { followUpDone?: boolean; followUpNotes?: string | null }) =>
      request<OrderDetail>(`/orders/${id}/follow-up${qs({ ventureId })}`, send('PATCH', data)),
    reassign: (ventureId: string, id: string, step: OrderStep, userId: string | null) =>
      request<OrderDetail>(`/orders/${id}/reassign${qs({ ventureId })}`, send('POST', { step, userId })),
    bulkReassign: (ventureId: string, step: OrderStep, fromUserId: string | null, toUserId: string) =>
      request<{ moved: number }>(`/orders/bulk-reassign${qs({ ventureId })}`, send('POST', { step, fromUserId, toUserId })),
  },

  shifts: {
    get: (ventureId: string) => request<ShiftsOverview>(`/shifts${qs({ ventureId })}`),
    save: (ventureId: string, step: OrderStep, shifts: Omit<ShiftRow, 'id' | 'assigneeName'>[]) =>
      request<ShiftsOverview>(`/shifts${qs({ ventureId })}`, send('PUT', { step, shifts })),
  },

  sync: {
    health: (ventureId: string) => request<SyncHealth>(`/sync/health${qs({ ventureId })}`),
  },

  dev: {
    login: (username: string, password: string) =>
      request<{ username: string }>('/dev/auth/login', send('POST', { username, password })),
    logout: () => request<null>('/dev/auth/logout', send('POST')),
    me: () => request<{ username: string }>('/dev/auth/me'),
    catalog: () => request<DevCatalog>('/dev/overview'),
    ventures: {
      create: (data: { name: string; slug?: string; status?: Status }) => request<Venture>('/dev/ventures', send('POST', data)),
      update: (id: string, data: { name?: string; slug?: string; status?: Status }) =>
        request<Venture>(`/dev/ventures/${id}`, send('PATCH', data)),
      remove: (id: string, force = false) => request<null>(`/dev/ventures/${id}${qs({ force: force || undefined })}`, send('DELETE')),
    },
    departments: {
      create: (data: { ventureId: string; name: string; slug?: string; status?: Status }) =>
        request<Department>('/dev/departments', send('POST', data)),
      update: (id: string, data: { name?: string; slug?: string; status?: Status }) =>
        request<Department>(`/dev/departments/${id}`, send('PATCH', data)),
      remove: (id: string, force = false) =>
        request<null>(`/dev/departments/${id}${qs({ force: force || undefined })}`, send('DELETE')),
    },
    sections: {
      create: (data: { departmentId: string; name: string; slug?: string; description?: string | null; status?: Status }) =>
        request<Section>('/dev/sections', send('POST', data)),
      update: (id: string, data: { name?: string; slug?: string; description?: string | null; status?: Status }) =>
        request<Section>(`/dev/sections/${id}`, send('PATCH', data)),
      remove: (id: string, force = false) => request<null>(`/dev/sections/${id}${qs({ force: force || undefined })}`, send('DELETE')),
    },
  },
};
