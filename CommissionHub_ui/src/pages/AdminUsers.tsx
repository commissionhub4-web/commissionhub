import { useAuth, UserStatus } from "../contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { StatusBadge } from "../components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { CheckCircle2, XCircle, Users, Clock, ShieldCheck, ShieldX, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminUsers() {
  const { users, approveUser, rejectUser, deleteUser, isAdmin } = useAuth();
  const { toast } = useToast();

  if (!isAdmin) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md border-border/60 bg-card/80">
          <CardHeader className="items-center text-center">
            <ShieldX className="h-12 w-12 text-destructive mb-2" />
            <CardTitle className="text-foreground">Access Denied</CardTitle>
            <CardDescription>Only admins can access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const pending = users.filter((u) => u.status === "pending");
  const approved = users.filter((u) => u.status === "approved");
  const rejected = users.filter((u) => u.status === "rejected");

  const handleApprove = (id: string, name: string) => {
    approveUser(id);
    toast({ title: "User Approved", description: `${name} can now log in.` });
  };

  const handleReject = (id: string, name: string) => {
    rejectUser(id);
    toast({ title: "User Rejected", description: `${name} has been rejected.`, variant: "destructive" });
  };

  const handleDelete = (id: string, name: string) => {
    const confirmed = window.confirm(`Delete user ${name}? This cannot be undone.`);
    if (!confirmed) return;
    deleteUser(id);
    toast({ title: "User Deleted", description: `${name} was removed successfully.`, variant: "destructive" });
  };

  const statusBadge = (status: UserStatus) => {
    const map: Record<UserStatus, "Active" | "Paused" | "Deleted"> = {
      approved: "Active",
      pending: "Paused",
      rejected: "Deleted",
    };
    return <StatusBadge status={map[status]} />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">User Management</h1>
        <p className="text-muted-foreground mt-1">Approve or reject user registrations</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/60 bg-card/80">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15">
              <Clock className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{pending.length}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{approved.length}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/15">
              <ShieldX className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{rejected.length}</p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Users */}
      {pending.length > 0 && (
        <Card className="border-amber-500/20 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Clock className="h-5 w-5 text-amber-400" />
              Pending Verification ({pending.length})
            </CardTitle>
            <CardDescription>These users are waiting for your approval to access the system.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Signed Up</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-foreground">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{statusBadge(user.status)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" onClick={() => handleApprove(user.id, user.name)}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleReject(user.id, user.name)}>
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => handleDelete(user.id, user.name)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All Users */}
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Users className="h-5 w-5 text-primary" />
            All Users ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No users have signed up yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Signed Up</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-foreground">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{statusBadge(user.status)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {user.status !== "approved" && (
                        <Button size="sm" variant="outline" onClick={() => handleApprove(user.id, user.name)}>
                          Approve
                        </Button>
                      )}
                      {user.status !== "rejected" && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleReject(user.id, user.name)}>
                          Reject
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => handleDelete(user.id, user.name)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
