import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LoadingScreen } from "@/components/ui/loading-screen";

// Pages
import Index from "./pages/Index";
import Debug from "./pages/Debug";
import Login from "./pages/Login";
import Inactive from "./pages/Inactive";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import AdminVehicles from "./pages/admin/Vehicles";
import AdminVehicleNew from "./pages/admin/VehicleNew";
import AdminVehicleDetail from "./pages/admin/VehicleDetail";
import AdminOperations from "./pages/admin/Operations";
import AdminSales from "./pages/admin/Sales";
import AdminFiles from "./pages/admin/Files";
import AdminUsers from "./pages/admin/Users";
import AdminBranches from "./pages/admin/Branches";
import AdminAudit from "./pages/admin/Audit";

const queryClient = new QueryClient();

function RootRedirect() {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  
  if (!user) return <Navigate to="/login" replace />;
  
  if (!profile || !profile.is_active) return <Navigate to="/inactive" replace />;
  
  if (profile.role === "admin") return <Navigate to="/admin/dashboard" replace />;
  
  // Other roles would go to their respective dashboards
  return <Navigate to="/unauthorized" replace />;
}

const AppRoutes = () => (
  <Routes>
    {/* Root redirect */}
    <Route path="/" element={<RootRedirect />} />
    
    {/* Auth pages */}
    <Route path="/login" element={<Login />} />
    <Route path="/inactive" element={<Inactive />} />
    <Route path="/unauthorized" element={<Unauthorized />} />
    
    {/* Debug (accessible to authenticated users) */}
    <Route path="/debug" element={<Debug />} />
    
    {/* Admin routes */}
    <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
    <Route path="/admin/vehicles" element={<ProtectedRoute requiredRole="admin"><AdminVehicles /></ProtectedRoute>} />
    <Route path="/admin/vehicles/new" element={<ProtectedRoute requiredRole="admin"><AdminVehicleNew /></ProtectedRoute>} />
    <Route path="/admin/vehicles/:id" element={<ProtectedRoute requiredRole="admin"><AdminVehicleDetail /></ProtectedRoute>} />
    <Route path="/admin/operations" element={<ProtectedRoute requiredRole="admin"><AdminOperations /></ProtectedRoute>} />
    <Route path="/admin/sales" element={<ProtectedRoute requiredRole="admin"><AdminSales /></ProtectedRoute>} />
    <Route path="/admin/files" element={<ProtectedRoute requiredRole="admin"><AdminFiles /></ProtectedRoute>} />
    <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsers /></ProtectedRoute>} />
    <Route path="/admin/branches" element={<ProtectedRoute requiredRole="admin"><AdminBranches /></ProtectedRoute>} />
    <Route path="/admin/audit" element={<ProtectedRoute requiredRole="admin"><AdminAudit /></ProtectedRoute>} />
    
    {/* Catch-all */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
