alter table public.residual_merchant_accounts
  add column if not exists primary_agent_split numeric(5, 2) not null default 100,
  add column if not exists secondary_agent_id uuid references public.agent_profiles(id) on delete set null,
  add column if not exists secondary_agent_split numeric(5, 2) not null default 0;

create index if not exists residual_merchant_accounts_secondary_agent_idx
  on public.residual_merchant_accounts (secondary_agent_id);

update public.residual_merchant_accounts
set
  primary_agent_split = coalesce(primary_agent_split, 100),
  secondary_agent_split = coalesce(secondary_agent_split, 0);
