-- v2 scoring: feedback loop tables
-- Запускать вручную в Supabase SQL editor (RLS не настраивается здесь — оставлено на усмотрение).

-- 1. Outcomes — что мы предсказали и что случилось на самом деле.
create table if not exists public.scoring_outcomes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  project_name text not null,

  -- Прогноз на момент скоринга
  score_predicted int not null,
  classification_predicted text,
  breakdown jsonb,                       -- полный ScoringBreakdown
  weights_used jsonb,                    -- какие веса использовали

  -- Реальный исход
  airdrop_happened boolean,
  real_outcome_value_usd numeric,        -- сколько реально дали
  user_farmed boolean,                   -- участвовали ли мы
  notes text,

  predicted_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists scoring_outcomes_project_idx on public.scoring_outcomes(project_id);
create index if not exists scoring_outcomes_resolved_idx on public.scoring_outcomes(resolved_at);

-- 2. Состояние весов. Одна актуальная строка + история.
create table if not exists public.scoring_weights (
  id uuid primary key default gen_random_uuid(),
  weights jsonb not null,                -- { founding_quality, airdrop_likelihood, ... }
  active boolean not null default false,
  notes text,
  calibrated_from int,                   -- сколько outcomes участвовало в калибровке
  created_at timestamptz not null default now()
);

create unique index if not exists scoring_weights_one_active
  on public.scoring_weights(active)
  where active = true;

-- 3. Горячие нарративы. Можно править руками или из калибратора.
create table if not exists public.narrative_state (
  id uuid primary key default gen_random_uuid(),
  tag text unique not null,
  weight numeric not null default 1.0,   -- мультипликатор внутри Narrative score
  hot boolean not null default true,
  source text,                           -- 'manual' | 'auto'
  updated_at timestamptz not null default now()
);

-- 4. Сырые сигналы из скрейперов. Twitter, Discord, RSS — всё сюда.
-- Шаг "filter BEFORE AI" применяется при вставке (на стороне скрипта).
create table if not exists public.raw_signals (
  id uuid primary key default gen_random_uuid(),
  source text not null,                  -- 'twitter' | 'discord' | 'rss' | 'manual'
  external_id text,                      -- id поста/сообщения
  author text,
  content text not null,
  url text,
  matched_keywords text[] default '{}',
  matched_projects text[] default '{}',  -- какие проекты упомянуты (по slug)
  importance int default 5,              -- 1-10, ставит фильтр
  collected_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(source, external_id)
);

create index if not exists raw_signals_collected_idx on public.raw_signals(collected_at desc);
create index if not exists raw_signals_processed_idx on public.raw_signals(processed_at);
