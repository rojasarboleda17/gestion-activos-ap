import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/useAuth";
import { LoadingScreen } from "@/components/ui/loading-screen";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

/**
 * SECURITY NOTE: This component provides UX-level route protection only.
 * 
 * It prevents unauthorized users from seeing protected UI components,
 * but it is NOT a security control. Client-side checks can be bypassed.
 * 
 * ACTUAL SECURITY is enforced by:
 * 1. Supabase Row Level Security (RLS) policies on all tables
 * 2. Database functions: app_is_admin(), app_current_role(), app_current_org_id()
 * 3. Server-side validation in Edge Functions
 * 
 * All sensitive data access is blocked at the database level regardless
 * of what the client attempts to request.
 */
export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  // Not authenticated - redirect to login (UX convenience)
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // No profile or inactive - redirect to inactive page (UX convenience)
  if (!profile || !profile.is_active) {
    return <Navigate to="/inactive" replace />;
  }

  // Check role if required (UX convenience - actual security is via RLS)
  if (requiredRole && profile.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
