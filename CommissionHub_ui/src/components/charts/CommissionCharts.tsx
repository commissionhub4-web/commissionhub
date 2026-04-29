import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { useApp } from "@/contexts/AppContext";

const PIE_COLORS = [
  "hsl(217, 91%, 60%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 60%)", "hsl(0, 72%, 51%)", "hsl(199, 89%, 48%)",
  "hsl(160, 60%, 45%)", "hsl(330, 70%, 55%)", "hsl(50, 80%, 50%)",
];

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(230, 16%, 11%)",
    border: "1px solid hsl(230, 12%, 20%)",
    borderRadius: "8px",
    color: "hsl(210, 20%, 92%)",
    fontSize: "12px",
  },
};

export function MonthlyCommissionChart() {
  const { billing, commissions, getCommissionableBill } = useApp();

  const data = useMemo(() => {
    const monthMap = new Map<string, number>();
    commissions.forEach((c) => {
      const b = billing.find((bi) => bi.id === c.billingId);
      if (!b) return;
      const amount = getCommissionableBill(b) * (c.contributionPercent / 100);
      monthMap.set(b.month, (monthMap.get(b.month) || 0) + amount);
    });
    return [...monthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, total]) => ({ month, commission: Math.round(total * 100) / 100 }));
  }, [billing, commissions, getCommissionableBill]);

  return (
    <div className="glass-card p-5 animate-fade-in">
      <h3 className="font-semibold mb-4">Monthly Commission Payouts</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(230, 12%, 20%)" />
          <XAxis dataKey="month" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} />
          <YAxis tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
          <Tooltip {...tooltipStyle} formatter={(value: number) => `$${value.toLocaleString()}`} />
          <Bar dataKey="commission" name="Commission Paid" fill="hsl(142, 71%, 45%)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DepartmentCommissionChart() {
  const { billing, commissions, getCommissionableBill } = useApp();

  const data = useMemo(() => {
    const deptMap = new Map<string, number>();
    commissions.forEach((c) => {
      const b = billing.find((bi) => bi.id === c.billingId);
      if (!b) return;
      const amount = getCommissionableBill(b) * (c.contributionPercent / 100);
      deptMap.set(c.department, (deptMap.get(c.department) || 0) + amount);
    });
    return [...deptMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
  }, [billing, commissions, getCommissionableBill]);

  return (
    <div className="glass-card p-5 animate-fade-in">
      <h3 className="font-semibold mb-4">Commission by Department</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: "hsl(215, 15%, 55%)" }}>
            {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip {...tooltipStyle} formatter={(value: number) => `$${value.toLocaleString()}`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TopEarnersChart() {
  const { billing, commissions, employees, getCommissionableBill } = useApp();

  const data = useMemo(() => {
    const empMap = new Map<string, { name: string; total: number }>();
    commissions.forEach((c) => {
      const b = billing.find((bi) => bi.id === c.billingId);
      const emp = employees.find((e) => e.id === c.employeeId);
      if (!b || !emp) return;
      const amount = getCommissionableBill(b) * (c.contributionPercent / 100);
      const existing = empMap.get(c.employeeId) || { name: emp.name, total: 0 };
      existing.total += amount;
      empMap.set(c.employeeId, existing);
    });
    return [...empMap.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
      .map((e) => ({ name: e.name.split(" ")[0], total: Math.round(e.total * 100) / 100 }));
  }, [billing, commissions, employees, getCommissionableBill]);

  return (
    <div className="glass-card p-5 animate-fade-in">
      <h3 className="font-semibold mb-4">Top Earners (All Time)</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 15, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(230, 12%, 20%)" horizontal={false} />
          <XAxis type="number" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
          <YAxis type="category" dataKey="name" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} width={60} />
          <Tooltip {...tooltipStyle} formatter={(value: number) => `$${value.toLocaleString()}`} />
          <Bar dataKey="total" name="Total Commission" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProjectRevenueChart() {
  const { billing, projects, getCommissionableBill } = useApp();

  const data = useMemo(() => {
    const projMap = new Map<string, { name: string; billed: number; commissionable: number }>();
    billing.forEach((b) => {
      const proj = projects.find((p) => p.id === b.projectId);
      if (!proj) return;
      const existing = projMap.get(b.projectId) || { name: proj.name, billed: 0, commissionable: 0 };
      existing.billed += b.totalBill;
      existing.commissionable += getCommissionableBill(b);
      projMap.set(b.projectId, existing);
    });
    return [...projMap.values()].sort((a, b) => b.billed - a.billed);
  }, [billing, projects, getCommissionableBill]);

  return (
    <div className="glass-card p-5 animate-fade-in">
      <h3 className="font-semibold mb-4">Revenue by Project</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(230, 12%, 20%)" />
          <XAxis dataKey="name" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 10 }} />
          <YAxis tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
          <Tooltip {...tooltipStyle} formatter={(value: number) => `$${value.toLocaleString()}`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="billed" name="Billed" fill="hsl(217, 91%, 60%)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="commissionable" name="Commissionable" fill="hsl(142, 71%, 45%)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
