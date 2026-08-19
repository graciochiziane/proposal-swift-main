import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Sparkles, Eye, CheckCircle2,
  Loader2, Pencil, RotateCcw, Download, FileText,
} from 'lucide-react';
import type {
  AdvancedProposal,
  ProposalSectionAnswer,
  BlueprintWithSections,
  CompanyBrandProfile,
} from '@/types/advancedProposal';
import {
  getAdvancedProposal,
  getSectionAnswers,
  getBlueprintWithSections,
  getBrandProfile,
  saveSectionEditedContent,
  saveSectionAIContent,
  updateAdvancedProposalStatus,
} from '@/services/advancedProposalService';
import { generateSectionContent, generateAllSections } from '@/services/propostaAiSectionService';
import {
  buildProposalDocument,
  openPdfPreview,
  getProposalHtmlBlob,
  exportProposalPdf,
  type ProposalDocument,
} from '@/lib/advanced';
import { useAuth } from '@/hooks/useAuth';
import { ProfileService } from '@/services/profileService';
import { ClienteService } from '@/services/clienteService';

export default function RevisaoProposta() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { organization, user } = useAuth();

  // Data state
  const [proposal, setProposal] = useState<AdvancedProposal | null>(null);
  const [blueprint, setBlueprint] = useState<BlueprintWithSections | null>(null);
  const [answers, setAnswers] = useState<ProposalSectionAnswer[]>([]);
  const [brandProfile, setBrandProfile] = useState<CompanyBrandProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generatingSectionId, setGeneratingSectionId] = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState('');
  const [currentGenIndex, setCurrentGenIndex] = useState(0);
  const [totalGenSections, setTotalGenSections] = useState(0);

  // Edit state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // PDF export state
  const [exportingPdf, setExportingPdf] = useState(false);

  // Load all data
  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const [prop, ans] = await Promise.all([
          getAdvancedProposal(id),
          getSectionAnswers(id),
        ]);
        if (!prop) { toast.error('Proposta nao encontrada'); navigate('/propostas'); return; }
        setProposal(prop);
        setAnswers(ans);

        if (prop.blueprint_id) {
          const bp = await getBlueprintWithSections(prop.blueprint_id);
          setBlueprint(bp);
        }
        if (organization?.id) {
          const bp = await getBrandProfile(organization.id);
          setBrandProfile(bp);
        }
      } catch {
        toast.error('Erro ao carregar proposta');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, navigate, organization?.id]);

  // Company profile
  const [companyProfile, setCompanyProfile] = useState<{ nome: string; empresa: string; contacto: string; nuit: string; endereco: string; logotipo: string } | null>(null);
  // Client info
  const [clientInfo, setClientInfo] = useState<{ name: string; company: string; email: string; phone: string }>({ name: '', company: '', email: '', phone: '' });

  useEffect(() => {
    ProfileService.getProfile().then(profile => {
      if (profile) {
        setCompanyProfile({
          nome: profile.nome, empresa: profile.empresa, contacto: profile.contacto,
          nuit: profile.nuit, endereco: profile.endereco, logotipo: profile.logotipo,
        });
      }
    }).catch((err) => console.error('[RevisaoProposta] Error loading data:', err));
  }, []);

  useEffect(() => {
    if (!proposal?.client_id) return;
    ClienteService.getClienteById(proposal.client_id).then(client => {
      if (client) {
        setClientInfo({ name: client.nome, company: client.empresa, email: client.email, phone: client.telefone });
      }
    }).catch((err) => console.error('[RevisaoProposta] Error loading data:', err));
  }, [proposal?.client_id]);

  const getCompanyInfo = () => ({
    name: companyProfile?.empresa || organization?.nome || 'Empresa',
    description: '',
    contact: companyProfile?.contacto || user?.email || '',
    nuit: companyProfile?.nuit || '',
    address: companyProfile?.endereco || '',
    logo: companyProfile?.logotipo || undefined,
  });

  // Generate ALL sections with AI
  const handleGenerateAll = async () => {
    if (!proposal || !blueprint || !organization) return;

    setGenerating(true);
    const sectionsToGenerate = blueprint.sections.map(sectionDef => {
      const answer = answers.find(a => a.section_id === sectionDef.id);
      const questions = blueprint.questions[sectionDef.id] || [];
      return {
        sectionId: sectionDef.id,
        sectionTitle: sectionDef.title,
        sectionType: sectionDef.type,
        contentRules: sectionDef.content_rules,
        questions,
        answers: answer?.answers as Record<string, string> || {},
        answerId: answer?.id || '',
      };
    });

    setTotalGenSections(sectionsToGenerate.length);

    try {
      await generateAllSections({
        proposalId: proposal.id,
        sections: sectionsToGenerate,
        companyInfo: getCompanyInfo(),
        clientInfo: { name: clientInfo.name, company: clientInfo.company },
        onProgress: (index, total, status) => {
          setCurrentGenIndex(index);
          setGenProgress(`${index + 1}/${total} - ${status}`);
        },
      });

      const updatedAnswers = await getSectionAnswers(proposal.id);
      setAnswers(updatedAnswers);
      toast.success('Proposta gerada com sucesso!');
    } catch (err) {
      toast.error('Erro ao gerar proposta');
    } finally {
      setGenerating(false);
      setGenProgress('');
    }
  };

  // Generate SINGLE section
  const handleGenerateSingle = async (sectionDef: any) => {
    if (!proposal || !blueprint) return;
    const answer = answers.find(a => a.section_id === sectionDef.id);
    if (!answer) { toast.error('Respostas nao encontradas para esta seccao'); return; }

    setGeneratingSectionId(sectionDef.id);
    try {
      // Build previous sections context from already-generated sections
      const previousSections = answers
        .filter(a => a.content_status === 'gerado' || a.content_status === 'editando' || a.content_status === 'revisado')
        .filter(a => a.section_id !== sectionDef.id)
        .map(a => ({ title: a.section_title, content: a.edited_content || a.ai_content || '' }));

      const questions = blueprint.questions[sectionDef.id] || [];
      const result = await generateSectionContent({
        sectionId: sectionDef.id,
        sectionTitle: sectionDef.title,
        sectionType: sectionDef.type,
        contentRules: sectionDef.content_rules,
        questions,
        answers: answer.answers as Record<string, string>,
        companyInfo: getCompanyInfo(),
        clientInfo: { name: clientInfo.name, company: clientInfo.company },
        previousSections,
      });

      await saveSectionAIContent(answer.id, result.content, 'gemini-3.1-flash-lite', 0);
      const updated = await getSectionAnswers(proposal.id);
      setAnswers(updated);
      toast.success(`Seccao "${sectionDef.title}" gerada`);
    } catch (err) {
      toast.error(`Erro ao gerar seccao: ${err instanceof Error ? err.message : 'Desconhecido'}`);
    } finally {
      setGeneratingSectionId(null);
    }
  };

  // Regenerate single section
  const handleRegenerateSection = async (answer: ProposalSectionAnswer) => {
    if (!blueprint || !proposal) return;
    const sectionDef = blueprint.sections.find(s => s.id === answer.section_id);
    if (!sectionDef) return;

    setGeneratingSectionId(answer.section_id);
    try {
      await saveSectionAIContent(answer.id, '', '', 0);

      const questions = blueprint.questions[sectionDef.id] || [];
      const previousSections = answers
        .filter(a => a.section_id !== sectionDef.id && (a.content_status === 'gerado' || a.content_status === 'editando' || a.content_status === 'revisado'))
        .map(a => ({ title: a.section_title, content: a.edited_content || a.ai_content || '' }));

      const result = await generateSectionContent({
        sectionId: sectionDef.id,
        sectionTitle: sectionDef.title,
        sectionType: sectionDef.type,
        contentRules: sectionDef.content_rules,
        questions,
        answers: answer.answers as Record<string, string>,
        companyInfo: getCompanyInfo(),
        clientInfo: { name: clientInfo.name, company: clientInfo.company },
        previousSections,
      });

      await saveSectionAIContent(answer.id, result.content, 'gemini-3.1-flash-lite', 0);
      const updated = await getSectionAnswers(proposal.id);
      setAnswers(updated);
      toast.success('Seccao regenerada');
    } catch {
      toast.error('Erro ao regenerar seccao');
    } finally {
      setGeneratingSectionId(null);
    }
  };

  // Save edited content
  const handleSaveEdit = async (answerId: string) => {
    try {
      await saveSectionEditedContent(answerId, editContent);
      if (proposal) {
        const updated = await getSectionAnswers(proposal.id);
        setAnswers(updated);
      }
      setEditingSectionId(null);
      toast.success('Conteudo guardado');
    } catch {
      toast.error('Erro ao guardar');
    }
  };

  const handleStartEdit = (answer: ProposalSectionAnswer) => {
    const content = answer.edited_content || answer.ai_content || '';
    setEditingSectionId(answer.id);
    setEditContent(content);
  };

  // Build document and open preview
  const handlePreview = () => {
    if (!proposal || !blueprint) return;
    const doc = buildProposalDocument({
      proposalId: proposal.id,
      proposalTitle: proposal.title,
      blueprint,
      answers,
      brandProfile,
      companyInfo: getCompanyInfo(),
      clientInfo: { name: clientInfo.name, company: clientInfo.company, email: clientInfo.email, phone: clientInfo.phone },
    });
    openPdfPreview(doc);
  };

  // Export as native PDF file
  const handleExportPdf = async () => {
    if (!proposal || !blueprint) return;
    setExportingPdf(true);
    try {
      const doc = buildProposalDocument({
        proposalId: proposal.id,
        proposalTitle: proposal.title,
        blueprint,
        answers,
        brandProfile,
        companyInfo: getCompanyInfo(),
        clientInfo: { name: clientInfo.name, company: clientInfo.company, email: clientInfo.email, phone: clientInfo.phone },
      });
      await exportProposalPdf(doc);
      toast.success('PDF exportado com sucesso!');
      // Update proposal status to 'exportada'
      await updateAdvancedProposalStatus(proposal.id, 'exportada');
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Erro ao gerar PDF. Tente usar Pre-visualizar > Imprimir.');
    } finally {
      setExportingPdf(false);
    }
  };

  // Download as HTML file (fallback)
  const handleDownloadHtml = () => {
    if (!proposal || !blueprint) return;
    const doc = buildProposalDocument({
      proposalId: proposal.id,
      proposalTitle: proposal.title,
      blueprint,
      answers,
      brandProfile,
      companyInfo: getCompanyInfo(),
      clientInfo: { name: clientInfo.name, company: clientInfo.company, email: clientInfo.email, phone: clientInfo.phone },
    });
    const blob = getProposalHtmlBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${proposal.title.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Ficheiro HTML descarregado. Abra no browser e imprima como PDF.');
  };

  // Mark as reviewed
  const handleMarkReviewed = async () => {
    if (!proposal) return;
    await updateAdvancedProposalStatus(proposal.id, 'concluida');
    toast.success('Proposta marcada como concluida');
    navigate('/propostas');
  };

  const getSectionStatus = (sectionId: string) => {
    const ans = answers.find(a => a.section_id === sectionId);
    if (!ans) return 'pendente';
    return ans.content_status;
  };

  const getSectionDisplayContent = (answer: ProposalSectionAnswer) => {
    return answer.edited_content || answer.ai_content || '';
  };

  // Count generated sections
  const generatedCount = answers.filter(a =>
    a.content_status === 'gerado' || a.content_status === 'editando' || a.content_status === 'revisado'
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!proposal || !blueprint) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Dados da proposta nao encontrados</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button onClick={() => navigate('/propostas')} className="p-2 rounded-lg hover:bg-muted self-start">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{proposal.title}</h1>
          <p className="text-sm text-muted-foreground">
            {blueprint.category.name} — {blueprint.blueprint.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate(`/proposta-avancada/${id}`)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border hover:bg-muted text-sm">
            <Pencil className="h-4 w-4" />
            Editar Respostas
          </button>
          <button onClick={handlePreview} disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border hover:bg-muted text-sm disabled:opacity-50">
            <Eye className="h-4 w-4" />
            Pre-visualizar
          </button>
          <button onClick={handleExportPdf} disabled={generating || exportingPdf}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm disabled:opacity-50">
            {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {exportingPdf ? 'A gerar PDF...' : 'Exportar PDF'}
          </button>
          <button onClick={handleMarkReviewed} disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" />
            Concluir
          </button>
        </div>
      </div>

      {/* Generation Bar */}
      {generating ? (
        <div className="rounded-xl border p-6 space-y-4 bg-primary/5">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <div>
              <p className="font-semibold">A gerar proposta com IA...</p>
              <p className="text-sm text-muted-foreground">{genProgress}</p>
            </div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${totalGenSections > 0 ? ((currentGenIndex + 1) / totalGenSections) * 100 : 0}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-medium">Conteudo IA</p>
            <p className="text-sm text-muted-foreground">
              {generatedCount} de {blueprint.sections.length} seccoes geradas
            </p>
          </div>
          <button onClick={handleGenerateAll}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm">
            <Sparkles className="h-4 w-4" />
            Gerar Tudo com IA
          </button>
        </div>
      )}

      {/* Sections List */}
      <div className="space-y-4">
        {blueprint.sections.map((sectionDef) => {
          const answer = answers.find(a => a.section_id === sectionDef.id);
          const status = getSectionStatus(sectionDef.id);
          const displayContent = answer ? getSectionDisplayContent(answer) : '';
          const isEditing = editingSectionId === answer?.id;
          const isGeneratingThis = generatingSectionId === sectionDef.id;

          return (
            <div key={sectionDef.id} className="rounded-xl border p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {sectionDef.order}
                  </span>
                  <div>
                    <h3 className="font-semibold">{sectionDef.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                        {sectionDef.type}
                      </span>
                      <StatusBadge status={status} />
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {/* Generate single section */}
                  {answer && status === 'pendente' && !generating && (
                    <button
                      onClick={() => handleGenerateSingle(sectionDef)}
                      disabled={!!generatingSectionId}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
                    >
                      {isGeneratingThis ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      Gerar
                    </button>
                  )}
                  {answer && (status === 'gerado' || status === 'editando' || status === 'revisado') && (
                    <button onClick={() => handleStartEdit(answer)}
                      className="p-2 rounded-lg hover:bg-muted" title="Editar">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {answer && (
                    <button onClick={() => handleRegenerateSection(answer)}
                      className="p-2 rounded-lg hover:bg-muted" title="Regenerar" disabled={!!generatingSectionId}>
                      {isGeneratingThis ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Content display / edit */}
              {isEditing ? (
                <div className="space-y-3">
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className="w-full min-h-[200px] rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono"
                    placeholder="Conteudo da seccao..."
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      {editContent.trim().split(/\s+/).filter(Boolean).length} palavras
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingSectionId(null)}
                        className="px-4 py-2 rounded-lg border hover:bg-muted text-sm">
                        Cancelar
                      </button>
                      <button onClick={() => handleSaveEdit(answer.id)}
                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">
                        Guardar
                      </button>
                    </div>
                  </div>
                </div>
              ) : displayContent ? (
                <div className="text-sm text-muted-foreground max-h-40 overflow-y-auto prose prose-sm max-w-none">
                  <PreviewContent content={displayContent} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Ainda nao gerado. Clique em "Gerar" para esta seccao ou "Gerar Tudo".
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Sub-components ---

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    pendente: { color: 'bg-gray-100 text-gray-600', label: 'Pendente' },
    gerando: { color: 'bg-yellow-100 text-yellow-700', label: 'A gerar...' },
    gerado: { color: 'bg-green-100 text-green-700', label: 'Gerado' },
    editando: { color: 'bg-blue-100 text-blue-700', label: 'Editado' },
    revisado: { color: 'bg-purple-100 text-purple-700', label: 'Revisto' },
    erro: { color: 'bg-red-100 text-red-700', label: 'Erro' },
  };
  const c = config[status] || config.pendente;
  return <span className={`text-xs px-2 py-0.5 rounded-full ${c.color}`}>{c.label}</span>;
}

function PreviewContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let key = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { continue; }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div key={key++} className="flex gap-2">
          <span className="text-primary mt-1">•</span>
          <span>{renderInline(trimmed.slice(2))}</span>
        </div>
      );
    } else if (/^[0-9]+\./.test(trimmed)) {
      elements.push(<div key={key++}>{renderInline(trimmed)}</div>);
    } else if (trimmed.startsWith('|')) {
      if (!/^[|\s-:]+$/.test(trimmed)) {
        elements.push(<div key={key++} className="font-mono text-xs">{trimmed}</div>);
      }
    } else {
      elements.push(<p key={key++}>{renderInline(trimmed)}</p>);
    }
  }

  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}