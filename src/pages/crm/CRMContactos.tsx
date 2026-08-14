// ============================================================
// CRM Contactos — Lista de contactos com dados CRM
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Loader2, AlertCircle, Users, ChevronRight,
  Phone, Mail, Building2, Clock,
} from 'lucide-react';
import { CrmService, type ClienteWithCRM, type CrmEstado } from '@/services/crmService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatMZN } from '@/services/propostaService';
import { toast } from 'sonner';

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

export default function CRMContactos() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<ClienteWithCRM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<CrmEstado | ''>('');

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

  const filtered = useMemo(() => clientes, [clientes]);

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
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Contactos CRM</h1>
          <p className="text-sm text-muted-foreground">
            {clientes.length} contacto{clientes.length !== 1 ? 's' : ''}
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
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="p-4 rounded-full bg-muted mx-auto w-fit">
              <Users className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">
              {search || filterEstado ? 'Nenhum contacto encontrado' : 'Nenhum contacto ainda'}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {search || filterEstado
                ? 'Tente ajustar a pesquisa ou filtros.'
                : 'Adicione contactos para começar a usar o CRM.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        /* List */
        <div className="space-y-3">
          {filtered.map((c) => {
            const estado = ESTADO_CONFIG[c.estado_comercial] ?? ESTADO_CONFIG.novo;
            return (
              <Card
                key={c.id}
                className="hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/crm/contactos/${c.id}`)}
              >
                <CardContent className="p-4 md:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Nome + estado */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold truncate">{c.nome}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${estado.bg} ${estado.cor}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${estado.dot}`} />
                          {estado.label}
                        </span>
                      </div>

                      {/* Empresa */}
                      {c.empresa && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                          <Building2 className="h-3.5 w-3.5" />
                          <span className="truncate">{c.empresa}</span>
                          {c.cargo && <span className="text-xs">· {c.cargo}</span>}
                        </div>
                      )}

                      {/* Contacto */}
                      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground/70">
                        {c.telefone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {c.telefone}
                          </span>
                        )}
                        {c.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {c.email}
                          </span>
                        )}
                      </div>

                      {/* Tags */}
                      {c.tags && c.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap mt-2">
                          {c.tags.map(tag => (
                            <span
                              key={tag.id}
                              className="px-2 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right: commercial data */}
                    <div className="text-right shrink-0 space-y-1">
                      {c.valor_potencial > 0 && (
                        <div>
                          <div className="text-sm font-semibold text-emerald-600">
                            {formatMZN(c.valor_potencial)}
                          </div>
                          <div className="text-xs text-muted-foreground">Valor potencial</div>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
                        <Clock className="h-3 w-3" />
                        {timeAgo(c.ultimo_contacto)}
                      </div>
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
