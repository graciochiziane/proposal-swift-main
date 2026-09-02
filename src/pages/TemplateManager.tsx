// ============================================================
// Modelos de Proposta PDF (galeria)
//
// Mostra os 3 templates incorporados (Cotação, Executivo e
// Editorial) com miniaturas CSS, características e escolha do
// modelo por omissão (localStorage). Os modelos são gerados em
// código (PDF vectorial) — já não há templates HTML em base de
// dados nem editor de HTML.
// ============================================================

import { useState } from 'react';
import { TEMPLATES_PDF, obterTemplateDefault, definirTemplateDefault } from '@/lib/pdf';
import type { PdfTemplateId } from '@/lib/pdf';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { toast } from 'sonner';

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

export default function TemplateManager() {
  const [templateDefault, setTemplateDefault] = useState<PdfTemplateId>(obterTemplateDefault());

  const activar = (id: PdfTemplateId): void => {
    definirTemplateDefault(id);
    setTemplateDefault(id);
    const info = TEMPLATES_PDF.find(t => t.id === id);
    toast.success(`Modelo "${info?.nome ?? id}" definido como omissão`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Modelos de Proposta PDF</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Os documentos são gerados directamente em PDF vectorial, prontos a enviar por email ao cliente.
          Escolha o modelo usado por omissão nas exportações.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES_PDF.map(template => {
          const cor = template.id === 'editorial' ? '#8A6D3B' : template.id === 'cotacao' ? '#F97316' : '#1F4E79';
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
          Cada modelo deriva a paleta da cor primária definida nas Configurações (marca da empresa) e inclui
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
