import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/contexts/AppContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Projects from "./pages/Projects";
import Billing from "./pages/Billing";
import Commissions from "./pages/Commissions";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";
import Login from "./pages/login";
import AdminUsers from "./pages/AdminUsers";

const queryClient = new QueryClient();

function ProtectedLayout() {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

function LoginRoute() {
  const { currentUser } = useAuth();

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  return <Login />;
}

function AdminRoute() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <AdminUsers />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AppProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginRoute />} />
              <Route element={<ProtectedLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/commissions" element={<Commissions />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/admin/users" element={<AdminRoute />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
