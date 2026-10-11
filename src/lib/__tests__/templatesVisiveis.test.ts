// ============================================================
// Testes — gating do catálogo de templates (restrito vs base)
//
// templatesVisiveisPara: regra de visibilidade dos seletores do
// tenant (modelos base sempre; restritos apenas se atribuídos).
// obterTemplateDefault(permitidas): sanitização da preferência
// pessoal (localStorage) contra o catálogo visível.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { TEMPLATES_PDF, templatesVisiveisPara, obterTemplateDefault, definirTemplateDefault, obterTemplateInfo } from '@/lib/pdf/templates';
import type { PdfTemplateId } from '@/lib/pdf/tipos';

const CHAVE = 'ps_pdf_template_default';

describe('templatesVisiveisPara (gating do catálogo)', () => {
  it('sem chaves atribuídas devolve só os modelos base (não restritos)', () => {
    const visiveis = templatesVisiveisPara([]);
    expect(visiveis.map(t => t.id)).not.toContain('talaService');
    expect(visiveis.length).toBe(TEMPLATES_PDF.filter(t => !t.restrito).length);
  });

  it('null/undefined (sem org / erro) também devolve só os base', () => {
    expect(templatesVisiveisPara(null).map(t => t.id)).not.toContain('talaService');
    expect(templatesVisiveisPara(undefined).map(t => t.id)).not.toContain('talaService');
  });

  it('org com talaService atribuído vê os base + talaService', () => {
    const visiveis = templatesVisiveisPara(['talaService']);
    const ids = visiveis.map(t => t.id);
    expect(ids).toContain('talaService');
    expect(ids).toContain('executivo');
    expect(ids).toContain('cotacao');
    expect(ids.length).toBe(TEMPLATES_PDF.filter(t => !t.restrito).length + 1);
  });

  it('aceita Set além de array', () => {
    expect(templatesVisiveisPara(new Set(['talaService'])).map(t => t.id)).toContain('talaService');
  });

  it('chaves desconhecidas/não registadas são ignoradas silenciosamente', () => {
    const visiveis = templatesVisiveisPara(['modelo-fantasma']);
    expect(visiveis.length).toBe(TEMPLATES_PDF.filter(t => !t.restrito).length);
  });
});

describe('obterTemplateDefault com catálogo permitido', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('preferência guardada dentro do permitido é respeitada', () => {
    definirTemplateDefault('editorial');
    expect(obterTemplateDefault(['executivo', 'editorial'])).toBe('editorial');
  });

  it('preferência restrita fora do permitido degrada para executivo', () => {
    definirTemplateDefault('talaService');
    expect(obterTemplateDefault(['executivo', 'editorial', 'cotacao', 'minimal'] as PdfTemplateId[])).toBe('executivo');
  });

  it('preferência restrita DENTRO do permitido é respeitada', () => {
    definirTemplateDefault('talaService');
    expect(obterTemplateDefault(['executivo', 'talaService'])).toBe('talaService');
  });

  it('sem lista de permitidas mantém o comportamento histórico', () => {
    definirTemplateDefault('cotacao');
    expect(obterTemplateDefault()).toBe('cotacao');
    definirTemplateDefault('talaService');
    expect(obterTemplateDefault()).toBe('talaService');
  });
});

describe('metadado restrito do registry', () => {
  it('talaService é o único modelo restrito do catálogo', () => {
    const restritos = TEMPLATES_PDF.filter(t => t.restrito).map(t => t.id);
    expect(restritos).toEqual(['talaService']);
  });

  it('obterTemplateInfo expõe o metadado restrito', () => {
    expect(obterTemplateInfo('talaService').restrito).toBe(true);
    expect(obterTemplateInfo('executivo').restrito).toBeUndefined();
  });
});
