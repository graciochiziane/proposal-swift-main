// ============================================================
// TemplatesTab — aba "Modelos" do Painel SuperAdmin (/admin)
//
// Gestão central das atribuições de modelos PDF a tenants:
//   - tabela global de TODAS as linhas de organization_templates
//     (tenant, modelo base, origem, estado, default)
//   - acções por linha: definir default · ligar/desligar · apagar
//   - atribuição em LOTE: modelo + origem + N tenants de uma vez
//
// Escrita 100% superadmin: a RLS (desde 20261009000000) só
// aceita INSERT/UPDATE/DELETE de has_role('admin') — esta UI é
// a superfície legítima dessa permissão. Modelos RESTRITOS
// (ex.: talaService) só ficam visíveis nos seletores dos
// tenants com linha activa aqui.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Star, Power, Trash2, Plus, RefreshCw, Brush, ShoppingBag, Lock } from 'lucide-react';
import type { Tenant } from '@/types/admin';
import {
  OrganizationTemplateService,
  type AtribuicaoTemplate,
  type OrigemTemplate,
} from '@/services/organizationTemplateService';
import { TEMPLATES_PDF, chaveTemplateRegistada, obterTemplateInfo } from '@/lib/pdf';
import type { PdfTemplateId } from '@/lib/pdf';

interface Props {
  tenants: Tenant[];
}

export function TemplatesTab({ tenants }: Props) {
  const [atribuicoes, setAtribuicoes] = useState<AtribuicaoTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filtroModelo, setFiltroModelo] = useState<'todos' | PdfTemplateId>('todos');

  // formulário de atribuição em lote
  const [novaChave, setNovaChave] = useState<PdfTemplateId>('executivo');
  const [novoNome, setNovoNome] = useState('');
  const [novaOrigem, setNovaOrigem] = useState<OrigemTemplate>('adquirido');
  const [novoDefault, setNovoDefault] = useState(false);
  const [orgsSelecionadas, setOrgsSelecionadas] = useState<Set<string>>(new Set());
  const [pesquisaTenant, setPesquisaTenant] = useState('');
  const [atribuindo, setAtribuindo] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setAtribuicoes(await OrganizationTemplateService.listarTodas());
    } catch (err) {
      toast.error('Erro ao carregar atribuições: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const handleDefinirDefault = async (id: string) => {
    setBusyId(id);
    try {
      await OrganizationTemplateService.definirComoDefault(id);
      toast.success('Default da organização actualizado');
      await carregar();
    } catch (err) {
      toast.error('Erro ao definir default: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActivo = async (t: AtribuicaoTemplate) => {
    setBusyId(t.id);
    try {
      await OrganizationTemplateService.definirActivo(t.id, !t.is_active);
      toast.success(t.is_active
        ? 'Modelo desligado para este tenant (exportações caem no fallback)'
        : 'Modelo ligado para este tenant');
      await carregar();
    } catch (err) {
      toast.error('Erro ao alterar estado: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setBusyId(null);
    }
  };

  const handleRemover = async (t: AtribuicaoTemplate) => {
    if (!window.confirm(`Retirar "${t.nome}" do tenant ${t.organization_nome ?? t.organization_id}?`)) return;
    setBusyId(t.id);
    try {
      await OrganizationTemplateService.remover(t.id);
      toast.success('Atribuição removida');
      await carregar();
    } catch (err) {
      toast.error('Erro ao remover: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setBusyId(null);
    }
  };

  const toggleOrg = (id: string) => {
    setOrgsSelecionadas(prev => {
      const nova = new Set(prev);
      if (nova.has(id)) nova.delete(id); else nova.add(id);
      return nova;
    });
  };

  const handleAtribuirLote = async () => {
    if (orgsSelecionadas.size === 0) {
      toast.error('Escolha pelo menos um tenant');
      return;
    }
    setAtribuindo(true);
    try {
      const { criadas, ignoradas } = await OrganizationTemplateService.criarEmLote({
        organization_ids: Array.from(orgsSelecionadas),
        template_key: novaChave,
        nome: novoNome || undefined,
        origem: novaOrigem,
        is_default: novoDefault,
      });
      toast.success(`Atribuição concluída: ${criadas} tenant${criadas !== 1 ? 's' : ''}${ignoradas > 0 ? ` · ${ignoradas} já tinha(m) o modelo (ignorados)` : ''}`);
      setNovoNome('');
      setNovoDefault(false);
      setOrgsSelecionadas(new Set());
      await carregar();
    } catch (err) {
      toast.error('Erro na atribuição: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setAtribuindo(false);
    }
  };

  const nomeModeloBase = (t: AtribuicaoTemplate): { nome: string; orfa: boolean } => {
    if (chaveTemplateRegistada(t.template_key)) {
      return { nome: obterTemplateInfo(t.template_key).nome, orfa: false };
    }
    return { nome: t.template_key, orfa: true };
  };

  const visiveis = useMemo(
    () => filtroModelo === 'todos' ? atribuicoes : atribuicoes.filter(a => a.template_key === filtroModelo),
    [atribuicoes, filtroModelo],
  );

  // pesquisa para o multi-select de tenants (por nome ou slug)
  const tenantsFiltrados = useMemo(() => {
    const q = pesquisaTenant.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(t => t.nome.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
  }, [tenants, pesquisaTenant]);

  return (
    <div className="space-y-6">
      {/* Catálogo + atribuições */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" /> Modelos atribuídos ({atribuicoes.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={filtroModelo}
              onChange={e => setFiltroModelo(e.target.value as 'todos' | PdfTemplateId)}
              aria-label="Filtrar por modelo base"
              className="px-2.5 py-1.5 rounded-md border bg-background text-sm"
            >
              <option value="todos">Todos os modelos</option>
              {TEMPLATES_PDF.map(t => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={carregar} title="Recarregar">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Cada linha põe um modelo à disposição de um tenant. <strong>Ligar/desligar</strong> controla a
            disponibilidade sem apagar; <strong>default</strong> marca o modelo aplicado nas exportações quando o
            utilizador não escolhe outro; <strong>apagar</strong> retira o modelo do tenant. Modelos restritos{' '}
            (<Lock className="inline h-3 w-3" /> ex.: Cotação Corporativa) só aparecem nos seletores dos tenants com
            linha <em>activa</em> — a escrita desta tabela é exclusiva do superadmin (RLS).
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">A carregar...</p>
          ) : visiveis.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {atribuicoes.length === 0
                ? 'Nenhum modelo atribuído a nenhum tenant — os tenants usam o catálogo base da plataforma.'
                : 'Nenhuma atribuição deste modelo base.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Nome apresentado</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Modelo base</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.map(t => {
                  const base = nomeModeloBase(t);
                  const restrito = chaveTemplateRegistada(t.template_key) && obterTemplateInfo(t.template_key).restrito;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        {t.organization_nome ?? <span className="text-muted-foreground">{t.organization_id.slice(0, 8)}…</span>}
                      </TableCell>
                      <TableCell>
                        {t.nome}
                        {restrito && <Lock className="inline ml-1 h-3 w-3 text-amber-600" title="Modelo restrito" />}
                      </TableCell>
                      <TableCell>
                        {t.origem === 'personalizado' ? (
                          <Badge variant="outline" className="gap-1 text-violet-600 border-violet-500/30">
                            <Brush className="h-3 w-3" /> Personalizado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-blue-600 border-blue-500/30">
                            <ShoppingBag className="h-3 w-3" /> Adquirido
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {base.nome}
                        {base.orfa && (
                          <span className="ml-1 text-destructive" title="Chave não registada neste deploy — exportações degradam para o fallback">
                            (chave órfã → fallback)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {t.is_default ? (
                            <Badge className="gap-1"><Star className="h-3 w-3" /> Default</Badge>
                          ) : t.is_active ? (
                            <Badge variant="outline" className="text-green-600 border-green-500/30">Activo</Badge>
                          ) : (
                            <Badge variant="secondary">Desligado</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!t.is_default && (
                            <Button variant="outline" size="sm" className="h-7 gap-1" disabled={busyId === t.id}
                              onClick={() => handleDefinirDefault(t.id)} title="Definir como default das exportações do tenant">
                              <Star className="h-3 w-3" /> Default
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 gap-1" disabled={busyId === t.id}
                            onClick={() => handleToggleActivo(t)}>
                            <Power className="h-3 w-3" /> {t.is_active ? 'Desligar' : 'Ligar'}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            disabled={busyId === t.id} onClick={() => handleRemover(t)} title="Retirar do tenant">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Atribuição em lote */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" /> Atribuir modelo a tenants (lote)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Modelo base (registry)</label>
              <select className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
                value={novaChave} onChange={e => setNovaChave(e.target.value as PdfTemplateId)}>
                {TEMPLATES_PDF.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nome}{t.restrito ? ' — restrito' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Nome apresentado (opcional)</label>
              <Input value={novoNome} onChange={e => setNovoNome(e.target.value)}
                placeholder="Ex.: Modelo Corporativo ACME" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Origem</label>
              <select className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
                value={novaOrigem} onChange={e => setNovaOrigem(e.target.value as OrigemTemplate)}>
                <option value="adquirido">Adquirido — catálogo</option>
                <option value="personalizado">Personalizado — cliente</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
                <input type="checkbox" checked={novoDefault} onChange={e => setNovoDefault(e.target.checked)}
                  className="rounded border-border" />
                Definir como default nos tenants escolhidos
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-xs text-muted-foreground">
                Tenants ({orgsSelecionadas.size} seleccionado{orgsSelecionadas.size !== 1 ? 's' : ''} de {tenants.length})
              </label>
              <div className="flex items-center gap-2">
                <Input
                  value={pesquisaTenant}
                  onChange={e => setPesquisaTenant(e.target.value)}
                  placeholder="Procurar tenant..."
                  className="h-8 w-56 text-sm"
                />
                <Button variant="outline" size="sm" className="h-8"
                  onClick={() => setOrgsSelecionadas(new Set(tenantsFiltrados.map(t => t.id)))}>
                  Todos
                </Button>
                <Button variant="outline" size="sm" className="h-8"
                  onClick={() => setOrgsSelecionadas(new Set())}>
                  Limpar
                </Button>
              </div>
            </div>
            <div className="border rounded-md max-h-44 overflow-y-auto divide-y">
              {tenantsFiltrados.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">Nenhum tenant encontrado.</p>
              ) : tenantsFiltrados.map(t => {
                // se este tenant já tem o modelo escolhido, marcar para clareza
                const jaTem = atribuicoes.some(a => a.organization_id === t.id && a.template_key === novaChave);
                return (
                  <label key={t.id} className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/50 ${jaTem ? 'opacity-60' : ''}`}>
                    <input
                      type="checkbox"
                      checked={orgsSelecionadas.has(t.id)}
                      onChange={() => toggleOrg(t.id)}
                      disabled={jaTem}
                      className="rounded border-border"
                    />
                    <span className="font-medium truncate">{t.nome}</span>
                    <span className="text-xs text-muted-foreground truncate hidden md:inline">{t.slug}</span>
                    {jaTem && <Badge variant="secondary" className="ml-auto shrink-0">já tem</Badge>}
                  </label>
                );
              })}
            </div>
            <Button onClick={handleAtribuirLote} disabled={atribuindo || orgsSelecionadas.size === 0} className="gap-2">
              <Plus className="h-4 w-4" />
              {atribuindo ? 'A atribuir...' : `Atribuir a ${orgsSelecionadas.size} tenant${orgsSelecionadas.size !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
