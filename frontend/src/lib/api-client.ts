// ─── Types / Schemas ────────────────────────────────────────────────────────

export interface HealthStatus { status: string; }
export interface ErrorResponse { error: string; }
export interface SuccessResponse { success: boolean; }

export interface SignupRequest {
  username: string;
  email?: string;
  phone?: string;
  password: string;
}
export interface SignupResponse { success: boolean; }

export interface LoginRequest { identifier: string; password: string; }
export interface LoginResponse { token: string; username: string; is_admin: boolean; }

export interface UserPlan {
  username: string;
  full_name?: string;
  email?: string;
  phone?: string;
  address_line?: string;
  pincode?: string;
  city?: string;
  state?: string;
  plan: string;
  credits: number;
  expiry?: string;
  expiry_iso?: string;
  notifications_count: number;
  active?: boolean;
  plan_details?: {
    name: string;
    price: number;
    duration_days: number;
    features: string[];
  };
}

export interface UserProfile {
  username: string;
  full_name?: string;
  email?: string;
  phone?: string;
  address_line?: string;
  pincode?: string;
  city?: string;
  state?: string;
  plan: string;
  credits: number;
  expiry?: string;
  avatar_url?: string | null;
}

export interface Notification {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface AdminUser {
  id: number;
  username: string;
  full_name?: string;
  email?: string;
  phone?: string;
  address_line?: string;
  pincode?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  plan: string;
  credits: number;
  expiry?: string;
  is_admin: boolean;
  created_at: string;
}

export interface Plan {
  id: number;
  name: string;
  price: number;
  credits: number;
  duration_days: number;
  features: string[];
  expiry: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CreatePlanRequest {
  name: string;
  price?: number;
  credits?: number;
  duration_days?: number;
  features?: string[];
  expiry?: string | null;
}

// SettingsMap: all values are strings from the key-value settings table
export type SettingsMap = Record<string, string>;
export interface UpdateSettingRequest { key: string; value: string; }
export interface UpdateSettingResponse { success: boolean; key: string; value: string; }

export interface UpdatePlanByIdRequest {
  name?: string;
  price?: number;
  credits?: number;
  duration_days?: number;
  features?: string[];
  expiry?: string | null;
  is_active?: boolean;
}

export interface UpdateCreditsRequest { credits: number; }
export interface UpdatePlanRequest { plan: string; expiry?: string; }
export interface UpdateExpiryRequest { expiry: string | null; }
export interface SendNotificationRequest {
  user_id?: number | null;
  message: string;
  title?: string;
  as_announcement?: boolean;
  broadcast?: boolean;
  send_email?: boolean;
  email_subject?: string;
}

export interface Announcement {
  id: number;
  title: string;
  message: string;
  created_by: string | null;
  created_at: string;
}

// Dashboard interfaces
export interface DashboardStats {
  users: number;
  plans: number;
  orders: number;
  totalRevenue: number;
  revenueThisMonth: number;
  totalCredits?: number;
  creditsUsedThisMonth?: number;
  activePlans?: number;
  // Extended fields returned by backend
  totalUsers?: number;
  activeUsers?: number;
  newUsersThisMonth?: number;
}

export interface PlanDistribution {
  plan_name: string;
  user_count: number;
  credits: number;
  duration_days: number;
}

export interface MonthlyData {
  month: string;
  user_signups: number;
  admin_signups: number;
}

export interface RecentActivity {
  username: string;
  email: string;
  plan: string;
  created_at: string;
  activity_type: string;
}

import { getToken, getApiUrl } from "@/lib/api";

// ─── Custom Fetch ────────────────────────────────────────────────────────────

type AuthTokenGetter = () => Promise<string | null> | string | null;
let _authTokenGetter: AuthTokenGetter | null = null;

export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  _authTokenGetter = getter;
}

// Set the auth token getter to use the getToken function
setAuthTokenGetter(async () => {
  const token = getToken();
  return token;
});

export class ApiError<T = unknown> extends Error {
  readonly status: number;
  readonly data: T | null;
  constructor(response: Response, data: T | null) {
    // FastAPI returns errors as { detail: "..." }, fallback to { error: "..." }
    const msg = (data && typeof data === "object")
      ? String((data as Record<string, unknown>).detail || (data as Record<string, unknown>).error || `HTTP ${response.status}`)
      : `HTTP ${response.status}`;
    super(msg);
    this.status = response.status;
    this.data = data;
  }
}

export async function customFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  // Use absolute URL in production, relative (proxy) in development
  const absoluteUrl = url.startsWith('http') ? url : `${getApiUrl()}${url}`;
  
  const headers = new Headers(options.headers);
  if (!headers.has("content-type") && options.body && typeof options.body === "string") {
    headers.set("content-type", "application/json");
  }
  if (_authTokenGetter && !headers.has("authorization")) {
    const token = await _authTokenGetter();
    if (token) headers.set("authorization", `Bearer ${token}`);
  }
  const response = await fetch(absoluteUrl, { ...options, headers });
  if (!response.ok) {
    let data: unknown = null;
    try { data = await response.json(); } catch { /* ignore */ }
    throw new ApiError(response, data);
  }
  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

// ─── React Query Hooks ───────────────────────────────────────────────────────

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";

type QueryOpts<T> = { query?: Partial<UseQueryOptions<T, Error>>; };
type MutationOpts<T, V> = { mutation?: UseMutationOptions<T, Error, V>; };

// Plans
export interface Plan {
  id: number;
  name: string;
  price: number;
  credits: number;
  duration_days: number;
  features: string[];
  is_active: boolean;
  created_at: string;
}

export const useGetPlans = (opts?: QueryOpts<Plan[]>) =>
  useQuery({
    queryKey: ["/api/admin/plans"],
    queryFn: async () => {
      const res = await customFetch<any>("/api/admin/plans");
      return Array.isArray(res) ? res : (res?.plans ?? []);
    },
    ...opts?.query,
  });

export const useGetPublicPlans = (opts?: QueryOpts<Plan[]>) =>
  useQuery({
    queryKey: ["/api/plans"],
    queryFn: async () => {
      const response = await customFetch<Plan[]>("/api/plans");
      return response;
    },
    ...opts?.query,
  });

// Health
export const useHealthCheck = (opts?: QueryOpts<HealthStatus>) =>
  useQuery<HealthStatus, Error>({
    queryKey: ["/api/healthz"],
    queryFn: () => customFetch<HealthStatus>("/api/healthz"),
    ...opts?.query,
  });

// User: my plan
export const useGetMyPlan = (opts?: QueryOpts<UserPlan>) =>
  useQuery<UserPlan, Error>({
    queryKey: ["/api/my-plan"],
    queryFn: () => customFetch<UserPlan>("/api/my-plan"),
    staleTime: 0, // Always consider data stale, force refetch
    refetchOnWindowFocus: true, // Refetch when window gains focus
    ...opts?.query,
  });

// User: complete profile
export const useGetProfile = (opts?: QueryOpts<UserProfile>) =>
  useQuery<UserProfile, Error>({
    queryKey: ["/api/profile"],
    queryFn: () => customFetch<UserProfile>("/api/profile"),
    ...opts?.query,
  });

// User: notifications
export const useGetNotifications = (opts?: QueryOpts<Notification[]>) =>
  useQuery<Notification[], Error>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await customFetch<any>("/api/notifications");
      return Array.isArray(res) ? res : (res?.notifications ?? []);
    },
    ...opts?.query,
  });

// Admin: list users
export const useAdminListUsers = (opts?: QueryOpts<AdminUser[]>) =>
  useQuery<AdminUser[], Error>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await customFetch<any>("/api/admin/users");
      return Array.isArray(res) ? res : (res?.users ?? []);
    },
    ...opts?.query,
  });

// Admin: update credits
export const useAdminUpdateCredits = (
  opts?: MutationOpts<AdminUser, { id: number; data: UpdateCreditsRequest }>
) =>
  useMutation<AdminUser, Error, { id: number; data: UpdateCreditsRequest }>({
    mutationFn: ({ id, data }) =>
      customFetch<AdminUser>(`/api/admin/users/${id}/credits`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    ...opts?.mutation,
  });

// Admin: update plan for user
export const useAdminUpdatePlan = (
  opts?: MutationOpts<AdminUser, { id: number; data: UpdatePlanRequest }>
) =>
  useMutation<AdminUser, Error, { id: number; data: UpdatePlanRequest }>({
    mutationFn: ({ id, data }) =>
      customFetch<AdminUser>(`/api/admin/users/${id}/plan`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    ...opts?.mutation,
  });

// Admin: update expiry for user
export const useAdminUpdateExpiry = (
  opts?: MutationOpts<AdminUser, { id: number; data: UpdateExpiryRequest }>
) =>
  useMutation<AdminUser, Error, { id: number; data: UpdateExpiryRequest }>({
    mutationFn: ({ id, data }) =>
      customFetch<AdminUser>(`/api/admin/users/${id}/expiry`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    ...opts?.mutation,
  });

// Admin: send notification
export const useAdminSendNotification = (
  opts?: MutationOpts<SuccessResponse, { data: SendNotificationRequest }>
) =>
  useMutation<SuccessResponse, Error, { data: SendNotificationRequest }>({
    mutationFn: ({ data }) =>
      customFetch<SuccessResponse>("/api/admin/notify", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ...opts?.mutation,
  });

// Admin: list plans
export const useAdminListPlans = (opts?: QueryOpts<Plan[]>) =>
  useQuery<Plan[], Error>({
    queryKey: ["/api/admin/plans"],
    queryFn: async () => {
      const res = await customFetch<any>("/api/admin/plans");
      return Array.isArray(res) ? res : (res?.plans ?? []);
    },
    ...opts?.query,
  });

// Admin: create plan
export const useAdminCreatePlan = (
  opts?: MutationOpts<Plan, { data: CreatePlanRequest }>
) =>
  useMutation<Plan, Error, { data: CreatePlanRequest }>({
    mutationFn: ({ data }) =>
      customFetch<Plan>("/api/admin/plans", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ...opts?.mutation,
  });

// Admin: update plan by id
export const useAdminUpdatePlanById = (
  opts?: MutationOpts<Plan, { id: number; data: UpdatePlanByIdRequest }>
) =>
  useMutation<Plan, Error, { id: number; data: UpdatePlanByIdRequest }>({
    mutationFn: ({ id, data }) =>
      customFetch<Plan>(`/api/admin/plans/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    ...opts?.mutation,
  });

// Admin: delete plan
export const useAdminDeletePlan = (
  opts?: MutationOpts<SuccessResponse, { id: number }>
) =>
  useMutation<SuccessResponse, Error, { id: number }>({
    mutationFn: ({ id }) =>
      customFetch<SuccessResponse>(`/api/admin/plans/${id}`, { method: "DELETE" }),
    ...opts?.mutation,
  });

// Admin: get settings
export const useAdminGetSettings = (opts?: QueryOpts<SettingsMap>) =>
  useQuery<SettingsMap, Error>({
    queryKey: ["/api/admin/settings"],
    queryFn: () => customFetch<SettingsMap>("/api/admin/settings"),
    ...opts?.query,
  });

// Admin: update setting
export const useAdminUpdateSetting = (
  opts?: MutationOpts<UpdateSettingResponse, { data: UpdateSettingRequest }>
) =>
  useMutation<UpdateSettingResponse, Error, { data: UpdateSettingRequest }>({
    mutationFn: ({ data }) =>
      customFetch<UpdateSettingResponse>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    ...opts?.mutation,
  });

// Dashboard: get stats
export const useDashboardStats = (opts?: QueryOpts<DashboardStats>) =>
  useQuery<DashboardStats, Error>({
    queryKey: ["/api/admin/dashboard/stats"],
    queryFn: () => customFetch<DashboardStats>("/api/admin/dashboard/stats"),
    ...opts?.query,
  });

// Dashboard: get plan distribution
export const useDashboardPlanDistribution = (opts?: QueryOpts<PlanDistribution[]>) =>
  useQuery<PlanDistribution[], Error>({
    queryKey: ["/api/admin/dashboard/plan-distribution"],
    queryFn: () => customFetch<PlanDistribution[]>("/api/admin/dashboard/plan-distribution"),
    ...opts?.query,
  });

// Dashboard: get monthly data
export const useDashboardMonthlyData = (opts?: QueryOpts<MonthlyData[]>) =>
  useQuery<MonthlyData[], Error>({
    queryKey: ["/api/admin/dashboard/monthly-data"],
    queryFn: () => customFetch<MonthlyData[]>("/api/admin/dashboard/monthly-data"),
    ...opts?.query,
  });

// Dashboard: get recent activity
export const useAdminAnnouncements = (opts?: QueryOpts<Announcement[]>) =>
  useQuery<Announcement[], Error>({
    queryKey: ["/api/admin/announcements"],
    queryFn: async () => {
      const res = await customFetch<any>("/api/admin/announcements");
      return Array.isArray(res) ? res : [];
    },
    ...opts?.query,
  });

export const useGetAnnouncements = (opts?: QueryOpts<Announcement[]>) =>
  useQuery<Announcement[], Error>({
    queryKey: ["/api/announcements"],
    queryFn: async () => {
      const res = await customFetch<any>("/api/announcements");
      return Array.isArray(res) ? res : [];
    },
    ...opts?.query,
  });

export const useAdminDeleteAnnouncement = (
  opts?: MutationOpts<SuccessResponse, { id: number }>
) =>
  useMutation<SuccessResponse, Error, { id: number }>({
    mutationFn: ({ id }) =>
      customFetch<SuccessResponse>(`/api/admin/announcements/${id}`, { method: "DELETE" }),
    ...opts?.mutation,
  });

export const useDashboardRecentActivity = (opts?: QueryOpts<RecentActivity[]>) =>
  useQuery<RecentActivity[], Error>({
    queryKey: ["/api/admin/dashboard/recent-activity"],
    queryFn: () => customFetch<RecentActivity[]>("/api/admin/dashboard/recent-activity"),
    ...opts?.query,
  });

// Admin: reset user password
export const useAdminResetPassword = (
  opts?: MutationOpts<{ success: boolean; message: string; user: any }, { id: number; data: { newPassword: string } }>
) =>
  useMutation<{ success: boolean; message: string; user: any }, Error, { id: number; data: { newPassword: string } }>({
    mutationFn: ({ id, data }) =>
      customFetch<{ success: boolean; message: string; user: any }>(`/api/admin/users/${id}/reset-password`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    ...opts?.mutation,
  });

// Notifications interfaces
export interface Notification {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

// Get user notifications
export const useNotifications = (opts?: QueryOpts<Notification[]>) =>
  useQuery<Notification[], Error>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await customFetch<any>("/api/notifications");
      return Array.isArray(res) ? res : (res?.notifications ?? []);
    },
    ...opts?.query,
  });

// Mark notification as read
export const useMarkNotificationRead = (
  opts?: MutationOpts<Notification, { id: number }>
) =>
  useMutation<Notification, Error, { id: number }>({
    mutationFn: ({ id }) =>
      customFetch<Notification>(`/api/notifications/${id}/read`, {
        method: "PATCH",
      }),
    ...opts?.mutation,
  });

// Mark all notifications as read
export const useMarkAllNotificationsRead = (
  opts?: MutationOpts<{message: string, updated: string}, void>
) =>
  useMutation<{message: string, updated: string}, Error>({
    mutationFn: () =>
      customFetch<{message: string, updated: string}>("/api/notifications/read-all", {
        method: "PATCH",
      }),
    ...opts?.mutation,
  });

// Clear (delete) all notifications
export const useClearAllNotifications = (
  opts?: MutationOpts<{message: string, deleted: number}, void>
) =>
  useMutation<{message: string, deleted: number}, Error>({
    mutationFn: () =>
      customFetch<{message: string, deleted: number}>("/api/notifications/clear-all", {
        method: "DELETE",
      }),
    ...opts?.mutation,
  });


// Avatar: upload
export const useUploadAvatar = (
  opts?: MutationOpts<{ success: boolean; avatar_url: string }, File>
) =>
  useMutation<{ success: boolean; avatar_url: string }, Error, File>({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return customFetch<{ success: boolean; avatar_url: string }>("/api/profile/avatar", {
        method: "POST",
        body: form,
      });
    },
    ...opts?.mutation,
  });

// Avatar: delete
export const useDeleteAvatar = (
  opts?: MutationOpts<{ success: boolean }, void>
) =>
  useMutation<{ success: boolean }, Error>({
    mutationFn: () =>
      customFetch<{ success: boolean }>("/api/profile/avatar", { method: "DELETE" }),
    ...opts?.mutation,
  });


export interface AccountActivity {
  id: number;
  activity_type: string;
  description: string;
  amount: number | null;
  credits_changed: number | null;
  created_at: string;
}

// Get user account activity
export const useAccountActivity = (opts?: QueryOpts<AccountActivity[]>) =>
  useQuery<AccountActivity[], Error>({
    queryKey: ["/api/account/activity"],
    queryFn: () => customFetch<AccountActivity[]>("/api/account/activity"),
    ...opts?.query,
  });

// ── Recent Updates Interfaces ────────────────────────────────────────────────
export interface RecentUpdate {
  id: number;
  title: string;
  description: string;
  badge: string;
  badge_color: string;
  created_at: string;
}

export interface AdminRecentUpdate extends RecentUpdate {
  is_active: boolean;
  sort_order: number;
  updated_at: string;
}

export interface CreateRecentUpdateRequest {
  title: string;
  description?: string;
  badge?: string;
  badge_color?: string;
  sort_order?: number;
  is_active?: boolean;
}

// ── Recent Updates Hooks ─────────────────────────────────────────────────────
export const useGetUpdates = (opts?: QueryOpts<RecentUpdate[]>) =>
  useQuery<RecentUpdate[], Error>({
    queryKey: ["/api/updates"],
    queryFn: async () => {
      const res = await customFetch<any>("/api/updates");
      return Array.isArray(res) ? res : [];
    },
    ...opts?.query,
  });

export const useAdminListUpdates = (opts?: QueryOpts<AdminRecentUpdate[]>) =>
  useQuery<AdminRecentUpdate[], Error>({
    queryKey: ["/api/admin/updates"],
    queryFn: async () => {
      const res = await customFetch<any>("/api/admin/updates");
      return Array.isArray(res) ? res : [];
    },
    ...opts?.query,
  });

export const useAdminCreateUpdate = (
  opts?: MutationOpts<SuccessResponse & { id: number }, { data: CreateRecentUpdateRequest }>
) =>
  useMutation<SuccessResponse & { id: number }, Error, { data: CreateRecentUpdateRequest }>({
    mutationFn: ({ data }) =>
      customFetch<SuccessResponse & { id: number }>("/api/admin/updates", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ...opts?.mutation,
  });

export const useAdminUpdateUpdate = (
  opts?: MutationOpts<SuccessResponse, { id: number; data: Partial<CreateRecentUpdateRequest> }>
) =>
  useMutation<SuccessResponse, Error, { id: number; data: Partial<CreateRecentUpdateRequest> }>({
    mutationFn: ({ id, data }) =>
      customFetch<SuccessResponse>(`/api/admin/updates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    ...opts?.mutation,
  });

export const useAdminDeleteUpdate = (
  opts?: MutationOpts<SuccessResponse, { id: number }>
) =>
  useMutation<SuccessResponse, Error, { id: number }>({
    mutationFn: ({ id }) =>
      customFetch<SuccessResponse>(`/api/admin/updates/${id}`, { method: "DELETE" }),
    ...opts?.mutation,
  });

