-- Historique privé de l'observatoire. A appliquer une seule fois dans le SQL Editor Supabase.
create extension if not exists pgcrypto;

create table if not exists public.world_pulse_history_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  generated_at timestamptz not null,
  collected_at timestamptz not null,
  state text not null check (state = 'ok'),
  cache_status text not null,
  article_count integer not null check (article_count >= 0),
  localized_count integer not null check (localized_count >= 0),
  localization_rate numeric(5,2) not null check (localization_rate >= 0 and localization_rate <= 100),
  media_count integer not null check (media_count >= 0),
  source_count integer not null check (source_count >= 0),
  source_health jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.world_pulse_history_articles (
  run_id uuid not null references public.world_pulse_history_runs(id) on delete cascade,
  article_key text not null,
  article_url text,
  title text not null,
  media_name text not null,
  domain text,
  source_country text,
  source_region text,
  language text,
  seen_at timestamptz,
  event_country text,
  event_country_iso text,
  category text not null,
  category_type text not null,
  confidence numeric(5,2) not null default 0,
  localized boolean not null default false,
  observed_at timestamptz not null,
  primary key (run_id, article_key)
);

create index if not exists world_pulse_history_articles_observed_at_idx on public.world_pulse_history_articles(observed_at desc);
create index if not exists world_pulse_history_articles_url_idx on public.world_pulse_history_articles(article_url);

create table if not exists public.world_pulse_history_signals (
  run_id uuid not null references public.world_pulse_history_runs(id) on delete cascade,
  event_country_iso text not null default 'UNLOCALIZED',
  event_country text not null,
  category text not null,
  category_type text not null,
  localized boolean not null default false,
  article_count integer not null check (article_count >= 0),
  observed_at timestamptz not null,
  primary key (run_id, event_country_iso, event_country, category, category_type)
);

create table if not exists public.world_pulse_history_sources (
  run_id uuid not null references public.world_pulse_history_runs(id) on delete cascade,
  source_name text not null,
  region text,
  source_url text,
  http_status integer,
  state text not null,
  article_count integer not null default 0,
  recent boolean not null default false,
  checked_at timestamptz not null,
  primary key (run_id, source_name)
);

create table if not exists public.world_pulse_history_briefs (
  slug text primary key,
  status text not null check (status = 'published'),
  git_sha text not null,
  deployment_url text not null,
  period_start timestamptz,
  period_end timestamptz,
  article_count integer not null default 0,
  localization_rate numeric(5,2) not null default 0,
  published_at timestamptz not null,
  audited_at timestamptz not null default now()
);

alter table public.world_pulse_history_runs enable row level security;
alter table public.world_pulse_history_articles enable row level security;
alter table public.world_pulse_history_signals enable row level security;
alter table public.world_pulse_history_sources enable row level security;
alter table public.world_pulse_history_briefs enable row level security;

-- Cette fonction ne retourne que des agrégats et une sélection courte d'URL déjà publiques.
create or replace function public.world_pulse_history_summary(
  p_from timestamptz,
  p_to timestamptz,
  p_article_limit integer default 160
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with latest_articles as (
    select distinct on (article_key)
      article_key, article_url, title, media_name, domain, source_country, source_region,
      language, seen_at, event_country, event_country_iso, category, category_type,
      confidence, localized, observed_at
    from public.world_pulse_history_articles
    where observed_at >= p_from and observed_at < p_to
    order by article_key, observed_at desc
  ),
  runs as (
    select * from public.world_pulse_history_runs
    where collected_at >= p_from and collected_at < p_to and state = 'ok'
  ),
  country_rows as (
    select event_country, event_country_iso, count(*)::integer as count
    from latest_articles
    where localized
    group by event_country, event_country_iso
    order by count desc, event_country asc
    limit 12
  ),
  category_rows as (
    select category, count(*)::integer as count
    from latest_articles
    where category_type = 'registre déterministe'
    group by category
    order by count desc, category asc
    limit 10
  ),
  source_rows as (
    select source_name, max(region) as region,
      count(distinct run_id) filter (where state = 'OK')::integer as healthy_runs,
      max(checked_at) as last_checked_at
    from public.world_pulse_history_sources
    where checked_at >= p_from and checked_at < p_to
    group by source_name
    order by healthy_runs desc, source_name asc
    limit 60
  ),
  sample_rows as (
    select title, article_url, media_name, source_country, event_country, event_country_iso,
      category, category_type, confidence, seen_at, observed_at
    from latest_articles
    where article_url is not null
    order by coalesce(seen_at, observed_at) desc
    limit greatest(20, least(p_article_limit, 250))
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'runs', (select count(*)::integer from runs),
    'uniqueArticles', (select count(*)::integer from latest_articles),
    'localizedArticles', (select count(*)::integer from latest_articles where localized),
    'localizationRate', coalesce((select round(100.0 * count(*) filter (where localized) / nullif(count(*), 0), 2) from latest_articles), 0),
    'activeSources', (select count(*)::integer from source_rows where healthy_runs > 0),
    'topCountries', coalesce((select jsonb_agg(jsonb_build_object('country', event_country, 'iso', event_country_iso, 'count', count)) from country_rows), '[]'::jsonb),
    'topCategories', coalesce((select jsonb_agg(jsonb_build_object('category', category, 'count', count)) from category_rows), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('name', source_name, 'region', region, 'healthyRuns', healthy_runs, 'lastCheckedAt', last_checked_at)) from source_rows), '[]'::jsonb),
    'articleSamples', coalesce((select jsonb_agg(jsonb_build_object('title', title, 'url', article_url, 'media', media_name, 'sourceCountry', source_country, 'eventCountry', event_country, 'eventCountryIso', event_country_iso, 'category', category, 'categoryType', category_type, 'confidence', confidence, 'seenAt', seen_at, 'observedAt', observed_at)) from sample_rows), '[]'::jsonb)
  );
$$;

revoke all on function public.world_pulse_history_summary(timestamptz, timestamptz, integer) from public;
grant execute on function public.world_pulse_history_summary(timestamptz, timestamptz, integer) to service_role;
