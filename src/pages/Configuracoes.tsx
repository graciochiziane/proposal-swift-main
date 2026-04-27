import { useState, useRef, useEffect } from 'react';
import { ProfileService } from '@/services/profileService';
import { toast } from 'sonner';
import type { DonoProposta } from '@/types';
import { Loader2 } from 'lucide-react';

export default function Configuracoes() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DonoProposta>({
    nome: '', cargo: '', empresa: '', contacto: '', nuit: '', endereco: '',
    logotipo: '', corPrimaria: '#0B5394',
    dadosBancarios: { ativo: false, banco: '', numeroConta: '', nib: '' },
    mobileMoney: {
      mpesa: { ativo: false, numero: '' },
      emola: { ativo: false, numero: '' },
      mkesh: { ativo: false, numero: '' },
    },
  });

  // null = sem alteração, '' = utilizador removeu, File = novo upload
  const [logoAction, setLogoAction] = useState<null | '' | File>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const data = await ProfileService.getProfile();
      if (data) setForm(data);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar definições');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow";
  const labelClass = "text-sm text-muted-foreground mb-1 block";

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Tratamento do logo
      if (logoAction === '' && form.logotipo) {
        // Utilizador pediu para remover o logo
        await ProfileService.removeLogo();
        await ProfileService.updateProfile(form);
      } else if (logoAction instanceof File) {
        // Utilizador fez upload de novo logo
        const logoPath = await ProfileService.uploadLogo(logoAction);
        await ProfileService.updateProfile(form, logoPath);
      } else {
        // Sem alteração de logo, apenas actualizar campos de texto
        await ProfileService.updateProfile(form);
      }

      toast.success('Dados salvos com sucesso');
      setLogoAction(null);
      setPreviewUrl(null);
      loadProfile();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gravar dados');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx. 2MB)');
      return;
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato inválido (use PNG, JPEG ou WebP)');
      return;
    }

    setLogoAction(file);

    // Preview local para feedback visual imediato
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoAction(''); // Sinal para remover
    setPreviewUrl(null);
    setForm(f => ({ ...f, logotipo: '' }));
    if (fileRef.current) fileRef.current.value = '';
  };

  const updateBank = (key: string, value: string | boolean) =>
    setForm(f => ({ ...f, dadosBancarios: { ...f.dadosBancarios, [key]: value } }));

  const updateMM = (provider: 'mpesa' | 'emola' | 'mkesh', key: string, value: string | boolean) =>
    setForm(f => ({
      ...f,
      mobileMoney: {
        ...f.mobileMoney,
        [provider]: { ...f.mobileMoney[provider], [key]: value },
      },
    }));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">A carregar definições...</p>
      </div>
    );
  }

  // Determinar o que mostrar no preview
  const displayLogo = previewUrl || form.logotipo;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1">Dados do emissor e personalização do PDF</p>
      </div>

      {/* Identity */}
      <div className="bg-card rounded-xl p-6 border border-border card-float space-y-4 animate-fade-up">
        <h3 className="font-semibold">Dados do Emissor</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Nome</label>
            <input className={inputClass} placeholder="Seu nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Cargo / Função</label>
            <input className={inputClass} placeholder="Ex: Director Comercial" value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Empresa</label>
            <input className={inputClass} placeholder="Nome da empresa" value={form.empresa} onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Contacto</label>
            <input className={inputClass} placeholder="Email ou telefone" value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>NUIT</label>
            <input className={inputClass} placeholder="Ex: 400122456" value={form.nuit} onChange={e => setForm(f => ({ ...f, nuit: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Endereço</label>
            <input className={inputClass} placeholder="Ex: Av. 25 de Setembro, Maputo" value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} />
          </div>
        </div>

        {/* Logo upload */}
        <div>
          <label className={labelClass}>Logotipo</label>
          <div className="flex items-center gap-4">
            {displayLogo ? (
              <img
                src={displayLogo}
                alt="Logo"
                className="h-12 w-auto rounded border border-border bg-white p-1 object-contain"
              />
            ) : (
              <div className="h-12 w-12 rounded border border-dashed border-border flex items-center justify-center text-muted-foreground text-xs">
                Sem logo
              </div>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2 rounded-lg bg-secondary border border-border text-sm hover:bg-secondary/80 transition-colors disabled:opacity-50"
            >
              {displayLogo ? 'Trocar imagem' : 'Carregar imagem'}
            </button>
            {logoAction instanceof File && (
              <span className="text-xs text-primary font-medium">Novo ficheiro selecionado</span>
            )}
            {logoAction === '' && (
              <span className="text-xs text-destructive font-medium">Logo será removido ao salvar</span>
            )}
            {form.logotipo && logoAction !== '' && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Remover
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleLogoSelect}
            />
          </div>
        </div>

        {/* Primary color */}
        <div>
          <label className={labelClass}>Cor Primária do PDF</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.corPrimaria}
              onChange={e => setForm(f => ({ ...f, corPrimaria: e.target.value }))}
              className="w-10 h-10 rounded-lg border border-border cursor-pointer"
            />
            <span className="text-sm text-muted-foreground font-mono">{form.corPrimaria}</span>
          </div>
        </div>
      </div>

      {/* Payment methods */}
      <div className="bg-card rounded-xl p-6 border border-border card-float space-y-5 animate-fade-up" style={{ animationDelay: '80ms' }}>
        <h3 className="font-semibold">Instruções de Pagamento</h3>

        {/* Bank */}
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.dadosBancarios.ativo}
              onChange={e => updateBank('ativo', e.target.checked)}
              className="w-5 h-5 rounded border-border accent-primary"
            />
            <span className="text-sm font-medium">Dados Bancários</span>
          </label>
          {form.dadosBancarios.ativo && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-8">
              <div>
                <label className={labelClass}>Banco</label>
                <input className={inputClass} placeholder="Ex: BCI" value={form.dadosBancarios.banco} onChange={e => updateBank('banco', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Nº Conta</label>
                <input className={inputClass} placeholder="Número da conta" value={form.dadosBancarios.numeroConta} onChange={e => updateBank('numeroConta', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>NIB/IBAN</label>
                <input className={inputClass} placeholder="NIB ou IBAN" value={form.dadosBancarios.nib} onChange={e => updateBank('nib', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Mobile money */}
        {(['mpesa', 'emola', 'mkesh'] as const).map(provider => {
          const labels = { mpesa: 'M-Pesa', emola: 'e-Mola', mkesh: 'm-Kesh' };
          return (
            <div key={provider} className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.mobileMoney[provider].ativo}
                  onChange={e => updateMM(provider, 'ativo', e.target.checked)}
                  className="w-5 h-5 rounded border-border accent-primary"
                />
                <span className="text-sm font-medium">{labels[provider]}</span>
              </label>
              {form.mobileMoney[provider].ativo && (
                <div className="pl-8">
                  <input
                    className={inputClass}
                    placeholder={`Número ${labels[provider]}`}
                    value={form.mobileMoney[provider].numero}
                    onChange={e => updateMM(provider, 'numero', e.target.value)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-primary hover:brightness-110 active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saving ? 'A gravar...' : 'Salvar Configurações'}
      </button>
    </div>
  );
}
