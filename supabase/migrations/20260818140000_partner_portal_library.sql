create extension if not exists pgcrypto;

create table if not exists public.platform_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.platforms
  add column if not exists slug text,
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists portal_status text not null default 'active',
  add column if not exists last_updated_at timestamptz not null default now(),
  add column if not exists sort_order integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'platforms_portal_status_check'
      and conrelid = 'public.platforms'::regclass
  ) then
    alter table public.platforms
      add constraint platforms_portal_status_check
      check (portal_status in ('active', 'limited', 'restricted'));
  end if;
end $$;

with slugged as (
  select
    id,
    regexp_replace(
      regexp_replace(trim(lower(name)), '[^a-z0-9]+', '-', 'g'),
      '(^-|-$)',
      '',
      'g'
    ) as base_slug
  from public.platforms
  where slug is null or slug = ''
),
numbered as (
  select
    id,
    coalesce(nullif(base_slug, ''), 'platform') as base_slug,
    row_number() over (partition by coalesce(nullif(base_slug, ''), 'platform') order by id) as duplicate_number
  from slugged
)
update public.platforms p
set slug = case
  when n.duplicate_number = 1 then n.base_slug
  else n.base_slug || '-' || left(p.id::text, 8)
end
from numbered n
where p.id = n.id;

create unique index if not exists platforms_slug_unique_idx
  on public.platforms (slug);

create index if not exists platforms_category_idx
  on public.platforms (category);

create table if not exists public.platform_resource_folders (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.platforms(id) on delete cascade,
  folder_key text not null,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(platform_id, folder_key)
);

create index if not exists platform_resource_folders_platform_idx
  on public.platform_resource_folders (platform_id, sort_order, name);

create table if not exists public.platform_resources (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.platforms(id) on delete cascade,
  folder_id uuid not null references public.platform_resource_folders(id) on delete cascade,
  title text not null,
  description text,
  resource_type text not null default 'document',
  external_url text,
  storage_bucket text,
  storage_path text,
  file_name text,
  file_size bigint,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.agent_profiles(id) on delete set null,
  updated_by uuid references public.agent_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (resource_type in ('document', 'link', 'note'))
);

create index if not exists platform_resources_folder_idx
  on public.platform_resources (folder_id, sort_order, title);

create index if not exists platform_resources_platform_idx
  on public.platform_resources (platform_id);

create table if not exists public.agent_platform_access (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_profiles(id) on delete cascade,
  platform_id uuid not null references public.platforms(id) on delete cascade,
  folder_id uuid not null references public.platform_resource_folders(id) on delete cascade,
  can_view boolean not null default true,
  created_by uuid references public.agent_profiles(id) on delete set null,
  updated_by uuid references public.agent_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(agent_id, folder_id)
);

create index if not exists agent_platform_access_agent_idx
  on public.agent_platform_access (agent_id, platform_id);

create table if not exists public.platform_updates (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid references public.platforms(id) on delete set null,
  title text not null,
  message text not null,
  audience text not null default 'all',
  created_by uuid references public.agent_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  check (audience in ('all', 'admin', 'agent'))
);

create index if not exists platform_updates_created_idx
  on public.platform_updates (created_at desc);

create table if not exists public.portal_deals (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_profiles(id) on delete cascade,
  platform_id uuid references public.platforms(id) on delete set null,
  merchant_application_id uuid references public.merchant_applications(id) on delete set null,
  merchant_name text not null,
  contact_name text,
  contact_email text,
  estimated_volume numeric(12, 2) not null default 0,
  priority text not null default 'standard',
  stage text not null default 'new_lead',
  last_activity text,
  next_follow_up text,
  notes text,
  salesforce_status text,
  created_by uuid references public.agent_profiles(id) on delete set null,
  updated_by uuid references public.agent_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (priority in ('standard', 'high', 'escalated')),
  check (stage in ('new_lead', 'contacted', 'application_sent', 'submitted', 'approved', 'declined'))
);

create index if not exists portal_deals_agent_idx
  on public.portal_deals (agent_id, updated_at desc);

create index if not exists portal_deals_stage_idx
  on public.portal_deals (stage);

insert into public.platform_categories (name, sort_order)
values
  ('Best Rate', 10),
  ('ElitePay', 20),
  ('Cashless / Debit', 30),
  ('ACH / Alt Pay', 40),
  ('High Risk', 50),
  ('Paybotx', 60),
  ('Valmar', 70),
  ('Other', 100)
on conflict (name) do update
set sort_order = excluded.sort_order;

insert into public.platforms (name, slug, category, description, portal_status, is_active, sort_order)
values
  ('Greenway - PPS', 'greenway-pps', 'Cashless / Debit', 'Cashless processing program with PPS submission docs and boarding support.', 'active', true, 10),
  ('Greenway - POB', 'greenway-pob', 'Cashless / Debit', 'GreenHub POB placement option with buy-rate notes and program guidance.', 'active', true, 11),
  ('Linked2Pay - Avidia', 'linked2pay-avida', 'ACH / Alt Pay', 'ACH and alternative payment program for qualified merchants.', 'active', true, 20),
  ('Paynex', 'paynex', 'High Risk', 'High-risk placement option with current Paynex program notes and support contacts.', 'active', true, 30),
  ('EllaCash', 'ellacash', 'Cashless / Debit', 'Cash discount and debit-focused program for retail merchant opportunities.', 'active', true, 40),
  ('Best Rate - Nuvei', 'best-rate-nuvei', 'Best Rate', 'Best Rate placement option for qualified merchants requiring Nuvei support.', 'limited', true, 50),
  ('Best Rate - Paya', 'best-rate-paya', 'Best Rate', 'Paya-backed Best Rate placement with standard Schedule A package.', 'active', true, 51),
  ('ElitePay - Adyen', 'elitepay-adyen', 'ElitePay', 'ElitePay Adyen program package for agents submitting qualified merchants.', 'active', true, 60),
  ('ElitePay - AUX', 'elitepay-aux', 'ElitePay', 'ElitePay AUX program resources and submission packet.', 'active', true, 61),
  ('Paybotx - Fiserv', 'paybotx-fiserv', 'Paybotx', 'Paybotx Fiserv processing program with current boarding files.', 'active', true, 70),
  ('Paybotx - SSB', 'paybotx-ssb', 'Paybotx', 'Paybotx SSB program resources and boarding notes.', 'active', true, 71),
  ('Paybotx - T1', 'paybotx-t1', 'Paybotx', 'Paybotx T1 program resources and boarding notes.', 'active', true, 72),
  ('Valmar - CB Cal', 'valmar-cb-cal', 'Valmar', 'Restricted Valmar placement with approval required before submission.', 'restricted', true, 80)
on conflict (slug) do update
set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  portal_status = excluded.portal_status,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  last_updated_at = now();

with folder_template(folder_key, name, description, sort_order) as (
  values
    ('application', 'Application', 'Application packets and required merchant intake materials.', 20),
    ('contacts', 'Contacts', 'Underwriting, boarding, and escalation contacts for this platform.', 30),
    ('documents', 'Documents', 'Program PDFs, risk files, pricing sheets, and partner documents.', 40),
    ('how-to-submit', 'How to Submit', 'Step-by-step submission guidance and approval expectations.', 50),
    ('marketing-material', 'Marketing Material', 'Agent-facing sales assets and approved merchant positioning.', 60),
    ('program-details', 'Program Details', 'Rules, risk notes, supported industries, and operational policies.', 70),
    ('schedule-a', 'Schedule A', 'Schedule A files and agreement addenda used during boarding.', 80)
)
insert into public.platform_resource_folders (platform_id, folder_key, name, description, sort_order)
select p.id, f.folder_key, f.name, f.description, f.sort_order
from public.platforms p
cross join folder_template f
where p.is_active = true
on conflict (platform_id, folder_key) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

insert into storage.buckets (id, name, public)
values ('platform-resources', 'platform-resources', false)
on conflict (id) do nothing;
