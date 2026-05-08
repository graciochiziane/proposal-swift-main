// ============================================================
// Supabase Edge Function: generate-proposal
// Recebe dados da cotacao + campos do formulario
// Chama Google Gemini API para gerar narrativa estruturada
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  try {
    // 1. Autenticacao
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Token de autenticacao nao fornecido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Utilizador nao autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse body
    const body = await req.json();
    const { cotacaoId, fields, tone = "formal", mode = "rapido", sector } = body;

    if (!cotacaoId || !fields) {
      return new Response(JSON.stringify({ error: "cotacaoId e fields sao obrigatorios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Carregar dados da cotacao
    const { data: proposta, error: propError } = await supabase
      .from("proposals")
      .select(`
        *,
        proposal_items(nome, quantidade, preco_unitario, subtotal, ordem)
      `)
      .eq("id", cotacaoId)
      .eq("owner_id", user.id)
      .single();

    if (propError || !proposta) {
      return new Response(JSON.stringify({ error: "Cotacao nao encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cliente = proposta.cliente_snapshot as Record<string, string> | null;
    const items = (proposta.proposal_items || []) as Array<{
      nome: string;
      quantidade: number;
      preco_unitario: number;
      subtotal: number;
    }>;

    // 4. Construir prompt
    const itemsList = items
      .sort((a, b) => a.quantidade - b.quantidade)
      .map(
        (item, i) =>
          `${i + 1}. ${item.nome} (Qtd: ${item.quantidade}, Preco unitario: ${Number(item.preco_unitario).toLocaleString("pt-MZ", { style: "currency", currency: "MZN" })})`,
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

    // A secção investimento e sempre gerada automaticamente
    const investimentoSection = `O investimento total para este projecto e de ${totalFormatado} (IVA incluido). O detalhamento por modulos pode ser consultado na Cotacao N. ${proposta.numero}-FIN em anexo.`;

    const systemPrompt = `Voce e um assistente especializado em criar propostas comerciais persuasivas e profissionais para o mercado moçambicano. A sua tarefa e transformar dados estruturados numa narrativa comercial convincente.

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
${missingSections.length > 0 ? `9. As seguintes seccoes NAO foram preenchidas pelo utilizador — gere conteudo contextual com base nos dados da cotacao e info do cliente, mas seja generico: ${missingSections.join(", ")}` : ""}

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
${sectionDescriptions || "(Nenhum campo adicional preenchido — gere tudo com base nos dados acima)"}

Gere a proposta seguindo as seccoes especificadas.`;

    // 5. Chamar Google Gemini API
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY nao configurada no Supabase" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const model = body.model || "gemini-2.0-flash";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8000,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errBody = await geminiResponse.text();
      console.error("Gemini API error:", errBody);
      return new Response(JSON.stringify({ error: `Erro na API Gemini: ${geminiResponse.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResponse.json();
    const usageMeta = geminiData.usageMetadata || {};
    const totalTokens = usageMeta.totalTokenCount || 0;

    // Parsear resposta
    let parsedSections: Record<string, string> = {};
    try {
      const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsedSections = JSON.parse(cleaned).seccoes || JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse Gemini response:", parseErr);
      return new Response(JSON.stringify({ error: "Erro ao processar resposta da IA" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Garantir que a seccao investimento esta sempre presente
    if (!parsedSections.investimento) {
      parsedSections.investimento = investimentoSection;
    }

    // 7. Guardar na tabela proposta_ai
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
      console.error("Erro ao guardar proposta_ai:", saveError);
      // Nao e fatal — ainda devolvemos as seccoes
    }

    // 8. Resposta
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
      },
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
