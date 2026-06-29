import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useGetPublicPlans } from "@/lib/api-client";
import type { Plan } from "@/lib/api-client";
import { usePlanColors } from "@/contexts/plan-colors-context";
import { isLoggedIn, getApiUrl } from "@/lib/api";
import { useAuthModal } from "@/contexts/AuthModalContext";
import {
  Check,
  Star,
  ChevronDown,
  ArrowRight,
  Shield,
  FileSpreadsheet,
  FileText,
  Lock,
  Zap,
  Activity,
  Smile,
  Calculator
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(price: number) {
  return price === 0 ? "Free" : `₹${price.toLocaleString("en-IN")}`;
}

// ── Section Title Component ────────────────────────────────────────────────

function SectionTitle({
  title,
  paragraph,
  width = "570px",
  center,
  mb = "100px",
}: {
  title: string;
  paragraph: string;
  width?: string;
  center?: boolean;
  mb?: string;
}) {
  return (
    <div
      className={`w-full ${center ? "mx-auto text-center" : ""}`}
      style={{ maxWidth: width, marginBottom: mb }}
    >
      <h2 className="mb-4 text-3xl font-bold !leading-tight text-black dark:text-white sm:text-4xl md:text-[45px]">
        {title}
      </h2>
      <p className="text-base !leading-relaxed text-body-color dark:text-body-color-dark md:text-lg">
        {paragraph}
      </p>
    </div>
  );
}

// ── Hero Section ───────────────────────────────────────────────────────────

function HeroSection() {
  const [, navigate] = useLocation();
  const loggedIn = isLoggedIn();
  const { openLogin, openSignup } = useAuthModal();

  return (
    <section
      id="home"
      className="relative z-10 overflow-hidden bg-white pb-16 pt-[120px] dark:bg-gray-dark md:pb-[120px] md:pt-[150px] xl:pb-[160px] xl:pt-[180px] 2xl:pb-[200px] 2xl:pt-[210px] transition-colors duration-300"
    >
      <div className="container mx-auto px-4 lg:px-8">
        <div className="-mx-4 flex flex-wrap">
          <div className="w-full px-4">
            <div className="mx-auto max-w-[800px] text-center">

              <div className="inline-flex items-center gap-2 bg-primary-blue/10 dark:bg-primary-blue/20 text-primary-blue text-xs font-semibold px-3 py-1.5 rounded-full mb-6 select-none animate-pulse">
                <Star className="w-3.5 h-3.5 fill-current" />
                Accounting Tools Made Simple
              </div>

              <h1 className="mb-5 text-3xl font-bold leading-tight text-black dark:text-white sm:text-4xl sm:leading-tight md:text-5xl md:leading-tight">
                Convert PDFs, <span className="text-primary-blue">Generate ERP XML</span> &amp; More
              </h1>

              <p className="mb-12 text-base !leading-relaxed text-body-color dark:text-body-color-dark sm:text-lg md:text-xl">
                Powerful tools for accounting professionals. Convert PDFs to clean Excel spreadsheets, generate ERP-compatible XML voucher sheets (Tally Prime, Marg, Busy), and streamline your bookkeeping workflows instantly.
              </p>

              <div className="flex flex-col items-center justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
                {loggedIn ? (
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="inline-flex items-center gap-2 rounded-md bg-primary-blue px-8 py-4 text-base font-semibold text-white hover:bg-primary-blue/90 shadow-btn transition-colors"
                  >
                    Open Dashboard <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={openSignup}
                      className="inline-flex items-center gap-2 rounded-md bg-primary-blue px-8 py-4 text-base font-semibold text-white hover:bg-primary-blue/90 shadow-btn transition-colors"
                    >
                      Create Free Account <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={openLogin}
                      className="inline-flex items-center gap-2 rounded-md bg-black/10 dark:bg-white/10 px-8 py-4 text-base font-semibold text-black dark:text-white hover:bg-black/25 dark:hover:bg-white/5 transition-colors"
                    >
                      Login to Your Account
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Vector Graphics */}
      <div className="absolute right-0 top-0 z-[-1] opacity-30 lg:opacity-100 pointer-events-none select-none">
        <svg
          width="450"
          height="556"
          viewBox="0 0 450 556"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="277" cy="63" r="225" fill="url(#paint0_linear_25:217)" />
          <circle cx="17.9997" cy="182" r="18" fill="url(#paint1_radial_25:217)" />
          <circle cx="76.9997" cy="288" r="34" fill="url(#paint2_radial_25:217)" />
          <circle
            cx="325.486"
            cy="302.87"
            r="180"
            transform="rotate(-37.6852 325.486 302.87)"
            fill="url(#paint3_linear_25:217)"
          />
          <circle
            opacity="0.8"
            cx="184.521"
            cy="315.521"
            r="132.862"
            transform="rotate(114.874 184.521 315.521)"
            stroke="url(#paint4_linear_25:217)"
          />
          <circle
            opacity="0.8"
            cx="356"
            cy="290"
            r="179.5"
            transform="rotate(-30 356 290)"
            stroke="url(#paint5_linear_25:217)"
          />
          <circle
            opacity="0.8"
            cx="191.659"
            cy="302.659"
            r="133.362"
            transform="rotate(133.319 191.659 302.659)"
            fill="url(#paint6_linear_25:217)"
          />
          <defs>
            <linearGradient
              id="paint0_linear_25:217"
              x1="-54.5003"
              y1="-178"
              x2="222"
              y2="288"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#6b8cc4" />
              <stop offset="1" stopColor="#6b8cc4" stopOpacity="0" />
            </linearGradient>
            <radialGradient
              id="paint1_radial_25:217"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(17.9997 182) rotate(90) scale(18)"
            >
              <stop offset="0.145833" stopColor="#6b8cc4" stopOpacity="0" />
              <stop offset="1" stopColor="#6b8cc4" stopOpacity="0.08" />
            </radialGradient>
            <radialGradient
              id="paint2_radial_25:217"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(76.9997 288) rotate(90) scale(34)"
            >
              <stop offset="0.145833" stopColor="#6b8cc4" stopOpacity="0" />
              <stop offset="1" stopColor="#6b8cc4" stopOpacity="0.08" />
            </radialGradient>
            <linearGradient
              id="paint3_linear_25:217"
              x1="226.775"
              y1="-66.1548"
              x2="292.157"
              y2="351.421"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#6b8cc4" />
              <stop offset="1" stopColor="#6b8cc4" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint4_linear_25:217"
              x1="184.521"
              y1="182.159"
              x2="184.521"
              y2="448.882"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#6b8cc4" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint5_linear_25:217"
              x1="356"
              y1="110"
              x2="356"
              y2="470"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#6b8cc4" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint6_linear_25:217"
              x1="118.524"
              y1="29.2497"
              x2="166.965"
              y2="338.63"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#6b8cc4" />
              <stop offset="1" stopColor="#6b8cc4" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="absolute bottom-0 left-0 z-[-1] opacity-30 lg:opacity-100 pointer-events-none select-none">
        <svg
          width="364"
          height="201"
          viewBox="0 0 364 201"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5.88928 72.3303C33.6599 66.4798 101.397 64.9086 150.178 105.427C211.155 156.076 229.59 162.093 264.333 166.607C299.076 171.12 337.718 183.657 362.889 212.24"
            stroke="url(#paint0_linear_25:218)"
          />
          <path
            d="M-22.1107 72.3303C5.65989 66.4798 73.3965 64.9086 122.178 105.427C183.155 156.076 201.59 162.093 236.333 166.607C271.076 171.12 309.718 183.657 334.889 212.24"
            stroke="url(#paint1_linear_25:218)"
          />
          <path
            d="M-53.1107 72.3303C-25.3401 66.4798 42.3965 64.9086 91.1783 105.427C152.155 156.076 170.59 162.093 205.333 166.607C240.076 171.12 278.718 183.657 303.889 212.24"
            stroke="url(#paint2_linear_25:218)"
          />
          <path
            d="M-98.1618 65.0889C-68.1416 60.0601 4.73364 60.4882 56.0734 102.431C120.248 154.86 139.905 161.419 177.137 166.956C214.37 172.493 255.575 186.165 281.856 215.481"
            stroke="url(#paint3_linear_25:218)"
          />
          <circle
            opacity="0.8"
            cx="214.505"
            cy="60.5054"
            r="49.7205"
            transform="rotate(-13.421 214.505 60.5054)"
            stroke="url(#paint4_linear_25:218)"
          />
          <circle cx="220" cy="63" r="43" fill="url(#paint5_radial_25:218)" />
          <defs>
            <linearGradient
              id="paint0_linear_25:218"
              x1="184.389"
              y1="69.2405"
              x2="184.389"
              y2="212.24"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#6b8cc4" stopOpacity="0" />
              <stop offset="1" stopColor="#6b8cc4" />
            </linearGradient>
            <linearGradient
              id="paint1_linear_25:218"
              x1="156.389"
              y1="69.2405"
              x2="156.389"
              y2="212.24"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#6b8cc4" stopOpacity="0" />
              <stop offset="1" stopColor="#6b8cc4" />
            </linearGradient>
            <linearGradient
              id="paint2_linear_25:218"
              x1="125.389"
              y1="69.2405"
              x2="125.389"
              y2="212.24"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#6b8cc4" stopOpacity="0" />
              <stop offset="1" stopColor="#6b8cc4" />
            </linearGradient>
            <linearGradient
              id="paint3_linear_25:218"
              x1="93.8507"
              y1="67.2674"
              x2="89.9278"
              y2="210.214"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#6b8cc4" stopOpacity="0" />
              <stop offset="1" stopColor="#6b8cc4" />
            </linearGradient>
            <linearGradient
              id="paint4_linear_25:218"
              x1="214.505"
              y1="10.2849"
              x2="212.684"
              y2="99.5816"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#6b8cc4" />
              <stop offset="1" stopColor="#6b8cc4" stopOpacity="0" />
            </linearGradient>
            <radialGradient
              id="paint5_radial_25:218"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(220 63) rotate(90) scale(43)"
            >
              <stop offset="0.145833" stopColor="white" stopOpacity="0" />
              <stop offset="1" stopColor="white" stopOpacity="0.08" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      {/* Trust indicators */}
      <div className="container mx-auto px-4 lg:px-8 mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-body-color dark:text-body-color-dark">
        <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-primary-blue" /> No credit card required</span>
        <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-primary-blue" /> Free plan available</span>
        <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-primary-blue" /> Easy to use tools</span>
        <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-primary-blue" /> Secure &amp; reliable</span>
      </div>
    </section>
  );
}

// ── Brands Section ─────────────────────────────────────────────────────────

// Inline SVG logos — no external requests, always renders correctly
const GSTLogo = () => (
  <svg viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg" className="h-8 w-auto">
    <rect width="120" height="40" rx="4" fill="#1a6b3c" />
    <text x="8" y="26" fontFamily="Arial,sans-serif" fontSize="18" fontWeight="bold" fill="#ffffff">GST</text>
    <rect x="52" y="8" width="2" height="24" fill="#f5a623" />
    <text x="58" y="18" fontFamily="Arial,sans-serif" fontSize="8" fontWeight="600" fill="#f5a623">GOODS AND</text>
    <text x="58" y="27" fontFamily="Arial,sans-serif" fontSize="8" fontWeight="600" fill="#f5a623">SERVICES TAX</text>
  </svg>
);

const IncomeTaxLogo = () => (
  <svg viewBox="0 0 130 40" xmlns="http://www.w3.org/2000/svg" className="h-8 w-auto">
    <rect width="130" height="40" rx="4" fill="#1a3a6b" />
    {/* Ashoka Chakra simplified */}
    <circle cx="20" cy="20" r="11" fill="none" stroke="#f5a623" strokeWidth="2" />
    <circle cx="20" cy="20" r="3" fill="#f5a623" />
    {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => (
      <line key={i}
        x1="20" y1="20"
        x2={20 + 9 * Math.cos((deg * Math.PI) / 180)}
        y2={20 + 9 * Math.sin((deg * Math.PI) / 180)}
        stroke="#f5a623" strokeWidth="1" />
    ))}
    <text x="36" y="17" fontFamily="Arial,sans-serif" fontSize="8" fontWeight="700" fill="#ffffff">INCOME TAX</text>
    <text x="36" y="28" fontFamily="Arial,sans-serif" fontSize="7" fill="#f5a623">GOVERNMENT OF INDIA</text>
  </svg>
);

const TallyLogo = () => (
  <svg viewBox="0 0 110 40" xmlns="http://www.w3.org/2000/svg" className="h-8 w-auto">
    <rect width="110" height="40" rx="4" fill="#ffffff" stroke="#e0e0e0" strokeWidth="1" />
    {/* Tally red T mark */}
    <rect x="8" y="8" width="18" height="6" rx="1" fill="#e63b2e" />
    <rect x="14" y="14" width="6" height="18" rx="1" fill="#e63b2e" />
    <text x="34" y="26" fontFamily="Arial,sans-serif" fontSize="16" fontWeight="bold" fill="#333333">tally</text>
    <text x="34" y="35" fontFamily="Arial,sans-serif" fontSize="7" fill="#e63b2e" fontWeight="600">PRIME</text>
  </svg>
);

const MCALogo = () => (
  <svg viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg" className="h-8 w-auto">
    <rect width="120" height="40" rx="4" fill="#1a4b8c" />
    <circle cx="20" cy="20" r="11" fill="none" stroke="#f5a623" strokeWidth="1.5" />
    <circle cx="20" cy="20" r="3" fill="#f5a623" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
      <line key={i}
        x1="20" y1="20"
        x2={20 + 9 * Math.cos((deg * Math.PI) / 180)}
        y2={20 + 9 * Math.sin((deg * Math.PI) / 180)}
        stroke="#f5a623" strokeWidth="1" />
    ))}
    <text x="36" y="18" fontFamily="Arial,sans-serif" fontSize="13" fontWeight="bold" fill="#ffffff">MCA</text>
    <text x="36" y="30" fontFamily="Arial,sans-serif" fontSize="6.5" fill="#f5a623">MINISTRY OF CORP. AFFAIRS</text>
  </svg>
);

const TRACESLogo = () => (
  <svg viewBox="0 0 130 40" xmlns="http://www.w3.org/2000/svg" className="h-8 w-auto">
    <rect width="130" height="40" rx="4" fill="#004080" />
    <circle cx="20" cy="20" r="11" fill="none" stroke="#f5a623" strokeWidth="1.5" />
    <circle cx="20" cy="20" r="3" fill="#f5a623" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
      <line key={i}
        x1="20" y1="20"
        x2={20 + 9 * Math.cos((deg * Math.PI) / 180)}
        y2={20 + 9 * Math.sin((deg * Math.PI) / 180)}
        stroke="#f5a623" strokeWidth="1" />
    ))}
    <text x="36" y="19" fontFamily="Arial,sans-serif" fontSize="13" fontWeight="bold" fill="#ffffff">TRACES</text>
    <text x="36" y="31" fontFamily="Arial,sans-serif" fontSize="6" fill="#f5a623">TDS RECONCILIATION SYSTEM</text>
  </svg>
);

const brands = [
  { name: "GST Portal", href: "https://www.gst.gov.in", Logo: GSTLogo },
  { name: "Income Tax India", href: "https://www.incometax.gov.in", Logo: IncomeTaxLogo },
  { name: "TallyPrime", href: "https://tallysolutions.com", Logo: TallyLogo },
  { name: "MCA Gov", href: "https://www.mca.gov.in", Logo: MCALogo },
  { name: "TRACES", href: "https://www.tdscpc.gov.in", Logo: TRACESLogo },
];

function BrandsSection() {
  return (
    <section className="pt-10 pb-10 bg-gray-light/30 dark:bg-bg-color-dark/30 transition-colors duration-300">
      <div className="container mx-auto px-4 lg:px-8">
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mb-4 uppercase tracking-widest font-medium">
          Trusted government &amp; accounting portals
        </p>
        <div className="-mx-4 flex flex-wrap">
          <div className="w-full px-4">
            <div className="flex flex-wrap items-center justify-center rounded-sm bg-gray-light/80 px-8 py-8 dark:bg-gray-dark/80 sm:px-10 md:px-[50px] md:py-[40px] xl:p-[50px] 2xl:px-[70px] 2xl:py-[60px] gap-8">
              {brands.map(({ name, href, Logo }) => (
                <div
                  key={name}
                  className="mx-3 flex w-full max-w-[140px] items-center justify-center py-[15px] sm:mx-4 lg:max-w-[120px] xl:mx-6 xl:max-w-[130px] 2xl:mx-8 2xl:max-w-[140px]"
                >
                  <a
                    href={href}
                    target="_blank"
                    rel="nofollow noreferrer"
                    className="relative flex flex-col items-center gap-1.5 w-full opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300"
                    title={name}
                  >
                    <Logo />
                    <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 text-center leading-tight">
                      {name}
                    </span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Features Section ───────────────────────────────────────────────────────

interface FeatureItem {
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: string;
  badgeColor?: string;
  route?: string;
  cta?: string;
}

function FeaturesSection() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<"main" | "free">("free");

  const featureItems: FeatureItem[] = [
    {
      icon: <FileSpreadsheet className="w-8 h-8" />,
      title: "PDF to Excel (Acrozo Engine)",
      desc: "Convert complex PDFs to structured Excel using our Acrozo conversion engine (tables, invoices, statements).",
      badge: "Paid",
      badgeColor: "bg-blue-100 text-blue-700",
      route: "/tools/pdf-to-excel",
      cta: "Convert to Excel",
    },
    {
      icon: <FileText className="w-8 h-8" />,
      title: "PDF to Word (Acrozo Engine)",
      desc: "Convert PDFs to editable Word documents preserving layout and tables using the Acrozo engine.",
      badge: "Paid",
      badgeColor: "bg-blue-100 text-blue-700",
      route: "/tools/pdf-to-word",
      cta: "Convert to Word",
    },
    {
      icon: <FileText className="w-8 h-8" />,
      title: "Acrozo PDF Extractor",
      desc: "Drag-and-drop accounting PDF files (bank statements, invoices, reports) and get clean, formatted Excel sheets in seconds.",
      badge: "Paid",
      badgeColor: "bg-blue-100 text-blue-700",
      route: "/pdf-converter",
      cta: "Launch PDF Tool",
    },
    {
      icon: <FileSpreadsheet className="w-8 h-8" />,
      title: "Bank Statements → ERP Tools",
      desc: "Convert bank statement PDFs, Excel & CSV files to ERP-compatible vouchers (Tally, Marg, Busy) with mapping presets.",
      badge: "Automation",
      badgeColor: "bg-indigo-50 text-indigo-700 border border-indigo-200",
      route: "/bank-to-erp",
      cta: "Convert to ERP Vouchers",
    },
    {
      icon: <FileSpreadsheet className="w-8 h-8" />,
      title: "ERP XML Generator",
      desc: "Upload Excel ledger sheets and generate ERP-compliant XML files. Automates voucher creation without manual entry.",
      badge: "Paid",
      badgeColor: "bg-blue-100 text-blue-700",
      route: "/tally-generator",
      cta: "Generate XML",
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Tally TDL Addons",
      desc: "Enhance Tally operations by installing custom addons/plugins for advanced printing, invoice signing, and tracking.",
      badge: "Highly Popular",
      badgeColor: "bg-yellow/10 text-yellow dark:text-yellow/80",
      route: "/tally-tdls",
      cta: "Explore Addons",
    },
    {
      icon: <Activity className="w-8 h-8" />,
      title: "Voucher Mapping Engine",
      desc: "Dynamically maps Excel rows to corresponding ERP elements (Sales, Purchase, Journal, Payment, Receipt).",
      badge: "Voucher Sync",
      badgeColor: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    },
    {
      icon: <Lock className="w-8 h-8" />,
      title: "Data Confidentiality",
      desc: "Your data is strictly encrypted in transit using TLS protocol and pruned automatically from our servers after execution.",
      badge: "Secure",
      badgeColor: "bg-red-500/10 text-red-600 dark:text-red-400",
    },

  ];

  return (
    <section id="features" className="py-16 md:py-20 lg:py-28 bg-white dark:bg-gray-dark transition-colors duration-300">
      <div className="container mx-auto px-4 lg:px-8">
        <SectionTitle
          title="Main Features & Tools"
          paragraph="Explore our custom web utilities designed specifically to help accountants save hours of manual typing and speed up bookkeeping entries."
          center
        />

        <div className="mb-8 flex items-center justify-center gap-3">
          <button
            onClick={() => setView("free")}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${view === "free" ? "bg-primary-blue text-white" : "bg-white/60 text-black"}`}
          >
            Free Features & Tools
          </button>
          <button
            onClick={() => setView("main")}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${view === "main" ? "bg-primary-blue text-white" : "bg-white/60 text-black"}`}
          >
            Paid Features & Tools
          </button>
        </div>

        {view === "main" ? (
          <>
            <div className="mt-2 mb-4 flex justify-center text-sm text-muted-foreground">
              <div className="flex items-center gap-2 text-center">
                <Lock className="w-4 h-4 inline-block text-muted-foreground" />
                <span>
                  Login required to use these paid tools. Please
                  <button onClick={() => navigate('/login')} className="ml-2 text-primary-blue underline">login</button>
                  to access them.
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
              {featureItems
                .filter((feature) => !["Tally TDL Addons", "Data Confidentiality", "Voucher Mapping Engine"].includes(feature.title))
                .map((feature, idx) => (
                  <div key={idx} className="w-full group">
                    <div className="wow fadeInUp duration-300 rounded-lg p-6 bg-gray-light/35 dark:bg-dark border border-stroke/40 dark:border-stroke-dark/40 hover:shadow-one dark:hover:shadow-gray-dark transform transition-transform duration-300 group-hover:-translate-y-2 h-full flex flex-col">
                      <div className="mb-8 flex h-[70px] w-[70px] items-center justify-center rounded-md bg-primary-blue/10 text-primary-blue dark:bg-white/5 dark:text-white transition-transform duration-300 group-hover:scale-105 group-hover:translate-x-2">
                        {feature.icon}
                      </div>
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-xl font-bold text-black dark:text-white sm:text-2xl lg:text-xl xl:text-2xl">
                          {feature.title}
                        </h3>
                        {feature.badge && (
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${feature.badgeColor}`}>
                            {feature.badge}
                          </span>
                        )}
                      </div>
                      <p className="mb-6 text-base font-medium leading-relaxed text-body-color dark:text-body-color-dark">
                        {feature.desc}
                      </p>
                      <div className="mt-auto">
                        {feature.route && (
                          <button
                            onClick={() => navigate(feature.route!)}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-primary-blue group-hover:underline focus:outline-none"
                          >
                            {feature.cta || "Try Tool"} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "GST Calculator", desc: "Calculate CGST/SGST/IGST with presets.", route: "/tools/gst-calculator", icon: <Calculator className="w-8 h-8" /> },
              { title: "TDS Interest Calculator", desc: "Interest calculations for TDS delays.", route: "/tools/tds-interest-calculator", icon: <Calculator className="w-8 h-8" /> },
              { title: "Income Tax Calculator", desc: "Compare Old vs New tax regimes.", route: "/tools/income-tax-calculator", icon: <Calculator className="w-8 h-8" /> },
              { title: "Tally TDLs", desc: "Explore free TDL addons and installs.", route: "/tally-tdls", icon: <Zap className="w-8 h-8" /> },
            ].map((tool) => (
              <div key={tool.route} className="w-full group">
                <div className="wow fadeInUp duration-300 rounded-lg p-6 bg-gray-light/35 dark:bg-dark border border-stroke/40 dark:border-stroke-dark/40 hover:shadow-one dark:hover:shadow-gray-dark transform transition-transform duration-300 group-hover:-translate-y-2 h-full flex flex-col">
                  <div className="mb-8 flex h-[70px] w-[70px] items-center justify-center rounded-md bg-primary-blue/10 text-primary-blue dark:bg-white/5 dark:text-white transition-transform duration-300 group-hover:scale-105 group-hover:translate-x-2">
                    {tool.icon}
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-xl font-bold text-black dark:text-white sm:text-2xl lg:text-xl xl:text-2xl">
                      {tool.title}
                    </h3>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-green-100 text-green-700">Free</span>
                  </div>
                  <p className="mb-6 text-base font-medium leading-relaxed text-body-color dark:text-body-color-dark">
                    {tool.desc}
                  </p>
                  <div className="mt-auto">
                    <button
                      onClick={() => navigate(tool.route)}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary-blue group-hover:underline focus:outline-none"
                    >
                      Open <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}


      </div>
    </section>
  );
}

// ── About Sections ─────────────────────────────────────────────────────────

const checkIcon = (
  <svg width="16" height="13" viewBox="0 0 16 13" className="fill-current">
    <path d="M5.8535 12.6631C5.65824 12.8584 5.34166 12.8584 5.1464 12.6631L0.678505 8.1952C0.483242 7.99994 0.483242 7.68336 0.678505 7.4881L2.32921 5.83739C2.52467 5.64193 2.84166 5.64216 3.03684 5.83791L5.14622 7.95354C5.34147 8.14936 5.65859 8.14952 5.85403 7.95388L13.3797 0.420561C13.575 0.22513 13.8917 0.225051 14.087 0.420383L15.7381 2.07143C15.9333 2.26669 15.9333 2.58327 15.7381 2.77854L5.8535 12.6631Z" />
  </svg>
);

const BulletPoint = ({ text }: { text: string }) => (
  <p className="mb-5 flex items-center text-lg font-semibold text-black dark:text-white">
    <span className="mr-4 flex h-[30px] w-[30px] items-center justify-center rounded-md bg-primary-blue/10 text-primary-blue dark:bg-white/5 dark:text-white">
      {checkIcon}
    </span>
    {text}
  </p>
);

function AboutSectionOne() {
  return (
    <section id="about" className="pt-16 md:pt-20 lg:pt-28 bg-white dark:bg-gray-dark transition-colors duration-300">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="border-b border-stroke/40 dark:border-stroke-dark/40 pb-16 md:pb-20 lg:pb-28">
          <div className="-mx-4 flex flex-wrap items-center">
            <div className="w-full px-4 lg:w-1/2">
              <SectionTitle
                title="Automate Bank & Excel to ERP Workflows."
                paragraph="Say goodbye to typing entries one by one in ERP tools. Acrozo helps you parse and compile thousands of vouchers, bank statements (PDF, Excel, CSV), sales sheets, and journal entries in seconds."
                mb="44px"
              />

              <div className="wow fadeInUp mb-12 max-w-[570px] lg:mb-0">
                <div className="mx-[-12px] flex flex-wrap">
                  <div className="w-full px-3 sm:w-1/2 lg:w-full xl:w-1/2">
                    <BulletPoint text="Pruned & Private Processing" />
                    <BulletPoint text="Zero Data Entry Errors" />
                    <BulletPoint text="Sales & Purchase Sheets" />
                  </div>

                  <div className="w-full px-3 sm:w-1/2 lg:w-full xl:w-1/2">
                    <BulletPoint text="Bank Statement Mapping" />
                    <BulletPoint text="Instant ERP Import Export" />
                    <BulletPoint text="Tally, Marg & Busy Support" />
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full px-4 lg:w-1/2">
              <div className="wow fadeInUp relative mx-auto aspect-[25/24] max-w-[500px] lg:mr-0">
                <img
                  src="/images/about/about-image.png"
                  alt="about-image"
                  className="mx-auto max-w-full drop-shadow-three dark:hidden lg:mr-0"
                />
                <img
                  src="/images/about/about-image-dark.png"
                  alt="about-image"
                  className="mx-auto hidden max-w-full drop-shadow-three dark:block lg:mr-0"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AboutSectionTwo() {
  return (
    <section className="py-16 md:py-20 lg:py-28 bg-white dark:bg-gray-dark transition-colors duration-300">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="-mx-4 flex flex-wrap items-center">
          
          <div className="w-full px-4 lg:w-1/2">
            <div className="wow fadeInUp relative mx-auto mb-12 aspect-[25/24] max-w-[500px] text-center lg:m-0">
              <img
                src="/images/about/about-image-2.png"
                alt="about image"
                className="drop-shadow-three dark:hidden"
              />
              <img
                src="/images/about/about-image-2-dark.png"
                alt="about image"
                className="hidden drop-shadow-three dark:block"
              />
            </div>
          </div>
          
          <div className="w-full px-4 lg:w-1/2">
            <div className="wow fadeInUp max-w-[470px]">
              <div className="mb-9">
                <h3 className="mb-4 text-xl font-bold text-black dark:text-white sm:text-2xl lg:text-xl xl:text-2xl">
                  Precise XML Compiling
                </h3>
                <p className="text-base font-medium leading-relaxed text-body-color dark:text-body-color-dark sm:text-lg sm:leading-relaxed">
                  Our validation engine maps debit and credit rows to confirm balanced vouchers before exporting XMLs, preventing importing errors inside your ERP tools.
                </p>
              </div>
              
              <div className="mb-9">
                <h3 className="mb-4 text-xl font-bold text-black dark:text-white sm:text-2xl lg:text-xl xl:text-2xl">
                  Easy Accessibility
                </h3>
                <p className="text-base font-medium leading-relaxed text-body-color dark:text-body-color-dark sm:text-lg sm:leading-relaxed">
                  No software download or setup required. Drop files directly in the browser subagent dashboard interface and get your XML files instantaneously.
                </p>
              </div>
              
              <div className="mb-1">
                <h3 className="mb-4 text-xl font-bold text-black dark:text-white sm:text-2xl lg:text-xl xl:text-2xl">
                  Dedicated Customer Support
                </h3>
                <p className="text-base font-medium leading-relaxed text-body-color dark:text-body-color-dark sm:text-lg sm:leading-relaxed">
                  Need custom ERP addon integration or template mapping? Drop us feedback and we'll build solutions tailored for your business.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

// ── Testimonials Section ───────────────────────────────────────────────────

function TestimonialsSection() {
  const testimonials = [
    {
      name: "Rohit Agarwal",
      designation: "Small Business Owner, Jaipur",
      content: "I was spending hours every week typing data into Tally manually. Found this tool and honestly it's been a game changer. My whole month's work now takes under an hour.",
      image: "/images/testimonials/rohit.png",
      star: 5,
    },
    {
      name: "Meera Krishnan",
      designation: "Freelance Accountant, Chennai",
      content: "I handle books for 6 small clients and this makes everything so much faster. The output files work perfectly every time. Super easy to use even for someone non-technical like me.",
      image: "/images/testimonials/meera.png",
      star: 5,
    },
    {
      name: "Arjun Patil",
      designation: "Self-Employed, Pune",
      content: "I used to avoid Tally entries because they were so tedious. Now I just upload my Excel and it's done. Saved me from hiring an extra person just for data entry.",
      image: "/images/testimonials/arjun.png",
      star: 5,
    },
  ];



  const starIcon = (
    <svg width="18" height="16" viewBox="0 0 18 16" className="fill-current">
      <path d="M9.09815 0.361679L11.1054 6.06601H17.601L12.3459 9.59149L14.3532 15.2958L9.09815 11.7703L3.84309 15.2958L5.85035 9.59149L0.595291 6.06601H7.0909L9.09815 0.361679Z" />
    </svg>
  );

  return (
    <section className="relative z-10 bg-gray-light/30 dark:bg-bg-color-dark/30 py-16 md:py-20 lg:py-28 transition-colors duration-300">
      <div className="container mx-auto px-4 lg:px-8">
        <SectionTitle
          title="What Our Users Say"
          paragraph="Hear from accounting experts, tax consultant advocates, and bookkeepers who rely on Acrozo to streamline bookkeeping inputs."
          center
        />

        <div className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, idx) => (
            <div key={idx} className="w-full">
              <div className="wow fadeInUp shadow-two dark:shadow-three dark:hover:shadow-gray-dark rounded-sm bg-white dark:bg-dark p-8 duration-300 hover:shadow-one hover:-translate-y-0.5 transition-all">

                {/* Rating stars */}
                <div className="mb-5 flex items-center space-x-1">
                  {[...Array(t.star)].map((_, i) => (
                    <span key={i} className="text-yellow">
                      {starIcon}
                    </span>
                  ))}
                </div>

                <p className="mb-8 border-b border-body-color/10 dark:border-white/10 pb-8 text-base leading-relaxed text-body-color dark:text-body-color-dark">
                  “{t.content}”
                </p>

                {/* Profile card */}
                <div className="flex items-center">
                  <div className="relative mr-4 h-[50px] w-[50px] overflow-hidden rounded-full border border-stroke/40 dark:border-stroke-dark/40 bg-gray-light">
                    <img src={t.image} alt={t.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="w-full">
                    <h3 className="mb-1 text-base font-bold text-black dark:text-white">
                      {t.name}
                    </h3>
                    <p className="text-xs text-body-color dark:text-body-color-dark">{t.designation}</p>
                  </div>
                </div>

              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Decorative Testimonials Background Graphics */}
      <div className="absolute right-0 top-5 z-[-1] pointer-events-none select-none">
        <svg
          width="238"
          height="531"
          viewBox="0 0 238 531"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            opacity="0.3"
            x="422.819"
            y="-70.8145"
            width="196"
            height="541.607"
            rx="2"
            transform="rotate(51.2997 422.819 -70.8145)"
            fill="url(#paint0_linear_83:2)"
          />
          <rect
            opacity="0.3"
            x="426.568"
            y="144.886"
            width="59.7544"
            height="541.607"
            rx="2"
            transform="rotate(51.2997 426.568 144.886)"
            fill="url(#paint1_linear_83:2)"
          />
          <defs>
            <linearGradient
              id="paint0_linear_83:2"
              x1="517.152"
              y1="-251.373"
              x2="517.152"
              y2="459.865"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#6b8cc4" />
              <stop offset="1" stopColor="#6b8cc4" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="paint1_linear_83:2"
              x1="455.327"
              y1="-35.673"
              x2="455.327"
              y2="675.565"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#6b8cc4" />
              <stop offset="1" stopColor="#6b8cc4" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </section>
  );
}

// ── Pricing Section ────────────────────────────────────────────────────────

function PricingSection() {
  const [, navigate] = useLocation();
  const { getPlanColor } = usePlanColors();
  const { data: plans, isLoading } = useGetPublicPlans();
  const loggedIn = isLoggedIn();

  return (
    <section id="pricing" className="py-16 md:py-20 lg:py-28 bg-white dark:bg-gray-dark transition-colors duration-300">
      <div className="container mx-auto px-4 lg:px-8">
        <SectionTitle
          title="Simple, Transparent Pricing"
          paragraph="Start free with 100 registration credits. Upgrade when you need more credits or advanced features."
          center
        />

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : plans && plans.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 justify-center max-w-6xl mx-auto">
            {plans.filter(plan => plan.name.toLowerCase() !== "free" && plan.name.toLowerCase() !== "unlimited" && plan.price > 0).map((plan: Plan, idx: number) => {
              const isFeatured = idx === 1 || (plans.length === 1);
              const color = getPlanColor(plan.name);

              return (
                <div
                  key={plan.id}
                  className={`rounded-md p-8 border flex flex-col transition-all duration-300 relative ${isFeatured
                      ? "border-primary-blue bg-white dark:bg-dark shadow-signUp scale-105 z-10"
                      : "border-stroke dark:border-stroke-dark bg-white dark:bg-dark"
                    }`}
                >
                  {isFeatured && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary-blue text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                      Recommended
                    </div>
                  )}

                  <div className="mb-6 flex justify-between items-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${color.bgColor} ${color.textColor}`}>
                      {plan.name}
                    </span>
                  </div>

                  <div className="mb-2 flex items-baseline">
                    <span className="text-4xl font-extrabold text-black dark:text-white">
                      {formatPrice(plan.price)}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-body-color dark:text-body-color-dark text-sm ml-1">/mo</span>
                    )}
                  </div>

                  <p className="text-xs font-semibold text-body-color dark:text-body-color-dark mb-6">
                    {plan.credits.toLocaleString()} credits · {plan.duration_days} days validity
                  </p>

                  <div className="h-px w-full bg-stroke dark:bg-stroke-dark mb-6" />

                  {/* Plan Features */}
                  <ul className="space-y-4 mb-8 flex-1">
                    {(plan.features || []).map((feature: string, i: number) => (
                      <li key={i} className="flex items-start gap-3 text-sm font-semibold text-body-color dark:text-body-color-dark">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-blue/10 text-primary-blue dark:bg-white/5 dark:text-white mt-0.5">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => loggedIn ? navigate("/pricing") : navigate("/signup")}
                    className={`w-full py-3.5 rounded-md text-sm font-bold uppercase tracking-wider transition-colors ${isFeatured
                        ? "bg-primary-blue text-white hover:bg-primary-blue/90 shadow-btn"
                        : "border border-stroke dark:border-stroke-dark text-black dark:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                      }`}
                  >
                    {plan.price === 0 ? "Get Started Free" : loggedIn ? "Upgrade Now" : "Sign Up & Upgrade"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 text-body-color dark:text-body-color-dark">
            <p>No plans available at the moment. Please check back later.</p>
          </div>
        )}
      </div>
    </section>
  );
}

// ── FAQ Section ────────────────────────────────────────────────────────────

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  const faqs = [
    {
      q: "Is the PDF extractor really free?",
      a: "Yes — the PDF Extractor is completely free and doesn't even require a login.",
    },
    {
      q: "What are the ERP XML Generators?",
      a: "They convert your Excel, PDF, and CSV voucher data (like bank statements, journal entries, and payment records) into ERP-compatible import files. Simply upload your statement or sheet with transaction details, and we'll generate the compliant files that you can import directly into Tally Prime, Marg, Busy, or other ERP tools for seamless bookkeeping.",
    },
    {
      q: "Do I need to create an account?",
      a: "No account is needed for our free converter tools. For premium automation tools like the bank statement mapping and ERP XML generators, you can sign up for a free account with complimentary credits to get started.",
    },
    {
      q: "How do I get more credits?",
      a: "You can upgrade to a paid plan from the Pricing page to get more credits for using premium tools.",
    },
    {
      q: "Is my data secure?",
      a: "Yes. We use secure TLS encryption and your files are processed safely. We don't store your documents longer than necessary.",
    },
  ];

  return (
    <section id="faq" className="py-16 md:py-20 lg:py-28 bg-gray-light/10 dark:bg-bg-color-dark/10 transition-colors duration-300 relative z-10">
      <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
        <SectionTitle
          title="Frequently Asked Questions"
          paragraph="Have questions about formats, credits, security, or integrations? Check our quick answers below."
          center
        />

        <div className="space-y-4 max-w-3xl mx-auto">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-dark rounded-md border border-stroke/40 dark:border-stroke-dark/40 overflow-hidden transition-colors"
            >
              <button
                className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 font-bold text-black dark:text-white hover:text-primary-blue transition-colors focus:outline-none"
                onClick={() => setOpen(open === idx ? null : idx)}
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-5 h-5 flex-shrink-0 transition-transform ${open === idx ? "rotate-180 text-primary-blue" : "text-body-color"
                    }`}
                />
              </button>
              {open === idx && (
                <div className="px-6 pb-5 text-base text-body-color dark:text-body-color-dark leading-relaxed border-t border-stroke/20 dark:border-stroke-dark/20 pt-4">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Contact / CTA Section ──────────────────────────────────────────────────

function ContactCTASection() {
  const [, navigate] = useLocation();
  const loggedIn = isLoggedIn();
  const { openLogin, openSignup } = useAuthModal();
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", message: "" });

  // Fetch user data if logged in
  useEffect(() => {
    if (loggedIn) {
      fetch(`${getApiUrl()}/api/profile`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || sessionStorage.getItem("token")}`,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          setFormData({
            name: data.full_name || data.username || "",
            email: data.email || "",
            phone: data.phone || "",
            message: "",
          });
        })
        .catch((err) => console.error("Failed to fetch user data:", err));
    }
  }, [loggedIn]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.message.trim()) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${getApiUrl()}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: `Contact Form Submission:\nName: ${formData.name}\nEmail: ${formData.email}\nPhone: ${formData.phone}\nMessage: ${formData.message}`
        }),
      });
      if (res.ok) {
        setFeedbackSubmitted(true);
        setFormData({ ...formData, message: "" });
        setTimeout(() => setFeedbackSubmitted(false), 3000);
      }
    } catch (err) {
      console.error("Error submitting feedback:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-16 md:py-20 lg:py-28 bg-white dark:bg-gray-dark transition-colors duration-300 relative z-10">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="-mx-4 flex flex-wrap">

          {/* Left Column: CTA Info */}
          <div className="w-full px-4 lg:w-7/12 xl:w-8/12">
            <div className="wow fadeInUp mb-12 rounded-sm bg-gray-light/30 dark:bg-dark py-11 px-8 sm:p-[55px] lg:mb-0 lg:px-8 xl:p-[55px] border border-stroke/40 dark:border-stroke-dark/40">
              <h2 className="mb-4 text-2xl font-bold text-black dark:text-white sm:text-3xl">
                Ready to Start Automating?
              </h2>
              <p className="mb-8 text-base font-medium leading-relaxed text-body-color dark:text-body-color-dark">
                Get 100 free credits to test our premium XML voucher compiler and bank statement mapping tool upon signing up.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                {loggedIn ? (
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="inline-flex items-center gap-2 rounded-md bg-primary-blue hover:bg-primary-blue/90 py-4 px-8 text-base font-bold text-white shadow-btn transition-colors"
                  >
                    Go to Dashboard <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={openSignup}
                      className="inline-flex items-center gap-2 rounded-md bg-primary-blue hover:bg-primary-blue/90 py-4 px-8 text-base font-bold text-white shadow-btn transition-colors"
                    >
                      Create Free Account <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={openLogin}
                      className="inline-flex items-center justify-center rounded-md border border-stroke dark:border-stroke-dark text-black dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 py-4 px-8 text-base font-bold transition-colors"
                    >
                      Login
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Contact/Feedback form */}
          <div className="w-full px-4 lg:w-5/12 xl:w-4/12">
            <div className="wow fadeInUp rounded-sm bg-white dark:bg-dark p-8 shadow-signUp dark:shadow-submit-dark border border-stroke/40 dark:border-stroke-dark/40">
              <h3 className="mb-6 text-xl font-bold text-black dark:text-white">
                Submit a Request
              </h3>

              {feedbackSubmitted ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500">
                    <Check className="w-8 h-8" />
                  </div>
                  <p className="text-green-500 font-bold">Feedback Sent Successfully!</p>
                  <p className="text-sm text-body-color dark:text-body-color-dark mt-2">
                    Thank you. We will review your message shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-black dark:text-white mb-2">Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Your Full Name"
                      className="w-full rounded-md border border-stroke/60 dark:border-stroke-dark bg-white dark:bg-dark py-3 px-4 text-base text-body-color outline-none focus:border-primary-blue transition-all dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-black dark:text-white mb-2">Email</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="your@email.com"
                      className="w-full rounded-md border border-stroke/60 dark:border-stroke-dark bg-white dark:bg-dark py-3 px-4 text-base text-body-color outline-none focus:border-primary-blue transition-all dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-black dark:text-white mb-2">Phone (optional)</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full rounded-md border border-stroke/60 dark:border-stroke-dark bg-white dark:bg-dark py-3 px-4 text-base text-body-color outline-none focus:border-primary-blue transition-all dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-black dark:text-white mb-2">Message</label>
                    <textarea
                      required
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Your inquiry or feedback..."
                      rows={3}
                      className="w-full rounded-md border border-stroke/60 dark:border-stroke-dark bg-white dark:bg-dark py-3 px-4 text-base text-body-color outline-none focus:border-primary-blue transition-all resize-none dark:text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-md bg-primary-blue hover:bg-primary-blue/90 py-3.5 px-6 text-base font-bold text-white shadow-submit transition-colors duration-200 disabled:opacity-60"
                  >
                    {submitting ? "Sending..." : "Submit Message"}
                  </button>
                </form>
              )}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

// ── Main Landing Page ──────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-dark transition-colors duration-300 overflow-x-hidden">
      <main className="flex-1">
        <HeroSection />
        <BrandsSection />
        <AboutSectionOne />
        <FeaturesSection />
        <AboutSectionTwo />
        <PricingSection />
        <TestimonialsSection />
        <FAQSection />
        <ContactCTASection />
      </main>    </div>
  );
}
