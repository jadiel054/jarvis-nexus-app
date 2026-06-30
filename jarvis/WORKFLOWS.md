# WORKFLOWS.md — Fluxos de Trabalho do Ecossistema
*Documento conceitual. Define como o sistema reage a cada tipo de evento.*
*Não é implementação — é o blueprint que guia a implementação.*

---

## Como ler este documento

Cada workflow define:
- **Gatilho** — o que inicia o fluxo
- **Sequência** — quem faz o quê e em qual ordem
- **Gate** — pontos de validação antes de continuar
- **Saída** — o que o usuário recebe ao final

Os workflows são executados pelo Jarvis como Kernel.
Quando o Workflow Engine for implementado (Fase 3), estes fluxos
serão registrados no banco e executados automaticamente.

---

## WF-001 — Bug Crítico em Produção

**Gatilho:** Erro em produção reportado pelo usuário ou detectado pelo Morpheus

```
Usuário/Morpheus reporta bug
         │
         ▼
      JARVIS
   Entende o contexto
   Coleta logs e evidências
   Reproduz o problema
         │
         ▼
    Gate de Delegação
   ✓ Contexto suficiente?
   ✓ Arquivos identificados?
   ✓ Causa raiz mapeada?
         │
         ▼
      ZARITH
   Implementa a correção
   Valida localmente
         │
         ▼
       AEGIS
   Audita a correção
   Verifica regressões
   Aprova ou reprova
         │
         ▼
    [Aprovado?] ──Não──→ Jarvis re-analisa e delega nova tentativa
         │
        Sim
         │
         ▼
     MORPHEUS
   Faz deploy em produção
   Monitora por 10 minutos
         │
         ▼
      JARVIS
   Confirma resolução
   Registra em DECISIONS.md (se decisão arquitetural)
   Notifica usuário via Telegram
         │
         ▼
     USUÁRIO
   Recebe relatório:
   - O que era o bug
   - Causa raiz
   - O que foi corrigido
   - Como prevenir no futuro
```

---

## WF-002 — Nova Funcionalidade

**Gatilho:** Usuário solicita criação de feature nova

```
Usuário solicita feature
         │
         ▼
      JARVIS
   Entende a intenção completa
   Busca contexto na memória
   Lê estrutura do projeto
   Identifica impacto e dependências
         │
         ▼
    Gate de Delegação
   ✓ Requisitos claros?
   ✓ Escopo definido?
   ✓ Impacto mapeado?
   ✓ Aprovação necessária?
         │
         ▼
   [Precisa aprovação?]
   Sim → Apresenta plano ao usuário → Aguarda confirmação
   Não → Continua
         │
         ▼
      ZARITH
   Implementa a feature
   Frontend + Backend + Banco
   Tudo em um único commit
         │
         ▼
       AEGIS
   Audita o código
   Verifica segurança
   Valida qualidade
         │
         ▼
     MORPHEUS
   Deploy em produção
   Valida que está funcionando
         │
         ▼
      JARVIS
   Consolida resultado
   Notifica usuário
         │
         ▼
     USUÁRIO
   Recebe relatório:
   - O que foi implementado
   - Como usar
   - O que pode ser feito a seguir
```

---

## WF-003 — Sistema Caiu

**Gatilho:** Serviço fora do ar detectado por Morpheus ou reportado pelo usuário

```
Alerta de sistema caído
         │
         ▼
      JARVIS
   Avalia criticidade (P0?)
   Notifica usuário imediatamente via Telegram
         │
         ▼
     MORPHEUS
   Investiga logs e métricas
   Identifica origem do problema
   Tenta restart automático se aplicável
         │
         ▼
      JARVIS
   Recebe diagnóstico
   Avalia impacto no ecossistema
         │
         ▼
       AEGIS
   Verifica se há comprometimento de segurança
         │
         ▼
   [Segurança comprometida?]
   Sim → Isolar serviço → Escalar para usuário imediatamente
   Não → Continuar
         │
         ▼
      ZARITH
   Corrige código se necessário
         │
         ▼
     MORPHEUS
   Restaura produção
   Monitora estabilização
         │
         ▼
      JARVIS
   Confirma sistema estável
   Registra post-mortem
   Notifica usuário
         │
         ▼
     USUÁRIO
   Recebe relatório:
   - Duração do incidente
   - Causa raiz
   - O que foi feito
   - Como prevenir
```

---

## WF-004 — Análise de Projeto

**Gatilho:** Usuário pede análise, diagnóstico ou revisão de projeto

```
Usuário pede análise
         │
         ▼
      JARVIS
   Busca contexto na memória (memory_search)
   Mapeia estrutura (github_get_tree)
   Lê arquivos relevantes (github_read_file)
   Forma visão completa do projeto
         │
         ▼
       AEGIS (opcional)
   Auditoria de segurança se solicitado
         │
         ▼
      JARVIS
   Consolida análise
   Identifica problemas, riscos e oportunidades
   Prioriza por impacto
         │
         ▼
     USUÁRIO
   Recebe relatório estruturado:
   - Estado atual do projeto
   - Problemas identificados (P0 → P5)
   - Sugestões de melhoria
   - Próximos passos recomendados
```

---

## WF-005 — Prospecção Comercial

**Gatilho:** Usuário solicita busca de clientes ou pesquisa de mercado
*(Ativo quando Hermes estiver operacional — Fase 2)*

```
Usuário define alvo
         │
         ▼
      JARVIS
   Entende o perfil de cliente ideal
   Define critérios de pesquisa
         │
         ▼
      HERMES
   Pesquisa leads
   Qualifica prospects
   Prepara material de abordagem
         │
         ▼
      JARVIS
   Revisa qualidade dos leads
   Prioriza por potencial
         │
         ▼
     FINANCEIRO (opcional)
   Calcula potencial de receita
         │
         ▼
     USUÁRIO
   Recebe lista priorizada com:
   - Leads qualificados
   - Abordagem sugerida para cada um
   - Potencial estimado
```

---

## Status dos Workflows

| Workflow | Status | Fase |
|---|---|---|
| WF-001 Bug Crítico | Conceitual | Fase 2 |
| WF-002 Nova Feature | Conceitual | Fase 2 |
| WF-003 Sistema Caiu | Conceitual | Fase 2 |
| WF-004 Análise de Projeto | **Parcialmente ativo** | Fase 1 |
| WF-005 Prospecção | Conceitual | Fase 2 |

*"Parcialmente ativo" = Jarvis executa manualmente, sem Workflow Engine automatizado*

---

*Última revisão: 2026-06-29*
