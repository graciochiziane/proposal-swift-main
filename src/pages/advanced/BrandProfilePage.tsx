import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Palette, Save, RotateCcw, Eye } from 'lucide-react';
import type { VisualStyle } from '@/types/advancedProposal';
import { getBrandProfile, saveBrandProfile } from '@/services/advancedProposalService';
import { useAuth } from '@/hooks/useAuth';

const VISUAL_STYLES: { value: VisualStyle; label: string; desc: string }[] = [
  { value: 'corporate', label: 'Corporativo', desc: 'Classico e profissional, ideal para sectores formais' },
  { value: 'premium', label: 'Premium', desc: 'Elegante com espacamento generoso, para propostas de alto valor' },
  { value: 'minimal', label: 'Minimalista', desc: 'Limpo e directo, foco no conteudo' },
  { value: 'technical', label: 'Tecnico', desc: 'Estruturado para propostas de engenharia e tecnologia' },
];

const FONTS = [
  { value: 'inter', label: 'Inter', sample: 'Aa Bb Cc 123' },
  { value: 'roboto', label: 'Roboto', sample: 'Aa Bb Cc 123' },
  { value: 'lato', label: 'Lato', sample: 'Aa Bb Cc 123' },
  { value: 'merriweather', label: 'Merriweather', sample: 'Aa Bb Cc 123' },
  { value: 'playfair', label: 'Playfair Display', sample: 'Aa Bb Cc 123' },
];

const DEFAULT_COLORS = {
  primary: '#1e40af',
  secondary: '#f8fafc',
  accent: '#3b82f6',
};

export default function BrandProfilePage() {
  const { organization } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [primaryColor, setPrimaryColor] = useState(DEFAULT_COLORS.primary);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_COLORS.secondary);
  const [accentColor, setAccentColor] = useState(DEFAULT_COLORS.accent);
  const [fontPreference, setFontPreference] = useState('inter');
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('corporate');

  useEffect(() => {
    if (!organization?.id) return;
    getBrandProfile(organization.id)
      .then(bp => {
        if (bp) {
          setPrimaryColor(bp.primary_color || DEFAULT_COLORS.primary);
          setSecondaryColor(bp.secondary_color || DEFAULT_COLORS.secondary);
          setAccentColor(bp.accent_color || DEFAULT_COLORS.accent);
          setFontPreference(bp.font_preference || 'inter');
          setVisualStyle(bp.visual_style || 'corporate');
        }
      })
      .catch(() => toast.error('Erro ao carregar perfil'))
      .finally(() => setLoading(false));
  }, [organization?.id]);

  const handleSave = async () => {
    if (!organization?.id) return;
    setSaving(true);
    try {
      await saveBrandProfile({
        organizationId: organization.id,
        primaryColor,
        secondaryColor,
        accentColor,
        fontPreference,
        visualStyle,
      });
      toast.success('Perfil visual guardado');
    } catch {
      toast.error('Erro ao guardar perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPrimaryColor(DEFAULT_COLORS.primary);
    setSecondaryColor(DEFAULT_COLORS.secondary);
    setAccentColor(DEFAULT_COLORS.accent);
    setFontPreference('inter');
    setVisualStyle('corporate');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Palette className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Perfil Visual</h1>
        </div>
        <p className="text-muted-foreground">
          Personalize a aparencia das suas propostas avancadas
        </p>
      </div>

      {/* Visual Style */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">Estilo Visual</label>
        <div className="grid grid-cols-2 gap-3">
          {VISUAL_STYLES.map(s => (
            <button
              key={s.value}
              onClick={() => setVisualStyle(s.value)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                visualStyle === s.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <p className="font-semibold text-sm">{s.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div className="space-y-4">
        <label className="block text-sm font-medium">Cores</label>
        <div className="grid grid-cols-3 gap-4">
          <ColorPicker label="Cor Primaria" value={primaryColor} onChange={setPrimaryColor} />
          <ColorPicker label="Cor Secundaria" value={secondaryColor} onChange={setSecondaryColor} />
          <ColorPicker label="Cor de Destaque" value={accentColor} onChange={setAccentColor} />
        </div>
      </div>

      {/* Font */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">Fonte</label>
        <div className="grid grid-cols-1 gap-2">
          {FONTS.map(f => (
            <button
              key={f.value}
              onClick={() => setFontPreference(f.value)}
              className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                fontPreference === f.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <span className="text-sm font-medium">{f.label}</span>
              <span className="text-sm text-muted-foreground" style={{ fontFamily: f.value }}>
                {f.sample}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Eye className="h-4 w-4" />
          Pre-visualizacao
        </div>
        <div className="rounded-xl border overflow-hidden">
          <div
            className="px-6 py-4 text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <p className="text-lg font-bold" style={{ fontFamily: fontPreference }}>
              Exemplo de Proposta
            </p>
            <p className="text-sm opacity-80">Secao de Exemplo</p>
          </div>
          <div className="p-4 space-y-2" style={{ backgroundColor: secondaryColor }}>
            <div className="h-2 rounded-full w-full" style={{ backgroundColor: accentColor + '30' }} />
            <div className="h-2 rounded-full w-3/4" style={{ backgroundColor: accentColor + '20' }} />
            <div className="h-2 rounded-full w-5/6" style={{ backgroundColor: accentColor + '25' }} />
            <div className="mt-3 h-3 rounded" style={{ backgroundColor: primaryColor + '15', width: '40%' }} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border hover:bg-muted text-sm">
          <RotateCcw className="h-4 w-4" />
          Restaurar Padroes
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm disabled:opacity-50">
          <Save className="h-4 w-4" />
          {saving ? 'A guardar...' : 'Guardar Perfil'}
        </button>
      </div>
    </div>
  );
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="block text-xs text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border text-sm font-mono"
          maxLength={7}
        />
      </div>
    </div>
  );
}