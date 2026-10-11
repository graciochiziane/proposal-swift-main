// ============================================================
// Testes do resolver de template por organização
// (proposta auditada, Secção 11.1 — sem rede, consulta injectada)
//
// Casos exigidos:
//   1. Org com linha default ACTIVA válida → devolve a chave da org.
//   2. Org com linha default INACTIVA → devolve o fallback
//      (a própria query filtra is_active; consulta → null).
//   3. Org sem linhas → fallback (idêntico ao comportamento actual).
//   4. Chave órfã (modelo removido em deploy posterior) → fallback
//      'executivo' do registry, nunca erro.
//   5. Erro de rede/Supabase rejeitada → fallback; nunca lança.
//   6. Sem orgId (utilizador sem organização) → fallback directo,
//      SEM query.
//   7. Precedência: o default da org ganha ao fallback
//      (que representa a preferência do user / hardcoded).
// ============================================================

import { describe, test, expect, vi } from 'vitest';
import { resolverTemplateParaOrg, chaveTemplateRegistada } from '../pdf/resolver';

describe('resolverTemplateParaOrg', () => {
  test('1. org com default activo válido devolve a chave da org', async () => {
    const consultar = vi.fn().mockResolvedValue('editorial');
    const resultado = await resolverTemplateParaOrg('org-1', 'executivo', consultar);
    expect(resultado).toBe('editorial');
    expect(consultar).toHaveBeenCalledWith('org-1');
    expect(consultar).toHaveBeenCalledTimes(1);
  });

  test('2. default INACTIVO (consulta já filtra is_active → null) devolve o fallback', async () => {
    const consultar = vi.fn().mockResolvedValue(null); // linha inactiva = não devolvida pela query
    const resultado = await resolverTemplateParaOrg('org-1', 'cotacao', consultar);
    expect(resultado).toBe('cotacao');
  });

  test('3. org sem linhas devolve o fallback (comportamento actual)', async () => {
    const consultar = vi.fn().mockResolvedValue(undefined);
    const resultado = await resolverTemplateParaOrg('org-1', 'executivo', consultar);
    expect(resultado).toBe('executivo');
  });

  test('4. chave órfã degrada para o fallback do registry, nunca para erro', async () => {
    const consultar = vi.fn().mockResolvedValue('modelo-removido-em-deploy-futuro');
    const resultado = await resolverTemplateParaOrg('org-1', 'executivo', consultar);
    expect(resultado).toBe('executivo'); // fallback, não 'modelo-removido…'
  });

  test('5. erro de rede/Supabase devolve o fallback e NUNCA lança', async () => {
    const consultar = vi.fn().mockRejectedValue(new Error('fetch failed'));
    const resultado = await resolverTemplateParaOrg('org-1', 'minimal', consultar);
    expect(resultado).toBe('minimal');
  });

  test('6. sem orgId devolve o fallback SEM consultar (zero queries)', async () => {
    const consultar = vi.fn();
    const resultado = await resolverTemplateParaOrg(null, 'executivo', consultar);
    expect(resultado).toBe('executivo');
    expect(consultar).not.toHaveBeenCalled();
  });

  test('7. precedência: default da org ganha à preferência do user (fallback=localStorage)', async () => {
    // simula: user tinha 'cotacao' gravado no localStorage (fallback),
    // mas a org define 'minimal' como default activo
    const consultar = vi.fn().mockResolvedValue('minimal');
    const resultado = await resolverTemplateParaOrg('org-1', 'cotacao', consultar);
    expect(resultado).toBe('minimal');
  });

  test('sem consultador injectado devolve o fallback (defensivo)', async () => {
    const resultado = await resolverTemplateParaOrg('org-1', 'executivo');
    expect(resultado).toBe('executivo');
  });

  test('orgId string vazia conta como "sem org" (fallback sem query)', async () => {
    const consultar = vi.fn();
    const resultado = await resolverTemplateParaOrg('', 'executivo', consultar);
    expect(resultado).toBe('executivo');
    expect(consultar).not.toHaveBeenCalled();
  });
});

describe('chaveTemplateRegistada', () => {
  test('aceita as 4 chaves do registry', () => {
    for (const chave of ['executivo', 'editorial', 'cotacao', 'minimal'] as const) {
      expect(chaveTemplateRegistada(chave)).toBe(true);
    }
  });

  test('rejeita chaves desconhecidas, null e undefined', () => {
    expect(chaveTemplateRegistada('corporativo-acme')).toBe(false);
    expect(chaveTemplateRegistada(null)).toBe(false);
    expect(chaveTemplateRegistada(undefined)).toBe(false);
    expect(chaveTemplateRegistada('')).toBe(false);
  });
});
