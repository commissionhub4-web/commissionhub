import { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: { value: string; positive: boolean };
}

export function StatCard({ title, value, subtitle, icon, trend }: StatCardProps) {
  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="stat-value text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <p
              className={`mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                trend.positive
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {trend.positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              <span>{trend.value}</span>
            </p>
          )}
        </div>
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">{icon}</div>
      </div>
    </div>
  );
}
