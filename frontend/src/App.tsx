/**
 * App.tsx — Updated with SEO bank-slug routes
 *
 * Changes from original:
 *  1. Import BankSeoWrapper and VALID_BANK_SLUGS
 *  2. Add a /:bankSlug route ABOVE the catch-all NotFound route.
 *     It validates the slug against VALID_BANK_SLUGS and renders
 *     BankSeoWrapper only for known bank slugs, falling through to
 *     NotFound for everything else.
 *
 * No other routes or logic have been changed.
 */

import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import DashboardPage from "@/pages/dashboard";
import PdfConverterMineruPage from "./pages/pdf";
import ToolsPage from "./pages/tally-tools";
import PricingPage from "@/pages/pricing";
import HistoryPage from "@/pages/history";
import AccountPage from "@/pages/account";
import HelpPage from "@/pages/help";
import AdminPage from "@/pages/admin";
import PurchaseSuccessPage from "@/pages/purchase-success";
import PaymentMockPage from "@/pages/payment-mock";
import GoogleCallback from "@/pages/google-callback";
import FacebookCallback from "@/pages/facebook-callback";
import TallyGenerator from "@/pages/tally-generator";
import TallyTdlsPage from "@/pages/tally-tdls";
import BankPdfToTally from "@/pages/bank-to-erp";
import LandingPage from "@/pages/landing";
import AdobePdfToExcelPage from "./pages/adobe-pdf-to-excel";
import AcrozoPdfToWordPage from "./pages/adobe-pdf-to-word";
import GstCalculatorPage from "@/pages/gst-calculator";
import TdsInterestCalculatorPage from "@/pages/tds-interest-calculator";
import IncomeTaxCalculatorPage from "@/pages/income-tax-calculator";
import NotFound from "@/pages/not-found";
import { isLoggedIn, isAdmin, checkAuthStatus } from "@/lib/api";
import { useState, useEffect } from "react";
import { PlanColorsProvider } from "@/contexts/plan-colors-context";
import { ThemeProvider } from "next-themes";
import Layout from "@/components/layout";
import DatabaseLoader from "@/components/database-loader";

// ── NEW: SEO bank-slug wrapper ────────────────────────────────────────────────
import BankSeoWrapper, { VALID_BANK_SLUGS } from "@/pages/BankSeoWrapper";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      await new Promise(resolve => setTimeout(resolve, 300));
      if (isLoggedIn()) {
        setIsAuthenticated(true);
        setIsChecking(false);
        return;
      }
      const authStatus = await checkAuthStatus();
      setIsAuthenticated(authStatus.authenticated);
      setIsChecking(false);
    }
    checkAuth();
  }, []);

  if (isChecking) {
    return <DatabaseLoader />;
  }
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  return <>{children}</>;
}

function AdminRoute({ children, requireAdmin }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      await new Promise(resolve => setTimeout(resolve, 300));
      if (isLoggedIn()) {
        setIsAuthenticated(true);
        setIsAdminUser(isAdmin());
        setIsChecking(false);
        return;
      }
      const authStatus = await checkAuthStatus();
      setIsAuthenticated(authStatus.authenticated);
      setIsAdminUser(authStatus.user?.is_admin || false);
      setIsChecking(false);
    }
    checkAuth();
  }, []);

  if (isChecking) {
    return <DatabaseLoader />;
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (requireAdmin && !isAdminUser) return <Redirect to="/dashboard" />;
  return <>{children}</>;
}

function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (isLoggedIn()) {
        setIsAuthenticated(true);
        setIsAdminUser(isAdmin());
        setIsChecking(false);
        return;
      }
      const authStatus = await checkAuthStatus();
      setIsAuthenticated(authStatus.authenticated);
      setIsAdminUser(authStatus.user?.is_admin || false);
      setIsChecking(false);
    }
    checkAuth();
  }, []);

  if (isChecking) {
    return <DatabaseLoader />;
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (!isAdminUser) return <Redirect to="/dashboard" />;
  return <>{children}</>;
}

// ── BankSlugRoute ─────────────────────────────────────────────────────────────
//
// Wouter's /:bankSlug wildcard would also match paths like /login, /dashboard,
// etc. if placed first. To prevent that, this component validates the captured
// segment against VALID_BANK_SLUGS *before* rendering BankSeoWrapper.
//
// Placement: this Route must be declared AFTER all explicit named routes and
// BEFORE the catch-all NotFound route.
//
// Why no ProtectedRoute? The bank landing pages are public SEO doors — visitors
// arrive from Google and must be able to see the page without logging in. The
// underlying BankPdfToTally component already handles auth-gating for the
// actual conversion API call.

function BankSlugRoute({ params }: { params: { bankSlug: string } }) {
  const { bankSlug } = params;
  if (!VALID_BANK_SLUGS.has(bankSlug)) {
    // Not a known bank slug — render the 404 page
    return <Layout><NotFound /></Layout>;
  }
  return (
    <Layout>
      <BankSeoWrapper />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      {/* ── Public pages ──────────────────────────────────────────────── */}
      <Route path="/" component={() => <Layout><LandingPage /></Layout>} />
      <Route path="/login" component={() => <Layout><LoginPage /></Layout>} />
      <Route path="/signup" component={() => <Layout><SignupPage /></Layout>} />
      <Route path="/pricing" component={() => <Layout><PricingPage /></Layout>} />
      <Route path="/auth/google/callback" component={GoogleCallback} />
      <Route path="/auth/facebook/callback" component={FacebookCallback} />
      <Route path="/tally-generator" component={() => <Layout><TallyGenerator /></Layout>} />
      <Route path="/tally-tdls" component={() => <Layout><TallyTdlsPage /></Layout>} />
      <Route path="/tally/bank-pdf-to-tally" component={() => <Redirect to="/bank-to-erp" />} />
      <Route path="/bank-to-erp" component={() => (
        <Layout><ProtectedRoute><BankPdfToTally /></ProtectedRoute></Layout>
      )} />

      {/* ── Protected pages ───────────────────────────────────────────── */}
      <Route path="/dashboard" component={() => (
        <Layout><ProtectedRoute><DashboardPage /></ProtectedRoute></Layout>
      )} />
      <Route path="/acrozo-tools" component={() => <Redirect to="/tally-tools" />} />
      <Route path="/convert-xml" component={() => <Redirect to="/tally-tools" />} />
      <Route path="/pdf-converter-mineru" component={() => <Redirect to="/pdf-converter" />} />
      <Route path="/pdf-converter" component={() => (
        <Layout><PdfConverterMineruPage /></Layout>
      )} />
      <Route path="/tally-tools" component={() => (
        <Layout><ProtectedRoute><ToolsPage /></ProtectedRoute></Layout>
      )} />
      <Route path="/tools" component={() => <Redirect to="/tally-tools" />} />
      <Route path="/tools/pdf-to-excel" component={() => (
        <Layout><ProtectedRoute><AdobePdfToExcelPage /></ProtectedRoute></Layout>
      )} />
      <Route path="/tools/pdf-to-word" component={() => (
        <Layout><ProtectedRoute><AcrozoPdfToWordPage /></ProtectedRoute></Layout>
      )} />
      <Route path="/tools/gst-calculator" component={() => (
        <Layout><GstCalculatorPage /></Layout>
      )} />
      <Route path="/tools/tds-interest-calculator" component={() => (
        <Layout><TdsInterestCalculatorPage /></Layout>
      )} />
      <Route path="/tools/income-tax-calculator" component={() => (
        <Layout><IncomeTaxCalculatorPage /></Layout>
      )} />
      <Route path="/payment/mock" component={() => (
        <Layout><ProtectedRoute><PaymentMockPage /></ProtectedRoute></Layout>
      )} />
      <Route path="/purchase/success" component={() => (
        <Layout><ProtectedRoute><PurchaseSuccessPage /></ProtectedRoute></Layout>
      )} />
      <Route path="/history" component={() => (
        <Layout><ProtectedRoute><HistoryPage /></ProtectedRoute></Layout>
      )} />
      <Route path="/account" component={() => (
        <Layout><ProtectedRoute><AccountPage /></ProtectedRoute></Layout>
      )} />
      <Route path="/help" component={() => (
        <Layout><ProtectedRoute><HelpPage /></ProtectedRoute></Layout>
      )} />
      <Route path="/admin" component={() => (
        <Layout><AdminProtectedRoute><AdminPage /></AdminProtectedRoute></Layout>
      )} />

      {/* ── SEO bank landing pages ─────────────────────────────────────
          MUST be declared after all explicit named routes.
          VALID_BANK_SLUGS guard inside BankSlugRoute prevents false matches. */}
      <Route path="/:bankSlug" component={BankSlugRoute} />

      {/* ── 404 catch-all ─────────────────────────────────────────────── */}
      <Route component={() => <Layout><NotFound /></Layout>} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" enableSystem={false} defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <PlanColorsProvider>
          <TooltipProvider>
            <WouterRouter>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </PlanColorsProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
