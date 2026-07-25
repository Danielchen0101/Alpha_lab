create table if not exists public.user_kalshi_market_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  environment text not null check (environment in ('paper', 'real')),
  ticker text not null,
  observation_key text not null,
  observed_at timestamptz not null,
  action text not null,
  side text,
  execution_intent text,
  signal_quality integer,
  seconds_to_close integer,
  model_yes_probability numeric,
  fair_yes_probability numeric,
  executable_price numeric,
  net_edge numeric,
  conservative_edge numeric,
  spread numeric,
  book_imbalance numeric,
  blocked_reasons text[] not null default '{}',
  features jsonb not null default '{}'::jsonb,
  order_result jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, environment, observation_key)
);

create index if not exists user_kalshi_market_observations_user_time_idx
  on public.user_kalshi_market_observations (user_id, observed_at desc);

create index if not exists user_kalshi_market_observations_ticker_time_idx
  on public.user_kalshi_market_observations (ticker, observed_at desc);

alter table public.user_kalshi_market_observations enable row level security;

drop policy if exists "Users read own Kalshi observations"
  on public.user_kalshi_market_observations;

create policy "Users read own Kalshi observations"
  on public.user_kalshi_market_observations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.user_kalshi_market_observations from anon;
revoke all on table public.user_kalshi_market_observations from authenticated;
grant select on table public.user_kalshi_market_observations to authenticated;
grant all on table public.user_kalshi_market_observations to service_role;

create or replace function public.claim_app_worker_lease(
  p_lease_name text,
  p_owner_id text,
  p_ttl_seconds integer default 20,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claimed_owner text;
begin
  if nullif(trim(p_lease_name), '') is null or nullif(trim(p_owner_id), '') is null then
    raise exception 'lease name and owner are required';
  end if;

  insert into public.app_worker_leases (
    lease_name, owner_id, acquired_at, heartbeat_at,
    lease_expires_at, metadata, version, updated_at
  )
  values (
    p_lease_name, p_owner_id, now(), now(),
    now() + make_interval(secs => greatest(5, least(p_ttl_seconds, 300))),
    coalesce(p_metadata, '{}'::jsonb), 1, now()
  )
  on conflict (lease_name) do update
  set owner_id = excluded.owner_id,
      acquired_at = case
        when app_worker_leases.owner_id = excluded.owner_id
          then app_worker_leases.acquired_at
        else now()
      end,
      heartbeat_at = now(),
      lease_expires_at = excluded.lease_expires_at,
      metadata = excluded.metadata,
      version = app_worker_leases.version + 1,
      updated_at = now()
  where app_worker_leases.owner_id = excluded.owner_id
     or app_worker_leases.lease_expires_at <= now()
  returning owner_id into claimed_owner;

  return coalesce(claimed_owner = p_owner_id, false);
end;
$$;

revoke all on function public.claim_app_worker_lease(text, text, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.claim_app_worker_lease(text, text, integer, jsonb)
  to service_role;
