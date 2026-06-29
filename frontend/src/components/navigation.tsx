import { useLocation } from "wouter";
import { isAdmin } from "@/lib/api";
import Notifications from "@/components/notifications";
import AvatarDropdown from "@/components/avatar-dropdown";

interface NavigationProps {
  username?: string;
  email?: string;
  phone?: string;
}

export default function Navigation({ username, email, phone }: NavigationProps) {
  const [location] = useLocation();

  const navItems = [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/bank-to-erp", label: "Bank to ERP" },
    { path: "/tally-tools", label: "More Tools" },
    { path: "/pricing", label: "Pricing" },
    { path: "/history", label: "History" },
    { path: "/account", label: "Account" },
    { path: "/help", label: "Help & Features" },
    ...(isAdmin() ? [{ path: "/admin", label: "Admin Panel" }] : []),
  ];

  return (
    <nav className="hidden md:flex items-center gap-6">
      {navItems.map((item) => (
        <a
          key={item.path}
          href={item.path}
          className={`text-sm font-medium transition-colors ${location === item.path
              ? "text-sidebar-primary"
              : "text-sidebar-foreground hover:text-sidebar-foreground/80"
            }`}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
