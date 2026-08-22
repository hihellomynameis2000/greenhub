alter table public.monthly_residuals
  add column if not exists pos_integration_fee numeric(12, 4) not null default 0;
