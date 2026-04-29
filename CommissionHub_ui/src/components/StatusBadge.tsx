import { EmployeeStatus } from "@/hooks/useAppData";

const statusStyles: Record<EmployeeStatus, string> = {
  Active: "bg-success/15 text-success border-success/30",
  Paused: "bg-warning/15 text-warning border-warning/30",
  "On Leave": "bg-warning/15 text-warning border-warning/30",
  Resigned: "bg-muted/30 text-muted-foreground border-border",
  Terminated: "bg-destructive/15 text-destructive border-destructive/30",
  Deleted: "bg-destructive/15 text-destructive border-destructive/30",
};

export function StatusBadge({ status }: { status: EmployeeStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${
        status === "Active"
          ? "bg-success"
          : status === "Paused" || status === "On Leave"
          ? "bg-warning"
          : status === "Resigned"
          ? "bg-muted-foreground"
          : "bg-destructive"
      }`} />
      {status}
    </span>
  );
}
