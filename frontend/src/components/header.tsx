/**
 * header.tsx — Updated
 *
 * Changes from original:
 *  - Import useAuthModal
 *  - Desktop Sign In / Sign Up buttons call openLogin() / openSignup()
 *  - Mobile Sign In / Sign Up buttons call openLogin() / openSignup()
 *  - navigate("/login") and navigate("/signup") calls removed from those buttons
 *
 * Everything else is identical to the original.
 *
 * Drop this at: frontend/src/components/header.tsx (replaces existing)
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { clearToken, isAdmin, isLoggedIn } from "@/lib/api";
import Notifications from "@/components/notifications";
import AvatarDropdown from "@/components/avatar-dropdown";
import SessionTimer from "@/components/session-timer";
import ThemeToggler from "@/components/theme-toggler";
import { Home, FileText, Wrench, DollarSign, Clock, User, HelpCircle, Menu, X, Shield, ChevronDown, FileSpreadsheet, Package, Calculator } from "lucide-react";
import { useAuthModal } from "@/contexts/AuthModalContext";

function TallyToolsDropdown({ item, isActive, navigate }: { item: any, isActive: boolean, navigate: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const tallyIntegrationItems = [
    {
      title: "ERP XML Generator",
      description: "Excel to ERP XML converter",
      icon: FileSpreadsheet,
      path: "/tally-generator"
    },
    {
      title: "Tally TDLs",
      description: "Tally Prime add-ons & extras",
      icon: Package,
      path: "/tally-tdls"
    }
  ];

  const converterItems = [
    {
      title: "Acrozo PDF Extractor",
      description: "Document AI extraction engine",
      icon: FileSpreadsheet,
      path: "/pdf-converter"
    },
    {
      title: "PDF to Excel",
      description: "Convert PDF to Excel sheets",
      icon: FileSpreadsheet,
      path: "/tools/pdf-to-excel"
    },
    {
      title: "PDF to Word",
      description: "Convert PDF to editable Word",
      icon: FileText,
      path: "/tools/pdf-to-word"
    }
  ];

  const calculatorItems = [
    {
      title: "GST Calculator",
      description: "Calculate CGST, SGST & IGST",
      icon: Calculator,
      path: "/tools/gst-calculator"
    },
    {
      title: "TDS Interest Calculator",
      description: "Late deduction & filing fees",
      icon: Calculator,
      path: "/tools/tds-interest-calculator"
    },
    {
      title: "Income Tax Calculator",
      description: "FY 2026-27 regime comparison",
      icon: Calculator,
      path: "/tools/income-tax-calculator"
    }
  ];

  const renderSection = (title: string, items: typeof tallyIntegrationItems) => (
    <div className="flex flex-col">
      <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 border-b border-gray-100 dark:border-white/5 pb-1">
        {title}
      </div>
      <div className="space-y-0.5">
        {items.map((subItem) => {
          const SubIcon = subItem.icon;
          return (
            <button
              key={subItem.path}
              onClick={() => {
                navigate(subItem.path);
                setIsOpen(false);
              }}
              className="w-full flex items-start gap-3 p-2 rounded-lg text-left transition-all duration-150 hover:bg-gray-100/70 dark:hover:bg-white/[0.06] group"
            >
              <div className="w-7 h-7 rounded-lg bg-primary-blue/10 flex items-center justify-center shrink-0 group-hover:bg-primary-blue/20 transition-colors">
                <SubIcon className="w-3.5 h-3.5 text-primary-blue" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-black dark:text-white truncate">
                  {subItem.title}
                </p>
                <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                  {subItem.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div 
      className="relative" 
      ref={containerRef}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        onClick={() => {
          navigate("/tally-tools");
          setIsOpen(false);
        }}
        className={`relative px-3 py-2 rounded-md text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
          isActive
            ? "text-primary-blue bg-primary-blue/10 dark:bg-primary-blue/20"
            : "text-body-color hover:text-black dark:text-body-color-dark dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
        }`}
      >
        <Wrench className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="whitespace-nowrap">{item.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        {isActive && <span className="absolute -bottom-[1px] left-1/2 -translate-x-1/2 w-4 h-[2px] bg-primary-blue rounded-full" />}
      </button>

      {isOpen && (
        <div 
          className="absolute top-full left-1/2 -translate-x-1/3 pt-2 w-[720px] z-50 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="rounded-2xl border bg-white dark:bg-[#081026] border-gray-200/80 dark:border-white/10 shadow-[0_24px_48px_rgba(0,0,0,0.12)] dark:shadow-[0_24px_48px_rgba(0,0,0,0.55)] p-4">
            <div className="grid grid-cols-3 gap-5">
              {renderSection("Tally & ERP Integration", tallyIntegrationItems)}
              {renderSection("Document Converters", converterItems)}
              {renderSection("Calculators & Utilities", calculatorItems)}
            </div>
            <div className="border-t border-gray-100 dark:border-white/8 my-3" />
            <div className="flex justify-end">
              <button
                onClick={() => {
                  navigate("/tally-tools");
                  setIsOpen(false);
                }}
                className="flex items-center gap-1.5 py-1.5 px-4 rounded-lg text-xs font-semibold text-primary-blue bg-primary-blue/5 hover:bg-primary-blue/10 dark:bg-primary-blue/10 dark:hover:bg-primary-blue/20 transition-all duration-150"
              >
                <span>View All Tools</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const [location, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sticky, setSticky] = useState(false);
  const { openLogin, openSignup } = useAuthModal();

  const handleStickyNavbar = () => {
    if (window.scrollY >= 80) {
      setSticky(true);
    } else {
      setSticky(false);
    }
  };

  useEffect(() => {
    window.addEventListener("scroll", handleStickyNavbar);
    return () => window.removeEventListener("scroll", handleStickyNavbar);
  }, []);

  const loggedIn = isLoggedIn();

  const navigation = [
    { path: "/dashboard",  label: "Dashboard",    icon: Home },
    { path: "/bank-to-erp", label: "Bank to ERP", icon: FileSpreadsheet },
    { path: "/tally-tools",label: "More Tools",  icon: Wrench },
    { path: "/pricing",    label: "Pricing",       icon: DollarSign },
    { path: "/history",    label: "History",       icon: Clock },
    { path: "/account",    label: "Account",       icon: User },
    { path: "/help",       label: "Help",          icon: HelpCircle },
  ];

  return (
    <header
      className={`header left-0 top-0 z-40 flex w-full items-center transition-all duration-300 ${
        sticky
          ? "fixed z-[9999] bg-white/90 dark:bg-gray-dark/90 shadow-sticky backdrop-blur-sm border-b border-stroke/40 dark:border-stroke-dark/40 py-3"
          : "absolute bg-transparent py-5"
      }`}
    >
      <div className="w-full px-4 lg:px-8">
        <div className="relative flex items-center justify-between">

          {/* Logo */}
          <div className="w-auto max-w-full">
            <button
              onClick={() => navigate(loggedIn ? "/dashboard" : "/")}
              className="flex items-center gap-2.5 text-left group focus:outline-none"
            >
              <img src="/logo.png" alt="Acrozo Icon" className="h-11 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02] invert dark:invert-0" />
              <div className="h-8 border-l border-body-color/30 dark:border-body-color-dark/30 mx-1" />
              <img src="/web-logo.png?v=1" alt="Acrozo Logo" className="h-7 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02] invert dark:invert-0" />
              <div className="hidden 2xl:flex flex-col pl-2">
                <span className="text-[14px] font-bold text-black dark:text-white leading-tight whitespace-nowrap">Advanced Core Reliable Operations</span>
                <span className="text-[10px] text-body-color dark:text-body-color-dark tracking-wider uppercase font-semibold leading-tight mt-0.5 whitespace-nowrap">Zero Outages</span>
              </div>
            </button>
          </div>

          {/* Desktop nav (logged in only) */}
          {loggedIn && (
            <nav className="hidden xl:flex items-center gap-2">
              {navigation.map((item) => {
                const isActive = item.path === "/tally-tools"
                  ? (location === "/tally-tools" || location === "/tally-generator" || location === "/tally-tdls")
                  : location === item.path;

                if (item.path === "/tally-tools") {
                  return (
                    <TallyToolsDropdown
                      key={item.path}
                      item={item}
                      isActive={isActive}
                      navigate={navigate}
                    />
                  );
                }

                if (item.path === "/bank-to-erp") {
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`relative px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-1.5 border shadow-sm hover:scale-[1.02]
                        ${isActive
                          ? "text-white bg-gradient-to-r from-indigo-600 to-violet-600 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.25)]"
                          : "text-indigo-600 dark:text-indigo-300 bg-gradient-to-r from-indigo-50/70 to-violet-50/70 dark:from-indigo-950/30 dark:to-violet-950/30 border-indigo-200 dark:border-indigo-900/60 hover:from-indigo-100/60 hover:to-violet-100/60 dark:hover:from-indigo-950/50 dark:hover:to-violet-950/50 shadow-[0_2px_8px_rgba(99,102,241,0.06)]"
                        }`}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 flex-shrink-0 animate-pulse text-indigo-500 dark:text-indigo-400" />
                      <span className="whitespace-nowrap">{item.label}</span>
                      <span className="absolute -top-1.5 -right-1 text-[8px] font-extrabold uppercase bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1 py-0.5 rounded-md shadow-md animate-pulse">
                        AI
                      </span>
                    </button>
                  );
                }

                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`relative px-3 py-2 rounded-md text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                      isActive
                        ? "text-primary-blue bg-primary-blue/10 dark:bg-primary-blue/20"
                        : "text-body-color hover:text-black dark:text-body-color-dark dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                    {isActive && <span className="absolute -bottom-[1px] left-1/2 -translate-x-1/2 w-4 h-[2px] bg-primary-blue rounded-full" />}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Right controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {loggedIn ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden sm:block"><SessionTimer lightBg={sticky} /></div>
                <Notifications />
                {isAdmin() && (
                  <button
                    onClick={() => navigate("/admin")}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-yellow/20 border border-yellow/60 rounded-md hover:bg-yellow/30 transition-all duration-200"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Admin
                  </button>
                )}
                <AvatarDropdown username="user" email="" phone="" />
              </div>
            ) : (
              /* ── Desktop Sign In / Sign Up — now open modal ── */
              <div className="hidden sm:flex items-center gap-3">
                <button
                  onClick={openLogin}
                  className="px-6 py-2.5 text-sm font-semibold text-black hover:opacity-75 dark:text-white transition-opacity"
                >
                  Sign In
                </button>
                <button
                  onClick={openSignup}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-primary-blue rounded-md shadow-btn hover:bg-primary-blue/90 transition-colors"
                >
                  Sign Up
                </button>
              </div>
            )}

            <ThemeToggler />

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
              className="xl:hidden p-2 rounded-md text-black dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="xl:hidden absolute top-full left-0 right-0 mt-2 p-4 bg-white dark:bg-gray-dark border border-stroke dark:border-stroke-dark shadow-three rounded-lg mx-4 transition-all duration-300">
            <nav className="flex flex-col gap-1.5">
              {loggedIn ? (
                <>
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.path;
                    if (item.path === "/bank-to-erp") {
                      return (
                        <button
                          key={item.path}
                          onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                          className={`w-full px-3.5 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-between border border-indigo-250/20 dark:border-indigo-900/30 ${
                            isActive
                              ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md"
                              : "bg-indigo-50/30 dark:bg-indigo-950/15 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/25"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="w-4 h-4 text-indigo-500 dark:text-indigo-400 animate-pulse" />
                            <span>{item.label}</span>
                          </div>
                          <span className="text-[8px] font-extrabold uppercase bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1.5 py-0.5 rounded-md shadow-sm">
                            AI PREMIUM
                          </span>
                        </button>
                      );
                    }
                    return (
                      <button
                        key={item.path}
                        onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                        className={`w-full px-3 py-2.5 rounded-md text-sm font-semibold transition-colors flex items-center gap-3 ${
                          isActive
                            ? "bg-primary-blue/10 text-primary-blue dark:bg-primary-blue/20 dark:text-white"
                            : "text-body-color hover:bg-gray-100 dark:text-body-color-dark dark:hover:bg-white/5"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                  {isAdmin() && (
                    <button
                      onClick={() => { navigate("/admin"); setMobileMenuOpen(false); }}
                      className="w-full px-3 py-2.5 rounded-md text-sm font-semibold text-yellow bg-yellow/10 flex items-center gap-3"
                    >
                      <Shield className="w-4 h-4" />
                      <span>Admin Settings</span>
                    </button>
                  )}
                </>
              ) : (
                /* ── Mobile Sign In / Sign Up — now open modal ── */
                <div className="flex flex-col gap-2 pt-2 border-t border-stroke dark:border-stroke-dark mt-2">
                  <button
                    onClick={() => { openLogin(); setMobileMenuOpen(false); }}
                    className="w-full py-2.5 text-center text-sm font-semibold text-black dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-md border border-stroke dark:border-stroke-dark"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => { openSignup(); setMobileMenuOpen(false); }}
                    className="w-full py-2.5 text-center text-sm font-semibold text-white bg-primary-blue hover:bg-primary-blue/90 rounded-md shadow-btn"
                  >
                    Sign Up
                  </button>
                </div>
              )}
            </nav>
          </div>
        )}

      </div>
    </header>
  );
}
