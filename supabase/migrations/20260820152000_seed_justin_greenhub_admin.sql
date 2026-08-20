do $$
begin
  if exists (
    select 1
    from public.agent_profiles
    where lower(email) = 'justin@greenhub.io'
  ) then
    update public.agent_profiles
    set
      name = coalesce(nullif(name, ''), 'Justin Brewer'),
      role = 'admin',
      status = 'active',
      commission_rate = coalesce(commission_rate, 0),
      commission_notes = coalesce(commission_notes, 'GreenHub super admin access.'),
      updated_at = now()
    where lower(email) = 'justin@greenhub.io';
  else
    insert into public.agent_profiles (
      name,
      email,
      role,
      status,
      commission_rate,
      commission_notes
    )
    values (
      'Justin Brewer',
      'justin@greenhub.io',
      'admin',
      'active',
      0,
      'GreenHub super admin access.'
    );
  end if;
end $$;
