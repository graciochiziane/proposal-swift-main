// ============================================================
// Template Manager — Página de importação de templates HTML
//
// Admin cria HTML externamente (VS Code, etc.) e cola aqui.
// Preview com dados de exemplo. Save → disponível para a org.
// ============================================================

import { useState, useEffect, useRef } from 'react';
import {
  Plus, Save, Trash2, Eye, Loader2,
  FileCode, Code, Upload,
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { html as htmlLang } from '@codemirror/lang-html';
import { EditorView } from '@codemirror/view';
import { PdfTemplateService, AVAILABLE_PLACEHOLDERS, renderTemplatePreview } from '@/services/pdfTemplateService';
import type { PdfTemplate } from '@/services/pdfTemplateService';
import type { Proposta, Cliente, DonoProposta } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// Dados de exemplo para preview
const SAMPLE_PROPOSTA: Proposta = {
  id: 'sample', numero: 'PROP-202608-0001', data: '2026-08-14',
  subtotal: 100000, descontoTipo: 'percentual', descontoValor: 10000,
  ivaPercentual: 16, total: 104400, observacoes: 'Proposta válida por 30 dias.',
  itens: [
    { id: '1', nome: 'Desenvolvimento de Website', quantidade: 1, precoUnitario: 80000, subtotal: 80000 },
    { id: '2', nome: 'Hosting (12 meses)', quantidade: 1, precoUnitario: 20000, subtotal: 20000 },
  ],
} as Proposta;

const SAMPLE_CLIENTE: Cliente = {
  id: 'sample', nome: 'João Silva', empresa: 'Empresa XYZ Lda',
  email: 'joao@xyz.co.mz', telefone: '84 123 4567',
  nuit: '1002003004', endereco: 'Av. Julius Nyerere, Maputo',
};

const SAMPLE_EMPRESA: DonoProposta = {
  nome: 'PropostaJá', cargo: 'Director Comercial', empresa: 'PropostaJá Lda',
  contacto: '+258 84 000 0000', nuit: '4005006007', endereco: 'Maputo, Moçambique',
  logotipo: '', corPrimaria: '#0B5394',
  email: 'contacto@propostaja.com', telefone: '+258 84 000 0000',
  dadosBancarios: { ativo: false, banco: '', numeroConta: '', nib: '' },
  mobileMoney: {
    mpesa: { ativo: false, numero: '' },
    emola: { ativo: false, numero: '' },
    mkesh: { ativo: false, numero: '' },
  },
};

const DEFAULT_TEMPLATE = `<style>
body { font-family: Arial, sans-serif; margin: 0; padding: 40px; color: #333; }
.header { border-bottom: 3px solid #0B5394; padding-bottom: 20px; margin-bottom: 30px; }
.header h1 { color: #0B5394; margin: 0; font-size: 28px; }
.header p { color: #666; margin: 5px 0 0 0; }
.cliente { margin-bottom: 30px; }
.cliente h2 { font-size: 14px; color: #999; margin: 0 0 5px 0; text-transform: uppercase; }
table { width: 100%; border-collapse: collapse; margin: 20px 0; }
th { background: #0B5394; color: white; padding: 10px; text-align: left; font-size: 13px; }
td { padding: 10px; border-bottom: 1px solid #ddd; font-size: 13px; }
.totais { text-align: right; margin-top: 20px; }
.totais .linha { margin: 5px 0; font-size: 14px; }
.totais .total { font-size: 22px; color: #0B5394; font-weight: bold; }
.footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px; color: #999; }
</style>

<div class="header">
  <h1>PROPOSTA {{proposta.numero}}</h1>
  <p>{{proposta.data}}</p>
</div>

<div class="cliente">
  <h2>Cliente</h2>
  <p><strong>{{cliente.nome}}</strong></p>
  <p>{{cliente.empresa}}</p>
  <p>{{cliente.telefone}} | {{cliente.email}}</p>
  <p>NUIT: {{cliente.nuit}}</p>
</div>

{{{items}}}

<div class="totais">
  <div class="linha">Subtotal: {{proposta.subtotal}}</div>
  <div class="linha">Desconto: {{proposta.desconto}}</div>
  <div class="linha">IVA (16%): {{proposta.iva}}</div>
  <div class="total">Total: {{proposta.total}}</div>
</div>

<p>{{observacoes}}</p>

<div class="footer">
  <p>{{empresa.nome}} | NUIT: {{empresa.nuit}} | {{empresa.endereco}}</p>
  <p>{{empresa.email}} | {{empresa.telefone}}</p>
</div>`;

export default function TemplateManager() {
  const [templates, setTemplates] = useState<PdfTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [html, setHtml] = useState(DEFAULT_TEMPLATE);
  const [planTier, setPlanTier] = useState<'free' | 'pro' | 'business'>('free');
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await PdfTemplateService.getTemplates();
      setTemplates(data);
    } catch (err) {
      toast.error('Erro ao carregar templates');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTemplates(); }, []);

  const handleSave = async () => {
    if (!nome.trim() || !html.trim()) {
      toast.error('Nome e HTML são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await PdfTemplateService.updateTemplate(editingId, { nome, descricao, html, plan_tier: planTier });
        toast.success('Template actualizado');
      } else {
        await PdfTemplateService.createTemplate({ nome, descricao, html, plan_tier: planTier });
        toast.success('Template criado');
      }
      setShowEditor(false);
      setEditingId(null);
      setNome('');
      setDescricao('');
      setHtml(DEFAULT_TEMPLATE);
      loadTemplates();
    } catch (err) {
      toast.error('Erro ao salvar template');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (t: PdfTemplate) => {
    setEditingId(t.id);
    setNome(t.nome);
    setDescricao(t.descricao);
    setHtml(t.html);
    setPlanTier(t.plan_tier);
    setShowEditor(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este template?')) return;
    try {
      await PdfTemplateService.deleteTemplate(id);
      toast.success('Template eliminado');
      loadTemplates();
    } catch {
      toast.error('Erro ao eliminar');
    }
  };

  const handlePreview = () => {
    const filled = renderTemplatePreview(html, SAMPLE_PROPOSTA, SAMPLE_CLIENTE, SAMPLE_EMPRESA);
    if (previewRef.current) {
      previewRef.current.innerHTML = filled;
    }
    setShowPreview(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Templates de Proposta (HTML)</h1>
          <p className="text-sm text-muted-foreground">
            Importe templates HTML criados externamente (VS Code, CodePen, etc.)
          </p>
        </div>
        {!showEditor && (
          <Button onClick={() => { setShowEditor(true); setEditingId(null); setNome(''); setDescricao(''); setHtml(DEFAULT_TEMPLATE); }} className="gap-2">
            <Plus className="h-4 w-4" /> Importar Template
          </Button>
        )}
      </div>

      {/* Editor */}
      {showEditor && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Code className="h-5 w-5" />
              {editingId ? 'Editar Template' : 'Importar Novo Template'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Nome + descrição */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Clássico Azul" />
              </div>
              <div className="space-y-1.5">
                <Label>Plano</Label>
                <select
                  value={planTier}
                  onChange={e => setPlanTier(e.target.value as 'free' | 'pro' | 'business')}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm"
                >
                  <option value="free">Free (todos)</option>
                  <option value="pro">Pro</option>
                  <option value="business">Business</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Template clássico com cabeçalho azul" />
            </div>

            {/* HTML Code Editor — CodeMirror 6 com syntax highlight */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>HTML do Template *</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handlePreview} className="gap-1">
                    <Eye className="h-3.5 w-3.5" /> Pré-visualizar
                  </Button>
                </div>
              </div>
              <div className="border border-border rounded-lg overflow-hidden">
                <CodeMirror
                  value={html}
                  onChange={value => setHtml(value)}
                  extensions={[htmlLang(), EditorView.lineWrapping]}
                  theme="light"
                  height="400px"
                  basicSetup={{
                    lineNumbers: true,
                    highlightActiveLine: true,
                    autocompletion: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    indentOnInput: true,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Crie o HTML no seu editor preferido (VS Code, CodePen, etc.) e cole aqui.
                Use <code className="bg-muted px-1 rounded">{'{{placeholders}}'}</code> para dados dinâmicos.
              </p>
            </div>

            {/* Placeholders reference */}
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground font-medium">
                Ver placeholders disponíveis ({AVAILABLE_PLACEHOLDERS.length})
              </summary>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {AVAILABLE_PLACEHOLDERS.map(p => (
                  <div key={p.placeholder} className="flex items-start gap-2 text-xs">
                    <code className="bg-muted px-1.5 py-0.5 rounded text-primary shrink-0">{p.placeholder}</code>
                    <span className="text-muted-foreground">{p.description}</span>
                  </div>
                ))}
              </div>
            </details>

            {/* Preview */}
            {showPreview && (
              <div className="space-y-2">
                <Label>Pré-visualização (com dados de exemplo)</Label>
                <div
                  ref={previewRef}
                  className="border border-border rounded-lg p-4 bg-white overflow-auto max-h-[600px]"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowEditor(false); setEditingId(null); }}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving || !nome.trim() || !html.trim()} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingId ? 'Actualizar' : 'Salvar Template'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {!showEditor && (
        <>
          {templates.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                <div className="p-4 rounded-full bg-muted mx-auto w-fit">
                  <FileCode className="h-10 w-10 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold">Nenhum template ainda</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Crie templates HTML externamente e importe-os para o PropostaJá.
                  Use placeholders como <code className="bg-muted px-1 rounded">{'{{cliente.nome}}'}</code> para dados dinâmicos.
                </p>
                <Button onClick={() => setShowEditor(true)} className="gap-2">
                  <Upload className="h-4 w-4" /> Importar primeiro template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {templates.map(t => (
                <Card key={t.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold">{t.nome}</h3>
                        {t.is_system && <Badge variant="secondary">Sistema</Badge>}
                        <Badge variant="outline" className="capitalize">{t.plan_tier}</Badge>
                      </div>
                      {t.descricao && <p className="text-sm text-muted-foreground truncate">{t.descricao}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(t)} className="gap-1">
                        <Code className="h-4 w-4" /> Editar
                      </Button>
                      {!t.is_system && (
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)} className="text-red-500 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
