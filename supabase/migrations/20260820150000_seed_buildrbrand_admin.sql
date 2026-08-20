do $$
begin
  if exists (
    select 1
    from public.agent_profiles
    where lower(email) = 'nik@buildrbrand.com'
  ) then
    update public.agent_profiles
    set
      name = coalesce(nullif(name, ''), 'Nik BuildrBrand'),
      role = 'admin',
      status = 'active',
      commission_rate = coalesce(commission_rate, 0),
      commission_notes = coalesce(commission_notes, 'BuildrBrand super admin testing access.'),
      updated_at = now()
    where lower(email) = 'nik@buildrbrand.com';
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
      'Nik BuildrBrand',
      'nik@buildrbrand.com',
      'admin',
      'active',
      0,
      'BuildrBrand super admin testing access.'
    );
  end if;
end $$;

