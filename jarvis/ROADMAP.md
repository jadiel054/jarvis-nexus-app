# ROADMAP.md — Roadmap Estratégico do Ecossistema
*Documento vivo. Atualizado conforme o ecossistema evolui.*

---

## Visão

Construir uma plataforma de coordenação de agentes autônomos que opera como
uma empresa digital — com desenvolvimento, infraestrutura, vendas e finanças
funcionando de forma coordenada, com Jadiel como único ponto de decisão estratégica.

---

## Fase 1 — Fundação ✅ (Em andamento)

**Objetivo:** Jarvis e Workers principais operacionais com protocolo base.

### Concluído
- [x] Jarvis com autenticação (login com email/senha)
- [x] Banco de dados no Supabase (São Paulo)
- [x] Protocolo v1.0 definido e documentado
- [x] Zarith SaaS operacional com loop de agente real
- [x] Sistema de update PWA na Zarith
- [x] System prompt do Jarvis v3.0 (personalidade brasileira)
- [x] Groq como provider primário no Jarvis
- [x] Documentação base: PRINCIPLES, ARCHITECTURE_PRINCIPLES, DECISIONS, WORKFLOWS

### Em progresso
- [ ] Settings do Jarvis salvando no Supabase (rota /api/settings)
- [ ] GitHub Token configurado no Vercel para tools de leitura
- [ ] Lista completa de modelos Groq disponíveis
- [ ] Leitura de arquivos no frontend (zip, pdf, docx, xlsx)
- [ ] Sistema de update PWA no Jarvis

### Próximo
- [ ] Morpheus com endpoint /api/agent/task ativo
- [ ] Registry de agentes funcionando
- [ ] Heartbeat básico implementado

---

## Fase 2 — Workers e Orquestração (Próximos 3 meses)

**Objetivo:** Todos os Workers operacionais com Jarvis orquestrando via protocolo.

- [ ] Morpheus totalmente operacional (deploy, logs, CI/CD)
- [ ] Hermes operacional (prospecção, CRM, leads)
- [ ] Aegis operacional (auditoria, somente leitura)
- [ ] Financeiro operacional (custos, receita, MRR)
- [ ] Registry de agentes com capacidades declaradas
- [ ] Health Check e Heartbeat em produção
- [ ] Gate de Delegação implementado no código
- [ ] Workflows WF-001 a WF-005 executando via Jarvis
- [ ] Telegram como canal de notificações e comandos

---

## Fase 3 — Plataforma (3 a 6 meses)

**Objetivo:** Transformar o ecossistema em uma plataforma de coordenação real.

- [ ] Workflow Engine implementado (fluxos reutilizáveis e versionados)
- [ ] Policy Engine com tabela de permissões por agente
- [ ] Event Bus com Supabase Realtime para comunicação em tempo real
- [ ] Queue/Scheduler com prioridade P0-P5
- [ ] Decision Records persistidos automaticamente
- [ ] Telemetria e métricas do ecossistema
- [ ] Dashboard de saúde dos agentes
- [ ] Balanceamento de carga entre Workers

---

## Fase 4 — Autonomia Avançada (6 a 12 meses)

**Objetivo:** Ecossistema aprende, se adapta e executa fluxos complexos com mínima intervenção.

- [ ] Execução paralela de tasks independentes
- [ ] Autoescalonamento baseado em fila
- [ ] Aprendizado organizacional (memória vetorial de decisões)
- [ ] Self-healing: agente detecta e corrige problemas automaticamente
- [ ] Múltiplos workspaces (projeto pessoal + projetos de clientes)
- [ ] Self-hosting de LLMs open-source (Llama, Mistral)
- [ ] Voice interface com Kokoro TTS

---

## Princípio do Roadmap

> Estabilidade da arquitetura antes da sofisticação das funcionalidades.

Cada fase só começa quando a anterior está estável.
Adicionar um Worker novo é sempre mais seguro do que adicionar
uma nova capacidade a um Worker que já funciona.

---

## Métricas de Sucesso por Fase

| Fase | Métrica principal |
|---|---|
| Fase 1 | Jarvis responde, Zarith executa, protocolo funciona |
| Fase 2 | Todos os Workers operacionais, workflows manuais funcionando |
| Fase 3 | Workflows automáticos, zero intervenção em tarefas rotineiras |
| Fase 4 | Ecossistema opera 80% do tempo sem input humano |

---

*Última atualização: 2026-06-29*
*Próxima revisão: quando Fase 1 estiver 100% concluída*

