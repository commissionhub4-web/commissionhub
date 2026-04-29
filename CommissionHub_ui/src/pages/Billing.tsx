import { FormEvent, useRef, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarDays, CircleDollarSign, Pencil, Plus, ReceiptText } from "lucide-react";
import { toast } from "sonner";

const emptyForm = {
  projectId: "",
  billingDate: "",
  month: "",
  totalBill: "",
  deductionPercent: "",
  additions: "",
  deletions: "",
};

type BillingForm = typeof emptyForm;

type FormErrors = {
  projectId?: string;
  month?: string;
  totalBill?: string;
  deductionPercent?: string;
};

export default function Billing() {
  const { billing, projects, activeProjects, getCommissionableBill, addBilling, updateBilling, getAssignableProjectsForMonth } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<BillingForm>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [editingBillingId, setEditingBillingId] = useState<string | null>(null);
  const billingDateInputRef = useRef<HTMLInputElement | null>(null);
  const [filterProject, setFilterProject] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");

  const months = [...new Set(billing.map((b) => b.month))].sort().reverse();
  const assignableProjectsForMonth = form.month ? getAssignableProjectsForMonth(form.month) : activeProjects;
  const selectedProjectInOptions = assignableProjectsForMonth.some((project) => project.id === form.projectId);
  const selectedProject = projects.find((project) => project.id === form.projectId);
  const projectOptions = selectedProjectInOptions || !selectedProject
    ? assignableProjectsForMonth
    : [selectedProject, ...assignableProjectsForMonth];
  const filtered = billing.filter((b) => {
    if (filterProject !== "all" && b.projectId !== filterProject) return false;
    if (filterMonth !== "all" && b.month !== filterMonth) return false;
    return true;
  });

  const parseDecimal = (value: string): number => {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const normalized = trimmed.replace("%", "").replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  };

  const totalBillValue = parseDecimal(form.totalBill);
  const deductionPercentValue = parseDecimal(form.deductionPercent);
  const normalizedDeductionPercent = Math.min(Math.max(deductionPercentValue, 0), 100);
  const deductionValue = Number.isFinite(totalBillValue)
    ? Number(((totalBillValue * normalizedDeductionPercent) / 100).toFixed(2))
    : 0;
  const additionsValue = parseDecimal(form.additions) || 0;
  const deletionsValue = parseDecimal(form.deletions) || 0;
  const commissionablePreview = Math.max(0, totalBillValue - deductionValue + additionsValue - deletionsValue);

  const toMonthValue = (dateValue: string): string => {
    if (!dateValue) return "";
    return dateValue.slice(0, 7);
  };

  const validateForm = (payload: BillingForm): FormErrors => {
    const nextErrors: FormErrors = {};
    if (!payload.projectId) nextErrors.projectId = "Please select a project.";
    if (!payload.billingDate || !payload.month) nextErrors.month = "Please choose a billing date.";
    const parsedTotal = parseDecimal(payload.totalBill);
    const parsedDeductionPercent = parseDecimal(payload.deductionPercent);

    if (!payload.totalBill || !Number.isFinite(parsedTotal) || parsedTotal <= 0) {
      nextErrors.totalBill = "Total bill must be greater than 0.";
    }
    if (
      payload.deductionPercent.trim() !== "" &&
      (!Number.isFinite(parsedDeductionPercent) || parsedDeductionPercent < 0 || parsedDeductionPercent > 100)
    ) {
      nextErrors.deductionPercent = "Enter a valid percentage between 0 and 100.";
    }
    return nextErrors;
  };

  const handleFieldChange = (field: keyof BillingForm, value: string) => {
    setForm((prev) => {
      const nextForm = { ...prev, [field]: value };
      if (submitAttempted) {
        setErrors(validateForm(nextForm));
      }
      return nextForm;
    });
  };

  const handleBillingDateChange = (selectedDate: string) => {
    setForm((prev) => {
      const nextForm = {
        ...prev,
        billingDate: selectedDate,
        month: toMonthValue(selectedDate),
      };
      if (submitAttempted) {
        setErrors(validateForm(nextForm));
      }
      return nextForm;
    });
  };

  const resetBillingForm = () => {
    setForm(emptyForm);
    setErrors({});
    setSubmitAttempted(false);
    setEditingBillingId(null);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    setDialogOpen(nextOpen);
    if (nextOpen && activeProjects.length === 1) {
      setForm((prev) => ({ ...prev, projectId: prev.projectId || activeProjects[0].id }));
      return;
    }
    if (!nextOpen) {
      resetBillingForm();
    }
  };

  const openBillingDatePicker = () => {
    const input = billingDateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitAttempted(true);
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix highlighted fields before submitting.");
      return;
    }

    try {
      const payload = {
        projectId: form.projectId,
        month: form.month,
        totalBill: totalBillValue,
        deduction: deductionValue,
        additions: additionsValue,
        deletions: deletionsValue,
      };

      if (editingBillingId) {
        await updateBilling(editingBillingId, payload);
        toast.success("Billing entry updated");
      } else {
        await addBilling(payload);
        toast.success("Billing entry added");
      }

      resetBillingForm();
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save billing entry");
    }
  };

  const startEdit = (entryId: string) => {
    const entry = billing.find((item) => item.id === entryId);
    if (!entry) return;

    const deductionPercent = entry.totalBill > 0 ? (entry.deduction / entry.totalBill) * 100 : 0;
    setEditingBillingId(entry.id);
    setForm({
      projectId: entry.projectId,
      billingDate: `${entry.month}-01`,
      month: entry.month,
      totalBill: String(entry.totalBill),
      deductionPercent: String(Number(deductionPercent.toFixed(4))),
      additions: String(entry.additions),
      deletions: String(entry.deletions),
    });
    setErrors({});
    setSubmitAttempted(false);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage project billing and deductions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="shadow-sm shadow-primary/25"
              onClick={() => {
                resetBillingForm();
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Billing
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto border-border/70 bg-card/95 p-0 backdrop-blur-xl">
            <DialogHeader className="border-b border-border/60 px-6 py-5 sm:px-7">
              <DialogTitle className="flex items-center gap-2 text-xl text-foreground">
                <ReceiptText className="h-5 w-5 text-primary" />
                {editingBillingId ? "Edit Billing Entry" : "Add Billing Entry"}
              </DialogTitle>
              <DialogDescription>
                Capture billing details for a project month. Required fields are marked.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6 sm:px-7">
              <section className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Billing Details</h3>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="billing-project">Project *</Label>
                    <Select value={form.projectId} onValueChange={(value) => handleFieldChange("projectId", value)}>
                      <SelectTrigger
                        id="billing-project"
                        aria-invalid={Boolean(errors.projectId)}
                        aria-describedby={errors.projectId ? "billing-project-error" : "billing-project-help"}
                        className={`h-11 ${errors.projectId ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      >
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projectOptions.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.projectId ? (
                      <p id="billing-project-error" className="text-xs text-destructive">{errors.projectId}</p>
                    ) : (
                      <p id="billing-project-help" className="text-xs text-muted-foreground">Choose the project this invoice belongs to.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="billing-month">Billing Month *</Label>
                    <Input
                      ref={billingDateInputRef}
                      id="billing-month"
                      type="date"
                      value={form.billingDate}
                      onChange={(event) => handleBillingDateChange(event.target.value)}
                      onFocus={openBillingDatePicker}
                      onClick={openBillingDatePicker}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openBillingDatePicker();
                        }
                      }}
                      aria-invalid={Boolean(errors.month)}
                      aria-describedby={errors.month ? "billing-month-error" : "billing-month-help"}
                      className={`h-11 ${errors.month ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                    {errors.month ? (
                      <p id="billing-month-error" className="text-xs text-destructive">{errors.month}</p>
                    ) : (
                      <p id="billing-month-help" className="text-xs text-muted-foreground">Pick any date from the calendar. We'll save it under month {form.month || "YYYY-MM"}.</p>
                    )}
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Financial Inputs</h3>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="billing-total">Total Bill (USD) *</Label>
                    <Input
                      id="billing-total"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="e.g. 15000"
                      value={form.totalBill}
                      onChange={(event) => handleFieldChange("totalBill", event.target.value)}
                      aria-invalid={Boolean(errors.totalBill)}
                      aria-describedby={errors.totalBill ? "billing-total-error" : "billing-total-help"}
                      className={`h-11 ${errors.totalBill ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                    {errors.totalBill ? (
                      <p id="billing-total-error" className="text-xs text-destructive">{errors.totalBill}</p>
                    ) : (
                      <p id="billing-total-help" className="text-xs text-muted-foreground">Gross invoice amount before deductions and adjustments.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="billing-deduction">Platform Deduction (%)</Label>
                    <Input
                      id="billing-deduction"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      max={100}
                      placeholder="e.g. 3.5"
                      value={form.deductionPercent}
                      onChange={(event) => handleFieldChange("deductionPercent", event.target.value)}
                      aria-invalid={Boolean(errors.deductionPercent)}
                      aria-describedby={errors.deductionPercent ? "billing-deduction-error" : "billing-deduction-help"}
                      className={`h-11 ${errors.deductionPercent ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                    {errors.deductionPercent ? (
                      <p id="billing-deduction-error" className="text-xs text-destructive">{errors.deductionPercent}</p>
                    ) : (
                      <p id="billing-deduction-help" className="text-xs text-muted-foreground">
                        Percentage of total bill charged by platform. Calculated deduction: ${deductionValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4">
                    <Label htmlFor="billing-additions">Positive Adjustments (USD)</Label>
                    <Input
                      id="billing-additions"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="e.g. 200"
                      value={form.additions}
                      onChange={(event) => handleFieldChange("additions", event.target.value)}
                      className="h-11"
                    />
                    <p className="text-xs text-muted-foreground">Use for bonuses, carryovers, or bill corrections (+).</p>
                  </div>

                  <div className="space-y-2 rounded-lg border border-red-500/25 bg-red-500/5 p-4">
                    <Label htmlFor="billing-deletions">Negative Adjustments (USD)</Label>
                    <Input
                      id="billing-deletions"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="e.g. 120"
                      value={form.deletions}
                      onChange={(event) => handleFieldChange("deletions", event.target.value)}
                      className="h-11"
                    />
                    <p className="text-xs text-muted-foreground">Use for penalties, refunds, or reversal amounts (-).</p>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-background/80 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Commissionable Preview</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground mono-nums">
                    ${commissionablePreview.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Formula: Total Bill - (Total Bill × Platform Deduction %) + Positive Adjustments - Negative Adjustments
                  </p>
                </div>
              </section>

              <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="min-w-44 shadow-sm shadow-primary/25">
                  {editingBillingId ? "Update Billing Entry" : "Save Billing Entry"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Months" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Project</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Month</th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Bill</th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Deduction</th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Add/Del</th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Commissionable</th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {filtered.map((b) => {
              const proj = projects.find((p) => p.id === b.projectId);
              const comm = getCommissionableBill(b);
              return (
                <tr key={b.id} className="transition-colors hover:bg-accent/30">
                  <td className="px-5 py-3 text-sm font-medium">{proj?.name ?? b.projectId}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{b.month}</td>
                  <td className="px-5 py-3 text-sm text-right mono-nums">${b.totalBill.toLocaleString()}</td>
                  <td className="px-5 py-3 text-sm text-right mono-nums text-destructive">-${b.deduction.toLocaleString()}</td>
                  <td className="px-5 py-3 text-sm text-right mono-nums">
                    {b.additions > 0 && <span className="text-success">+${b.additions}</span>}
                    {b.deletions > 0 && <span className="text-destructive ml-1">-${b.deletions}</span>}
                    {b.additions === 0 && b.deletions === 0 && <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-5 py-3 text-sm text-right mono-nums font-semibold text-success">${comm.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => startEdit(b.id)}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No billing entries found</div>}
      </div>
    </div>
  );
}
