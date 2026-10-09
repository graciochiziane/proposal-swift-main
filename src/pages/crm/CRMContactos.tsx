// ============================================================
// CRM Contactos — Lista de contactos com dados CRM
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Loader2, AlertCircle, Users, ChevronRight,
  Phone, Mail, Building2, Clock, Tag as TagIcon, X,
  LayoutGrid, List,
} from 'lucide-react';
import { CrmService, type ClienteWithCRM, type CrmEstado, type CrmTag } from '@/services/crmService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { formatMZN } from '@/services/propostaService';
import { toast } from 'sonner';

// Item 4 — paleta de cores preset para tags (sem novas dependências)
const TAG_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#ec4899', '#6b7280'];

const ESTADO_CONFIG: Record<CrmEstado, { label: string; cor: string; bg: string; dot: string }> = {
  novo:              { label: 'Novo',              cor: 'text-blue-600',    bg: 'bg-blue-100',    dot: 'bg-blue-500' },
  contactado:        { label: 'Contactado',        cor: 'text-purple-600',  bg: 'bg-purple-100',  dot: 'bg-purple-500' },
  qualificado:       { label: 'Qualificado',       cor: 'text-indigo-600',  bg: 'bg-indigo-100',  dot: 'bg-indigo-500' },
  proposta_enviada:  { label: 'Proposta Enviada',  cor: 'text-amber-600',   bg: 'bg-amber-100',   dot: 'bg-amber-500' },
  em_negociacao:     { label: 'Em Negociação',     cor: 'text-orange-600',  bg: 'bg-orange-100',  dot: 'bg-orange-500' },
  ganho:             { label: 'Ganho',             cor: 'text-emerald-600', bg: 'bg-emerald-100', dot: 'bg-emerald-500' },
  perdido:           { label: 'Perdido',           cor: 'text-red-600',     bg: 'bg-red-100',     dot: 'bg-red-500' },
  inactivo:          { label: 'Inactivo',          cor: 'text-gray-500',    bg: 'bg-gray-100',    dot: 'bg-gray-400' },
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return `Há ${days} dias`;
  if (days < 30) return `Há ${Math.floor(days / 7)} sem`;
  return `Há ${Math.floor(days / 30)} mês`;
}

// Tipo de vista da lista de contactos (preferência persistida localmente)
type VistaContactos = 'cartoes' | 'lista';
const VISTA_STORAGE_KEY = 'crm-contactos-vista';

function lerVistaInicial(): VistaContactos {
  try {
    return localStorage.getItem(VISTA_STORAGE_KEY) === 'lista' ? 'lista' : 'cartoes';
  } catch {
    return 'cartoes';
  }
}

export default function CRMContactos() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<ClienteWithCRM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<CrmEstado | ''>('');
  const [vista, setVista] = useState<VistaContactos>(lerVistaInicial);

  const mudarVista = (v: VistaContactos) => {
    setVista(v);
    try { localStorage.setItem(VISTA_STORAGE_KEY, v); } catch { /* storage indisponível */ }
  };

  // Item 4 — tags: filtragem + gestão
  const [tags, setTags] = useState<CrmTag[]>([]);
  const [filterTag, setFilterTag] = useState('');
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [newTagNome, setNewTagNome] = useState('');
  const [newTagCor, setNewTagCor] = useState(TAG_COLORS[0]);
  const [savingTag, setSavingTag] = useState(false);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);

  const loadTags = async () => {
    try {
      setTags(await CrmService.getTags());
    } catch (err) {
      console.error('Erro ao carregar tags:', err);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  const loadClientes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await CrmService.getClientesCRM({
        search: search || undefined,
        estado: filterEstado || undefined,
      });
      setClientes(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar contactos';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadClientes, 300); // debounce search
    return () => clearTimeout(timer);
  }, [search, filterEstado]);

  // Item 4 — filtro por tag (client-side: as tags já vêm no join de getClientesCRM)
  const filtered = useMemo(
    () => clientes.filter(c => !filterTag || (c.tags ?? []).some(t => t.id === filterTag)),
    [clientes, filterTag]
  );

  // Item 4 — criar tag (UNIQUE (organization_id, name) na BD)
  const handleCreateTag = async () => {
    const nome = newTagNome.trim();
    if (!nome) return;
    if (tags.some(t => t.name.toLowerCase() === nome.toLowerCase())) {
      toast.error('Já existe uma tag com esse nome');
      return;
    }
    setSavingTag(true);
    try {
      await CrmService.createTag(nome, newTagCor);
      toast.success('Tag criada');
      setNewTagNome('');
      await loadTags();
    } catch (err) {
      console.error('Erro ao criar tag:', err);
      toast.error('Erro ao criar tag');
    } finally {
      setSavingTag(false);
    }
  };

  // Item 4 — apagar tag (FK ON DELETE CASCADE limpa atribuições;
  // recarrega contactos porque os cards mostram as tags)
  const handleDeleteTag = async (id: string) => {
    setDeletingTagId(id);
    try {
      await CrmService.deleteTag(id);
      if (filterTag === id) setFilterTag('');
      await Promise.all([loadTags(), loadClientes()]);
      toast.success('Tag apagada');
    } catch (err) {
      console.error('Erro ao apagar tag:', err);
      toast.error('Erro ao apagar tag');
    } finally {
      setDeletingTagId(null);
    }
  };

  if (loading && clientes.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={loadClientes}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Contactos</h1>
          <p className="text-sm text-muted-foreground">
            {clientes.length} contacto{clientes.length !== 1 ? 's' : ''} comercial{clientes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => navigate('/clientes')} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Contacto
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Procurar por nome, empresa, email, telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={filterEstado}
          onChange={e => setFilterEstado(e.target.value as CrmEstado | '')}
          className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm"
        >
          <option value="">Todos os estados</option>
          {Object.entries(ESTADO_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        {/* Item 4 — filtro por tag */}
        <select
          value={filterTag}
          onChange={e => setFilterTag(e.target.value)}
          aria-label="Filtrar por tag"
          className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm"
        >
          <option value="">Todas as tags</option>
          {tags.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {/* Alternador de vista: cartões / lista */}
        <div className="flex items-center rounded-lg border border-border overflow-hidden" role="group" aria-label="Tipo de vista">
          <button
            type="button"
            onClick={() => mudarVista('cartoes')}
            aria-label="Vista em cartões"
            aria-pressed={vista === 'cartoes'}
            title="Vista em cartões"
            className={`p-2 transition-colors ${vista === 'cartoes' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => mudarVista('lista')}
            aria-label="Vista em lista"
            aria-pressed={vista === 'lista'}
            title="Vista em lista"
            className={`p-2 transition-colors ${vista === 'lista' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
        <Button variant="outline" onClick={() => setShowTagsModal(true)} className="gap-2">
          <TagIcon className="h-4 w-4" />Tags
        </Button>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="p-4 rounded-full bg-muted mx-auto w-fit">
              <Users className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">
              {search || filterEstado || filterTag ? 'Nenhum contacto encontrado' : 'Nenhum contacto ainda'}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {search || filterEstado
                ? 'Tente ajustar a pesquisa ou filtros.'
                : 'Adicione contactos para começar a usar o CRM.'}
            </p>
          </CardContent>
        </Card>
      ) : vista === 'cartoes' ? (
        /* Vista em cartões compactos (grelha responsiva) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((c) => {
            const estado = ESTADO_CONFIG[c.estado_comercial] ?? ESTADO_CONFIG.novo;
            return (
              <Card
                key={c.id}
                className="hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/crm/contactos/${c.id}`)}
              >
                <CardContent className="p-3 space-y-2">
                  {/* Nome + estado (ponto) */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold truncate leading-tight">{c.nome}</h3>
                    <span className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${estado.dot}`} title={estado.label} />
                  </div>

                  {/* Estado + empresa */}
                  <div className="space-y-1 min-w-0">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${estado.bg} ${estado.cor}`}>
                      {estado.label}
                    </span>
                    {c.empresa && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">{c.empresa}{c.cargo ? ` · ${c.cargo}` : ''}</span>
                      </div>
                    )}
                  </div>

                  {/* Contacto */}
                  {(c.telefone || c.email) && (
                    <div className="space-y-0.5 text-xs text-muted-foreground/80 min-w-0">
                      {c.telefone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span className="truncate">{c.telefone}</span>
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tags (máx. 3 + contador) */}
                  {c.tags && c.tags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {c.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag.id}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                      {c.tags.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{c.tags.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Rodapé: valor potencial + último contacto */}
                  <div className="flex items-end justify-between gap-2 pt-1.5 border-t border-border">
                    <div className="min-w-0">
                      {c.valor_potencial > 0 && (
                        <div className="text-xs font-semibold text-emerald-600 truncate">
                          {formatMZN(c.valor_potencial)}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {timeAgo(c.ultimo_contacto)}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 self-end" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Vista em lista densa */
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          {filtered.map((c) => {
            const estado = ESTADO_CONFIG[c.estado_comercial] ?? ESTADO_CONFIG.novo;
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-secondary/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/crm/contactos/${c.id}`)}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${estado.dot}`} title={estado.label} />

                {/* Nome + empresa */}
                <div className="flex-1 min-w-0 flex items-baseline gap-2">
                  <span className="text-sm font-medium truncate">{c.nome}</span>
                  {c.empresa && (
                    <span className="text-xs text-muted-foreground truncate hidden md:inline">
                      {c.empresa}
                    </span>
                  )}
                </div>

                {/* Tags */}
                {c.tags && c.tags.length > 0 && (
                  <div className="hidden xl:flex items-center gap-1 shrink-0">
                    {c.tags.slice(0, 2).map(tag => (
                      <span
                        key={tag.id}
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                    {c.tags.length > 2 && (
                      <span className="text-[10px] text-muted-foreground">+{c.tags.length - 2}</span>
                    )}
                  </div>
                )}

                {/* Contacto */}
                <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  {c.telefone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {c.telefone}
                    </span>
                  )}
                  {c.email && (
                    <span className="hidden lg:flex items-center gap-1 max-w-[200px]">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </span>
                  )}
                </div>

                {/* Dados comerciais */}
                {c.valor_potencial > 0 && (
                  <span className="text-sm font-semibold text-emerald-600 shrink-0">
                    {formatMZN(c.valor_potencial)}
                  </span>
                )}
                <span className="text-xs text-muted-foreground shrink-0 hidden md:inline">
                  {timeAgo(c.ultimo_contacto)}
                </span>

                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {/* Item 4 — gestão de tags */}
      <Dialog open={showTagsModal} onOpenChange={setShowTagsModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerir Tags</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma tag criada. Crie tags para classificar e filtrar contactos.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {tags.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ backgroundColor: `${t.color}20`, color: t.color }}
                    >
                      {t.name}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteTag(t.id)}
                      disabled={deletingTagId === t.id}
                      aria-label={`Apagar tag ${t.name}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      {deletingTagId === t.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1.5 pt-2 border-t">
              <Label>Nova tag</Label>
              <div className="flex gap-2">
                <Input
                  value={newTagNome}
                  onChange={e => setNewTagNome(e.target.value)}
                  placeholder="Ex: VIP"
                  maxLength={30}
                />
                <Button onClick={handleCreateTag} disabled={savingTag || !newTagNome.trim()}>
                  {savingTag ? 'A criar...' : 'Criar'}
                </Button>
              </div>
              <div className="flex gap-1.5 pt-1.5 flex-wrap">
                {TAG_COLORS.map(cor => (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => setNewTagCor(cor)}
                    className={`h-5 w-5 rounded-full transition-shadow ${newTagCor === cor ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                    style={{ backgroundColor: cor }}
                    aria-label={`Cor ${cor}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

