// ============================================================
// Testes — validação de campos personalizados (puro, sem rede)
//
// Cobrem: normalização de chave (acentos, espaços, dígito
// inicial), domínio de tipos, validação de valor por tipo
// (email/url/numero/data/telefone branda) e campo completo.
// ============================================================

import { describe, test, expect } from 'vitest';
import {
  normalizarChaveCampo,
  validarChaveCampo,
  validarTipoCampo,
  validarValorCampo,
  validarCampoPersonalizado,
} from '../camposPersonalizados';

describe('normalizarChaveCampo', () => {
  test('slugify com acentos, espaços e pontuação', () => {
    expect(normalizarChaveCampo('Número do Alvará')).toBe('numero_do_alvara');
    expect(normalizarChaveCampo('Licença Comercial')).toBe('licenca_comercial');
    expect(normalizarChaveCampo('  Slogan   da   Empresa ')).toBe('slogan_da_empresa');
    expect(normalizarChaveCampo('Banco / NIB')).toBe('banco_nib');
  });

  test('dígito inicial ganha prefixo campo_', () => {
    expect(normalizarChaveCampo('24 Horas')).toBe('campo_24_horas');
    expect(normalizarChaveCampo('9abc')).toBe('campo_9abc');
  });

  test('input sem conteúdo útil devolve vazio', () => {
    expect(normalizarChaveCampo('')).toBe('');
    expect(normalizarChaveCampo('---')).toBe('');
  });

  test('corta a 64 caracteres', () => {
    expect(normalizarChaveCampo('a'.repeat(80)).length).toBe(64);
  });
});

describe('validarChaveCampo', () => {
  test('aceita chaves canónicas', () => {
    for (const chave of ['nib', 'payment_instructions', 'a1b2_c3', 'x']) {
      expect(validarChaveCampo(chave).ok).toBe(true);
    }
  });

  test('rejeita inválidas', () => {
    for (const chave of ['', '9abc', 'Campo', 'com espaço', 'com-hífen', 'a'.repeat(65)]) {
      expect(validarChaveCampo(chave).ok).toBe(false);
    }
  });
});

describe('validarTipoCampo', () => {
  test('aceita os 7 tipos da 1ª versão', () => {
    for (const tipo of ['texto', 'numero', 'telefone', 'email', 'url', 'data', 'multilinha']) {
      expect(validarTipoCampo(tipo).ok).toBe(true);
    }
  });

  test('rejeita tipos fora do domínio (fórmulas, listas dinâmicas…)', () => {
    for (const tipo of ['formula', 'relacional', 'lista', 'calculado', '']) {
      expect(validarTipoCampo(tipo).ok).toBe(false);
    }
  });
});

describe('validarValorCampo', () => {
  test('valor vazio é sempre válido (campo opcional)', () => {
    for (const tipo of ['texto', 'email', 'url', 'numero', 'data', 'telefone', 'multilinha'] as const) {
      expect(validarValorCampo(tipo, '').ok).toBe(true);
      expect(validarValorCampo(tipo, '   ').ok).toBe(true);
    }
  });

  test('email', () => {
    expect(validarValorCampo('email', 'comercial@empresa.co.mz').ok).toBe(true);
    expect(validarValorCampo('email', 'emmanueltala7@gmail.com').ok).toBe(true);
    expect(validarValorCampo('email', 'sem-arroba').ok).toBe(false);
    expect(validarValorCampo('email', 'a@b').ok).toBe(false);
  });

  test('url', () => {
    expect(validarValorCampo('url', 'https://talaservice.co.mz').ok).toBe(true);
    expect(validarValorCampo('url', 'http://x.pt').ok).toBe(true);
    expect(validarValorCampo('url', 'www.semprotocolo.pt').ok).toBe(false);
  });

  test('numero aceita inteiro e decimal, rejeita texto', () => {
    expect(validarValorCampo('numero', '12345').ok).toBe(true);
    expect(validarValorCampo('numero', '-12,5').ok).toBe(true);
    expect(validarValorCampo('numero', '98/2026').ok).toBe(false);
    expect(validarValorCampo('numero', 'doze').ok).toBe(false);
  });

  test('data aceita ISO e DD/MM/AAAA', () => {
    expect(validarValorCampo('data', '2026-09-30').ok).toBe(true);
    expect(validarValorCampo('data', '30/09/2026').ok).toBe(true);
    expect(validarValorCampo('data', '30-09-2026').ok).toBe(false);
  });

  test('telefone branda — aceita formatos moçambicanos, rejeita letras', () => {
    expect(validarValorCampo('telefone', '+258 87 038 3066').ok).toBe(true);
    expect(validarValorCampo('telefone', '82/84 038 3065').ok).toBe(true);
    expect(validarValorCampo('telefone', '+258-84-000-0000').ok).toBe(true);
    expect(validarValorCampo('telefone', 'ligue para casa').ok).toBe(false);
  });
});

describe('validarCampoPersonalizado (composto)', () => {
  test('campo válido integral', () => {
    expect(
      validarCampoPersonalizado({ field_key: 'numero_alvara', field_type: 'texto', value: '987/2026' }).ok,
    ).toBe(true);
  });

  test('chave inválida falha antes do valor', () => {
    const r = validarCampoPersonalizado({ field_key: 'Número', field_type: 'texto', value: 'x' });
    expect(r.ok).toBe(false);
    expect(r.erro).toContain('Chave técnica');
  });

  test('tipo inválido é rejeitado', () => {
    expect(validarCampoPersonalizado({ field_key: 'nib', field_type: 'formula', value: '1' }).ok).toBe(false);
  });

  test('valor incompatível com o tipo é rejeitado', () => {
    expect(validarCampoPersonalizado({ field_key: 'site', field_type: 'url', value: 'não é url' }).ok).toBe(false);
  });
});
