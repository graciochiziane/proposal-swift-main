import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PropostaService, formatMZN } from '@/services/propostaService';
import type { PropostaCompleta } from '@/services/propostaService';
import { ProfileService } from '@/services/profileService';
import { calcularTotal } from '@/lib/calculos';
import { TEMPLATES_PDF, previsualizarPdf, baixarPropostaPdf, construirDadosPdf } from '@/lib/pdf';
import type { PdfTemplateId } from '@/lib/pdf';
import { propostaEmailService } from '@/services/propostaEmailService';
import { CrmService } from '@/services/crmService';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { FileDown, Eye, Pencil, Copy, Loader2, Sparkles, Send } from 'lucide-react';
import { toast } from 'sonner';
import { converterPropostaEmFactura, getFaturasPorProposta, atualizarStatusFatura } from '@/services/faturaService';
import type { Cliente, DonoProposta, Fatura, StatusFatura } from '@/types';

export default function ResumoProposta() {
  const { id } = useParams();
  const navigate = useNavigate();
  // Item 2 — gate do CRM por plano: evita tentativa de registo em orgs sem CRM
  const { hasFeature } = usePlanFeatures();
  // cotação abre por omissão no layout de referência (factura moderna);
  // o selector continua a permitir trocar para Executivo/Editorial
  const [templateId, setTemplateId] = useState<PdfTemplateId>('cotacao');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // estado do modal de envio por email
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailPara, setEmailPara] = useState('');
  const [emailAssunto, setEmailAssunto] = useState('');
  const [emailMensagem, setEmailMensagem] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const [proposta, setProposta] = useState<PropostaCompleta | null>(null);
  const [dono, setDono] = useState<DonoProposta | null>(null);
  const [loading, setLoading] = useState(true);

  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loadingFaturas, setLoadingFaturas] = useState(false);
  const [showFaturarModal, setShowFaturarModal] = useState(false);
  const [dataVencimento, setDataVencimento] = useState('');
  const [savingFatura, setSavingFatura] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function loadData() {
      try {
        const [propData, donoData] = await Promise.all([
          PropostaService.getPropostaById(id as string),
          ProfileService.getProfile(),
        ]);
        setProposta(propData);
        setDono(donoData);
      } catch {
        toast.error('Proposta não encontrada');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoadingFaturas(true);
    getFaturasPorProposta(id)
      .then(setFaturas)
      .catch((err) => console.error('Erro ao carregar facturas:', err))
      .finally(() => setLoadingFaturas(false));
  }, [id]);

  const cliente: Cliente | null = proposta?.clienteSnapshot
    ? {
      id: proposta.clienteId,
      nome: proposta.clienteSnapshot.nome || 'Cliente removido',
      email: proposta.clienteSnapshot.email || '',
      telefone: proposta.clienteSnapshot.telefone || '',
      empresa: proposta.clienteSnapshot.empresa || '',
      nuit: proposta.clienteSnapshot.nuit || '',
      endereco: proposta.clienteSnapshot.endereco || '',
    }
    : null;

  const totais = proposta
    ? calcularTotal(proposta.subtotal, proposta.descontoTipo, proposta.descontoValor, proposta.ivaPercentual)
    : { desconto: 0, baseTributavel: 0, iva: 0, total: 0 };

  /**
   * Geração da proposta em PDF vectorial — único formato suportado.
   * mode 'preview' abre numa nova janela; mode 'download'
   * descarrega o ficheiro .pdf (pronto a enviar ao cliente).
   */
  const handleGerarPdf = (mode: 'preview' | 'download') => {
    if (!proposta || !dono || !cliente) {
      toast.error('Dados não carregados');
      return;
    }

    setGeneratingPdf(true);
    try {
      const dados = construirDadosPdf(proposta, cliente, dono);
      if (mode === 'download') {
        baixarPropostaPdf(dados, templateId);
        toast.success('Proposta PDF gerada com sucesso');
      } else {
        previsualizarPdf(dados, templateId);
      }
    } catch (err) {
      toast.error('Erro ao gerar PDF: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ---- Envio por email ----

  const abrirEmailModal = () => {
    if (!proposta || !dono) return;
    setEmailPara(cliente?.email || '');
    setEmailAssunto(`Proposta ${proposta.numero} — ${dono.empresa || dono.nome}`);
    setEmailMensagem(
      `Olá ${cliente?.nome || ''},\n\nSegue em anexo a nossa proposta comercial.\n\nCumprimentos,\n${dono.empresa || dono.nome}`,
    );
    setShowEmailModal(true);
  };

  const handleEnviarEmail = async () => {
    if (!proposta || !dono || !cliente) return;
    if (!emailPara.trim()) {
      toast.error('Indique o email do destinatário');
      return;
    }
    setSendingEmail(true);
    try {
      const dados = construirDadosPdf(proposta, cliente, dono);
      const resultado = await propostaEmailService.enviar({
        dados,
        templateId,
        para: emailPara,
        assunto: emailAssunto,
        mensagem: emailMensagem,
      });

      if (resultado.sucesso && !resultado.avisoSemApiChave) {
        toast.success(`Proposta enviada para ${emailPara}`);
        setShowEmailModal(false);
        // marcar como enviada (se ainda rascunho)
        if (proposta.status === 'rascunho') {
          try {
            await PropostaService.atualizarStatus(proposta.id, 'enviada');
            setProposta(prev => (prev ? { ...prev, status: 'enviada' } : prev));
          } catch {
            console.warn('Falha ao actualizar status para enviada (email enviado)');
          }
        }
        // Item 2 — registo automático da actividade no CRM.
        // Nunca bloqueia o envio: o email JÁ foi enviado com sucesso;
        // uma falha aqui é registada e ignorada (o envio continua válido).
        if (cliente.id && hasFeature('crm_access')) {
          try {
            await CrmService.createActivity({
              client_id: cliente.id,
              proposal_id: proposta.id,
              type: 'proposta_enviada',
              title: `Proposta ${proposta.numero} enviada por email`,
              description: `Destinatário: ${emailPara.trim()}`,
            });
          } catch (crmErr) {
            console.warn('CRM: falha ao registar actividade de proposta enviada (envio bem-sucedido):', crmErr);
          }
        }
      } else if (resultado.avisoSemApiChave) {
        toast.info('O email não foi enviado: o serviço de email não está configurado (RESEND_API_KEY em falta no Supabase).');
      } else {
        toast.error(resultado.erro || 'Falha ao enviar email');
      }
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDuplicar = async () => {
    if (!proposta) return;
    try {
      const nova = await PropostaService.duplicarProposta(proposta.id);
      toast.success('Proposta duplicada');
      navigate(`/proposta/${nova.id}`);
    } catch {
      toast.error('Erro ao duplicar proposta');
    }
  };

  async function handleFaturar() {
    if (!id || !dataVencimento) return;
    setSavingFatura(true);
    try {
      const novaFatura = await converterPropostaEmFactura(id, dataVencimento);
      setFaturas((prev) => [novaFatura, ...prev]);
      setShowFaturarModal(false);
      setDataVencimento('');
      toast.success('Factura ' + novaFatura.numero + ' criada com sucesso!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(msg);
    } finally {
      setSavingFatura(false);
    }
  }

  async function handleAtualizarStatusFatura(faturaId: string, status: StatusFatura) {
    try {
      await atualizarStatusFatura(faturaId, status);
      setFaturas((prev) =>
        prev.map((f) => (f.id === faturaId ? { ...f, status } : f))
      );
      toast.success('Status da factura actualizado');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(msg);
    }
  }

  function getStatusFaturaBadge(status: StatusFatura): { cor: string; label: string } {
    switch (status) {
      case 'pendente': return { cor: '#f59e0b', label: 'Pendente' };
      case 'paga': return { cor: '#10b981', label: 'Paga' };
      case 'vencida': return { cor: '#ef4444', label: 'Vencida' };
      case 'anulada': return { cor: '#6b7280', label: 'Anulada' };
      default: return { cor: '#6b7280', label: status };
    }
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('pt-MZ');
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">A carregar proposta...</p>
      </div>
    );
  }

  if (!proposta) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Proposta não encontrada</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 text-primary hover:underline text-sm"
        >
          Voltar ao Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-mono">{proposta.numero}</span>
            <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground capitalize">
              {proposta.status}
            </span>
          </div>
          <h1 className="text-2xl font-bold mt-1">
            Proposta — {cliente?.nome || 'Cliente removido'}
          </h1>
          <p className="text-sm text-muted-foreground">{new Date(proposta.data).toLocaleDateString('pt-MZ')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {proposta?.status === 'aceite' && (
            <button
              onClick={() => setShowFaturarModal(true)}
              style={{
                backgroundColor: '#059669',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
              }}
            >
              📄 Converter em Factura
            </button>
          )}
          <select
            value={templateId}
            onChange={e => setTemplateId(e.target.value as PdfTemplateId)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary border border-border text-sm font-semibold hover:bg-secondary/80 transition-colors cursor-pointer"
            title="Modelo PDF da proposta"
          >
            {TEMPLATES_PDF.map(t => (
              <option key={t.id} value={t.id}>
                Modelo: {t.nome}
              </option>
            ))}
          </select>
          <button
            onClick={() => navigate(`/proposta/${proposta.id}/gerar-ia`)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-all"
          >
            <Sparkles className="h-4 w-4" />
            Proposta IA
          </button>
          <button
            onClick={() => handleGerarPdf('preview')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary border border-border text-sm font-semibold hover:bg-secondary/80 transition-colors"
            title="Abrir a proposta PDF numa nova janela"
          >
            <Eye className="h-4 w-4" />
            Pré-visualizar
          </button>
          <button
            onClick={() => handleGerarPdf('download')}
            disabled={generatingPdf}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary border border-border text-sm font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-50"
            title="Descarregar a proposta como ficheiro PDF"
          >
            {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {generatingPdf ? 'A gerar...' : 'Baixar PDF'}
          </button>
          <button
            onClick={abrirEmailModal}
            disabled={sendingEmail}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-50"
            title="Enviar a proposta PDF por email ao cliente"
          >
            <Send className="h-4 w-4" />
            Enviar Email
          </button>
          <button
            onClick={() => navigate(`/proposta/editar/${proposta.id}`)}
            className="p-2 rounded-lg bg-secondary border border-border hover:bg-secondary/80 transition-colors"
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={handleDuplicar}
            className="p-2 rounded-lg bg-secondary border border-border hover:bg-secondary/80 transition-colors"
            title="Duplicar"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </div>

      {cliente && (
        <div className="bg-card rounded-xl p-5 border border-border card-float animate-fade-up space-y-1">
          <p className="font-semibold">{cliente.nome}</p>
          {cliente.empresa && <p className="text-sm text-muted-foreground">{cliente.empresa}</p>}
          {[cliente.email, cliente.telefone].filter(Boolean).length > 0 && (
            <p className="text-sm text-muted-foreground">
              {[cliente.email, cliente.telefone].filter(Boolean).join(' · ')}
            </p>
          )}
          {cliente.nuit && <p className="text-sm text-muted-foreground">NUIT: {cliente.nuit}</p>}
          {cliente.endereco && <p className="text-sm text-muted-foreground">{cliente.endereco}</p>}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border card-float overflow-hidden animate-fade-up" style={{ animationDelay: '80ms' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/50 border-b border-border">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Item</th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground w-16">Qtd</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground w-28">Preço</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground w-28">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {proposta.itens.map((item, i) => (
              <tr key={item.id || i} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-3">{item.nome}</td>
                <td className="px-3 py-3 text-center">{item.quantidade}</td>
                <td className="px-3 py-3 text-right">{formatMZN(item.precoUnitario)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatMZN(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-card rounded-xl p-5 border border-border card-float space-y-2 animate-fade-up" style={{ animationDelay: '160ms' }}>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatMZN(proposta.subtotal)}</span>
        </div>
        {totais.desconto > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Desconto</span>
            <span className="text-destructive">-{formatMZN(totais.desconto)}</span>
          </div>
        )}
        {totais.iva > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">IVA ({proposta.ivaPercentual}%)</span>
            <span>{formatMZN(totais.iva)}</span>
          </div>
        )}
        <div className="border-t border-border pt-2 flex justify-between font-bold text-lg">
          <span>Total</span>
          <span className="text-primary">{formatMZN(totais.total)}</span>
        </div>
      </div>

      {proposta.observacoes && (
        <div className="bg-card rounded-xl p-5 border border-border card-float animate-fade-up" style={{ animationDelay: '240ms' }}>
          <p className="text-sm font-medium mb-1">Observações</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{proposta.observacoes}</p>
        </div>
      )}

      {loadingFaturas ? (
        <div className="py-4 text-center text-sm text-muted-foreground">A carregar facturas ligadas...</div>
      ) : faturas.length > 0 && (
        <div style={{ marginTop: '32px', animationDelay: '300ms' }} className="animate-fade-up">
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: 'hsl(var(--foreground))' }}>
            Facturas Ligadas ({faturas.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {faturas.map((fatura) => {
              const badge = getStatusFaturaBadge(fatura.status);
              return (
                <div
                  key={fatura.id}
                  style={{
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '10px',
                    padding: '16px',
                    backgroundColor: 'hsl(var(--card))',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <span style={{ fontWeight: 700, color: 'hsl(var(--foreground))', fontSize: '15px' }}>{fatura.numero}</span>
                      <span style={{ color: 'hsl(var(--muted-foreground))', margin: '0 8px' }}>|</span>
                      <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '13px' }}>
                        Emissão: {formatDate(fatura.data_emissao)}
                      </span>
                      <span style={{ color: 'hsl(var(--muted-foreground))', margin: '0 8px' }}>|</span>
                      <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '13px' }}>
                        Vencimento: {formatDate(fatura.data_vencimento)}
                      </span>
                    </div>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#fff',
                        backgroundColor: badge.cor,
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '16px', color: 'hsl(var(--primary))' }}>
                      {formatMZN(fatura.total)}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {fatura.status === 'pendente' && (
                        <>
                          <button
                            onClick={() => handleAtualizarStatusFatura(fatura.id, 'paga')}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: '1px solid #10b981',
                              background: 'transparent',
                              color: '#10b981',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            Marcar Paga
                          </button>
                          <button
                            onClick={() => handleAtualizarStatusFatura(fatura.id, 'anulada')}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: '1px solid hsl(var(--muted-foreground))',
                              background: 'transparent',
                              color: 'hsl(var(--muted-foreground))',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            Anular
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showFaturarModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowFaturarModal(false)}
        >
          <div
            style={{
              backgroundColor: 'hsl(var(--card))',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
              border: '1px solid hsl(var(--border))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '16px', fontWeight: 700 }}>Converter em Factura</h3>
            <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '14px', marginBottom: '16px' }}>
              Uma factura será criada com base nesta proposta. Escolha a data de vencimento.
            </p>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '14px' }}>
              Data de Vencimento *
            </label>
            <input
              type="date"
              value={dataVencimento}
              onChange={(e) => setDataVencimento(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                marginBottom: '20px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowFaturarModal(false);
                  setDataVencimento('');
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid hsl(var(--border))',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleFaturar}
                disabled={!dataVencimento || savingFatura}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#059669',
                  color: '#fff',
                  cursor: dataVencimento && !savingFatura ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                  opacity: dataVencimento && !savingFatura ? 1 : 0.5,
                }}
              >
                {savingFatura ? 'A criar...' : 'Criar Factura'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEmailModal && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !sendingEmail && setShowEmailModal(false)}
        >
          <div
            style={{
              backgroundColor: 'hsl(var(--card))',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '480px',
              width: '90%',
              border: '1px solid hsl(var(--border))',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '6px', fontWeight: 700 }}>Enviar Proposta por Email</h3>
            <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '14px', marginBottom: '18px' }}>
              A proposta será gerada em PDF e enviada em anexo ao cliente.
            </p>

            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '14px' }}>
              Destinatário (email) *
            </label>
            <input
              type="email"
              value={emailPara}
              onChange={(e) => setEmailPara(e.target.value)}
              placeholder="cliente@empresa.co.mz"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                marginBottom: '14px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />

            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '14px' }}>
              Assunto
            </label>
            <input
              type="text"
              value={emailAssunto}
              onChange={(e) => setEmailAssunto(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                marginBottom: '14px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />

            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '14px' }}>
              Mensagem (opcional)
            </label>
            <textarea
              value={emailMensagem}
              onChange={(e) => setEmailMensagem(e.target.value)}
              rows={5}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                marginBottom: '20px',
                fontSize: '14px',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowEmailModal(false)}
                disabled={sendingEmail}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid hsl(var(--border))',
                  background: 'transparent',
                  cursor: sendingEmail ? 'not-allowed' : 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleEnviarEmail}
                disabled={sendingEmail || !emailPara.trim()}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  cursor: sendingEmail || !emailPara.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  opacity: sendingEmail || !emailPara.trim() ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {sendingEmail ? 'A enviar...' : 'Enviar Proposta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
