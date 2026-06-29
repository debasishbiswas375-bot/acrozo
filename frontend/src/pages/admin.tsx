import { useState, Fragment as ReactFragment } from "react";
import { useLocation } from "wouter";
import {
  useAdminListUsers,
  useAdminUpdateCredits,
  useAdminUpdatePlan,
  useAdminUpdateExpiry,
  useAdminSendNotification,
  useAdminListPlans,
  useAdminCreatePlan,
  useAdminUpdatePlanById,
  useAdminDeletePlan,
  useAdminGetSettings,
  useAdminUpdateSetting,
  useDashboardStats,
  useDashboardPlanDistribution,
  useDashboardMonthlyData,
  useDashboardRecentActivity,
  useAdminListUpdates,
  useAdminCreateUpdate,
  useAdminUpdateUpdate,
  useAdminDeleteUpdate,
} from "@/lib/api-client";
import type { Plan, AdminRecentUpdate, CreateRecentUpdateRequest } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { clearToken } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { usePlanColors } from "@/contexts/plan-colors-context";
import PlanColorSidePanel from "@/components/plan-color-side-panel";
import { Palette, Key, Search, Filter, User, Mail, Phone, MapPin, Plus, Trash2, Edit3, CheckCircle, XCircle } from "lucide-react";
import { formatPrice } from "@/lib/currency";
import AdminDashboard from "@/components/admin-dashboard";
import { useAdminResetPassword } from "@/lib/api-client";
import { formatDate } from "@/lib/date-utils";
import PasswordInput from "@/components/password-input";

type Tab = "dashboard" | "users" | "plans" | "updates" | "notify" | "settings";

interface PlanFormData {
  name: string;
  price: number;
  credits: number;
  duration_days: number;
  features: string[];
  expiry: string | null;
  is_active?: boolean;
}

function PlanBadge({ plan }: { plan: string }) {
  const { getPlanColor } = usePlanColors();
  const color = getPlanColor(plan);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color.bgColor} ${color.textColor}`}>
      {plan}
    </span>
  );
}

const EMPTY_PLAN: PlanFormData = { name: "", price: 0, credits: 0, duration_days: 30, features: [""], expiry: null };

export default function AdminPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const { getPlanColor, updatePlanColor } = usePlanColors();

  // Helper function for form field handling
  const field = (key: keyof PlanFormData) => ({
    value: planForm[key] as string | number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.type === "number" ? Number(e.target.value) : e.target.value;
      setPlanForm({ ...planForm, [key]: val });
    }
  });

  // ── Users ────────────────────────────────────────
  const { data: usersData, isLoading: usersLoading } = useAdminListUsers();
  const users = usersData || [];
  const updateCredits = useAdminUpdateCredits();
  const updatePlan = useAdminUpdatePlan();
  const updateExpiry = useAdminUpdateExpiry();
  const resetPassword = useAdminResetPassword();
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [creditsInput, setCreditsInput] = useState("");
  const [planInput, setPlanInput] = useState("Free");
  const [expiryInput, setExpiryInput] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [showPasswordReset, setShowPasswordReset] = useState<number | null>(null);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [adminFilter, setAdminFilter] = useState<string>("all");

  // ── Plans ────────────────────────────────────────
  const { data: plansData, isLoading: plansLoading } = useAdminListPlans();
  const plans = plansData || [];
  const createPlan = useAdminCreatePlan();
  const updatePlanById = useAdminUpdatePlanById();
  const deletePlan = useAdminDeletePlan();

  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [planForm, setPlanForm] = useState<PlanFormData>(EMPTY_PLAN);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // ── Notify ───────────────────────────────────────────────
  const sendNotification = useAdminSendNotification();
  const [notifUserId, setNotifUserId] = useState<number | null>(null);
  const [notifMessage, setNotifMessage] = useState("");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBroadcast, setNotifBroadcast] = useState(false);
  const [notifAsAnnouncement, setNotifAsAnnouncement] = useState(false);
  const [notifSendEmail, setNotifSendEmail] = useState(false);
  const [notifEmailSubject, setNotifEmailSubject] = useState("");

  // ── Settings ──────────────────────────────────────────────
  const { data: settings, isLoading: settingsLoading } = useAdminGetSettings();
  const updateSetting = useAdminUpdateSetting();
  const [selectedDefaultPlan, setSelectedDefaultPlan] = useState<string>("");
  // Credit pricing state
  const [manualVoucherCost, setManualVoucherCost] = useState<string>("");
  const [aiStatementCost, setAiStatementCost] = useState<string>("");
  const [pdfPageCost, setPdfPageCost] = useState<string>("");
  const [savingPricing, setSavingPricing] = useState(false);

  // ── Recent Updates ─────────────────────────────────────────
  const { data: updatesData, isLoading: updatesLoading } = useAdminListUpdates();
  const updates = updatesData || [];
  const createUpdate = useAdminCreateUpdate();
  const updateUpdate = useAdminUpdateUpdate();
  const deleteUpdate = useAdminDeleteUpdate();

  const [editingUpdate, setEditingUpdate] = useState<AdminRecentUpdate | null>(null);
  const [showCreateUpdateForm, setShowCreateUpdateForm] = useState(false);
  const [updateForm, setUpdateForm] = useState<CreateRecentUpdateRequest>({
    title: "",
    description: "",
    badge: "New",
    badge_color: "green",
    sort_order: 0,
    is_active: true
  });
  const [deleteUpdateConfirm, setDeleteUpdateConfirm] = useState<number | null>(null);

  const handleCreateUpdate = async () => {
    if (!updateForm.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    try {
      await createUpdate.mutateAsync({ data: updateForm });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/updates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/updates"] });
      toast({ title: "Recent update created successfully" });
      setShowCreateUpdateForm(false);
      setUpdateForm({ title: "", description: "", badge: "New", badge_color: "green", sort_order: 0, is_active: true });
    } catch (e: unknown) {
      toast({ title: "Failed to create update", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const handleUpdateUpdate = async () => {
    if (!editingUpdate) return;
    if (!editingUpdate.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    try {
      await updateUpdate.mutateAsync({
        id: editingUpdate.id,
        data: {
          title: editingUpdate.title,
          description: editingUpdate.description,
          badge: editingUpdate.badge,
          badge_color: editingUpdate.badge_color,
          sort_order: editingUpdate.sort_order,
          is_active: editingUpdate.is_active,
        }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/updates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/updates"] });
      toast({ title: "Update saved successfully" });
      setEditingUpdate(null);
    } catch (e: unknown) {
      toast({ title: "Failed to update", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const handleDeleteUpdate = async (id: number) => {
    try {
      await deleteUpdate.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/updates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/updates"] });
      toast({ title: "Update deleted" });
      setDeleteUpdateConfirm(null);
    } catch (e: unknown) {
      toast({ title: "Failed to delete", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  // ── Handlers ─────────────────────────────────────────────
  const handleUpdateCredits = async (userId: number) => {
    const credits = parseInt(creditsInput, 10);
    if (isNaN(credits) || credits < 0) { toast({ title: "Invalid credits", variant: "destructive" }); return; }
    try {
      await updateCredits.mutateAsync({ id: userId, data: { credits } });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Credits updated" });
      setEditingUserId(null);
    } catch (e: unknown) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const handleUpdatePlan = async (userId: number) => {
    try {
      await updatePlan.mutateAsync({ id: userId, data: { plan: planInput } });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Plan updated" });
      setEditingUserId(null);
    } catch (e: unknown) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const handleUpdateExpiry = async (userId: number) => {
    try {
      await updateExpiry.mutateAsync({ id: userId, data: { expiry: expiryInput } });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Expiry updated", description: `User expiry set to: ${expiryInput || 'No expiry'}` });
      setEditingUserId(null);
    } catch (e: unknown) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const handleResetPassword = async (userId: number) => {
    if (!passwordInput.trim()) {
      toast({ title: "Password required", description: "Please enter a new password", variant: "destructive" });
      return;
    }
    if (passwordInput.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    try {
      await resetPassword.mutateAsync({ id: userId, data: { newPassword: passwordInput } });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Password reset", description: "User password has been reset successfully" });
      setShowPasswordReset(null);
      setPasswordInput("");
    } catch (e: unknown) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  // Filter users based on search and filters
  const filteredUsers = users?.filter(user => {
    const searchMatch = searchTerm === "" ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.phone && user.phone.toLowerCase().includes(searchTerm.toLowerCase()));

    const planMatch = planFilter === "all" || user.plan === planFilter;
    const adminMatch = adminFilter === "all" ||
      (adminFilter === "admin" && user.is_admin) ||
      (adminFilter === "user" && !user.is_admin);

    return searchMatch && planMatch && adminMatch;
  }) || [];

  const handleCreatePlan = async () => {
    if (!planForm.name.trim()) { toast({ title: "Plan name is required", variant: "destructive" }); return; }
    try {
      const features = planForm.features.map(f => f.trim()).filter(Boolean);
      await createPlan.mutateAsync({ data: { ...planForm, features } });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      toast({ title: "Plan created" });
      setShowCreateForm(false);
      setPlanForm(EMPTY_PLAN);
    } catch (e: unknown) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const handleUpdatePlanById = async () => {
    if (!editingPlan) return;
    try {
      const features = editingPlan.features.map(f => f.trim()).filter(Boolean);
      await updatePlanById.mutateAsync({ id: editingPlan.id, data: { ...editingPlan, features } });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      toast({ title: "Plan updated" });
      setEditingPlan(null);
    } catch (e: unknown) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const handleDeletePlan = async (id: number) => {
    try {
      await deletePlan.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      toast({ title: "Plan deleted" });
      setDeleteConfirm(null);
    } catch (e: unknown) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const handleSaveDefaultPlan = async () => {
    const plan = selectedDefaultPlan || settings?.default_signup_plan || "Free";
    try {
      await updateSetting.mutateAsync({ data: { key: "default_signup_plan", value: plan } });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Default signup plan saved", description: `New users will receive the ${plan} plan on signup.` });
    } catch (e: unknown) {
      toast({ title: "Failed to save", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const handleSendNotification = async () => {
    if (!notifMessage.trim()) { toast({ title: "Enter a message", variant: "destructive" }); return; }
    if (!notifBroadcast && !notifUserId) { toast({ title: "Select a user or enable broadcast", variant: "destructive" }); return; }
    try {
      await sendNotification.mutateAsync({
        data: {
          user_id: notifBroadcast ? null : notifUserId!,
          message: notifMessage,
          title: notifTitle || undefined,
          broadcast: notifBroadcast,
          as_announcement: notifAsAnnouncement,
          send_email: notifSendEmail,
          email_subject: notifSendEmail ? (notifEmailSubject.trim() || notifTitle.trim() || "Message from Acrozo") : undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      toast({ title: notifAsAnnouncement ? "Announcement posted" : "Notification sent" });
      setNotifMessage(""); setNotifTitle(""); setNotifUserId(null);
      setNotifBroadcast(false); setNotifAsAnnouncement(false);
      setNotifSendEmail(false); setNotifEmailSubject("");
    } catch (e: unknown) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  // Helper function to parse plan features
  const parsePlanFeatures = (features: string | string[]): string[] => {
    if (typeof features === 'string') {
      try {
        const parsed = JSON.parse(features);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(features) ? features : [];
  };

  // Feature list helpers
  const updateFeature = (list: string[], i: number, val: string) => list.map((f, idx) => idx === i ? val : f);
  const removeFeature = (list: string[], i: number) => list.filter((_, idx) => idx !== i);

  return (
    <div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage users, plans, and notifications</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-6 border-b border-border">
          {([["dashboard", "Dashboard"], ["users", "Users"], ["plans", "Plans"], ["updates", "Recent Updates"], ["notify", "Send Notification"], ["settings", "Settings"]] as [Tab, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── DASHBOARD TAB ─────────────────────────────────────── */}
        {activeTab === "dashboard" && (
          <AdminDashboard />
        )}

        {/* ── USERS TAB ─────────────────────────────────────────── */}
        {activeTab === "users" && (
          <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
            {/* Search and Filter Bar */}
            <div className="border-b border-border bg-muted/30 p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search by username, email, or phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* Filters */}
                <div className="flex gap-3">
                  {/* Plan Filter */}
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <select
                      value={planFilter}
                      onChange={(e) => setPlanFilter(e.target.value)}
                      className="px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="all">All Plans</option>
                      {(plans ?? []).filter(p => p.is_active).map(plan => (
                        <option key={plan.name} value={plan.name}>{plan.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Admin Filter */}
                  <select
                    value={adminFilter}
                    onChange={(e) => setAdminFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="all">All Users</option>
                    <option value="admin">Admin Only</option>
                    <option value="user">Regular Users</option>
                  </select>
                </div>
              </div>

              {/* Results Count */}
              <div className="mt-3 text-sm text-muted-foreground">
                Showing {filteredUsers.length} of {users?.length || 0} users
                {(searchTerm || planFilter !== "all" || adminFilter !== "all") && (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setPlanFilter("all");
                      setAdminFilter("all");
                    }}
                    className="ml-2 text-primary hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {/* Users Table */}
            {usersLoading ? (
              <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : filteredUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      {["User", "Contact", "Address", "Plan", "Credits", "Expiry", "Joined", ""].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <ReactFragment key={user.id}>
                        <tr className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {/* User Icon */}
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                                <User className="w-5 h-5 text-primary" />
                              </div>

                              {/* User Info */}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-foreground">{user.username}</span>
                                  {user.is_admin && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">Admin</span>}
                                </div>
                                {user.full_name && user.full_name !== user.username && (
                                  <div className="text-xs text-muted-foreground">{user.full_name}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              {user.email && (
                                <div className="flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                                </div>
                              )}
                              {user.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">{user.phone}</span>
                                </div>
                              )}
                              {!user.email && !user.phone && (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {(user.address_line || user.city || user.state) ? (
                              <div className="space-y-1">
                                {user.address_line && (
                                  <div className="text-xs text-muted-foreground truncate" style={{ maxWidth: '200px' }}>
                                    {user.address_line}
                                  </div>
                                )}
                                {(user.city || user.state) && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      {[user.city, user.state].filter(Boolean).join(", ")}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3"><PlanBadge plan={user.plan} /></td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{user.credits?.toLocaleString() || 0}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(user.expiry)}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(user.created_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <button onClick={() => {
                                setEditingUserId(editingUserId === user.id ? null : user.id);
                                setCreditsInput(String(user?.credits || 0));
                                setPlanInput(user?.plan || "Free");
                                setExpiryInput(user?.expiry || null);
                              }}
                                className="px-3 py-1 text-xs font-medium text-primary border border-primary/30 rounded-md hover:bg-primary/10 transition-colors">
                                {editingUserId === user.id ? "Cancel" : "Edit"}
                              </button>
                              <button
                                onClick={() => {
                                  setShowPasswordReset(showPasswordReset === user.id ? null : user.id);
                                  setPasswordInput("");
                                }}
                                className="px-3 py-1 text-xs font-medium text-orange-600 border border-orange-200 rounded-md hover:bg-orange-50 transition-colors flex items-center gap-1"
                              >
                                <Key className="w-3 h-3" />
                                {showPasswordReset === user.id ? "Cancel" : "Reset"}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {editingUserId === user.id && (
                          <tr key={`edit-${user.id}`} className="bg-accent/20 border-b border-border">
                            <td colSpan={8} className="px-4 py-4">
                              <div className="flex flex-wrap gap-6">
                                <div className="flex items-center gap-2">
                                  <label className="text-xs font-medium text-muted-foreground">Credits:</label>
                                  <input type="number" value={creditsInput} onChange={e => setCreditsInput(e.target.value)} className="w-24 px-2 py-1.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                                  <button onClick={() => handleUpdateCredits(user.id)} disabled={updateCredits.isPending} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-60">Update Credits</button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="text-xs font-medium text-muted-foreground">Plan:</label>
                                  <select value={planInput} onChange={e => setPlanInput(e.target.value)} className="px-2 py-1.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring">
                                    {(plans ?? []).filter(p => p.is_active).map(p => (
                                      <option key={p.id} value={p.name}>{p.name}</option>
                                    ))}
                                  </select>
                                  <button onClick={() => handleUpdatePlan(user.id)} disabled={updatePlan.isPending} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-60">Update Plan</button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="text-xs font-medium text-muted-foreground">Expiry:</label>
                                  <input
                                    type="date"
                                    value={expiryInput || ""}
                                    onChange={(e) => setExpiryInput(e.target.value || null)}
                                    className="px-2 py-1 text-xs border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                                  />
                                  <button onClick={() => handleUpdateExpiry(user.id)} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:opacity-90">Update Expiry</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        {showPasswordReset === user.id && (
                          <tr key={`password-${user.id}`} className="bg-orange-50/50 border-b border-border">
                            <td colSpan={8} className="px-4 py-4">
                              <div className="flex items-center gap-4">
                                <Key className="w-4 h-4 text-orange-600" />
                                <label className="text-xs font-medium text-muted-foreground">New Password:</label>
                                <PasswordInput
                                  value={passwordInput}
                                  onChange={e => setPasswordInput(e.target.value)}
                                  placeholder="Enter new password (min 6 chars)"
                                  className="w-48 px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                                <button
                                  onClick={() => handleResetPassword(user.id)}
                                  disabled={resetPassword.isPending}
                                  className="px-4 py-2 text-xs bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-60 flex items-center gap-2"
                                >
                                  <Key className="w-3 h-3" />
                                  Reset Password
                                </button>
                                <span className="text-xs text-muted-foreground">Password must be at least 6 characters</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </ReactFragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : users && users.length > 0 ? (
              <div className="text-center py-20">
                <p className="text-muted-foreground">No users found matching your criteria</p>
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setPlanFilter("all");
                    setAdminFilter("all");
                  }}
                  className="mt-2 text-primary hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="text-center py-20"><p className="text-muted-foreground">No users found</p></div>
            )}
          </div>
        )}

        {/* ── PLANS TAB ─────────────────────────────────────────── */}
        {activeTab === "plans" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{plans?.length ?? 0} plans configured</p>
              <button onClick={() => { setShowCreateForm(true); setEditingPlan(null); setPlanForm(EMPTY_PLAN); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                New Plan
              </button>
            </div>

            {/* Create form */}
            {showCreateForm && (
              <PlanForm
                title="Create New Plan"
                form={planForm}
                onChange={setPlanForm}
                onSave={handleCreatePlan}
                onCancel={() => setShowCreateForm(false)}
                saving={createPlan.isPending}
              />
            )}

            {/* Edit form */}
            {editingPlan && (
              <PlanForm
                title={`Edit Plan — ${editingPlan.name}`}
                form={editingPlan}
                onChange={val => setEditingPlan(prev => prev ? { ...prev, ...val } : prev)}
                onSave={handleUpdatePlanById}
                onCancel={() => setEditingPlan(null)}
                saving={updatePlanById.isPending}
                showActive
              />
            )}

            {/* Plans grid */}
            {plansLoading ? (
              <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(plans ?? []).map(plan => (
                  <div key={plan.id} className={`bg-card border rounded-xl p-5 shadow-sm relative ${plan.is_active ? "border-card-border" : "border-border opacity-60"}`}>
                    {!plan.is_active && (
                      <div className="absolute top-3 right-3">
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Inactive</span>
                      </div>
                    )}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <PlanBadge plan={plan.name} />
                      </div>
                      <p className="text-2xl font-bold text-foreground mt-2">
                        {plan.name.toLowerCase() === "unlimited" ? "Unlimited" : formatPrice(plan.price)}
                        {plan.price > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                      </p>
                    </div>

                    <div className="space-y-1.5 mb-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1" /></svg>
                        <span>{plan?.credits?.toLocaleString() || "0"} credits / {plan?.duration_days || 0} days</span>
                      </div>
                      {parsePlanFeatures(plan.features).map((f: string, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-border">
                      <button onClick={() => { setEditingPlan(plan); setShowCreateForm(false); }}
                        className="flex-1 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-md hover:bg-primary/10 transition-colors">
                        Edit
                      </button>
                      {deleteConfirm === plan.id ? (
                        <div className="flex gap-1.5">
                          <button onClick={() => handleDeletePlan(plan.id)} disabled={deletePlan.isPending}
                            className="flex-1 py-1.5 text-xs font-medium text-white bg-destructive rounded-md hover:opacity-90 disabled:opacity-60 px-2">
                            Confirm
                          </button>
                          <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-md hover:bg-muted/50 px-2">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(plan.id)}
                          className="py-1.5 px-3 text-xs font-medium text-destructive border border-destructive/30 rounded-md hover:bg-destructive/10 transition-colors">
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS TAB ──────────────────────────────────────── */}
        {activeTab === "settings" && (
          <div className="space-y-6 max-w-xl">
            <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-muted/30">
                <h2 className="text-base font-semibold text-foreground">Signup Settings</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Configure what new users receive when they create an account</p>
              </div>

              <div className="px-6 py-5 space-y-5">
                {settingsLoading ? (
                  <div className="flex items-center gap-2 py-4">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading settings…</span>
                  </div>
                ) : (
                  <ReactFragment>
                    {/* Current value display */}
                    <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-foreground">
                        Current default:{" "}
                        <span className="font-semibold text-primary">{settings?.default_signup_plan ?? "Free"}</span>
                        {" "}plan
                      </p>
                    </div>

                    {/* Selector */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Default Signup Plan
                      </label>
                      <p className="text-xs text-muted-foreground mb-3">
                        New users will automatically receive this plan with its credits and duration at no cost when they sign up.
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {(plans ?? []).filter(p => p.is_active).map(plan => {
                          const current = settings?.default_signup_plan ?? "Free";
                          const chosen = selectedDefaultPlan || current;
                          const isSelected = chosen === plan.name;
                          return (
                            <button
                              key={plan.id}
                              onClick={() => setSelectedDefaultPlan(plan.name)}
                              className={`flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-all ${isSelected
                                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                                  : "border-border hover:border-primary/40 hover:bg-muted/30"
                                }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "border-primary" : "border-muted-foreground/40"}`}>
                                  {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-foreground">{plan.name}</span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {plan?.credits?.toLocaleString() || "0"} credits · {plan?.duration_days || 0} days
                                  </span>
                                </div>
                              </div>
                              <span className="text-sm font-semibold text-foreground">
                                {plan.name.toLowerCase() === "unlimited" ? "Unlimited" : formatPrice(Number(plan.price))}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      onClick={handleSaveDefaultPlan}
                      disabled={updateSetting.isPending || (!selectedDefaultPlan && !settings?.default_signup_plan)}
                      className="w-full py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity text-sm"
                    >
                      {updateSetting.isPending ? "Saving…" : "Save Default Plan"}
                    </button>
                  </ReactFragment>
                )}
              </div>
            </div>

            {/* ── Credit Pricing Card ───────────────────────────── */}
            <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-muted/30">
                <h2 className="text-base font-semibold text-foreground">Credit Pricing</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Set how many credits are deducted per voucher or per AI statement conversion</p>
              </div>
              <div className="px-6 py-5 space-y-5">
                {settingsLoading ? (
                  <div className="flex items-center gap-2 py-4">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading…</span>
                  </div>
                ) : (
                  <ReactFragment>
                    {/* Current values */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Manual (per voucher)</p>
                        <p className="font-semibold text-primary">{settings?.credit_cost_manual_voucher ?? "0.05"} credits</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">AI Statement (per line)</p>
                        <p className="font-semibold text-primary">{settings?.credit_cost_ai_statement ?? "0.1"} credits</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">PDF Page (per page)</p>
                        <p className="font-semibold text-primary">{settings?.credit_cost_pdf_page ?? "0.1"} credits</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">
                          Manual Voucher Cost
                          <span className="text-xs text-muted-foreground ml-1">(credits per voucher)</span>
                        </label>
                        <input
                          type="number" step="0.01" min="0"
                          className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder={settings?.credit_cost_manual_voucher ?? "0.05"}
                          value={manualVoucherCost}
                          onChange={e => setManualVoucherCost(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Deducted when user manually maps each voucher to Suspense</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">
                          AI Statement Cost
                          <span className="text-xs text-muted-foreground ml-1">(credits per transaction line)</span>
                        </label>
                        <input
                          type="number" step="0.01" min="0"
                          className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder={settings?.credit_cost_ai_statement ?? "0.1"}
                          value={aiStatementCost}
                          onChange={e => setAiStatementCost(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Deducted when AI processes entire bank statement automatically</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">
                          PDF Page Cost
                          <span className="text-xs text-muted-foreground ml-1">(credits per PDF page)</span>
                        </label>
                        <input
                          type="number" step="0.01" min="0"
                          className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder={settings?.credit_cost_pdf_page ?? "0.1"}
                          value={pdfPageCost}
                          onChange={e => setPdfPageCost(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Deducted per page when using Acrozo PDF/Image conversion tools</p>
                      </div>
                    </div>

                    <button
                      disabled={savingPricing || (!manualVoucherCost && !aiStatementCost && !pdfPageCost)}
                      onClick={async () => {
                        setSavingPricing(true);
                        try {
                          if (manualVoucherCost) {
                            await updateSetting.mutateAsync({ data: { key: "credit_cost_manual_voucher", value: manualVoucherCost } });
                          }
                          if (aiStatementCost) {
                            await updateSetting.mutateAsync({ data: { key: "credit_cost_ai_statement", value: aiStatementCost } });
                          }
                          if (pdfPageCost) {
                            await updateSetting.mutateAsync({ data: { key: "credit_cost_pdf_page", value: pdfPageCost } });
                          }
                          queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
                          setManualVoucherCost("");
                          setAiStatementCost("");
                          setPdfPageCost("");
                          toast({ title: "Credit pricing updated", description: "New rates will apply to all future conversions." });
                        } catch {
                          toast({ title: "Failed to save", variant: "destructive" });
                        } finally {
                          setSavingPricing(false);
                        }
                      }}
                      className="w-full py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity text-sm"
                    >
                      {savingPricing ? "Saving…" : "Save Credit Pricing"}
                    </button>
                  </ReactFragment>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── UPDATES TAB ────────────────────────────────────────── */}
        {activeTab === "updates" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Recent Updates Manager</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Manage news, updates, and announcements shown in the user dashboard sidebar</p>
              </div>
              <button
                onClick={() => {
                  setShowCreateUpdateForm(!showCreateUpdateForm);
                  setEditingUpdate(null);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                {showCreateUpdateForm ? "Close Form" : "New Update"}
              </button>
            </div>

            {/* Create form */}
            {showCreateUpdateForm && (
              <div className="bg-card border border-primary/20 rounded-xl p-6 shadow-sm max-w-xl">
                <h3 className="text-sm font-semibold text-foreground mb-4">Create New Update</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Title *</label>
                    <input
                      type="text"
                      value={updateForm.title}
                      onChange={e => setUpdateForm({ ...updateForm, title: e.target.value })}
                      placeholder="e.g. Payment Gateway Integration"
                      className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Description</label>
                    <textarea
                      value={updateForm.description}
                      onChange={e => setUpdateForm({ ...updateForm, description: e.target.value })}
                      placeholder="e.g. Pay using secure checkout for instant plan activation"
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Badge Text</label>
                      <input
                        type="text"
                        value={updateForm.badge}
                        onChange={e => setUpdateForm({ ...updateForm, badge: e.target.value })}
                        placeholder="e.g. New, Updated, Feature"
                        className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Badge Color</label>
                      <select
                        value={updateForm.badge_color}
                        onChange={e => setUpdateForm({ ...updateForm, badge_color: e.target.value })}
                        className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="green">Green (New)</option>
                        <option value="blue">Blue (Updated)</option>
                        <option value="purple">Purple (Security)</option>
                        <option value="orange">Orange (Feature)</option>
                        <option value="red">Red (Alert)</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Sort Order</label>
                      <input
                        type="number"
                        value={updateForm.sort_order}
                        onChange={e => setUpdateForm({ ...updateForm, sort_order: Number(e.target.value) })}
                        placeholder="0"
                        className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-6">
                      <input
                        id="new_update_active"
                        type="checkbox"
                        checked={updateForm.is_active}
                        onChange={e => setUpdateForm({ ...updateForm, is_active: e.target.checked })}
                        className="w-4 h-4 rounded border-input accent-primary"
                      />
                      <label htmlFor="new_update_active" className="text-xs font-medium text-muted-foreground uppercase cursor-pointer">Active / Visible</label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleCreateUpdate}
                      disabled={createUpdate.isPending}
                      className="px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60 transition-opacity"
                    >
                      {createUpdate.isPending ? "Creating..." : "Create Update"}
                    </button>
                    <button
                      onClick={() => setShowCreateUpdateForm(false)}
                      className="px-5 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edit form */}
            {editingUpdate && (
              <div className="bg-card border border-primary/20 rounded-xl p-6 shadow-sm max-w-xl">
                <h3 className="text-sm font-semibold text-foreground mb-4 font-semibold">Edit Update</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Title *</label>
                    <input
                      type="text"
                      value={editingUpdate.title}
                      onChange={e => setEditingUpdate({ ...editingUpdate, title: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Description</label>
                    <textarea
                      value={editingUpdate.description}
                      onChange={e => setEditingUpdate({ ...editingUpdate, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Badge Text</label>
                      <input
                        type="text"
                        value={editingUpdate.badge}
                        onChange={e => setEditingUpdate({ ...editingUpdate, badge: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Badge Color</label>
                      <select
                        value={editingUpdate.badge_color}
                        onChange={e => setEditingUpdate({ ...editingUpdate, badge_color: e.target.value })}
                        className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="green">Green (New)</option>
                        <option value="blue">Blue (Updated)</option>
                        <option value="purple">Purple (Security)</option>
                        <option value="orange">Orange (Feature)</option>
                        <option value="red">Red (Alert)</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Sort Order</label>
                      <input
                        type="number"
                        value={editingUpdate.sort_order}
                        onChange={e => setEditingUpdate({ ...editingUpdate, sort_order: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-6">
                      <input
                        id="edit_update_active"
                        type="checkbox"
                        checked={editingUpdate.is_active}
                        onChange={e => setEditingUpdate({ ...editingUpdate, is_active: e.target.checked })}
                        className="w-4 h-4 rounded border-input accent-primary"
                      />
                      <label htmlFor="edit_update_active" className="text-xs font-medium text-muted-foreground uppercase cursor-pointer">Active / Visible</label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleUpdateUpdate}
                      disabled={updateUpdate.isPending}
                      className="px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60 transition-opacity"
                    >
                      {updateUpdate.isPending ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      onClick={() => setEditingUpdate(null)}
                      className="px-5 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Updates list */}
            <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
              {updatesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : updates.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Badge</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Update Details</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Created At</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {updates.map((up) => {
                        let colorClass = "text-green-600 bg-green-50 dark:bg-green-500/10 dark:text-green-400";
                        if (up.badge_color === "blue") colorClass = "text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400";
                        else if (up.badge_color === "purple") colorClass = "text-purple-600 bg-purple-50 dark:bg-purple-500/10 dark:text-purple-400";
                        else if (up.badge_color === "orange") colorClass = "text-orange-600 bg-orange-50 dark:bg-orange-500/10 dark:text-orange-400";
                        else if (up.badge_color === "red") colorClass = "text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400";

                        return (
                          <tr key={up.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${colorClass}`}>
                                {up.badge}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-sm">
                              <p className="text-sm font-semibold text-foreground truncate">{up.title}</p>
                              {up.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{up.description}</p>}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {up.sort_order}
                            </td>
                            <td className="px-4 py-3">
                              {up.is_active ? (
                                <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                                  <XCircle className="w-3.5 h-3.5" />
                                  Hidden
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {formatDate(up.created_at)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={() => {
                                    setEditingUpdate(up);
                                    setShowCreateUpdateForm(false);
                                  }}
                                  className="p-1 text-muted-foreground hover:text-primary transition-colors"
                                  title="Edit Update"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                {deleteUpdateConfirm === up.id ? (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => handleDeleteUpdate(up.id)}
                                      disabled={deleteUpdate.isPending}
                                      className="px-2 py-1 text-[10px] font-bold text-white bg-destructive rounded"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      onClick={() => setDeleteUpdateConfirm(null)}
                                      className="px-2 py-1 text-[10px] text-muted-foreground border border-border rounded"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeleteUpdateConfirm(up.id)}
                                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                                    title="Delete Update"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No recent updates configured yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Create one to display it on the user dashboard</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── NOTIFY TAB ────────────────────────────────────────── */}
        {activeTab === "notify" && (
          <div className="bg-card border border-card-border rounded-xl shadow-sm p-6 max-w-lg">
            <h2 className="text-base font-semibold text-foreground mb-4">Send Notification</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={notifBroadcast} onChange={e => setNotifBroadcast(e.target.checked)} className="rounded" />
                <span>Broadcast to all users</span>
              </label>

              {!notifBroadcast && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Select User</label>
                  <select value={notifUserId ?? ""} onChange={e => setNotifUserId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Choose a user...</option>
                    {users?.map(u => <option key={u.id} value={u.id}>{u.username}{u.email ? ` (${u.email})` : ""}</option>)}
                  </select>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={notifAsAnnouncement} onChange={e => setNotifAsAnnouncement(e.target.checked)} className="rounded" />
                <span>Also post as announcement on dashboard</span>
              </label>

              {notifAsAnnouncement && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Announcement Title</label>
                  <input type="text" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} placeholder="e.g. New feature released"
                    className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Message</label>
                <textarea value={notifMessage} onChange={e => setNotifMessage(e.target.value)} placeholder="Enter message..." rows={4}
                  className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>

              {/* ── Brevo email option ── */}
              <div className="border border-input rounded-lg p-3 space-y-3 bg-muted/30">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={notifSendEmail} onChange={e => setNotifSendEmail(e.target.checked)} className="rounded" />
                  <span className="font-medium">Also send as email via Brevo</span>
                </label>
                {notifSendEmail && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Email Subject</label>
                    <input
                      type="text"
                      value={notifEmailSubject}
                      onChange={e => setNotifEmailSubject(e.target.value)}
                      placeholder={notifTitle.trim() || "Message from Acrozo"}
                      className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {notifBroadcast ? "Email will be sent to all users with a registered email." : "Email will be sent to the selected user's registered email."}
                    </p>
                  </div>
                )}
              </div>

              <button onClick={handleSendNotification}
                disabled={sendNotification.isPending || !notifMessage.trim() || (!notifBroadcast && !notifUserId)}
                className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity text-sm">
                {sendNotification.isPending ? "Sending..." : (notifAsAnnouncement ? "Send & Post Announcement" : notifSendEmail ? "Send Notification + Email" : "Send Notification")}
              </button>
            </div>
          </div>
        )}
      </main>    </div>
  );
}

// ── Plan Form Component ────────────────────────────────────
interface PlanFormData {
  name: string;
  price: number;
  credits: number;
  duration_days: number;
  features: string[];
  expiry: string | null;
  is_active?: boolean;
}

function PlanForm({
  title, form, onChange, onSave, onCancel, saving, showActive,
}: {
  title: string;
  form: PlanFormData;
  onChange: (v: PlanFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  showActive?: boolean;
}) {
  const { getPlanColor, updatePlanColor } = usePlanColors();
  const [isColorPanelOpen, setIsColorPanelOpen] = useState(false);

  const field = (key: keyof PlanFormData) => ({
    value: form[key] as string | number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.type === "number" ? Number(e.target.value) : e.target.value;
      onChange({ ...form, [key]: val });
    },
  });

  return (
    <div className="bg-card border border-primary/20 rounded-xl p-6 shadow-sm">
      <h3 className="text-base font-semibold text-foreground mb-5">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Plan Name *</label>
          <input type="text" placeholder="e.g. Pro" {...field("name")} className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Price (₹/mo)</label>
          <input type="number" min={0} step={0.01} {...field("price")} className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Credits</label>
          <input type="number" min={0} {...field("credits")} className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Duration (days)</label>
          <input type="number" min={1} {...field("duration_days")} className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Plan Color</label>
        <div className="flex items-center gap-3">
          <PlanBadge plan={form.name || "Preview"} />
          <button
            type="button"
            onClick={() => setIsColorPanelOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-muted rounded-md hover:bg-muted/80 transition-colors"
          >
            <Palette className="w-3 h-3" />
            Customize Color
          </button>
          <span className="text-xs text-muted-foreground">Click to choose a color for this plan badge</span>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Features</label>
          <button type="button" onClick={() => onChange({ ...form, features: [...form.features, ""] })}
            className="text-xs text-primary hover:underline">+ Add feature</button>
        </div>
        <div className="space-y-2">
          {form.features.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="text" value={f} onChange={e => onChange({ ...form, features: form.features.map((x, idx) => idx === i ? e.target.value : x) })}
                placeholder={`Feature ${i + 1}`}
                className="flex-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              <button type="button" onClick={() => onChange({ ...form, features: form.features.filter((_, idx) => idx !== i) })}
                className="text-muted-foreground hover:text-destructive transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {showActive && (
        <div className="flex items-center gap-2 mb-4">
          <input id="is_active" type="checkbox" checked={form.is_active ?? true} onChange={e => onChange({ ...form, is_active: e.target.checked })}
            className="w-4 h-4 rounded border-input accent-primary" />
          <label htmlFor="is_active" className="text-sm text-muted-foreground cursor-pointer">Plan is active</label>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={onSave} disabled={saving}
          className="px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60 transition-opacity">
          {saving ? "Saving..." : "Save Plan"}
        </button>
        <button onClick={onCancel} className="px-5 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors">
          Cancel
        </button>
      </div>

      {/* Color Side Panel */}
      <PlanColorSidePanel
        isOpen={isColorPanelOpen}
        onClose={() => setIsColorPanelOpen(false)}
        plan={form.name || "Preview"}
        currentColor={getPlanColor(form.name || "Preview")}
        onColorChange={(color: any) => updatePlanColor(form.name || "Preview", color)}
      />
    </div>
  );
}
