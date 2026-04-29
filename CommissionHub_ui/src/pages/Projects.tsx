import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pause, Play, Trash2, RotateCcw, Search, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function Projects() {
  const { projects, billing, getCommissionableBill, runProjectLifecycleAction, hardDeleteProject, addProject, isAdmin, currentUser } = useApp();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", clientName: "" });
  const [errors, setErrors] = useState<{ name?: string; clientName?: string }>({});

  const filtered = projects.filter((p) => {
    if (!showInactive && p.status !== "Active") return false;
    return p.name.toLowerCase().includes(search.toLowerCase());
  });

  const validate = () => {
    const nextErrors: { name?: string; clientName?: string } = {};
    if (!form.clientName.trim()) nextErrors.clientName = "Client name is required";
    if (!form.name.trim()) nextErrors.name = "Project name is required";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleAdd = async () => {
    if (!validate()) {
      toast.error("Please complete all required fields");
      return;
    }
    try {
      await addProject(form.name.trim(), form.clientName.trim());
      setForm({ name: "", clientName: "" });
      setErrors({});
      setDialogOpen(false);
      toast.success("Project added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add project");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">{projects.filter((p) => p.status === "Active").length} active projects</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setForm({ name: "", clientName: "" });
            setErrors({});
          }
        }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Project</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl border-border/70 bg-card/95">
            <DialogHeader>
              <DialogTitle>Add Project</DialogTitle>
            </DialogHeader>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleAdd();
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="client-name">Client Name *</Label>
                  <Input
                    id="client-name"
                    placeholder="e.g. Lingo Corp"
                    value={form.clientName}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, clientName: event.target.value }));
                      if (errors.clientName) setErrors((prev) => ({ ...prev, clientName: undefined }));
                    }}
                    aria-invalid={Boolean(errors.clientName)}
                    className={`h-11 ${errors.clientName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {errors.clientName && <p className="text-xs text-destructive">{errors.clientName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name *</Label>
                  <Input
                    id="project-name"
                    placeholder="e.g. LingoPal App"
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
              </div>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="min-w-36">
                  Add Project
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowInactive(!showInactive)}>
          {showInactive ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
          {showInactive ? "Hide" : "Show"} Inactive
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((proj) => {
          const projBilling = billing.filter((b) => b.projectId === proj.id);
          const totalBilled = projBilling.reduce((s, b) => s + b.totalBill, 0);
          const totalComm = projBilling.reduce((s, b) => s + getCommissionableBill(b), 0);
          return (
            <div key={proj.id} className="glass-card p-5 animate-fade-in">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">{proj.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Client: {proj.clientName || "—"}</p>
                </div>
                <StatusBadge status={proj.status} />
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Billed</span>
                  <span className="mono-nums font-medium">${totalBilled.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Commissionable</span>
                  <span className="mono-nums font-medium text-success">${totalComm.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Billing Entries</span>
                  <span className="mono-nums">{projBilling.length}</span>
                </div>
              </div>
              <div className="flex gap-1.5 border-t border-border/50 pt-3">
                {proj.status === "Active" && (
                  <>
                    <Button variant="outline" size="sm" className="flex-1 text-warning border-warning/30 hover:bg-warning/10" onClick={async () => {
                      const reason = window.prompt("Pause reason (optional)", "");
                      try {
                        await runProjectLifecycleAction("pause", proj.id, reason ?? undefined, currentUser?.id);
                        toast.info(`${proj.name} paused`);
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Failed to pause project");
                      }
                    }}>
                      <Pause className="mr-1 h-3 w-3" />Pause
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={async () => {
                      const reason = window.prompt("Delete reason (optional)", "");
                      try {
                        await runProjectLifecycleAction("soft-delete", proj.id, reason ?? undefined, currentUser?.id);
                        toast.info(`${proj.name} deleted`);
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Failed to delete project");
                      }
                    }}>
                      <Trash2 className="mr-1 h-3 w-3" />Delete
                    </Button>
                  </>
                )}
                {proj.status === "Paused" && (
                  <Button variant="outline" size="sm" className="flex-1 text-success border-success/30 hover:bg-success/10" onClick={async () => {
                    const reason = window.prompt("Unpause reason (optional)", "");
                    try {
                      await runProjectLifecycleAction("unpause", proj.id, reason ?? undefined, currentUser?.id);
                      toast.success(`${proj.name} reactivated`);
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Failed to reactivate project");
                    }
                  }}>
                    <Play className="mr-1 h-3 w-3" />Unpause
                  </Button>
                )}
                {proj.status === "Deleted" && isAdmin && (
                  <div className="flex w-full gap-1.5">
                    <Button variant="outline" size="sm" className="flex-1 text-primary border-primary/30 hover:bg-primary/10" onClick={async () => {
                      const reason = window.prompt("Restore reason (optional)", "");
                      try {
                        await runProjectLifecycleAction("restore", proj.id, reason ?? undefined, currentUser?.id);
                        toast.success(`${proj.name} restored`);
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Failed to restore project");
                      }
                    }}>
                      <RotateCcw className="mr-1 h-3 w-3" />Restore
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={async () => {
                        const confirmed = window.confirm(`Hard delete ${proj.name}? This cannot be undone.`);
                        if (!confirmed) return;
                        const reason = window.prompt("Hard delete reason", "");
                        const ok = await hardDeleteProject(proj.id, true, isAdmin, currentUser?.id, reason ?? undefined);
                        if (ok) toast.error(`${proj.name} permanently removed`);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className="glass-card py-12 text-center text-sm text-muted-foreground">No projects found</div>
      )}
    </div>
  );
}
