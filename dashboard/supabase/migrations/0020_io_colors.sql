-- "I/O" redesign: teams take Google's colours (Team leader purple, Finance green, Customer blue, Marketing red, Communications yellow).
update public.groups set color = case slug
  when 'team-leader'    then '#A142F4'
  when 'finance'        then '#34A853'
  when 'customer'       then '#4285F4'
  when 'marketing'      then '#EA4335'
  when 'communications' then '#F9AB00'
  else color end;
