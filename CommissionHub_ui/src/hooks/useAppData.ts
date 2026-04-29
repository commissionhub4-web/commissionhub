import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export type EmployeeStatus = "Active" | "Paused" | "On Leave" | "Resigned" | "Terminated" | "Deleted";
export type ProjectStatus = "Active" | "Paused" | "Deleted";

export interface AuditLogEntry {
  id: string;
  entityType: "employee" | "project";
  entityId: string;
  action: "pause" | "unpause" | "soft-delete" | "restore" | "hard-delete" | "status-change";
  reason?: string;
  performedBy?: string;
  createdAt: string;
  notes?: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  department: string;
  departments: string[];
  managers?: string[];
  designation: string;
  salary: number;
  status: EmployeeStatus;
  bank: string;
  bankAccountNumber?: string;
  allowances?: number;
  statusChangedAt?: string;
  statusReason?: string;
  pausedAt?: string;
  deletedAt?: string;
  deletedBy?: string;
  auditNotes?: string;
}

export interface Project {
  id: string;
  name: string;
  clientName?: string;
  status: ProjectStatus;
  statusChangedAt?: string;
  statusReason?: string;
  pausedAt?: string;
  deletedAt?: string;
  deletedBy?: string;
  auditNotes?: string;
}

export interface BillingEntry {
  id: string;
  projectId: string;
  month: string; // YYYY-MM
  totalBill: number;
  deduction: number;
  additions: number;
  deletions: number;
}

export interface CommissionEntry {
  id: string;
  billingId: string;
  employeeId: string;
  department: string;
  projectRole: string;
  contributionPercent: number;
}

type ApiEmployee = {
  id: string;
  name: string;
  email?: string | null;
  phone_number?: string | null;
  department: string;
  departments?: string[] | null;
  managers?: string[] | null;
  designation: string;
  salary: number;
  allowances: number;
  bank: string;
  bank_account_number?: string | null;
  status: EmployeeStatus;
  status_changed_at?: string | null;
  status_reason?: string | null;
  paused_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  audit_notes?: string | null;
};

type ApiProject = {
  id: string;
  name: string;
  client_name?: string | null;
  status: ProjectStatus;
  status_changed_at?: string | null;
  status_reason?: string | null;
  paused_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  audit_notes?: string | null;
};

type ApiBilling = {
  id: string;
  project_id: string;
  month: string;
  total_bill: number;
  deduction: number;
  additions: number;
  deletions: number;
};

type ApiCommission = {
  id: string;
  billing_id: string;
  employee_id: string;
  department: string;
  project_role?: string;
  contribution_percent: number;
};

type ApiAudit = {
  id: string;
  entity_type: "employee" | "project";
  entity_id: string;
  action: AuditLogEntry["action"];
  reason?: string | null;
  user_id?: string | null;
  notes?: string | null;
  created_at: string;
};

const mapEmployee = (item: ApiEmployee): Employee => ({
  id: item.id,
  name: item.name,
  email: item.email ?? "",
  phoneNumber: item.phone_number ?? "",
  department: item.department,
  departments: item.departments?.length ? item.departments : [item.department],
  managers: item.managers ?? undefined,
  designation: item.designation,
  salary: Number(item.salary),
  allowances: Number(item.allowances ?? 0),
  bank: item.bank,
  bankAccountNumber: item.bank_account_number ?? undefined,
  status: item.status,
  statusChangedAt: item.status_changed_at ?? undefined,
  statusReason: item.status_reason ?? undefined,
  pausedAt: item.paused_at ?? undefined,
  deletedAt: item.deleted_at ?? undefined,
  deletedBy: item.deleted_by ?? undefined,
  auditNotes: item.audit_notes ?? undefined,
});

const mapProject = (item: ApiProject): Project => ({
  id: item.id,
  name: item.name,
  clientName: item.client_name ?? undefined,
  status: item.status,
  statusChangedAt: item.status_changed_at ?? undefined,
  statusReason: item.status_reason ?? undefined,
  pausedAt: item.paused_at ?? undefined,
  deletedAt: item.deleted_at ?? undefined,
  deletedBy: item.deleted_by ?? undefined,
  auditNotes: item.audit_notes ?? undefined,
});

const mapBilling = (item: ApiBilling): BillingEntry => ({
  id: item.id,
  projectId: item.project_id,
  month: item.month.slice(0, 7),
  totalBill: Number(item.total_bill),
  deduction: Number(item.deduction),
  additions: Number(item.additions),
  deletions: Number(item.deletions),
});

const mapCommission = (item: ApiCommission): CommissionEntry => ({
  id: item.id,
  billingId: item.billing_id,
  employeeId: item.employee_id,
  department: item.department,
  projectRole: item.project_role ?? item.department,
  contributionPercent: Number(item.contribution_percent),
});

const mapAudit = (item: ApiAudit): AuditLogEntry => ({
  id: item.id,
  entityType: item.entity_type,
  entityId: item.entity_id,
  action: item.action,
  reason: item.reason ?? undefined,
  performedBy: item.user_id ?? undefined,
  createdAt: item.created_at,
  notes: item.notes ?? undefined,
});

export function useAppData() {
  const { currentUser, isAdmin } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [billing, setBilling] = useState<BillingEntry[]>([]);
  const [commissions, setCommissions] = useState<CommissionEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const loadEmployees = useCallback(async () => {
    const rows = await apiRequest<ApiEmployee[]>("/employees", { query: { include_inactive: true } });
    setEmployees(rows.map(mapEmployee));
  }, []);

  const loadProjects = useCallback(async () => {
    const rows = await apiRequest<ApiProject[]>("/projects", { query: { include_inactive: true } });
    setProjects(rows.map(mapProject));
  }, []);

  const loadBilling = useCallback(async () => {
    const rows = await apiRequest<ApiBilling[]>("/billing");
    setBilling(rows.map(mapBilling));
  }, []);

  const loadCommissions = useCallback(async () => {
    const rows = await apiRequest<ApiCommission[]>("/commissions");
    setCommissions(rows.map(mapCommission));
  }, []);

  const loadAuditLogs = useCallback(async () => {
    const rows = await apiRequest<ApiAudit[]>("/audit-logs");
    setAuditLogs(rows.map(mapAudit));
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadEmployees(), loadProjects(), loadBilling(), loadCommissions(), loadAuditLogs()]);
  }, [loadEmployees, loadProjects, loadBilling, loadCommissions, loadAuditLogs]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const logAudit = (
    entityType: AuditLogEntry["entityType"],
    entityId: string,
    action: AuditLogEntry["action"],
    reason?: string,
    performedBy?: string,
    notes?: string,
  ) => {
    setAuditLogs((prev) => [
      {
        id: crypto.randomUUID(),
        entityType,
        entityId,
        action,
        reason,
        performedBy,
        notes,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const monthStartDate = (month: string) => new Date(`${month}-01T00:00:00`);

  const isEligibleByStatusDate = (status: EmployeeStatus | ProjectStatus, statusChangedAt: string | undefined, targetMonth: string) => {
    if (status === "Active") return true;
    if (!statusChangedAt) return false;
    return monthStartDate(targetMonth) <= monthStartDate(statusChangedAt.slice(0, 7));
  };

  const isEmployeeEligibleForMonth = (employeeId: string, month: string) => {
    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) return false;
    return isEligibleByStatusDate(employee.status, employee.statusChangedAt, month);
  };

  const isProjectEligibleForMonth = (projectId: string, month: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return false;
    return isEligibleByStatusDate(project.status, project.statusChangedAt, month);
  };

  const getAssignableEmployeesForMonth = (month: string) =>
    employees.filter((employee) => isEmployeeEligibleForMonth(employee.id, month));

  const getAssignableProjectsForMonth = (month: string) =>
    projects.filter((project) => isProjectEligibleForMonth(project.id, month));

  const getCommissionableBill = (b: BillingEntry) =>
    b.totalBill - b.deduction + (b.additions - b.deletions);

  const activeEmployees = useMemo(() => employees.filter((e) => e.status === "Active"), [employees]);
  const activeProjects = useMemo(() => projects.filter((p) => p.status === "Active"), [projects]);

  const resolvePerformedBy = (performedBy?: string) => performedBy ?? currentUser?.id;

  const pauseEmployee = async (id: string, reason?: string, performedBy?: string) => {
    const actor = resolvePerformedBy(performedBy);
    await apiRequest(`/employees/${id}/pause`, {
      method: "POST",
      body: JSON.stringify({ reason, user_id: actor }),
    });
    await Promise.all([loadEmployees(), loadAuditLogs()]);
  };

  const unpauseEmployee = async (id: string, reason?: string, performedBy?: string) => {
    const actor = resolvePerformedBy(performedBy);
    await apiRequest(`/employees/${id}/unpause`, {
      method: "POST",
      body: JSON.stringify({ reason, user_id: actor }),
    });
    await Promise.all([loadEmployees(), loadAuditLogs()]);
  };

  const setEmployeeStatus = async (id: string, status: Exclude<EmployeeStatus, "Deleted">, reason?: string, performedBy?: string) => {
    const actor = resolvePerformedBy(performedBy);
    await apiRequest(`/employees/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status, reason, user_id: actor }),
    });
    await Promise.all([loadEmployees(), loadAuditLogs()]);
  };

  const softDeleteEmployee = async (id: string, reason?: string, performedBy?: string) => {
    const actor = resolvePerformedBy(performedBy);
    await apiRequest(`/employees/${id}/delete`, {
      method: "POST",
      body: JSON.stringify({ reason, user_id: actor }),
    });
    await Promise.all([loadEmployees(), loadAuditLogs()]);
  };

  const restoreEmployee = async (id: string, reason?: string, performedBy?: string) => {
    const actor = resolvePerformedBy(performedBy);
    await apiRequest(`/employees/${id}/restore`, {
      method: "POST",
      body: JSON.stringify({ reason, user_id: actor, is_admin: isAdmin }),
    });
    await Promise.all([loadEmployees(), loadAuditLogs()]);
  };

  const hardDeleteEmployee = async (id: string, confirmed: boolean, isAdmin: boolean, performedBy?: string, reason?: string) => {
    if (!confirmed || !isAdmin) return false;
    const actor = resolvePerformedBy(performedBy);
    await apiRequest(`/employees/${id}/hard-delete`, {
      method: "POST",
      body: JSON.stringify({ confirm: confirmed, is_admin: isAdmin, user_id: actor, reason }),
    });
    await Promise.all([loadEmployees(), loadCommissions(), loadAuditLogs()]);
    return true;
  };

  const addEmployee = async (emp: Omit<Employee, "id" | "status">) => {
    await apiRequest("/employees", {
      method: "POST",
      body: JSON.stringify({
        name: emp.name,
        email: emp.email,
        phone_number: emp.phoneNumber,
        departments: emp.departments,
        managers: emp.managers ?? [],
        designation: emp.designation,
        salary: Number(emp.salary ?? 0),
        allowances: Number(emp.allowances ?? 0),
        bank: emp.bank,
        bank_account_number: emp.bankAccountNumber,
      }),
    });
    await loadEmployees();
  };

  const updateEmployee = async (id: string, emp: Omit<Employee, "id" | "status">) => {
    await apiRequest(`/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: emp.name,
        email: emp.email,
        phone_number: emp.phoneNumber,
        departments: emp.departments,
        managers: emp.managers ?? [],
        designation: emp.designation,
        salary: Number(emp.salary ?? 0),
        allowances: Number(emp.allowances ?? 0),
        bank: emp.bank,
        bank_account_number: emp.bankAccountNumber,
      }),
    });
    await loadEmployees();
  };

  const pauseProject = async (id: string, reason?: string, performedBy?: string) => {
    const actor = resolvePerformedBy(performedBy);
    await apiRequest(`/projects/${id}/pause`, {
      method: "POST",
      body: JSON.stringify({ reason, user_id: actor }),
    });
    await Promise.all([loadProjects(), loadAuditLogs()]);
  };

  const unpauseProject = async (id: string, reason?: string, performedBy?: string) => {
    const actor = resolvePerformedBy(performedBy);
    await apiRequest(`/projects/${id}/unpause`, {
      method: "POST",
      body: JSON.stringify({ reason, user_id: actor }),
    });
    await Promise.all([loadProjects(), loadAuditLogs()]);
  };

  const softDeleteProject = async (id: string, reason?: string, performedBy?: string) => {
    const actor = resolvePerformedBy(performedBy);
    await apiRequest(`/projects/${id}/delete`, {
      method: "POST",
      body: JSON.stringify({ reason, user_id: actor }),
    });
    await Promise.all([loadProjects(), loadAuditLogs()]);
  };

  const restoreProject = async (id: string, reason?: string, performedBy?: string) => {
    const actor = resolvePerformedBy(performedBy);
    await apiRequest(`/projects/${id}/restore`, {
      method: "POST",
      body: JSON.stringify({ reason, user_id: actor, is_admin: isAdmin }),
    });
    await Promise.all([loadProjects(), loadAuditLogs()]);
  };

  const hardDeleteProject = async (id: string, confirmed: boolean, isAdmin: boolean, performedBy?: string, reason?: string) => {
    if (!confirmed || !isAdmin) return false;
    const actor = resolvePerformedBy(performedBy);
    await apiRequest(`/projects/${id}/hard-delete`, {
      method: "POST",
      body: JSON.stringify({ confirm: confirmed, is_admin: isAdmin, user_id: actor, reason }),
    });
    await Promise.all([loadProjects(), loadBilling(), loadCommissions(), loadAuditLogs()]);
    return true;
  };

  const addProject = async (name: string, clientName?: string) => {
    await apiRequest("/projects", {
      method: "POST",
      body: JSON.stringify({
        name,
        client_name: clientName?.trim() || null,
      }),
    });
    await loadProjects();
  };

  const addBilling = async (entry: Omit<BillingEntry, "id">) => {
    await apiRequest("/billing", {
      method: "POST",
      body: JSON.stringify({
        project_id: entry.projectId,
        month: `${entry.month}-01`,
        total_bill: Number(entry.totalBill),
        deduction: Number(entry.deduction),
        additions: Number(entry.additions),
        deletions: Number(entry.deletions),
      }),
    });
    await loadBilling();
  };

  const updateBilling = async (id: string, entry: Omit<BillingEntry, "id">) => {
    await apiRequest(`/billing/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        project_id: entry.projectId,
        month: `${entry.month}-01`,
        total_bill: Number(entry.totalBill),
        deduction: Number(entry.deduction),
        additions: Number(entry.additions),
        deletions: Number(entry.deletions),
      }),
    });
    await loadBilling();
  };

  const addCommission = async (entry: Omit<CommissionEntry, "id">) => {
    try {
      await apiRequest("/commissions", {
        method: "POST",
        body: JSON.stringify({
          billing_id: entry.billingId,
          employee_id: entry.employeeId,
          department: entry.department,
          project_role: entry.projectRole,
          contribution_percent: Number(entry.contributionPercent),
        }),
      });
      await loadCommissions();
      return true;
    } catch {
      return false;
    }
  };

  const runEmployeeLifecycleAction = async (action: "pause" | "unpause" | "soft-delete" | "restore", id: string, reason?: string, performedBy?: string) => {
    if (action === "pause") await pauseEmployee(id, reason, performedBy);
    if (action === "unpause") await unpauseEmployee(id, reason, performedBy);
    if (action === "soft-delete") await softDeleteEmployee(id, reason, performedBy);
    if (action === "restore") await restoreEmployee(id, reason, performedBy);
  };

  const runProjectLifecycleAction = async (action: "pause" | "unpause" | "soft-delete" | "restore", id: string, reason?: string, performedBy?: string) => {
    if (action === "pause") await pauseProject(id, reason, performedBy);
    if (action === "unpause") await unpauseProject(id, reason, performedBy);
    if (action === "soft-delete") await softDeleteProject(id, reason, performedBy);
    if (action === "restore") await restoreProject(id, reason, performedBy);
  };

  return {
    employees, projects, billing, commissions,
    auditLogs,
    activeEmployees, activeProjects,
    currentUser,
    isAdmin,
    getCommissionableBill,
    isEmployeeEligibleForMonth,
    isProjectEligibleForMonth,
    getAssignableEmployeesForMonth,
    getAssignableProjectsForMonth,
    pauseEmployee, unpauseEmployee, softDeleteEmployee, restoreEmployee, hardDeleteEmployee, setEmployeeStatus, addEmployee, updateEmployee,
    pauseProject, unpauseProject, softDeleteProject, restoreProject, hardDeleteProject, addProject,
    runEmployeeLifecycleAction,
    runProjectLifecycleAction,
    addBilling, updateBilling, addCommission,
    logAudit,
    loadAll,
    setEmployees, setProjects, setBilling, setCommissions,
  };
}
