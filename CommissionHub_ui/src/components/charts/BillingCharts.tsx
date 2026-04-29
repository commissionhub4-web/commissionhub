import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useApp } from "@/contexts/AppContext";

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(230, 16%, 11%)",
    border: "1px solid hsl(230, 12%, 20%)",
    borderRadius: "8px",
    color: "hsl(210, 20%, 92%)",
    fontSize: "12px",
  },
};

export function MonthlyBillingChart() {
  const { billing, getCommissionableBill } = useApp();

  const data = useMemo(() => {
    const monthMap = new Map<string, { month: string; totalBill: number; netBill: number }>();
    billing.forEach((entry) => {
      const existing = monthMap.get(entry.month) ?? { month: entry.month, totalBill: 0, netBill: 0 };
      existing.totalBill += entry.totalBill;
      existing.netBill += getCommissionableBill(entry);
      monthMap.set(entry.month, existing);
    });

    return [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [billing, getCommissionableBill]);

  return (
    <div className="glass-card p-5 animate-fade-in">
      <h3 className="mb-4 font-semibold">Monthly Billing</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(230, 12%, 20%)" />
          <XAxis dataKey="month" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} />
          <YAxis tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`} />
          <Tooltip {...tooltipStyle} formatter={(value: number) => `$${value.toLocaleString()}`} />
          <Bar dataKey="totalBill" name="Total Bill" fill="hsl(217, 91%, 60%)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="netBill" name="Net Bill" fill="hsl(199, 89%, 48%)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function YearlyBillingChart() {
  const { billing } = useApp();

  const data = useMemo(() => {
    const yearMap = new Map<string, number>();
    billing.forEach((entry) => {
      const year = entry.month.split("-")[0] ?? "Unknown";
      yearMap.set(year, (yearMap.get(year) ?? 0) + entry.totalBill);
    });

    return [...yearMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([year, total]) => ({ year, total }));
  }, [billing]);

  return (
    <div className="glass-card p-5 animate-fade-in">
      <h3 className="mb-4 font-semibold">Yearly Billing</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(230, 12%, 20%)" />
          <XAxis dataKey="year" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} />
          <YAxis tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`} />
          <Tooltip {...tooltipStyle} formatter={(value: number) => `$${value.toLocaleString()}`} />
          <Bar dataKey="total" name="Yearly Total" fill="hsl(142, 71%, 45%)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
