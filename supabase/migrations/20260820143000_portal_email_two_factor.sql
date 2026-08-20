create extension if not exists pgcrypto;

create table if not exists public.portal_login_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  agent_profile_id uuid references public.agent_profiles(id) on delete cascade,
  email text not null,
  code_hash text not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists portal_login_challenges_user_created_idx
  on public.portal_login_challenges (user_id, created_at desc);

create index if not exists portal_login_challenges_active_idx
  on public.portal_login_challenges (user_id, expires_at desc)
  where consumed_at is null;

