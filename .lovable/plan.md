

## Plano: Menu Dropdown do Perfil

Transformar o componente `UserProfile` num **menu dropdown clicável** no header, ao estilo dos SaaS modernos (Linear, Vercel, Notion).

### Comportamento
Clicar no avatar/nome abre um dropdown com:

```text
┌─────────────────────────────────┐
│  ╭──╮                            │
│  │GF│  Grácio de Freitas         │
│  ╰──╯  graciochiziane@gmail.com  │
│        [SUPERADMIN] [Business]   │
├─────────────────────────────────┤
│  👤  Meu Perfil                  │
│  ⚙️  Configurações               │
│  💳  Plano & Faturação           │
├─────────────────────────────────┤
│  🛡️  Painel SuperAdmin    (só admin) │
├─────────────────────────────────┤
│  🌙  Tema (claro/escuro)         │
│  ❓  Ajuda & Suporte             │
├─────────────────────────────────┤
│  🚪  Sair                        │
└─────────────────────────────────┘
```

### Secções do menu

1. **Cabeçalho (não clicável)** — avatar grande + nome + email + badges (SUPERADMIN se admin, plano actual: Free/Pro/Business)
2. **Conta** — Meu Perfil (`/configuracoes`), Configurações, Plano & Faturação (`/billing` — placeholder por agora)
3. **Admin** (condicional) — Painel SuperAdmin (`/admin`) — só visível se `isAdmin`
4. **Preferências** — Toggle de tema, Ajuda
5. **Sessão** — Sair (vermelho)

### Mudanças técnicas

**`src/components/UserProfile.tsx`** — refactor completo:
- Envolver o avatar+nome num `DropdownMenu` (`@/components/ui/dropdown-menu` já existe)
- `DropdownMenuTrigger` = bloco actual do avatar+nome (clicável, com hover state)
- `DropdownMenuContent` align="end" com as secções acima usando `DropdownMenuLabel`, `DropdownMenuItem`, `DropdownMenuSeparator`
- Items condicionais: secção admin só renderiza se `isAdmin === true`
- Item "Sair" chama `signOut()` directamente (move-se a lógica do AppLayout para aqui)
- Badge do plano: cor diferente por tier (free=cinza, pro=azul, business=verde)
- Mantém prop `compact` para o mobile (avatar sem texto, mas dropdown idêntico)

**`src/components/AppLayout.tsx`** — limpeza:
- Remove botão "Sair" separado do header (agora vive dentro do dropdown)
- Remove botão "Sair" do menu mobile (idem)
- `UserProfile` torna-se o único ponto de gestão de sessão no header

### Fora de escopo
- Implementação real das rotas `/billing` e `/admin` (ficam para fases seguintes)
- Toggle de tema funcional (item visual apenas; ligação ao tema fica para depois)
- Edição inline do nome/avatar (vive na página `/configuracoes`)

### Ficheiros afectados
- `src/components/UserProfile.tsx` — refactor para dropdown
- `src/components/AppLayout.tsx` — remover botões de sair duplicados

