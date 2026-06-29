import { useState, useRef, useEffect } from "react";
import { Bell, X, Check, CheckCheck, BellOff, Trash2 } from "lucide-react";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useClearAllNotifications,
} from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { formatDateTime } from "@/lib/date-utils";
import { getToken } from "@/lib/api";

const QUERY_KEY = "/api/notifications";

export default function Notifications() {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const token = getToken();

  const { data: notificationsData, isLoading } = useNotifications({
    query: { enabled: !!token },
  });

  const markAsRead = useMarkNotificationRead();
  const markAllAsRead = useMarkAllNotificationsRead();
  const clearAll = useClearAllNotifications();
  const queryClient = useQueryClient();

  const notificationsArray = Array.isArray(notificationsData)
    ? notificationsData
    : (notificationsData as any)?.notifications ?? [];

  const unreadCount = notificationsArray.filter((n: any) => !n.is_read).length;

  // Compute position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownWidth = Math.min(320, window.innerWidth - 16);
      const rightFromEdge = window.innerWidth - rect.right;
      const clampedRight = Math.max(8, rightFromEdge);
      setDropdownPos({
        top: rect.bottom + 8,
        right: clampedRight,
        width: dropdownWidth,
      });
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  if (!token) return null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: ["/api/my-plan"] });
  };

  const handleMarkAsRead = async (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try { await markAsRead.mutateAsync({ id }); invalidate(); }
    catch (err) { console.error("Failed to mark notification as read:", err); }
  };

  const handleMarkAllAsRead = async () => {
    try { await markAllAsRead.mutateAsync(); invalidate(); }
    catch (err) { console.error("Failed to mark all as read:", err); }
  };

  const handleClearAll = async () => {
    try { await clearAll.mutateAsync(); invalidate(); }
    catch (err) { console.error("Failed to clear notifications:", err); }
  };

  return (
    <div className="relative">

      {/* ── Bell trigger ── */}
      <button
        ref={triggerRef}
        id="notifications-bell-btn"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        className={`relative p-2 rounded-full border transition-all duration-200
          border-transparent
          text-body-color hover:text-black dark:text-body-color-dark dark:hover:text-white
          hover:bg-gray-100 dark:hover:bg-white/5
          ${isOpen ? "bg-gray-100 dark:bg-white/5" : ""}
        `}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-[3px] text-[10px] font-bold rounded-full flex items-center justify-center leading-none z-10 bg-primary-blue text-white shadow"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {isOpen && dropdownPos && (
        <div
          ref={panelRef}
          className="fixed z-50 overflow-hidden rounded-2xl shadow-xl
            bg-white dark:bg-[#0f172a]
            border border-gray-200 dark:border-white/10"
          style={{
            top: dropdownPos.top,
            right: dropdownPos.right,
            width: dropdownPos.width,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/8">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="w-4 h-4 shrink-0 text-body-color dark:text-body-color-dark" />
              <h3 className="font-semibold text-sm text-black dark:text-white">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-primary-blue/10 text-primary-blue border border-primary-blue/20 shrink-0">
                  {unreadCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {unreadCount > 0 && (
                <button
                  id="mark-all-read-btn"
                  onClick={handleMarkAllAsRead}
                  disabled={markAllAsRead.isPending}
                  title="Mark all as read"
                  className="p-1.5 rounded-full text-body-color hover:text-primary-blue dark:text-body-color-dark dark:hover:text-primary-blue hover:bg-primary-blue/10 transition-all disabled:opacity-50"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              )}
              {notificationsArray.length > 0 && (
                <button
                  id="clear-all-notifications-btn"
                  onClick={handleClearAll}
                  disabled={clearAll.isPending}
                  title="Clear all"
                  className="p-1.5 rounded-full text-body-color hover:text-red-500 dark:text-body-color-dark dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close notifications"
                title="Close"
                className="p-1.5 rounded-full text-body-color hover:text-black dark:text-body-color-dark dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-[340px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
            {isLoading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-body-color dark:text-body-color-dark">
                <div className="w-4 h-4 rounded-full animate-spin border-2 border-gray-200 dark:border-white/10 border-t-primary-blue" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : notificationsArray.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-body-color dark:text-body-color-dark">
                <BellOff className="w-8 h-8 opacity-40" />
                <p className="text-sm font-medium">No notifications yet</p>
                <p className="text-xs opacity-60">You're all caught up!</p>
              </div>
            ) : (
              notificationsArray.map((notification: any) => {
                const isUnread = !notification.is_read;
                return (
                  <div
                    key={notification.id}
                    onClick={() => isUnread && handleMarkAsRead(notification.id)}
                    className={`group flex items-start gap-3 px-4 py-3 transition-all border-b border-gray-50 dark:border-white/5 last:border-b-0
                      ${isUnread
                        ? "bg-primary-blue/[0.04] hover:bg-primary-blue/[0.08] cursor-pointer"
                        : "hover:bg-gray-50 dark:hover:bg-white/[0.02] cursor-default"
                      }`}
                    title={isUnread ? "Click to mark as read" : undefined}
                  >
                    <div className="mt-1.5 shrink-0">
                      <span
                        className={`block w-2 h-2 rounded-full transition-all
                          ${isUnread ? "bg-primary-blue shadow-sm shadow-primary-blue/40" : "bg-gray-200 dark:bg-white/15"}`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm leading-snug
                          ${isUnread
                            ? "text-black dark:text-white font-medium"
                            : "text-body-color dark:text-body-color-dark font-normal"
                          }`}
                      >
                        {notification.message}
                      </p>
                      <p className="text-[11px] mt-0.5 text-body-color/50 dark:text-body-color-dark/50">
                        {formatDateTime(notification.created_at)}
                      </p>
                    </div>

                    {isUnread && (
                      <button
                        onClick={e => handleMarkAsRead(notification.id, e)}
                        disabled={markAsRead.isPending}
                        title="Mark as read"
                        className="shrink-0 mt-1 p-1 rounded-full opacity-0 group-hover:opacity-100 text-primary-blue hover:bg-primary-blue/10 transition-all disabled:opacity-30"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notificationsArray.length > 0 && (
            <div className="px-4 py-2.5 text-center border-t border-gray-100 dark:border-white/8">
              <button
                onClick={() => { setIsOpen(false); window.location.href = "/account#notifications"; }}
                className="text-xs font-medium text-primary-blue hover:text-primary-blue/80 transition-colors"
              >
                View all in Account →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
