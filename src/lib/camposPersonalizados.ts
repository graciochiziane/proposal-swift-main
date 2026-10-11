// ============================================================
// Campos Personalizados — validação e normalização (PURO)
//
// Regras partilhadas entre o service (CRUD), a UI de gestão e
// os consumidores (templates PDF). Zero dependências — testável
// sem rede, no padrão do resolver de templates.
//
// Domínio de tipos (1ª versão — deliberadamente simples):
//   texto | numero | telefone | email | url | data | multilinha
//
// Notas de validação:
//   - telefone: branda por opção — empresas moçambicanas usam
//     formatos variados (+258 84…, 82/84…, landline…). Só rejeita
//     o obviamente inválido (letras).
//   - data: aceita ISO (yyyy-mm-dd) ou dd/mm/yyyy.
//   - Nada disto corre na DB além do domínio de field_type —
//     a validação de valor vive aqui (frontend + service).
// ============================================================

/** Tipos de campo suportados na 1ª versão */
export const TIPOS_CAMPO = [
  'texto', 'numero', 'telefone', 'email', 'url', 'data', 'multilinha',
] as const;

export type TipoCampoPersonalizado = (typeof TIPOS_CAMPO)[number];

/** Chave técnica estável: ^[a-z][a-z0-9_]{0,63}$ */
export const RE_FIELD_KEY = /^[a-z][a-z0-9_]{0,63}$/;

export interface ResultadoValidacao {
  ok: boolean;
  erro?: string;
}

/**
 * Normaliza um input livre (normalmente a label) numa field_key
 * técnica válida: minúsculas, acentos removidos, não-alfanuméricos
 * → underscore, colapsa underscores, corta a 64.
 * Devolve '' quando não sobra nada útil.
 */
export function normalizarChaveCampo(input: string): string {
  const base = (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
  // não pode começar por dígito → prefixa 'campo_'
  if (/^\d/.test(base)) return `campo_${base}`.slice(0, 64);
  return base.slice(0, 64);
}

/** Valida uma field_key já normalizada (para o service/DB) */
export function validarChaveCampo(chave: string): ResultadoValidacao {
  if (!chave) return { ok: false, erro: 'Chave técnica é obrigatória' };
  if (!RE_FIELD_KEY.test(chave)) {
    return {
      ok: false,
      erro: 'Chave técnica: minúsculas, dígitos e _; começa por letra; máx. 64 caracteres',
    };
  }
  return { ok: true };
}

/**
 * Valida um tipo de campo contra o domínio da 1ª versão.
 */
export function validarTipoCampo(tipo: string): ResultadoValidacao {
  if (!(TIPOS_CAMPO as readonly string[]).includes(tipo)) {
    return { ok: false, erro: `Tipo inválido (válidos: ${TIPOS_CAMPO.join(', ')})` };
  }
  return { ok: true };
}

// ---- validação por tipo (deliberadamente branda) ----

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RE_URL = /^https?:\/\/[^\s]+$/i;
const RE_NUMERO = /^-?\d+([.,]\d+)?$/;
const RE_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const RE_DATA_PT = /^\d{2}\/\d{2}\/\d{4}$/;
const RE_TELEFONE = /^[+()\d\s/.-]+$/; // branda: sem letras

/**
 * Valida o VALOR contra o tipo declarado do campo.
 * Valor vazio é SEMPRE válido (campo opcional; linha vazia
 * simplesmente oculta o bloco no template).
 */
export function validarValorCampo(tipo: TipoCampoPersonalizado, valor: string): ResultadoValidacao {
  const v = (valor ?? '').trim();
  if (!v) return { ok: true };
  switch (tipo) {
    case 'email':
      if (!RE_EMAIL.test(v)) return { ok: false, erro: 'Email inválido (ex.: empresa@exemplo.co.mz)' };
      return { ok: true };
    case 'url':
      if (!RE_URL.test(v)) return { ok: false, erro: 'URL inválida (deve começar por http:// ou https://)' };
      return { ok: true };
    case 'numero':
      if (!RE_NUMERO.test(v)) return { ok: false, erro: 'Número inválido (apenas dígitos, sinal e separador decimal)' };
      return { ok: true };
    case 'data':
      if (!RE_DATA_ISO.test(v) && !RE_DATA_PT.test(v)) {
        return { ok: false, erro: 'Data inválida (use AAAA-MM-DD ou DD/MM/AAAA)' };
      }
      return { ok: true };
    case 'telefone':
      // branda por opção (empresas moçambicanas: +258…, 82/84…, landline)
      if (!RE_TELEFONE.test(v)) return { ok: false, erro: 'Telefone inválido (apenas dígitos, +, espaços e travessões)' };
      return { ok: true };
    case 'texto':
    case 'multilinha':
      return { ok: true };
  }
}

/**
 * Valida um campo completo (chave + tipo + valor) — usado pelo
 * service antes de INSERT/UPDATE e pela UI antes de submeter.
 */
export function validarCampoPersonalizado(input: {
  field_key: string;
  field_type: string;
  value?: string;
}): ResultadoValidacao {
  const chave = validarChaveCampo(input.field_key);
  if (!chave.ok) return chave;
  const tipo = validarTipoCampo(input.field_type);
  if (!tipo.ok) return tipo;
  return validarValorCampo(input.field_type as TipoCampoPersonalizado, input.value ?? '');
}
