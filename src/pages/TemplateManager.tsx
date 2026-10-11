// ============================================================
// Modelos de Proposta PDF (galeria)
//
// Mostra os templates incorporados com miniaturas CSS,
// características e escolha do modelo por omissão
// (localStorage). Os modelos são gerados em código (PDF
// vectorial) — já não há templates HTML em base de dados.
//
// GATING: desde a restricao de catálogo, esta página mostra
// apenas os modelos disponíveis para a org activa (base +
// restritos atribuídos pelo superadmin) e sanitiza a omissão
// pessoal. Acesso exclusivo do platform admin (a rota
// /admin/templates vive na área admin — mesma verificação
// que Admin.tsx e TenantDetailPage fazem internamente).
// ============================================================

import { useState, useEffect } from 'react';
import { TEMPLATES_PDF, obterTemplateDefault, definirTemplateDefault, templatesVisiveisPara } from '@/lib/pdf';
import type { PdfTemplateId } from '@/lib/pdf';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { OrganizationTemplateService } from '@/services/organizationTemplateService';

/** Miniatura CSS do modelo Executivo (banda escura + cartões) */
function MiniaturaExecutivo({ cor }: { cor: string }): JSX.Element {
  return (
    <div className="w-full aspect-[210/297] rounded-md overflow-hidden bg-white border border-border shadow-sm relative">
      {/* banda de capa com gradiente */}
      <div
        className="h-[38%] w-full relative"
        style={{ background: `linear-gradient(180deg, ${cor}dd 0%, ${cor} 100%)` }}
      >
        <div
          className="absolute rounded-full"
          style={{ right: '-12%', top: '6%', width: '55%', aspectRatio: '1', border: '2px solid rgba(255,255,255,0.35)' }}
        />
        <div className="absolute left-[8%] top-[14%] w-[42%]">
          <div className="h-1.5 w-14 bg-white/80 rounded-sm" />
        </div>
        <div className="absolute left-[8%] top-[38%]">
          <div className="h-2.5 w-24 bg-white rounded-sm" />
          <div className="h-2.5 w-16 bg-white/70 rounded-sm mt-1.5" />
        </div>
        <div className="absolute left-[8%] bottom-[10%] w-6 h-0.5 bg-white" />
      </div>
      {/* cartões de dados */}
      <div className="px-[8%] pt-[6%] flex gap-[4%]">
        <div className="flex-1 h-10 rounded-sm bg-slate-100" />
        <div className="flex-1 h-10 rounded-sm bg-slate-100" />
      </div>
      {/* cartão financeiro */}
      <div className="px-[8%] pt-[4%]">
        <div className="h-9 rounded-sm" style={{ background: cor }} />
      </div>
      {/* linhas de conteúdo */}
      <div className="px-[8%] pt-[5%] space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-[2px]" style={{ background: cor }} />
          <div className="h-1.5 w-2/3 bg-slate-300 rounded-sm" />
        </div>
        <div className="h-1 w-full bg-slate-200 rounded-sm" />
        <div className="h-1 w-5/6 bg-slate-200 rounded-sm" />
        <div className="h-1 w-full bg-slate-200 rounded-sm" />
        <div className="h-1 w-2/3 bg-slate-200 rounded-sm" />
      </div>
      {/* tabela */}
      <div className="px-[8%] pt-[5%]">
        <div className="h-3.5 rounded-sm" style={{ background: cor }} />
        <div className="h-2.5 bg-slate-50 border border-b border-slate-200" />
        <div className="h-2.5 bg-slate-100 border border-b border-slate-200" />
        <div className="h-2.5 bg-slate-50 border border-b border-slate-200" />
      </div>
    </div>
  );
}

/** Miniatura CSS do modelo Editorial (marfim + moldura + serif) */
function MiniaturaEditorial({ cor }: { cor: string }): JSX.Element {
  return (
    <div
      className="w-full aspect-[210/297] rounded-md overflow-hidden border border-border shadow-sm relative"
      style={{ background: '#FAF8F4' }}
    >
      {/* moldura dupla */}
      <div className="absolute inset-[5%] pointer-events-none" style={{ border: `1px solid ${cor}55`, borderRadius: 2 }} />
      <div className="absolute inset-[6.5%] pointer-events-none" style={{ border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 2 }} />
      {/* rótulo centrado */}
      <div className="pt-[10%] flex items-center justify-center gap-3">
        <div className="h-px w-6" style={{ background: `${cor}66` }} />
        <div className="text-[9px] tracking-[0.25em]" style={{ color: cor, fontFamily: 'Georgia, serif', fontWeight: 700 }}>
          PROPOSTA
        </div>
        <div className="h-px w-6" style={{ background: `${cor}66` }} />
      </div>
      {/* empresa */}
      <div className="pt-[6%] flex justify-center">
        <div className="h-1.5 w-20 bg-stone-400 rounded-sm" />
      </div>
      {/* título grande */}
      <div className="pt-[14%] px-[14%] space-y-2">
        <div className="h-3 w-full bg-stone-700 rounded-sm" style={{ fontFamily: 'Georgia, serif' }} />
        <div className="h-3 w-1/2 bg-stone-700 rounded-sm" style={{ fontFamily: 'Georgia, serif' }} />
        {/* losango */}
        <div className="flex justify-center pt-3">
          <div className="w-2 h-2 rotate-45" style={{ background: cor }} />
        </div>
        <div className="h-1.5 w-2/3 mx-auto bg-stone-300 rounded-sm" />
        <div className="h-2 w-1/2 mx-auto bg-stone-500 rounded-sm" />
      </div>
      {/* total */}
      <div className="pt-[8%] px-[20%]">
        <div className="h-px w-full" style={{ background: `${cor}88` }} />
        <div className="h-2 w-1/2 mx-auto mt-2 rounded-sm" style={{ background: cor }} />
      </div>
      {/* secções numeradas */}
      <div className="pt-[6%] px-[14%] space-y-2.5">
        <div className="flex items-baseline gap-2">
          <div className="text-[11px] italic" style={{ color: `${cor}99`, fontFamily: 'Georgia, serif' }}>01</div>
          <div className="h-1.5 w-2/5 bg-stone-500 rounded-sm" />
        </div>
        <div className="h-px w-full bg-stone-200" />
        <div className="h-1 w-full bg-stone-200 rounded-sm" />
        <div className="h-1 w-5/6 bg-stone-200 rounded-sm" />
        <div className="flex items-baseline gap-2 pt-1">
          <div className="text-[11px] italic" style={{ color: `${cor}99`, fontFamily: 'Georgia, serif' }}>02</div>
          <div className="h-1.5 w-1/3 bg-stone-500 rounded-sm" />
        </div>
        <div className="h-px w-full bg-stone-200" />
        <div className="h-1 w-2/3 bg-stone-200 rounded-sm" />
      </div>
    </div>
  );
}

/** Miniatura CSS do modelo Cotação (réplica do layout de referência) */
function MiniaturaCotacao({ cor }: { cor: string }): JSX.Element {
  return (
    <div className="w-full aspect-[210/297] rounded-md overflow-hidden bg-white border border-border shadow-sm relative">
      {/* cabeçalho: marca à esquerda + banda de título à direita */}
      <div className="px-[7%] pt-[6%] flex items-start justify-between gap-[6%]">
        <div className="pt-1">
          <div className="w-3.5 h-3.5 rounded-[3px]" style={{ background: cor }} />
          <div className="h-1.5 w-10 bg-slate-700 rounded-sm mt-1.5" />
          <div className="h-1 w-8 bg-slate-300 rounded-sm mt-1" />
        </div>
        <div className="w-[52%] h-8 rounded-md flex items-center justify-center" style={{ background: cor }}>
          <div className="h-1.5 w-12 bg-white/90 rounded-sm" />
        </div>
      </div>
      {/* bloco de informação a duas colunas */}
      <div className="px-[7%] pt-[5%] flex gap-[8%]">
        <div className="flex-1 space-y-1">
          <div className="h-1 w-6 bg-slate-500 rounded-sm" />
          <div className="h-1.5 w-10 bg-slate-700 rounded-sm" />
          <div className="h-1 w-9 bg-slate-300 rounded-sm" />
          <div className="h-1 w-7 bg-slate-300 rounded-sm" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="h-1 w-8 bg-slate-500 rounded-sm" />
          <div className="h-1.5 w-9 bg-slate-700 rounded-sm" />
          <div className="h-1 w-6 bg-slate-300 rounded-sm" />
          <div className="h-1 w-7 bg-slate-300 rounded-sm" />
        </div>
      </div>
      {/* tabela com cabeçalho colorido */}
      <div className="px-[7%] pt-[5%]">
        <div className="h-3.5 rounded-sm" style={{ background: cor }} />
        <div className="h-3 bg-white border-b border-slate-200" />
        <div className="h-3 bg-white border-b border-slate-200" />
        <div className="h-3 bg-white border-b border-slate-200" />
        <div className="h-3 bg-white border-b border-slate-200" />
      </div>
      {/* termos (esq.) + totais (dir.) */}
      <div className="px-[7%] pt-[5%] flex gap-[10%]">
        <div className="flex-1 space-y-1">
          <div className="h-1.5 w-10 bg-slate-500 rounded-sm" />
          <div className="h-1 w-full bg-slate-200 rounded-sm" />
          <div className="h-1 w-5/6 bg-slate-200 rounded-sm" />
        </div>
        <div className="w-[34%] space-y-1 flex flex-col items-end">
          <div className="h-1 w-full bg-slate-200 rounded-sm" />
          <div className="h-1 w-4/5 bg-slate-200 rounded-sm" />
          <div className="h-px w-full" style={{ background: cor }} />
          <div className="h-2.5 w-full rounded-sm" style={{ background: cor }} />
        </div>
      </div>
      {/* banda de rodapé full-bleed */}
      <div className="absolute bottom-0 left-0 right-0 h-[7%] flex items-center justify-between px-[7%]" style={{ background: cor }}>
        <div className="h-1 w-8 bg-white/90 rounded-sm" />
        <div className="h-1 w-6 bg-white/90 rounded-sm" />
      </div>
    </div>
  );
}

/** Miniatura CSS do modelo Minimalista (tipografia + hairlines) */
function MiniaturaMinimal({ cor }: { cor: string }): JSX.Element {
  return (
    <div className="w-full aspect-[210/297] rounded-md overflow-hidden bg-white border border-border shadow-sm relative">
      {/* cabeçalho: logo + fiscais (esq.) / metadados (dir.) */}
      <div className="px-[8%] pt-[6%] flex items-start justify-between gap-[6%]">
        <div className="space-y-1 pt-0.5">
          <div className="w-4 h-4 rounded-[3px] bg-slate-800" />
          <div className="h-1.5 w-10 bg-slate-800 rounded-sm" />
          <div className="h-0.5 w-12 bg-slate-300 rounded-sm" />
          <div className="h-0.5 w-10 bg-slate-200 rounded-sm" />
        </div>
        <div className="space-y-1 flex flex-col items-end">
          <div className="h-0.5 w-8 bg-slate-400 rounded-sm" />
          <div className="h-1.5 w-10 bg-slate-700 rounded-sm" />
          <div className="h-0.5 w-7 bg-slate-400 rounded-sm" />
          <div className="h-1 w-8 bg-slate-600 rounded-sm" />
        </div>
      </div>
      {/* hairline + traço de acento + título grande */}
      <div className="px-[8%] pt-[5%] space-y-1.5">
        <div className="h-px w-full bg-slate-200" />
        <div className="w-6 h-[3px] rounded-sm" style={{ background: cor }} />
        <div className="h-3 w-2/3 bg-slate-800 rounded-sm" />
        <div className="h-1 w-1/2 bg-slate-300 rounded-sm" />
      </div>
      {/* duas colunas: cliente / pagamento */}
      <div className="px-[8%] pt-[5%] flex gap-[8%]">
        <div className="flex-1 space-y-1">
          <div className="h-1 w-6 rounded-sm" style={{ background: cor }} />
          <div className="h-1.5 w-10 bg-slate-700 rounded-sm" />
          <div className="h-1 w-9 bg-slate-300 rounded-sm" />
          <div className="h-1 w-7 bg-slate-200 rounded-sm" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="h-1 w-9 rounded-sm" style={{ background: cor }} />
          <div className="h-1.5 w-8 bg-slate-700 rounded-sm" />
          <div className="h-1 w-7 bg-slate-300 rounded-sm" />
        </div>
      </div>
      {/* tabela em hairlines */}
      <div className="px-[8%] pt-[5%] space-y-1">
        <div className="h-1 w-9 bg-slate-400 rounded-sm" />
        <div className="h-px w-full bg-slate-200" />
        <div className="h-1.5 w-full bg-slate-100 rounded-sm" />
        <div className="h-px w-full bg-slate-200" />
        <div className="h-1.5 w-5/6 bg-slate-100 rounded-sm" />
        <div className="h-px w-full bg-slate-200" />
        <div className="h-1.5 w-2/3 bg-slate-100 rounded-sm" />
      </div>
      {/* totais com régua de acento */}
      <div className="px-[8%] pt-[6%] flex justify-end">
        <div className="w-[36%] space-y-1.5">
          <div className="h-1 w-full bg-slate-200 rounded-sm" />
          <div className="h-1 w-4/5 bg-slate-200 rounded-sm" />
          <div className="h-[2px] w-full" style={{ background: cor }} />
          <div className="h-2.5 w-full rounded-sm bg-slate-800" />
        </div>
      </div>
      {/* assinaturas */}
      <div className="px-[8%] pt-[7%] flex justify-between">
        <div className="space-y-1">
          <div className="h-0.5 w-8 bg-slate-300 rounded-sm" />
          <div className="h-px w-16 bg-slate-300" />
        </div>
        <div className="space-y-1">
          <div className="h-0.5 w-8 bg-slate-300 rounded-sm" />
          <div className="h-px w-16 bg-slate-300" />
        </div>
      </div>
    </div>
  );
}

export default function TemplateManager() {
  const { user, organization } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [verificando, setVerificando] = useState(true);
  // Catálogo visível: modelos base + restritos atribuídos à org activa
  const [catalogo, setCatalogo] = useState(() => templatesVisiveisPara(null));
  const [templateDefault, setTemplateDefault] = useState<PdfTemplateId>(() =>
    obterTemplateDefault(templatesVisiveisPara(null).map(t => t.id)),
  );

  // Verificação de role (mesma disciplina de Admin.tsx / TenantDetailPage):
  // guarda interna da área /admin — defense in depth junto à RLS.
  useEffect(() => {
    if (!user) return;
    let cancelado = false;
    (async () => {
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      if (!cancelado) {
        setIsAdmin(!!data?.some(r => r.role === 'admin'));
        setVerificando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [user]);

  // Filtra o catálogo às linhas atribuídas à org activa (RLS:
  // membros lêem só as próprias). Erro → catálogo base.
  useEffect(() => {
    const orgId = organization?.id;
    if (!orgId) return;
    let cancelado = false;
    (async () => {
      const chaves = await OrganizationTemplateService.chavesAtribuidasAtivas(orgId);
      if (cancelado) return;
      const visiveis = templatesVisiveisPara(chaves);
      setCatalogo(visiveis);
      // omissão pessoal sanitizada contra o catálogo visível
      setTemplateDefault(prev =>
        visiveis.some(t => t.id === prev) ? prev : obterTemplateDefault(visiveis.map(t => t.id)));
    })();
    return () => { cancelado = true; };
  }, [organization?.id]);

  const activar = (id: PdfTemplateId): void => {
    definirTemplateDefault(id);
    setTemplateDefault(id);
    const info = TEMPLATES_PDF.find(t => t.id === id);
    toast.success(`Modelo "${info?.nome ?? id}" definido como omissão`);
  };

  if (verificando) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> A verificar permissões...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">Acesso negado: área restrita a administradores.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Modelos de Proposta PDF</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Os documentos são gerados directamente em PDF vectorial, prontos a enviar por email ao cliente.
          Escolha o modelo usado por omissão nas exportações.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {catalogo.map(template => {
          const cor = template.id === 'editorial' ? '#8A6D3B' : template.id === 'cotacao' ? '#F97316' : template.id === 'minimal' ? '#0F172A' : '#1F4E79';
          const activo = templateDefault === template.id;
          return (
            <Card
              key={template.id}
              className={`overflow-hidden transition-all ${activo ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
            >
              <CardContent className="p-6 space-y-5">
                <div className="mx-auto w-44">
                  {template.id === 'editorial'
                    ? <MiniaturaEditorial cor={cor} />
                    : template.id === 'cotacao'
                      ? <MiniaturaCotacao cor={cor} />
                      : template.id === 'minimal'
                        ? <MiniaturaMinimal cor={cor} />
                        : <MiniaturaExecutivo cor={cor} />}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-lg">{template.nome}</h3>
                    {activo && (
                      <Badge className="gap-1">
                        <Check className="h-3 w-3" />
                        Omissão
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{template.descricao}</p>
                </div>

                <ul className="text-sm space-y-1.5">
                  {template.caracteristicas.map(carac => (
                    <li key={carac} className="flex items-start gap-2 text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      {carac}
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={activo ? 'secondary' : 'default'}
                  disabled={activo}
                  onClick={() => activar(template.id)}
                >
                  {activo ? 'Modelo activo' : 'Definir como omissão'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="rounded-xl border bg-secondary/40 p-5 text-sm text-muted-foreground space-y-2">
        <p className="font-semibold text-foreground">Como funciona</p>
        <p>
          Cada modelo deriva a paleta da cor primária definida na Organização (marca da empresa) e inclui
          logotipo, dados do cliente e emitente, tabela de itens com totais, cronograma, observações, dados de
          pagamento e áreas de assinatura.
        </p>
        <p>
          Para enviar uma proposta: abra a proposta &gt; <strong>Baixar PDF</strong> (ficheiro para anexar
          manualmente) ou <strong>Enviar Email</strong> (o PDF é gerado e enviado automaticamente ao cliente).
        </p>
      </div>
    </div>
  );
}
