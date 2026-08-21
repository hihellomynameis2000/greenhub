update public.platform_resource_folders
set
  is_active = false,
  updated_at = now()
where folder_key = 'agent-buy-rate';

update public.agent_platform_access
set
  can_view = false,
  updated_at = now()
where folder_id in (
  select id
  from public.platform_resource_folders
  where folder_key = 'agent-buy-rate'
);
