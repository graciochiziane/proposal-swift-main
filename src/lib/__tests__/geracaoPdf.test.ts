// ============================================================
// Testes do motor de geração PDF (templates modernos)
//
// Valida: parser markdown, saneamento WinAnsi, nome de ficheiro,
// e geração real dos 2 templates (nº de páginas, tamanho do
// output, base64 válido para email).
//
// PREVIEW_PDF=1 npx vitest run src/lib/__tests__/geracaoPdf.test.ts
//   → escreve os 2 PDFs de amostra em /tmp-preview/ (QA visual)
// ============================================================

import { describe, test, expect } from 'vitest';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { parseMarkdown, parseInline } from '../pdf/markdown';
import { limparTextoPdf, nomeFicheiroPdf } from '../pdf/utils';
import { gerarPropostaPdf, pdfPropostaBase64 } from '../pdf/gerar';
import type { DadosPropostaPdf } from '../pdf/tipos';
import { seccoesParaPdf } from '../pdf/converter';

const AMOSTRA: DadosPropostaPdf = {
  titulo: 'Proposta Comercial',
  numero: 'PROP-202609-0001',
  data: '2026-09-01',
  validadeDias: 15,
  cliente: {
    nome: 'António Chissano',
    empresa: 'Moçambique Digital, SA',
    nuit: '400123456',
    email: 'antonio@mzdigital.co.mz',
    telefone: '+258 84 000 0000',
    endereco: 'Av. Julius Nyerere 1200, Maputo',
  },
  empresa: {
    nome: 'Agência Ímpeto Criativo',
    nuit: '400987654',
    endereco: 'Rua da Kongwa 45, Maputo',
    email: 'propostas@impeto.co.mz',
    telefone: '+258 82 111 2233',
    corPrimaria: '#1F4E79',
  },
  itens: [
    { nome: 'Design de identidade visual completa', quantidade: 1, precoUnitario: 145000, subtotal: 145000 },
    { nome: 'Website institucional (5 páginas, CMS)', quantidade: 1, precoUnitario: 210000, subtotal: 210000 },
    { nome: 'Gestão de redes sociais (mensal)', quantidade: 3, precoUnitario: 32000, subtotal: 96000 },
    { nome: 'Sessão de formação de equipa (dia inteiro)', quantidade: 2, precoUnitario: 18500, subtotal: 37000 },
  ],
  mostrarFinanceiro: true,
  totais: {
    subtotal: 488000,
    desconto: 24400,
    descontoLabel: '5%',
    iva: 74176,
    ivaPercentual: 16,
    total: 537776,
  },
  seccoes: [
    {
      titulo: 'Contexto do Cliente',
      conteudo: 'A **Moçambique Digital** opera no sector de serviços financeiros digitais, com forte presença em Maputo e expansão para a Beira. A marca actual não reflecte a maturidade do negócio — o website vigente data de 2021 e as redes sociais usam materiais inconsistentes.\n\nEste documento apresenta o plano de rebranding e presença digital para os próximos trimestres.',
    },
    {
      titulo: 'Solução Proposta',
      conteudo: 'A solução assenta em **três pilares complementares**:\n\n- Identidade visual renovada (logótipo, paleta, tipografia)\n- Website institucional com CMS autonomo\n- Programa mensal de conteúdo para redes sociais\n\nCada pilar pode ser contratado de forma independente; o pacote completo beneficia de um desconto de 5%.',
    },
    {
      titulo: 'Cronograma',
      conteudo: 'TABELA_CRONOGRAMA_INICIO\n| Fase | Entrega | Duração |\n|---|---|---|\n| Descoberta e estratégia | Brief + pesquisa | 1 semana |\n| Identidade visual | 3 conceitos + refinamento | 3 semanas |\n| Website | Design + desenvolvimento | 4 semanas |\n| Redes sociais | Calendário editorial | Contínuo |\nTABELA_CRONOGRAMA_FIM',
    },
    {
      titulo: 'Benefícios Esperados',
      conteudo: '- Aumento de 40% no tráfego orgânico estimado 🚀\n- Consistência de marca em todos os pontos de contacto\n- Redução do tempo de publicação de conteúdo em 60%',
    },
  ],
  observacoes: 'Valores em Metiais (MZN), IVA à taxa legal em vigor. Pagamento 50% no início e 50% na entrega. Proposta válida por 15 dias.',
  pagamento: {
    banco: 'BCI',
    conta: '1234567890123',
    nib: '0003 0000 12345678901231',
    mpesa: '82 111 2233',
    emola: '84 000 0000',
  },
};

describe('parseMarkdown', () => {
  test('extrai títulos, parágrafos, listas e tabelas', () => {
    const blocos = parseMarkdown('## Título\n\nParágrafo com **negrito**.\n\n- item 1\n- item 2\n\n| A | B |\n|---|---|\n| 1 | 2 |');
    expect(blocos.map(b => b.tipo)).toEqual(['titulo', 'paragrafo', 'lista', 'tabela']);
    const tabela = blocos[3];
    if (tabela.tipo !== 'tabela') throw new Error('esperado tabela');
    expect(tabela.cabecalho).toEqual(['A', 'B']);
    expect(tabela.linhas).toEqual([['1', '2']]);
  });

  test('parseInline separa negrito e itálico', () => {
    const segs = parseInline('normal **negrito** *itálico*')
      .filter(s => s.texto.trim().length > 0);
    expect(segs.map(s => [s.texto.trim(), s.negrito, s.italico])).toEqual([
      ['normal', false, false],
      ['negrito', true, false],
      ['itálico', false, true],
    ]);
  });

  test('remove markers de cronograma', () => {
    const blocos = parseMarkdown('TABELA_CRONOGRAMA_INICIO\n| Fase | Semana |\n|---|---|\n| A | 1 |\nTABELA_CRONOGRAMA_FIM');
    const tabela = blocos.find(b => b.tipo === 'tabela');
    if (!tabela) throw new Error('tabela não extraída');
    expect(tabela.cabecalho).toEqual(['Fase', 'Semana']);
  });
});

describe('limparTextoPdf', () => {
  test('mantém acentos portugueses e remove emojis', () => {
    const limpo = limparTextoPdf('Não é possível — avaliação ✓ 🚀 ça');
    expect(limpo).toContain('Não é possível');
    expect(limpo).toContain('avaliação');
    expect(limpo).not.toContain('🚀');
  });
});

describe('nomeFicheiroPdf', () => {
  test('sanitiza separadores e garante .pdf', () => {
    expect(nomeFicheiroPdf('Proposta PROP-202609-0001')).toBe('Proposta-PROP-202609-0001.pdf');
    expect(nomeFicheiroPdf('a/b\\c:d.pdf')).toBe('abcd.pdf');
  });
});

describe('seccoesParaPdf', () => {
  test('ordena secções canónicas e respeita toggles', () => {
    const seccoes = seccoesParaPdf(
      { problema: 'p', contexto: 'c', extra: 'x' },
      { problema: false },
    );
    expect(seccoes.map(s => s.titulo)).toEqual(['Contexto do Cliente', 'extra']);
  });
});

describe('geração dos templates', () => {
  test('Executivo gera PDF multi-página com base64 válido', () => {
    const doc = gerarPropostaPdf(AMOSTRA, 'executivo');
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(3);
    const blob = doc.output('blob') as Blob;
    expect(blob.size).toBeGreaterThan(15000);
    const base64 = pdfPropostaBase64(AMOSTRA, 'executivo');
    expect(base64.length).toBeGreaterThan(1000);
    expect(Buffer.from(base64, 'base64').subarray(0, 4).toString()).toBe('%PDF');
  });

  test('Editorial gera PDF multi-página com base64 válido', () => {
    const doc = gerarPropostaPdf(AMOSTRA, 'editorial');
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(3);
    const blob = doc.output('blob') as Blob;
    expect(blob.size).toBeGreaterThan(15000);
    const base64 = pdfPropostaBase64(AMOSTRA, 'editorial');
    expect(Buffer.from(base64, 'base64').subarray(0, 4).toString()).toBe('%PDF');
  });

  test('Doc A (narrativa sem financeiro) gera sem tabela de itens', () => {
    const docA: DadosPropostaPdf = { ...AMOSTRA, mostrarFinanceiro: false, itens: [], pagamento: undefined };
    const doc = gerarPropostaPdf(docA, 'executivo');
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });

  test('proposal sem secções nem itens não lança excepção', () => {
    const minima: DadosPropostaPdf = {
      ...AMOSTRA,
      itens: [], seccoes: [], observacoes: undefined, pagamento: undefined,
    };
    for (const template of ['executivo', 'editorial'] as const) {
      const doc = gerarPropostaPdf(minima, template);
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    }
  });

  // QA visual: PREVIEW_PDF=1 escreve os PDFs de amostra
  test.runIf(process.env.PREVIEW_PDF === '1')('exporta PDFs de amostra para QA visual', () => {
    const dir = '/home/z/my-project/preview-pdf';
    mkdirSync(dir, { recursive: true });
    for (const template of ['executivo', 'editorial'] as const) {
      const buffer = Buffer.from(gerarPropostaPdf(AMOSTRA, template).output('arraybuffer') as ArrayBuffer);
      writeFileSync(`${dir}/amostra-${template}.pdf`, buffer);
    }
    expect(existsSync(`${dir}/amostra-executivo.pdf`)).toBe(true);
  });
});
