// ============================================================
// Gemini API Client - Direct integration (client-side)
// Fallback and supplement to Edge Function for section generation
// ============================================================

const GEMINI_API_KEY = "AIzaSyBZiC6MSoFbMrHJig7i96hUGyBkexYrczU";
const DEFAULT_MODEL = "gemini-2.5-flash";

export interface GeminiMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

export interface GeminiResponse {
  text: string;
  model: string;
  tokensUsed: number;
}

// --- Tone instructions (matches Edge Function) ---

const TONE_MAP: Record<string, string> = {
  formal: `
- Tom FORMAL CORPORATIVO: linguagem profissional, termos tecnicos precisos.
- Terceira pessoa. Evite primeira pessoa do singular.
- Estrutura clara, frases curtas e directas.
- Adequado para propostas tecnicas e comerciais.`,
  technical: `
- Tom TECNICO: linguagem tecnica e objectiva, sem adjectivos desnecessarios.
- Foque em especificidades, arquitectura, processos e implementacao.
- Use jargao tecnico apropriado para o sector.
- Adequado para audiencias tecnicas (CTO, engenheiros).`,
  commercial: `
- Tom COMERCIAL: linguagem orientada a valor e ROI.
- Destaque beneficios concretos. Use numeros quando disponivel.
- Equilibre persuasao com profissionalismo.`,
  persuasivo: `
- Tom PERSUASIVO: linguagem orientada a venda e conversao.
- Crie urgencia natural. Use frases de impacto.
- Equilibre entusiasmo com profissionalismo.`,
  consultivo: `
- Tom CONSULTIVO: linguagem de assessoria.
- Apresente como recomendacao fundamentada.
- Mostre compreensao profunda do problema.
- Inclua consideracoes estrategicas.`,
};

// --- Section type instructions ---

const TYPE_INSTRUCTIONS: Record<string, string> = {
  cover: `Esta e uma seccao de CAPA. Gere apenas 2-3 linhas com titulo formal e data actual. NAO gere paragrafos longos.`,
  text: `Gere 2-4 paragrafos substanciais para esta seccao narrativa.`,
  methodology: `Descreva a metodologia de forma estruturada. Use lista com marcadores quando apropriado. Inclua fases ou etapas claras.`,
  timeline: `IMPORTANTE: Apresente o cronograma numa tabela markdown com colunas: Fase, Periodo, Actividades, Entregaveis. Inclua 3-6 fases realistas. Antes da tabela, escreva 1 paragrafo introdutorio.`,
  pricing: `Apresente informacao de precos de forma organizada. Se houver valores nas respostas, use-os EXACTAMENTE como fornecidos. NAO invente precos. Use tabela markdown quando apropriado.`,
  terms: `Apresente termos e condicoes de forma clara e juridicamente adequada. Use lista com marcadores para cada condicao.`,
};

// --- System prompt builder ---

function buildSystemPrompt(sectionTitle: string, sectionType: string, contentRules: any): string {
  const rules = contentRules || {};
  const tone = rules.tone || "formal";
  const toneInstruction = TONE_MAP[tone] || TONE_MAP.formal;
  const minWords = rules.minWords || 100;
  const maxWords = rules.maxWords || 500;
  const allowsBullets = rules.allowsBullets !== false;
  const allowsTable = rules.allowsTable === true;

  return `Voce e um especialista em redaccao de propostas comerciais para o mercado mocambicano.

${toneInstruction}

REGRAS CRITICAS (ANTI-ALUCINACAO):
1. NAO invente dados, numeros, nomes, datas ou valores que nao foram fornecidos.
2. Use APENAS as informacoes fornecidas nas respostas do utilizador.
3. Se faltar informacao importante, use o marcador [INFORMACAO EM FALTA] para indicar o que falta.
4. A moeda e Metical (MT / MZN) de Mocambique.
5. Escreva em portugues de Mocambique. NAO use emojis.
6. Respeite o limite de palavras: minimo ${minWords}, maximo ${maxWords}.
7. ${allowsBullets ? "Pode usar lista com marcadores quando apropriado." : "NAO use lista com marcadores."}
8. ${allowsTable ? "Pode usar tabelas em formato markdown quando apropriado." : "NAO use tabelas."}
9. NAO adicione seccoes ou topicos que nao foram solicitados.
10. Gere APENAS o conteudo desta seccao: "${sectionTitle}".

OUTPUT: Responda APENAS com JSON valido (sem markdown, sem code fences):
{
  "content": "...conteudo gerado em portugues...",
  "warnings": ["...alertas sobre informacao em falta..."],
  "missingInformation": ["...lista do que faltou para completar a seccao..."]
}`;
}

// --- User prompt builder ---

function buildUserPrompt(params: {
  sectionTitle: string;
  sectionType: string;
  contentRules: any;
  questions: Array<{ id: string; question_text: string }>;
  answers: Record<string, string>;
  companyInfo: { name: string; description: string; contact: string };
  clientInfo: { name: string; company: string };
  previousSections: Array<{ title: string; content: string }>;
}): string {
  const { sectionTitle, sectionType, contentRules, questions, answers, companyInfo, clientInfo, previousSections } = params;
  const typeInstr = TYPE_INSTRUCTIONS[sectionType] || TYPE_INSTRUCTIONS.text;

  const qaContext = questions
    .map((q, i) => {
      const ans = answers[q.id] || "(nao respondido)";
      return `P${i + 1}: ${q.question_text}\n   R: ${ans}`;
    })
    .join("\n");

  const prevContext = previousSections.length > 0
    ? `\nCONTEUDO DAS SECCOES ANTERIORES (para continuidade):
${previousSections.map(s => `--- ${s.title} ---\n${s.content.substring(0, 300)}...`).join("\n\n")}`
    : "";

  return `GERAR SECCAO: "${sectionTitle}"
Tipo: ${sectionType}
${typeInstr}

INFORMACAO DA EMPRESA:
- Nome: ${companyInfo?.name || "Nao informado"}
- Descricao: ${companyInfo?.description || "Nao informado"}
- Contacto: ${companyInfo?.contact || "Nao informado"}

INFORMACAO DO CLIENTE:
- Nome: ${clientInfo?.name || "Nao informado"}
- Empresa: ${clientInfo?.company || "Nao informado"}

RESPOSTAS DO UTILIZADOR:
${qaContext}${prevContext}

Gere o conteudo da seccao "${sectionTitle}".`;
}

// --- Main API call ---

export async function callGeminiDirect(messages: GeminiMessage[], model = DEFAULT_MODEL): Promise<GeminiResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const contents = messages.map(m => ({
    role: m.role === "model" ? "model" : "user",
    parts: m.parts,
  }));

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4000,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (HTTP ${response.status}): ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini devolveu resposta vazia");
  }

  const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

  return { text, model, tokensUsed };
}

// --- Generate proposal section content (direct Gemini call) ---

export interface GenerateSectionParams {
  sectionId: string;
  sectionTitle: string;
  sectionType: string;
  contentRules: any;
  questions: Array<{ id: string; question_text: string }>;
  answers: Record<string, string>;
  companyInfo: { name: string; description: string; contact: string };
  clientInfo: { name: string; company: string };
  previousSections: Array<{ title: string; content: string }>;
  model?: string;
}

export interface GenerateSectionResult {
  sectionId: string;
  content: string;
  warnings: string[];
  missingInformation: string[];
  model: string;
  tokensUsed: number;
}

export async function generateSectionDirect(params: GenerateSectionParams): Promise<GenerateSectionResult> {
  const systemPrompt = buildSystemPrompt(params.sectionTitle, params.sectionType, params.contentRules);
  const userPrompt = buildUserPrompt(params);

  const result = await callGeminiDirect(
    [{ role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
    params.model || DEFAULT_MODEL,
  );

  // Clean and parse JSON response
  const cleaned = result.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  let parsed: { content: string; warnings: string[]; missingInformation: string[] };

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {
      content: cleaned,
      warnings: ["Resposta nao estava em formato JSON valido, conteudo bruto usado"],
      missingInformation: [],
    };
  }

  return {
    sectionId: params.sectionId,
    content: parsed.content || "",
    warnings: parsed.warnings || [],
    missingInformation: parsed.missingInformation || [],
    model: result.model,
    tokensUsed: result.tokensUsed,
  };
}
