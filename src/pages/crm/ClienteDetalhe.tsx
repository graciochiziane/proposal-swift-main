// ============================================================
// Cliente Detalhe — Página de detalhe comercial do cliente
// ============================================================

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Phone, Mail, Building2, MessageCircle, Edit3,
  Loader2, AlertCircle, FileText, Clock, Calendar,
  Plus, Check, ChevronRight,
} from 'lucide-react';
import { CrmService, type ClienteWithCRM, type CrmActivity, type CrmFollowUp, type CrmEstado, type CrmActivityType, type CrmOrigem, type CrmTag } from '@/services/crmService';
import { MemberService, type MemberWithProfile } from '@/services/memberService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatMZN } from '@/services/propostaService';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const ESTADO_LABELS: Record<CrmEstado, string> = {
  novo: 'Novo', contactado: 'Contactado', qualificado: 'Qualificado',
  proposta_enviada: 'Proposta Enviada', em_negociacao: 'Em Negociação',
  ganho: 'Ganho', perdido: 'Perdido', inactivo: 'Inactivo',
};

// Item 1 — CrmOrigem real do crmService (enum da migração CRM)
const ORIGEM_LABELS: Record<CrmOrigem, string> = {
  whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram',
  website: 'Website', referencia: 'Referência',
  cliente_existente: 'Cliente Existente', outro: 'Outro',
};

const ACTIVITY_TYPES: { value: CrmActivityType; label: string }[] = [
  { value: 'contacto', label: 'Contacto' },
  { value: 'chamada', label: 'Chamada' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'nota', label: 'Nota' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'outro', label: 'Outro' },
];

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-MZ', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cliente, setCliente] = useState<ClienteWithCRM | null>(null);
  const [propostas, setPropostas] = useState<any[]>([]);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [followUps, setFollowUps] = useState<CrmFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'nota' as CrmActivityType, title: '', description: '' });
  const [followUpForm, setFollowUpForm] = useState({ title: '', description: '', due_at: '' });
  const [saving, setSaving] = useState(false);
  const [savingEstado, setSavingEstado] = useState(false);

  // Item 1 — dados comerciais editáveis (valor/origem/responsável)
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [comercialForm, setComercialForm] = useState({ valor: '', origem: '', responsavel: '' });
  const [savingComercial, setSavingComercial] = useState(false);

  // Item 1 — membros da org para o selector de responsável (load único)
  useEffect(() => {
    MemberService.getMembers()
      .then(setMembers)
      .catch(err => console.error('Erro ao carregar membros (responsável):', err));
  }, []);

  // Item 4 — tags: catálogo da org + selecção actual do contacto
  const [allTags, setAllTags] = useState<CrmTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);

  useEffect(() => {
    CrmService.getTags()
      .then(setAllTags)
      .catch(err => console.error('Erro ao carregar tags:', err));
  }, []);

  // Repõe a selecção quando as tags do contacto no servidor mudam
  // (ex: após guardar); nunca a meio da edição (deps granulares).
  useEffect(() => {
    setSelectedTagIds((cliente?.tags ?? []).map(t => t.id));
  }, [cliente?.id, cliente?.tags]);

  // Item 1 — inicializa o formulário comercial a partir do cliente carregado.
  // Deps granulares deliberadas: repõe o form só quando os valores da BD mudam
  // (ex: após guardar), nunca a meio da edição — incluir 'cliente' objecto
  // reiniciaria o input do utilizador em cada re-render.
  useEffect(() => {
    if (cliente) {
      setComercialForm({
        valor: String(Number(cliente.valor_potencial) || 0),
        origem: cliente.origem ?? '',
        responsavel: cliente.responsavel_id ?? '',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente?.id, cliente?.valor_potencial, cliente?.origem, cliente?.responsavel_id]);

  // Item 1 — guardar valor/origem/responsável via updateClienteCRM (reutilizado, P0)
  const handleSaveComercial = async () => {
    if (!id || !cliente) return;
    const valorNum = Number(comercialForm.valor);
    if (!Number.isFinite(valorNum) || valorNum < 0) {
      toast.error('Valor potencial inválido');
      return;
    }
    setSavingComercial(true);
    try {
      await CrmService.updateClienteCRM(id, {
        valor_potencial: valorNum,
        origem: (comercialForm.origem || null) as CrmOrigem | null,
        responsavel_id: comercialForm.responsavel || null,
      });
      toast.success('Dados comerciais actualizados');
      await loadData();
    } catch (err) {
      console.error('Erro ao guardar dados comerciais:', err);
      toast.error('Erro ao guardar dados comerciais');
      // repõe o formulário com os valores reais da BD
      setComercialForm({
        valor: String(Number(cliente.valor_potencial) || 0),
        origem: cliente.origem ?? '',
        responsavel: cliente.responsavel_id ?? '',
      });
    } finally {
      setSavingComercial(false);
    }
  };

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await CrmService.getClienteWithRelations(id);
      if (!data.cliente) {
        setError('Cliente não encontrado');
        return;
      }
      setCliente(data.cliente);
      setPropostas(data.propostas);
      setActivities(data.activities);
      setFollowUps(data.followUps);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar cliente';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleCreateActivity = async () => {
    if (!id || !activityForm.title.trim()) return;
    setSaving(true);
    try {
      await CrmService.createActivity({
        client_id: id,
        type: activityForm.type,
        title: activityForm.title,
        description: activityForm.description,
      });
      toast.success('Actividade registada');
      setShowActivityModal(false);
      setActivityForm({ type: 'nota', title: '', description: '' });
      loadData();
    } catch (err) {
      toast.error('Erro ao registar actividade');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFollowUp = async () => {
    if (!id || !followUpForm.title.trim() || !followUpForm.due_at) return;
    setSaving(true);
    try {
      await CrmService.createFollowUp({
        client_id: id,
        title: followUpForm.title,
        description: followUpForm.description,
        due_at: new Date(followUpForm.due_at).toISOString(),
      });
      toast.success('Follow-up agendado');
      setShowFollowUpModal(false);
      setFollowUpForm({ title: '', description: '', due_at: '' });
      loadData();
    } catch (err) {
      toast.error('Erro ao agendar follow-up');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteFollowUp = async (followUpId: string) => {
    try {
      await CrmService.completeFollowUp(followUpId);
      toast.success('Follow-up concluído');
      loadData();
    } catch {
      toast.error('Erro ao concluir follow-up');
    }
  };

  // P0: mudança de estado comercial — reutiliza CrmService.updateClienteCRM (existente)
  // Item 4 — guardar tags do contacto via setClientTags (reutilizado)
  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  const handleSaveTags = async () => {
    if (!id) return;
    setSavingTags(true);
    try {
      await CrmService.setClientTags(id, selectedTagIds);
      toast.success('Tags actualizadas');
      await loadData();
    } catch (err) {
      console.error('Erro ao guardar tags:', err);
      toast.error('Erro ao guardar tags');
      setSelectedTagIds((cliente?.tags ?? []).map(t => t.id));
    } finally {
      setSavingTags(false);
    }
  };

  const handleEstadoChange = async (novoEstado: CrmEstado) => {
    if (!id || !cliente || novoEstado === cliente.estado_comercial) return;
    setSavingEstado(true);
    try {
      await CrmService.updateClienteCRM(id, { estado_comercial: novoEstado });
      toast.success('Estado comercial actualizado');
      await loadData();
    } catch (err) {
      console.error('Erro ao actualizar estado comercial:', err);
      toast.error('Erro ao actualizar o estado comercial');
      loadData(); // repõe o selector com o estado real da BD em caso de falha
    } finally {
      setSavingEstado(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !cliente) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <p className="text-sm text-muted-foreground">{error || 'Cliente não encontrado'}</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/crm/contactos')}>
            Voltar aos contactos
          </Button>
        </div>
      </div>
    );
  }

  const pendingFollowUps = followUps.filter(f => !f.completed_at);

  // Item 1 — nome do responsável actual (membro da org ou fallback)
  const responsavelMembro = cliente.responsavel_id
    ? members.find(m => m.user_id === cliente.responsavel_id)
    : undefined;
  const responsavelNome = cliente.responsavel_id
    ? (responsavelMembro
        ? (responsavelMembro.profileNome || responsavelMembro.display_name || responsavelMembro.profileEmail)
        : 'Utilizador removido')
    : '—';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/crm/contactos')} className="gap-2 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      {/* Header */}
      <Card>
        <CardContent className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h1 className="text-2xl md:text-3xl font-bold">{cliente.nome}</h1>
                <Badge variant="secondary">{ESTADO_LABELS[cliente.estado_comercial]}</Badge>
              </div>
              {cliente.empresa && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                  <Building2 className="h-4 w-4" />
                  {cliente.empresa}
                  {cliente.cargo && <span className="text-xs">· {cliente.cargo}</span>}
                </div>
              )}
              <div className="flex items-center gap-4 flex-wrap text-sm">
                {cliente.telefone && (
                  <a href={`tel:${cliente.telefone}`} className="flex items-center gap-1 hover:text-primary">
                    <Phone className="h-4 w-4" />{cliente.telefone}
                  </a>
                )}
                {cliente.whatsapp && (
                  <a href={`https://wa.me/${cliente.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="flex items-center gap-1 hover:text-primary">
                    <MessageCircle className="h-4 w-4" />WhatsApp
                  </a>
                )}
                {cliente.email && (
                  <a href={`mailto:${cliente.email}`} className="flex items-center gap-1 hover:text-primary">
                    <Mail className="h-4 w-4" />{cliente.email}
                  </a>
                )}
              </div>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <select
                value={cliente.estado_comercial}
                onChange={e => handleEstadoChange(e.target.value as CrmEstado)}
                disabled={savingEstado}
                aria-label="Estado comercial"
                className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm"
              >
                {Object.entries(ESTADO_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={() => navigate(`/clientes`)} className="gap-2">
                <Edit3 className="h-4 w-4" />Editar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Valor Potencial</div>
            <div className="text-lg font-bold text-emerald-600">{formatMZN(cliente.valor_potencial)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Origem</div>
            <div className="text-sm font-medium">
              {cliente.origem ? ORIGEM_LABELS[cliente.origem] : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Responsável</div>
            <div className="text-sm font-medium">{responsavelNome}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Propostas</div>
            <div className="text-lg font-bold">{propostas.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Último Contacto</div>
            <div className="text-sm font-medium">
              {cliente.ultimo_contacto ? formatDate(cliente.ultimo_contacto) : 'Nunca'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Próximo Contacto</div>
            <div className="text-sm font-medium">
              {cliente.proximo_contacto ? formatDate(cliente.proximo_contacto) : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Item 1 — Dados comerciais editáveis (valor/origem/responsável) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados Comerciais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="valor-potencial">Valor Potencial (MZN)</Label>
              <Input
                id="valor-potencial"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={comercialForm.valor}
                onChange={e => setComercialForm({ ...comercialForm, valor: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="origem">Origem</Label>
              <select
                id="origem"
                value={comercialForm.origem}
                onChange={e => setComercialForm({ ...comercialForm, origem: e.target.value })}
                aria-label="Origem"
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm"
              >
                <option value="">—</option>
                {Object.entries(ORIGEM_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="responsavel">Responsável</Label>
              <select
                id="responsavel"
                value={comercialForm.responsavel}
                onChange={e => setComercialForm({ ...comercialForm, responsavel: e.target.value })}
                aria-label="Responsável"
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm"
              >
                <option value="">—</option>
                {members.map(m => {
                  const nome = m.profileNome || m.display_name || m.profileEmail;
                  return <option key={m.user_id} value={m.user_id}>{nome}</option>;
                })}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <Button size="sm" onClick={handleSaveComercial} disabled={savingComercial}>
              {savingComercial ? 'A guardar...' : 'Guardar alterações'}
            </Button>
          </div>

          {/* Item 4 — atribuição de tags ao contacto */}
          <div className="mt-4 pt-4 border-t space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label>Tags</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveTags}
                disabled={savingTags}
              >
                {savingTags ? 'A guardar...' : 'Guardar tags'}
              </Button>
            </div>
            {allTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem tags na organização — crie-as na página de Contactos (botão Tags).
              </p>
            ) : (
              <div className="flex gap-1.5 flex-wrap">
                {allTags.map(tag => {
                  const activa = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      aria-pressed={activa}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-opacity ${activa ? '' : 'opacity-40 hover:opacity-70'}`}
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Two columns: Propostas + Actividades/Follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Propostas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              Propostas ({propostas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {propostas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma proposta para este cliente.
              </p>
            ) : (
              <div className="space-y-2">
                {propostas.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors"
                    onClick={() => navigate(`/proposta/${p.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{p.numero}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(p.data)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm">{formatMZN(Number(p.total))}</div>
                      <Badge variant="outline" className="text-xs">{p.status}</Badge>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-2" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Follow-ups */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5" />
                Follow-ups ({pendingFollowUps.length})
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowFollowUpModal(true)} className="gap-1">
                <Plus className="h-3.5 w-3.5" />Agendar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pendingFollowUps.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum follow-up pendente.
              </p>
            ) : (
              <div className="space-y-2">
                {pendingFollowUps.map(f => (
                  <div key={f.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{f.title}</div>
                      {f.description && (
                        <div className="text-xs text-muted-foreground mt-0.5">{f.description}</div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(f.due_at)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCompleteFollowUp(f.id)}
                      className="gap-1 text-emerald-600 hover:text-emerald-700"
                    >
                      <Check className="h-3.5 w-3.5" />Concluir
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activities timeline */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              Actividades ({activities.length})
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowActivityModal(true)} className="gap-1">
              <Plus className="h-3.5 w-3.5" />Registar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma actividade registada.
            </p>
          ) : (
            <div className="space-y-3">
              {activities.map(a => (
                <div key={a.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                    {activities.indexOf(a) < activities.length - 1 && (
                      <div className="w-px flex-1 bg-border mt-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{a.title}</span>
                      <Badge variant="outline" className="text-xs">{a.type}</Badge>
                    </div>
                    {a.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{a.description}</p>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">{formatDateTime(a.performed_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Modal */}
      <Dialog open={showActivityModal} onOpenChange={setShowActivityModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registar Actividade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <select
                value={activityForm.type}
                onChange={e => setActivityForm({ ...activityForm, type: e.target.value as CrmActivityType })}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm"
              >
                {ACTIVITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                value={activityForm.title}
                onChange={e => setActivityForm({ ...activityForm, title: e.target.value })}
                placeholder="Ex: Chamada sobre proposta #002"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                value={activityForm.description}
                onChange={e => setActivityForm({ ...activityForm, description: e.target.value })}
                placeholder="Detalhes da actividade..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActivityModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateActivity} disabled={saving || !activityForm.title.trim()}>
              {saving ? 'A guardar...' : 'Registar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Follow-up Modal */}
      <Dialog open={showFollowUpModal} onOpenChange={setShowFollowUpModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar Follow-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                value={followUpForm.title}
                onChange={e => setFollowUpForm({ ...followUpForm, title: e.target.value })}
                placeholder="Ex: Contactar sobre proposta #002"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                value={followUpForm.description}
                onChange={e => setFollowUpForm({ ...followUpForm, description: e.target.value })}
                placeholder="O que precisa de ser feito..."
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data e hora *</Label>
              <Input
                type="datetime-local"
                value={followUpForm.due_at}
                onChange={e => setFollowUpForm({ ...followUpForm, due_at: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFollowUpModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateFollowUp} disabled={saving || !followUpForm.title.trim() || !followUpForm.due_at}>
              {saving ? 'A agendar...' : 'Agendar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
