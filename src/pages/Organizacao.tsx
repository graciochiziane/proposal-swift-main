import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Building2, ArrowRightLeft, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MemberList from '@/components/org/MemberList';
import RoleBadge from '@/components/org/RoleBadge';
import EmpresaPerfilTab from '@/components/org/EmpresaPerfilTab';
import PagamentosTab from '@/components/org/PagamentosTab';
import PlanoTab from '@/components/org/PlanoTab';

// Ordem lógica: Perfil da Empresa → Pagamentos → Equipa → Plano
const ABAS_VALIDAS = ['perfil', 'pagamentos', 'equipa', 'plano'] as const;

export default function Organizacao() {
  const { organization, orgRole, hasOrgRoleMin, memberships, setActiveOrganization } = useAuth();
  const [searchParams] = useSearchParams();

  // Permite entrar directamente numa aba: /organizacao?tab=plano
  const tabParam = searchParams.get('tab');
  const abaInicial = (ABAS_VALIDAS as readonly string[]).includes(tabParam ?? '')
    ? (tabParam as typeof ABAS_VALIDAS[number])
    : 'perfil';

  const canEdit = hasOrgRoleMin('admin');
  const hasMultipleOrgs = (memberships?.length ?? 0) > 1;

  const handleSwitchOrg = (orgId: string) => {
    if (orgId === organization?.id) return;
    const target = memberships?.find(m => m.organization_id === orgId);
    setActiveOrganization(orgId);
    toast.success(`Org activa: ${target?.organization.nome || 'Organizacao'}`);
  };

  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-lg font-semibold text-foreground">Sem Organizacao</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          A sua conta nao esta vinculada a nenhuma organizacao.
          Contacte o suporte se isto parecer incorrecto.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organizacao</h1>
        <p className="text-muted-foreground">
          {organization.nome} &middot; Plano {organization.plano}
          {orgRole && (
            <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
              {orgRole}
            </span>
          )}
        </p>
      </div>

      {/* Org Switcher — only when user belongs to multiple orgs */}
      {hasMultipleOrgs && (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ArrowRightLeft className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <Label className="text-sm font-medium">Mudar de Organizacao</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pertence a {memberships?.length} organizacoes. Seleccione para trocar o contexto.
                </p>
              </div>
            </div>
            <div className="mt-3">
              <Select
                value={organization.id}
                onValueChange={handleSwitchOrg}
              >
                <SelectTrigger className="max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {memberships?.map((m) => (
                    <SelectItem key={m.organization_id} value={m.organization_id}>
                      <div className="flex items-center gap-2">
                        {m.organization_id === organization.id && (
                          <Check className="h-3.5 w-3.5 text-primary" />
                        )}
                        <span className={m.organization_id !== organization.id ? 'ml-[22px]' : ''}>
                          {m.organization.nome}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          <RoleBadge role={m.role} />
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue={abaInicial} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="perfil">Perfil da Empresa</TabsTrigger>
          <TabsTrigger value="pagamentos">Métodos de Pagamento</TabsTrigger>
          <TabsTrigger value="equipa">Equipa</TabsTrigger>
          <TabsTrigger value="plano">Plano &amp; Faturação</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="space-y-4">
          <EmpresaPerfilTab canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="pagamentos" className="space-y-4">
          <PagamentosTab canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="equipa" className="space-y-4">
          <MemberList />
        </TabsContent>

        <TabsContent value="plano" className="space-y-4">
          <PlanoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
