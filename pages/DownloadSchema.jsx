import React, { useState } from 'react';
import { Copy, Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SQL = `-- ============================================================
--  JARVIS AUTÔNOMO — SUPABASE SCHEMA v1.0
--  Arquitetura: Agente Full-stack | Projetado para escala
--  Gerado em: 2026-05-06
-- ============================================================

-- EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ENUM TYPES
CREATE TYPE user_role          AS ENUM ('admin', 'cliente', 'viewer');
CREATE TYPE project_status     AS ENUM ('rascunho', 'em_progresso', 'revisao', 'publicado', 'arquivado', 'erro');
CREATE TYPE container_status   AS ENUM ('pending', 'building', 'running', 'stopped', 'failed', 'destroyed');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');
CREATE TYPE payment_provider   AS ENUM ('stripe', 'mercado_pago', 'manual', 'other');
CREATE TYPE ledger_event_type  AS ENUM ('subscription_created', 'subscription_renewed', 'subscription_canceled',
                                        'one_time_payment', 'refund', 'chargeback', 'trial_started', 'trial_ended');
CREATE TYPE health_severity    AS ENUM ('ok', 'info', 'warning', 'critical', 'resolved');
CREATE TYPE llm_provider       AS ENUM ('openai', 'anthropic', 'google', 'groq', 'base44', 'other');
CREATE TYPE generation_status  AS ENUM ('pending', 'running', 'success', 'failed', 'retrying');

-- HELPER: auto-updated updated_at trigger
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE PROCEDURE apply_updated_at_trigger(tbl TEXT)
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER set_updated_at
     BEFORE UPDATE ON %I
     FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();', tbl);
END;
$$;

-- ============================================================
--  1. PUBLIC.PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id              UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  display_name    TEXT,
  avatar_url      TEXT,
  role            user_role    NOT NULL DEFAULT 'cliente',
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  timezone        TEXT         NOT NULL DEFAULT 'America/Sao_Paulo',
  locale          TEXT         NOT NULL DEFAULT 'pt-BR',
  metadata        JSONB        NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CALL apply_updated_at_trigger('profiles');

CREATE INDEX idx_profiles_role      ON public.profiles(role);
CREATE INDEX idx_profiles_is_active ON public.profiles(is_active);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário lê próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Usuário atualiza próprio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admin lê todos os perfis"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admin gerencia todos os perfis"
  ON public.profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
--  2. PROJECTS
-- ============================================================
CREATE TABLE public.projects (
  id                UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id          UUID           NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name              TEXT           NOT NULL,
  slug              TEXT           UNIQUE,
  description       TEXT,
  tech_stack        TEXT[]         NOT NULL DEFAULT '{}',
  status            project_status NOT NULL DEFAULT 'rascunho',
  ai_context        TEXT,
  generation_config JSONB          NOT NULL DEFAULT '{}',
  tags              TEXT[]         NOT NULL DEFAULT '{}',
  is_public         BOOLEAN        NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CALL apply_updated_at_trigger('projects');

CREATE INDEX idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX idx_projects_status   ON public.projects(status);
CREATE INDEX idx_projects_tags     ON public.projects USING GIN(tags);
CREATE INDEX idx_projects_stack    ON public.projects USING GIN(tech_stack);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono lê próprios projetos"
  ON public.projects FOR SELECT
  USING (auth.uid() = owner_id OR is_public = TRUE);

CREATE POLICY "Dono gerencia próprios projetos"
  ON public.projects FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Admin gerencia todos os projetos"
  ON public.projects FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
--  3. AI_GENERATION_LOGS
-- ============================================================
CREATE TABLE public.ai_generation_logs (
  id                UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID              REFERENCES public.projects(id) ON DELETE SET NULL,
  triggered_by      UUID              REFERENCES public.profiles(id) ON DELETE SET NULL,
  agent_name        TEXT,
  task_type         TEXT              NOT NULL,
  llm_provider      llm_provider      NOT NULL DEFAULT 'base44',
  llm_model         TEXT,
  system_prompt     TEXT,
  user_prompt       TEXT              NOT NULL,
  full_response     TEXT,
  tokens_input      INTEGER           NOT NULL DEFAULT 0,
  tokens_output     INTEGER           NOT NULL DEFAULT 0,
  tokens_total      INTEGER           GENERATED ALWAYS AS (tokens_input + tokens_output) STORED,
  cost_usd          NUMERIC(10,6)     NOT NULL DEFAULT 0,
  status            generation_status NOT NULL DEFAULT 'pending',
  duration_ms       INTEGER,
  retry_count       INTEGER           NOT NULL DEFAULT 0,
  error_code        TEXT,
  error_message     TEXT,
  error_stack       TEXT,
  payload           JSONB             NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CALL apply_updated_at_trigger('ai_generation_logs');

CREATE INDEX idx_ai_logs_project    ON public.ai_generation_logs(project_id);
CREATE INDEX idx_ai_logs_status     ON public.ai_generation_logs(status);
CREATE INDEX idx_ai_logs_provider   ON public.ai_generation_logs(llm_provider);
CREATE INDEX idx_ai_logs_created_at ON public.ai_generation_logs(created_at DESC);
CREATE INDEX idx_ai_logs_payload    ON public.ai_generation_logs USING GIN(payload);

ALTER TABLE public.ai_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono do projeto lê logs"
  ON public.ai_generation_logs FOR SELECT
  USING (
    triggered_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.projects pr
      WHERE pr.id = project_id AND pr.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admin lê todos os logs"
  ON public.ai_generation_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Sistema insere logs"
  ON public.ai_generation_logs FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================
--  4. INFRASTRUCTURE_CONTROL
-- ============================================================
CREATE TABLE public.infrastructure_control (
  id                   UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id           UUID             NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  repository_url       TEXT,
  repository_branch    TEXT             NOT NULL DEFAULT 'main',
  repository_provider  TEXT,
  docker_image_tag     TEXT,
  dockerfile_path      TEXT             NOT NULL DEFAULT 'Dockerfile',
  deployment_url       TEXT,
  staging_url          TEXT,
  container_status     container_status NOT NULL DEFAULT 'pending',
  last_deployed_at     TIMESTAMPTZ,
  last_deploy_sha      TEXT,
  env_vars_encrypted   TEXT,
  cpu_limit            TEXT             NOT NULL DEFAULT '0.5',
  memory_limit_mb      INTEGER          NOT NULL DEFAULT 512,
  custom_domain        TEXT,
  ssl_enabled          BOOLEAN          NOT NULL DEFAULT TRUE,
  deploy_history       JSONB            NOT NULL DEFAULT '[]',
  created_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CALL apply_updated_at_trigger('infrastructure_control');

CREATE INDEX idx_infra_project_id ON public.infrastructure_control(project_id);
CREATE INDEX idx_infra_container  ON public.infrastructure_control(container_status);

ALTER TABLE public.infrastructure_control ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono do projeto lê infra"
  ON public.infrastructure_control FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects pr
      WHERE pr.id = project_id AND pr.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admin gerencia toda a infra"
  ON public.infrastructure_control FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
--  5. COMMERCIAL_LEDGER
-- ============================================================
CREATE TABLE public.commercial_ledger (
  id                       UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id               UUID                NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  project_id               UUID                REFERENCES public.projects(id) ON DELETE SET NULL,
  event_type               ledger_event_type   NOT NULL,
  payment_provider         payment_provider    NOT NULL DEFAULT 'stripe',
  provider_customer_id     TEXT,
  provider_subscription_id TEXT,
  provider_payment_id      TEXT,
  provider_invoice_id      TEXT,
  provider_product_id      TEXT,
  provider_price_id        TEXT,
  subscription_status      subscription_status,
  subscription_plan        TEXT,
  subscription_interval    TEXT,
  trial_ends_at            TIMESTAMPTZ,
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  cancel_at_period_end     BOOLEAN             NOT NULL DEFAULT FALSE,
  canceled_at              TIMESTAMPTZ,
  amount_cents             BIGINT              NOT NULL DEFAULT 0,
  currency                 CHAR(3)             NOT NULL DEFAULT 'BRL',
  refunded_amount_cents    BIGINT              NOT NULL DEFAULT 0,
  provider_event_payload   JSONB               NOT NULL DEFAULT '{}',
  notes                    TEXT,
  created_at               TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CALL apply_updated_at_trigger('commercial_ledger');

CREATE INDEX idx_ledger_profile_id   ON public.commercial_ledger(profile_id);
CREATE INDEX idx_ledger_event_type   ON public.commercial_ledger(event_type);
CREATE INDEX idx_ledger_sub_status   ON public.commercial_ledger(subscription_status);
CREATE INDEX idx_ledger_provider     ON public.commercial_ledger(payment_provider);
CREATE INDEX idx_ledger_provider_sub ON public.commercial_ledger(provider_subscription_id);
CREATE INDEX idx_ledger_created_at   ON public.commercial_ledger(created_at DESC);

ALTER TABLE public.commercial_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário lê próprio ledger"
  ON public.commercial_ledger FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Admin gerencia todo o ledger"
  ON public.commercial_ledger FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Sistema insere eventos"
  ON public.commercial_ledger FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================
--  6. SYSTEM_HEALTH
-- ============================================================
CREATE TABLE public.system_health (
  id                 UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id         UUID            REFERENCES public.projects(id) ON DELETE CASCADE,
  source             TEXT            NOT NULL,
  service_name       TEXT            NOT NULL,
  instance_id        TEXT,
  severity           health_severity NOT NULL DEFAULT 'info',
  metric_name        TEXT,
  metric_value       NUMERIC,
  metric_unit        TEXT,
  threshold_value    NUMERIC,
  message            TEXT            NOT NULL,
  auto_fix_attempted BOOLEAN         NOT NULL DEFAULT FALSE,
  auto_fix_log       TEXT,
  auto_fix_status    TEXT,
  resolved_at        TIMESTAMPTZ,
  raw_payload        JSONB           NOT NULL DEFAULT '{}',
  labels             JSONB           NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CALL apply_updated_at_trigger('system_health');

CREATE INDEX idx_health_project_id ON public.system_health(project_id);
CREATE INDEX idx_health_severity   ON public.system_health(severity);
CREATE INDEX idx_health_source     ON public.system_health(source);
CREATE INDEX idx_health_service    ON public.system_health(service_name);
CREATE INDEX idx_health_created_at ON public.system_health(created_at DESC);
CREATE INDEX idx_health_labels     ON public.system_health USING GIN(labels);
CREATE INDEX idx_health_open_critical
  ON public.system_health(severity, created_at DESC)
  WHERE severity IN ('critical', 'warning') AND resolved_at IS NULL;

ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lê todos os health logs"
  ON public.system_health FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Dono do projeto lê health do projeto"
  ON public.system_health FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects pr
      WHERE pr.id = project_id AND pr.owner_id = auth.uid()
    )
  );

CREATE POLICY "Sistema insere health logs"
  ON public.system_health FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================
--  VIEWS UTILITÁRIAS
-- ============================================================
CREATE OR REPLACE VIEW public.v_project_dashboard AS
SELECT
  pr.id, pr.name, pr.slug, pr.status, pr.tech_stack, pr.tags, pr.owner_id,
  p.display_name AS owner_name,
  ic.container_status, ic.deployment_url, ic.docker_image_tag, ic.last_deployed_at,
  (SELECT COUNT(*) FROM public.ai_generation_logs agl
   WHERE agl.project_id = pr.id AND agl.status = 'success') AS successful_generations,
  (SELECT COUNT(*) FROM public.system_health sh
   WHERE sh.project_id = pr.id AND sh.severity IN ('critical','warning') AND sh.resolved_at IS NULL) AS open_alerts,
  pr.created_at, pr.updated_at
FROM public.projects pr
LEFT JOIN public.profiles p ON p.id = pr.owner_id
LEFT JOIN public.infrastructure_control ic ON ic.project_id = pr.id;

CREATE OR REPLACE VIEW public.v_active_subscriptions AS
SELECT DISTINCT ON (profile_id)
  profile_id, subscription_plan, subscription_status, subscription_interval,
  current_period_end, trial_ends_at, cancel_at_period_end,
  payment_provider, provider_subscription_id
FROM public.commercial_ledger
WHERE subscription_status IN ('active', 'trialing')
ORDER BY profile_id, created_at DESC;

-- ============================================================
--  FUNÇÃO: Resumo de uso de tokens por projeto
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_token_usage(p_project_id UUID)
RETURNS TABLE (
  llm_provider   llm_provider,
  llm_model      TEXT,
  total_calls    BIGINT,
  total_tokens   BIGINT,
  total_cost_usd NUMERIC
) LANGUAGE sql STABLE AS $$
  SELECT llm_provider, llm_model,
    COUNT(*) AS total_calls,
    SUM(tokens_total) AS total_tokens,
    SUM(cost_usd) AS total_cost_usd
  FROM public.ai_generation_logs
  WHERE project_id = p_project_id
  GROUP BY llm_provider, llm_model
  ORDER BY total_tokens DESC;
$$;

-- ============================================================
--  FIM DO SCHEMA — cole no Supabase SQL Editor e execute.
-- ============================================================`;

export default function DownloadSchema() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const blob = new Blob([SQL], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jarvis_supabase_schema.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#050a0f] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold font-mono text-cyan-300 mb-1 tracking-widest text-center">
          SUPABASE SCHEMA
        </h1>
        <p className="text-xs font-mono text-cyan-700/60 text-center mb-8">
          JARVIS AUTÔNOMO v1.0 — Clique em Copiar ou Baixar
        </p>

        <div className="flex gap-3 mb-6 justify-center">
          <Button
            onClick={handleCopy}
            className="flex items-center gap-2 font-mono text-sm"
            style={{
              background: 'linear-gradient(135deg, rgba(0,255,255,0.12), rgba(0,128,255,0.12))',
              border: '1px solid rgba(0,255,255,0.35)',
              color: '#67e8f9',
            }}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado!' : 'Copiar SQL'}
          </Button>

          <Button
            onClick={handleDownload}
            className="flex items-center gap-2 font-mono text-sm"
            style={{
              background: 'linear-gradient(135deg, rgba(0,128,255,0.15), rgba(0,64,200,0.15))',
              border: '1px solid rgba(0,128,255,0.4)',
              color: '#93c5fd',
            }}
          >
            <Download className="w-4 h-4" />
            Baixar .sql
          </Button>
        </div>

        <pre
          className="w-full rounded-xl border border-cyan-900/30 bg-[#080f1a] text-cyan-400/80 font-mono text-[10px] leading-relaxed p-5 overflow-auto"
          style={{ maxHeight: '60vh', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        >
          {SQL}
        </pre>
      </div>
    </div>
  );
}