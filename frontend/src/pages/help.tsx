import { useState } from "react";
import { useLocation } from "wouter";
import { clearToken } from "@/lib/api";
import {
  FileText, FileSpreadsheet, FileCode2, Wand2, BookOpen,
  HelpCircle, Star, ChevronDown, ArrowRight, ExternalLink,
  CreditCard, User, History, Shield, Zap
} from "lucide-react";

// ── Real tool list from the actual app ──────────────────────────────────────

const tools = [
  {
    icon: FileText,
    title: "Acrozo PDF Extractor",
    badge: "Premium",
    badgeColor: "bg-blue-100 text-blue-700",
    desc: "Upload a PDF and extract it to a clean Excel (.xlsx) or Word (.docx) file. Supports tables, invoices, bank statements, and reports.",
    route: "/pdf-converter",
    credits: "Uses credits",
  },
  {
    icon: FileSpreadsheet,
    title: "PDF to Excel (Acrozo Engine)",
    badge: "Premium",
    badgeColor: "bg-purple-100 text-purple-700",
    desc: "High-accuracy PDF → Excel conversion using Acrozo's advanced conversion engine. Best for complex multi-table documents.",
    route: "/tools/pdf-to-excel",
    credits: "Uses credits",
  },
  {
    icon: FileText,
    title: "PDF to Word (Acrozo Engine)",
    badge: "Premium",
    badgeColor: "bg-indigo-100 text-indigo-700",
    desc: "Convert PDF documents to editable Word (.docx) files while preserving formatting, headings, and paragraphs.",
    route: "/tools/pdf-to-word",
    credits: "Uses credits",
  },
  {
    icon: FileCode2,
    title: "ERP XML Generator",
    badge: "Accounting",
    badgeColor: "bg-emerald-100 text-emerald-700",
    desc: "Upload an Excel file with voucher data (payments, receipts, journal entries) and download an ERP-ready XML file. Supports Tally Prime and other ERP imports.",
    route: "/tally-generator",
    credits: "Uses credits",
  },
  {
    icon: Wand2,
    title: "Tally TDLs",
    badge: "Free",
    badgeColor: "bg-green-100 text-green-700",
    desc: "Browse and download Tally TDL (Tally Definition Language) add-ons to extend your Tally accounting software with extra features and automation.",
    route: "/tally-tdls",
    credits: "Free",
  },
];

// ── FAQs based on real features ──────────────────────────────────────────────

const faqs = [
  {
    q: "How do I extract data from a PDF?",
    a: "Go to Tally Tools → Acrozo PDF Extractor. Upload your PDF and click Convert. You'll get a downloadable Excel file. This uses credits from your plan.",
  },
  {
    q: "What is the ERP XML Generator?",
    a: "It converts an Excel file containing voucher data (bank payments, receipts, journal entries) into an ERP-compatible XML file. Upload your Excel on the XML Generator page, map your columns, and download the XML to import into Tally Prime, Marg, Busy, or other ERP tools.",
  },
  {
    q: "What are credits and how do I get more?",
    a: "Credits are consumed each time you use a premium tool (PDF conversions, Tally XML). You start with free credits on signup. Go to Pricing to buy a plan with more credits.",
  },
  {
    q: "Do I need an account to use the tools?",
    a: "A free account is required for most tools. Sign up takes less than a minute and you get free credits immediately. Tally TDLs are fully public with no login needed.",
  },
  {
    q: "Which PDF extractor should I use?",
    a: "Acrozo PDF Extractor works great for most PDFs including bank statements and invoices. For complex multi-table documents, use PDF to Excel (Acrozo Engine) available under Tools. Try Acrozo PDF Extractor first.",
  },
  {
    q: "How do I download a Tally TDL?",
    a: "Visit the Tally TDLs page from the navigation. Browse the available TDLs, click Download on any one, and load it into Tally via F12 → Configure → TDL & Add-on.",
  },
  {
    q: "Where is my conversion history?",
    a: "Click History in the top navigation after logging in. It shows all your recent PDF conversions with download links, dates, and file sizes.",
  },
  {
    q: "How do I change my profile picture?",
    a: "Go to Account → Profile tab. In the 'Profile Photo' panel on the right, click 'Change' to upload a new image. Photos are stored securely in the cloud.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. Files are processed securely and uploaded files are stored in an encrypted cloud bucket. We do not share your documents with third parties.",
  },
];

export default function HelpPage() {
  const [, navigate] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div>
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Help &amp; Features</h1>
          <p className="text-sm text-muted-foreground mt-1">Everything you can do on Acrozo — real tools, real answers</p>
        </div>

        {/* Quick nav cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { icon: Star,        label: "Tools",     id: "tools" },
            { icon: HelpCircle,  label: "FAQs",      id: "faqs" },
            { icon: CreditCard,  label: "Pricing",   route: "/pricing" },
            { icon: History,     label: "History",   route: "/history" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => {
                  if (item.route) { navigate(item.route); return; }
                  document.getElementById(item.id!)?.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-xl hover:shadow-md hover:border-primary/40 transition-all text-sm font-medium text-foreground"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Tools section */}
        <section id="tools" className="mb-12">
          <h2 className="text-xl font-bold text-foreground mb-5 flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" /> Available Tools
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <div
                  key={tool.title}
                  className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground text-sm">{tool.title}</h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tool.badgeColor}`}>{tool.badge}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{tool.credits}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{tool.desc}</p>
                  {tool.route && (
                    <button
                      onClick={() => navigate(tool.route!)}
                      className="self-start flex items-center gap-1 text-sm text-primary font-medium hover:underline"
                    >
                      Open tool <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Account features */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-foreground mb-5 flex items-center gap-2">
            <User className="w-5 h-5 text-primary" /> Account Features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: User,        title: "Profile Management",  desc: "Update your name, email, phone, address, and profile photo from the Account page.", route: "/account" },
              { icon: History,     title: "Conversion History",  desc: "View all past PDF and XML conversions with file names, dates, and re-download links.", route: "/history" },
              { icon: Shield,      title: "Security & Sessions", desc: "Manage active login sessions, change your password, and review account security on the Security tab.", route: "/account" },
              { icon: CreditCard,  title: "Plans & Credits",     desc: "See your current plan, credit balance, and expiry. Upgrade anytime from Pricing.", route: "/pricing" },
              { icon: BookOpen,    title: "Notifications",       desc: "Stay up to date with plan changes, announcements, and system alerts in the Notifications tab.", route: "/account" },
              { icon: Star,        title: "Google Sign-In",      desc: "Log in instantly with your Google account. Your Google profile photo is automatically synced.", route: "/login" },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col gap-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="font-semibold text-sm text-foreground">{f.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed flex-1">{f.desc}</p>
                  <button onClick={() => navigate(f.route)} className="self-start text-xs text-primary font-medium hover:underline flex items-center gap-1 mt-1">
                    Go there <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* FAQ section */}
        <section id="faqs" className="mb-10">
          <h2 className="text-xl font-bold text-foreground mb-5 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" /> Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 font-medium text-sm text-foreground hover:text-primary transition-colors"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                >
                  {faq.q}
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${openFaq === idx ? "rotate-180 text-primary" : "text-muted-foreground"}`} />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-4 pt-1 text-sm text-muted-foreground leading-relaxed border-t border-border">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Still need help?</h2>
            <p className="text-sm text-muted-foreground mt-1">Use the AI assistant (chat bubble) or send feedback from the home page.</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <button
              onClick={() => navigate("/")}
              className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
            >
              Send Feedback
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-5 py-2.5 bg-muted text-muted-foreground text-sm font-semibold rounded-lg hover:bg-muted/80 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>

      </main>    </div>
  );
}
