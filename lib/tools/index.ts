// lib/tools/index.ts — All tools exported for the AI model

export const allTools = [
  // ── GITHUB ─────────────────────────────────────────────────────
  {
    name: "github_list_repos",
    description: "Lista repositórios do usuário no GitHub. Use ao iniciar sessão ou quando pedirem para listar projetos.",
    input_schema: {
      type: "object" as const,
      properties: {
        username: { type: "string", description: "GitHub username. Default: jadiel054" },
        filter: { type: "string", enum: ["all","public","private"], description: "Default: all" },
        sort: { type: "string", enum: ["updated","created","pushed","full_name"], description: "Default: updated" }
      },
      required: []
    }
  },
  {
    name: "github_get_repo",
    description: "Metadados completos de um repositório: linguagem, tamanho, branches, último commit. USE SEMPRE antes de analisar um repo pela primeira vez.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" },
        repo: { type: "string" }
      },
      required: ["owner","repo"]
    }
  },
  {
    name: "github_get_tree",
    description: "Árvore completa de arquivos do repositório recursivamente. ESSENCIAL para entender estrutura antes de qualquer modificação.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        branch: { type: "string", description: "Default: main" },
        path: { type: "string", description: "Subdiretório. Omita para raiz." }
      },
      required: ["owner","repo"]
    }
  },
  {
    name: "github_read_file",
    description: "Lê conteúdo de um arquivo. OBRIGATÓRIO antes de qualquer write — precisa do SHA. Use para entender imports, exports e dependências.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        path: { type: "string", description: "Ex: src/components/Chat.tsx" },
        branch: { type: "string", description: "Default: main" }
      },
      required: ["owner","repo","path"]
    }
  },
  {
    name: "github_write_file",
    description: "Cria ou atualiza arquivo (commit). SEMPRE leia o arquivo primeiro para o SHA. Use Conventional Commits: feat:, fix:, refactor:, docs:.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        path: { type: "string" },
        content: { type: "string", description: "Conteúdo COMPLETO do arquivo." },
        message: { type: "string", description: "Mensagem de commit. Ex: fix: corrige bug no chat.tsx" },
        branch: { type: "string", description: "Default: main. Use branch separada para mudanças grandes." },
        sha: { type: "string", description: "SHA do arquivo atual. Obrigatório para atualizar existente." }
      },
      required: ["owner","repo","path","content","message"]
    }
  },
  {
    name: "github_delete_file",
    description: "Remove arquivo do repositório. IRREVERSÍVEL — confirmar com usuário antes.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        path: { type: "string" },
        message: { type: "string", description: "Mensagem de commit. Ex: chore: remove arquivo obsoleto" },
        branch: { type: "string", description: "Default: main" },
        sha: { type: "string", description: "SHA do arquivo. Obter via github_read_file." }
      },
      required: ["owner","repo","path","message","sha"]
    }
  },
  {
    name: "github_list_branches",
    description: "Lista branches do repositório. Use para identificar branch de trabalho e evitar conflitos.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" },
        repo: { type: "string" }
      },
      required: ["owner","repo"]
    }
  },
  {
    name: "github_create_branch",
    description: "Cria nova branch. Use ANTES de commitar mudanças grandes — nunca trabalhar direto na main.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        branch: { type: "string", description: "Ex: fix/chat-bug, feat/nova-feature" },
        from_branch: { type: "string", description: "Branch base. Default: main" }
      },
      required: ["owner","repo","branch"]
    }
  },
  {
    name: "github_create_pr",
    description: "Cria Pull Request. Use após commits em branch. Inclua no body: o que mudou, por que, como testar.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        title: { type: "string", description: "Ex: fix: corrige crash no chat ao enviar mensagem vazia" },
        body: { type: "string", description: "Descrição em markdown: ## O que mudou, ## Por que, ## Como testar" },
        head: { type: "string", description: "Branch de origem (com as mudanças)" },
        base: { type: "string", description: "Branch destino. Default: main" },
        draft: { type: "boolean", description: "PR como rascunho. Default: false" }
      },
      required: ["owner","repo","title","head"]
    }
  },
  {
    name: "github_list_prs",
    description: "Lista Pull Requests. Use para verificar mudanças pendentes.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        state: { type: "string", enum: ["open","closed","all"], description: "Default: open" }
      },
      required: ["owner","repo"]
    }
  },
  {
    name: "github_merge_pr",
    description: "Faz merge de um PR. REQUER aprovação explícita do usuário.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        pull_number: { type: "number" },
        merge_method: { type: "string", enum: ["merge","squash","rebase"], description: "Default: squash" },
        commit_message: { type: "string" }
      },
      required: ["owner","repo","pull_number"]
    }
  },
  {
    name: "github_list_issues",
    description: "Lista Issues. Use para entender backlog e bugs antes de implementar.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        state: { type: "string", enum: ["open","closed","all"] },
        labels: { type: "string", description: "Filtrar por label. Ex: bug,enhancement" },
        limit: { type: "number", description: "Default: 15" }
      },
      required: ["owner","repo"]
    }
  },
  {
    name: "github_create_issue",
    description: "Cria Issue. Use ao identificar bugs ou melhorias que devem ser rastreadas.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        title: { type: "string" },
        body: { type: "string", description: "Markdown com steps para reproduzir (bugs) ou spec (features)" },
        labels: { type: "array", items: { type: "string" } },
        assignees: { type: "array", items: { type: "string" } }
      },
      required: ["owner","repo","title","body"]
    }
  },
  {
    name: "github_search_code",
    description: "Busca código em todo o repositório. Use para rastrear dependências e verificar impacto antes de mudar.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        query: { type: "string", description: "Ex: import useAuth, function handleSubmit" },
        path: { type: "string", description: "Restringir a diretório. Ex: src/components" }
      },
      required: ["owner","repo","query"]
    }
  },
  {
    name: "github_get_commits",
    description: "Histórico de commits. Use para entender evolução do código antes de intervir.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        branch: { type: "string", description: "Default: main" },
        path: { type: "string", description: "Filtrar commits de arquivo específico" },
        limit: { type: "number", description: "Default: 10" }
      },
      required: ["owner","repo"]
    }
  },
  {
    name: "github_analyze_repo",
    description: "Análise profunda de repositório: estrutura, dependências, arquitetura, stack detectada. Use quando pedirem para 'analisar', 'entender' ou 'mapear' um projeto.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        focus: { type: "string", description: "Aspecto: segurança, performance, arquitetura, bugs. Default: geral" }
      },
      required: ["owner","repo"]
    }
  },
  {
    name: "github_get_checks",
    description: "Verifica status dos CI checks (GitHub Actions) de um commit ou PR. Use SEMPRE após abrir PR.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        ref: { type: "string", description: "Branch name, commit SHA ou PR head SHA" }
      },
      required: ["owner","repo","ref"]
    }
  },
  {
    name: "github_create_workflow",
    description: "Cria .github/workflows/ci.yml no repositório para habilitar CI automático com tsc + build + testes.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        node_version: { type: "string", description: "Default: 20" },
        package_manager: { type: "string", enum: ["npm","pnpm","yarn"], description: "Default: npm" },
        has_tests: { type: "boolean", description: "Se tem testes configurados. Default: false" },
        build_command: { type: "string", description: "Default: npm run build" }
      },
      required: ["owner","repo"]
    }
  },
  // ── VERCEL ─────────────────────────────────────────────────────
  {
    name: "vercel_list_projects",
    description: "Lista projetos no Vercel com status de deploy.",
    input_schema: {
      type: "object" as const,
      properties: {
        teamId: { type: "string", description: "Default: team_cxs9DuXfZ1wseY1y7bFj8P1V" }
      },
      required: []
    }
  },
  {
    name: "vercel_trigger_deploy",
    description: "Dispara novo deploy. SEMPRE confirmar projeto e notificar via Telegram após.",
    input_schema: {
      type: "object" as const,
      properties: {
        projectName: { type: "string" },
        teamId: { type: "string" }
      },
      required: ["projectName"]
    }
  },
  {
    name: "vercel_get_deploy_logs",
    description: "Logs de build de deploy. Use para diagnosticar erros.",
    input_schema: {
      type: "object" as const,
      properties: {
        deploymentId: { type: "string" },
        teamId: { type: "string" }
      },
      required: ["deploymentId"]
    }
  },
  {
    name: "vercel_get_project_env",
    description: "Lista variáveis de ambiente configuradas (apenas nomes, nunca valores).",
    input_schema: {
      type: "object" as const,
      properties: {
        projectName: { type: "string" },
        teamId: { type: "string" }
      },
      required: ["projectName"]
    }
  },
  // ── SEARCH ─────────────────────────────────────────────────────
  {
    name: "tavily_search",
    description: "Busca web em tempo real. Use para docs atuais, erros desconhecidos, versões recentes, comparações de tech.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        max_results: { type: "number", description: "Default: 5" },
        search_depth: { type: "string", enum: ["basic","advanced"] }
      },
      required: ["query"]
    }
  },
  // ── TELEGRAM ───────────────────────────────────────────────────
  {
    name: "telegram_send_message",
    description: "Envia mensagem via Telegram. Bots: JarvisComando (geral), JarvisAlerts (crítico), JarvisDev (dev).",
    input_schema: {
      type: "object" as const,
      properties: {
        bot: { type: "string", enum: ["JarvisComando","JarvisAlerts","JarvisDev"] },
        message: { type: "string" },
        chatId: { type: "string" }
      },
      required: ["bot","message"]
    }
  },
  // ── MEMORY ─────────────────────────────────────────────────────
  {
    name: "memory_save",
    description: "Salva informação na memória persistente. Use para preferências, decisões arquiteturais, contexto importante.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: { type: "string" },
        category: { type: "string", enum: ["preference","decision","credential","context","todo","project"] },
        project: { type: "string" }
      },
      required: ["content","category"]
    }
  },
  {
    name: "memory_search",
    description: "Busca memórias relevantes. Use SEMPRE antes de responder sobre projetos específicos de Jadiel.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
        category: { type: "string", enum: ["preference","decision","credential","context","todo","project"] }
      },
      required: ["query"]
    }
  },
  // ── ZARITH ─────────────────────────────────────────────────────
  {
    name: "zarith_delegate",
    description: "Delega tarefa complexa para a Zarith (agente executora). Use para implementação >50 linhas, refatoração de sistema.",
    input_schema: {
      type: "object" as const,
      properties: {
        task: { type: "string" },
        context: { type: "string" },
        repo: { type: "string" },
        priority: { type: "string", enum: ["normal","urgent"] }
      },
      required: ["task","repo"]
    }
  },
  // ── PLANNER ────────────────────────────────────────────────────
  {
    name: "jarvis_plan",
    description: "Cria plano de execução visual para o usuário. Use SEMPRE para tarefas com 2+ passos.",
    input_schema: {
      type: "object" as const,
      properties: {
        task_title: { type: "string", description: "Título resumido da tarefa." },
        steps: { type: "array", items: { type: "string" }, description: "Steps em ordem. Sem limite de quantidade." }
      },
      required: ["task_title","steps"]
    }
  },
  {
    name: "jarvis_update_step",
    description: "Atualiza status de um step do plano. Use ao iniciar e ao concluir cada step.",
    input_schema: {
      type: "object" as const,
      properties: {
        step_index: { type: "number", description: "Índice 0-based" },
        status: { type: "string", enum: ["running","done","error","skipped"] },
        note: { type: "string", description: "Nota sobre o resultado." }
      },
      required: ["step_index","status"]
    }
  }
];
