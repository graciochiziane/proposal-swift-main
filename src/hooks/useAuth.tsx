import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { posthog } from 'posthog-js';
import { useOrganization, type OrgRole, type Organization } from './useOrganization';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  /** Organização actual do utilizador (null se não tiver) */
  organization: Organization | null;
  /** Role do utilizador na organização (null se não tiver org) */
  orgRole: OrgRole | null;
  /** Se os dados da org estão a carregar */
  orgLoading: boolean;
  /** Refrescar dados da organização */
  refreshOrg: () => Promise<void>;
  /** Verificar se o utilizador tem role mínimo na org */
  hasOrgRoleMin: (minRole: OrgRole) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  organization: null,
  orgRole: null,
  orgLoading: true,
  refreshOrg: async () => {},
  hasOrgRoleMin: () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    organization,
    role,
    loading: orgLoading,
    refresh,
    hasRoleMin,
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
      organization,
      orgRole: role,
      orgLoading,
      refreshOrg: refresh,
      hasOrgRoleMin: hasRoleMin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);