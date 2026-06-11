# J.A.R.V.I.S. Nexus v7.0

> Just A Rather Very Intelligent System — Orquestrador de IA pessoal de Jadiel

## Stack

- **Frontend:** Next.js 14 App Router + TypeScript + Tailwind CSS
- **Estado:** Zustand com persist
- **AI:** Anthropic Claude Sonnet 4.6 (agente com tools)
- **Database:** Supabase (PostgreSQL + pgvector + Realtime)
- **Deploy:** Vercel (Serverless Functions)

## Setup Completo

### 1. Clonar e instalar

```bash
git clone https://github.com/jadiel054/jarvis-nexus-app
cd jarvis-nexus-app
npm install
```

### 2. Variáveis de ambiente

```bash
cp .env.example .env.local
# Preencher todas as variáveis
```

### 3. Supabase — executar schema

1. Acesse o SQL Editor do Supabase (projeto `vftnxjoijdniohnglldu`)
2. Execute o conteúdo de `supabase-schema.sql`
3. Verifique que a extensão `vector` foi habilitada

### 4. Rodar em desenvolvimento

```bash
npm run dev
# Acesse http://localhost:3000
```

### 5. Deploy na Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Configurar todas as env vars no dashboard da Vercel
# (Settings → Environment Variables)
```

### 6. Registrar webhooks do Telegram

Após o deploy, registre os 3 webhooks:

```bash
# JarvisComando
curl -X POST "https://api.telegram.org/bot{COMANDO_TOKEN}/setWebhook" \
  -d "url=https://jarvis-nexus-app.vercel.app/api/telegram/webhook/comando"

# JarvisAlerts
curl -X POST "https://api.telegram.org/bot{ALERTS_TOKEN}/setWebhook" \
  -d "url=https://jarvis-nexus-app.vercel.app/api/telegram/webhook/alerts"

# JarvisDev  
curl -X POST "https://api.telegram.org/bot{DEV_TOKEN}/setWebhook" \
  -d "url=https://jarvis-nexus-app.vercel.app/api/telegram/webhook/dev"
```

## Variáveis de Ambiente (todas obrigatórias no Vercel)

| Variável | Descrição |
|---|---|
| `ANTHROPIC_API_KEY` | API key da Anthropic |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role (server only) |
| `GITHUB_TOKEN` | Personal Access Token do GitHub |
| `VERCEL_TOKEN` | Token da Vercel |
| `VERCEL_TEAM_ID` | `team_cxs9DuXfZ1wseY1y7bFj8P1V` |
| `TELEGRAM_BOT_COMANDO_TOKEN` | Token do bot JarvisComando |
| `TELEGRAM_BOT_ALERTS_TOKEN` | Token do bot JarvisAlerts |
| `TELEGRAM_BOT_DEV_TOKEN` | Token do bot JarvisDev |
| `TELEGRAM_ADMIN_CHAT_ID` | Seu chat ID do Telegram |
| `TAVILY_API_KEY` | API key do Tavily Search |
| `OPENAI_API_KEY` | API key da OpenAI (embeddings) |
| `NEXT_PUBLIC_APP_URL` | URL do deploy (ex: https://jarvis-nexus-app.vercel.app) |
| `CRON_SECRET` | Secret para autenticar o cron job |

## Arquitetura de Segurança

```
Browser → /api/ai/chat → Anthropic API (server-side)
Browser → /api/github/* → GitHub API (server-side)
Browser → /api/vercel/* → Vercel API (server-side)
Browser → /api/telegram/* → Telegram API (server-side)
```

**Nenhuma API key é exposta no browser.** Todas as chamadas passam por Serverless Functions.

## Critério de Sucesso

O sistema está pronto quando:
1. Mandar uma mensagem no @JarvisComandoBot e receber resposta que usou uma tool
2. Digitar "liste meus repos" no chat e ver os repos do GitHub aparecerem
3. O cron job do Vercel chamar `/api/nexus/tick` a cada minuto

## Supabase Migration (produção)

O `store/index.ts` usa `localStorage` + Zustand persist por padrão.
Para migrar para Supabase completo, substituir as chamadas do store pelos endpoints:
- `POST /api/supabase/memory` para memórias
- As conversas podem ser salvas na tabela `conversations` + `messages`
