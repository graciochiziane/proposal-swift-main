import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { ProfileService } from '@/services/profileService';
import { Save, Loader2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ── Validadores ──
// Contacto: email OU telefone moçambicano (9 dígitos a começar por 8).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_MZ_RE = /^8\d{8}$/;

const inputClass = 'w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow';

/**
 * Meu Perfil — dados PESSOAIS do emissor (isolados da empresa).
 * Nome/Cargo/Contacto são herdados automaticamente nas propostas;
 * os dados da empresa (logo, cor, NUIT, pagamentos) gerem-se na
 * Organização.
 */
export default function Perfil() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [contacto, setContacto] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await ProfileService.getProfile();
        if (cancelled || !data) return;
        setNome(data.nome || '');
        setCargo(data.cargo || '');
        setContacto(data.contacto || '');
      } catch (error) {
        console.error('[Perfil] Erro ao carregar:', error);
        toast.error('Erro ao carregar o perfil');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const contactoInvalido = contacto !== ''
    && !EMAIL_RE.test(contacto)
    && !TEL_MZ_RE.test(contacto);

  const podeGuardar = nome.trim() !== '' && !contactoInvalido;

  const handleSave = async () => {
    if (!podeGuardar) {
      if (!nome.trim()) toast.error('O nome do emissor é obrigatório');
      else toast.error('Contacto inválido — use email ou telefone moçambicano (8XXXXXXXX)');
      return;
    }

    setSaving(true);
    try {
      await ProfileService.updatePersonalProfile({
        nome: nome.trim(),
        cargo: cargo.trim(),
        contacto: contacto.trim(),
      });
      toast.success('Perfil actualizado — as próximas propostas usam estes dados');
    } catch (error) {
      console.error('[Perfil] Erro ao gravar:', error);
      toast.error('Erro ao gravar o perfil');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">A carregar perfil…</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Meu Perfil</h1>
        <p className="text-muted-foreground mt-1">
          Os seus dados de emissor — herdados nas propostas que criar
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do Emissor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="perfil-nome">Nome do Emissor</Label>
              <Input
                id="perfil-nome"
                className={inputClass}
                placeholder="O seu nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="perfil-cargo">Cargo / Função</Label>
              <Input
                id="perfil-cargo"
                className={inputClass}
                placeholder="Ex: Director Comercial"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="perfil-contacto">Contacto Directo</Label>
            <Input
              id="perfil-contacto"
              className={`${inputClass} ${contactoInvalido ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              placeholder="Email ou telefone (ex: 841234567)"
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              disabled={saving}
            />
            {contactoInvalido && (
              <p className="text-xs text-destructive">
                Contacto inválido — insira um email ou um telefone moçambicano (9 dígitos, começa por 8).
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Email da conta (apenas leitura)</Label>
            <p className="text-sm text-muted-foreground font-mono">{user?.email ?? '—'}</p>
          </div>

          {/* Nota de fronteira com a Organização */}
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-secondary/40 p-4">
            <Building2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Os dados da empresa — logótipo, cor, NUIT, endereço e métodos de pagamento —
              gerem-se na{' '}
              <Link to="/organizacao" className="text-primary underline-offset-2 hover:underline font-medium">
                Organização
              </Link>
              {' '}e são herdados por todas as propostas da equipa.
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving || !podeGuardar} className="w-full sm:w-auto">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'A gravar…' : 'Guardar Perfil'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
