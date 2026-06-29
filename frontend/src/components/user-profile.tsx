import { useState, useEffect } from "react";
import { User, Mail, Phone, MapPin, Lock, LogOut, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { getToken } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

interface UserProfileProps {
  username: string;
  email?: string;
  phone?: string;
  onClose: () => void;
}

interface UserData {
  id: number;
  username: string;
  email: string;
  phone: string;
  address_line: string;
  pincode: string;
  city: string;
  district: string;
  state: string;
  country: string;
}

export default function UserProfile({ username, email, phone, onClose }: UserProfileProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    address_line: "",
    pincode: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [error, setError] = useState("");

  // Fetch user data on component mount
  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = getToken();
      const res = await fetch("/api/profile", {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setUserData(data);
        setFormData({
          email: data.email || "",
          phone: data.phone || "",
          address_line: data.address_line || "",
          pincode: data.pincode || "",
          currentPassword: "",
          newPassword: "",
          confirmPassword: ""
        });
      }
    } catch (err) {
      console.error("Failed to fetch user data:", err);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const token = getToken();
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          email: formData.email,
          phone: formData.phone,
          address_line: formData.address_line || undefined,
          pincode: formData.pincode || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.detail || "Failed to update profile");
        return;
      }

      toast({ title: "Profile updated", description: "Your profile has been updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.newPassword !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const token = getToken();
      const res = await fetch("/api/change-password", {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: formData.currentPassword,
          new_password: formData.newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.detail || "Failed to update password");
        return;
      }

      toast({ title: "Password updated", description: "Your password has been changed successfully" });
      setFormData(prev => ({ ...prev, currentPassword: "", newPassword: "", confirmPassword: "" }));
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-card-border rounded-xl shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Profile Settings</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Tab Navigation */}
          <div className="flex gap-1 mb-6 bg-muted p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === "profile"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="w-4 h-4 inline mr-2" />
              Profile
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === "security"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Lock className="w-4 h-4 inline mr-2" />
              Security
            </button>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-3 py-2 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === "profile" && (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Username</label>
                <input
                  type="text"
                  value={username}
                  disabled
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-muted text-muted-foreground text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">Username cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={updateField("email")}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={updateField("phone")}
                  placeholder="9876543210"
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Address Line
                </label>
                <input
                  type="text"
                  value={formData.address_line}
                  onChange={updateField("address_line")}
                  placeholder="123, Main Street, Area"
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Pincode</label>
                <input
                  type="text"
                  value={formData.pincode}
                  onChange={updateField("pincode")}
                  placeholder="110001"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-sm transition-colors"
                />
              </div>

              {/* Show current address information if available */}
              {userData && (userData.city || userData.district || userData.state || userData.country) && (
                <div className="p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Current Address Details:</span>
                  </div>
                  <div className="text-sm space-y-1">
                    {userData.address_line && <p><span className="font-medium">Address:</span> {userData.address_line}</p>}
                    {userData.pincode && <p><span className="font-medium">Pincode:</span> {userData.pincode}</p>}
                    {userData.city && <p><span className="font-medium">City:</span> {userData.city}</p>}
                    {userData.district && <p><span className="font-medium">District:</span> {userData.district}</p>}
                    {userData.state && <p><span className="font-medium">State:</span> {userData.state}</p>}
                    {userData.country && <p><span className="font-medium">Country:</span> {userData.country}</p>}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 font-semibold rounded-full hover:-translate-y-0.5 transition-all"
              >
                {loading ? "Updating..." : "Update Profile"}
              </button>
            </form>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Current Password</label>
                <input
                  type="password"
                  value={formData.currentPassword}
                  onChange={updateField("currentPassword")}
                  placeholder="Enter current password"
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">New Password</label>
                <input
                  type="password"
                  value={formData.newPassword}
                  onChange={updateField("newPassword")}
                  placeholder="Min 6 characters"
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={updateField("confirmPassword")}
                  placeholder="Re-enter new password"
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-sm transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 font-semibold rounded-full hover:-translate-y-0.5 transition-all"
              >
                {loading ? "Updating..." : "Change Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
