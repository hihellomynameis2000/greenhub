alter table public.residual_notifications
  add column if not exists residual_id uuid references public.monthly_residuals(id) on delete set null,
  add column if not exists notification_type text not null default 'residual_finalized',
  add column if not exists title text,
  add column if not exists message text,
  add column if not exists read_at timestamptz;

create index if not exists residual_notifications_agent_created_idx
  on public.residual_notifications (agent_id, created_at desc);

create index if not exists residual_notifications_unread_idx
  on public.residual_notifications (agent_id, read_at)
  where read_at is null;
