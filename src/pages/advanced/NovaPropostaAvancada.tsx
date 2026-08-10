import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, Monitor, Briefcase, HardHat, Loader2,
  Building2, Stethoscope, GraduationCap, ShoppingBag, Truck,
  Landmark, Wrench, Users, ChevronDown, Search, Sparkles,
} from 'lucide-react';
import type { BusinessCategory, ProposalBlueprint } from '@/types/advancedProposal';
import type { Cliente } from '@/types';
import {
  getBusinessCategories,
  getBlueprintsByCategory,
  getBlueprintWithSections,
  createAdvancedProposal,
} from '@/services/advancedProposalService';
import { ClienteService } from '@/services/clienteService';
import { useAuth } from '@/hooks/useAuth';

// Extended icon map for all possible categories
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Monitor: <Monitor className="h-8 w-8" />,
  Briefcase: <Briefcase className="h-8 w-8" />,
  HardHat: <HardHat className="h-8 w-8" />,
  Building2: <Building2 className="h-8 w-8" />,
  Stethoscope: <Stethoscope className="h-8 w-8" />,
  GraduationCap: <GraduationCap className="h-8 w-8" />,
  ShoppingBag: <ShoppingBag className="h-8 w-8" />,
  Truck: <Truck className="h-8 w-8" />,
  Landmark: <Landmark className="h-8 w-8" />,
  Wrench: <Wrench className="h-8 w-8" />,
  Users: <Users className="h-8 w-8" />,
};

export default function NovaPropostaAvancada() {
  const navigate = useNavigate();
  const { organization } = useAuth();
  const [step, setStep] = useState<'category' | 'blueprint' | 'client' | 'loading'>('category');
  const [categories, setCategories] = useState<BusinessCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<BusinessCategory | null>(null);
  const [blueprints, setBlueprints] = useState<ProposalBlueprint[]>([]);
  const [selectedBlueprint, setSelectedBlueprint] = useState<ProposalBlueprint | null>(null);
  const [loading, setLoading] = useState(false);

  // Client selection
  const [clients, setClients] = useState<Cliente[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientSearch, setClientSearch] = useState('');
  const [loadingClients, setLoadingClients] = useState(false);

  // Proposal title
  const [proposalTitle, setProposalTitle] = useState('');

  useEffect(() => {
    getBusinessCategories()
      .then(setCategories)
      .catch(() => toast.error('Erro ao carregar categorias'));
  }, []);

  const handleSelectCategory = async (cat: BusinessCategory) => {
    setSelectedCategory(cat);
    setStep('loading');
    try {
      const bps = await getBlueprintsByCategory(cat.id);
      setBlueprints(bps);
      setStep('blueprint');
    } catch {
      toast.error('Erro ao carregar blueprints');
      setStep('category');
    }
  };

  const handleSelectBlueprint = async (bp: ProposalBlueprint) => {
    setSelectedBlueprint(bp);
    // Load clients for next step
    setLoadingClients(true);
    try {
      const allClients = await ClienteService.getClientes();
      setClients(allClients);
    } catch {
      // Non-critical
    } finally {
      setLoadingClients(false);
    }
    setProposalTitle(`${bp.name} - Proposta`);
    setStep('client');
  };

  const handleCreate = async () => {
    if (!selectedBlueprint) return;
    setLoading(true);
    try {
      const fullBp = await getBlueprintWithSections(selectedBlueprint.id);
      if (!fullBp) {
        toast.error('Blueprint nao encontrado');
        setLoading(false);
        return;
      }
      const adv = await createAdvancedProposal({
        organizationId: organization?.id || '',
        clientId: selectedClientId || null,
        blueprintId: fullBp.blueprint.id,
        blueprintVersion: fullBp.blueprint.version,
        title: proposalTitle || `${fullBp.blueprint.name} - Nova Proposta`,
        totalSections: fullBp.sections.length,
      });
      navigate(`/proposta-avancada/${adv.id}`);
    } catch (err) {
      toast.error('Erro ao criar proposta avancada');
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'client') {
      setStep('blueprint');
      setSelectedBlueprint(null);
    } else if (step === 'blueprint') {
      setStep('category');
      setBlueprints([]);
      setSelectedBlueprint(null);
    } else {
      navigate('/propostas');
    }
  };

  const filteredClients = clientSearch
    ? clients.filter(c =>
        c.nome.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.empresa.toLowerCase().includes(clientSearch.toLowerCase())
      )
    : clients;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="p-2 rounded-lg hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Nova Proposta Avancada</h1>
          <p className="text-muted-foreground">
            {step === 'category' && 'Seleccione a area de negocio'}
            {step === 'blueprint' && 'Escolha o modelo de proposta'}
            {step === 'client' && 'Configure os detalhes da proposta'}
            {step === 'loading' && 'A carregar...'}
          </p>
        </div>
        {/* Step indicator */}
        <div className="hidden sm:flex items-center gap-2 text-sm">
          <StepDot active={step === 'category'} done={['blueprint', 'client'].includes(step)} label="Categoria" />\n          <div className="w-6 h-px bg-border" />
          <StepDot active={step === 'blueprint'} done={['client'].includes(step)} label="Modelo" />
          <div className="w-6 h-px bg-border" />
          <StepDot active={step === 'client'} label="Detalhes" />
        </div>
      </div>

      {/* Loading state */}
      {step === 'loading' && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">A carregar modelos...</p>
        </div>
      )}

      {/* Step 1: Category Selection */}
      {step === 'category' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleSelectCategory(cat)}
              className="group p-6 rounded-xl border-2 border-border hover:border-primary 
                         hover:shadow-md transition-all text-left"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {CATEGORY_ICONS[cat.icon] || <Briefcase className="h-8 w-8" />}
                </div>
              </div>
              <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                {cat.name}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {cat.description}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Blueprint Selection */}
      {step === 'blueprint' && selectedCategory && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{selectedCategory.name}</span>
            <span>→</span>
            <span>Seleccionar modelo</span>
          </div>
          <div className="space-y-3">
            {blueprints.map((bp) => (
              <button
                key={bp.id}
                onClick={() => handleSelectBlueprint(bp)}
                className="w-full flex items-center justify-between p-5 rounded-xl border-2 border-border 
                           hover:border-primary hover:shadow-md transition-all text-left group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{bp.name}</h3>
                    {bp.is_default && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">Padrao</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{bp.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{bp.estimated_pages} pag. estimadas</span>
                    <span>v{bp.version}</span>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary flex-shrink-0 ml-4" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Client + Title */}
      {step === 'client' && selectedBlueprint && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{selectedCategory?.name}</span>
            <span>→</span>
            <span className="font-medium text-foreground">{selectedBlueprint.name}</span>
            <span>→</span>
            <span>Detalhes</span>
          </div>

          <div className="rounded-xl border p-6 space-y-5">
            {/* Proposal Title */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">Titulo da Proposta</label>
              <input
                type="text"
                value={proposalTitle}
                onChange={e => setProposalTitle(e.target.value)}
                placeholder="Ex: Proposta de Consultoria em TI"
                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm"
              />
            </div>

            {/* Client Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">Cliente (opcional)</label>
              {loadingClients ? (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  A carregar clientes...
                </div>
              ) : clients.length > 0 ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)}
                      placeholder="Pesquisar por nome ou empresa..."
                      className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm"
                    />
                  </div>
                  <div className="relative">
                    <select
                      value={selectedClientId}
                      onChange={e => setSelectedClientId(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm appearance-none cursor-pointer"
                    >
                      <option value="">Sem cliente associado</option>
                      {filteredClients.map(c => (
                        <option key={c.id} value={c.id}>{c.nome} - {c.empresa}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                  {selectedClientId && (
                    <SelectedClientCard clientId={selectedClientId} clients={clients} />
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum cliente encontrado. Pode adicionar clientes na seccao "Clientes".
                </p>
              )}
            </div>
          </div>

          {/* Create Button */}
          <div className="flex justify-between">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !proposalTitle.trim()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Criar Proposta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
        active ? 'bg-primary' : done ? 'bg-green-500' : 'bg-muted'
      }`} />
      <span className={active || done ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  );
}

function SelectedClientCard({ clientId, clients }: { clientId: string; clients: Cliente[] }) {
  const client = clients.find(c => c.id === clientId);
  if (!client) return null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
      <Users className="h-4 w-4 text-primary" />
      <div className="text-sm">
        <p className="font-medium">{client.nome}</p>
        <p className="text-muted-foreground">{client.empresa} {client.email ? `· ${client.email}` : ''}</p>
      </div>
    </div>
  );
}
