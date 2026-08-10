// ============================================================
// Supabase Edge Function: generate-section
// Gera conteudo AI para UMA seccao de proposta avancada
// Anti-hallucination: so preenche dentro da estrutura aprovada
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  let logCtx = "INIT";

  try {
    // ---- AUTH ----
    logCtx = "AUTH";
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token nao fornecido", step: "auth" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);

    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Nao autenticado", step: "auth" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- PARSE ----
    logCtx = "PARSE";
    const body = await req.json();
    const {
      sectionId,
      sectionTitle,
      sectionType,
      contentRules,
      questions,
      answers,
      companyInfo,
      clientInfo,
      previousSections = [],
      model = "gemini-2.5-flash",
    } = body;

    if (!sectionId || !sectionTitle || !questions || !answers) {
      return new Response(
        JSON.stringify({ error: "sectionId, sectionTitle, questions e answers sao obrigatorios", step: "parse" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-section] section=${sectionTitle}, type=${sectionType}, questions=${questions.length}, elapsed=${Date.now() - startTime}ms`);

    // ---- BUILD PROMPT ----
    logCtx = "PROMPT";
    const rules = contentRules || {};
    const tone = rules.tone || "formal";
    const toneInstruction = TONE_MAP[tone] || TONE_MAP.formal;

    // Questions and answers context
    const qaContext = questions
      .map((q: any, i: number) => {
        const ans = answers[q.id] || "(nao respondido)";
        return `P${i + 1}: ${q.question_text}\n   R: ${ans}`;
      })
      .join("\n");

    // Previous sections for context continuity
    const prevContext = previousSections.length > 0
      ? `\nCONTEUDO DAS SECCOES ANTERIORES (para continuidade):
${previousSections.map((s: any) => `--- ${s.title} ---\n${s.content.substring(0, 300)}...`).join("\n\n")}`
      : "";

    // Section type specific instructions
    const typeInstructions: Record<string, string> = {
      cover: `Esta e uma seccao de CAPA. Gere apenas 2-3 linhas com titulo formal, nome da empresa (${companyInfo?.name || "[Empresa]"}) e data actual. NAO gere paragrafos longos.`,
      text: `Gere 2-4 paragrafos substanciais para esta seccao narrativa.`,
      methodology: `Descreva a metodologia de forma estruturada. Use lista com marcadores quando apropriado. Inclua fases ou etapas claras.`,
      timeline: `IMPORTANTE: Apresente o cronograma numa tabela markdown com colunas: Fase, Periodo, Actividades, Entregaveis. Inclua 3-6 fases realistas. Antes da tabela, escreva 1 paragrafo introdutorio.`,
      pricing: `Apresente informacao de precos de forma organizada. Se houver valores nas respostas, use-os EXACTAMENTE como fornecidos. NAO invente precos. Use tabela markdown quando apropriado.`,
      terms: `Apresente termos e condicoes de forma clara e juridicamente adequada. Use lista com marcadores para cada condicao.`,
    };

    const typeInstr = typeInstructions[sectionType] || typeInstructions.text;

    const minWords = rules.minWords || 100;
    const maxWords = rules.maxWords || 500;
    const allowsBullets = rules.allowsBullets !== false;
    const allowsTable = rules.allowsTable === true;

    const systemPrompt = `Voce e um especialista em redaccao de propostas comerciais para o mercado mocambicano.

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

    const userPrompt = `GERAR SECCAO: "${sectionTitle}"
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
${qaContext}
${prevContext}

Gere o conteudo da seccao "${sectionTitle}".`;

    // ---- CALL GEMINI ----
    logCtx = "GEMINI";
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY nao configurada", step: "gemini" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

    const geminiPayload = {
      contents: [{
        role: "user",
        parts: [{ text: systemPrompt + "\n\n" + userPrompt }],
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4000,
      },
    };

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiResponse.ok) {
      const errBody = await geminiResponse.text();
      console.error(`[generate-section] Gemini error: ${geminiResponse.status}`, errBody.substring(0, 300));
      return new Response(
        JSON.stringify({ error: `Erro Gemini (HTTP ${geminiResponse.status}): ${errBody.substring(0, 200)}`, step: "gemini" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- PARSE RESPONSE ----
    logCtx = "PARSE_RESPONSE";
    const geminiData = await geminiResponse.json();
    const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Gemini devolveu resposta vazia", step: "parse" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean and parse JSON
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let parsed: { content: string; warnings: string[]; missingInformation: string[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // If JSON parse fails, use raw content as the content field
      parsed = {
        content: cleaned,
        warnings: ["Resposta nao estava em formato JSON valido, conteudo bruto usado"],
        missingInformation: [],
      };
    }

    const usageMeta = geminiData.usageMetadata || {};
    const totalTokens = usageMeta.totalTokenCount || 0;

    console.log(`[generate-section] OK: section=${sectionTitle}, tokens=${totalTokens}, elapsed=${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({
        sectionId,
        content: parsed.content || "",
        warnings: parsed.warnings || [],
        missingInformation: parsed.missingInformation || [],
        model,
        tokensUsed: totalTokens,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[generate-section] FATAL: ctx=${logCtx}`, errMsg);
    return new Response(
      JSON.stringify({ error: "Erro interno: " + errMsg, step: logCtx }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
