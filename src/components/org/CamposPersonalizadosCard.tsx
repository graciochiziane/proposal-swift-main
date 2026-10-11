// ============================================================
// CamposPersonalizadosCard — gestão dos campos personalizados
// da organização (aba Perfil da Empresa)
//
// Permite ao tenant criar/editar/activar/remover campos key→value
// que alimentam os templates PDF personalizados (ex.: talaService
// consume payment_instructions, bank_name, nib, cidade, pais,
// whatsapp, payment_method_display, payment_contact_name).
//
// - Chave técnica: normalizada da label (minúsculas/underscore),
//   editável; estável para os templates (a label pode mudar).
// - Validação por tipo no módulo puro camposPersonalizados.
// - Escrita passa pela RLS (owner/admin da org); canEdit esconde
//   os controlos de escrita de membros comuns.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Save, Power, Trash2, Pencil, RefreshCw, X } from 'lucide-react';
import {
  OrganizationCustomFieldService,
  type OrganizationCustomField,
} from '@/services/organizationCustomFieldService';
import {
  TIPOS_CAMPO,
  normalizarChaveCampo,
  type TipoCampoPersonalizado,
} from '@/lib/camposPersonalizados';

interface Props {
  organizationId: string;
  canEdit: boolean;
}

interface FormularioCampo {
  id?: string; // presente em edição
  label: string;
  field_key: string;
  field_type: TipoCampoPersonalizado;
  value: string;
  chaveManual: boolean; // usuário editou a chave explicitamente
}

const FORMULARIO_VAZIO: FormularioCampo = {
  label: '',
  field_key: '',
  field_type: 'texto',
  value: '',
  chaveManual: false,
};

const ROTULOS_TIPO: Record<TipoCampoPersonalizado, string> = {
  texto: 'Texto',
  numero: 'Número',
  telefone: 'Telefone',
  email: 'Email',
  url: 'URL',
  data: 'Data',
  multilinha: 'Texto longo',
};

export default function CamposPersonalizadosCard({ organizationId, canEdit }: Props) {
  const [campos, setCampos] = useState<OrganizationCustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState<FormularioCampo>(FORMULARIO_VAZIO);
  const [formAberto, setFormAberto] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setCampos(await OrganizationCustomFieldService.listar(organizationId));
    } catch (err) {
      toast.error('Erro ao carregar campos personalizados: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { carregar(); }, [carregar]);

  // auto-sugerir a chave técnica a partir da label
  useEffect(() => {
    if (!form.chaveManual && !form.id) {
      setForm(f => ({ ...f, field_key: normalizarChaveCampo(f.label) }));
    }
  }, [form.label, form.chaveManual, form.id]);

  const tipoCampo = useMemo(
    () => form.field_type === 'multilinha' || form.field_type === 'texto',
    [form.field_type],
  );

  const handleGuardar = async () => {
    if (!form.label.trim()) {
      toast.error('Indique o nome do campo');
      return;
    }
    if (!form.field_key.trim()) {
      toast.error('Indique a chave técnica (pode ser gerada a partir do nome)');
      return;
    }
    setSalvando(true);
    try {
      if (form.id) {
        // edição: a field_key é estável (não se altera — referências dos templates)
        await OrganizationCustomFieldService.actualizar(form.id, {
          label: form.label.trim(),
          value: form.value,
          field_type: form.field_type,
        });
        toast.success('Campo actualizado');
      } else {
        await OrganizationCustomFieldService.criar({
          organization_id: organizationId,
          field_key: form.field_key.trim(),
          label: form.label.trim(),
          field_type: form.field_type,
          value: form.value,
        });
        toast.success('Campo criado');
      }
      setForm(FORMULARIO_VAZIO);
      setFormAberto(false);
      await carregar();
    } catch (err) {
      toast.error((err instanceof Error ? err.message : 'Erro ao guardar o campo'));
    } finally {
      setSalvando(false);
    }
  };

  const handleEditar = (campo: OrganizationCustomField) => {
    setForm({
      id: campo.id,
      label: campo.label,
      field_key: campo.field_key,
      field_type: campo.field_type,
      value: campo.value,
      chaveManual: true, // edição não reescreve a chave
    });
    setFormAberto(true);
  };

  const handleToggleActivo = async (campo: OrganizationCustomField) => {
    setBusyId(campo.id);
    try {
      await OrganizationCustomFieldService.definirActivo(campo.id, !campo.is_active);
      toast.success(campo.is_active ? 'Campo desactivado (oculto para os templates)' : 'Campo activado');
      await carregar();
    } catch (err) {
      toast.error('Erro ao alterar estado: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setBusyId(null);
    }
  };

  const handleRemover = async (campo: OrganizationCustomField) => {
    if (!window.confirm(`Remover o campo "${campo.label}" (${campo.field_key})?`)) return;
    setBusyId(campo.id);
    try {
      await OrganizationCustomFieldService.remover(campo.id);
      toast.success('Campo removido');
      await carregar();
    } catch (err) {
      toast.error('Erro ao remover: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base">Campos Personalizados</CardTitle>
          <CardDescription>
            Informações adicionais da organização que os modelos de documento podem usar
            (ex.: instruções de pagamento, banco, NIB, cidade, WhatsApp). O template
            «Cotação Corporativa (Tala Service)» consome estes campos.
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={carregar} title="Recarregar">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">A carregar...</p>
        ) : campos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Sem campos personalizados — crie o primeiro com o botão abaixo.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                {canEdit && <TableHead className="text-right">Acções</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {campos.map(c => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.label}</div>
                    <div className="text-xs font-mono text-muted-foreground">{c.field_key}</div>
                  </TableCell>
                  <TableCell className="max-w-[240px]">
                    <span className="text-sm block truncate" title={c.value}>{c.value || '—'}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{ROTULOS_TIPO[c.field_type] ?? c.field_type}</Badge>
                  </TableCell>
                  <TableCell>
                    {c.is_active ? (
                      <Badge variant="outline" className="text-green-600 border-green-500/30">Activo</Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 gap-1" disabled={busyId === c.id}
                          onClick={() => handleEditar(c)} title="Editar campo">
                          <Pencil className="h-3 w-3" /> Editar
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 gap-1" disabled={busyId === c.id}
                          onClick={() => handleToggleActivo(c)}>
                          <Power className="h-3 w-3" /> {c.is_active ? 'Desactivar' : 'Activar'}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          disabled={busyId === c.id} onClick={() => handleRemover(c)} title="Remover campo">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {canEdit && (
          <div>
            {formAberto ? (
              <div className="rounded-md border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{form.id ? 'Editar campo' : 'Novo campo'}</p>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setForm(FORMULARIO_VAZIO); setFormAberto(false); }} title="Cancelar">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="campo-label">Nome do campo</Label>
                    <Input id="campo-label" value={form.label}
                      onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                      placeholder="Ex.: Instruções de pagamento" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="campo-chave">
                      Chave técnica {form.id && <span className="text-xs text-muted-foreground">(fixa após criação)</span>}
                    </Label>
                    <Input id="campo-chave" value={form.field_key} className="font-mono"
                      disabled={!!form.id}
                      onChange={e => setForm(f => ({ ...f, field_key: e.target.value, chaveManual: true }))}
                      placeholder="ex.: payment_instructions" />
                    <p className="text-xs text-muted-foreground">
                      Gerada a partir do nome; é o identificador estável usado pelos templates.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="campo-tipo">Tipo</Label>
                    <select id="campo-tipo" className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={form.field_type}
                      onChange={e => setForm(f => ({ ...f, field_type: e.target.value as TipoCampoPersonalizado }))}>
                      {TIPOS_CAMPO.map(t => (
                        <option key={t} value={t}>{ROTULOS_TIPO[t]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="campo-valor">Valor</Label>
                    {tipoCampo ? (
                      <Textarea id="campo-valor" value={form.value} rows={2}
                        onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                        placeholder="Conteúdo do campo" />
                    ) : (
                      <Input id="campo-valor" value={form.value}
                        onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                        placeholder={form.field_type === 'email' ? 'empresa@exemplo.co.mz' : form.field_type === 'url' ? 'https://…' : form.field_type === 'data' ? '2026-01-31' : ''} />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={handleGuardar} disabled={salvando} className="gap-2">
                    <Save className="h-4 w-4" /> {salvando ? 'A guardar…' : 'Guardar campo'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" onClick={() => { setForm(FORMULARIO_VAZIO); setFormAberto(true); }} className="gap-2">
                <Plus className="h-4 w-4" /> Adicionar campo
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
