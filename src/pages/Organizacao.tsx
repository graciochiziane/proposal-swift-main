import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { OrganizationService } from '@/services/organizationService';
import { Building2, Save, Loader2, ArrowRightLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import MemberList from '@/components/org/MemberList';
import RoleBadge from '@/components/org/RoleBadge';

export default function Organizacao() {
  const { organization, orgRole, hasOrgRoleMin, refreshOrg, user, memberships, setActiveOrganization } = useAuth();
  const [nome, setNome] = useState(organization?.nome || '');
  const [corPrimaria, setCorPrimaria] = useState(organization?.cor_primaria || '#0B5394');
  const [saving, setSaving] = useState(false);

  const canEdit = hasOrgRoleMin('admin');
  const hasMultipleOrgs = (memberships?.length ?? 0) > 1;

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error('Nome da organizacao e obrigatorio');
      return;
    }

    setSaving(true);
    try {
      await OrganizationService.updateOrganization({
        nome: nome.trim(),
        cor_primaria: corPrimaria,
      });
      toast.success('Organizacao actualizada');
      refreshOrg();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao actualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchOrg = (orgId: string) => {
    if (orgId === organization?.id) return;
    const target = memberships?.find(m => m.organization_id === orgId);
    setActiveOrganization(orgId);
    toast.success(`Org activa: ${target?.organization.nome || 'Organizacao'}`);
  };

  // Sync form state when organization data changes from server (e.g. after refresh)
  useEffect(() => {
    if (organization) {
      setNome(organization.nome || '');
      setCorPrimaria(organization.cor_primaria || '#0B5394');
    }
  }, [organization]);

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

      <Tabs defaultValue="equipa" className="space-y-4">
        <TabsList>
          <TabsTrigger value="equipa">Equipa</TabsTrigger>
          <TabsTrigger value="definicoes">Definicoes</TabsTrigger>
        </TabsList>

        <TabsContent value="equipa" className="space-y-4">
          <MemberList />
        </TabsContent>

        <TabsContent value="definicoes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados da Organizacao</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Nome</Label>
                <Input
                  id="org-name"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-color">Cor Primaria</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="org-color"
                    value={corPrimaria}
                    onChange={(e) => setCorPrimaria(e.target.value)}
                    disabled={!canEdit}
                    className="h-10 w-14 rounded border border-input cursor-pointer"
                  />
                  <Input
                    value={corPrimaria}
                    onChange={(e) => setCorPrimaria(e.target.value)}
                    disabled={!canEdit}
                    className="max-w-[140px]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Identificador</Label>
                <p className="text-sm text-muted-foreground font-mono">{organization.slug}</p>
              </div>

              <div className="space-y-2">
                <Label>Plano</Label>
                <p className="text-sm text-muted-foreground capitalize">{organization.plano}</p>
              </div>

              <div className="space-y-2">
                <Label>Membro desde</Label>
                <p className="text-sm text-muted-foreground">
                  {new Date(organization.created_at).toLocaleDateString('pt-MZ', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>

              {canEdit && (
                <div className="pt-2">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Save className="h-4 w-4 mr-2" />
                    Guardar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}