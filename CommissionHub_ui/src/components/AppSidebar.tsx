import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Calculator,
  FileBarChart,
  DollarSign,
  LogOut,
  Shield,
} from "lucide-react";
import logo from "@/assets/CommissionHub logo with growth symbol.png";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/billing", label: "Billing", icon: DollarSign },
  { to: "/commissions", label: "Commissions", icon: Calculator },
  { to: "/reports", label: "Reports", icon: FileBarChart },
];

export function AppSidebar() {
  const { currentUser, isAdmin, logout } = useAuth();

  const visibleLinks = isAdmin
    ? [...links, { to: "/admin/users", label: "Admin Users", icon: Shield }]
    : links;

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar flex flex-col">
      <div className="flex h-24 items-center border-b border-sidebar-border px-4">
        <img src={logo} alt="CommissionHub logo" className="h-75 w-auto" />
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              }`
            }
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 rounded-md border border-sidebar-border/80 bg-sidebar-accent/30 px-3 py-2">
          <p className="truncate text-xs font-medium text-sidebar-foreground">{currentUser?.name ?? "User"}</p>
          <p className="truncate text-[11px] text-muted-foreground">{currentUser?.email ?? "Not signed in"}</p>
        </div>
        <Button variant="outline" size="sm" className="w-full justify-start" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">v1.0 — Commission Management</p>
      </div>
    </aside>
  );
}
