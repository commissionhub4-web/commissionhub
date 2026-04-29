import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Users, FolderKanban, Building2 } from "lucide-react";

export default function Reports() {
  const { employees, projects, billing, commissions, getCommissionableBill } = useApp();
  const [filterMonth, setFilterMonth] = useState("all");

  const downloadCsv = (
    fileName: string,
    rows: Array<Record<string, string | number>>,
    summary?: Record<string, string | number>,
  ) => {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const summaryHeaders = summary ? Object.keys(summary) : [];
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = row[header] ?? "";
            return `"${String(value).replace(/"/g, '""')}"`;
          })
          .join(","),
      ),
      ...(summary
        ? [
            "",
            summaryHeaders.join(","),
            summaryHeaders
              .map((header) => `"${String(summary[header] ?? "").replace(/"/g, '""')}"`)
              .join(","),
          ]
        : []),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const months = [...new Set(billing.map((b) => b.month))].sort().reverse();
  const filteredBilling = filterMonth === "all" ? billing : billing.filter((b) => b.month === filterMonth);
  const filteredCommissions = commissions.filter((c) => filteredBilling.some((b) => b.id === c.billingId));
  const roundMoney = (value: number) => Number(value.toFixed(2));

  const employeeReport = employees
    .map((emp) => {
      const empComms = filteredCommissions.filter((c) => c.employeeId === emp.id);
      const details = empComms.map((c) => {
        const b = filteredBilling.find((bi) => bi.id === c.billingId)!;
        const proj = projects.find((p) => p.id === b.projectId);
        const commissionableBill = getCommissionableBill(b);
        return {
          project: proj?.name ?? "Unknown",
          department: c.department,
          projectRole: c.projectRole,
          percent: c.contributionPercent,
          month: b.month,
          commissionableBill,
          commission: commissionableBill * (c.contributionPercent / 100),
        };
      });
      const total = details.reduce((sum, d) => sum + d.commission, 0);
      return { ...emp, details, total };
    })
    .filter((row) => row.details.length > 0)
    .sort((a, b) => b.total - a.total);

  const projectReport = projects
    .map((proj) => {
      const projBilling = filteredBilling.filter((b) => b.projectId === proj.id);
      const entries = projBilling.flatMap((b) => {
        const comms = filteredCommissions.filter((c) => c.billingId === b.id);
        return comms.map((c) => {
          const emp = employees.find((e) => e.id === c.employeeId);
          return {
            employee: emp?.name ?? "Unknown",
            department: c.department,
            projectRole: c.projectRole,
            percent: c.contributionPercent,
            month: b.month,
            commission: getCommissionableBill(b) * (c.contributionPercent / 100),
          };
        });
      });
      const totalCommissionable = projBilling.reduce((sum, b) => sum + getCommissionableBill(b), 0);
      const totalPaid = entries.reduce((sum, e) => sum + e.commission, 0);
      return { ...proj, entries, totalCommissionable, totalPaid };
    })
    .filter((row) => row.entries.length > 0);

  const deptMap = new Map<string, { employees: Set<string>; projects: Set<string>; total: number; entries: { employee: string; project: string; commission: number }[] }>();
  filteredCommissions.forEach((c) => {
    const b = filteredBilling.find((bi) => bi.id === c.billingId);
    if (!b) return;
    const emp = employees.find((e) => e.id === c.employeeId);
    const proj = projects.find((p) => p.id === b.projectId);
    const commission = getCommissionableBill(b) * (c.contributionPercent / 100);
    if (!deptMap.has(c.department)) {
      deptMap.set(c.department, { employees: new Set(), projects: new Set(), total: 0, entries: [] });
    }
    const dept = deptMap.get(c.department)!;
    dept.employees.add(emp?.name ?? "Unknown");
    dept.projects.add(proj?.name ?? "Unknown");
    dept.total += commission;
    dept.entries.push({ employee: emp?.name ?? "Unknown", project: proj?.name ?? "Unknown", commission });
  });

  const departmentReport = [...deptMap.entries()]
    .map(([department, data]) => ({ department, ...data, employees: [...data.employees], projects: [...data.projects] }))
    .sort((a, b) => b.total - a.total);

  const employeeRows = employeeReport.flatMap((emp) =>
    emp.details.map((d) => ({
      employee: emp.name,
      project: d.project,
      department: d.department,
      projectRole: d.projectRole,
      month: d.month,
      contributionPercent: d.percent,
      commissionableBill: roundMoney(d.commissionableBill),
      commissionEarned: roundMoney(d.commission),
    })),
  );

  const projectRows = projectReport.flatMap((proj) =>
    proj.entries.map((entry) => ({
      project: proj.name,
      month: entry.month,
      employee: entry.employee,
      department: entry.department,
      projectRole: entry.projectRole,
      contributionPercent: entry.percent,
      commissionEarned: roundMoney(entry.commission),
    })),
  );

  const departmentRows = departmentReport.flatMap((dept) =>
    dept.entries.map((entry) => ({
      department: dept.department,
      employee: entry.employee,
      project: entry.project,
      commissionEarned: roundMoney(entry.commission),
    })),
  );

  const allCommissionRows = filteredCommissions
    .map((entry) => {
      const bill = filteredBilling.find((item) => item.id === entry.billingId);
      if (!bill) return null;
      const employee = employees.find((item) => item.id === entry.employeeId);
      const project = projects.find((item) => item.id === bill.projectId);
      const commissionableAmount = getCommissionableBill(bill);
      const commissionAmount = commissionableAmount * (entry.contributionPercent / 100);
      return {
        month: bill.month,
        project: project?.name ?? "Unknown",
        employee: employee?.name ?? "Unknown",
        department: entry.department,
        projectRole: entry.projectRole,
        contributionPercent: entry.contributionPercent,
        commissionableAmount: roundMoney(commissionableAmount),
        commissionAmount: roundMoney(commissionAmount),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const totalCommissionableAmount = roundMoney(filteredBilling.reduce((sum, item) => sum + getCommissionableBill(item), 0));
  const totalCommissionPaid = roundMoney(allCommissionRows.reduce((sum, item) => sum + item.commissionAmount, 0));
  const summaryBase = {
    period: filterMonth === "all" ? "All Months" : filterMonth,
    totalProjects: new Set(filteredBilling.map((item) => item.projectId)).size,
    totalEmployees: new Set(filteredCommissions.map((item) => item.employeeId)).size,
    totalEntries: filteredCommissions.length,
    totalCommissionableAmount,
    totalCommissionPaid,
    remainingAmount: roundMoney(totalCommissionableAmount - totalCommissionPaid),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Commission reports by employee, project, and department</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => downloadCsv(`employee-report-${filterMonth}.csv`, employeeRows, summaryBase)}>Employee CSV</Button>
          <Button size="sm" variant="outline" onClick={() => downloadCsv(`project-report-${filterMonth}.csv`, projectRows, summaryBase)}>Project CSV</Button>
          <Button size="sm" variant="outline" onClick={() => downloadCsv(`department-report-${filterMonth}.csv`, departmentRows, summaryBase)}>Department CSV</Button>
          <Button size="sm" variant="default" onClick={() => downloadCsv(`all-commission-amounts-${filterMonth}.csv`, allCommissionRows, summaryBase)}>All Amounts CSV</Button>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Months" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="employee">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="employee" className="gap-2"><Users className="h-3.5 w-3.5" />By Employee</TabsTrigger>
          <TabsTrigger value="project" className="gap-2"><FolderKanban className="h-3.5 w-3.5" />By Project</TabsTrigger>
          <TabsTrigger value="department" className="gap-2"><Building2 className="h-3.5 w-3.5" />By Department</TabsTrigger>
        </TabsList>

        <TabsContent value="employee" className="space-y-4 mt-4">
          {employeeReport.map((emp) => (
            <div key={emp.id} className="glass-card overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between border-b border-border/50 px-5 py-3">
                <div>
                  <h3 className="font-semibold">{emp.name}</h3>
                  <p className="text-xs text-muted-foreground">{emp.department} · {emp.designation}</p>
                </div>
                <span className="mono-nums text-lg font-bold text-primary">${emp.total.toFixed(2)}</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="px-5 py-2 text-left text-xs text-muted-foreground">Project</th>
                    <th className="px-5 py-2 text-left text-xs text-muted-foreground">Department</th>
                    <th className="px-5 py-2 text-left text-xs text-muted-foreground">Project Role</th>
                    <th className="px-5 py-2 text-left text-xs text-muted-foreground">Month</th>
                    <th className="px-5 py-2 text-right text-xs text-muted-foreground">%</th>
                    <th className="px-5 py-2 text-right text-xs text-muted-foreground">Commissionable Bill</th>
                    <th className="px-5 py-2 text-right text-xs text-muted-foreground">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {emp.details.map((d, i) => (
                    <tr key={i}>
                      <td className="px-5 py-2 text-sm">{d.project}</td>
                      <td className="px-5 py-2 text-sm text-muted-foreground">{d.department}</td>
                      <td className="px-5 py-2 text-sm text-muted-foreground">{d.projectRole}</td>
                      <td className="px-5 py-2 text-sm text-muted-foreground">{d.month}</td>
                      <td className="px-5 py-2 text-sm text-right mono-nums">{d.percent}%</td>
                      <td className="px-5 py-2 text-sm text-right mono-nums">${d.commissionableBill.toFixed(2)}</td>
                      <td className="px-5 py-2 text-sm text-right mono-nums text-success">${d.commission.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {employeeReport.length === 0 && <div className="glass-card py-12 text-center text-sm text-muted-foreground">No data for selected period</div>}
        </TabsContent>

        <TabsContent value="project" className="space-y-4 mt-4">
          {projectReport.map((proj) => (
            <div key={proj.id} className="glass-card overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between border-b border-border/50 px-5 py-3">
                <div>
                  <h3 className="font-semibold">{proj.name}</h3>
                  <p className="text-xs text-muted-foreground">Commissionable: ${proj.totalCommissionable.toLocaleString()}</p>
                </div>
                <span className="mono-nums text-lg font-bold text-primary">${proj.totalPaid.toFixed(2)}</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="px-5 py-2 text-left text-xs text-muted-foreground">Employee</th>
                    <th className="px-5 py-2 text-left text-xs text-muted-foreground">Department</th>
                    <th className="px-5 py-2 text-left text-xs text-muted-foreground">Project Role</th>
                    <th className="px-5 py-2 text-left text-xs text-muted-foreground">Month</th>
                    <th className="px-5 py-2 text-right text-xs text-muted-foreground">%</th>
                    <th className="px-5 py-2 text-right text-xs text-muted-foreground">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {proj.entries.map((entry, i) => (
                    <tr key={i}>
                      <td className="px-5 py-2 text-sm">{entry.employee}</td>
                      <td className="px-5 py-2 text-sm text-muted-foreground">{entry.department}</td>
                      <td className="px-5 py-2 text-sm text-muted-foreground">{entry.projectRole}</td>
                      <td className="px-5 py-2 text-sm text-muted-foreground">{entry.month}</td>
                      <td className="px-5 py-2 text-sm text-right mono-nums">{entry.percent}%</td>
                      <td className="px-5 py-2 text-sm text-right mono-nums text-success">${entry.commission.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {projectReport.length === 0 && <div className="glass-card py-12 text-center text-sm text-muted-foreground">No data</div>}
        </TabsContent>

        <TabsContent value="department" className="space-y-4 mt-4">
          {departmentReport.map((dept) => (
            <div key={dept.department} className="glass-card overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between border-b border-border/50 px-5 py-3">
                <div>
                  <h3 className="font-semibold">{dept.department}</h3>
                  <p className="text-xs text-muted-foreground">{dept.employees.length} employees · {dept.projects.length} projects</p>
                </div>
                <span className="mono-nums text-lg font-bold text-primary">${dept.total.toFixed(2)}</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="px-5 py-2 text-left text-xs text-muted-foreground">Employee</th>
                    <th className="px-5 py-2 text-left text-xs text-muted-foreground">Project</th>
                    <th className="px-5 py-2 text-right text-xs text-muted-foreground">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {dept.entries.map((entry, i) => (
                    <tr key={i}>
                      <td className="px-5 py-2 text-sm">{entry.employee}</td>
                      <td className="px-5 py-2 text-sm text-muted-foreground">{entry.project}</td>
                      <td className="px-5 py-2 text-sm text-right mono-nums text-success">${entry.commission.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {departmentReport.length === 0 && <div className="glass-card py-12 text-center text-sm text-muted-foreground">No data</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
