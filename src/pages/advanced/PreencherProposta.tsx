import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Loader2, Sparkles, Save,
  CheckCircle2, ChevronLeft, ChevronRight, Users,
} from 'lucide-react';
import type {
  AdvancedProposal,
  ProposalSectionAnswer,
  BlueprintWithSections,
  SectionQuestion,
} from '@/types/advancedProposal';
import {
  getAdvancedProposal,
  getSectionAnswers,
  saveSectionAnswers,
  updateAdvancedProposalStatus,
  getBlueprintWithSections,
} from '@/services/advancedProposalService';
import { ClienteService } from '@/services/clienteService';
import type { Cliente } from '@/types';

export default function PreencherProposta() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [proposal, setProposal] = useState<AdvancedProposal | null>(null);
  const [blueprint, setBlueprint] = useState<BlueprintWithSections | null>(null);
  const [answers, setAnswers] = useState<ProposalSectionAnswer[]>([]);
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Client selection
  const [clients, setClients] = useState<Cliente[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  // Load proposal + blueprint + existing answers + clients
  useEffect(() => {
    if (!id) return;
    // Captura const local: o narrowing de `id` não persiste dentro de
    // function declarations hoisted (ver tsc TS2345 anterior)
    const proposalId = id;

    async function load() {
      try {
        const [propData, existingAnswers] = await Promise.all([
          getAdvancedProposal(proposalId),
          getSectionAnswers(proposalId),
        ]);

        if (!propData) {
          toast.error('Proposta nao encontrada');
          navigate('/propostas');
          return;
        }

        setProposal(propData);
        setCurrentIndex(propData.current_section_index);
        if (propData.client_id) setSelectedClientId(propData.client_id);

        if (propData.blueprint_id) {
          const bp = await getBlueprintWithSections(propData.blueprint_id);
          setBlueprint(bp);
        }

        setAnswers(existingAnswers);

        // Load existing answers for current section
        const current = existingAnswers.find(
          (a) => a.section_order === propData.current_section_index
        );
        if (current?.answers) {
          setCurrentAnswers(current.answers as Record<string, string>);
        }

        // Load clients for selection
        try {
          const allClients = await ClienteService.getClientes();
          setClients(allClients);
        } catch {
          // Non-critical
        }
      } catch {
        toast.error('Erro ao carregar proposta');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, navigate]);

  const currentSection = blueprint?.sections[currentIndex] || null;

  // Filter questions by visibility rules
  const visibleQuestions = useMemo(() => {
    if (!currentSection || !blueprint) return [];
    const allQuestions = blueprint.questions[currentSection.id] || [];
    return allQuestions.filter(q => {
      const rules = q.visibility_rules;
      if (!rules?.showIf) return true;
      const { questionId, operator, value } = rules.showIf;
      const answerValue = currentAnswers[questionId] || '';
      switch (operator) {
        case 'equals': return answerValue === value;
        case 'not_equals': return answerValue !== value;
        case 'contains': return answerValue.includes(value);
        case 'not_contains': return !answerValue.includes(value);
        default: return true;
      }
    });
  }, [currentSection, blueprint, currentAnswers]);

  const isLastSection = currentIndex >= (proposal?.total_sections || 0) - 1;
  const isFirstSection = currentIndex === 0;

  const handleAnswerChange = (questionId: string, value: string) => {
    setCurrentAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const saveCurrentSection = useCallback(async (): Promise<boolean> => {
    if (!proposal || !currentSection) return false;

    setSaving(true);
    try {
      await saveSectionAnswers(
        proposal.id,
        currentSection.id,
        currentSection.title,
        currentSection.order,
        currentAnswers
      );
      return true;
    } catch {
      toast.error('Erro ao guardar respostas');
      return false;
    } finally {
      setSaving(false);
    }
  }, [proposal, currentSection, currentAnswers]);

  const switchToSection = useCallback(async (newIndex: number) => {
    if (!proposal || newIndex === currentIndex) return;
    const ok = await saveCurrentSection();
    if (!ok) return;
    setCurrentIndex(newIndex);
    await updateAdvancedProposalStatus(proposal.id, 'em_preenchimento', newIndex);
    const target = answers.find((a) => a.section_order === newIndex);
    setCurrentAnswers((target?.answers as Record<string, string>) || {});
  }, [proposal, currentIndex, saveCurrentSection, answers]);

  const goNext = () => switchToSection(currentIndex + 1);
  const goPrev = () => switchToSection(currentIndex - 1);

  const handleFinish = async () => {
    if (!proposal || !blueprint) return;
    setSaving(true);
    try {
      // Save current section answers
      await saveCurrentSection();

      // Ensure ALL sections have an answer record (needed for AI generation)
      const existingAnswers = await getSectionAnswers(proposal.id);
      const existingSectionIds = new Set(existingAnswers.map(a => a.section_id));

      for (const section of blueprint.sections) {
        if (!existingSectionIds.has(section.id)) {
          await saveSectionAnswers(
            proposal.id,
            section.id,
            section.title,
            section.order,
            {}
          );
        }
      }

      await updateAdvancedProposalStatus(proposal.id, 'em_revisao');
      toast.success('Secções preenchidas! Prossiga para revisao e geracao IA.');
      navigate(`/revisao-proposta/${proposal.id}`);
    } catch {
      toast.error('Erro ao finalizar secções');
    } finally {
      setSaving(false);
    }
  };

  const getQuestionInput = (q: SectionQuestion) => {
    const commonProps = {
      key: q.id,
      value: currentAnswers[q.id] || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        handleAnswerChange(q.id, e.target.value),
      };

    switch (q.question_type) {
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            placeholder={q.placeholder || q.question_text}
            className="min-h-[120px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        );
      case 'number':
        return (
          <input
            {...commonProps}
            type="number"
            placeholder={q.placeholder || q.question_text}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        );
      case 'select': {
        // Parse options from placeholder: "opt1|opt2|opt3"
        const options = (q.placeholder || '').split('|').map(o => o.trim()).filter(Boolean);
        if (options.length === 0) {
          // Fallback to text input
          return (
            <input
              {...commonProps}
              type="text"
              placeholder={q.placeholder || q.question_text}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          );
        }
        return (
          <select
            {...commonProps}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Seleccione...</option>
            {options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      }
      default:
        return (
          <input
            {...commonProps}
            type="text"
            placeholder={q.placeholder || q.question_text}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!proposal || !blueprint || !currentSection) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Dados da proposta nao encontrados</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/propostas')} className="p-2 rounded-lg hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{proposal.title}</h1>
          <p className="text-sm text-muted-foreground">
            {blueprint.category.name} - {blueprint.blueprint.name}
          </p>
        </div>
      </div>

      {/* Client Selection (collapsible) */}
      <details className="rounded-xl border">
        <summary className="px-4 py-3 cursor-pointer flex items-center gap-2 text-sm font-medium hover:bg-muted/50 rounded-t-xl">
          <Users className="h-4 w-4" />
          Cliente Associado
          {selectedClientId ? <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" /> : null}
        </summary>
        <div className="px-4 pb-4">
          <select
            value={selectedClientId}
            onChange={e => setSelectedClientId(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Sem cliente associado</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.nome} - {c.empresa}</option>
            ))}
          </select>
        </div>
      </details>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Secção {currentIndex + 1} de {proposal.total_sections}</span>
          <span>{Math.round(((currentIndex + 1) / proposal.total_sections) * 100)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / proposal.total_sections) * 100}%` }}
          />
        </div>
        <div className="flex gap-1">
          {blueprint.sections.map((s, i) => {
            const ans = answers.find((a) => a.section_order === s.order);
            const hasAnswers = ans && Object.keys(ans.answers as object).length > 0;
            return (
              <button
                key={s.id}
                onClick={() => switchToSection(i)}
                className={`flex-1 h-2 rounded-full transition-colors cursor-pointer hover:opacity-80 ${
                  i === currentIndex
                    ? 'bg-primary'
                    : hasAnswers
                      ? 'bg-green-500'
                      : 'bg-muted'
                }`}
                title={s.title}
              />
            );
          })}
        </div>
      </div>

      {/* Section Content */}
      <div className="rounded-xl border p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold">{currentSection.title}</h2>
          {currentSection.content_rules?.promptHint && (
            <p className="text-sm text-muted-foreground mt-1">
              {currentSection.content_rules.promptHint}
            </p>
          )}
          <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-muted">
            {currentSection.type}
          </span>
        </div>

        {visibleQuestions.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Nenhuma pergunta nesta seccao. Avance para a proxima.
          </p>
        ) : (
          <div className="space-y-4">
            {visibleQuestions.map((q) => (
              <div key={q.id}>
                <label className="block text-sm font-medium mb-1.5">
                  {q.question_text}
                  {q.required && <span className="text-red-500"> *</span>}
                </label>
                {getQuestionInput(q)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={goPrev}
          disabled={isFirstSection || saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border hover:bg-muted disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => saveCurrentSection().then(() => toast.success('Respostas guardadas'))}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border hover:bg-muted disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Guardar
          </button>

          {isLastSection ? (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              Revisao e IA
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Proxima
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}