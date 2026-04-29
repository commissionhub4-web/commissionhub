import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Calculator } from "lucide-react";
import { toast } from "sonner";
import { COMMISSION_DEPARTMENTS } from "@/lib/constants";

export default function Commissions() {
  const { commissions, billing, employees, projects, getCommissionableBill, addCommission, getAssignableEmployeesForMonth, getAssignableProjectsForMonth } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selProject, setSelProject] = useState("");
  const [selMonth, setSelMonth] = useState("");
  const [form, setForm] = useState({ employeeId: "", department: "", contributionPercent: "" });

  const months = [...new Set(billing.map((b) => b.month))].sort().reverse();
  const assignableEmployees = selMonth ? getAssignableEmployeesForMonth(selMonth) : [];
  const assignableProjects = selMonth ? getAssignableProjectsForMonth(selMonth) : projects.filter((project) => project.status === "Active");

  // Get billing for selected project + month
  const selectedBilling = billing.find((b) => b.projectId === selProject && b.month === selMonth);
  const commBill = selectedBilling ? getCommissionableBill(selectedBilling) : 0;

  // Get commissions for this billing
  const billingCommissions = selectedBilling
    ? commissions.filter((c) => c.billingId === selectedBilling.id)
    : [];

  const totalContribution = billingCommissions.reduce((s, c) => s + c.contributionPercent, 0);

  const handleAdd = async () => {
    if (!selectedBilling || !form.employeeId || !form.department || !form.contributionPercent) {
      return toast.error("All fields are required");
    }
    const pct = Number(form.contributionPercent);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return toast.error("Contribution % must be between 0 and 100");
    if (totalContribution + pct > 100) return toast.error("Total contribution exceeds 100%");
    const ok = await addCommission({
      billingId: selectedBilling.id,
      employeeId: form.employeeId,
      department: form.department,
      projectRole: form.department,
      contributionPercent: pct,
    });
    if (!ok) return toast.error("Employee or project is not eligible for the selected month");
    setForm({ employeeId: "", department: "", contributionPercent: "" });
    setDialogOpen(false);
    toast.success("Commission entry added");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Commission Calculator</h1>
        <p className="text-sm text-muted-foreground mt-1">Select a project and month to manage commissions</p>
      </div>

      <div className="flex gap-3">
        <Select value={selProject} onValueChange={setSelProject}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Select Project" /></SelectTrigger>
          <SelectContent>{assignableProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={selMonth} onValueChange={setSelMonth}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Select Month" /></SelectTrigger>
          <SelectContent>{months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {selectedBilling && (
        <>
          {/* Billing summary card */}
          <div className="glass-card p-5 animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Billing Summary — {projects.find((p) => p.id === selProject)?.name} · {selMonth}</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div><p className="text-xs text-muted-foreground">Total Bill</p><p className="mono-nums font-semibold">${selectedBilling.totalBill.toLocaleString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Deduction</p><p className="mono-nums font-semibold text-destructive">-${selectedBilling.deduction.toLocaleString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Additions</p><p className="mono-nums font-semibold text-success">+${selectedBilling.additions.toLocaleString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Deletions</p><p className="mono-nums font-semibold text-destructive">-${selectedBilling.deletions.toLocaleString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Commissionable</p><p className="mono-nums font-bold text-primary text-lg">${commBill.toLocaleString()}</p></div>
            </div>
          </div>

          {/* Commissions table */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Employee Contributions</h3>
              <p className="text-xs text-muted-foreground">Total allocated: {totalContribution}% / 100%</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={totalContribution >= 100}><Plus className="mr-2 h-4 w-4" />Add Entry</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Commission Entry</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Employee</Label>
                    <Select value={form.employeeId} onValueChange={(value) => {
                        setForm((prev) => ({ ...prev, employeeId: value }));
                    }}>
                    <SelectTrigger><SelectValue placeholder="Select Employee" /></SelectTrigger>
                    <SelectContent>{assignableEmployees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                  </Select>
                    </div>

                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select
                      value={form.department}
                      onValueChange={(value) => {
                        setForm((prev) => ({ ...prev, department: value }));
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                      <SelectContent>
                        {COMMISSION_DEPARTMENTS.map((department) => (
                          <SelectItem key={department} value={department}>{department}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Contribution %</Label>
                    <Input
                      placeholder={`Contribution % (max ${100 - totalContribution}%)`}
                      type="number"
                      min={0}
                      max={100}
                      value={form.contributionPercent}
                      onChange={(e) => setForm({ ...form, contributionPercent: e.target.value })}
                    />
                  </div>
                  <Button onClick={handleAdd} className="w-full">Add Entry</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${totalContribution}%` }} />
          </div>

          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Employee</th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Department</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Contribution %</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {billingCommissions.map((c) => {
                  const emp = employees.find((e) => e.id === c.employeeId);
                  const amount = commBill * (c.contributionPercent / 100);
                  return (
                    <tr key={c.id} className="transition-colors hover:bg-accent/30">
                      <td className="px-5 py-3 text-sm font-medium">{emp?.name ?? "Unknown"}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{c.department}</td>
                      <td className="px-5 py-3 text-sm text-right mono-nums">{c.contributionPercent}%</td>
                      <td className="px-5 py-3 text-sm text-right mono-nums font-semibold text-success">${amount.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {billingCommissions.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border">
                    <td colSpan={2} className="px-5 py-3 text-sm font-semibold">Total</td>
                    <td className="px-5 py-3 text-sm text-right mono-nums font-semibold">{totalContribution}%</td>
                    <td className="px-5 py-3 text-sm text-right mono-nums font-bold text-primary">${(commBill * totalContribution / 100).toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
            {billingCommissions.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No commission entries yet</div>}
          </div>
        </>
      )}

      {!selectedBilling && selProject && selMonth && (
        <div className="glass-card py-12 text-center text-sm text-muted-foreground">No billing entry found for this project/month combination</div>
      )}
    </div>
  );
}
