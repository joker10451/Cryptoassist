-- Реферальная система: ссылки на проектах + лог опубликованных постов.

alter table public.projects
  add column if not exists referral_url text,
  add column if not exists referral_code text,
  add column if not exists referral_notes text;

create table if not exists public.referral_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  template text not null,                  -- 'alpha_drop' | 'fomo_proof' | 'philosophy' | 'thread'
  body text not null,                      -- готовый текст поста
  ref_url text,
  status text not null default 'draft',    -- draft | published | scheduled
  scheduled_at timestamptz,
  published_at timestamptz,
  external_id text,                        -- id твита, если будем потом цеплять
  metrics jsonb,                           -- лайки/репосты/клики (на будущее)
  created_at timestamptz not null default now()
);

create index if not exists referral_posts_project_idx on public.referral_posts(project_id);
create index if not exists referral_posts_status_idx on public.referral_posts(status, scheduled_at);
