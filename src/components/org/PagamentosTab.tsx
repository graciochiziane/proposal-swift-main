import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { OrganizationService } from '@/services/organizationService';
import type { PagamentoExtra } from '@/types';
import { Save, Loader2, Plus, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ── Validadores Moçambique (tempo real) ──
// Vodacom 84/85 · Movitel 86/87 · Tmcel 82/83 — 9 dígitos no total.
const RE_M_PESA = /^8[45]\d{7}$/;
const RE_EMOLA = /^8[67]\d{7}$/;
const RE_MKESH = /^8[23]\d{7}$/;

type BlocoBancario = {
  ativo: boolean;
  banco: string;
  numeroConta: string;
  nib: string;
};
type BlocoMobile = {
  mpesa: { ativo: boolean; numero: string };
  emola: { ativo: boolean; numero: string };
  mkesh: { ativo: boolean; numero: string };
};

const BANCO_DEFAULT: BlocoBancario = { ativo: false, banco: '', numeroConta: '', nib: '' };
const MOBILE_DEFAULT: BlocoMobile = {
  mpesa: { ativo: false, numero: '' },
  emola: { ativo: false, numero: '' },
  mkesh: { ativo: false, numero: '' },
};

const inputClass = 'w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow';

function numeroInvalido(numero: string, re: RegExp): boolean {
  return numero !== '' && !re.test(numero);
}

/**
 * Aba 2 — Métodos de Pagamento da organização.
 * Editável por admin+; alimenta os PDFs de TODOS os membros.
 * Campos condicionais (checkbox mostra/oculta inputs) + validação
 * em tempo real dos números moçambicanos.
 */
export default function PagamentosTab({ canEdit }: { canEdit: boolean }) {
  const { organization, refreshOrg } = useAuth();
  const [banco, setBanco] = useState<BlocoBancario>(BANCO_DEFAULT);
  const [mm, setMm] = useState<BlocoMobile>(MOBILE_DEFAULT);
  const [extras, setExtras] = useState<PagamentoExtra[]>([]);
  const [saving, setSaving] = useState(false);

  // Carrega os dados da org (cast documentado: fronteira Json -> domínio)
  useEffect(() => {
    if (!organization) return;
    setBanco({ ...BANCO_DEFAULT, ...(organization.dados_bancarios as unknown as BlocoBancario) });
    setMm({ ...MOBILE_DEFAULT, ...(organization.mobile_money as unknown as BlocoMobile) });
    setExtras((organization.pagamentos_extras as unknown as PagamentoExtra[]) ?? []);
  }, [organization]);

  const updateBank = (key: keyof BlocoBancario, value: string | boolean) =>
    setBanco(b => ({ ...b, [key]: value }));

  const updateMM = (provider: keyof BlocoMobile, key: 'ativo' | 'numero', value: string | boolean) =>
    setMm(m => ({ ...m, [provider]: { ...m[provider], [key]: value } }));

  // ── Extras dinâmicos (criados pelo dono, sem limite) ──
  const addExtra = () =>
    setExtras(x => [...x, { rotulo: '', valor: '', ativo: true } satisfies PagamentoExtra]);

  const updateExtra = (index: number, patch: Partial<PagamentoExtra>) =>
    setExtras(list => list.map((x, i) => (i === index ? { ...x, ...patch } : x)));

  const removeExtra = (index: number) =>
    setExtras(list => list.filter((_, i) => i !== index));

  // ── Erros em tempo real ──
  const erros = {
    mpesa: numeroInvalido(mm.mpesa.numero, RE_M_PESA),
    emola: numeroInvalido(mm.emola.numero, RE_EMOLA),
    mkesh: numeroInvalido(mm.mkesh.numero, RE_MKESH),
  };
  const temErros = erros.mpesa || erros.emola || erros.mkesh;

  const handleSave = async () => {
    if (!organization) return;
    if (temErros) {
      toast.error('Corrija os números indicados antes de guardar');
      return;
    }

    setSaving(true);
    try {
      await OrganizationService.updateOrganization({
        dados_bancarios: banco,
        mobile_money: mm,
        pagamentos_extras: extras,
      }, organization.id);
      toast.success('Métodos de pagamento actualizados');
      refreshOrg();
    } catch (error) {
      console.error('[PagamentosTab] Erro ao gravar:', error);
      toast.error('Erro ao gravar os métodos de pagamento');
    } finally {
      setSaving(false);
    }
  };

  const digitos = (v: string) => v.replace(/\D/g, '').slice(0, 9);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Métodos de Pagamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* ── Dados bancários ── */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={banco.ativo}
                onChange={(e) => updateBank('ativo', e.target.checked)}
                disabled={!canEdit || saving}
                className="w-5 h-5 rounded border-border accent-primary cursor-pointer"
              />
              <span className="text-sm font-medium">Dados Bancários</span>
            </label>
            {banco.ativo && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-8">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Banco</Label>
                  <input
                    className={inputClass}
                    placeholder="Ex: BCI"
                    value={banco.banco}
                    onChange={(e) => updateBank('banco', e.target.value)}
                    disabled={!canEdit || saving}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Nº Conta</Label>
                  <input
                    className={inputClass}
                    placeholder="Número da conta"
                    value={banco.numeroConta}
                    onChange={(e) => updateBank('numeroConta', e.target.value)}
                    disabled={!canEdit || saving}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">NIB/IBAN</Label>
                  <input
                    className={inputClass}
                    placeholder="NIB ou IBAN"
                    value={banco.nib}
                    onChange={(e) => updateBank('nib', e.target.value)}
                    disabled={!canEdit || saving}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Mobile money (campos condicionais + validação MZ) ── */}
          {([
            { key: 'mpesa', label: 'M-Pesa', operadora: 'Vodacom · começa por 84/85', erro: erros.mpesa, msg: 'Número M-Pesa inválido — deve começar por 84 ou 85 (9 dígitos).' },
            { key: 'emola', label: 'e-Mola', operadora: 'Movitel · começa por 86/87', erro: erros.emola, msg: 'Número e-Mola inválido — deve começar por 86 ou 87 (9 dígitos).' },
            { key: 'mkesh', label: 'm-Kesh', operadora: 'Tmcel · começa por 82/83', erro: erros.mkesh, msg: 'Número m-Kesh inválido — deve começar por 82 ou 83 (9 dígitos).' },
          ] as const).map(({ key, label, operadora, erro, msg }) => (
            <div key={key} className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={mm[key].ativo}
                  onChange={(e) => updateMM(key, 'ativo', e.target.checked)}
                  disabled={!canEdit || saving}
                  className="w-5 h-5 rounded border-border accent-primary cursor-pointer"
                />
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">{operadora}</span>
              </label>
              {mm[key].ativo && (
                <div className="pl-8 max-w-xs">
                  <input
                    className={`${inputClass} ${erro ? 'border-destructive focus:ring-destructive/50' : ''}`}
                    placeholder={`Número ${label} (9 dígitos)`}
                    value={mm[key].numero}
                    onChange={(e) => updateMM(key, 'numero', digitos(e.target.value))}
                    disabled={!canEdit || saving}
                    inputMode="numeric"
                  />
                  {erro && <p className="text-xs text-destructive mt-1">{msg}</p>}
                </div>
              )}
            </div>
          ))}

          {/* ── Outras formas (dinâmicas, sem limite) ── */}
          <div className="pt-4 border-t space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-sm font-medium">Outras formas de pagamento</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Adicione quantas precisar (ex.: segunda conta M-Pesa, PayPal…) — aparecem no PDF depois das formas acima.
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={addExtra}
                  disabled={saving}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </button>
              )}
            </div>
            {extras.map((extra, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center pl-8">
                <input
                  type="checkbox"
                  checked={extra.ativo}
                  onChange={(e) => updateExtra(i, { ativo: e.target.checked })}
                  disabled={!canEdit || saving}
                  className="w-5 h-5 rounded border-border accent-primary cursor-pointer"
                  title="Mostrar esta forma no PDF"
                />
                <input
                  className={inputClass}
                  placeholder="Nome (ex: M-Pesa 2, PayPal…)"
                  value={extra.rotulo}
                  onChange={(e) => updateExtra(i, { rotulo: e.target.value })}
                  disabled={!canEdit || saving}
                />
                <input
                  className={inputClass}
                  placeholder="Número / conta / email"
                  value={extra.valor}
                  onChange={(e) => updateExtra(i, { valor: e.target.value })}
                  disabled={!canEdit || saving}
                />
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => removeExtra(i)}
                    disabled={saving}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    title="Remover esta forma de pagamento"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {extras.length === 0 && (
              <p className="text-xs text-muted-foreground pl-8">
                Nenhuma forma adicional — use «Adicionar» para criar.
              </p>
            )}
          </div>

          {canEdit && (
            <div className="pt-2">
              <Button onClick={handleSave} disabled={saving || temErros}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {saving ? 'A gravar…' : 'Guardar Métodos de Pagamento'}
              </Button>
            </div>
          )}
          {!canEdit && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Apenas owner/admin da organização pode editar os métodos de pagamento.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
