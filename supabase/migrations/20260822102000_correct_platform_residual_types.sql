update public.platforms
set residual_type = case
  when regexp_replace(lower(name), '[^a-z0-9]+', ' ', 'g') ~
    '(diamond payments|ellacash|ella cash|greenway pob|greenway pps|mtxe|tfi|paynex)'
    then 'pob'
  else 'cc'
end;
