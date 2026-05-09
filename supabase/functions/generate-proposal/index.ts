// ============================================================
// Supabase Edge Function: generate-proposal
// Recebe dados da cotacao + campos do formulario
// Chama Google Gemini API para gerar narrativa estruturada
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Mapa de tom para instrucao de estilo
const TONE_INSTRUCTIONS: Record<string, string> = {
  formal: `
- Tom FORMAL CORPORATIVO: linguagem profissional e respeitosa, adequada para bancos, auditorias e processos de procurement.
- Use termos tecnicos com precisao. Evite colloquialismos.
- Estrutura clara e objectiva. Prefira frases curtas e directas.
- Terceira pessoa. Evite primeira pessoa do singular.
- Referirse ao cliente por nome da empresa (ex: "o MozaBank").`,
  persuasivo: `
- Tom PERSUASIVO COMERCIAL: linguagem orientada a venda e conversao.
- Destaque valor e ROI. Use numeros concretos sempre que possivel.
- Crie urgencia e necessidade de forma natural, sem ser agressivo.
- Use frases de impacto no inicio de cada seccao.
- Equilibre entusiasmo com profissionalismo.`,
  tecnico: `
- Tom TECNICO DIRETO: linguagem tecnica e objectiva, sem adjectivos desnecessarios.
- Foque em especificidades tecnicas, arquitectura, integracao e implementacao.
- Use jargao tecnico apropriado para o sector do cliente.
- Liste requisitos, especificacoes e capacidades de forma clara.
- Adequado para audiencias tecnicas (CTO, equipa de TI, engenheiros).`,
  consultivo: `
- Tom CONSULTIVO: linguagem de assessoria e consultoria.
- Apresente a solucao como recomendacao fundamentada, nao como venda.
- Mostre compreensao profunda do problema do cliente.
- Inclua consideracoes estrategicas e melhores praticas do sector.
- Adequado para posicoes de advisory e consultoria estrategica.`,
};

// Seccoes obrigatorias do prompt
const BASE_SECTIONS = ["contexto", "problema", "solucao", "beneficios"];

const ADVANCED_SECTIONS = ["impacto", "escopo", "cronograma", "condicoes"];

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  let logContext = "INIT";

  try {
    // ---- STEP 1: Auth ----
    logContext = "AUTH";
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[STEP-FAIL] AUTH: sem Authorization header");
      return new Response(
        JSON.stringify({ error: "Token de autenticacao nao fornecido", step: "auth" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      console.error("[STEP-FAIL] AUTH:", authErr?.message || "user null");
      return new Response(
        JSON.stringify({ error: "Utilizador nao autenticado", step: "auth" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    console.log(`[STEP-OK] AUTH: user=${user.id}, elapsed=${Date.now() - startTime}ms`);

    // ---- STEP 2: Parse body ----
    logContext = "PARSE";
    let body: any;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error("[STEP-FAIL] PARSE: body invalido", parseErr);
      return new Response(
        JSON.stringify({ error: "Corpo da requisicao invalido", step: "parse" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { cotacaoId, fields, tone = "formal", mode = "rapido", sector, model: bodyModel } = body;
    const model = bodyModel || "gemini-2.5-flash-preview-05-20";

    if (!cotacaoId || !fields) {
      console.error("[STEP-FAIL] PARSE: cotacaoId ou fields em falta", { cotacaoId, hasFields: !!fields });
      return new Response(
        JSON.stringify({ error: "cotacaoId e fields sao obrigatorios", step: "parse" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    console.log(`[STEP-OK] PARSE: cotacaoId=${cotacaoId}, model=${model}, mode=${mode}, tone=${tone}`);

    // ---- STEP 3: Load cotation data ----
    logContext = "DB_LOAD";
    const { data: proposta, error: propError } = await supabase
      .from("proposals")
      .select(
        `
        *,
        proposal_items(nome, quantidade, preco_unitario, subtotal, ordem)
      `
      )
      .eq("id", cotacaoId)
      .eq("owner_id", user.id)
      .single();

    if (propError || !proposta) {
      console.error("[STEP-FAIL] DB_LOAD:", propError?.message || "proposta null");
      return new Response(
        JSON.stringify({ error: "Cotacao nao encontrada", step: "db_load" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    console.log(`[STEP-OK] DB_LOAD: proposta=${proposta.numero}, items=${proposta.proposal_items?.length || 0}, elapsed=${Date.now() - startTime}ms`);

    const cliente = proposta.cliente_snapshot as Record<string, string> | null;
    const items = (proposta.proposal_items || []) as Array<{
      nome: string;
      quantidade: number;
      preco_unitario: number;
      subtotal: number;
    }>;

    // ---- STEP 4: Build prompt ----
    logContext = "PROMPT_BUILD";
    const itemsList = items
      .sort((a, b) => a.quantidade - b.quantidade)
      .map(
        (item, i) =>
          `${i + 1}. ${item.nome} (Qtd: ${item.quantidade}, Preco unitario: ${Number(item.preco_unitario).toLocaleString("pt-MZ", { style: "currency", currency: "MZN" })})`
      )
      .join("\n");

    const totalFormatado = Number(proposta.total).toLocaleString("pt-MZ", {
      style: "currency",
      currency: "MZN",
      minimumFractionDigits: 2,
    });

    // Determinar seccoes a gerar
    const sections = mode === "assertivo" ? [...BASE_SECTIONS, ...ADVANCED_SECTIONS] : BASE_SECTIONS;

    // Filtrar seccoes com conteudo fornecido pelo utilizador
    const sectionDescriptions = sections
      .filter((s) => fields[s] && fields[s].trim())
      .map((s) => {
        const labels: Record<string, string> = {
          contexto: "Contexto do Cliente",
          problema: "Problema Identificado",
          solucao: "Solucao Proposta",
          beneficios: "Beneficios Esperados",
          impacto: "Impacto Quantificavel do Problema",
          escopo: "Escopo Detalhado",
          cronograma: "Cronograma",
          condicoes: "Condicoes Especiais",
        };
        return `- ${labels[s] || s}: "${fields[s]}"`;
      })
      .join("\n");

    // Seccoes que faltam (a IA deve gerar baseado nos dados disponiveis)
    const missingSections = sections.filter((s) => !fields[s] || !fields[s].trim());

    // A seccao investimento e sempre gerada automaticamente
    const investimentoSection = `O investimento total para este projecto e de ${totalFormatado} (IVA incluido). O detalhamento por modulos pode ser consultado na Cotacao N. ${proposta.numero}-FIN em anexo.`;

    const systemPrompt = `Voce e um assistente especializado em criar propostas comerciais persuasivas e profissionais para o mercado mocambicano. A sua tarefa e transformar dados estruturados numa narrativa comercial convincente.

${TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.formal}

REGRAS CRITICAS (ANTI-ALUCINACAO):
1. NAO invente dados, numeros, nomes, datas ou valores que nao foram fornecidos.
2. NAO mencione modulos, funcionalidades ou precos que nao estejam na cotacao.
3. Use APENAS os dados fornecidos. Se faltar informacao, seja generico mas honesto.
4. O valor total da cotacao e ${totalFormatado}. NAO invente descontos ou valores diferentes.
5. A moeda e Metical (MT / MZN) de Mocambique.
6. Escreva em portugues de Mocambique. NAO use emojis.
7. Cada seccao deve ter 2-4 paragrafos substanciais (minimo 100 palavras por seccao).
8. Use paragrafos bem estruturados, com topicos claros e progressao logica.
${missingSections.length > 0 ? `9. As seguintes seccoes NAO foram preenchidas pelo utilizador - gere conteudo contextual com base nos dados da cotacao e info do cliente, mas seja generico: ${missingSections.join(", ")}` : ""}

OUTPUT FORMATO:
Responda APENAS com JSON valido (sem markdown, sem code fences) no seguinte formato:
{
  "seccoes": {
    "contexto": "...",
    "problema": "...",
    "solucao": "...",
    "beneficios": "...",
    ${mode === "assertivo" ? '"impacto": "...", "escopo": "...", "cronograma": "...", "condicoes": "...",' : ""}
    "investimento": "${investimentoSection}"
  }
}`;

    const userPrompt = `CRIACAO DE PROPOSTA COMERCIAL

INFORMACAO DO CLIENTE:
- Nome: ${cliente?.nome || "Nao informado"}
- Empresa: ${cliente?.empresa || "Nao informado"}
- NUIT: ${cliente?.nuit || "Nao informado"}
- Sector detectado: ${sector || "Nao especificado"}

DADOS DA COTACAO:
- Numero: ${proposta.numero}
- Data: ${proposta.data}
- Items (${items.length}):
${itemsList}
- Total: ${totalFormatado}
- Status: ${proposta.status}
${proposta.observacoes ? `- Observacoes: ${proposta.observacoes}` : ""}

CONTEUDO FORNECIDO PELO UTILIZADOR:
${sectionDescriptions || "(Nenhum campo adicional preenchido - gere tudo com base nos dados acima)"}

Gere a proposta seguindo as seccoes especificadas.`;

    console.log(`[STEP-OK] PROMPT_BUILD: systemPrompt=${systemPrompt.length} chars, userPrompt=${userPrompt.length} chars`);

    // ---- STEP 5: Call Gemini API ----
    logContext = "GEMINI_CALL";
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      console.error("[STEP-FAIL] GEMINI_CALL: GEMINI_API_KEY nao configurada");
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY nao configurada no Supabase", step: "gemini_call" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
    console.log(`[STEP] GEMINI_CALL: model=${model}, url=${geminiUrl.replace(geminiKey, "***")}`);

    // Preparar payload — sem responseMimeType, sem system_instruction
    // O system prompt e incorporado no user prompt para max compatibilidade
    const geminiPayload: Record<string, unknown> = {
      contents: [
        {
          role: "user",
          parts: [{ text: systemPrompt + "\n\n" + userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8000,
      },
    };

    let geminiResponse: Response;
    try {
      geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
      });
    } catch (fetchErr) {
      const fetchMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error("[STEP-FAIL] GEMINI_CALL: fetch exception:", fetchMsg);
      return new Response(
        JSON.stringify({ error: `Falha ao conectar com a API Gemini: ${fetchMsg}`, step: "gemini_call" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[STEP] GEMINI_CALL: HTTP status=${geminiResponse.status}, elapsed=${Date.now() - startTime}ms`);

    if (!geminiResponse.ok) {
      let errBody = "";
      try {
        errBody = await geminiResponse.text();
      } catch {
        errBody = "(impossible to read error body)";
      }
      console.error("[STEP-FAIL] GEMINI_CALL: API returned error", {
        status: geminiResponse.status,
        body: errBody.substring(0, 500),
      });
      return new Response(
        JSON.stringify({
          error: `Erro na API Gemini: ${geminiResponse.status}`,
          detail: errBody.substring(0, 300),
          step: "gemini_call",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ---- STEP 6: Parse Gemini response ----
    logContext = "GEMINI_PARSE";
    let geminiData: any;
    try {
      const responseText = await geminiResponse.text();
      console.log(`[STEP] GEMINI_PARSE: raw response length=${responseText.length}`);
      geminiData = JSON.parse(responseText);
    } catch (jsonErr) {
      const jsonMsg = jsonErr instanceof Error ? jsonErr.message : String(jsonErr);
      console.error("[STEP-FAIL] GEMINI_PARSE: JSON parse failed:", jsonMsg);
      return new Response(
        JSON.stringify({ error: `Resposta invalida da API Gemini (JSON parse): ${jsonMsg}`, step: "gemini_parse" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check for safety blocks or missing content
    const candidates = geminiData.candidates;
    if (!candidates || candidates.length === 0) {
      console.error("[STEP-FAIL] GEMINI_PARSE: no candidates in response", {
        promptFeedback: geminiData.promptFeedback,
        usageMetadata: geminiData.usageMetadata,
      });
      return new Response(
        JSON.stringify({
          error: "A Gemini nao gerou conteudo (possivel filtro de seguranca)",
          detail: JSON.stringify(geminiData.promptFeedback || geminiData.usageMetadata || {}),
          step: "gemini_parse",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const finishReason = candidates[0]?.finishReason;
    if (finishReason && finishReason !== "STOP") {
      console.warn(`[STEP-WARN] GEMINI_PARSE: finishReason=${finishReason} (not STOP)`);
    }

    const content = candidates[0]?.content?.parts?.[0]?.text;
    if (!content || content.trim().length === 0) {
      console.error("[STEP-FAIL] GEMINI_PARSE: content text is empty", {
        finishReason,
        parts: candidates[0]?.content?.parts?.length,
      });
      return new Response(
        JSON.stringify({
          error: "A Gemini devolveu resposta vazia",
          finishReason,
          step: "gemini_parse",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[STEP-OK] GEMINI_PARSE: content length=${content.length}, finishReason=${finishReason}, elapsed=${Date.now() - startTime}ms`);

    // ---- STEP 7: Extract JSON sections ----
    logContext = "EXTRACT_SECTIONS";
    let parsedSections: Record<string, string> = {};
    try {
      // Limpar markdown fences e whitespace
      const cleaned = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      console.log(`[STEP] EXTRACT_SECTIONS: cleaned length=${cleaned.length}, first 100 chars="${cleaned.substring(0, 100)}"`);

      const parsed = JSON.parse(cleaned);

      // Tentar extrair "seccoes" ou usar o objecto directamente
      if (parsed.seccoes && typeof parsed.seccoes === "object") {
        parsedSections = parsed.seccoes;
      } else if (typeof parsed === "object" && parsed !== null) {
        // Talvez o JSON seja directamente as seccoes
        parsedSections = parsed;
      } else {
        throw new Error("Formato inesperado: esperava objecto com seccoes");
      }

      console.log(`[STEP-OK] EXTRACT_SECTIONS: ${Object.keys(parsedSections).length} seccoes encontradas: [${Object.keys(parsedSections).join(", ")}]`);
    } catch (parseErr) {
      const parseMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.error("[STEP-FAIL] EXTRACT_SECTIONS:", parseMsg);
      console.error("[STEP-FAIL] EXTRACT_SECTIONS: raw content (first 500 chars):", content.substring(0, 500));
      return new Response(
        JSON.stringify({
          error: `Erro ao processar resposta da IA: ${parseMsg}`,
          rawPreview: content.substring(0, 200),
          step: "extract_sections",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ---- STEP 8: Ensure investimento section ----
    logContext = "POST_PROCESS";
    if (!parsedSections.investimento) {
      parsedSections.investimento = investimentoSection;
    }

    // ---- STEP 9: Save to DB ----
    logContext = "DB_SAVE";
    const usageMeta = geminiData.usageMetadata || {};
    const totalTokens = usageMeta.totalTokenCount || 0;

    const { data: saved, error: saveError } = await supabase
      .from("proposta_ai")
      .insert({
        cotacao_id: cotacaoId,
        user_id: user.id,
        referencia: proposta.numero,
        mode,
        tone,
        sector,
        input_json: fields,
        output_json: parsedSections,
        modelo: model,
        tokens_usados: totalTokens,
        custo_usd: 0, // Gemini 2.0 Flash is free within usage limits
        gerado_em: new Date().toISOString(),
      })
      .select("id, referencia, created_at")
      .single();

    if (saveError) {
      console.error("[STEP-WARN] DB_SAVE:", saveError.message, "(nao fatal - continua)");
    } else {
      console.log(`[STEP-OK] DB_SAVE: id=${saved?.id}`);
    }

    // ---- STEP 10: Success response ----
    logContext = "RESPONSE";
    console.log(`[STEP-OK] RESPONSE: total elapsed=${Date.now() - startTime}ms, tokens=${totalTokens}`);

    return new Response(
      JSON.stringify({
        id: saved?.id,
        referencia: proposta.numero,
        seccoes: parsedSections,
        modelo: model,
        tokens_usados: totalTokens,
        gerado_em: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack || "" : "";
    console.error(`[FATAL] logContext=${logContext}`, errMsg);
    console.error(`[FATAL] stack:`, errStack);
    return new Response(
      JSON.stringify({
        error: "Erro interno do servidor",
        detail: errMsg,
        step: logContext,
        stack: errStack.split("\n").slice(0, 5).join(" | "),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
