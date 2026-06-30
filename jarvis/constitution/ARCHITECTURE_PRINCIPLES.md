# ARCHITECTURE_PRINCIPLES.md — Regras Arquiteturais
*Muda raramente. Toda exceção deve ser registrada em DECISIONS.md com justificativa.*

---

## Regras que nunca violamos

### Estrutura

- **Sem dependências circulares** — A → B → C nunca pode voltar para A
- **Sem comunicação direta entre especialistas** — Zarith, Morpheus, Hermes e Aegis não se chamam
- **Um agente = uma responsabilidade** — especialização é a base da arquitetura
- **Kernel nunca executa implementação** — Jarvis coordena, Workers executam

### Segurança

- **Aegis sempre somente leitura** — o auditor nunca recebe permissão de escrita em nenhum ambiente
- **Credenciais nunca em código** — sempre em variáveis de ambiente ou cofre seguro
- **Ações destrutivas sempre com aprovação** — nenhum agente destrói sem confirmação humana

### Protocolo

- **Protocolos sempre retrocompatíveis** — versão nova não quebra integração com versão anterior
- **Toda nova capacidade deve ser registrada no Registry** — agentes não descobrem capacidades por suposição
- **Heartbeat obrigatório para agentes ativos** — se parou de bater, Jarvis assume que está offline

### Memória e dados

- **Memória compartilhada sempre versionada** — mudanças no schema de memória não apagam dados anteriores
- **Decisões importantes registradas em DECISIONS.md** — o raciocínio do sistema não fica apenas na memória de ninguém
- **Logs nunca descartados** — agent_logs preserva histórico completo de execuções

### Evolução

- **Novas funcionalidades não mudam responsabilidades existentes** — um agente ganha capacidades, não troca de papel
- **Toda adição ao protocolo é aditiva** — novos campos são opcionais, não obrigatórios
- **Workflow Engine não substitui Jarvis** — é uma ferramenta que Jarvis usa, não o contrário

---

## O que indica que a arquitetura precisa de revisão

Sinais de alerta para observar:

1. Dois agentes fazendo tarefas similares
2. Jarvis precisando executar código para completar uma tarefa
3. Um agente chamando outro diretamente
4. Um workflow sem agente responsável claro
5. Decisão sendo tomada sem Gate de Delegação
6. Aegis recebendo permissão de escrita por "exceção temporária"

Quando qualquer sinal aparecer: **parar, revisar, registrar em DECISIONS.md**.

---

*Última revisão: 2026-06-29*

