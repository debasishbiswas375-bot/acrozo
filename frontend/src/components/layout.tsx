/**
 * layout.tsx — Updated
 *
 * Changes:
 *  1. Wrap everything in <AuthModalProvider> so any child can call useAuthModal()
 *  2. Mount <AuthModal /> once here — it renders as a portal over all pages
 *
 * Drop this at: frontend/src/components/layout.tsx (replaces existing)
 */

import Header from "@/components/header";
import Footer from "@/components/footer";
import HeroBackground from "@/components/hero-background";
import AuthModal from "@/components/AuthModal";
import { AuthModalProvider } from "@/contexts/AuthModalContext";
import { useLocation } from "wouter";

interface LayoutProps {
  children: React.ReactNode;
  noFooter?: boolean;
}

export default function Layout({ children, noFooter = false }: LayoutProps) {
  const [location] = useLocation();
  const isLanding = location === "/";

  return (
    <AuthModalProvider>
      <div className="relative flex flex-col min-h-screen bg-white dark:bg-gray-dark transition-colors duration-300">
        <HeroBackground />
        <Header />
        <main className={`flex-1 relative z-[1] ${isLanding ? "" : "pt-20"}`}>
          {children}
        </main>
        {!noFooter && <Footer />}
      </div>

      {/* Single global auth modal — rendered outside the page flow */}
      <AuthModal />
    </AuthModalProvider>
  );
}
