import { useEffect, useMemo, useState } from "react";
import { Clock, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { getToken, clearToken, isLoggedIn, getApiUrl} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useIdleLogout } from "@/hooks/use-idle-logout";

const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const IDLE_WARN_MS = 5 * 60 * 1000;

function persistRefreshedToken(newToken: string) {
  if (localStorage.getItem("token")) {
    localStorage.setItem("token", newToken);
  } else {
    sessionStorage.setItem("token", newToken);
  }
}

function decodeExp(token: string | null): number | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    );
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

function format(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SessionTimer({ lightBg = false }: { lightBg?: boolean }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [now, setNow] = useState(Date.now());
  const [warned, setWarned] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const expMs = useMemo(() => decodeExp(getToken()), [refreshTick]);

  const handleRefresh = async () => {
    const token = getToken();
    if (!token || refreshing) return;
    setRefreshing(true);
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/auth/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.token) {
        persistRefreshedToken(data.token);
        setWarned(false);
        setRefreshTick((t) => t + 1);
        toast({ title: "Session extended", description: "You're signed in for a fresh session." });
      }
    } catch {
      toast({
        title: "Couldn't extend session",
        description: "Please sign in again.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useIdleLogout({
    enabled: isLoggedIn(),
    timeoutMs: IDLE_TIMEOUT_MS,
    warnMs: IDLE_WARN_MS,
    onWarn: () =>
      toast({
        title: "You're about to be signed out",
        description: "We'll log you out in 5 minutes due to inactivity. Move your mouse to stay signed in.",
      }),
    onTimeout: () => {
      clearToken();
      toast({
        title: "Signed out due to inactivity",
        description: "Please sign in again to continue.",
        variant: "destructive",
      });
      navigate("/login");
    },
  });

  useEffect(() => {
    if (!expMs) return;
    const remaining = expMs - now;
    if (remaining <= 0) {
      clearToken();
      toast({
        title: "Session expired",
        description: "Please sign in again to continue.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }
    if (!warned && remaining <= 60_000) {
      setWarned(true);
      toast({
        title: "Session ending soon",
        description: "Your session will expire in less than a minute.",
      });
    }
  }, [now, expMs, warned, navigate, toast]);

  if (!isLoggedIn() || !expMs) return null;

  const remaining = Math.max(0, expMs - now);
  const danger = remaining <= 60_000;
  const warn = remaining <= 5 * 60_000;

  const cls = danger
    ? lightBg
      ? "bg-red-50 border-red-300 text-red-600 animate-pulse"
      : "bg-red-500/30 border-red-200/60 text-white animate-pulse"
    : warn
    ? lightBg
      ? "bg-amber-50 border-amber-300 text-amber-700"
      : "bg-amber-400/30 border-amber-200/60 text-white"
    : lightBg
    ? "bg-primary/8 border-primary/20 text-primary dark:bg-white/15 dark:border-white/30 dark:text-white"
    : "bg-white/15 border-white/30 text-white";

  return (
    <div className="hidden sm:flex items-center gap-2">
      <div
        title="Time remaining until your session expires"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border backdrop-blur-sm ${cls}`}
      >
        <Clock className="w-3.5 h-3.5" />
        <span className="tabular-nums">{format(remaining)}</span>
      </div>
      {danger && (
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="Extend your session without signing in again"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border border-white/40 bg-white text-purple-700 hover:bg-purple-50 transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Extending…" : "Stay signed in"}
        </button>
      )}
    </div>
  );
}
