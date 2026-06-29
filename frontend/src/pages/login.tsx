import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { setToken, getApiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowLeft, ShieldCheck, Eye, EyeOff } from "lucide-react";
import PasswordInput from "@/components/password-input";

type ForgotStep = "email" | "otp" | "newpass" | "done";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [facebookLoading, setFacebookLoading] = useState(false);

  // Forgot password flow
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>("email");
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmNewPass, setShowConfirmNewPass] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (value === "debasis.biswas375@gmail.com") value = "deba";
    setIdentifier(value);
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true); setError("");
    try {
      const res = await fetch(`${getApiUrl()}/api/auth/google`);
      if (!(res as any).ok) throw new Error();
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
      if (!(res as any).ok) throw new Error();
      const data = await res.json();
      window.location.href = data.auth_url;
    } catch {
      setError("Facebook sign-in is not available");
      setFacebookLoading(false);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    if (code && state) handleGoogleCallback(code, state);
  }, []);

  const handleGoogleCallback = async (code: string, state: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/auth/google/callback?code=${code}&state=${state}`);
      const data = await res.json();
      if (!(res as any).ok) throw new Error(data.detail || "Google authentication failed");
      setToken(data.token, rememberMe);
      localStorage.setItem("username", data.username);
      localStorage.setItem("is_admin", String(data.is_admin));
      if (data.avatar_url) {
        localStorage.setItem("avatar_url", data.avatar_url);
      } else {
        localStorage.removeItem("avatar_url");
      }
      toast({ title: "Welcome back!", description: data.existing_user ? `Welcome, ${data.username}!` : `Account created for ${data.username}` });
      navigate("/dashboard");
    } catch {
      setError("Google authentication failed");
      setLoading(false);
    }
  };

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
      const data = await (res as any).json();
      if (!(res as any).ok) {
        let errorMsg = "Login failed";
        if (data) {
          if (typeof data.detail === "string") {
            errorMsg = data.detail;
          } else if (Array.isArray(data.detail) && data.detail.length > 0) {
            errorMsg = data.detail[0].msg || JSON.stringify(data.detail);
          } else if (data.error) {
            errorMsg = data.error;
          }
        }
        setError(errorMsg);
        return;
      }
      setToken(data.token, rememberMe);
      localStorage.setItem("username", data.username);
      localStorage.setItem("is_admin", String(data.is_admin));
      localStorage.removeItem("avatar_url");
      toast({ title: "Welcome back!", description: `Logged in as ${data.username}` });
      navigate("/dashboard");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password: Step 1 — send OTP ──────────────────────────────────
  const handleSendResetOtp = async (e: React.FormEvent) => {
    e.preventDefault(); setResetError(""); setResetLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();
      if (!res.ok) { setResetError(data.detail || data.error || "Failed to send OTP"); return; }
      setForgotStep("otp");
      setResendCooldown(60);
      toast({ title: "OTP sent", description: "Check your email for the 6-digit code." });
    } catch {
      setResetError("Connection error. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleResendResetOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      await fetch(`${getApiUrl()}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      setResendCooldown(60);
      toast({ title: "OTP resent", description: "Check your email for the new code." });
    } catch { }
  };

  // ── Forgot password: Step 2 — verify OTP ────────────────────────────────
  const handleVerifyResetOtp = async (e: React.FormEvent) => {
    e.preventDefault(); setResetError(""); setResetLoading(true);
    try {
      // We just validate OTP format client-side and proceed — actual verification on reset
      if (!resetOtp.trim() || resetOtp.length < 6) { setResetError("Please enter the 6-digit OTP"); setResetLoading(false); return; }
      setForgotStep("newpass");
    } finally {
      setResetLoading(false);
    }
  };

  // ── Forgot password: Step 3 — set new password ──────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setResetError(""); setResetLoading(true);
    if (newPassword !== confirmNewPassword) { setResetError("Passwords do not match"); setResetLoading(false); return; }
    if (newPassword.length < 6) { setResetError("Password must be at least 6 characters"); setResetLoading(false); return; }
    try {
      const res = await fetch(`${getApiUrl()}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail, token: resetOtp, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setResetError(data.detail || data.error || "Failed to reset password"); return; }
      setForgotStep("done");
      toast({ title: "Password updated!", description: "You can now sign in with your new password." });
    } catch {
      setResetError("Connection error. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  const resetForgotFlow = () => {
    setShowForgot(false); setForgotStep("email"); setResetEmail("");
    setResetOtp(""); setNewPassword(""); setConfirmNewPassword("");
    setResetError(""); setResendCooldown(0);
  };

  const btnStyle = { background: "linear-gradient(135deg, #4a6cf7 0%, #7c3aed 100%)", color: "#fff", boxShadow: "0 4px 14px rgba(74,108,247,0.35)" } as const;
  const inputClass = "w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-sm transition-all";

  return (
    <div className="relative min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px] relative">

        {/* ── Normal login ─────────────────────────────────────────────── */}
        {!showForgot && (
          <>
            <div className="rounded-2xl border border-border bg-card px-8 py-8 mb-3 text-center shadow-sm" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.08)" }}>
              <div className="flex justify-center mb-5">
                <button onClick={() => navigate("/")} className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer hover:scale-105 transition-transform focus:outline-none" style={{ background: "rgba(74,108,247,0.06)", border: "1px solid rgba(74,108,247,0.12)" }} title="Back to home">
                  <img src="/logo.png" alt="Acrozo Icon" className="w-12 h-12 object-contain invert dark:invert-0" />
                </button>
              </div>
              <h1 className="text-2xl font-semibold text-foreground mb-1 flex items-center justify-center gap-2 flex-wrap">
                <span>Sign in to</span>
                <img src="/web-logo.png" alt="Acrozo" className="h-6 w-auto object-contain invert dark:invert-0" style={{ display: "inline-block", verticalAlign: "middle" }} />
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Enter your credentials to access your account</p>
            </div>

            <div className="rounded-2xl border border-border bg-card px-8 py-7 shadow-sm" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.08)" }}>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Username, Email or Phone</label>
                  <input id="login-identifier" type="text" value={identifier} onChange={handleIdentifierChange} placeholder="Username, email, or phone" required autoComplete="username" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
                  <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required className={inputClass} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input id="remember" type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 rounded border-input accent-primary" />
                    <span className="text-sm text-muted-foreground">Remember me</span>
                  </label>
                  <button type="button" onClick={() => { setShowForgot(true); setResetEmail(identifier.includes("@") ? identifier : ""); setError(""); }} className="text-sm text-primary hover:underline font-medium">
                    Forgot password?
                  </button>
                </div>
                {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-3.5 py-2.5 rounded-xl">{error}</div>}
                <button id="login-submit" type="submit" disabled={loading} className="w-full py-2.5 px-4 font-semibold rounded-xl text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/40" style={btnStyle}>
                  {loading ? "Signing in…" : "Sign in"}
                </button>

                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-xs"><span className="px-2 bg-card text-muted-foreground">or continue with</span></div>
                </div>

                <button id="login-google" type="button" onClick={handleGoogleLogin} disabled={googleLoading}
                  className="w-full py-2.5 px-4 bg-background border border-border text-foreground font-medium rounded-xl hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2.5">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {googleLoading ? "Connecting…" : "Sign in with Google"}
                </button>

                <button id="login-facebook" type="button" onClick={handleFacebookLogin} disabled={facebookLoading}
                  className="w-full py-2.5 px-4 bg-[#1877F2] text-white font-medium rounded-xl hover:bg-[#166fe5] focus:outline-none focus:ring-2 focus:ring-[#1877F2]/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2.5">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
                    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                  </svg>
                  {facebookLoading ? "Connecting…" : "Sign in with Facebook"}
                </button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-5">
                Don't have an account?{" "}
                <button onClick={() => navigate("/signup")} className="text-primary font-semibold hover:underline">Create account</button>
              </p>
            </div>
          </>
        )}

        {/* ── Forgot password flow ─────────────────────────────────────── */}
        {showForgot && (
          <>
            {/* Header card */}
            <div className="rounded-2xl border border-border bg-card px-8 py-8 mb-3 text-center shadow-sm" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.08)" }}>
              <div className="flex justify-center mb-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(74,108,247,0.08)", border: "1px solid rgba(74,108,247,0.15)" }}>
                  {forgotStep === "otp" || forgotStep === "newpass" ? <ShieldCheck className="w-7 h-7 text-primary" /> : <Mail className="w-7 h-7 text-primary" />}
                </div>
              </div>
              <h1 className="text-2xl font-semibold text-foreground mb-1">
                {forgotStep === "email" && "Reset Password"}
                {forgotStep === "otp" && "Enter OTP"}
                {forgotStep === "newpass" && "New Password"}
                {forgotStep === "done" && "Password Updated"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {forgotStep === "email" && "Enter your email to receive a reset OTP"}
                {forgotStep === "otp" && <>We sent a code to <span className="font-medium text-foreground">{resetEmail}</span></>}
                {forgotStep === "newpass" && "Choose a strong new password"}
                {forgotStep === "done" && "You can now sign in with your new password"}
              </p>
            </div>

            {/* Form card */}
            <div className="rounded-2xl border border-border bg-card px-8 py-7 shadow-sm" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.08)" }}>

              {/* Step 1: email */}
              {forgotStep === "email" && (
                <form onSubmit={handleSendResetOtp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Email Address</label>
                    <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="your@email.com" required className={inputClass} />
                  </div>
                  {resetError && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-3.5 py-2.5 rounded-xl">{resetError}</div>}
                  <button type="submit" disabled={resetLoading} className="w-full py-2.5 px-4 font-semibold rounded-xl text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5" style={btnStyle}>
                    {resetLoading ? "Sending OTP…" : "Send OTP"}
                  </button>
                </form>
              )}

              {/* Step 2: OTP */}
              {forgotStep === "otp" && (
                <form onSubmit={handleVerifyResetOtp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Enter OTP</label>
                    <input
                      type="text" inputMode="numeric" maxLength={6}
                      value={resetOtp} onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="6-digit code" required autoFocus
                      className={inputClass + " text-center text-2xl font-bold tracking-[0.5em]"}
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">OTP expires in 15 minutes</p>
                  </div>
                  {resetError && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-3.5 py-2.5 rounded-xl">{resetError}</div>}
                  <button type="submit" disabled={resetLoading} className="w-full py-2.5 px-4 font-semibold rounded-xl text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5" style={btnStyle}>
                    {resetLoading ? "Verifying…" : "Verify OTP"}
                  </button>
                  <p className="text-center text-sm text-muted-foreground">
                    Didn't receive it?{" "}
                    <button type="button" onClick={handleResendResetOtp} disabled={resendCooldown > 0} className="text-primary font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                    </button>
                  </p>
                </form>
              )}

              {/* Step 3: new password */}
              {forgotStep === "newpass" && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">New Password</label>
                    <div className="relative">
                      <input type={showNewPass ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" required className={inputClass + " pr-10"} />
                      <button type="button" onClick={() => setShowNewPass((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                        {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Confirm New Password</label>
                    <div className="relative">
                      <input type={showConfirmNewPass ? "text" : "password"} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="Re-enter password" required className={inputClass + " pr-10"} />
                      <button type="button" onClick={() => setShowConfirmNewPass((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                        {showConfirmNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {resetError && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-3.5 py-2.5 rounded-xl">{resetError}</div>}
                  <button type="submit" disabled={resetLoading} className="w-full py-2.5 px-4 font-semibold rounded-xl text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5" style={btnStyle}>
                    {resetLoading ? "Updating…" : "Update Password"}
                  </button>
                </form>
              )}

              {/* Step 4: done */}
              {forgotStep === "done" && (
                <div className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 text-sm px-4 py-3 rounded-xl">
                    <p className="font-medium">Password updated successfully!</p>
                    <p className="mt-1 text-green-700 dark:text-green-400">You can now sign in with your new password.</p>
                  </div>
                  <button onClick={resetForgotFlow} className="w-full py-2.5 px-4 font-semibold rounded-xl text-sm transition-all hover:-translate-y-0.5" style={btnStyle}>
                    Back to Sign In
                  </button>
                </div>
              )}

              {forgotStep !== "done" && (
                <div className="mt-5 text-center">
                  <button type="button" onClick={resetForgotFlow} className="text-muted-foreground text-sm hover:text-foreground inline-flex items-center gap-1.5 transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
