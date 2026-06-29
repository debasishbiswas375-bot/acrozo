/**
 * AuthModal.tsx
 *
 * A single modal that embeds both the Login and Signup flows inline.
 * On successful auth it closes and reloads the current page — the user
 * never leaves. All logic is self-contained; the original login.tsx and
 * signup.tsx pages are NOT modified.
 *
 * Drop this file at: frontend/src/components/AuthModal.tsx
 */

import { useState, useEffect, useCallback } from "react";
import { X, Eye, EyeOff, Mail, ArrowLeft, ShieldCheck, RefreshCw, MapPin, CheckCircle2 } from "lucide-react";
import { setToken, getApiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuthModal } from "@/contexts/AuthModalContext";
import PasswordInput from "@/components/password-input";

// ─── Shared styles ────────────────────────────────────────────────────────────

const btnStyle = {
  background: "linear-gradient(135deg, #4a6cf7 0%, #7c3aed 100%)",
  color: "#fff",
  boxShadow: "0 4px 14px rgba(74,108,247,0.35)",
} as const;

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-sm transition-all";

// ─── On-success handler — closes modal and re-renders the page in-place ───────

function onAuthSuccess(
  token: string,
  username: string,
  isAdmin: boolean,
  avatarUrl: string | null,
  rememberMe: boolean,
  close: () => void,
  toast: ReturnType<typeof useToast>["toast"],
  message: string
) {
  setToken(token, rememberMe);
  localStorage.setItem("username", username);
  localStorage.setItem("is_admin", String(isAdmin));
  if (avatarUrl) {
    localStorage.setItem("avatar_url", avatarUrl);
  } else {
    localStorage.removeItem("avatar_url");
  }
  toast({ title: "Welcome!", description: message });
  close();
  // Force a re-render of the whole tree so ProtectedRoute / auth gates update
  if (window.location.pathname === "/") {
  window.location.href = "/dashboard";
} else {
  window.location.reload();
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// LOGIN FORM
// ═════════════════════════════════════════════════════════════════════════════

type ForgotStep = "email" | "otp" | "newpass" | "done";

function LoginForm({ switchToSignup }: { switchToSignup: () => void }) {
  const { close } = useAuthModal();
  const { toast } = useToast();

  const [identifier, setIdentifier]     = useState("");
  const [password, setPassword]         = useState("");
  const [rememberMe, setRememberMe]     = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [googleLoading, setGoogleLoading]     = useState(false);
  const [facebookLoading, setFacebookLoading] = useState(false);

  // Forgot password
  const [showForgot, setShowForgot]           = useState(false);
  const [forgotStep, setForgotStep]           = useState<ForgotStep>("email");
  const [resetEmail, setResetEmail]           = useState("");
  const [resetOtp, setResetOtp]               = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPass, setShowNewPass]         = useState(false);
  const [showConfirmNewPass, setShowConfirmNewPass] = useState(false);
  const [resetLoading, setResetLoading]       = useState(false);
  const [resetError, setResetError]           = useState("");
  const [resendCooldown, setResendCooldown]   = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      let correctedIdentifier = identifier;
      if (identifier.match(/^\d{10,}$/)) correctedIdentifier = identifier.slice(-10);
      const res = await fetch(`${getApiUrl()}/api/auth/login?${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", Pragma: "no-cache" },
        body: JSON.stringify({ identifier: correctedIdentifier, password, rememberMe }),
      });
      const data = await res.json();
      if (!res.ok) {
        let msg = "Login failed";
        if (typeof data.detail === "string") msg = data.detail;
        else if (Array.isArray(data.detail) && data.detail.length > 0) msg = data.detail[0].msg || msg;
        else if (data.error) msg = data.error;
        setError(msg); return;
      }
      onAuthSuccess(data.token, data.username, data.is_admin, data.avatar_url ?? null, rememberMe, close, toast, `Logged in as ${data.username}`);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true); setError("");
    try {
      const res = await fetch(`${getApiUrl()}/api/auth/google`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      window.location.href = data.auth_url;
    } catch {
      setError("Google sign-in is not available");
      setGoogleLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    setFacebookLoading(true); setError("");
    try {
      const res = await fetch(`${getApiUrl()}/api/auth/facebook`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      window.location.href = data.auth_url;
    } catch {
      setError("Facebook sign-in is not available");
      setFacebookLoading(false);
    }
  };

  // Forgot password handlers
  const handleSendResetOtp = async (e: React.FormEvent) => {
    e.preventDefault(); setResetError(""); setResetLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/forgot-password`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();
      if (!res.ok) { setResetError(data.detail || data.error || "Failed to send OTP"); return; }
      setForgotStep("otp"); setResendCooldown(60);
      toast({ title: "OTP sent", description: "Check your email for the 6-digit code." });
    } catch { setResetError("Connection error. Please try again."); }
    finally { setResetLoading(false); }
  };

  const handleResendResetOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      await fetch(`${getApiUrl()}/api/forgot-password`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      setResendCooldown(60);
      toast({ title: "OTP resent", description: "Check your email for the new code." });
    } catch {}
  };

  const handleVerifyResetOtp = async (e: React.FormEvent) => {
    e.preventDefault(); setResetError(""); setResetLoading(true);
    try {
      if (!resetOtp.trim() || resetOtp.length < 6) { setResetError("Please enter the 6-digit OTP"); return; }
      setForgotStep("newpass");
    } finally { setResetLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setResetError(""); setResetLoading(true);
    if (newPassword !== confirmNewPassword) { setResetError("Passwords do not match"); setResetLoading(false); return; }
    if (newPassword.length < 6) { setResetError("Password must be at least 6 characters"); setResetLoading(false); return; }
    try {
      const res = await fetch(`${getApiUrl()}/api/reset-password`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail, token: resetOtp, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setResetError(data.detail || data.error || "Failed to reset password"); return; }
      setForgotStep("done");
      toast({ title: "Password updated!", description: "You can now sign in with your new password." });
    } catch { setResetError("Connection error. Please try again."); }
    finally { setResetLoading(false); }
  };

  const resetForgotFlow = () => {
    setShowForgot(false); setForgotStep("email"); setResetEmail("");
    setResetOtp(""); setNewPassword(""); setConfirmNewPassword("");
    setResetError(""); setResendCooldown(0);
  };

  // ── Normal login UI ────────────────────────────────────────────────────────
  if (!showForgot) return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center">
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(74,108,247,0.06)", border: "1px solid rgba(74,108,247,0.12)" }}>
            <img src="/logo.png" alt="Acrozo" className="w-10 h-10 object-contain invert dark:invert-0" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-foreground">Sign in to Acrozo</h2>
        <p className="text-sm text-muted-foreground mt-1">Enter your credentials to continue</p>
      </div>

      {/* Social */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={handleGoogleLogin} disabled={googleLoading}
          className="py-2 px-3 bg-background border border-border text-foreground font-medium rounded-xl hover:bg-accent text-xs flex items-center justify-center gap-2 disabled:opacity-60 transition-all">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {googleLoading ? "…" : "Google"}
        </button>
        <button type="button" onClick={handleFacebookLogin} disabled={facebookLoading}
          className="py-2 px-3 bg-[#1877F2] text-white font-medium rounded-xl hover:bg-[#166fe5] text-xs flex items-center justify-center gap-2 disabled:opacity-60 transition-all">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
            <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
          </svg>
          {facebookLoading ? "…" : "Facebook"}
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs"><span className="px-2 bg-card text-muted-foreground">or with email</span></div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Username, Email or Phone</label>
          <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Username, email, or phone" required autoComplete="username" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Password</label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password" required className={inputClass} />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-input accent-primary" />
            <span className="text-xs text-muted-foreground">Remember me</span>
          </label>
          <button type="button" onClick={() => { setShowForgot(true); setResetEmail(identifier.includes("@") ? identifier : ""); setError(""); }}
            className="text-xs text-primary hover:underline font-medium">
            Forgot password?
          </button>
        </div>
        {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs px-3 py-2 rounded-xl">{error}</div>}
        <button type="submit" disabled={loading}
          className="w-full py-2.5 px-4 font-semibold rounded-xl text-sm transition-all disabled:opacity-60 hover:-translate-y-0.5 focus:outline-none"
          style={btnStyle}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Don't have an account?{" "}
        <button onClick={switchToSignup} className="text-primary font-semibold hover:underline">Create account</button>
      </p>
    </div>
  );

  // ── Forgot password UI ─────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(74,108,247,0.08)", border: "1px solid rgba(74,108,247,0.15)" }}>
            {forgotStep === "otp" || forgotStep === "newpass" ? <ShieldCheck className="w-7 h-7 text-primary" /> : <Mail className="w-7 h-7 text-primary" />}
          </div>
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          {forgotStep === "email" && "Reset Password"}
          {forgotStep === "otp" && "Enter OTP"}
          {forgotStep === "newpass" && "New Password"}
          {forgotStep === "done" && "Password Updated"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {forgotStep === "email" && "Enter your email to receive a reset OTP"}
          {forgotStep === "otp" && <>Code sent to <span className="font-medium text-foreground">{resetEmail}</span></>}
          {forgotStep === "newpass" && "Choose a strong new password"}
          {forgotStep === "done" && "You can now sign in with your new password"}
        </p>
      </div>

      {forgotStep === "email" && (
        <form onSubmit={handleSendResetOtp} className="space-y-4">
          <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="your@email.com" required className={inputClass} />
          {resetError && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs px-3 py-2 rounded-xl">{resetError}</div>}
          <button type="submit" disabled={resetLoading} className="w-full py-2.5 font-semibold rounded-xl text-sm disabled:opacity-60 hover:-translate-y-0.5" style={btnStyle}>
            {resetLoading ? "Sending…" : "Send OTP"}
          </button>
        </form>
      )}

      {forgotStep === "otp" && (
        <form onSubmit={handleVerifyResetOtp} className="space-y-4">
          <input type="text" inputMode="numeric" maxLength={6} value={resetOtp}
            onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="6-digit code" required autoFocus
            className={inputClass + " text-center text-2xl font-bold tracking-[0.5em]"} />
          {resetError && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs px-3 py-2 rounded-xl">{resetError}</div>}
          <button type="submit" disabled={resetLoading} className="w-full py-2.5 font-semibold rounded-xl text-sm disabled:opacity-60 hover:-translate-y-0.5" style={btnStyle}>
            {resetLoading ? "Verifying…" : "Verify OTP"}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            <button type="button" onClick={handleResendResetOtp} disabled={resendCooldown > 0} className="text-primary font-medium hover:underline disabled:opacity-50">
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
            </button>
          </p>
        </form>
      )}

      {forgotStep === "newpass" && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="relative">
            <input type={showNewPass ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)" required className={inputClass + " pr-10"} />
            <button type="button" onClick={() => setShowNewPass((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1}>
              {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="relative">
            <input type={showConfirmNewPass ? "text" : "password"} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Confirm new password" required className={inputClass + " pr-10"} />
            <button type="button" onClick={() => setShowConfirmNewPass((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1}>
              {showConfirmNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {resetError && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs px-3 py-2 rounded-xl">{resetError}</div>}
          <button type="submit" disabled={resetLoading} className="w-full py-2.5 font-semibold rounded-xl text-sm disabled:opacity-60 hover:-translate-y-0.5" style={btnStyle}>
            {resetLoading ? "Updating…" : "Update Password"}
          </button>
        </form>
      )}

      {forgotStep === "done" && (
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-xl">
            Password updated! You can now sign in.
          </div>
          <button onClick={resetForgotFlow} className="w-full py-2.5 font-semibold rounded-xl text-sm hover:-translate-y-0.5" style={btnStyle}>
            Back to Sign In
          </button>
        </div>
      )}

      {forgotStep !== "done" && (
        <div className="text-center">
          <button type="button" onClick={resetForgotFlow} className="text-muted-foreground text-xs hover:text-foreground inline-flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
          </button>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SIGNUP FORM
// ═════════════════════════════════════════════════════════════════════════════

interface Captcha { id: string; question: string; }
type SignupStep = "form" | "otp";

function SignupForm({ switchToLogin }: { switchToLogin: () => void }) {
  const { close } = useAuthModal();
  const { toast } = useToast();

  const [step, setStep]                   = useState<SignupStep>("form");
  const [pendingEmail, setPendingEmail]   = useState("");
  const [form, setForm] = useState({
    username: "", full_name: "", email: "", phone: "",
    password: "", confirm: "", address_line: "", pincode: "",
    city: "", district: "", state: "", country: "", captcha_answer: "",
  });
  const [otp, setOtp]                         = useState("");
  const [otpLoading, setOtpLoading]           = useState(false);
  const [otpError, setOtpError]               = useState("");
  const [resendCooldown, setResendCooldown]   = useState(0);
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState("");
  const [captcha, setCaptcha]                 = useState<Captcha | null>(null);
  const [loadingPincode, setLoadingPincode]   = useState(false);
  const [pincodeSuccess, setPincodeSuccess]   = useState(false);
  const [googleLoading, setGoogleLoading]     = useState(false);
  const [facebookLoading, setFacebookLoading] = useState(false);

  useEffect(() => { loadCaptcha(); }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const loadCaptcha = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/captcha`);
      if (res.ok) setCaptcha(await res.json());
    } catch {}
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const lookupPincode = async () => {
    if (form.pincode.length < 6) return;
    setLoadingPincode(true); setPincodeSuccess(false);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${form.pincode}`);
      const data = await res.json();
      if (data[0]?.Status === "Success") {
        const po = data[0].PostOffice[0];
        setForm((f) => ({ ...f, city: po.Name, district: po.District, state: po.State, country: "India" }));
        setPincodeSuccess(true);
      }
    } catch {} finally { setLoadingPincode(false); }
  };

  const handleGoogleSignup = async () => {
    setGoogleLoading(true); setError("");
    try {
      const res = await fetch(`${getApiUrl()}/api/auth/google`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      window.location.href = data.auth_url;
    } catch { setError("Google sign-up is not available"); setGoogleLoading(false); }
  };

  const handleFacebookSignup = async () => {
    setFacebookLoading(true); setError("");
    try {
      const res = await fetch(`${getApiUrl()}/api/auth/facebook`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      window.location.href = data.auth_url;
    } catch { setError("Facebook sign-up is not available"); setFacebookLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    if (form.password !== form.confirm) { setError("Passwords do not match"); setLoading(false); return; }
    if (!captcha) { setError("Captcha not loaded. Please refresh."); setLoading(false); return; }
    try {
      const payload = { ...form, captcha_id: captcha.id };
      const res = await fetch(`${getApiUrl()}/api/auth/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        let msg = "Registration failed";
        if (typeof data.detail === "string") msg = data.detail;
        else if (Array.isArray(data.detail) && data.detail[0]?.msg) msg = data.detail[0].msg;
        setError(msg); loadCaptcha(); return;
      }
      setPendingEmail(form.email);
      setStep("otp");
      setResendCooldown(60);
      toast({ title: "OTP sent!", description: `Check ${form.email} for your verification code.` });
    } catch { setError("Connection error. Please try again."); loadCaptcha(); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault(); setOtpError(""); setOtpLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/auth/verify-otp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, otp }),
      });
      const data = await res.json();
      if (!res.ok) { setOtpError(data.detail || data.error || "Invalid OTP"); return; }
      onAuthSuccess(data.token, data.username, data.is_admin, data.avatar_url ?? null, false, close, toast, `Account created for ${data.username}`);
    } catch { setOtpError("Connection error. Please try again."); }
    finally { setOtpLoading(false); }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      await fetch(`${getApiUrl()}/api/auth/resend-otp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail }),
      });
      setResendCooldown(60);
      toast({ title: "OTP resent", description: "Check your email for the new code." });
    } catch {}
  };

  // ── OTP step ───────────────────────────────────────────────────────────────
  if (step === "otp") return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(74,108,247,0.08)", border: "1px solid rgba(74,108,247,0.15)" }}>
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-foreground">Verify your email</h2>
        <p className="text-sm text-muted-foreground mt-1">
          We sent a code to <span className="font-medium text-foreground">{pendingEmail}</span>
        </p>
      </div>
      <form onSubmit={handleVerifyOtp} className="space-y-4">
        <input type="text" inputMode="numeric" maxLength={6} value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          placeholder="6-digit code" required autoFocus
          className={inputClass + " text-center text-2xl font-bold tracking-[0.5em]"} />
        {otpError && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs px-3 py-2 rounded-xl">{otpError}</div>}
        <button type="submit" disabled={otpLoading} className="w-full py-2.5 font-semibold rounded-xl text-sm disabled:opacity-60 hover:-translate-y-0.5" style={btnStyle}>
          {otpLoading ? "Verifying…" : "Verify & Create Account"}
        </button>
        <p className="text-center text-xs text-muted-foreground">
          <button type="button" onClick={handleResendOtp} disabled={resendCooldown > 0} className="text-primary font-medium hover:underline disabled:opacity-50">
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
          </button>
        </p>
      </form>
    </div>
  );

  // ── Registration form ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(74,108,247,0.06)", border: "1px solid rgba(74,108,247,0.12)" }}>
            <img src="/logo.png" alt="Acrozo" className="w-10 h-10 object-contain invert dark:invert-0" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-foreground">Create your Acrozo account</h2>
        <p className="text-sm text-muted-foreground mt-1">Free forever. No credit card required.</p>
      </div>

      {/* Social */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={handleGoogleSignup} disabled={googleLoading}
          className="py-2 px-3 bg-background border border-border text-foreground font-medium rounded-xl hover:bg-accent text-xs flex items-center justify-center gap-2 disabled:opacity-60 transition-all">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {googleLoading ? "…" : "Google"}
        </button>
        <button type="button" onClick={handleFacebookSignup} disabled={facebookLoading}
          className="py-2 px-3 bg-[#1877F2] text-white font-medium rounded-xl hover:bg-[#166fe5] text-xs flex items-center justify-center gap-2 disabled:opacity-60 transition-all">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
            <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
          </svg>
          {facebookLoading ? "…" : "Facebook"}
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs"><span className="px-2 bg-card text-muted-foreground">or with email</span></div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Username *</label>
            <input type="text" value={form.username} onChange={set("username")} placeholder="username" required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Full Name *</label>
            <input type="text" value={form.full_name} onChange={set("full_name")} placeholder="Full name" required className={inputClass} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Email *</label>
          <input type="email" value={form.email} onChange={set("email")} placeholder="your@email.com" required className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Phone</label>
          <input type="tel" value={form.phone} onChange={set("phone")} placeholder="10-digit phone" className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Password *</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={form.password} onChange={set("password")} placeholder="Min 6 chars" required className={inputClass + " pr-10"} />
              <button type="button" onClick={() => setShowPassword((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Confirm *</label>
            <div className="relative">
              <input type={showConfirm ? "text" : "password"} value={form.confirm} onChange={set("confirm")} placeholder="Re-enter" required className={inputClass + " pr-10"} />
              <button type="button" onClick={() => setShowConfirm((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1}>
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Address</label>
          <input type="text" value={form.address_line} onChange={set("address_line")} placeholder="Street / area" className={inputClass} />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-foreground mb-1.5">Pincode</label>
            <div className="relative">
              <input type="text" inputMode="numeric" maxLength={6} value={form.pincode}
                onChange={(e) => { set("pincode")(e); setPincodeSuccess(false); }}
                onBlur={lookupPincode} placeholder="6-digit" className={inputClass + " pr-8"} />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                {loadingPincode && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                {pincodeSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                {!loadingPincode && !pincodeSuccess && form.pincode.length === 6 && <MapPin className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-foreground mb-1.5">City</label>
            <input type="text" value={form.city} onChange={set("city")} placeholder="City" className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">State</label>
            <input type="text" value={form.state} onChange={set("state")} placeholder="State" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Country</label>
            <input type="text" value={form.country} onChange={set("country")} placeholder="Country" className={inputClass} />
          </div>
        </div>

        {/* Captcha */}
        {captcha && (
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Security check: {captcha.question}
              <button type="button" onClick={loadCaptcha} className="ml-2 text-primary hover:underline inline-flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </label>
            <input type="text" value={form.captcha_answer} onChange={set("captcha_answer")} placeholder="Your answer" required className={inputClass} />
          </div>
        )}

        {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs px-3 py-2 rounded-xl">{error}</div>}

        <button type="submit" disabled={loading}
          className="w-full py-2.5 px-4 font-semibold rounded-xl text-sm transition-all disabled:opacity-60 hover:-translate-y-0.5 focus:outline-none"
          style={btnStyle}>
          {loading ? "Creating account…" : "Create Free Account"}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <button onClick={switchToLogin} className="text-primary font-semibold hover:underline">Sign in</button>
      </p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MODAL SHELL
// ═════════════════════════════════════════════════════════════════════════════

export default function AuthModal() {
  const { view, openLogin, openSignup, close } = useAuthModal();

  // Close on Escape key
  useEffect(() => {
    if (!view) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [view, close]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = view ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [view]);

  if (!view) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={close}
    >
      {/* Panel */}
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
        style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={close}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tab switcher */}
        <div className="flex border-b border-border">
          <button
            onClick={openLogin}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
              view === "login"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={openSignup}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
              view === "signup"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form content */}
        <div className="p-6">
          {view === "login"  && <LoginForm  switchToSignup={openSignup} />}
          {view === "signup" && <SignupForm switchToLogin={openLogin}  />}
        </div>
      </div>
    </div>
  );
}
