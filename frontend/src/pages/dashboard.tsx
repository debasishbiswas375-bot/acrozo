import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useGetMyPlan, useGetProfile, useGetUpdates, useNotifications } from "@/lib/api-client";
import { clearToken, isAdmin, getToken } from "@/lib/api";
import { usePlanColors } from "@/contexts/plan-colors-context";
import { formatDate } from "@/lib/date-utils";
import { subscribeToUserUpdates, unsubscribeChannel } from "@/lib/supabase";
import { IndianRupee, Bell, Star, Zap, Shield, CheckCircle, Calendar } from "lucide-react";
import Navigation from "@/components/navigation";

function PlanBadge({ plan }: { plan: string }) {
  const { getPlanColor } = usePlanColors();
  const color = getPlanColor(plan);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color.bgColor} ${color.textColor}`}>
      {plan}
    </span>
  );
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? "s" : ""} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? "s" : ""} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}


export default function DashboardPage() {
  const [, navigate] = useLocation();
  const { getPlanColor, updatePlanColor } = usePlanColors();
  const channelRef = useRef<any>(null);

  const { data: planData, isLoading: planLoading, error: planError, refetch: refetchPlan } = useGetMyPlan({
    query: {
      queryKey: ["my-plan"],
      retry: 0,
    },
  });

  const { data: profileData, isLoading: profileLoading, refetch: refetchProfile } = useGetProfile({
    query: {
      queryKey: ["profile"],
      retry: 0,
    },
  });

  const { data: updatesData, isLoading: updatesLoading } = useGetUpdates();
  const updates = updatesData || [];

  // Live notification unread count — same cache as the bell dropdown
  const token = getToken();
  const { data: notificationsData } = useNotifications({ query: { enabled: !!token } });
  const notificationsArray = Array.isArray(notificationsData)
    ? notificationsData
    : (notificationsData as any)?.notifications ?? [];
  const unreadCount = notificationsArray.filter((n: any) => !n.is_read).length;

  // Get user info from token for avatar
  const getUserInfo = () => {
    const token = getToken();
    if (!token) return { username: "", email: "", phone: "" };
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        username: payload.username || "",
        email: payload.email || "",
        phone: payload.phone || ""
      };
    } catch {
      return { username: "", email: "", phone: "" };
    }
  };

  const userInfo = getUserInfo();

  useEffect(() => {
    if (planError) {
      // Don't automatically logout on plan error - just show error state
      console.error("Plan error:", planError);
    }
  }, [planError]);

  // Real-time subscription for user data updates
  useEffect(() => {
    const username = profileData?.username;
    if (!username) return;

    // Subscribe to user updates (credits, plan changes)
    channelRef.current = subscribeToUserUpdates(username, (payload) => {
      console.log('User data updated:', payload);
      // Refetch data when changes occur
      refetchPlan();
      refetchProfile();
    });

    return () => {
      if (channelRef.current) {
        unsubscribeChannel(channelRef.current);
      }
    };
  }, [profileData?.username, refetchPlan, refetchProfile]);

  const handleLogout = () => {
    clearToken();
    navigate("/");
  };

  const isUnlimited = planData?.plan?.toLowerCase() === "unlimited";
  const daysUntilExpiry = planData?.expiry_iso
    ? Math.max(0, Math.ceil((new Date(planData.expiry_iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div>
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {planLoading || profileLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : planData ? (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground">
                Welcome back, <span className="text-primary">{planData?.username || "User"}</span>
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Here's an overview of your account
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Plan</span>
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                </div>
                <div className="mt-1">
                  <PlanBadge plan={planData?.plan || "Free"} />
                </div>
              </div>

              <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Credits</span>
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <IndianRupee className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{isUnlimited ? "Unlimited" : (planData?.credits?.toLocaleString() || "0")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{isUnlimited ? "Unlimited credits" : "Available credits"}</p>
              </div>

              <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Plan Expiry</span>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isUnlimited ? "bg-green-100" : daysUntilExpiry <= 7 ? "bg-red-100" : "bg-amber-100"}`}>
                    <svg className={`w-4 h-4 ${isUnlimited ? "text-green-600" : daysUntilExpiry <= 7 ? "text-red-600" : "text-amber-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <p className="text-base font-semibold text-foreground">{isUnlimited ? "Lifetime" : planData.expiry || "—"}</p>
                <p className={`text-xs mt-0.5 ${isUnlimited ? "text-green-600 font-medium" : daysUntilExpiry <= 7 ? "text-red-500" : "text-muted-foreground"}`}>
                  {isUnlimited ? "Never expires" : daysUntilExpiry === 0 ? "Expires today" : `${daysUntilExpiry} days remaining`}
                </p>
              </div>

              <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notifications</span>
                  <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{unreadCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Unread messages</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
                <h2 className="text-base font-semibold text-foreground mb-4">Account Details</h2>
                <dl className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <dt className="text-sm text-muted-foreground">Username</dt>
                    <dd className="text-sm font-medium text-foreground">{planData.username}</dd>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <dt className="text-sm text-muted-foreground">Email</dt>
                    <dd className="text-sm font-medium text-foreground">{profileData?.email || userInfo.email || "Not provided"}</dd>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <dt className="text-sm text-muted-foreground">Plan</dt>
                    <dd><PlanBadge plan={planData.plan} /></dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-sm text-muted-foreground">Credits</dt>
                    <dd className="text-sm font-medium text-foreground">{isUnlimited ? "Unlimited" : planData.credits.toLocaleString()}</dd>
                  </div>
                </dl>
              </div>

              <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-foreground">Recent Updates</h2>
                  <Bell className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="space-y-4">
                  {updatesLoading ? (
                    <div className="flex justify-center py-4">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : updates.length > 0 ? (
                    updates.map((up) => {
                      let dotColor = "bg-green-500";
                      let badgeColorClass = "text-green-600 bg-green-50 dark:bg-green-500/10 dark:text-green-400";
                      if (up.badge_color === "blue") {
                        dotColor = "bg-blue-500";
                        badgeColorClass = "text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400";
                      } else if (up.badge_color === "purple") {
                        dotColor = "bg-purple-500";
                        badgeColorClass = "text-purple-600 bg-purple-50 dark:bg-purple-500/10 dark:text-purple-400";
                      } else if (up.badge_color === "orange") {
                        dotColor = "bg-orange-500";
                        badgeColorClass = "text-orange-600 bg-orange-50 dark:bg-orange-500/10 dark:text-orange-400";
                      } else if (up.badge_color === "red") {
                        dotColor = "bg-red-500";
                        badgeColorClass = "text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400";
                      }

                      return (
                        <div key={up.id} className="flex items-start gap-3">
                          <div className={`w-2 h-2 ${dotColor} rounded-full mt-2 flex-shrink-0`}></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-foreground">{up.title}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${badgeColorClass}`}>
                                {up.badge}
                              </span>
                            </div>
                            {up.description && <p className="text-xs text-muted-foreground">{up.description}</p>}
                            <p className="text-[10px] text-muted-foreground mt-1">{formatRelativeTime(up.created_at)}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">No recent updates.</p>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
