alter table public.platforms
  add column if not exists residual_type text not null default 'cc';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'platforms_residual_type_check'
      and conrelid = 'public.platforms'::regclass
  ) then
    alter table public.platforms
      add constraint platforms_residual_type_check
      check (residual_type in ('cc', 'pob'));
  end if;
end $$;

update public.platforms
set residual_type = 'pob'
where regexp_replace(lower(name), '[^a-z0-9]+', ' ', 'g') ~
  '(diamond payments|ellacash|ella cash|greenway pob|greenway pps|mtxe|tfi|paynex)';

update public.platforms
set residual_type = 'cc'
where residual_type is null;

create index if not exists platforms_residual_type_idx
  on public.platforms (residual_type);
