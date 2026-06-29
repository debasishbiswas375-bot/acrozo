import { useState, useEffect } from "react";
import { getApiUrl } from "@/lib/api";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, MapPin, CheckCircle2, Eye, EyeOff, Mail, ArrowLeft, ShieldCheck } from "lucide-react";

interface Captcha {
  id: string;
  question: string;
}

type Step = "form" | "otp";

export default function SignupPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("form");
  const [pendingEmail, setPendingEmail] = useState("");
  const [form, setForm] = useState({
    username: "",
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
    address_line: "",
    pincode: "",
    city: "",
    district: "",
    state: "",
    country: "",
    captcha_answer: "",
  });
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [loadingPincode, setLoadingPincode] = useState(false);
  const [pincodeSuccess, setPincodeSuccess] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [facebookLoading, setFacebookLoading] = useState(false);

  useEffect(() => { loadCaptcha(); }, []);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleGoogleSignup = async () => {
    setGoogleLoading(true); setError("");
    try {
      const res = await fetch(`${getApiUrl()}/api/auth/google`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      window.location.href = data.auth_url;
    } catch {
      setError("Google sign-up is not available");
      setGoogleLoading(false);
    }
  };

  const handleFacebookSignup = async () => {
    setFacebookLoading(true); setError("");
    try {
      const res = await fetch(`${getApiUrl()}/api/auth/facebook`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      window.location.href = data.auth_url;
    } catch {
      setError("Facebook sign-up is not available");
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
      if (!res.ok) throw new Error(data.detail || "Google authentication failed");
      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username);
      localStorage.setItem("is_admin", String(data.is_admin));
      if (data.avatar_url) {
        localStorage.setItem("avatar_url", data.avatar_url);
      } else {
        localStorage.removeItem("avatar_url");
      }
      toast({
        title: data.existing_user ? "Welcome back!" : "Account created!",
        description: data.existing_user ? `Welcome, ${data.username}!` : `Account created for ${data.username}`,
      });
      navigate("/dashboard");
    } catch {
      setError("Google authentication failed");
      setLoading(false);
    }
  };

  const loadCaptcha = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/captcha`);
      if (res.ok) setCaptcha(await res.json());
    } catch {}
  };

  const lookupPincode = async (pincode: string) => {
    if (pincode.length !== 6) { setPincodeSuccess(false); return; }
    setLoadingPincode(true); setPincodeSuccess(false);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await res.json();
      if (data && data[0]?.Status === "Success" && data[0]?.PostOffice?.length > 0) {
        const po = data[0].PostOffice[0];
        setForm((prev) => ({ ...prev, city: po.Name || prev.city, district: po.District || prev.district, state: po.State || prev.state, country: po.Country || "India" }));
        setPincodeSuccess(true);
      } else {
        const backendRes = await fetch(`${getApiUrl()}/api/lookup-pincode`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pincode }) });
        if (backendRes.ok) {
          const bd = await backendRes.json();
          setForm((prev) => ({ ...prev, city: bd.city || prev.city, district: bd.district || prev.district, state: bd.state || prev.state, country: bd.country || "India" }));
          setPincodeSuccess(true);
        }
      }
    } catch {
      try {
        const backendRes = await fetch(`${getApiUrl()}/api/lookup-pincode`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pincode }) });
        if (backendRes.ok) {
          const bd = await backendRes.json();
          setForm((prev) => ({ ...prev, city: bd.city || prev.city, district: bd.district || prev.district, state: bd.state || prev.state, country: bd.country || "India" }));
          setPincodeSuccess(true);
        }
      } catch {}
    } finally {
      setLoadingPincode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!captcha) { setError("Please refresh the captcha"); return; }
    if (form.password !== form.confirm) { setError("Passwords do not match"); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (!form.captcha_answer.trim()) { setError("Please answer the captcha question"); return; }
    setLoading(true);
    try {
      // First: call /api/signup to create full account (existing endpoint)
      const res = await fetch(`${getApiUrl()}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          address_line: form.address_line || undefined,
          pincode: form.pincode || undefined,
          city: form.city || undefined,
          district: form.district || undefined,
          state: form.state || undefined,
          country: form.country || undefined,
          captcha_id: captcha.id,
          captcha_answer: form.captcha_answer,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || data.error || "Signup failed");
        loadCaptcha();
        return;
      }
      // Account created — now send OTP for email verification
      const otpRes = await fetch(`${getApiUrl()}/api/auth/send-verify-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, username: form.username }),
      });
      // Even if OTP send fails, show OTP screen (user can resend)
      setPendingEmail(form.email);
      setStep("otp");
      setResendCooldown(60);
      toast({ title: "Account created!", description: "Please verify your email with the OTP we sent." });
    } catch {
      setError("Connection error. Please try again.");
      loadCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError("");
    if (!otp.trim() || otp.length < 6) { setOtpError("Please enter the 6-digit OTP"); return; }
    setOtpLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/auth/verify-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.detail || data.error || "Invalid OTP");
        return;
      }
      toast({ title: "Email verified!", description: "Your account is ready. Please sign in." });
      navigate("/login");
    } catch {
      setOtpError("Connection error. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      await fetch(`${getApiUrl()}/api/auth/send-verify-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, username: form.username }),
      });
      setResendCooldown(60);
      toast({ title: "OTP resent", description: "Check your email for the new OTP." });
    } catch {
      toast({ title: "Failed to resend", description: "Please try again." });
    }
  };

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "pincode") {
      if (value.length === 6) lookupPincode(value);
      else setPincodeSuccess(false);
    }
  };

  const inputClass = "w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-sm transition-all";

  // ── OTP verification screen ──────────────────────────────────────────────
  if (step === "otp") {
    return (
      <div className="relative min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px]">
          {/* Header card */}
          <div className="rounded-2xl border border-border bg-card px-8 py-8 mb-3 text-center shadow-sm" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.08)" }}>
            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(74,108,247,0.08)", border: "1px solid rgba(74,108,247,0.15)" }}>
                <ShieldCheck className="w-7 h-7 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-1">Verify your email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a 6-digit OTP to<br />
              <span className="font-medium text-foreground">{pendingEmail}</span>
            </p>
          </div>

          {/* OTP form card */}
          <div className="rounded-2xl border border-border bg-card px-8 py-7 shadow-sm" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.08)" }}>
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Enter OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  required
                  autoFocus
                  className={inputClass + " text-center text-2xl font-bold tracking-[0.5em]"}
                />
                <p className="text-xs text-muted-foreground mt-1.5">OTP expires in 10 minutes</p>
              </div>

              {otpError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-3.5 py-2.5 rounded-xl">
                  {otpError}
                </div>
              )}

              <button
                type="submit"
                disabled={otpLoading}
                className="w-full py-2.5 px-4 font-semibold rounded-xl text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/40"
                style={{ background: "linear-gradient(135deg, #4a6cf7 0%, #7c3aed 100%)", color: "#fff", boxShadow: "0 4px 14px rgba(74,108,247,0.35)" }}
              >
                {otpLoading ? "Verifying…" : "Verify Email"}
              </button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                Didn't receive it?{" "}
                <button
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0}
                  className="text-primary font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                </button>
              </p>
            </div>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => { setStep("form"); setOtp(""); setOtpError(""); }}
                className="text-muted-foreground text-sm hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign up
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Registration form ────────────────────────────────────────────────────
  return (
    <div className="relative min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[440px] relative">
        <div className="rounded-2xl border border-border bg-card px-8 py-8 mb-3 text-center shadow-sm" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.08)" }}>
          <div className="flex justify-center mb-5">
            <button
              onClick={() => navigate("/")}
              className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer hover:scale-105 transition-transform focus:outline-none"
              style={{ background: "rgba(74,108,247,0.06)", border: "1px solid rgba(74,108,247,0.12)" }}
              title="Back to home"
            >
              <img src="/logo.png" alt="Acrozo Icon" className="w-12 h-12 object-contain invert dark:invert-0" />
            </button>
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-1 flex items-center justify-center gap-2 flex-wrap">
            <span>Create your</span>
            <img src="/web-logo.png" alt="Acrozo" className="h-6 w-auto object-contain invert dark:invert-0" style={{ display: "inline-block", verticalAlign: "middle" }} />
            <span>account</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Join thousands of businesses using Acrozo</p>
        </div>

        <div className="rounded-2xl border border-border bg-card px-8 py-7 shadow-sm" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.08)" }}>
          <button id="signup-google" type="button" onClick={handleGoogleSignup} disabled={googleLoading}
            className="w-full py-2.5 px-4 bg-background border border-border text-foreground font-medium rounded-xl hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2.5 mb-4">
            <svg viewBox="0 0 24 24" width="18" height="18" className="flex-shrink-0">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {googleLoading ? "Connecting…" : "Sign up with Google"}
          </button>

          <button id="signup-facebook" type="button" onClick={handleFacebookSignup} disabled={facebookLoading}
            className="w-full py-2.5 px-4 bg-[#1877F2] text-white font-medium rounded-xl hover:bg-[#166fe5] focus:outline-none focus:ring-2 focus:ring-[#1877F2]/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2.5 mb-4">
            <svg viewBox="0 0 24 24" width="18" height="18" className="flex-shrink-0" fill="white">
              <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
            </svg>
            {facebookLoading ? "Connecting…" : "Sign up with Facebook"}
          </button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="px-2 bg-card text-muted-foreground">or sign up with email</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Full Name *</label>
                <input type="text" value={form.full_name} onChange={update("full_name")} placeholder="Full name" required className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Username *</label>
                <input type="text" value={form.username} onChange={update("username")} placeholder="Username" required className={inputClass} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Email Address *</label>
              <input type="email" value={form.email} onChange={update("email")} placeholder="your@email.com" required className={inputClass} />
              <p className="text-xs text-muted-foreground mt-1">We'll send a verification OTP to this email</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Phone Number *</label>
              <input type="tel" value={form.phone} onChange={update("phone")} placeholder="9876543210" required pattern="[6-9][0-9]{9}" className={inputClass} />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Address Line</label>
              <input type="text" value={form.address_line} onChange={update("address_line")} placeholder="Street address" className={inputClass} />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Pincode</label>
              <div className="relative">
                <input type="text" value={form.pincode} onChange={update("pincode")} placeholder="110001" maxLength={6} pattern="[0-9]{6}" className={inputClass + " pr-9"} />
                {loadingPincode && <div className="absolute right-3 top-1/2 -translate-y-1/2"><RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
                {pincodeSuccess && !loadingPincode && <div className="absolute right-3 top-1/2 -translate-y-1/2"><CheckCircle2 className="w-4 h-4 text-green-500" /></div>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Enter 6-digit pincode — city, district &amp; state auto-filled</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                City / Village
                {pincodeSuccess && <span className="text-xs font-normal text-green-600 bg-green-50 dark:bg-green-950/40 px-1.5 py-0.5 rounded">Auto-filled</span>}
              </label>
              <input type="text" value={form.city} onChange={update("city")} placeholder="City or village" className={inputClass} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">District</label>
                <input type="text" value={form.district} onChange={update("district")} placeholder="District" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">State</label>
                <input type="text" value={form.state} onChange={update("state")} placeholder="State" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Country</label>
                <input type="text" value={form.country} onChange={update("country")} placeholder="Country" className={inputClass} />
              </div>
            </div>

            {pincodeSuccess && (
              <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>Location auto-filled from pincode. You can edit any field.</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Password *</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={form.password} onChange={update("password")} placeholder="Min 6 characters" required className={inputClass + " pr-10"} />
                <button type="button" onClick={() => setShowPassword((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Confirm Password *</label>
              <div className="relative">
                <input type={showConfirm ? "text" : "password"} value={form.confirm} onChange={update("confirm")} placeholder="Re-enter password" required className={inputClass + " pr-10"} />
                <button type="button" onClick={() => setShowConfirm((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {captcha && (
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Security Question *</label>
                <div className="p-3 bg-muted/40 rounded-xl border border-border mb-2">
                  <p className="text-sm font-medium text-foreground">{captcha.question}</p>
                </div>
                <input type="text" value={form.captcha_answer} onChange={update("captcha_answer")} placeholder="Enter your answer" required className={inputClass} />
                <button type="button" onClick={loadCaptcha} className="text-xs text-primary hover:underline mt-1.5 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Refresh question
                </button>
              </div>
            )}

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-3.5 py-2.5 rounded-xl">{error}</div>
            )}

            <button
              id="signup-submit" type="submit" disabled={loading}
              className="w-full py-2.5 px-4 font-semibold rounded-xl text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/40 mt-1"
              style={{ background: "linear-gradient(135deg, #4a6cf7 0%, #7c3aed 100%)", color: "#fff", boxShadow: "0 4px 14px rgba(74,108,247,0.35)" }}
            >
              {loading ? "Creating account…" : "Create account & verify email"}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-5">
            Already have an account?{" "}
            <button onClick={() => navigate("/login")} className="text-primary font-semibold hover:underline">Sign in</button>
          </p>
        </div>
      </div>
    </div>
  );
}
