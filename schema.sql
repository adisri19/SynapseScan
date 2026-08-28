-- SQL schema for Tech Debt Intelligence Platform (v2.0)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS tenants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR NOT NULL,
  slug        VARCHAR UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed a default tenant so the dashboard doesn't fail on joins
INSERT INTO tenants (id, name, slug) 
VALUES ('d290f1ee-6c54-4b01-90e6-d701748f0851', 'Demo Workspace', 'demo-workspace')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS repositories (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE DEFAULT 'd290f1ee-6c54-4b01-90e6-d701748f0851',
  url          VARCHAR UNIQUE NOT NULL,
  owner        VARCHAR NOT NULL,
  name         VARCHAR NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analysis_runs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE DEFAULT 'd290f1ee-6c54-4b01-90e6-d701748f0851',
  repository_id   UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  overall_score   CHAR(1) NOT NULL,          -- A / B / C / D / F
  total_loc       INTEGER NOT NULL,
  avg_complexity  NUMERIC(6,2) NOT NULL,
  duplication_rate NUMERIC(5,2) NOT NULL,    -- percentage 0–100
  debt_categories  JSONB NOT NULL,            -- { security, maintainability, duplication, coverage }
  estimated_debt_hours INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS file_metrics (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id                  UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  file_path               VARCHAR NOT NULL,
  lines_of_code           INTEGER NOT NULL,
  max_nesting_depth       INTEGER NOT NULL,
  score                   CHAR(1) NOT NULL,
  outdated_patterns_count INTEGER NOT NULL DEFAULT 0,
  priority_score          NUMERIC(10,2) NOT NULL DEFAULT 0,
  review_status           VARCHAR(30) NOT NULL DEFAULT 'passed', -- passed / flagged / needs_refactor
  recommended_action      VARCHAR NOT NULL DEFAULT 'No action needed'
);

CREATE TABLE IF NOT EXISTS duplications (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id           UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  block_hash       VARCHAR NOT NULL,
  line_count       INTEGER NOT NULL,
  file_occurrences JSONB NOT NULL           -- [{ filePath, startLine }]
);

CREATE TABLE IF NOT EXISTS ingestion_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE DEFAULT 'd290f1ee-6c54-4b01-90e6-d701748f0851',
  repository_id   UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  status          VARCHAR(30) NOT NULL,     -- queued / running / done / failed
  progress_step   VARCHAR NOT NULL,
  progress_pct    INTEGER NOT NULL,
  triggered_by    VARCHAR NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_repositories_url ON repositories(url);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_repository_id ON analysis_runs(repository_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_created_at ON analysis_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_file_metrics_run_id ON file_metrics(run_id);
CREATE INDEX IF NOT EXISTS idx_duplications_run_id ON duplications(run_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_sessions_tenant_id ON ingestion_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_sessions_status ON ingestion_sessions(status);

CREATE TABLE IF NOT EXISTS webhook_configs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repo_url     VARCHAR NOT NULL,
  secret_token VARCHAR NOT NULL,
  events       JSONB NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Migration safety for existing legacy databases
ALTER TABLE repositories 
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT 'd290f1ee-6c54-4b01-90e6-d701748f0851';

ALTER TABLE analysis_runs 
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT 'd290f1ee-6c54-4b01-90e6-d701748f0851',
  ADD COLUMN IF NOT EXISTS debt_categories JSONB DEFAULT '{"security": 0, "maintainability": 0, "duplication": 0, "coverage": 0}'::jsonb,
  ADD COLUMN IF NOT EXISTS estimated_debt_hours INTEGER DEFAULT 0;

ALTER TABLE file_metrics 
  ADD COLUMN IF NOT EXISTS priority_score NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_status VARCHAR(30) DEFAULT 'passed',
  ADD COLUMN IF NOT EXISTS recommended_action VARCHAR DEFAULT 'No action needed';

