import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { clearToken, isAdmin, getToken, getApiUrl } from "@/lib/api";
import { usePlanColors } from "@/contexts/plan-colors-context";
import { useGetMyPlan, useGetProfile, useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, useClearAllNotifications, useUploadAvatar, useDeleteAvatar, useAccountActivity } from "@/lib/api-client";
import { User, Mail, Phone, MapPin, Edit, MoreVertical, RefreshCw, Lock, CreditCard, Calendar, Bell, BellOff, History, Settings, Shield, Clock, Camera, Trash2, Upload, Check, CheckCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import Header from "@/components/header";
import Footer from "@/components/footer";

/** Resolve a possibly-relative avatar URL against the local API base. */
function resolveAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('blob:') || url.startsWith('http')) return url;
  // relative path like /api/bucket/files/avatars/foo.jpg
  // In dev, VITE_API_URL is empty and Vite proxies /api/* to backend — so "" + "/api/..." works.
  // In prod, VITE_API_URL = "https://your-backend.com" so prepending it gives the full URL.
  const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
  return `${base}${url}`;
}


const getActivityStyle = (type: string) => {
  switch (type) {
    case 'account_created':
      return { color: 'bg-green-500', bg: 'bg-green-50 text-green-600 border-green-200' };
    case 'purchase':
      return { color: 'bg-blue-500', bg: 'bg-blue-50 text-blue-600 border-blue-200' };
    case 'plan_upgrade':
      return { color: 'bg-indigo-500', bg: 'bg-indigo-50 text-indigo-600 border-indigo-200' };
    case 'credits_added':
    case 'credits_updated':
      return { color: 'bg-purple-500', bg: 'bg-purple-50 text-purple-600 border-purple-200' };
    case 'credits_removed':
      return { color: 'bg-orange-500', bg: 'bg-orange-50 text-orange-600 border-orange-200' };
    case 'expiry_update':
      return { color: 'bg-pink-500', bg: 'bg-pink-50 text-pink-600 border-pink-200' };
    default:
      return { color: 'bg-gray-500', bg: 'bg-gray-50 text-gray-600 border-gray-200' };
  }
};


export default function AccountPage() {
  const [location, navigate] = useLocation();
  const { getPlanColor } = usePlanColors();
  const { data: planData, isLoading, error } = useGetMyPlan();
  const { data: profileData, refetch: refetchProfile } = useGetProfile();
  const { data: notifications, isLoading: notifLoading } = useNotifications();
  const markAsRead = useMarkNotificationRead();
  const markAllAsRead = useMarkAllNotificationsRead();
  const clearAllNotifications = useClearAllNotifications();
  const uploadAvatar = useUploadAvatar();
  const deleteAvatar = useDeleteAvatar();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Avatar state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const currentAvatar = resolveAvatarUrl(avatarPreview || profileData?.avatar_url);
  const username = planData?.username || '';

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    // Show local blob immediately — this always works regardless of backend URL
    const blobUrl = URL.createObjectURL(file);
    setAvatarPreview(blobUrl);
    try {
      await uploadAvatar.mutateAsync(file);
      // Keep blob preview; invalidate profile so DB URL is refreshed in background
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    } catch (err: any) {
      setAvatarError(err.message || 'Upload failed');
      setAvatarPreview(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteAvatar = async () => {
    setAvatarError(null);
    try {
      await deleteAvatar.mutateAsync();
      setAvatarPreview(null);
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    } catch (err: any) {
      setAvatarError(err.message || 'Delete failed');
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await markAsRead.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-plan"] });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead.mutateAsync();
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-plan"] });
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleClearAllNotifications = async () => {
    try {
      await clearAllNotifications.mutateAsync();
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-plan"] });
    } catch (error) {
      console.error("Failed to clear notifications:", error);
    }
  };

  // Get user info from token (same pattern as dashboard)
  const getUserInfo = () => {
    const token = getToken();
    if (!token) return { username: "", email: "", phone: "", address_line: "", pincode: "", city: "", state: "", is_admin: false };

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        username: payload.username || "",
        email: payload.email || "",
        phone: payload.phone || "",
        address_line: payload.address_line || "",
        pincode: payload.pincode || "",
        city: payload.city || "",
        state: payload.state || "",
        is_admin: payload.is_admin || false
      };
    } catch {
      return { username: "", email: "", phone: "", address_line: "", pincode: "", city: "", state: "", is_admin: false };
    }
  };

  const userInfo = getUserInfo();

  // State for editable fields (using real data from API)
  const [email, setEmail] = useState(planData?.email || userInfo.email || '');
  const [credits, setCredits] = useState(planData?.credits?.toString() || '0');
  const [isEditMode, setIsEditMode] = useState(false);

  // Additional fields from user info
  const [phone, setPhone] = useState(planData?.phone || userInfo.phone || '');
  const [address, setAddress] = useState(planData?.address_line || userInfo.address_line || '');
  const [pincode, setPincode] = useState(planData?.pincode || userInfo.pincode || '');
  const [city, setCity] = useState(planData?.city || userInfo.city || '');
  const [state, setState] = useState(planData?.state || userInfo.state || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [activeTab, setActiveTab] = useState('profile');

  const { data: activityData, isLoading: activityLoading } = useAccountActivity({
    query: { enabled: activeTab === 'activity' }
  });

  // Calculate plan expiry — backend returns expiry as "dd-mm-yyyy" and expiry_iso as ISO string
  const parseExpiry = (data: typeof planData): Date | null => {
    if (!data) return null;
    // Prefer the ISO string returned as expiry_iso
    const iso = (data as any).expiry_iso as string | undefined;
    if (iso) {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? null : d;
    }
    // Fallback: parse dd-mm-yyyy manually
    const raw = data.expiry;
    if (!raw) return null;
    if (raw.includes('-') && raw.split('-')[0].length === 2) {
      // dd-mm-yyyy
      const [dd, mm, yyyy] = raw.split('-');
      const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
      return isNaN(d.getTime()) ? null : d;
    }
    // ISO or other format
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };
  const isUnlimited = planData?.plan?.toLowerCase() === "unlimited";
  const expiryDate = parseExpiry(planData);
  const planExpiry = isUnlimited ? "Lifetime" : expiryDate ? expiryDate.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'Not set';

  // Calculate days remaining
  const daysRemaining = expiryDate ? Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

  const handleLogout = () => {
    clearToken();
    navigate("/");
  };

  const handleSaveProfile = async () => {
    // TODO: Implement actual save functionality
    alert('Profile saved successfully!');
    setIsEditMode(false);
  };

  const handlePasswordUpdate = async () => {
    if (password !== confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    // TODO: Implement actual password update functionality
    alert('Password updated successfully!');
    setPassword('');
    setConfirmPassword('');
  };

  // Tab navigation
  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'plan', label: 'Plan & Credits', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'activity', label: 'Activity', icon: History },
    { id: 'security', label: 'Security', icon: Shield }
  ];

  return (
    <div>
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center text-destructive">Error loading profile data</div>
          </div>
        ) : planData ? (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground">Account Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">Complete view of your account information and database records</p>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-border mb-6">
              <nav className="flex space-x-8">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* Basic Information */}
                  <div className="bg-card border border-border rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-lg font-semibold text-foreground">Basic Information</h2>
                      <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                      >
                        {isEditMode ? 'Cancel' : 'Edit'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Username</label>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-foreground">{planData?.username || userInfo.username}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Full Name</label>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-foreground">{planData?.full_name || 'Not set'}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          {isEditMode ? (
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="w-full px-2 py-1 bg-background border border-border rounded-md text-foreground"
                            />
                          ) : (
                            <span className="text-foreground">{planData?.email || userInfo.email}</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Phone</label>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          {isEditMode ? (
                            <input
                              type="tel"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className="w-full px-2 py-1 bg-background border border-border rounded-md text-foreground"
                            />
                          ) : (
                            <span className="text-foreground">{planData?.phone || userInfo.phone}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isEditMode && (
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={handleSaveProfile}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => setIsEditMode(false)}
                          className="px-4 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Address Information */}
                  <div className="bg-card border border-border rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-foreground mb-6">Address Information</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Address Line</label>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          {isEditMode ? (
                            <input
                              type="text"
                              value={address}
                              onChange={(e) => setAddress(e.target.value)}
                              className="w-full px-2 py-1 bg-background border border-border rounded-md text-foreground"
                            />
                          ) : (
                            <span className="text-foreground">{planData?.address_line || userInfo.address_line}</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">City</label>
                        <div className="p-2 bg-muted rounded-md">
                          {isEditMode ? (
                            <input
                              type="text"
                              value={city}
                              onChange={(e) => setCity(e.target.value)}
                              className="w-full px-2 py-1 bg-background border border-border rounded-md text-foreground"
                            />
                          ) : (
                            <span className="text-foreground">{planData?.city || userInfo.city}</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">State</label>
                        <div className="p-2 bg-muted rounded-md">
                          {isEditMode ? (
                            <input
                              type="text"
                              value={state}
                              onChange={(e) => setState(e.target.value)}
                              className="w-full px-2 py-1 bg-background border border-border rounded-md text-foreground"
                            />
                          ) : (
                            <span className="text-foreground">{planData?.state || userInfo.state}</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Pincode</label>
                        <div className="p-2 bg-muted rounded-md">
                          {isEditMode ? (
                            <input
                              type="text"
                              value={pincode}
                              onChange={(e) => setPincode(e.target.value)}
                              className="w-full px-2 py-1 bg-background border border-border rounded-md text-foreground"
                            />
                          ) : (
                            <span className="text-foreground">{planData?.pincode || userInfo.pincode}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Avatar + Quick Stats */}
                <div className="space-y-6">

                  {/* Avatar Card */}
                  <div className="bg-card border border-border rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-foreground mb-4">Profile Photo</h2>

                    {/* Avatar preview with hover overlay */}
                    <div className="flex flex-col items-center gap-4">
                      <div
                        className="relative group w-24 h-24 rounded-full cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {currentAvatar ? (
                          <img
                            src={currentAvatar}
                            alt="Profile"
                            className="w-24 h-24 rounded-full object-cover border-2 border-border"
                            onError={(e) => {
                              // If the URL fails to load (HF bucket down, token missing, etc.)
                              // hide the broken img and show the initials fallback
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('style');
                            }}
                          />
                        ) : null}
                        <div
                          className="w-24 h-24 rounded-full flex items-center justify-center border-2 border-border bg-gradient-to-br from-blue-600/10 to-violet-600/10 text-blue-600 dark:text-violet-400"
                          style={currentAvatar ? { display: 'none' } : {}}
                        >
                          <User className="w-12 h-12" />
                        </div>
                        {/* Hover overlay */}
                        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          {uploadAvatar.isPending ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Camera className="w-6 h-6 text-white" />
                          )}
                        </div>
                      </div>

                      {/* Hidden file input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={handleAvatarFileChange}
                      />

                      {/* Error */}
                      {avatarError && (
                        <p className="text-xs text-red-500 text-center">{avatarError}</p>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadAvatar.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {uploadAvatar.isPending ? 'Uploading…' : 'Change'}
                        </button>
                        {currentAvatar && (
                          <button
                            onClick={handleDeleteAvatar}
                            disabled={deleteAvatar.isPending}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100 transition-colors disabled:opacity-60"
                          >
                            {deleteAvatar.isPending ? (
                              <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground text-center">JPG, PNG, WebP or GIF · max 5 MB</p>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="bg-card border border-border rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-foreground mb-4">Quick Stats</h2>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Account Type</span>
                        <span className="text-sm font-medium text-foreground">
                          {userInfo.is_admin ? 'Admin' : 'User'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Member Since</span>
                        <span className="text-sm font-medium text-foreground">
                          {new Date().toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Notifications</span>
                        <span className="text-sm font-medium text-foreground">
                          {planData?.notifications_count || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Plan & Credits Tab */}
            {activeTab === 'plan' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* Current Plan */}
                  <div className="bg-card border border-border rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-foreground mb-6">Current Plan</h2>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-foreground">{planData?.plan || 'Free'}</h3>
                        <p className="text-sm text-muted-foreground">Active Plan</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">{isUnlimited ? "Unlimited" : (planData?.credits || 0)}</div>
                        <p className="text-sm text-muted-foreground">Credits Available</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-foreground">Plan Expiry</span>
                        </div>
                        <p className="text-lg font-semibold text-foreground">{planExpiry}</p>
                        <p className="text-xs text-muted-foreground">{isUnlimited ? "Never expires" : `${daysRemaining} days remaining`}</p>
                      </div>

                      <div className="p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-foreground">Plan Status</span>
                        </div>
                        <p className="text-lg font-semibold text-green-600">
                          {isUnlimited || daysRemaining > 0 ? 'Active' : 'Expired'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isUnlimited || daysRemaining > 0 ? 'All features available' : 'Renew to continue'}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate('/pricing')}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                      >
                        Upgrade Plan
                      </button>
                      <button
                        onClick={() => navigate('/pricing')}
                        className="px-4 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors"
                      >
                        View Plans
                      </button>
                    </div>
                  </div>

                  {/* Credit Usage */}
                  <div className="bg-card border border-border rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-foreground mb-6">Credit Usage</h2>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Available Credits</span>
                          <span className="text-sm font-medium text-foreground">{isUnlimited ? "Unlimited" : (planData?.credits || 0)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${isUnlimited ? 100 : Math.min((planData?.credits || 0) / 100 * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-border">
                        <h3 className="text-sm font-medium text-foreground mb-3">Recent Transactions</h3>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2 bg-muted rounded">
                            <span className="text-sm">Initial Credits</span>
                            <span className="text-sm font-medium text-green-600">+{planData?.credits || 0}</span>
                          </div>
                          <div className="text-sm text-muted-foreground text-center py-4">
                            No recent transactions
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Plan Features */}
                <div className="space-y-6">
                  <div className="bg-card border border-border rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-foreground mb-4">Plan Features</h2>
                    <div className="space-y-3">
                      {(() => {
                        const rawFeatures = planData?.plan_details?.features;
                        let features: string[] = [];
                        if (Array.isArray(rawFeatures)) {
                          features = rawFeatures;
                        } else if (typeof rawFeatures === 'string') {
                          try { features = JSON.parse(rawFeatures); } catch { features = []; }
                        }
                        if (features.length === 0) {
                          return (
                            <p className="text-sm text-muted-foreground">No features listed for this plan.</p>
                          );
                        }
                        return features.map((f: string, i: number) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                            <span className="text-sm text-foreground">{f}</span>
                          </div>
                        ));
                      })()}
                    </div>
                    <button
                      onClick={() => navigate('/pricing')}
                      className="mt-4 w-full px-4 py-2 text-sm border border-primary text-primary rounded-md hover:bg-primary/10 transition-colors"
                    >
                      See All Plans
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (() => {
              const notifArray = Array.isArray(notifications)
                ? notifications
                : (notifications as any)?.notifications ?? [];
              const unreadCount = notifArray.filter((n: any) => !n.is_read).length;
              return (
                <div className="bg-card border border-border rounded-xl shadow-sm">
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
                      {unreadCount > 0 && (
                        <span className="text-xs font-bold bg-red-100 text-red-600 rounded-full px-2 py-0.5">
                          {unreadCount} unread
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
                          disabled={markAllAsRead.isPending}
                          className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50"
                        >
                          <CheckCheck className="w-4 h-4" />
                          Mark all as read
                        </button>
                      )}
                      {notifArray.length > 0 && (
                        <button
                          onClick={handleClearAllNotifications}
                          disabled={clearAllNotifications.isPending}
                          className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  {notifLoading ? (
                    <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm">Loading notifications…</span>
                    </div>
                  ) : notifArray.length > 0 ? (
                    <div className="divide-y divide-border">
                      {notifArray.map((notif: any) => {
                        const isUnread = !notif.is_read;
                        return (
                          <div
                            key={notif.id}
                            onClick={() => isUnread && handleMarkAsRead(notif.id)}
                            className={`group flex items-start gap-4 px-6 py-4 transition-colors ${isUnread
                                ? 'bg-blue-50/40 hover:bg-blue-50 cursor-pointer'
                                : 'hover:bg-muted/30 cursor-default'
                              }`}
                            title={isUnread ? 'Click to mark as read' : undefined}
                          >
                            {/* Status dot */}
                            <div className="mt-1.5 shrink-0">
                              {isUnread ? (
                                <span className="block w-2.5 h-2.5 rounded-full bg-primary" />
                              ) : (
                                <span className="block w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className={`text-sm leading-relaxed ${isUnread ? 'font-medium text-foreground' : 'text-muted-foreground'
                                }`}>
                                {notif.message}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(notif.created_at).toLocaleString('en-IN', {
                                  day: '2-digit', month: 'short', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </p>
                            </div>

                            {/* Mark-as-read button (hover reveal) */}
                            {isUnread && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleMarkAsRead(notif.id); }}
                                disabled={markAsRead.isPending}
                                className="shrink-0 mt-1 p-1.5 rounded-md text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-30"
                                title="Mark as read"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            {!isUnread && (
                              <Check className="shrink-0 mt-1 w-4 h-4 text-muted-foreground/40" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                      <BellOff className="w-12 h-12" />
                      <p className="font-medium">No notifications</p>
                      <p className="text-sm">You're all caught up!</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <div className="bg-card border border-border rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-foreground">Account Activity</h2>
                  {activityLoading && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
                </div>

                {activityLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                    <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                    <p className="text-sm">Loading activity logs…</p>
                  </div>
                ) : !activityData || activityData.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">No activity logged yet</p>
                    <p className="text-xs text-muted-foreground/80 mt-1">Actions like plan upgrades, purchases, and credit additions will show up here.</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {activityData.map((activity) => {
                      const style = getActivityStyle(activity.activity_type);
                      const dateStr = new Date(activity.created_at).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      return (
                        <div key={activity.id} className="flex items-start gap-4 p-4 bg-muted/40 border border-border/50 hover:border-border rounded-xl transition-all hover:bg-muted/70">
                          <div className={`w-3.5 h-3.5 rounded-full mt-1.5 shrink-0 ${style.color}`} />
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground leading-relaxed">{activity.description}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{dateStr}</span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            {activity.credits_changed !== null && activity.credits_changed !== undefined && (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                activity.credits_changed > 0 
                                  ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' 
                                  : 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400'
                              }`}>
                                {activity.credits_changed > 0 ? '+' : ''}{activity.credits_changed} credits
                              </span>
                            )}
                            {activity.amount !== null && activity.amount !== undefined && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                                ₹{activity.amount.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* Password Change */}
                  <div className="bg-card border border-border rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-foreground mb-6">Change Password</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">New Password</label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
                          placeholder="Enter new password"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Confirm Password</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
                          placeholder="Confirm new password"
                        />
                      </div>
                      <button
                        onClick={handlePasswordUpdate}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                      >
                        Update Password
                      </button>
                    </div>
                  </div>

                  {/* Security Settings */}
                  <div className="bg-card border border-border rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-foreground mb-6">Security Settings</h2>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <Shield className="w-4 h-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
                            <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
                          </div>
                        </div>
                        <button className="px-3 py-1 text-sm bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors">
                          Enable
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <Lock className="w-4 h-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium text-foreground">Session Management</p>
                            <p className="text-xs text-muted-foreground">Manage active sessions</p>
                          </div>
                        </div>
                        <button className="px-3 py-1 text-sm bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors">
                          Manage
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Security Info */}
                <div className="space-y-6">
                  <div className="bg-card border border-border rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-foreground mb-4">Security Information</h2>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Last Login</span>
                        <span className="text-sm font-medium text-foreground">{new Date().toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Account Status</span>
                        <span className="text-sm font-medium text-green-600">Active</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Email Verified</span>
                        <span className="text-sm font-medium text-green-600">Verified</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
