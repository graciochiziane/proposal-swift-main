# Proposal Swift — Regras de Comportamento para Agentes de Código

## PRINCIPIO FUNDAMENTAL
> "Quando em dúvida, pergunta. Nunca inventes. Nunca presumas."

---

## REGRAS OBRIGATÓRIAS

### 1. NUNCA alucinar dados
- NÃO inventes nomes de colunas, tabelas, funções ou imports
- Se não souberes o nome exacto, LÊ o ficheiro primeiro
- Se não tiveres acesso ao ficheiro, PERGUNTA ao utilizador

### 2. SEMPRE verificar contra o schema
- Antes de criar/editar um service, consulta as tabelas no PROJETO_STATUS.md
- Se o schema mudar, NÃO presumas — pede confirmação
- Colunas que NÃO existem: proposals.validade, proposal_items.descricao, proposal_items.owner_id

### 3. LER antes de ESCREVER
- Nunca edites um ficheiro sem o ler primeiro
- Nunca digas "está correcto" sem ter lido o código
- Nunca digas "implementado" sem ter testado (ou ter confirmado com o utilizador)

### 4. Um ficheiro de cada vez
- Quando precisares de editar múltiplos ficheiros, faz um de cada vez
- Nunca uses multi_replace para ficheiros diferentes numa única chamada
- Confirma cada edição antes de avançar para a próxima

### 5. Ser recursivo em complexidade
- Tarefas complexas: divide em passos pequenos
- Após cada passo, verifica se o resultado está correcto
- Se algo falhar, resolve ANTES de avançar
- NÃO empilhes erros — resolve cada um antes do próximo

### 6. Testar antes de afirmar
- "Implementado" significa que o código foi escrito E verificado
- Se não puderes testar no browser, diz "NÃO TESTADO NA UI"
- Se um comando falhar, mostra o erro COMPLETO ao utilizador
- NUNCA digas "tudo funciona" baseado apenas na leitura do código

### 7. Padrões do projecto (OBRIGATÓRIO seguir)

#### Imports do Supabase
```typescript
// CORRECTO
import { supabase } from '@/integrations/supabase/client';

// ERRADO - Nunca usar
import { supabase } from '@/lib/supabase';
```

#### Bucket de logos
```typescript
// CORRECTO - bucket privado
const { data } = await supabase.storage.from('logos').createSignedUrl(path, 3600);

// ERRADO - bucket privado não suporta URLs públicas
const { data } = await supabase.storage.from('logos').getPublicUrl(path);
```

#### Strings vazias para o banco
```typescript
// CORRECTO
nome: value || null,

// ERRADO - string vazia no banco causa problemas
nome: value,
```

#### Enums do banco
```typescript
// CORRECTO
desconto_tipo: 'percentual' | 'valor'
proposal_status: 'rascunho' | 'enviada' | 'aceite' | 'rejeitada'
invoice_status: 'pendente' | 'paga' | 'vencida' | 'anulada'

// ERRADO
desconto_tipo: 'fixo'  // NÃO EXISTE
proposal_status: 'faturada'  // NÃO EXISTE
```

### 8. Evitar `as any`
- NÃO usar `as any` para contornar erros de tipagem
- Se o Supabase types não reconhece uma tabela, regenera os tipos:
  `npx supabase gen types typescript --project-id ytbgfrbhyclnfdftmnoy > src/integrations/supabase/types.ts`
- Só usar `as any` como ULTIMO recurso e com comentário explicando porquê

### 9. Rollback manual
- Quando uma operação tem múltiplos passos (ex: criar proposta + items), implementa rollback
- Se o passo 2 falhar, desfaz o passo 1
- Exemplo: se insert items falha, apagar a proposta criada

### 10. Ficheiros ELIMINADOS — NÃO recriar
- `src/lib/storage.ts` — ELIMINADO, não recriar
- `src/lib/supabase.ts` — ELIMINADO, não recriar
- Qualquer referência a estes ficheiros deve ser removida

---

## FLUXO DE TRABALHO

### Para novas funcionalidades:
1. Perguntar ao utilizador o que exatamente precisa
2. Verificar o schema actual (PROJETO_STATUS.md)
3. Listar os ficheiros que precisam de ser criados/modificados
4. Esperar confirmação antes de escrever código
5. Implementar um ficheiro de cada vez
6. Verificar com tsc após cada alteração significativa
7. Reportar o que foi feito e o que NÃO foi testado

### Para correcção de bugs:
1. Pedir o erro EXACTO (mensagem, URL, linha)
2. Ler os ficheiros envolvidos
3. Cruzar com o schema do banco
4. Propor a solução e esperar confirmação
5. Aplicar a correcção
6. Verificar com tsc

### Quando não souber algo:
1. Dizer claramente: "Não tenho informação suficiente para..."
2. Listar exactamente o que falta
3. Perguntar ao utilizador
4. NÃO presumir NADA

---

## O QUE NUNCA FAZER

- ❌ Dizer "está correcto" sem ler o código
- ❌ Dizer "funciona" sem testar na UI
- ❌ Inventar nomes de colunas ou tabelas
- ❌ Usar `as any` sem justificação
- ❌ Editar múltiplos ficheiros numa única chamada
- ❌ Presumir que um import está correcto sem verificar
- ❌ Recriar ficheiros eliminados (storage.ts, supabase.ts)
- ❌ Usar getPublicUrl no bucket privado de logos
- ❌ Enviar campos que não existem no schema (validade, descricao, owner_id nos items)
- ❌ Ignorar erros do tsc — cada erro deve ser resolvido
- ❌ Avançar para o próximo passo se o actual falhou
- ❌ Fazer rollback de alterações sem avisar o utilizador