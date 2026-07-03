import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { posthog } from 'posthog-js';
import {
  useOrganization,
  type OrgRole,
  type Organization,
  type MembershipWithOrg,
} from './useOrganization';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  /** Todas as organizações do utilizador */
  memberships: MembershipWithOrg[];
  /** Organização activa (null se não tiver nenhuma) */
  organization: Organization | null;
  /** Role na organização activa */
  orgRole: OrgRole | null;
  /** Se os dados da org estão a carregar */
  orgLoading: boolean;
  /** Refrescar dados da organização */
  refreshOrg: () => Promise<void>;
  /** Verificar se o utilizador tem role mínimo na org activa */
  hasOrgRoleMin: (minRole: OrgRole) => boolean;
  /** Trocar organização activa */
  setActiveOrganization: (orgId: string) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  memberships: [],
  organization: null,
  orgRole: null,
  orgLoading: true,
  refreshOrg: async () => {},
  hasOrgRoleMin: () => false,
  setActiveOrganization: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    memberships,
    organization,
    role,
    loading: orgLoading,
    refresh,
    hasRoleMin,
    setActiveOrganization,
  } = useOrganization(user?.id);

  useEffect(() => {
    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);

      // PostHog: identify on login
      if (event === 'SIGNED_IN' && sess?.user) {
        posthog.identify(sess.user.id, {
          email: sess.user.email,
        });
      }

      // PostHog: reset on logout
      if (event === 'SIGNED_OUT') {
        posthog.reset();
      }

      // Redirecionar para login quando a sessao expira ou é invalidada
      if (event === 'SIGNED_OUT' && window.location.pathname !== '/auth') {
        window.location.href = '/auth';
      }
    });

    // THEN fetch existing session
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const combinedLoading = loading || orgLoading;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading: combinedLoading,
      signOut,
      memberships,
      organization,
      orgRole: role,
      orgLoading,
      refreshOrg: refresh,
      hasOrgRoleMin: hasRoleMin,
      setActiveOrganization,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);