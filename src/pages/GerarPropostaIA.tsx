import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PropostaService, formatMZN } from '@/services/propostaService';
import { ProfileService } from '@/services/profileService';
import { propostaAiService, SECTION_LABELS, BASE_FIELDS, ADVANCED_FIELDS, TOM_OPTIONS, SECTOR_OPTIONS, FIELD_PLACEHOLDERS, type GeracaoMode, type TomNarrativa, type PropostaAiFields } from '@/services/propostaAiService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Loader2, Sparkles, FileText, RotateCw, Save,
  FileDown, ArrowLeft, Eye, EyeOff, Info, Zap,
  CheckCircle2, ChevronRight,
} from 'lucide-react';
import { calcularTotal } from '@/lib/calculos';
import type { PropostaCompleta } from '@/services/propostaService';
import type { DonoProposta } from '@/types';

export default function GerarPropostaIA() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Data state
  const [proposta, setProposta] = useState<PropostaCompleta | null>(null);
  const [dono, setDono] = useState<DonoProposta | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [mode, setMode] = useState<GeracaoMode>('rapido');
  const [tone, setTone] = useState<TomNarrativa>('formal');
  const [sector, setSector] = useState('Outro');
  const [fields, setFields] = useState<PropostaAiFields>({});
  const [includedSections, setIncludedSections] = useState<Record<string, boolean>>({
    contexto: true, problema: true, solucao: true, beneficios: true,
  });
  const [isGenerating, setIsGenerating] = useState(false);

  // Output state
  const [seccoes, setSeccoes] = useState<Record<string, string> | null>(null);
  const [propostaAiId, setPropostaAiId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});
  const [editBuffer, setEditBuffer] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Auto-detect sector from cotation items
  useEffect(() => {
    if (proposta?.itens) {
      const detected = propostaAiService.detectSector(proposta.itens);
      setSector(detected);
    }
  }, [proposta?.itens]);

  // Load cotation data
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [propData, donoData] = await Promise.all([
          PropostaService.getPropostaById(id as string),
          ProfileService.getProfile(),
        ]);
        setProposta(propData);
        setDono(donoData);
      } catch {
        toast.error('Cotacao nao encontrada');
        navigate('/');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  // Load existing proposal AI if any
  useEffect(() => {
    if (!id) return;
    (async () => {
      const existing = await propostaAiService.getByCotacao(id);
      if (existing) {
        setSeccoes(existing.edited_json || existing.output_json || null);
        setPropostaAiId(existing.id);
        if (existing.mode) setMode(existing.mode);
        if (existing.tone) setTone(existing.tone);
        if (existing.sector) setSector(existing.sector);
        if (existing.input_json) setFields(existing.input_json);
        setStep(3);
      }
    })();
  }, [id]);

  // Pre-fill solution field from cotation items
  const solucaoPreFilled = useMemo(() => {
    if (!proposta?.itens?.length) return '';
    const names = proposta.itens.map(i => i.nome);
    return `Propomos a implementacao de uma solucao composta pelos seguintes modulos: ${names.join(', ')}.`;
  }, [proposta?.itens]);

  const totais = proposta
    ? calcularTotal(proposta.subtotal, proposta.descontoTipo, proposta.descontoValor, proposta.ivaPercentual)
    : { desconto: 0, baseTributavel: 0, iva: 0, total: 0 };

  // ---- Field handlers ----
  const updateField = useCallback((key: string, value: string) => {
    setFields(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  }, []);

  const toggleSection = useCallback((key: string) => {
    setIncludedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ---- Generate ----
  const handleGenerate = async () => {
    if (!id) return;
    setIsGenerating(true);
    setStep(3);

    try {
      const filteredFields: PropostaAiFields = {};
      for (const [key, value] of Object.entries(fields)) {
        if (includedSections[key] && value?.trim()) {
          filteredFields[key] = value;
        }
      }

      // Auto-fill solucao if empty
      if (!filteredFields.solucao && solucaoPreFilled && includedSections.solucao) {
        filteredFields.solucao = solucaoPreFilled;
      }

      const result = await propostaAiService.generate(id, filteredFields, tone, mode, sector);
      setSeccoes(result.seccoes);
      setPropostaAiId(result.id);
      setHasUnsavedChanges(false);
      toast.success('Proposta gerada com sucesso');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar proposta';
      toast.error(msg);
      setStep(2);
    } finally {
      setIsGenerating(false);
    }
  };

  // ---- Regenerate ----
  const handleRegenerate = async () => {
    if (!id) return;
    setIsGenerating(true);

    try {
      const filteredFields: PropostaAiFields = {};
      for (const [key, value] of Object.entries(fields)) {
        if (includedSections[key] && value?.trim()) {
          filteredFields[key] = value;
        }
      }
      if (!filteredFields.solucao && solucaoPreFilled && includedSections.solucao) {
        filteredFields.solucao = solucaoPreFilled;
      }

      const result = await propostaAiService.regenerate(id, filteredFields, tone, mode, sector);
      setSeccoes(result.seccoes);
      setPropostaAiId(result.id);
      setEditMode({});
      setHasUnsavedChanges(false);
      toast.success('Proposta regenerada');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao regenerar';
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // ---- Edit section ----
  const startEdit = (key: string) => {
    setEditBuffer(prev => ({ ...prev, [key]: seccoes?.[key] || '' }));
    setEditMode(prev => ({ ...prev, [key]: true }));
  };

  const cancelEdit = (key: string) => {
    setEditMode(prev => ({ ...prev, [key]: false }));
    setEditBuffer(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const saveEdit = async (key: string) => {
    const newContent = editBuffer[key];
    if (!newContent || !propostaAiId) return;
    setIsSaving(true);
    try {
      const updated = { ...(seccoes || {}), [key]: newContent };
      setSeccoes(updated);
      await propostaAiService.saveEdited(propostaAiId, updated);
      setEditMode(prev => ({ ...prev, [key]: false }));
      setHasUnsavedChanges(false);
      toast.success('Seccao actualizada');
    } catch {
      toast.error('Erro ao guardar');
    } finally {
      setIsSaving(false);
    }
  };

  // ---- Export (Doc A = proposta narrativa, Doc B = cotacao) ----
  const handleExportProposta = () => {
    if (!proposta || !dono || !seccoes) return;
    // TODO: Implementar PDF narrativo com drawNarrativeSections()
    // Por agora, exportar como texto num ficheiro
    const content = buildTextExport(seccoes, proposta.numero || '');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Proposta-${proposta.numero || 'draft'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Proposta exportada (texto)');
  };

  const handleExportCotacao = () => {
    if (!proposta || !dono) return;
    toast.info('Abra a cotacao e use o botao PDF para exportar');
    navigate(`/proposta/${id}`);
  };

  // ---- Build text export ----
  const buildTextExport = (sections: Record<string, string>, ref: string): string => {
    const lines = [
      `PROPOSTA COMERCIAL`,
      `Ref: ${ref}`,
      `Cliente: ${proposta?.clienteSnapshot?.nome || ''}`,
      `${proposta?.clienteSnapshot?.empresa || ''}`,
      ``,
      `---`,
      ``,
    ];

    for (const [key, value] of Object.entries(sections)) {
      lines.push(`${(SECTION_LABELS[key] || key).toUpperCase()}`);
      lines.push('');
      lines.push(value);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  };

  // ---- Loading ----
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">A carregar cotacao...</p>
      </div>
    );
  }

  if (!proposta) return null;

  const activeSections = mode === 'rapido' ? BASE_FIELDS : [...BASE_FIELDS, ...ADVANCED_FIELDS];
  const clienteName = proposta.clienteSnapshot?.nome || proposta.clienteSnapshot?.empresa || 'Cliente';

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Breadcrumb header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={function() { navigate('/proposta/' + id); }} className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          {proposta.numero}
        </button>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">Gerar Proposta IA</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gerar Proposta Comercial</h1>
          <p className="text-sm text-muted-foreground">Proposta narrativa com IA para {clienteName}</p>
        </div>
        {hasUnsavedChanges && (
          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
            Alteracoes por guardar
          </Badge>
        )}
      </div>

      {/* Cotation context banner */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Cotacao de Referencia</p>
            <p className="text-xs text-muted-foreground mt-0.5">Os dados desta cotacao serao usados automaticamente pela IA.</p>
            <div className="flex items-center gap-6 mt-2 flex-wrap">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cliente</p>
                <p className="text-sm font-medium">{clienteName}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Items</p>
                <p className="text-sm font-medium">{proposta.itens.length} modulos</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                <p className="text-sm font-bold text-primary">{formatMZN(totais.total)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</p>
                <Badge variant="secondary" className="text-[10px] capitalize">{proposta.status}</Badge>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/proposta/' + id)}>
            Ver Cotacao
          </Button>
        </CardContent>
      </Card>

      {/* ====== STEP 1: Configuration ====== */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">1</span>
            <div>
              <CardTitle className="text-base">Configuracao da Proposta</CardTitle>
              <CardDescription>Defina o nivel de detalhe, sector e tom da narrativa.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Mode toggle */}
          <div>
            <Label className="text-sm font-medium">Modo de Geracao</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <button
                onClick={() => setMode('rapido')}
                className={
                  (mode === 'rapido'
                    ? 'relative border-2 border-primary rounded-xl p-4 text-left transition-all bg-primary/5'
                    : 'relative border-2 border-border rounded-xl p-4 text-left transition-all hover:border-primary/30')
                }
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">Rapido</span>
                  <Badge variant="secondary" className="text-[10px]">Padrao</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Preencha apenas os campos essenciais. A IA completa o restante.</p>
                <div className="mt-2 flex gap-1">
                  <Badge variant="outline" className="text-[10px]">4 campos</Badge>
                  <Badge variant="outline" className="text-[10px]">~1 min</Badge>
                </div>
              </button>
              <button
                onClick={() => setMode('assertivo')}
                className={
                  (mode === 'assertivo'
                    ? 'relative border-2 border-primary rounded-xl p-4 text-left transition-all bg-primary/5'
                    : 'relative border-2 border-border rounded-xl p-4 text-left transition-all hover:border-primary/30')
                }
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">Assertivo</span>
                  <Badge variant="secondary" className="text-[10px]">Detalhado</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Controle cada seccao da proposta. Maior assertividade.</p>
                <div className="mt-2 flex gap-1">
                  <Badge variant="outline" className="text-[10px]">9 campos</Badge>
                  <Badge variant="outline" className="text-[10px]">~5 min</Badge>
                </div>
              </button>
            </div>
          </div>

          <Separator />

          {/* Sector + Tone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <Label className="text-sm font-medium">Sector do Cliente</Label>
              <div className="flex items-center gap-1.5 mt-1 mb-2">
                <Info className="h-3 w-3 text-green-500" />
                <span className="text-xs text-green-600">Detectado automaticamente</span>
              </div>
              <select
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background"
                value={sector}
                onChange={e => setSector(e.target.value)}
              >
                {SECTOR_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-sm font-medium">Tom da Narrativa</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">Define o estilo de linguagem.</p>
              <div className="grid grid-cols-2 gap-2">
                {TOM_OPTIONS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTone(t.value)}
                    className={
                      (tone === t.value
                        ? 'border-2 border-primary rounded-lg px-3 py-2 text-left transition-all bg-primary/5'
                        : 'border-2 border-border rounded-lg px-3 py-2 text-left transition-all hover:border-primary/30')
                    }
                  >
                    <p className="text-xs font-semibold">{t.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ====== STEP 2: Dynamic Fields ====== */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">2</span>
            <div>
              <CardTitle className="text-base">Campos da Proposta</CardTitle>
              <CardDescription>
                Modo {mode === 'rapido' ? 'Rapido — 4 campos essenciais' : 'Assertivo — 9 campos disponiveis'}.
                Campos omitidos nao aparecerao no documento.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {activeSections.map(key => {
            const isRequired = BASE_FIELDS.includes(key as typeof BASE_FIELDS[number]);
            const isAdvanced = ADVANCED_FIELDS.includes(key as typeof ADVANCED_FIELDS[number]);
            const isIncluded = includedSections[key] !== false;

            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    {SECTION_LABELS[key] || key}
                    {isRequired ? (
                      <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">Obrigatorio</Badge>
                    ) : isAdvanced ? (
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-600 border-amber-200">Opcional</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Opcional</Badge>
                    )}
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={isIncluded}
                      onCheckedChange={() => toggleSection(key)}
                      className="scale-75"
                    />
                    <span className="text-xs text-muted-foreground">{isIncluded ? 'Incluir' : 'Omitir'}</span>
                  </div>
                </div>
                <Textarea
                  rows={key === 'condicoes' || key === 'cronograma' ? 2 : 3}
                  className="resize-none text-sm"
                  placeholder={FIELD_PLACEHOLDERS[key] || ''}
                  value={fields[key] || ''}
                  onChange={e => updateField(key, e.target.value)}
                  disabled={!isIncluded}
                />
                {key === 'solucao' && isIncluded && !fields[key] && solucaoPreFilled && (
                  <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Sera pre-preenchido com os modulos da Cotacao.
                  </p>
                )}
              </div>
            );
          })}

          {mode === 'assertivo' && (
            <Fragment>
              <Separator className="my-2" />
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-500 text-white text-[10px]">PRO</Badge>
                <span className="text-xs text-muted-foreground">Campos avancados (Modo Assertivo)</span>
              </div>
            </Fragment>
          )}
        </CardContent>
      </Card>

      {/* ====== Action Bar ====== */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-card rounded-xl border border-border p-4 sticky bottom-4 shadow-lg">
        <div className="flex items-center gap-2">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || ((!fields.contexto?.trim()) && (!fields.problema?.trim()))}
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {seccoes && !isGenerating ? 'Regenerar Proposta IA' : 'Gerar Proposta IA'}
          </Button>
          {seccoes && !isGenerating && (
            <Button variant="outline" onClick={handleRegenerate} className="gap-2">
              <RotateCw className="h-4 w-4" />
              Regenerar
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {seccoes && !isGenerating && (
            <Fragment>
              <Button variant="outline" size="sm" onClick={handleExportCotacao} className="gap-1.5">
                <FileDown className="h-3.5 w-3.5" />
                Cotacao (PDF)
              </Button>
              <Button size="sm" onClick={handleExportProposta} className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Proposta
              </Button>
            </Fragment>
          )}
          <Button variant="ghost" size="sm" onClick={function() { navigate('/proposta/' + id); }}>
            Cancelar
          </Button>
        </div>
      </div>

      {/* ====== STEP 3: Generated Preview ====== */}
      {isGenerating && (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
            <p className="font-semibold">A gerar proposta...</p>
            <p className="text-sm text-muted-foreground mt-1">A IA esta a analisar os dados e criar a narrativa.</p>
          </CardContent>
        </Card>
      )}

      {seccoes && !isGenerating && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-bold">3</span>
                <div>
                  <CardTitle className="text-base">Rascunho da Proposta</CardTitle>
                  <CardDescription>Revise e edite cada seccao antes de exportar.</CardDescription>
                </div>
              </div>
              <Badge className="bg-green-500/10 text-green-600 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Gerado pela IA
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-border">
            {Object.entries(seccoes).map(([key, content]) => {
              const isEditing = editMode[key];
              const displayContent = isEditing ? (editBuffer[key] || '') : content;

              return (
                <div key={key} className="py-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <span className="text-primary">{Object.keys(seccoes).indexOf(key) + 1}.</span>
                      {SECTION_LABELS[key] || key}
                    </h3>
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => cancelEdit(key)}>
                            Cancelar
                          </Button>
                          <Button size="sm" onClick={() => saveEdit(key)} disabled={isSaving}>
                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            Guardar
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => startEdit(key)} className="gap-1 text-primary hover:text-primary">
                          <FileText className="h-3 w-3" />
                          Editar
                        </Button>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <Textarea
                      rows={6}
                      value={displayContent}
                      onChange={e => setEditBuffer(prev => ({ ...prev, [key]: e.target.value }))}
                      className="text-sm resize-y"
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {content}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
