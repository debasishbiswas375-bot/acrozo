/**
 * FirstLoginTutorial
 *
 * A premium, animated onboarding overlay shown only on the very first
 * login of a new user. It showcases the five core features of Acrozo
 * via a step-by-step card carousel with smooth transitions.
 *
 * Persistence: The flag `acrozo_tutorial_done` is written to localStorage
 * after the user completes or skips the tutorial so it never re-appears.
 */

import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  FileText,
  Download,
  Calculator,
  History,
  Star,
  ArrowRight,
  X,
  CheckCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Database,
  Receipt,
  TrendingUp,
  Shield,
} from "lucide-react";

/* ── Tutorial steps ────────────────────────────────────────────────────────── */
const STEPS = [
  {
    id: "welcome",
    icon: Sparkles,
    logoSrc: "/guide.png",
    iconBg: "from-violet-500 to-indigo-500",
    iconGlow: "rgba(139,92,246,0.35)",
    accent: "#7c3aed",
    tag: "Welcome",
    title: "Welcome to Acrozo! 🎉",
    description:
      "You're now set up with India's smartest accounting automation platform. This quick tour will show you everything you can do in under 2 minutes.",
    tip: "Advanced Core Reliable Operations — Zero Outages",
    cta: "Let's get started →",
  },
  {
    id: "bank-to-erp",
    icon: Database,
    iconBg: "from-blue-500 to-cyan-500",
    iconGlow: "rgba(59,130,246,0.35)",
    accent: "#3b82f6",
    tag: "Core Feature",
    title: "Bank to ERP",
    description:
      "Upload any bank statement PDF and our AI extracts every transaction, maps it to the correct Tally ledger, and generates a ready-to-import XML file.",
    tip: "Supports HDFC, SBI, ICICI, Axis, Yes Bank and 50+ other banks.",
    cta: "Open Bank to ERP",
    route: "/bank-to-erp",
  },
  {
    id: "pdf-extractor",
    icon: FileText,
    iconBg: "from-emerald-500 to-teal-500",
    iconGlow: "rgba(16,185,129,0.35)",
    accent: "#10b981",
    tag: "Document Converters",
    title: "Acrozo PDF Extractor",
    description:
      "Convert any PDF to Excel or Word using our Document AI extraction engine. Also find PDF to Excel and PDF to Word under More Tools.",
    tip: "Handles scanned PDFs too — find all converters under More Tools.",
    cta: "Open PDF Extractor",
    route: "/pdf-converter",
  },
  {
    id: "calculators",
    icon: Calculator,
    iconBg: "from-amber-500 to-orange-500",
    iconGlow: "rgba(245,158,11,0.35)",
    accent: "#f59e0b",
    tag: "Calculators & Utilities",
    title: "GST, TDS & Income Tax",
    description:
      "Calculate GST (CGST, SGST & IGST), TDS interest on late payments, and income tax for FY 2026-27 with new vs old regime comparison.",
    tip: "Find all calculators under More Tools → Calculators & Utilities.",
    cta: "Open GST Calculator",
    route: "/tools/gst-calculator",
  },
  {
    id: "history",
    icon: History,
    iconBg: "from-rose-500 to-pink-500",
    iconGlow: "rgba(244,63,94,0.35)",
    accent: "#f43f5e",
    tag: "History",
    title: "History",
    description:
      "Every conversion is saved. Re-download your last 7 XML exports at any time from the History page — no need to re-process the same PDF twice.",
    tip: "History is tied to your account and always available across devices.",
    cta: "View History",
    route: "/history",
  },
  {
    id: "plan",
    icon: Star,
    iconBg: "from-yellow-400 to-amber-500",
    iconGlow: "rgba(251,191,36,0.40)",
    accent: "#f59e0b",
    tag: "Pricing",
    title: "Plans & Credits",
    description:
      "Check your current plan, remaining credits, and expiry on your Dashboard. Upgrade anytime from Pricing to unlock more conversions.",
    tip: "New accounts start with free credits — no credit card required.",
    cta: "See Pricing",
    route: "/pricing",
  },
];


/* ── Storage helpers ────────────────────────────────────────────────────────── */
const STORAGE_KEY = "acrozo_tutorial_done";

export function shouldShowTutorial(): boolean {
  try {
    return !localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

export function markTutorialDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

/* ── Progress dots ──────────────────────────────────────────────────────────── */
function ProgressDots({
  total,
  current,
  accent,
}: {
  total: number;
  current: number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: i === current ? "20px" : "6px",
            height: "6px",
            background: i === current ? accent : "rgba(150,150,170,0.3)",
          }}
        />
      ))}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function FirstLoginTutorial({
  onDone,
}: {
  onDone?: () => void;
}) {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [slideDir, setSlideDir] = useState<"left" | "right">("right");
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    // Small delay so the dashboard has time to settle before showing overlay
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, []);

  const close = useCallback(
    (goToRoute?: string) => {
      setExiting(true);
      markTutorialDone();
      setTimeout(() => {
        onDone?.();
        if (goToRoute) navigate(goToRoute);
      }, 350);
    },
    [navigate, onDone]
  );

  const goTo = useCallback((dir: "prev" | "next") => {
    setSlideDir(dir === "next" ? "right" : "left");
    setAnimKey((k) => k + 1);
    setStep((s) =>
      dir === "next"
        ? Math.min(s + 1, STEPS.length - 1)
        : Math.max(s - 1, 0)
    );
  }, []);

  const currentStep = STEPS[step];
  const Icon = currentStep.icon;
  const isLast = step === STEPS.length - 1;

  if (!visible) return null;

  return (
    /* ── Backdrop ───────────────────────────────────────────────────────────── */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        background: "rgba(10, 15, 30, 0.72)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        animation: exiting
          ? "tutFadeOut 0.35s ease forwards"
          : "tutFadeIn 0.4s ease",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <style>{`
        @keyframes tutFadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tutFadeOut { from { opacity: 1; } to { opacity: 0; } }

        @keyframes tutSlideInRight {
          from { opacity: 0; transform: translateX(48px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0)    scale(1); }
        }
        @keyframes tutSlideInLeft {
          from { opacity: 0; transform: translateX(-48px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0)     scale(1); }
        }
        @keyframes tutCardIn {
          from { opacity: 0; transform: translateY(28px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes tutIconPop {
          0%   { transform: scale(0.6) rotate(-12deg); opacity: 0; }
          70%  { transform: scale(1.12) rotate(4deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes tutGlow {
          0%, 100% { box-shadow: 0 0 0 0 var(--tut-glow, rgba(139,92,246,0.4)); }
          50%       { box-shadow: 0 0 0 16px rgba(0,0,0,0); }
        }
        @keyframes tutShimmer {
          from { transform: translateX(-100%); }
          to   { transform: translateX(200%); }
        }
        .tut-shimmer::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%);
          animation: tutShimmer 2.4s ease-in-out infinite;
          pointer-events: none;
        }
      `}</style>

      {/* ── Card ──────────────────────────────────────────────────────────────── */}
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl"
        style={{
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(245,248,255,0.98) 100%)",
          border: "1px solid rgba(200,215,255,0.6)",
          boxShadow:
            "0 32px 80px rgba(30,40,80,0.28), 0 0 0 1px rgba(180,200,255,0.15) inset",
          animation: "tutCardIn 0.45s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {/* ── Dark mode override ──────────────────────────────────────────── */}
        <style>{`
          .dark #tut-card-inner {
            background: linear-gradient(145deg, rgba(22,28,50,0.97) 0%, rgba(18,24,44,0.99) 100%) !important;
            border-color: rgba(60,80,140,0.4) !important;
          }
          .dark #tut-tip-box {
            background: rgba(255,255,255,0.04) !important;
            border-color: rgba(255,255,255,0.08) !important;
            color: rgba(200,210,255,0.7) !important;
          }
          .dark #tut-card-title { color: rgba(230,235,255,0.95) !important; }
          .dark #tut-card-desc  { color: rgba(180,190,220,0.85) !important; }
          .dark #tut-step-label { color: rgba(160,170,200,0.7) !important; }
          .dark #tut-skip-btn   { color: rgba(160,170,200,0.6) !important; }
          .dark #tut-skip-btn:hover { color: rgba(200,210,240,0.9) !important; }
          .dark #tut-prev-btn {
            background: rgba(255,255,255,0.06) !important;
            border-color: rgba(255,255,255,0.1) !important;
            color: rgba(200,210,240,0.8) !important;
          }
        `}</style>

        <div id="tut-card-inner">
          {/* ── Top decorative gradient bar ─────────────────────────────── */}
          <div
            className="tut-shimmer relative h-1 w-full overflow-hidden"
            style={{
              background: `linear-gradient(90deg, ${currentStep.accent}99, ${currentStep.accent}, ${currentStep.accent}99)`,
              transition: "background 0.5s ease",
            }}
          />

          {/* ── Close button ────────────────────────────────────────────── */}
          <button
            onClick={() => close()}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
            style={{
              background: "rgba(120,130,160,0.12)",
              border: "1px solid rgba(120,130,160,0.18)",
            }}
            title="Skip tutorial"
          >
            <X className="w-3.5 h-3.5" style={{ color: "rgba(120,130,160,0.8)" }} />
          </button>

          {/* ── Body ────────────────────────────────────────────────────── */}
          <div className="px-8 pt-10 pb-8">
            {/* Icon — show logo image on steps that have one, otherwise gradient icon */}
            <div className="flex justify-center mb-6">
              {(currentStep as any).logoSrc ? (
                <div
                  key={`icon-${animKey}`}
                  style={{
                    animation: "tutIconPop 0.55s cubic-bezier(0.34,1.56,0.64,1)",
                    width: "88px",
                    height: "88px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src={(currentStep as any).logoSrc}
                    alt="Acrozo Guide"
                    style={{
                      width: "88px",
                      height: "88px",
                      objectFit: "contain",
                      filter: `drop-shadow(0 10px 24px ${currentStep.iconGlow})`,
                    }}
                  />
                </div>
              ) : (
                <div
                  key={`icon-${animKey}`}
                  style={{
                    background: `linear-gradient(135deg, ${
                      currentStep.iconBg.includes("blue")    ? "#3b82f6, #06b6d4" :
                      currentStep.iconBg.includes("emerald") ? "#10b981, #14b8a6" :
                      currentStep.iconBg.includes("amber")   ? "#f59e0b, #f97316" :
                      currentStep.iconBg.includes("rose")    ? "#f43f5e, #ec4899" :
                      currentStep.iconBg.includes("yellow")  ? "#fbbf24, #f59e0b" :
                      "#6366f1, #8b5cf6"
                    })`,
                    boxShadow: `0 12px 32px ${currentStep.iconGlow}, 0 0 0 8px ${currentStep.iconGlow.replace("0.35", "0.08")}`,
                    animation: "tutIconPop 0.55s cubic-bezier(0.34,1.56,0.64,1)",
                    borderRadius: "20px",
                    width: "80px",
                    height: "80px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon className="w-9 h-9 text-white" strokeWidth={1.8} />
                </div>
              )}
            </div>

            {/* Step content — animated per direction */}
            <div
              key={animKey}
              style={{
                animation: `${
                  slideDir === "right" ? "tutSlideInRight" : "tutSlideInLeft"
                } 0.35s cubic-bezier(0.25,0.46,0.45,0.94)`,
              }}
            >
              {/* Tag */}
              <div className="flex justify-center mb-3">
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.15em] px-3 py-1 rounded-full"
                  style={{
                    background: `${currentStep.accent}18`,
                    color: currentStep.accent,
                    border: `1px solid ${currentStep.accent}30`,
                  }}
                >
                  {currentStep.tag}
                </span>
              </div>

              {/* Title */}
              <h2
                id="tut-card-title"
                className="text-center text-xl font-bold mb-3 leading-tight"
                style={{ color: "#0f172a" }}
              >
                {currentStep.title}
              </h2>

              {/* Description */}
              <p
                id="tut-card-desc"
                className="text-center text-sm leading-relaxed mb-5"
                style={{ color: "#475569" }}
              >
                {currentStep.description}
              </p>

              {/* Tip box */}
              <div
                id="tut-tip-box"
                className="flex items-start gap-2.5 rounded-xl px-4 py-3 mb-7"
                style={{
                  background: "rgba(0,0,0,0.03)",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <CheckCircle
                  className="w-4 h-4 mt-0.5 shrink-0"
                  style={{ color: currentStep.accent }}
                />
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "#64748b" }}
                >
                  {currentStep.tip}
                </p>
              </div>
            </div>

            {/* ── Navigation ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3">
              {/* Prev */}
              <button
                id="tut-prev-btn"
                onClick={() => goTo("prev")}
                disabled={step === 0}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: "rgba(0,0,0,0.05)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  color: "#475569",
                }}
                title="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Dots */}
              <ProgressDots
                total={STEPS.length}
                current={step}
                accent={currentStep.accent}
              />

              {/* Next / Finish */}
              <button
                onClick={() => {
                  if (isLast) {
                    close(currentStep.route);
                  } else {
                    goTo("next");
                  }
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105 hover:brightness-110 active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${currentStep.accent}, ${currentStep.accent}cc)`,
                  boxShadow: `0 6px 20px ${currentStep.iconGlow}`,
                  transition: "background 0.4s ease, box-shadow 0.4s ease",
                }}
              >
                {isLast ? (
                  <>
                    <Star className="w-3.5 h-3.5" />
                    Let's go!
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

            {/* Step counter + skip */}
            <div className="flex items-center justify-between mt-5">
              <span
                id="tut-step-label"
                className="text-[11px] font-medium"
                style={{ color: "rgba(100,116,139,0.7)" }}
              >
                Step {step + 1} of {STEPS.length}
              </span>
              {!isLast && (
                <button
                  id="tut-skip-btn"
                  onClick={() => close()}
                  className="text-[11px] font-medium transition-colors hover:underline"
                  style={{ color: "rgba(100,116,139,0.6)" }}
                >
                  Skip tutorial
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
