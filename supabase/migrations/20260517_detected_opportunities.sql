-- AI Opportunity Detector — обнаруженные проекты из raw_signals.
-- Запускать после 20260517_v2_scoring.sql.

create table if not exists public.detected_opportunities (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  project_slug text not null,
  description text,
  category text,
  confidence int not null default 50,           -- 0-100, ставит AI
  mentions_count int not null default 1,        -- сколько раз сигналы упомянули
  signal_ids uuid[] default '{}',               -- raw_signals.id
  evidence jsonb,                                -- { authors[], top_urls[], sample_tweets[] }
  status text not null default 'pending',        -- pending | approved | rejected
  created_project_id uuid references public.projects(id) on delete set null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  reviewed_at timestamptz,
  unique(project_slug)
);

create index if not exists detected_opportunities_status_idx
  on public.detected_opportunities(status, last_seen desc);
