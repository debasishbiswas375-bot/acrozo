import { useEffect, useState } from "react";
import { Monitor, Smartphone, MapPin, Clock, LogOut, ShieldOff, RefreshCw } from "lucide-react";
import { getToken, getApiUrl} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ActiveSession {
  id: number;
  user_agent: string;
  ip: string;
  created_at: string | null;
  last_seen_at: string | null;
  expires_at: string | null;
  current: boolean;
}

interface SecurityInfo {
  last_login_at: string | null;
  account_created_at: string | null;
  active_sessions: ActiveSession[];
}

const apiBase = () => (getApiUrl());

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function describeUserAgent(ua: string): { label: string; isMobile: boolean } {
  if (!ua) return { label: "Unknown device", isMobile: false };
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";
  else if (/curl/i.test(ua)) browser = "curl";
  let os = "";
  if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";
  return { label: [browser, os].filter(Boolean).join(" • "), isMobile };
}

export default function SecurityPanel() {
  const { toast } = useToast();
  const [info, setInfo] = useState<SecurityInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | "all" | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase()}/api/auth/security-info`, {
        headers: { ...authHeaders() },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setInfo(await res.json());
    } catch (e) {
      toast({
        title: "Couldn't load security info",
        description: String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const revokeOne = async (id: number) => {
    setBusyId(id);
    try {
      const res = await fetch(`${apiBase()}/api/auth/sessions/${id}`, {
        method: "DELETE",
        headers: { ...authHeaders() },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: "Session revoked" });
      await load();
    } catch (e) {
      toast({ title: "Revoke failed", description: String(e), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const revokeOthers = async () => {
    setBusyId("all");
    try {
      const res = await fetch(`${apiBase()}/api/auth/sessions/revoke-others`, {
        method: "POST",
        headers: { ...authHeaders() },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: "Other sessions signed out" });
      await load();
    } catch (e) {
      toast({ title: "Action failed", description: String(e), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Security Information</h2>
          <button
            onClick={load}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Last Login</span>
            <span className="text-sm font-medium text-foreground">
              {loading ? "…" : formatDateTime(info?.last_login_at || null)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Account Created</span>
            <span className="text-sm font-medium text-foreground">
              {loading ? "…" : formatDateTime(info?.account_created_at || null)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Active Sessions</span>
            <span className="text-sm font-medium text-foreground">
              {loading ? "…" : info?.active_sessions.length ?? 0}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Active Sessions</h2>
          {info && info.active_sessions.length > 1 && (
            <button
              onClick={revokeOthers}
              disabled={busyId === "all"}
              className="text-xs px-3 py-1.5 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-60 flex items-center gap-1"
            >
              <ShieldOff className="w-3.5 h-3.5" />
              {busyId === "all" ? "Signing out…" : "Sign out other sessions"}
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !info || info.active_sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          <ul className="space-y-3">
            {info.active_sessions.map((s) => {
              const ua = describeUserAgent(s.user_agent);
              const Icon = ua.isMobile ? Smartphone : Monitor;
              return (
                <li
                  key={s.id}
                  className={`p-4 rounded-lg border flex items-start gap-3 ${
                    s.current ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30"
                  }`}
                >
                  <div className="p-2 rounded-md bg-background border border-border">
                    <Icon className="w-4 h-4 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">
                        {ua.label}
                      </span>
                      {s.current && (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                          This device
                        </span>
                      )}
                    </div>
                    <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {s.ip || "Unknown IP"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Last active {formatDateTime(s.last_seen_at)}
                      </span>
                      <span className="flex items-center gap-1 sm:col-span-2">
                        Started {formatDateTime(s.created_at)} • Expires {formatDateTime(s.expires_at)}
                      </span>
                    </div>
                  </div>
                  {!s.current && (
                    <button
                      onClick={() => revokeOne(s.id)}
                      disabled={busyId === s.id}
                      className="text-xs px-2.5 py-1.5 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-60 flex items-center gap-1"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {busyId === s.id ? "…" : "Sign out"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
