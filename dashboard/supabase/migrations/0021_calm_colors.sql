-- Rebuild: calmer team colours that sit well on the light workspace.
update public.groups set color = case slug
  when 'team-leader'    then '#6366F1'
  when 'finance'        then '#10B981'
  when 'customer'       then '#0EA5E9'
  when 'marketing'      then '#F43F5E'
  when 'communications' then '#F59E0B'
  else color end;
