import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pause, Play, Trash2, RotateCcw, Search, Eye, EyeOff, Pencil } from "lucide-react";
import { toast } from "sonner";
import { COMMISSION_DEPARTMENTS } from "@/lib/constants";

export default function Employees() {
  const { employees, runEmployeeLifecycleAction, hardDeleteEmployee, addEmployee, updateEmployee, isAdmin, currentUser } = useApp();
  const formatPkr = (amount: number) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      maximumFractionDigits: 0,
    }).format(amount);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    department: "",
    additionalDepartments: [] as string[],
    managers: "",
    designation: "",
    salary: "",
    bankName: "",
    bankAccountNumber: "",
  });
  const [errors, setErrors] = useState<{ name?: string; email?: string; phoneNumber?: string; department?: string; bankName?: string; bankAccountNumber?: string }>({});

  const filtered = employees.filter((e) => {
    if (!showInactive && e.status !== "Active") return false;
    const query = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(query) ||
      e.email.toLowerCase().includes(query) ||
      e.phoneNumber.toLowerCase().includes(query) ||
      e.department.toLowerCase().includes(query) ||
      e.bank.toLowerCase().includes(query) ||
      (e.bankAccountNumber ?? "").toLowerCase().includes(query)
    );
  });

  const validateForm = () => {
    const nextErrors: { name?: string; email?: string; phoneNumber?: string; department?: string; bankName?: string; bankAccountNumber?: string } = {};
    if (!form.name.trim()) nextErrors.name = "Full name is required";
    const emailValue = form.email.trim();
    if (!emailValue) {
      nextErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      nextErrors.email = "Enter a valid email address";
    }
    if (!form.phoneNumber.trim()) {
      nextErrors.phoneNumber = "Phone number is required";
    } else if (!/^\d+$/.test(form.phoneNumber.trim())) {
      nextErrors.phoneNumber = "Phone number must contain only digits";
    } else if (form.phoneNumber.trim().length > 11) {
      nextErrors.phoneNumber = "Phone number must be at most 11 digits";
    } else if (form.phoneNumber.trim().length < 7) {
      nextErrors.phoneNumber = "Phone number must be at least 7 digits";
    }
    if (!form.department) nextErrors.department = "Department is required";
    if (!form.bankName.trim()) nextErrors.bankName = "Bank name is required";
    if (!form.bankAccountNumber.trim()) {
      nextErrors.bankAccountNumber = "Bank account number is required";
    } else if (form.bankAccountNumber.trim().length < 6) {
      nextErrors.bankAccountNumber = "Account number must be at least 6 characters";
    } else if (form.bankAccountNumber.trim().length > 16) {
      nextErrors.bankAccountNumber = "Account number must be at most 16 characters";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resetForm = () => {
    setForm({ name: "", email: "", phoneNumber: "", department: "", additionalDepartments: [], managers: "", designation: "", salary: "", bankName: "", bankAccountNumber: "" });
    setErrors({});
    setEditingEmployeeId(null);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!validateForm()) {
      toast.error("Please complete required employee details");
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phoneNumber: form.phoneNumber.trim(),
      department: form.department,
      departments: [form.department, ...form.additionalDepartments.filter((item) => item !== form.department)],
      managers: form.managers
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      designation: form.designation.trim(),
      salary: Number(form.salary) || 0,
      bank: form.bankName.trim(),
      bankAccountNumber: form.bankAccountNumber.trim(),
    };

    try {
      setIsSubmitting(true);
      if (editingEmployeeId) {
        await updateEmployee(editingEmployeeId, payload);
        toast.success("Employee updated");
      } else {
        await addEmployee(payload);
        toast.success("Employee added");
      }

      resetForm();
      setDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save employee changes";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (employeeId: string) => {
    const employee = employees.find((row) => row.id === employeeId);
    if (!employee) return;
    setEditingEmployeeId(employee.id);
    setForm({
      name: employee.name,
      email: employee.email,
      phoneNumber: employee.phoneNumber,
      department: employee.departments[0] ?? employee.department,
      additionalDepartments: employee.departments.slice(1),
      managers: (employee.managers ?? []).join(", "),
      designation: employee.designation,
      salary: String(employee.salary ?? ""),
      bankName: employee.bank,
      bankAccountNumber: employee.bankAccountNumber ?? "",
    });
    setErrors({});
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground mt-1">{employees.filter((e) => e.status === "Active").length} active of {employees.length} total</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              onClick={() => {
                setEditingEmployeeId(null);
                resetForm();
              }}
            >
              <Plus className="mr-2 h-4 w-4" />Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl border-border/70 bg-card/95">
            <DialogHeader><DialogTitle>{editingEmployeeId ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit();
              }}
              className="space-y-5"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="employee-name">Full Name *</Label>
                  <Input
                    id="employee-name"
                    placeholder="Enter full name"
                    value={form.name}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, name: event.target.value }));
                      if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    aria-invalid={Boolean(errors.name)}
                    className={`h-11 ${errors.name ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employee-email">Email *</Label>
                  <Input
                    id="employee-email"
                    type="email"
                    placeholder="employee@company.com"
                    value={form.email}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, email: event.target.value }));
                      if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    aria-invalid={Boolean(errors.email)}
                    className={`h-11 ${errors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="employee-phone">Phone Number *</Label>
                  <Input
                    id="employee-phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    pattern="[0-9]*"
                    placeholder="03XXXXXXXXX"
                    value={form.phoneNumber}
                    onChange={(event) => {
                      const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, 11);
                      setForm((prev) => ({ ...prev, phoneNumber: digitsOnly }));
                      if (errors.phoneNumber) setErrors((prev) => ({ ...prev, phoneNumber: undefined }));
                    }}
                    aria-invalid={Boolean(errors.phoneNumber)}
                    className={`h-11 ${errors.phoneNumber ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {errors.phoneNumber && <p className="text-xs text-destructive">{errors.phoneNumber}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employee-department">Department *</Label>
                  <select
                    id="employee-department"
                    value={form.department}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, department: event.target.value }));
                      if (errors.department) setErrors((prev) => ({ ...prev, department: undefined }));
                    }}
                    required
                    aria-invalid={Boolean(errors.department)}
                    className={`h-11 w-full rounded-md border bg-background px-3 text-sm text-foreground shadow-sm transition-all duration-200 hover:border-primary/35 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/70 ${
                      errors.department ? "border-destructive focus:ring-destructive/30 focus:border-destructive" : "border-input"
                    }`}
                  >
                    <option value="" disabled>Select department</option>
                    {COMMISSION_DEPARTMENTS.map((department) => (
                      <option key={department} value={department}>{department}</option>
                    ))}
                  </select>
                  {errors.department && <p className="text-xs text-destructive">{errors.department}</p>}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="employee-additional-departments">Additional Departments</Label>
                  <select
                    id="employee-additional-departments"
                    multiple
                    value={form.additionalDepartments}
                    onChange={(event) => {
                      const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
                      setForm((prev) => ({ ...prev, additionalDepartments: selected }));
                    }}
                    className="h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-all duration-200 hover:border-primary/35 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/70"
                  >
                    {COMMISSION_DEPARTMENTS.filter((department) => department !== form.department).map((department) => (
                      <option key={department} value={department}>{department}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">Use Ctrl/Cmd to select multiple departments.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employee-managers">Reporting Managers</Label>
                  <Input
                    id="employee-managers"
                    placeholder="Manager 1, Manager 2"
                    value={form.managers}
                    onChange={(event) => setForm((prev) => ({ ...prev, managers: event.target.value }))}
                    className="h-11"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="employee-designation">Office Designation</Label>
                  <Input
                    id="employee-designation"
                    placeholder="Enter office designation"
                    value={form.designation}
                    onChange={(event) => setForm((prev) => ({ ...prev, designation: event.target.value }))}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employee-salary">Basic Salary (PKR)</Label>
                  <Input
                    id="employee-salary"
                    placeholder="Enter basic salary in PKR"
                    type="number"
                    value={form.salary}
                    onChange={(event) => setForm((prev) => ({ ...prev, salary: event.target.value }))}
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="space-y-2">
                  <Label htmlFor="employee-bank-name">Bank Name *</Label>
                  <Input
                    id="employee-bank-name"
                    placeholder="Enter bank name"
                    value={form.bankName}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, bankName: event.target.value }));
                      if (errors.bankName) setErrors((prev) => ({ ...prev, bankName: undefined }));
                    }}
                    aria-invalid={Boolean(errors.bankName)}
                    className={`h-11 ${errors.bankName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {errors.bankName && <p className="text-xs text-destructive">{errors.bankName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employee-bank-account-number">Bank Account Number *</Label>
                  <Input
                    id="employee-bank-account-number"
                    type="text"
                    inputMode="numeric"
                    maxLength={16}
                    placeholder="Enter account number"
                    value={form.bankAccountNumber}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, bankAccountNumber: event.target.value.slice(0, 16) }));
                      if (errors.bankAccountNumber) setErrors((prev) => ({ ...prev, bankAccountNumber: undefined }));
                    }}
                    aria-invalid={Boolean(errors.bankAccountNumber)}
                    className={`h-11 ${errors.bankAccountNumber ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {errors.bankAccountNumber ? (
                    <p className="text-xs text-destructive">{errors.bankAccountNumber}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Use 6 to 16 characters for account identification.</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="min-w-36" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : editingEmployeeId ? "Update Employee" : "Add Employee"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search employees..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowInactive(!showInactive)}>
          {showInactive ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
          {showInactive ? "Hide" : "Show"} Inactive
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[1350px]">
          <thead>
            <tr className="border-b border-border/50">
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Name</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Email</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Phone</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Office Designation</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Bank Name</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Bank Account #</th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Basic Salary</th>
              <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Status</th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {filtered.map((emp) => (
              <tr key={emp.id} className="transition-colors hover:bg-accent/30">
                <td className="px-5 py-3 text-sm">
                  <div className="font-medium text-foreground whitespace-nowrap">{emp.name}</div>
                  <div className="mt-1 text-xs text-gray-400 whitespace-nowrap">{emp.departments.join(", ")}</div>
                </td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{emp.email || "-"}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground mono-nums whitespace-nowrap">{emp.phoneNumber || "-"}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{emp.designation}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground whitespace-nowrap">{emp.bank}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground mono-nums whitespace-nowrap">{emp.bankAccountNumber || "-"}</td>
                <td className="px-5 py-3 text-sm text-right mono-nums whitespace-nowrap">{formatPkr(emp.salary)}</td>
                <td className="px-5 py-3 text-center"><StatusBadge status={emp.status} /></td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-primary hover:text-primary"
                      onClick={() => handleEdit(emp.id)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {emp.status === "Active" && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-warning hover:text-warning" onClick={async () => {
                          const reason = window.prompt("Pause reason (optional)", "");
                          try {
                            await runEmployeeLifecycleAction("pause", emp.id, reason ?? undefined, currentUser?.id);
                            toast.info(`${emp.name} paused`);
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Failed to pause employee");
                          }
                        }}>
                          <Pause className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={async () => {
                          const reason = window.prompt("Delete reason (optional)", "");
                          try {
                            await runEmployeeLifecycleAction("soft-delete", emp.id, reason ?? undefined, currentUser?.id);
                            toast.info(`${emp.name} deleted`);
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Failed to delete employee");
                          }
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {(emp.status === "Paused" || emp.status === "On Leave") && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-success hover:text-success" onClick={async () => {
                          const reason = window.prompt("Unpause reason (optional)", "");
                          try {
                            await runEmployeeLifecycleAction("unpause", emp.id, reason ?? undefined, currentUser?.id);
                            toast.success(`${emp.name} reactivated`);
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Failed to reactivate employee");
                          }
                        }}>
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={async () => {
                          const reason = window.prompt("Delete reason (optional)", "");
                          try {
                            await runEmployeeLifecycleAction("soft-delete", emp.id, reason ?? undefined, currentUser?.id);
                            toast.info(`${emp.name} deleted`);
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Failed to delete employee");
                          }
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {emp.status === "Deleted" && isAdmin && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary" onClick={async () => {
                          const reason = window.prompt("Restore reason (optional)", "");
                          try {
                            await runEmployeeLifecycleAction("restore", emp.id, reason ?? undefined, currentUser?.id);
                            toast.success(`${emp.name} restored`);
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Failed to restore employee");
                          }
                        }}>
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={async () => {
                            const confirmed = window.confirm(`Hard delete ${emp.name}? This cannot be undone.`);
                            if (!confirmed) return;
                            const reason = window.prompt("Hard delete reason", "");
                            const ok = await hardDeleteEmployee(emp.id, true, isAdmin, currentUser?.id, reason ?? undefined);
                            if (ok) toast.error(`${emp.name} permanently removed`);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No employees found</div>
        )}
      </div>
    </div>
  );
}
