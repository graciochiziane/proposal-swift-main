// ============================================================
// TenantTemplatesTab — aba Templates do TenantDetailPage
// (Etapa 3 da proposta aprovada: gestão operacional sem SQL)
//
// Operações intencionalmente restritas à primeira fase:
//   - listar as linhas de organization_templates da org
//   - adicionar modelo base do registry à org
//   - definir default · activar/desactivar · remover
// SEM builder, SEM edição de config (coluna reservada ao Nível 2).
//
// Segurança: todas as operações passam pela RLS da tabela
// (owner/admin da org ou platform admin); o id do tenant é
// apenas um hint de UX — um admin que tente gerir a org de
// outro tenant recebe erro de policy, não efeito.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { FileText, Star, Power, Trash2, Plus, RefreshCw } from 'lucide-react';
import {
  OrganizationTemplateService,
  chavesTemplatesDisponiveis,
  type OrganizationTemplate,
} from '@/services/organizationTemplateService';
import { chaveTemplateRegistada, obterTemplateInfo } from '@/lib/pdf';
import type { PdfTemplateId } from '@/lib/pdf';

interface Props {
  organizationId: string;
}

export default function TenantTemplatesTab({ organizationId }: Props) {
  const [templates, setTemplates] = useState<OrganizationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // formulário de adição
  const [novaChave, setNovaChave] = useState<PdfTemplateId>('executivo');
  const [novoNome, setNovoNome] = useState('');
  const [novoDefault, setNovoDefault] = useState(false);
  const [adicionando, setAdicionando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await OrganizationTemplateService.listar(organizationId));
    } catch (err) {
      toast.error('Erro ao carregar templates: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleAdicionar = async () => {
    setAdicionando(true);
    try {
      await OrganizationTemplateService.criar({
        organization_id: organizationId,
        template_key: novaChave,
        nome: novoNome || undefined,
        is_default: novoDefault,
      });
      toast.success('Modelo adicionado ao tenant');
      setNovoNome('');
      setNovoDefault(false);
      await carregar();
    } catch (err) {
      toast.error('Erro ao adicionar: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setAdicionando(false);
    }
  };

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

  const handleToggleActivo = async (t: OrganizationTemplate) => {
    setBusyId(t.id);
    try {
      await OrganizationTemplateService.definirActivo(t.id, !t.is_active);
      toast.success(t.is_active ? 'Modelo desactivado (exportações caem no fallback)' : 'Modelo activado');
      await carregar();
    } catch (err) {
      toast.error('Erro ao alterar estado: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setBusyId(null);
    }
  };

  const handleRemover = async (t: OrganizationTemplate) => {
    if (!window.confirm(`Remover "${t.nome}" deste tenant?`)) return;
    setBusyId(t.id);
    try {
      await OrganizationTemplateService.remover(t.id);
      toast.success('Modelo removido do tenant');
      await carregar();
    } catch (err) {
      toast.error('Erro ao remover: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setBusyId(null);
    }
  };

  const nomeModeloBase = (t: OrganizationTemplate): { nome: string; orfa: boolean } => {
    if (chaveTemplateRegistada(t.template_key)) {
      return { nome: obterTemplateInfo(t.template_key).nome, orfa: false };
    }
    return { nome: t.template_key, orfa: true };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" /> Modelos PDF do Tenant ({templates.length})
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={carregar} title="Recarregar">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            O modelo marcado como <strong>default</strong> é aplicado às exportações deste tenant
            (cotação, proposta IA e proposta avançada) quando o utilizador não escolhe outro no
            selector. Tenant sem linhas usa o comportamento padrão da plataforma.
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">A carregar...</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Este tenant ainda não tem modelos associados — usa o comportamento padrão da plataforma.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Modelo base</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map(t => {
                  const base = nomeModeloBase(t);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.nome}</TableCell>
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
                            <Badge variant="secondary">Inactivo</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!t.is_default && (
                            <Button variant="outline" size="sm" className="h-7 gap-1" disabled={busyId === t.id}
                              onClick={() => handleDefinirDefault(t.id)} title="Definir como default das exportações">
                              <Star className="h-3 w-3" /> Default
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 gap-1" disabled={busyId === t.id}
                            onClick={() => handleToggleActivo(t)}>
                            <Power className="h-3 w-3" /> {t.is_active ? 'Desactivar' : 'Activar'}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            disabled={busyId === t.id} onClick={() => handleRemover(t)} title="Remover do tenant">
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

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Plus className="h-4 w-4" /> Adicionar modelo ao tenant</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Modelo base (registry)</label>
              <select className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
                value={novaChave} onChange={e => setNovaChave(e.target.value as PdfTemplateId)}>
                {chavesTemplatesDisponiveis().map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Nome apresentado (opcional)</label>
              <Input value={novoNome} onChange={e => setNovoNome(e.target.value)}
                placeholder="Ex.: Modelo Corporativo ACME" />
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
                <input type="checkbox" checked={novoDefault} onChange={e => setNovoDefault(e.target.checked)}
                  className="rounded border-border" />
                Definir como default
              </label>
              <Button onClick={handleAdicionar} disabled={adicionando} className="gap-2">
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            O nome próprio serve para dar identidade de marca ao modelo do cliente. Modelo
            exclusivo de código (Nível 3) aparece nesta lista assim que seja registado no
            registry — não existe ainda nenhum.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
