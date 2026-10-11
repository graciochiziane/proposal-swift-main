// ============================================================
// Admin Page — Shell with tabs (refactored from 1177 → ~70 lines)
// Each tab is an isolated component in ./admin/
// ============================================================
import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Activity, Users, Building2, Shield, LayoutTemplate, FileText } from 'lucide-react';
import { MetricsTab } from './admin/MetricsTab';
import { UsersTab } from './admin/UsersTab';
import { TenantsTab } from './admin/TenantsTab';
import { AuditTab } from './admin/AuditTab';
import { TemplatesTab } from './admin/TemplatesTab';
import { useAdminTenants } from './admin/hooks/useAdminTenants';

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('metrics');

  // We need tenants list for the audit filter dropdown
  const { tenants: allTenants } = useAdminTenants(isAdmin);

  // Verify admin role
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      setIsAdmin(!!data?.some(r => r.role === 'admin'));
      setCheckingRole(false);
    })();
  }, [user]);

  if (authLoading || checkingRole) {
    return <div className="p-8 text-muted-foreground">A verificar permissões...</div>;
  }

  if (!isAdmin) {
    toast.error('Acesso negado: área restrita a administradores');
    return <Navigate to="/" replace />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel SuperAdmin</h1>
          <p className="text-sm text-muted-foreground">Gestão global e métricas da plataforma</p>
        </div>
        {/* Galeria de modelos PDF — única entrada para /admin/templates */}
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/templates')} className="gap-2">
          <LayoutTemplate className="h-4 w-4" />
          Modelos PDF
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="metrics" className="gap-2">
            <Activity className="h-4 w-4" />
            Métricas
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Utilizadores
          </TabsTrigger>
          <TabsTrigger value="tenants" className="gap-2">
            <Building2 className="h-4 w-4" />
            Tenants
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Modelos
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <Shield className="h-4 w-4" />
            Auditoria
          </TabsTrigger>
        </TabsList>

        {activeTab === 'metrics' && <MetricsTab activeTab={activeTab} />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'tenants' && <TenantsTab />}
        {activeTab === 'templates' && <TemplatesTab tenants={allTenants} />}
        {activeTab === 'audit' && <AuditTab tenants={allTenants} />}
      </Tabs>
    </div>
  );
}