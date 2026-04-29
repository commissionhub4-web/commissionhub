import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, DollarSign, MoonStar, PiggyBank, Sun, TrendingDown, TrendingUp, Trophy, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DepartmentCommissionChart, ProjectRevenueChart, TopEarnersChart } from "@/components/charts/CommissionCharts";

type Highlights = {
  totalBilling: number;
  deductions: number;
  netCommissionable: number;
  totalPayouts: number;
  profitRetained: number;
  activeProjects: number;
  activeEmployees: number;
};

type MetricCardProps = {
  label: string;
  value: string;
  subtext: string;
  icon: ReactNode;
};

type GraphView = "department" | "employee" | "project";

type PerformerRowData = {
  name: string;
  department: string;
  amount: number;
};

type PerformerRowProps = {
  item: PerformerRowData;
  index: number;
  highlight: "gold" | "green";
  showTrend?: boolean;
};

function getRankBadge(rank: number) {
  if (rank === 1) return "#1";
  if (rank === 2) return "#2";
  if (rank === 3) return "#3";
  return `#${rank}`;
}

function PerformerRow({ item, index, highlight, showTrend = false }: PerformerRowProps) {
  const rank = index + 1;
  const isTop = rank === 1;

  return (
    <div
      className={`group flex items-center justify-between rounded-xl border px-3 py-2.5 transition-all duration-200 hover:-translate-y-[1px] hover:border-primary/40 ${
        isTop
          ? highlight === "gold"
            ? "border-amber-400/30 bg-amber-500/10"
            : "border-emerald-400/30 bg-emerald-500/10"
          : "border-border/50 bg-background/40"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-border/60 bg-muted/40 px-1 text-xs font-semibold text-foreground">
          {getRankBadge(rank)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
          <p className="truncate text-xs text-muted-foreground">{item.department}</p>
        </div>
      </div>

      <div className="ml-3 flex items-center gap-1.5 text-right">
        {showTrend && <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />}
        <span className="text-sm font-semibold text-emerald-400">{formatCurrency(item.amount)}</span>
      </div>
    </div>
  );
}

function MetricCard({ label, value, subtext, icon }: MetricCardProps) {
  return (
    <article className="group rounded-2xl border border-border/60 bg-gradient-to-b from-muted/30 to-card p-4 shadow-[0_8px_28px_-18px_rgba(0,0,0,0.8)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_14px_36px_-16px_rgba(59,130,246,0.32)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
          {icon}
        </span>
      </div>
      <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
    </article>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildHighlights(
  billingRows: Array<{ id: string; projectId: string; totalBill: number; deduction: number; additions: number; deletions: number }>,
  commissions: Array<{ billingId: string; employeeId: string; contributionPercent: number }>,
  getCommissionableBill: (row: { totalBill: number; deduction: number; additions: number; deletions: number }) => number,
  projects: Array<{ id: string; status: string }>,
  employees: Array<{ id: string; status: string }>,
) {
  const billingIds = new Set(billingRows.map((item) => item.id));
  const billedProjectIds = new Set(billingRows.map((item) => item.projectId));

  const totalBilling = billingRows.reduce((sum, row) => sum + row.totalBill, 0);
  const deductions = billingRows.reduce((sum, row) => sum + row.deduction, 0);
  const netCommissionable = billingRows.reduce((sum, row) => sum + getCommissionableBill(row), 0);

  const payoutsByBillingId = new Map<string, number>();
  billingRows.forEach((row) => {
    payoutsByBillingId.set(row.id, getCommissionableBill(row));
  });

  let totalPayouts = 0;
  const paidEmployeeIds = new Set<string>();
  commissions.forEach((entry) => {
    if (!billingIds.has(entry.billingId)) return;
    const commissionable = payoutsByBillingId.get(entry.billingId) ?? 0;
    totalPayouts += commissionable * (entry.contributionPercent / 100);
    paidEmployeeIds.add(entry.employeeId);
  });

  const activeProjects = projects.filter((project) => project.status === "Active" && billedProjectIds.has(project.id)).length;
  const activeEmployees = employees.filter((employee) => employee.status === "Active" && paidEmployeeIds.has(employee.id)).length;

  return {
    totalBilling,
    deductions,
    netCommissionable,
    totalPayouts,
    profitRetained: netCommissionable - totalPayouts,
    activeProjects,
    activeEmployees,
  } satisfies Highlights;
}

export default function Dashboard() {
  const { employees, projects, billing, commissions, getCommissionableBill } = useApp();

  const now = new Date();
  const defaultYear = String(now.getFullYear());
  const defaultMonth = String(now.getMonth() + 1).padStart(2, "0");

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedMonthYear, setSelectedMonthYear] = useState(defaultYear);
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [graphView, setGraphView] = useState<GraphView>("department");
  const [isLightMode, setIsLightMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem("commissionhub-theme");
    if (stored === "light") return true;
    if (stored === "dark") return false;
    return window.matchMedia("(prefers-color-scheme: light)").matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", isLightMode);
    window.localStorage.setItem("commissionhub-theme", isLightMode ? "light" : "dark");
  }, [isLightMode]);

  const availableYears = useMemo(() => {
    const years = new Set<string>([defaultYear]);
    billing.forEach((entry) => years.add(entry.month.slice(0, 4)));
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [billing, defaultYear]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    billing.forEach((entry) => {
      const [year, month] = entry.month.split("-");
      if (year === selectedMonthYear && month) months.add(month);
    });
    if (months.size === 0 && selectedMonthYear === defaultYear) {
      months.add(defaultMonth);
    }
    return Array.from(months).sort((a, b) => Number(b) - Number(a));
  }, [billing, selectedMonthYear, defaultYear, defaultMonth]);

  useEffect(() => {
    if (availableMonths.includes(selectedMonth)) return;
    setSelectedMonth(availableMonths[0] ?? defaultMonth);
  }, [availableMonths, selectedMonth, defaultMonth]);

  const formatMonthLabel = (monthValue: string) => {
    const monthIndex = Number(monthValue) - 1;
    if (Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return monthValue;
    return new Date(Number(selectedMonthYear), monthIndex, 1).toLocaleString("en-US", { month: "long" });
  };

  const selectedMonthKey = `${selectedMonthYear}-${selectedMonth}`;

  const monthlyBilling = useMemo(
    () => billing.filter((entry) => entry.month === selectedMonthKey),
    [billing, selectedMonthKey],
  );

  const yearlyBilling = useMemo(
    () => billing.filter((entry) => entry.month.startsWith(`${selectedYear}-`)),
    [billing, selectedYear],
  );

  const monthlyHighlights = useMemo(
    () =>
      buildHighlights(
        monthlyBilling,
        commissions,
        getCommissionableBill,
        projects,
        employees,
      ),
    [monthlyBilling, commissions, getCommissionableBill, projects, employees],
  );

  const yearlyHighlights = useMemo(
    () =>
      buildHighlights(
        yearlyBilling,
        commissions,
        getCommissionableBill,
        projects,
        employees,
      ),
    [yearlyBilling, commissions, getCommissionableBill, projects, employees],
  );

  const monthlyCards = [
    { label: "Total Billing", value: formatCurrency(monthlyHighlights.totalBilling), subtext: "Gross billed this month", icon: <DollarSign className="h-4 w-4" /> },
    { label: "Deductions", value: formatCurrency(monthlyHighlights.deductions), subtext: "Fees and platform costs", icon: <TrendingDown className="h-4 w-4" /> },
    { label: "Net Commissionable", value: formatCurrency(monthlyHighlights.netCommissionable), subtext: "After deductions", icon: <Wallet className="h-4 w-4" /> },
    { label: "Total Payouts", value: formatCurrency(monthlyHighlights.totalPayouts), subtext: "Commission paid", icon: <PiggyBank className="h-4 w-4" /> },
    { label: "Profit Retained", value: formatCurrency(monthlyHighlights.profitRetained), subtext: "Net after payouts", icon: <TrendingUp className="h-4 w-4" /> },
    { label: "Active Projects", value: String(monthlyHighlights.activeProjects), subtext: "Projects with billed activity", icon: <BriefcaseBusiness className="h-4 w-4" /> },
    { label: "Active Employees", value: String(monthlyHighlights.activeEmployees), subtext: "Contributors paid this month", icon: <Users className="h-4 w-4" /> },
  ];

  const yearlyCards = [
    { label: "Total Billing", value: formatCurrency(yearlyHighlights.totalBilling), subtext: "Gross billed this year", icon: <DollarSign className="h-4 w-4" /> },
    { label: "Deductions", value: formatCurrency(yearlyHighlights.deductions), subtext: "Fees and platform costs", icon: <TrendingDown className="h-4 w-4" /> },
    { label: "Net Commissionable", value: formatCurrency(yearlyHighlights.netCommissionable), subtext: "After deductions", icon: <Wallet className="h-4 w-4" /> },
    { label: "Total Payouts", value: formatCurrency(yearlyHighlights.totalPayouts), subtext: "Commission paid", icon: <PiggyBank className="h-4 w-4" /> },
    { label: "Profit Retained", value: formatCurrency(yearlyHighlights.profitRetained), subtext: "Net after payouts", icon: <TrendingUp className="h-4 w-4" /> },
    { label: "Active Projects", value: String(yearlyHighlights.activeProjects), subtext: "Projects with billed activity", icon: <BriefcaseBusiness className="h-4 w-4" /> },
    { label: "Active Employees", value: String(yearlyHighlights.activeEmployees), subtext: "Contributors paid this year", icon: <Users className="h-4 w-4" /> },
  ];

  const graphButtons: Array<{ key: GraphView; label: string }> = [
    { key: "department", label: "Department Wise" },
    { key: "employee", label: "Employee Wise" },
    { key: "project", label: "Project Wise" },
  ];

  const activeGraphTitle =
    graphView === "department"
      ? "Department-wise Commission Distribution"
      : graphView === "employee"
        ? "Employee-wise Commission Leaders"
        : "Project-wise Revenue Overview";

  const activeGraphSubtext =
    graphView === "department"
      ? "Compare payout distribution across departments."
      : graphView === "employee"
        ? "Identify top contributors by total earned commission."
        : "Track billed vs commissionable revenue by project.";

  const payouts = useMemo(() => {
    const map = new Map<string, number>();
    commissions.forEach((entry) => {
      const bill = billing.find((row) => row.id === entry.billingId);
      if (!bill) return;
      const amount = getCommissionableBill(bill) * (entry.contributionPercent / 100);
      map.set(entry.employeeId, (map.get(entry.employeeId) ?? 0) + amount);
    });
    return map;
  }, [commissions, billing, getCommissionableBill]);

  const topEmployees = useMemo(() => {
    return employees
      .map((employee) => ({
        name: employee.name,
        department: employee.department,
        amount: payouts.get(employee.id) ?? 0,
      }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [employees, payouts]);

  const topByDepartment = useMemo(() => {
    const deptMap = new Map<string, PerformerRowData>();

    employees.forEach((employee) => {
      const amount = payouts.get(employee.id) ?? 0;
      if (amount <= 0) return;

      const existing = deptMap.get(employee.department);
      if (!existing || amount > existing.amount) {
        deptMap.set(employee.department, {
          name: employee.name,
          department: employee.department,
          amount,
        });
      }
    });

    return Array.from(deptMap.values()).sort((a, b) => b.amount - a.amount).slice(0, 10);
  }, [employees, payouts]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Focused performance highlights across monthly and yearly cycles.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => setIsLightMode((prev) => !prev)}
          aria-label={isLightMode ? "Switch to dark mode" : "Switch to light mode"}
        >
          {isLightMode ? <MoonStar className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
          {isLightMode ? "Dark Mode" : "Light Mode"}
        </Button>
      </header>

      <section className="rounded-2xl border border-border/60 bg-card/70 p-5 backdrop-blur-xl">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Monthly Highlights</h2>
            <p className="text-sm text-muted-foreground">Period-level financial view with commission and profitability context.</p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[420px]">
            <label className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Month</span>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  className="h-10 w-full appearance-none rounded-md border border-border/70 bg-background pl-10 pr-8 text-sm text-foreground outline-none ring-offset-background transition focus:border-primary/70 focus:ring-2 focus:ring-primary/25"
                >
                  {availableMonths.map((month) => (
                    <option key={month} value={month}>{formatMonthLabel(month)}</option>
                  ))}
                </select>
              </div>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Year</span>
              <select
                value={selectedMonthYear}
                onChange={(event) => setSelectedMonthYear(event.target.value)}
                className="h-10 w-full appearance-none rounded-md border border-border/70 bg-background px-3 text-sm text-foreground outline-none ring-offset-background transition focus:border-primary/70 focus:ring-2 focus:ring-primary/25"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {monthlyCards.map((card) => (
            <MetricCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/70 p-5 backdrop-blur-xl">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Yearly Highlights</h2>
            <p className="text-sm text-muted-foreground">Aggregate annual trend view for planning and payout strategy.</p>
          </div>

          <label className="w-full space-y-1.5 lg:w-[220px]">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Year</span>
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              className="h-10 w-full appearance-none rounded-md border border-border/70 bg-background px-3 text-sm text-foreground outline-none ring-offset-background transition focus:border-primary/70 focus:ring-2 focus:ring-primary/25"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {yearlyCards.map((card) => (
            <MetricCard key={`yearly-${card.label}`} {...card} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/70 p-5 backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-foreground">Best of the Best</h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-border/60 bg-gradient-to-b from-muted/30 to-card p-4 shadow-[0_12px_36px_-20px_rgba(0,0,0,0.85)]">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Top 10 Employees</h3>
                <p className="text-xs text-muted-foreground">Highest total commission earners</p>
              </div>
            </div>

            <div className="space-y-2">
              {topEmployees.length > 0 ? (
                topEmployees.map((item, index) => (
                  <PerformerRow key={`${item.name}-${item.department}`} item={item} index={index} highlight="gold" />
                ))
              ) : (
                <p className="rounded-lg border border-border/50 bg-background/40 px-3 py-4 text-sm text-muted-foreground">
                  No commission payouts found in database records yet.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-border/60 bg-gradient-to-b from-muted/30 to-card p-4 shadow-[0_12px_36px_-20px_rgba(0,0,0,0.85)]">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Top Performers by Department</h3>
                <p className="text-xs text-muted-foreground">Leading contributor in each department</p>
              </div>
            </div>

            <div className="space-y-2">
              {topByDepartment.length > 0 ? (
                topByDepartment.map((item, index) => (
                  <PerformerRow key={`${item.department}-${item.name}`} item={item} index={index} highlight="green" showTrend />
                ))
              ) : (
                <p className="rounded-lg border border-border/50 bg-background/40 px-3 py-4 text-sm text-muted-foreground">
                  No department performance data available from database yet.
                </p>
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/70 p-5 backdrop-blur-xl">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Insights Graph</h2>
            <p className="text-sm text-muted-foreground">{activeGraphSubtext}</p>
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-auto">
            {graphButtons.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setGraphView(item.key)}
                className={`h-10 rounded-md border px-4 text-sm font-medium transition ${
                  graphView === item.key
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border/70 bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/40 bg-background/40 p-2">
          <div className="px-3 pt-2">
            <p className="text-sm font-medium text-foreground">{activeGraphTitle}</p>
          </div>
          {graphView === "department" && <DepartmentCommissionChart />}
          {graphView === "employee" && <TopEarnersChart />}
          {graphView === "project" && <ProjectRevenueChart />}
        </div>
      </section>
    </div>
  );
}
