# DECISIONS.md — Histórico de Decisões Arquiteturais
*Registro permanente. Nunca deletar entradas. Apenas adicionar.*

---

## Como usar este documento

Sempre que uma decisão importante for tomada sobre a arquitetura do ecossistema,
registre aqui antes de implementar. O objetivo é preservar o **raciocínio**,
não apenas o resultado.

Perguntas que este documento responde no futuro:
- "Por que fizemos assim?"
- "Quais alternativas foram consideradas?"
- "O que nos levou a rejeitar a opção B?"

---

## Template

```
### DR-XXXX — [Título curto da decisão]

**Data:** YYYY-MM-DD
**Status:** Aprovada | Rejeitada | Em revisão

**Problema:**
[Descrição do problema ou necessidade que motivou a decisão]

**Alternativas consideradas:**
1. [Opção A] — [Por que foi considerada]
2. [Opção B] — [Por que foi considerada]

**Decisão:**
[O que foi decidido]

**Motivo:**
[Por que esta opção foi escolhida em vez das outras]

**Impacto:**
[O que muda na arquitetura, no código ou nos processos]

**Resultado:**
[Preenchido após implementação — o que aconteceu na prática]
```

---

## Decisões Registradas

---

### DR-0001 — Jarvis nunca implementa código

**Data:** 2026-06-29
**Status:** Aprovada

**Problema:**
O Jarvis acumulava ferramentas de implementação e começava a agir como executor
além de coordenador, tornando os limites de responsabilidade difusos.

**Alternativas consideradas:**
1. Jarvis implementa correções pequenas (<20 linhas) — mais ágil para fixes simples
2. Jarvis só coordena — separação clara de responsabilidades

**Decisão:**
Jarvis nunca implementa código de produção, independente do tamanho.
Toda implementação vai para Zarith.

**Motivo:**
Tamanho não mede complexidade nem risco. 15 linhas podem apagar um banco inteiro.
A métrica correta é responsabilidade, não tamanho.

**Impacto:**
- System prompt atualizado para remover a regra das 20 linhas
- Zarith recebe qualquer implementação de produção
- Jarvis mantém apenas fixes de diagnóstico e análise

**Resultado:**
Separação de responsabilidades mais clara e previsível.

---

### DR-0002 — Comunicação entre agentes sempre via Jarvis

**Data:** 2026-06-29
**Status:** Aprovada

**Problema:**
Com múltiplos agentes, surgiu a questão de permitir comunicação direta
(ex: Zarith notificando Morpheus que o código está pronto para deploy).

**Alternativas consideradas:**
1. Comunicação direta entre agentes — mais rápido, menos latência
2. Toda comunicação passa pelo Jarvis — mais controle, rastreabilidade total

**Decisão:**
Toda comunicação passa pelo Jarvis. Nenhum agente chama outro diretamente.

**Motivo:**
Comunicação direta cria dependências ocultas e torna loops e conflitos
muito difíceis de diagnosticar. Jarvis como único ponto de comunicação
garante rastreabilidade completa e controle de contexto.

**Impacto:**
- Protocolo v1.0 define Jarvis como intermediário obrigatório
- agent_messages no Supabase registra toda comunicação
- Latência ligeiramente maior, mas controlabilidade muito maior

**Resultado:**
Sistema mais previsível e auditável.

---

### DR-0003 — Aegis somente leitura, sem exceções

**Data:** 2026-06-29
**Status:** Aprovada

**Problema:**
Definir as permissões do agente auditor Aegis.

**Alternativas consideradas:**
1. Aegis pode sugerir correções e aplicar automaticamente — mais autônomo
2. Aegis somente leitura — auditor independente sem poder de modificação

**Decisão:**
Aegis nunca escreve, commita, deploya ou modifica qualquer recurso.

**Motivo:**
Um auditor com permissão de escrita deixa de ser auditor.
A independência do Aegis é o que garante a confiabilidade das auditorias.

**Impacto:**
- Policy Engine registra Aegis como read-only em todos os recursos
- Qualquer solicitação de escrita do Aegis é bloqueada automaticamente

**Resultado:**
Auditoria confiável e independente.

---

### DR-0004 — Gate de Delegação obrigatório antes de qualquer tarefa

**Data:** 2026-06-29
**Status:** Aprovada

**Problema:**
Agentes recebiam tarefas com contexto insuficiente e precisavam
de múltiplas iterações para completar o que seria simples com mais informação.

**Alternativas consideradas:**
1. Delegar e deixar o agente pedir o que falta — mais fluido, mais retrabalho
2. Gate de validação antes da delegação — mais fricção inicial, menos retrabalho

**Decisão:**
Gate de Delegação obrigatório com 9 critérios de validação.
Se qualquer critério falhar, Jarvis busca a informação antes de delegar.

**Motivo:**
Retrabalho é mais caro que validação prévia. Um agente executando
com contexto errado desperdiça tempo, tokens e pode introduzir bugs.

**Impacto:**
- System prompt atualizado com etapa formal de Gate
- Jarvis pergunta ao usuário quando falta contexto
- Delegação só acontece quando todos os critérios estão satisfeitos

**Resultado:**
Redução significativa de retrabalho e delegações erradas.

---

### DR-0005 — Protocolo de comunicação versionado (v1.0)

**Data:** 2026-06-29
**Status:** Aprovada

**Problema:**
Com múltiplos agentes e evolução contínua, mudanças no protocolo
poderiam quebrar integrações existentes.

**Alternativas consideradas:**
1. Protocolo sem versão — mais simples, quebra facilmente
2. Protocolo versionado — mais complexo, sempre retrocompatível

**Decisão:**
Protocolo versionado com campo `protocol_version` em todas as mensagens.
Versões novas são aditivas — não removem campos existentes.

**Motivo:**
Quando Zarith v3.0 surgir, Jarvis ainda precisa falar com Zarith v2.0.
Versionamento garante que evolução não quebra o que já funciona.

**Impacto:**
- Todas as mensagens incluem `protocol_version: "1.0"`
- Novos campos são opcionais com valores default
- Agentes ignoram campos desconhecidos em vez de falhar

**Resultado:**
Evolução do ecossistema sem quebrar integrações existentes.

---

*Próxima entrada: DR-0006*

