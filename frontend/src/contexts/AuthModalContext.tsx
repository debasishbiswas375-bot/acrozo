/**
 * AuthModalContext.tsx
 *
 * Global context that lets ANY component open the login or signup
 * modal without navigating away from the current page.
 *
 * Usage:
 *   const { openLogin, openSignup } = useAuthModal();
 *   <button onClick={openLogin}>Sign In</button>
 *
 * Drop this file at: frontend/src/contexts/AuthModalContext.tsx
 */

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type AuthModalView = "login" | "signup" | null;

interface AuthModalContextValue {
  view: AuthModalView;
  openLogin: () => void;
  openSignup: () => void;
  close: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue>({
  view: null,
  openLogin: () => {},
  openSignup: () => {},
  close: () => {},
});

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<AuthModalView>(null);

  const openLogin  = useCallback(() => setView("login"),  []);
  const openSignup = useCallback(() => setView("signup"), []);
  const close      = useCallback(() => setView(null),     []);

  return (
    <AuthModalContext.Provider value={{ view, openLogin, openSignup, close }}>
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  return useContext(AuthModalContext);
}
