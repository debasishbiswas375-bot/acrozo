import { useState } from "react";
import { 
  Users, 
  TrendingUp, 
  IndianRupee, 
  CreditCard, 
  Megaphone,
  BarChart3,
  PieChart,
  LineChart,
  ArrowUp,
  ArrowDown,
  Activity,
  Trash2
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  useDashboardStats, 
  useDashboardPlanDistribution, 
  useDashboardMonthlyData, 
  useAdminAnnouncements,
  useAdminDeleteAnnouncement
} from "@/lib/api-client";

export default function AdminDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch real data
  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats();
  const { data: planDistribution, isLoading: plansLoading, error: plansError } = useDashboardPlanDistribution();
  const { data: monthlyData, isLoading: monthlyLoading, error: monthlyError } = useDashboardMonthlyData();
  const { data: announcements, isLoading: activityLoading, error: activityError } = useAdminAnnouncements();
  const deleteAnnouncement = useAdminDeleteAnnouncement();

  const handleDeleteAnnouncement = async (id: number) => {
    try {
      await deleteAnnouncement.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      toast({ title: "Announcement removed" });
    } catch (e: unknown) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const getActivityColor = (activityType: string) => {
    switch (activityType) {
      case 'User Registration': return 'bg-green-500';
      case 'Admin Registration': return 'bg-blue-500';
      case 'Plan Update': return 'bg-purple-500';
      case 'Credits Update': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount === null || amount === undefined) return '₹0';
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const getGrowthIndicator = (current: number, previous: number) => {
    if (current === null || current === undefined || previous === null || previous === undefined) {
      return {
        value: 0,
        isPositive: false,
        icon: ArrowDown
      };
    }
    const growth = ((current - previous) / (previous || 1)) * 100;
    return {
      value: Math.abs(growth).toFixed(1),
      isPositive: growth >= 0,
      icon: growth >= 0 ? ArrowUp : ArrowDown
    };
  };

  // Show loading state
  if (statsLoading || plansLoading || monthlyLoading || activityLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show error state
  if (statsError || plansError || monthlyError || activityError) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-red-500 mb-2">Error loading dashboard data</p>
          <p className="text-sm text-muted-foreground">Stats Error: {statsError?.message || 'None'}</p>
          <p className="text-sm text-muted-foreground">Plans Error: {plansError?.message || 'None'}</p>
          <p className="text-sm text-muted-foreground">Monthly Error: {monthlyError?.message || 'None'}</p>
          <p className="text-sm text-muted-foreground">Activity Error: {activityError?.message || 'None'}</p>
        </div>
      </div>
    );
  }

  // Use default values if data is missing
  const statsData = stats || {
    totalUsers: 0,
    activeUsers: 0,
    newUsersThisMonth: 0,
    totalRevenue: 0,
    revenueThisMonth: 0,
    totalCredits: 0,
    creditsUsedThisMonth: 0,
    activePlans: 0
  };

  const plansData = planDistribution || [];
  const monthlyDataLocal = monthlyData || [];
  const announcementsData = announcements || [];

  // Normalize stats — backend may return either 'users' or 'totalUsers'
  const totalUsers = (statsData as any).totalUsers ?? (statsData as any).users ?? 0;
  const activeUsers = (statsData as any).activeUsers ?? 0;
  const newUsersThisMonth = (statsData as any).newUsersThisMonth ?? 0;
  const totalOrders = (statsData as any).orders ?? 0;

  // Calculate growth indicators
  const userGrowth = getGrowthIndicator(totalUsers, Math.floor(totalUsers * 0.85));
  const revenueGrowth = getGrowthIndicator(0, 0); // No revenue field in backend

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-muted-foreground">Monitor your SaaS metrics and performance</p>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Users */}
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className={`flex items-center gap-1 text-sm ${userGrowth.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              <userGrowth.icon className="w-4 h-4" />
              <span>{userGrowth.value}%</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-foreground">{totalUsers.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Total Users</p>
            <p className="text-xs text-muted-foreground">+{newUsersThisMonth} this month</p>
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex items-center gap-1 text-sm text-green-600">
              <ArrowUp className="w-4 h-4" />
              <span>{Math.round(((activeUsers) / (totalUsers || 1)) * 100)}%</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-foreground">{(activeUsers).toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Active Users</p>
            <p className="text-xs text-muted-foreground">{Math.round(((activeUsers) / (totalUsers || 1)) * 100)}% of total users</p>
          </div>
        </div>

        {/* Revenue */}
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
              <IndianRupee className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex items-center gap-1 text-sm text-green-600">
              <ArrowUp className="w-4 h-4" />
              <span>{totalOrders} orders</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-foreground">{formatCurrency(statsData.totalRevenue || 0)}</p>
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-xs text-muted-foreground">+{formatCurrency(statsData.revenueThisMonth || 0)} this month</p>
          </div>
        </div>

        {/* Credits */}
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex items-center gap-1 text-sm text-orange-600">
              <TrendingUp className="w-4 h-4" />
              <span>29.1%</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-foreground">{formatCurrency(0)}</p>
            <p className="text-sm text-muted-foreground">Total Credits</p>
            <p className="text-xs text-muted-foreground">No credit data available</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">User Growth</h3>
            <LineChart className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="h-64 flex items-end justify-between gap-2">
            {monthlyDataLocal.slice(-6).map((data, index) => (
              <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-primary/20 rounded-t-lg relative">
                  <div 
                    className="bg-primary rounded-t-lg transition-all duration-500"
                    style={{ height: `${((data.user_signups || 0) / Math.max(...monthlyDataLocal.map(d => d.user_signups || 0))) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{data.month}</span>
                <span className="text-xs font-medium text-foreground">{data.user_signups || 0} signups</span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Revenue Trend</h3>
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="h-64 flex items-end justify-between gap-2">
            {monthlyDataLocal.slice(-6).map((data, index) => (
              <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-emerald-100 rounded-t-lg relative">
                  <div 
                    className="bg-emerald-500 rounded-t-lg transition-all duration-500"
                    style={{ height: '20%' }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{data.month}</span>
                <span className="text-xs font-medium text-foreground">No revenue data</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Plan Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Plan Distribution</h3>
            <PieChart className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="space-y-4">
            {plansData.map((plan) => {
              const planName = plan.plan_name || (plan as any).name || 'Unknown';
              return (
                <div key={planName} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{planName}</span>
                    <span className="text-sm text-muted-foreground">{plan.user_count} users ({plan.credits} credits)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary rounded-full h-2 transition-all duration-500"
                      style={{ width: `${Math.max(...plansData.map(p => p.user_count || 0)) > 0 ? (plan.user_count / Math.max(...plansData.map(p => p.user_count || 0))) * 100 : 0}%` }}
                    />
                  </div>
                  {plan.credits > 0 && (
                    <p className="text-xs text-muted-foreground">{plan.credits} credits included</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Updates and Announcements */}
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Updates and Announcements</h3>
            <Megaphone className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="max-h-80 overflow-y-auto pr-1 space-y-3">
            {announcementsData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No announcements yet. Post one from the Send Notification tab.</p>
            ) : (
              announcementsData.map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background/50 hover:bg-background transition-colors">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground break-words">{a.title || "Announcement"}</p>
                      <button
                        onClick={() => handleDeleteAnnouncement(a.id)}
                        title="Delete announcement"
                        className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground break-words mt-0.5">{a.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {a.created_by ? `by ${a.created_by} · ` : ""}
                      {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
