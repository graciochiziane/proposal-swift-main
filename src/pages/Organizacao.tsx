import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { OrganizationService } from '@/services/organizationService';
import { Building2, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MemberList from '@/components/org/MemberList';

export default function Organizacao() {
  const { organization, orgRole, hasOrgRoleMin, refreshOrg, user } = useAuth();
  const [nome, setNome] = useState(organization?.nome || '');
  const [corPrimaria, setCorPrimaria] = useState(organization?.cor_primaria || '#0B5394');
  const [saving, setSaving] = useState(false);

  const canEdit = hasOrgRoleMin('admin');

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

  // Sync state when organization loads/refreshes
  if (organization && nome !== organization.nome) {
    setNome(organization.nome);
    setCorPrimaria(organization.cor_primaria || '#0B5394');
  }

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