alter table public.agent_profiles
  add column if not exists commission_notes text;

alter table public.monthly_residuals
  add column if not exists greenhub_pob_buy_rate numeric(12, 4) not null default 0,
  add column if not exists agent_commission_structure text,
  add column if not exists greenhub_pob_profit_per_transaction numeric(12, 4) not null default 0,
  add column if not exists greenhub_pob_net_profit numeric(12, 2) not null default 0,
  add column if not exists merchant_notes text;

create index if not exists monthly_residuals_agent_period_idx
  on public.monthly_residuals (agent_id, residual_year desc, residual_month desc);

create index if not exists monthly_residuals_platform_idx
  on public.monthly_residuals (platform_id);
