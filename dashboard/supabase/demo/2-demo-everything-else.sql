-- emet class demo, part 2: example data in every section. Everything is tagged [DEMO] (or slug demo-*).
begin;
alter table public.card_assignees disable trigger notify_assigned;
alter table public.team_task_people disable trigger notify_team_task;
do $$
declare
  me uuid := (select id from profiles where email = 'alvaroibavaz@gmail.com');
  b record; l_todo uuid; l_doing uuid; l_done uuid; c uuid; i int; tt uuid; ci uuid; lk uuid;
  titles text[][] := array[
    array['Plan the Friday stall rota','Check this week''s on-time rate','Prepare leaders'' meeting agenda'],
    array['Close the October books','Count stock after the stall','Price the new hoodie run'],
    array['Call back the café in Deusto','Answer 3 open DMs about sizes','Follow up the student union'],
    array['Film 2 reels at the stall','Write captions for the hoodie drop','Design the campus poster'],
    array['Send the weekly team update','Run the morale check-in','Book the room for Thursday']];
  slugs text[] := array['team-leader','finance','customer','marketing','communications'];
begin
  -- Tasks on every team board (assigned only to Alvaro), a mix of done, doing, to do and one late
  for k in 1..5 loop
    select bo.id into b from boards bo join groups g on g.id = bo.group_id where g.slug = slugs[k];
    select id into l_todo from board_lists where board_id = b.id and name = 'To do';
    select id into l_doing from board_lists where board_id = b.id and name = 'Doing';
    select id into l_done from board_lists where board_id = b.id and name = 'Done';
    for i in 1..3 loop
      insert into cards (board_id, list_id, title, due_at, completed_at, position)
      values (b.id, case i when 1 then l_done when 2 then l_doing else l_todo end, '[DEMO] ' || titles[k][i],
              now() + make_interval(days => case i when 1 then -2 when 2 then 2 else (case when k = 3 then -1 else 4 end) end),
              case when i = 1 then now() - interval '3 days' end, i)
      returning id into c;
      insert into card_assignees (card_id, user_id) values (c, me);
    end loop;
  end loop;

  -- A team task from the leader to everyone, already ticked by about half the team (no due date, no notifications)
  insert into team_tasks (title, details, created_by) values ('[DEMO] Share the stall post on your story', 'Example task for the class demo', me) returning id into tt;
  insert into team_task_people (task_id, user_id, done_at)
  select tt, p.id, case when row_number() over (order by p.full_name) % 2 = 0 then now() - interval '5 hours' end from profiles p where p.active;

  -- Team Leader: blockers and decisions
  insert into blockers (group_id, description, owner_id, status) values
    ((select id from groups where slug='marketing'), '[DEMO] Waiting for the hoodie photos from the printer', me, 'open'),
    ((select id from groups where slug='finance'), '[DEMO] Card reader for the stall not set up yet', me, 'open');
  insert into decisions (date, decision, decided_by, group_id) values
    (current_date - 1, '[DEMO] Hoodies stay at €45; tote bags drop to €20 on stall days', 'Leaders', null),
    (current_date - 3, '[DEMO] Stall every Friday 12:00–15:00 at the main campus', 'Leaders', null),
    (current_date - 6, '[DEMO] Instagram first, TikTok twice a week', 'Marketing', (select id from groups where slug='marketing'));

  -- Customer: prospects and customer problems
  insert into prospects (name, contact, stage, owner_id) values
    ('[DEMO] Café Deusto', 'Instagram DM', 'interested', me), ('[DEMO] Student union shop', 'email', 'contacted', me),
    ('[DEMO] Bilbao surf club', 'WhatsApp', 'new', me), ('[DEMO] Erasmus association', 'in person', 'won', me);
  insert into complaints (customer, issue, status, owner_id, opened_at) values
    ('[DEMO] Ane', 'Hoodie size M runs small', 'open', me, now() - interval '1 day'),
    ('[DEMO] Jon', 'Tote bag strap came loose', 'resolved', me, now() - interval '4 days');

  -- Finance: stock (one running low)
  insert into inventory (product, stock, unit_cost, price, low_stock) values
    ('[DEMO] Tote bag', 34, 10.5, 25, 10), ('[DEMO] Hoodie', 6, 19, 45, 8), ('[DEMO] T-shirt', 22, 12.6, 30, 8),
    ('[DEMO] Cap', 15, 8.4, 20, 5), ('[DEMO] Sticker pack', 120, 3.4, 8, 30);

  -- Marketing: posted content with views, DMs, and a tracked link with clicks
  for i in 1..6 loop
    insert into content_items (platform, title, status, posted_at, owner_id, tags)
    values (case when i % 3 = 0 then 'tiktok' else 'instagram' end,
            '[DEMO] ' || (array['Stall day reel','Hoodie drop carousel','Behind the print','Campus poster story','Customer of the week','How we started'])[i],
            'posted', now() - make_interval(days => i * 2), me,
            jsonb_build_object('format', (array['reel','carousel','reel','story','photo','reel'])[i], 'hook_message', (array['price','product','story','event','people','story'])[i]))
    returning id into ci;
    insert into content_metrics (content_id, age_hours, views, reach, likes, comments, saves, shares, follows, link_clicks, source)
    values (ci, 168, 900 + i * 430, 700 + i * 300, 80 + i * 22, 6 + i * 2, 10 + i * 4, 5 + i * 3, 3 + i, 12 + i * 3, 'manual');
  end loop;
  insert into inquiries (platform, handle, product, date, owner_id)
  select (array['instagram','tiktok','whatsapp'])[1 + g % 3], '[DEMO] @customer' || g, (array['Hoodie','Tote bag','T-shirt'])[1 + g % 3], current_date - (g % 7), me
  from generate_series(1, 14) g;
  update inquiries set converted_sale_id = (select id from sales where description like '[DEMO]%' order by date desc limit 1)
   where handle in ('[DEMO] @customer1','[DEMO] @customer4','[DEMO] @customer7','[DEMO] @customer10');
  insert into go_links (slug, destination, label, utm_source, created_by) values ('demo-stall', 'https://instagram.com', '[DEMO] Stall link in bio', 'instagram', me) returning id into lk;
  insert into go_clicks (link_id, at, device) select lk, now() - make_interval(hours => g * 5), 'mobile' from generate_series(1, 40) g;

  -- Communications: morale check-ins this week and last week
  insert into morale_checks (week_start, user_id, score, comment)
  select date_trunc('week', current_date)::date - (w * 7), p.id, 3 + ((row_number() over () + w) % 3)::int, '[DEMO]'
  from profiles p, generate_series(0, 1) w where p.active
  on conflict (week_start, user_id) do nothing;
end $$;
alter table public.card_assignees enable trigger notify_assigned;
alter table public.team_task_people enable trigger notify_team_task;
commit;
