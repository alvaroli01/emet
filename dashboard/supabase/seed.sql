-- emet HQ — starting data
-- 5 groups, 6 boards (To do / Doing / Review / Done), 15 members, KPI targets from README section 4.
--
-- Members start with NO group and NO role: the team hasn't decided yet.
-- Emails are placeholders (@emet.invalid) — replace each with the real email before inviting
-- (Team page, or: update profiles set email = 'real@mail.com' where full_name = 'Stefan';)
--
-- Alvaro (repo owner) starts as admin so someone can invite the others and assign groups.
-- Once Team Leaders are chosen they become admins automatically; Alvaro's flag can then be removed.
-- Self/peer review data from docs/team-profiles.md is deliberately NOT imported.

insert into public.groups (slug, name, emoji, color, position) values
  ('team-leader',    'Team Leader',    '👑', '#7C5CFC', 1),
  ('finance',        'Finance',        '💰', '#10B981', 2),
  ('customer',       'Customer',       '🤝', '#0EA5E9', 3),
  ('marketing',      'Marketing',      '📣', '#F43F5E', 4),
  ('communications', 'Communications', '🗂️', '#F59E0B', 5);

insert into public.boards (slug, name, group_id) values ('general', 'emet', null);
insert into public.boards (slug, name, group_id)
  select slug, name, id from public.groups;

insert into public.board_lists (board_id, name, position)
  select b.id, l.name, l.pos
    from public.boards b
   cross join (values ('To do', 1), ('Doing', 2), ('Review', 3), ('Done', 4)) as l(name, pos);

insert into public.profiles (full_name, email, is_admin) values
  ('Alvaro',    'alvaro@emet.invalid',    true),
  ('Stefan',    'stefan@emet.invalid',    false),
  ('Rocco',     'rocco@emet.invalid',     false),
  ('Fran',      'fran@emet.invalid',      false),
  ('Zayd',      'zayd@emet.invalid',      false),
  ('Nico',      'nico@emet.invalid',      false),
  ('Nahuel',    'nahuel@emet.invalid',    false),
  ('Emily',     'emily@emet.invalid',     false),
  ('Elizabeth', 'elizabeth@emet.invalid', false),
  ('Lassi',     'lassi@emet.invalid',     false),
  ('Mario',     'mario@emet.invalid',     false),
  ('Martin',    'martin@emet.invalid',    false),
  ('Fernando',  'fernando@emet.invalid',  false),
  ('Sasha',     'sasha@emet.invalid',     false),
  ('Mirage',    'mirage@emet.invalid',    false);

-- KPI targets (null target = still TBD; each group can edit its own)
insert into public.kpi_targets (group_id, role_title, metric, target, unit, period)
select public.group_id_of(g), r, m, t, u, p from (values
  ('team-leader',    'Team leader',          'Revenue',                          30000, '€',     'total'),
  ('team-leader',    'Team leader',          'Profit',                           15000, '€',     'total'),
  ('team-leader',    'Team leader',          'On-time task rate',                   85, '%',     'total'),
  ('team-leader',    'Operations monitor',   'Group check-ins',                      5, 'count', 'day'),
  ('finance',        'Financial leader',     'Profit margin',                       50, '%',     'total'),
  ('finance',        'Bookkeeper',           'Entries logged within 24h',          100, '%',     'week'),
  ('customer',       'Customer leader',      'Complaints resolved within 48h',     100, '%',     'week'),
  ('customer',       'Sales rep',            'New prospects per rep',               20, 'count', 'week'),
  ('customer',       'Sales rep',            'Personal sales target',             null, '€',     'month'),
  ('marketing',      'Marketing leader',     'Leads generated',                   null, 'count', 'week'),
  ('marketing',      'Social media manager', 'Follower growth',                   null, 'count', 'week'),
  ('marketing',      'Editor & designer',    'Design turnaround',                   48, 'h',     'total'),
  ('communications', 'Project manager',      'Friday scorecard published',           1, 'count', 'week'),
  ('communications', 'Documentation & wellness', 'Team morale average',              4, '/5',    'week')
) as v(g, r, m, t, u, p);
