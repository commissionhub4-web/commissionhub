import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0" style={{ backgroundImage: "var(--app-shell-layer-1)" }} />
        <div
          className="absolute inset-0 bg-[size:48px_48px] opacity-[0.08]"
          style={{ backgroundImage: "var(--app-shell-layer-2)" }}
        />
        <div
          className="absolute -top-56 left-[40%] h-[820px] w-[820px] -translate-x-1/2 rounded-full blur-[160px]"
          style={{ backgroundColor: "hsl(var(--app-shell-orb-1) / 0.12)" }}
        />
        <div
          className="absolute -bottom-56 -right-24 h-[460px] w-[460px] rounded-full blur-[130px]"
          style={{ backgroundColor: "hsl(var(--app-shell-orb-2) / 0.12)" }}
        />
      </div>

      <AppSidebar />
      <main className="relative z-10 pl-64">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
