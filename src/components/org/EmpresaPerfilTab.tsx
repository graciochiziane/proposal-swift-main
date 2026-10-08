import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { OrganizationService } from '@/services/organizationService';
import { Save, Loader2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CamposPersonalizadosCard from '@/components/org/CamposPersonalizadosCard';

// ── Validadores ──
/** NUIT moçambicano: apenas dígitos, 8 a 9 (formato comum: 9). */
const NUIT_RE = /^\d{8,9}$/;

const PLANOS: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  business: 'Business',
};

/**
 * Aba 1 — Perfil da Empresa.
 * Dados editáveis (admin+): nome, NUIT, endereço fiscal, logótipo,
 * cor primária (aplicada aos PDFs).
 * Dados do sistema (apenas leitura): identificador, plano, adesão.
 */
export default function EmpresaPerfilTab({ canEdit }: { canEdit: boolean }) {
  const { organization, refreshOrg } = useAuth();
  const [nome, setNome] = useState(organization?.nome || '');
  const [nuit, setNuit] = useState(organization?.nuit || '');
  const [endereco, setEndereco] = useState(organization?.endereco || '');
  const [corPrimaria, setCorPrimaria] = useState(organization?.cor_primaria || '#0B5394');
  const [logoUrl, setLogoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // null = sem alteração, '' = remover, File = novo upload
  const [logoAction, setLogoAction] = useState<null | '' | File>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync quando os dados da org chegam/mudam do servidor
  useEffect(() => {
    if (!organization) return;
    setNome(organization.nome || '');
    setNuit(organization.nuit || '');
    setEndereco(organization.endereco || '');
    setCorPrimaria(organization.cor_primaria || '#0B5394');
    setLogoAction(null);
    setPreviewUrl(null);
    OrganizationService.signOrgLogoUrl(organization.logo_url, organization.id)
      .then(setLogoUrl)
      .catch(() => setLogoUrl(''));
  }, [organization]);

  const nuitInvalido = nuit !== '' && !NUIT_RE.test(nuit);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx. 2MB)');
      return;
    }
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato inválido (use PNG, JPEG ou WebP)');
      return;
    }

    setLogoAction(file);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoAction('');
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSave = async () => {
    if (!organization) return;

    if (!nome.trim()) {
      toast.error('O nome da empresa é obrigatório');
      return;
    }
    if (nuitInvalido) {
      toast.error('NUIT inválido — insira apenas números (8 a 9 dígitos)');
      return;
    }

    setSaving(true);
    try {
      // 1. Remoção do logo (ficheiro + referência) quando pedido
      if (logoAction === '') {
        await OrganizationService.removeOrgLogo(organization.id);
      }

      // 2. Upload do novo logo para a pasta da org
      const novoLogoPath = logoAction instanceof File
        ? await OrganizationService.uploadOrgLogo(logoAction, organization.id)
        : undefined;

      // 3. Gravar dados da empresa
      await OrganizationService.updateOrganization({
        nome: nome.trim(),
        nuit: nuit || null,
        endereco: endereco || null,
        cor_primaria: corPrimaria,
        ...(novoLogoPath ? { logo_url: novoLogoPath } : {}),
      }, organization.id);

      toast.success('Dados da empresa actualizados');
      setLogoAction(null);
      setPreviewUrl(null);
      refreshOrg();
    } catch (error) {
      console.error('[EmpresaPerfilTab] Erro ao gravar:', error);
      toast.error('Erro ao gravar os dados da empresa');
    } finally {
      setSaving(false);
    }
  };

  const displayLogo = previewUrl || logoUrl;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfil da Empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="empresa-nome">Nome / Razão Social</Label>
              <Input
                id="empresa-nome"
                placeholder="Nome oficial da empresa"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={!canEdit || saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="empresa-nuit">NUIT</Label>
              <Input
                id="empresa-nuit"
                placeholder="Apenas números (ex: 400122456)"
                value={nuit}
                onChange={(e) => setNuit(e.target.value.replace(/\D/g, '').slice(0, 9))}
                disabled={!canEdit || saving}
                inputMode="numeric"
                className={nuitInvalido ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {nuitInvalido && (
                <p className="text-xs text-destructive">
                  NUIT inválido — 8 a 9 dígitos, apenas números.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="empresa-endereco">Endereço Fiscal</Label>
            <Input
              id="empresa-endereco"
              placeholder="Ex: Av. 25 de Setembro, Maputo"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              disabled={!canEdit || saving}
            />
          </div>

          {/* ── Identidade visual (branding) ── */}
          <div className="pt-2 border-t space-y-4">
            <div className="space-y-2">
              <Label>Logótipo</Label>
              <div className="flex items-center gap-4 flex-wrap">
                {displayLogo ? (
                  <img
                    src={displayLogo}
                    alt="Logo da empresa"
                    className="h-12 w-auto rounded border border-border bg-white p-1 object-contain"
                  />
                ) : (
                  <div className="h-12 w-12 rounded border border-dashed border-border flex items-center justify-center text-muted-foreground text-xs">
                    Sem logo
                  </div>
                )}
                {canEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => fileRef.current?.click()}
                  >
                    <UploadCloud className="mr-2 h-4 w-4" />
                    {displayLogo ? 'Trocar imagem' : 'Carregar imagem'}
                  </Button>
                )}
                {logoAction instanceof File && (
                  <span className="text-xs text-primary font-medium">Novo ficheiro seleccionado</span>
                )}
                {logoAction === '' && (
                  <span className="text-xs text-destructive font-medium">Logo será removido ao salvar</span>
                )}
                {displayLogo && logoAction !== '' && canEdit && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Remover
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleLogoSelect}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                PNG, JPEG ou WebP · máx. 2MB · aplicado em todas as propostas da organização.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="empresa-cor">Cor Primária (tema dos PDFs)</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="empresa-cor"
                  value={corPrimaria}
                  onChange={(e) => setCorPrimaria(e.target.value)}
                  disabled={!canEdit || saving}
                  className="h-10 w-14 rounded border border-input cursor-pointer disabled:opacity-50"
                />
                <Input
                  value={corPrimaria}
                  onChange={(e) => setCorPrimaria(e.target.value)}
                  disabled={!canEdit || saving}
                  className="max-w-[140px] font-mono"
                />
              </div>
            </div>
          </div>

          {/* ── Dados do sistema (apenas leitura) ── */}
          <div className="pt-4 border-t grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Identificador</Label>
              <p className="text-sm font-mono">{organization?.slug}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">ID da Organização</Label>
              <p className="text-xs font-mono break-all">{organization?.id}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Membro desde</Label>
              <p className="text-sm">
                {organization
                  ? new Date(organization.created_at).toLocaleDateString('pt-MZ', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })
                  : '—'}
              </p>
            </div>
          </div>

          {canEdit && (
            <div className="pt-2 flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving || nuitInvalido || !nome.trim()}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'A gravar…' : 'Guardar Dados da Empresa'}
              </Button>
              <span className="text-xs text-muted-foreground">
                Plano actual: {PLANOS[organization?.plano ?? 'free'] ?? organization?.plano}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campos personalizados — alimentam templates PDF (ex.: talaService) */}
      {organization && <CamposPersonalizadosCard organizationId={organization.id} canEdit={canEdit} />}
    </div>
  );
}
