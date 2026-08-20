insert into public.agent_platform_access (
  agent_id,
  platform_id,
  folder_id,
  can_view
)
select
  a.id as agent_id,
  p.id as platform_id,
  f.id as folder_id,
  case
    when p.portal_status = 'restricted' then false
    when f.folder_key = 'schedule-a' then false
    else true
  end as can_view
from public.agent_profiles a
cross join public.platforms p
join public.platform_resource_folders f
  on f.platform_id = p.id
where
  a.role = 'agent'
  and a.status = 'active'
  and p.is_active = true
  and f.is_active = true
on conflict (agent_id, folder_id) do update
set
  platform_id = excluded.platform_id,
  can_view = excluded.can_view,
  updated_at = now();
