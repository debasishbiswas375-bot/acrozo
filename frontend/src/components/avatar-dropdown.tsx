import { useState, useRef, useEffect } from "react";
import { User, LogOut, Mail, Phone, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { getToken, clearToken } from "@/lib/api";
import { useGetProfile } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import UserProfile from "./user-profile";

interface AvatarDropdownProps {
  username: string;
  email?: string;
  phone?: string;
}

interface UserData {
  id: number;
  username: string;
  full_name: string;
  email: string;
  phone: string;
  address_line: string;
  pincode: string;
  city: string;
  district: string;
  state: string;
  country: string;
  avatar_url?: string;
}

function resolveAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('blob:') || url.startsWith('http')) return url;
  const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
  return `${base}${url}`;
}

function getInitials(fullName?: string, username?: string): string {
  const name = fullName || username || '';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

function UserAvatar({ src, className }: { src: string | null; fullName?: string; username?: string; className: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showInitials = !src || imgFailed;

  if (showInitials) {
    return (
      <div className={`${className} rounded-full bg-gradient-to-br from-blue-600/10 to-violet-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 dark:text-violet-400`}>
        <User className={className.includes('w-14') ? 'w-7 h-7' : 'w-4 h-4'} />
      </div>
    );
  }
  return (
    <img
      src={src!}
      alt="User Avatar"
      className={`${className} rounded-full object-cover`}
      onError={() => setImgFailed(true)}
    />
  );
}

export default function AvatarDropdown({ username, email, phone }: AvatarDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const token = getToken();
  const { data: userData } = useGetProfile({
    query: {
      enabled: !!token,
    },
  }) as { data: UserData | undefined | null };

  // Sync userData.avatar_url with localStorage to cache/clear it properly
  useEffect(() => {
    if (userData) {
      if (userData.avatar_url) {
        localStorage.setItem("avatar_url", userData.avatar_url);
      } else {
        localStorage.removeItem("avatar_url");
      }
    }
  }, [userData]);

  // Compute dropdown position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.closest("[data-dropdown-root]")?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleLogout = () => {
    clearToken();
    queryClient.clear();
    toast({ title: "Logged out", description: "You have been logged out successfully" });
    navigate("/");
    setIsOpen(false);
  };

  const handleProfile = () => {
    setShowProfile(true);
    setIsOpen(false);
  };

  const displayData = userData || { username, full_name: "", email: email || "", phone: phone || "", avatar_url: undefined };
  // Only fall back to localStorage if we don't have userData loaded yet (avoid showing previous user's cached avatar)
  const storedAvatarUrl = userData === undefined ? (localStorage.getItem("avatar_url") || null) : null;
  const avatarSrc = resolveAvatarUrl(displayData.avatar_url) || storedAvatarUrl;

  return (
    <>
      <div className="relative" data-dropdown-root>
        {/* ── Avatar trigger ── */}
        <button
          ref={triggerRef}
          onClick={() => setIsOpen(!isOpen)}
          className="relative rounded-full transition-all duration-200 active:scale-95 shrink-0"
          style={{
            outline: "none",
            boxShadow: isOpen
              ? "0 0 0 2px rgba(180,220,255,0.35), 0 0 16px rgba(150,200,255,0.20)"
              : "0 0 0 1.5px rgba(200,230,255,0.15)",
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(180,220,255,0.30), 0 0 16px rgba(150,200,255,0.18)")}
          onMouseLeave={e => {
            if (!isOpen) e.currentTarget.style.boxShadow = "0 0 0 1.5px rgba(200,230,255,0.15)";
          }}
        >
          <UserAvatar src={avatarSrc} fullName={displayData.full_name} username={displayData.username} className="w-9 h-9" />
        </button>

        {/* ── Dropdown ── */}
        {isOpen && dropdownPos && (
          <div
            className="fixed z-50 rounded-2xl overflow-hidden border bg-white/95 dark:bg-[#081026]/95 border-gray-200/80 dark:border-white/10 shadow-[0_24px_48px_rgba(0,0,0,0.12)] dark:shadow-[0_24px_48px_rgba(0,0,0,0.55)]"
            style={{
              top: dropdownPos.top,
              right: dropdownPos.right,
              width: Math.min(384, window.innerWidth - 16),
              backdropFilter: "blur(28px) saturate(180%)",
            }}
          >
            {/* User info block */}
            <div className="p-4 border-b border-gray-100 dark:border-white/8">
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="relative shrink-0 rounded-full p-[2px] border
                    border-gray-200 dark:border-white/20
                    bg-gradient-to-br from-gray-100 to-gray-50 dark:from-white/10 dark:to-white/5"
                >
                  <UserAvatar src={avatarSrc} fullName={displayData.full_name} username={displayData.username} className="w-14 h-14" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-black dark:text-white">
                    {displayData.username}
                  </p>
                  {displayData.full_name && displayData.full_name !== displayData.username && (
                    <p className="text-xs truncate text-body-color dark:text-body-color-dark">
                      {displayData.full_name}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {displayData.email && (
                  <div
                    className="flex items-center gap-3 p-2 rounded-xl border
                      bg-gray-50/50 dark:bg-white/[0.03]
                      border-gray-100 dark:border-white/[0.06]"
                  >
                    <Mail className="w-4 h-4 shrink-0 text-body-color dark:text-body-color-dark opacity-70" />
                    <span className="text-xs truncate text-gray-700 dark:text-gray-300">
                      {displayData.email}
                    </span>
                  </div>
                )}

                {displayData.phone && (
                  <div
                    className="flex items-center gap-3 p-2 rounded-xl border
                      bg-gray-50/50 dark:bg-white/[0.03]
                      border-gray-100 dark:border-white/[0.06]"
                  >
                    <Phone className="w-4 h-4 shrink-0 text-body-color dark:text-body-color-dark opacity-70" />
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      {displayData.phone}
                    </span>
                  </div>
                )}

                {(userData?.address_line || userData?.city || userData?.state || userData?.pincode) && (
                  <div
                    className="p-3 rounded-xl border
                      bg-gray-50/50 dark:bg-white/[0.03]
                      border-gray-100 dark:border-white/[0.06]"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 shrink-0 text-body-color dark:text-body-color-dark opacity-80" />
                      <span className="text-xs font-medium text-black dark:text-white">
                        Address Details
                      </span>
                    </div>
                    <div className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
                      {userData?.address_line && <p className="font-medium">{userData.address_line}</p>}
                      {(userData?.city || userData?.state) && (
                        <p>{[userData?.city || "", userData?.state || ""].filter(Boolean).join(", ")}</p>
                      )}
                      {userData?.pincode && <p>Pincode: {userData.pincode}</p>}
                      {userData?.district && <p>District: {userData.district}</p>}
                      {userData?.country && <p>Country: {userData.country}</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="py-1.5">
              <button
                onClick={handleProfile}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-150
                  text-gray-700 hover:text-black hover:bg-gray-100/70
                  dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/[0.06]"
              >
                <User className="w-4 h-4" />
                Profile Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-150
                  text-red-600 hover:bg-red-50
                  dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>

      {showProfile && (
        <UserProfile
          username={username}
          email={email}
          phone={phone}
          onClose={() => setShowProfile(false)}
        />
      )}
    </>
  );
}
