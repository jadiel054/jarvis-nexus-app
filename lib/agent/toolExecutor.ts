// lib/agent/toolExecutor.ts
// Executes tools by calling internal API routes or directly

const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const GH_TOKEN = process.env.GITHUB_TOKEN!;
const VERCEL_TOKEN = process.env.VERCEL_TOKEN!;
const VERCEL_TEAM = process.env.VERCEL_TEAM_ID || "team_cxs9DuXfZ1wseY1y7bFj8P1V";
const TAVILY_KEY = process.env.TAVILY_API_KEY!;
const TG_TOKENS: Record<string, string> = {
  JarvisComando: process.env.TELEGRAM_BOT_COMANDO_TOKEN!,
  JarvisAlerts:  process.env.TELEGRAM_BOT_ALERTS_TOKEN!,
  JarvisDev:     process.env.TELEGRAM_BOT_DEV_TOKEN!,
};
const TG_ADMIN = process.env.TELEGRAM_ADMIN_CHAT_ID!;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function toolExecutor(name: string, input: Record<string, any>): Promise<unknown> {
  const gh = (path: string, opts?: RequestInit) =>
    fetch(`https://api.github.com${path}`, {
      ...opts,
      headers: { Authorization: `token ${GH_TOKEN}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json", ...(opts?.headers || {}) },
    });

  try {
    switch (name) {

      // ── GITHUB ────────────────────────────────────────────────
      case "github_list_repos": {
        const { filter = "all", sort = "updated" } = input;
        const r = await gh(`/user/repos?type=${filter}&per_page=50&sort=${sort}`);
        if (!r.ok) return { error: `GitHub ${r.status}` };
        const d = await r.json();
        return d.map((r: Record<string,unknown>) => ({ name: r.name, full_name: r.full_name, url: r.html_url, language: r.language, private: r.private, description: r.description, updated_at: r.updated_at, default_branch: r.default_branch }));
      }

      case "github_get_repo": {
        const r = await gh(`/repos/${input.owner}/${input.repo}`);
        if (!r.ok) return { error: `Repo ${input.owner}/${input.repo} não encontrado` };
        const d = await r.json();
        const lr = await gh(d.languages_url.replace("https://api.github.com",""));
        const langs = lr.ok ? await lr.json() : {};
        return { name: d.name, full_name: d.full_name, description: d.description, url: d.html_url, default_branch: d.default_branch, language: d.language, languages: langs, stars: d.stargazers_count, forks: d.forks_count, open_issues: d.open_issues_count, topics: d.topics, private: d.private, pushed_at: d.pushed_at };
      }

      case "github_get_tree": {
        const { owner, repo, branch = "main", path: subpath } = input;
        if (subpath) {
          const r = await gh(`/repos/${owner}/${repo}/contents/${subpath}?ref=${branch}`);
          if (!r.ok) return { error: `GitHub ${r.status}` };
          const d = await r.json();
          return Array.isArray(d) ? d.map((i: Record<string,unknown>) => ({ name: i.name, path: i.path, type: i.type, size: i.size })) : d;
        }
        const r = await gh(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
        if (!r.ok) return { error: `GitHub ${r.status}` };
        const data = await r.json();
        const files = (data.tree || []).filter((t: Record<string,string>) => t.type === "blob").map((t: Record<string,string>) => t.path);
        const dirs = Array.from(new Set((data.tree || []).filter((t: Record<string,string>) => t.type === "tree").map((t: Record<string,string>) => t.path)));
        return { total_files: files.length, directories: dirs.slice(0, 60), files: files.slice(0, 250), truncated: data.truncated, key_files: files.filter((f: string) => ["package.json","tsconfig.json","vite.config.ts","next.config.ts","next.config.js","README.md","Dockerfile",".env.example","vercel.json","requirements.txt","Cargo.toml"].includes(f.split("/").pop()!)) };
      }

      case "github_read_file": {
        const { owner, repo, path, branch = "main" } = input;
        const r = await gh(`/repos/${owner}/${repo}/contents/${path}?ref=${branch}`);
        if (!r.ok) return { error: `Arquivo '${path}' não encontrado na branch '${branch}'` };
        const data = await r.json();
        const content = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
        return { content, sha: data.sha, path: data.path, size: data.size, url: data.html_url };
      }

      case "github_write_file": {
        const { owner, repo, path, content, message, branch = "main", sha } = input;
        const encoded = Buffer.from(content).toString("base64");
        const body: Record<string,unknown> = { message, content: encoded, branch };
        if (sha) body.sha = sha;
        const r = await gh(`/repos/${owner}/${repo}/contents/${path}`, { method: "PUT", body: JSON.stringify(body) });
        if (!r.ok) { const e = await r.json(); return { error: `${e.message}${!sha ? " — leia o arquivo primeiro para obter o SHA" : ""}` }; }
        const data = await r.json();
        return { success: true, commit_url: data.commit.html_url, commit_sha: data.commit.sha, file_sha: data.content?.sha };
      }

      case "github_delete_file": {
        const { owner, repo, path, message, branch = "main", sha } = input;
        if (!sha) return { error: "SHA obrigatório para deletar. Use github_read_file primeiro." };
        const r = await gh(`/repos/${owner}/${repo}/contents/${path}`, { method: "DELETE", body: JSON.stringify({ message, sha, branch }) });
        if (!r.ok) { const e = await r.json(); return { error: e.message }; }
        const data = await r.json();
        return { success: true, commit_url: data.commit.html_url };
      }

      case "github_list_branches": {
        const r = await gh(`/repos/${input.owner}/${input.repo}/branches?per_page=30`);
        if (!r.ok) return { error: `GitHub ${r.status}` };
        const d = await r.json();
        return d.map((b: Record<string,unknown>) => ({ name: b.name, sha: (b.commit as Record<string,string>)?.sha?.slice(0,7), protected: b.protected }));
      }

      case "github_create_branch": {
        const { owner, repo, branch, from_branch = "main" } = input;
        const baseR = await gh(`/repos/${owner}/${repo}/git/ref/heads/${from_branch}`);
        if (!baseR.ok) return { error: `Branch '${from_branch}' não encontrada` };
        const base = await baseR.json();
        const r = await gh(`/repos/${owner}/${repo}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }) });
        if (!r.ok) { const e = await r.json(); return { error: e.message }; }
        return { success: true, branch, from: from_branch };
      }

      case "github_create_pr": {
        const { owner, repo, title, body = "", head, base = "main", draft = false } = input;
        const r = await gh(`/repos/${owner}/${repo}/pulls`, { method: "POST", body: JSON.stringify({ title, body, head, base, draft }) });
        if (!r.ok) { const e = await r.json(); return { error: e.message }; }
        const data = await r.json();
        return { pr_url: data.html_url, number: data.number, state: data.state };
      }

      case "github_list_prs": {
        const r = await gh(`/repos/${input.owner}/${input.repo}/pulls?state=${input.state||"open"}&per_page=20`);
        if (!r.ok) return { error: `GitHub ${r.status}` };
        const d = await r.json();
        return d.map((p: Record<string,unknown>) => ({ number: p.number, title: p.title, state: p.state, url: p.html_url, head: (p.head as Record<string,string>)?.ref, base: (p.base as Record<string,string>)?.ref }));
      }

      case "github_merge_pr": {
        const { owner, repo, pull_number, merge_method = "squash", commit_message } = input;
        const r = await gh(`/repos/${owner}/${repo}/pulls/${pull_number}/merge`, { method: "PUT", body: JSON.stringify({ merge_method, ...(commit_message && { commit_message }) }) });
        if (!r.ok) { const e = await r.json(); return { error: e.message }; }
        const data = await r.json();
        return { success: data.merged, sha: data.sha };
      }

      case "github_list_issues": {
        const { owner, repo, state = "open", labels, limit = 15 } = input;
        let url = `/repos/${owner}/${repo}/issues?state=${state}&per_page=${limit}`;
        if (labels) url += `&labels=${labels}`;
        const r = await gh(url);
        if (!r.ok) return { error: `GitHub ${r.status}` };
        const d = await r.json();
        return d.filter((i: Record<string,unknown>) => !i.pull_request).map((i: Record<string,unknown>) => ({ number: i.number, title: i.title, state: i.state, url: i.html_url, labels: (i.labels as Array<Record<string,string>>).map(l => l.name), body_preview: (i.body as string)?.slice(0,150) }));
      }

      case "github_create_issue": {
        const { owner, repo, title, body, labels = [], assignees = [] } = input;
        const r = await gh(`/repos/${owner}/${repo}/issues`, { method: "POST", body: JSON.stringify({ title, body, labels, assignees }) });
        if (!r.ok) { const e = await r.json(); return { error: e.message }; }
        const data = await r.json();
        return { url: data.html_url, number: data.number };
      }

      case "github_search_code": {
        const { owner, repo, query, path: spath } = input;
        let q = `${query} repo:${owner}/${repo}`;
        if (spath) q += ` path:${spath}`;
        const r = await gh(`/search/code?q=${encodeURIComponent(q)}&per_page=15`);
        if (!r.ok) return { error: `GitHub search ${r.status} — pode estar em rate limit` };
        const data = await r.json();
        return { total: data.total_count, results: (data.items || []).map((i: Record<string,unknown>) => ({ path: i.path, url: i.html_url })) };
      }

      case "github_get_commits": {
        const { owner, repo, branch = "main", path: fpath, limit = 10 } = input;
        let url = `/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${limit}`;
        if (fpath) url += `&path=${fpath}`;
        const r = await gh(url);
        if (!r.ok) return { error: `GitHub ${r.status}` };
        const d = await r.json();
        return d.map((c: Record<string,unknown>) => ({ sha: (c.sha as string)?.slice(0,7), message: (c.commit as Record<string,Record<string,string>>)?.message?.message?.split("\n")[0] || (c.commit as Record<string,Record<string,string>>)?.message?.split?.("\n")?.[0], date: (c.commit as Record<string,Record<string,string>>)?.author?.date, url: c.html_url }));
      }

      case "github_analyze_repo": {
        const { owner, repo } = input;
        const repoR = await gh(`/repos/${owner}/${repo}`);
        if (!repoR.ok) return { error: `Repo ${owner}/${repo} não encontrado` };
        const repoData = await repoR.json();

        const treeR = await gh(`/repos/${owner}/${repo}/git/trees/${repoData.default_branch}?recursive=1`);
        const files: string[] = treeR.ok ? (await treeR.json()).tree?.filter((t: Record<string,string>) => t.type === "blob")?.map((t: Record<string,string>) => t.path) || [] : [];

        let deps = {};
        const pkgR = await gh(`/repos/${owner}/${repo}/contents/package.json?ref=${repoData.default_branch}`);
        if (pkgR.ok) {
          const pkgData = await pkgR.json();
          try {
            const pkg = JSON.parse(Buffer.from(pkgData.content.replace(/\n/g,""),"base64").toString("utf8"));
            deps = { name: pkg.name, version: pkg.version, scripts: Object.keys(pkg.scripts||{}), main_deps: Object.keys(pkg.dependencies||{}).slice(0,20), dev_deps: Object.keys(pkg.devDependencies||{}).slice(0,10) };
          } catch {}
        }

        const commitsR = await gh(`/repos/${owner}/${repo}/commits?per_page=5`);
        const recent = commitsR.ok ? (await commitsR.json()).map((c: Record<string,unknown>) => ({ sha: (c.sha as string)?.slice(0,7), message: ((c.commit as Record<string,Record<string,string>>)?.message || "").split("\n")[0], date: (c.commit as Record<string,Record<string,string>>)?.author?.date })) : [];

        return { name: repoData.name, language: repoData.language, description: repoData.description, topics: repoData.topics, total_files: files.length, key_files: files.filter(f => ["package.json","tsconfig.json","next.config.ts","vite.config.ts","README.md","Dockerfile","vercel.json"].includes(f.split("/").pop()!)), stack: { framework: files.some(f => f === "next.config.ts"||f==="next.config.js") ? "Next.js" : files.some(f => f === "vite.config.ts") ? "Vite/React" : "Desconhecido", has_typescript: files.some(f => f.endsWith(".ts")||f.endsWith(".tsx")), has_tests: files.some(f => f.includes("test")||f.includes("spec")), has_docker: files.some(f => f === "Dockerfile"), has_ci: files.some(f => f.includes(".github/workflows")) }, dependencies: deps, recent_commits: recent };
      }

      case "github_get_checks": {
        const r = await gh(`/repos/${input.owner}/${input.repo}/commits/${input.ref}/check-runs?per_page=20`);
        if (!r.ok) return { error: "Checks não disponíveis (configure GitHub Actions primeiro)" };
        const data = await r.json();
        const runs = data.check_runs || [];
        return { total: runs.length, passed: runs.filter((r: Record<string,string>) => r.conclusion === "success").length, failed: runs.filter((r: Record<string,string>) => r.conclusion === "failure").length, pending: runs.filter((r: Record<string,string>) => r.status === "in_progress").length, all_passed: runs.length > 0 && runs.every((r: Record<string,string>) => r.conclusion === "success"), checks: runs.map((r: Record<string,string>) => ({ name: r.name, status: r.status, conclusion: r.conclusion, url: r.html_url })) };
      }

      case "github_create_workflow": {
        const { owner, repo, node_version = "20", package_manager = "npm", build_command = "npm run build" } = input;
        const install = package_manager === "pnpm" ? "pnpm install" : package_manager === "yarn" ? "yarn install" : "npm ci";
        const workflow = `name: CI\n\non:\n  push:\n    branches: [ main ]\n  pull_request:\n    branches: [ main ]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '${node_version}'\n          cache: '${package_manager}'\n      - run: ${install}\n      - run: npx tsc --noEmit\n        continue-on-error: true\n      - run: ${build_command}\n        env:\n          CI: true\n`;
        const checkR = await gh(`/repos/${owner}/${repo}/contents/.github/workflows/ci.yml`);
        const existing = checkR.ok ? (await checkR.json()).sha : null;
        const body: Record<string,unknown> = { message: "ci: add GitHub Actions workflow", content: Buffer.from(workflow).toString("base64"), branch: "main" };
        if (existing) body.sha = existing;
        const r = await gh(`/repos/${owner}/${repo}/contents/.github/workflows/ci.yml`, { method: "PUT", body: JSON.stringify(body) });
        if (!r.ok) { const e = await r.json(); return { error: e.message }; }
        const data = await r.json();
        return { success: true, commit_url: data.commit.html_url, message: "CI configurado! Vai rodar tsc + build em cada PR." };
      }

      // ── VERCEL ───────────────────────────────────────────────
      case "vercel_list_projects": {
        const teamId = input.teamId || VERCEL_TEAM;
        const r = await fetch(`https://api.vercel.com/v9/projects?teamId=${teamId}&limit=30`, { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } });
        if (!r.ok) return { error: `Vercel ${r.status}` };
        const data = await r.json();
        return (data.projects || []).map((p: Record<string,unknown>) => ({ name: p.name, id: p.id, url: (p.alias as Array<Record<string,string>>)?.[0]?.domain, latest_deploy: (p.latestDeployments as Array<Record<string,string>>)?.[0]?.readyState }));
      }

      case "vercel_trigger_deploy": {
        const teamId = input.teamId || VERCEL_TEAM;
        const r = await fetch(`https://api.vercel.com/v13/deployments?teamId=${teamId}`, { method: "POST", headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: input.projectName, target: "production" }) });
        if (!r.ok) return { error: `Vercel ${r.status}` };
        const data = await r.json();
        return { deployId: data.id, url: data.url, state: data.readyState };
      }

      case "vercel_get_deploy_logs": {
        const teamId = input.teamId || VERCEL_TEAM;
        const r = await fetch(`https://api.vercel.com/v2/deployments/${input.deploymentId}/events?teamId=${teamId}&limit=50`, { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } });
        if (!r.ok) return { error: `Vercel ${r.status}` };
        const data = await r.json();
        return { logs: data.slice(0, 20).map((l: Record<string,unknown>) => ({ type: l.type, text: (l.payload as Record<string,string>)?.text || "" })) };
      }

      case "vercel_get_project_env": {
        const teamId = input.teamId || VERCEL_TEAM;
        const r = await fetch(`https://api.vercel.com/v9/projects/${input.projectName}/env?teamId=${teamId}`, { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } });
        if (!r.ok) return { error: `Vercel ${r.status}` };
        const data = await r.json();
        return { envs: (data.envs || []).map((e: Record<string,string>) => ({ key: e.key, target: e.target, type: e.type })) };
      }

      // ── TAVILY ───────────────────────────────────────────────
      case "tavily_search": {
        const r = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: TAVILY_KEY, query: input.query, max_results: input.max_results || 5, search_depth: input.search_depth || "basic" }) });
        if (!r.ok) return { error: `Tavily ${r.status}` };
        const data = await r.json();
        return { results: (data.results || []).map((r: Record<string,string>) => ({ title: r.title, url: r.url, snippet: r.content?.slice(0,250) })) };
      }

      // ── TELEGRAM ─────────────────────────────────────────────
      case "telegram_send_message": {
        const token = TG_TOKENS[input.bot as string];
        if (!token) return { error: `Token do bot ${input.bot} não configurado` };
        const chatId = input.chatId || TG_ADMIN;
        if (!chatId) return { error: "TELEGRAM_ADMIN_CHAT_ID não configurado" };
        const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: input.message, parse_mode: "Markdown" }) });
        if (!r.ok) return { error: `Telegram ${r.status}` };
        const data = await r.json();
        return { message_id: data.result?.message_id, ok: data.ok };
      }

      // ── MEMORY ───────────────────────────────────────────────
      case "memory_save": {
        const r = await fetch(`${BASE}/api/supabase/memory`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", content: input.content, category: input.category, project: input.project }) });
        if (!r.ok) return { error: "Falha ao salvar memória" };
        return await r.json();
      }

      case "memory_search": {
        const r = await fetch(`${BASE}/api/supabase/memory`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "search", query: input.query, limit: input.limit || 8, category: input.category }) });
        if (!r.ok) return { error: "Falha ao buscar memórias" };
        return await r.json();
      }

      // ── ZARITH ───────────────────────────────────────────────
      case "zarith_delegate": {
        const r = await fetch(`${BASE}/api/supabase/zarith`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: input.task, context: input.context, repo: input.repo, priority: input.priority || "normal" }) });
        if (!r.ok) return { error: "Falha ao delegar para Zarith" };
        return await r.json();
      }

      // ── PLANNER (handled by UI) ───────────────────────────────
      case "jarvis_plan":
        return { planned: true, task_title: input.task_title, steps: input.steps, step_count: input.steps?.length };
      case "jarvis_update_step":
        return { updated: true, step_index: input.step_index, status: input.status, note: input.note };

      default:
        return { error: `Tool '${name}' não implementada.` };
    }
  } catch (err) {
    return { error: `Erro ao executar ${name}: ${(err as Error).message}` };
  }
}
