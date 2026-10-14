-- "Studio" redesign: each team gets a brighter tint (used for its tiles, nav dot and hero).
update public.groups set color = case slug
  when 'team-leader'    then '#5B4BFF'
  when 'finance'        then '#18C29C'
  when 'customer'       then '#2E9BFF'
  when 'marketing'      then '#FF7A59'
  when 'communications' then '#F5A524'
  else color end;
