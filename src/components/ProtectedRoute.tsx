import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { hasRole, PlatformRole } from '@/services/authHelpers';

// ============================================================
// P1-H11 (2026-08-13): Added optional `roles` prop for role-based
//   route protection. When provided, the route requires the user
//   to have one of the specified platform roles. If not, redirects
//   to a permission-denied page (or home if not specified).
//   Previously: only checked user != null — admin UI shipped to
//   every authenticated user's JS bundle.
// ============================================================

interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * Optional platform roles that are allowed to access this route.
   * If not provided, any authenticated user can access.
   * If provided, user must have one of the listed roles.
   * Example: roles={['admin']} restricts to platform admins only.
   */
  roles?: PlatformRole[];
  /**
   * Where to redirect if user lacks required role.
   * Defaults to '/' (home).
   */
  fallbackPath?: string;
}

export default function ProtectedRoute({
  children,
  roles,
  fallbackPath = '/',
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">A carregar...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  // P1-H11: Role-based guard
  // If roles prop is provided, verify the user has at least one of them.
  // This is a client-side check only — defense in depth alongside
  // RLS and requireAdmin() in services.
  if (roles && roles.length > 0) {
    const userRole = hasRole();
    if (!userRole || !roles.includes(userRole)) {
      return <Navigate to={fallbackPath} replace />;
    }
  }

  return <>{children}</>;
}
