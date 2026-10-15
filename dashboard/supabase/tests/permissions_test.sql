-- Permission tests: log in as different members and check what the DATABASE allows.
-- Run with: bash supabase/tests/run-local.sh   (needs a local Postgres 15+)
\set ON_ERROR_STOP on
set client_min_messages = notice;

-- ── Test helpers ────────────────────────────────────────────
create schema t;
grant usage on schema t to authenticated, anon;

-- Runs a statement and reports PASS/FAIL against the expected outcome.
-- 'denied' = raised an error OR touched 0 rows (RLS silently hides rows on update/delete).
create function t.check(label text, stmt text, expected text) returns void
language plpgsql as $$
declare n bigint; outcome text; err text := '';
begin
  begin
    execute stmt;
    get diagnostics n = row_count;
    outcome := case when n > 0 then 'ok' else 'denied' end;
  exception when others then
    outcome := 'denied'; err := ' (' || sqlerrm || ')';
  end;
  raise notice '% %  — expected %, got %', case when outcome = expected then 'PASS' else 'FAIL' end,
    label, expected, outcome || err;
end $$;
grant execute on function t.check(text, text, text) to authenticated, anon;

-- Returns a number from a query, run as the current user
create function t.num(q text) returns bigint language plpgsql as $$
declare n bigint; begin execute q into n; return n; end $$;
grant execute on function t.num(text) to authenticated, anon;

create function t.assert(label text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when ok then 'PASS' else 'FAIL' end, label; end $$;
grant execute on function t.assert(text, boolean) to authenticated, anon;

-- ── Arrange (as database owner) ─────────────────────────────
update profiles set group_id = group_id_of('finance')        where full_name = 'Stefan';
update profiles set group_id = group_id_of('marketing')      where full_name = 'Rocco';
update profiles set group_id = group_id_of('team-leader')    where full_name = 'Lassi';
update profiles set group_id = group_id_of('communications') where full_name = 'Mario';
-- Emily: no group yet. Alvaro: no group, but is_admin from the seed.

-- They log in for the first time → auth users get linked to their profiles
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, e
from (values (1,'alvaro@emet.invalid'), (2,'stefan@emet.invalid'), (3,'rocco@emet.invalid'),
             (4,'lassi@emet.invalid'),  (5,'mario@emet.invalid'),  (6,'EMILY@emet.invalid')) v(n, e);

select t.assert('first login links auth user to profile (case-insensitive email)',
  (select count(*) from profiles where user_id is not null) = 6);

select t.check('stranger not on the team list cannot sign up',
  $$insert into auth.users (email) values ('stranger@gmail.com')$$, 'denied');

-- Logs in as a member for the following statements
create function t.login(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub',
    '00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'), false)
$$;
grant execute on function t.login(int) to authenticated;
-- 1 Alvaro (admin) · 2 Stefan (Finance) · 3 Rocco (Marketing) · 4 Lassi (Team Leader) · 5 Mario (Comms) · 6 Emily (no group)

set role authenticated;

-- ── Finance data ─────────────────────────────────────────────
select t.login(2);
select t.check('Finance member logs a sale',
  $$insert into sales (description, amount, cost, logged_by) values ('First sale', 120, 50, my_profile_id())$$, 'ok');
select t.check('Finance member cannot add a marketing campaign',
  $$insert into campaigns (name) values ('Sneaky campaign')$$, 'denied');

select t.login(3);
select t.assert('Marketing member can VIEW sales', t.num('select count(*) from sales') = 1);
select t.check('Marketing member cannot log a sale',
  $$insert into sales (description, amount) values ('Fake', 999)$$, 'denied');
select t.check('Marketing member cannot change a sale',
  $$update sales set amount = 1$$, 'denied');
select t.check('Marketing member cannot delete a sale',
  $$delete from sales$$, 'denied');
select t.check('Marketing member adds a campaign',
  $$insert into campaigns (name, product) values ('Launch', 'TBD')$$, 'ok');
select t.check('Marketing member can still REQUEST a design (any member can)',
  $$insert into design_requests (title, requested_by) values ('Logo', my_profile_id())$$, 'ok');

select t.login(4);
select t.check('Team Leader (admin) edits Marketing data',
  $$update campaigns set notes = 'Approved'$$, 'ok');
select t.check('Team Leader (admin) edits Finance data',
  $$update sales set channel = 'Instagram'$$, 'ok');

select t.login(1);
select t.check('is_admin member (Alvaro) logs an expense',
  $$insert into expenses (description, amount, logged_by) values ('Printing', 15, my_profile_id())$$, 'ok');

select t.login(6);
select t.check('Member with no group cannot add a blocker to Finance',
  $$insert into blockers (group_id, description) values (group_id_of('finance'), 'x')$$, 'denied');

-- ── Task boards ──────────────────────────────────────────────
select t.login(6);
select t.check('Any member adds a card to the general board',
  $$insert into cards (board_id, list_id, title, created_by)
    select b.id, l.id, 'Book a room for brainstorm', my_profile_id()
      from boards b join board_lists l on l.board_id = b.id and l.name = 'To do' where b.slug = 'general'$$, 'ok');
select t.check('Member cannot add a card to another group''s board',
  $$insert into cards (board_id, list_id, title, created_by)
    select b.id, l.id, 'x', my_profile_id()
      from boards b join board_lists l on l.board_id = b.id and l.name = 'To do' where b.slug = 'marketing'$$, 'denied');
select t.check('Card list must belong to the same board',
  $$insert into cards (board_id, list_id, title, created_by)
    select (select id from boards where slug = 'general'), l.id, 'x', my_profile_id()
      from board_lists l join boards b on b.id = l.board_id where b.slug = 'marketing' limit 1$$, 'denied');
select t.check('Member cannot rename general board lists',
  $$update board_lists set name = 'Hacked' where board_id = (select id from boards where slug = 'general')$$, 'denied');

select t.login(3);
select t.check('Rocco cannot edit Emily''s general card',
  $$update cards set title = 'mine now' where title = 'Book a room for brainstorm'$$, 'denied');
select t.check('Rocco cannot assign himself to Emily''s card',
  $$insert into card_assignees select id, my_profile_id() from cards where title = 'Book a room for brainstorm'$$, 'denied');
select t.check('Rocco can still comment on it',
  $$insert into card_comments (card_id, author_id, body)
    select id, my_profile_id(), 'I can help' from cards where title = 'Book a room for brainstorm'$$, 'ok');

select t.login(6);
select t.check('Emily (creator) assigns Rocco',
  $$insert into card_assignees select c.id, p.id from cards c, profiles p
     where c.title = 'Book a room for brainstorm' and p.full_name = 'Rocco'$$, 'ok');
select t.check('Emily cannot edit Rocco''s comment',
  $$update card_comments set body = 'changed'$$, 'denied');

select t.login(3);
select t.check('Rocco (now assignee) moves the card to Done',
  $$update cards set list_id = (select l.id from board_lists l join boards b on b.id = l.board_id
                                 where b.slug = 'general' and l.name = 'Done')
     where title = 'Book a room for brainstorm'$$, 'ok');
select t.assert('Moving to Done stamps completed_at',
  t.num($$select count(*) from cards where title = 'Book a room for brainstorm' and completed_at is not null$$) = 1);
select t.check('Rocco adds a card to the Marketing board',
  $$insert into cards (board_id, list_id, title, created_by)
    select b.id, l.id, 'Plan launch post', my_profile_id()
      from boards b join board_lists l on l.board_id = b.id and l.name = 'To do' where b.slug = 'marketing'$$, 'ok');
select t.check('Rocco cannot move his card onto the Finance board',
  $$update cards set board_id = (select id from boards where slug = 'finance'),
                     list_id  = (select l.id from board_lists l join boards b on b.id = l.board_id
                                  where b.slug = 'finance' and l.name = 'To do')
     where title = 'Plan launch post'$$, 'denied');

select t.login(2);
select t.check('Finance member cannot edit Marketing board cards',
  $$update cards set title = 'x' where title = 'Plan launch post'$$, 'denied');
select t.check('Finance member cannot delete Marketing board cards',
  $$delete from cards where title = 'Plan launch post'$$, 'denied');

-- ── Profiles ─────────────────────────────────────────────────
select t.login(2);
select t.check('Member changes own language',
  $$update profiles set locale = 'de' where user_id = auth.uid()$$, 'ok');
select t.check('Member cannot move themselves to another group',
  $$update profiles set group_id = group_id_of('team-leader') where user_id = auth.uid()$$, 'denied');
select t.check('Member cannot make themselves admin',
  $$update profiles set is_admin = true where user_id = auth.uid()$$, 'denied');
select t.check('Member cannot edit someone else''s profile',
  $$update profiles set full_name = 'x' where full_name = 'Rocco'$$, 'denied');
select t.check('Member cannot invite people',
  $$insert into profiles (full_name, email) values ('Friend', 'friend@gmail.com')$$, 'denied');

select t.login(4);
select t.check('Team Leader assigns Emily to Customer',
  $$update profiles set group_id = group_id_of('customer'), role_title = 'Sales rep' where full_name = 'Emily'$$, 'ok');

select t.login(6);
select t.check('Emily''s new group takes effect instantly: she logs a prospect',
  $$insert into prospects (name, owner_id) values ('Local café', my_profile_id())$$, 'ok');

-- ── Morale (private comments) ────────────────────────────────
select t.login(3);
select t.check('Member submits own morale score',
  $$insert into morale_checks (week_start, user_id, score, comment)
    values (date_trunc('week', now())::date, my_profile_id(), 3, 'Tired this week')$$, 'ok');
select t.login(2);
select t.check('Member cannot submit a score for someone else',
  $$insert into morale_checks (week_start, user_id, score)
    select date_trunc('week', now())::date, id, 5 from profiles where full_name = 'Emily'$$, 'denied');
select t.assert('Finance member cannot read Rocco''s morale comment',
  t.num('select count(*) from morale_checks') = 0);
select t.assert('...but sees the anonymous weekly average',
  t.num('select count(*) from morale_weekly()') = 1);
select t.login(5);
select t.assert('Communications member can read individual morale comments',
  t.num('select count(*) from morale_checks') = 1);

-- ── Activity feed ────────────────────────────────────────────
select t.login(2);
select t.assert('Activity feed recorded the changes automatically',
  t.num('select count(*) from activity_log') >= 8);
select t.assert('Activity entry carries the right group (sale → Finance)',
  t.num($$select count(*) from activity_log where entity = 'sales' and action = 'insert'
           and group_id = group_id_of('finance')$$) = 1);
select t.check('Nobody can write fake activity directly',
  $$insert into activity_log (action, entity) values ('insert', 'sales')$$, 'denied');


-- ── Auto timestamps & design requests (0004) ─────────────────
select t.login(6);
select t.check('Customer member logs a complaint',
  $$insert into complaints (customer, issue) values ('Ana', 'Late delivery')$$, 'ok');
select t.check('Customer member resolves it',
  $$update complaints set status = 'resolved' where customer = 'Ana'$$, 'ok');
select t.assert('Resolving stamps resolved_at automatically',
  t.num($$select count(*) from complaints where customer = 'Ana' and resolved_at is not null$$) = 1);
select t.login(2);
select t.check('Non-Marketing member cannot request a design already assigned to someone',
  $$insert into design_requests (title, requested_by, assignee_id) select 'Poster', my_profile_id(), id from profiles where full_name = 'Rocco'$$, 'denied');
select t.check('Non-Marketing member cannot mark a design delivered',
  $$update design_requests set status = 'delivered'$$, 'denied');


-- ── Trello settings (0006) ───────────────────────────────────
select t.login(3);
select t.check('Group member cannot switch on Trello sync for their board',
  $$update boards set trello_sync_enabled = true where slug = 'marketing'$$, 'denied');
select t.login(4);
select t.check('Team Leader can switch on Trello sync',
  $$update boards set trello_sync_enabled = true, trello_board_id = 'abc123' where slug = 'marketing'$$, 'ok');
select t.login(2);
select t.check('Non-admin cannot map Trello members',
  $$insert into trello_member_map (trello_member_id, trello_username, profile_id) select 'x', 'x', id from profiles limit 1$$, 'denied');

-- ── Base camp: private to its owner, even from admins ───────
select t.login(2);  -- Stefan (Finance)
select t.check('Member writes a private note', $$insert into docs (title, body) values ('Stefan private', 'secret idea')$$, 'ok');
select t.check('Member adds an idea', $$insert into ideas (text) values ('Sell at the campus market')$$, 'ok');
select t.check('Member plans their week', $$insert into week_plans (week_start, priorities) values ('2026-10-12', '{a,b,c}')$$, 'ok');
select t.check('Member adds an agenda item', $$insert into agenda_items (title, day) values ('Call supplier', '2026-10-15')$$, 'ok');
select t.check('Member stores an encrypted vault item', $$insert into vault_items (iv, data) values ('iv', 'ciphertext')$$, 'ok');
select t.check('Member cannot create a note owned by someone else',
  $$insert into docs (owner_id, title) select id, 'forged' from profiles where full_name = 'Rocco'$$, 'denied');
select t.check('Member shares one doc with Rocco',
  $$insert into docs (title, shared_with) select 'For Rocco', array[id] from profiles where full_name = 'Rocco'$$, 'ok');

select t.login(3);  -- Rocco (Marketing)
select t.assert('Other member cannot read a private note', t.num($$select count(*) from docs where title = 'Stefan private'$$) = 0);
select t.assert('Other member reads a doc shared with them', t.num($$select count(*) from docs where title = 'For Rocco'$$) = 1);
select t.check('Shared reader cannot edit the doc', $$update docs set body = 'changed' where title = 'For Rocco'$$, 'denied');
select t.assert('Other member cannot see ideas, plans, agenda or vault',
  t.num('select (select count(*) from ideas) + (select count(*) from week_plans) + (select count(*) from agenda_items) + (select count(*) from vault_items)') = 0);
select t.check('Other member cannot delete a private idea', $$delete from ideas where text = 'Sell at the campus market'$$, 'denied');

select t.login(1);  -- Alvaro (admin)
select t.assert('Admin cannot read a private note', t.num($$select count(*) from docs where title = 'Stefan private'$$) = 0);
select t.assert('Admin cannot read the vault', t.num('select count(*) from vault_items') = 0);
select t.check('Admin cannot change a private note', $$update docs set body = 'x' where title = 'Stefan private'$$, 'denied');

-- ── Note-taker keys: only the owner ─────────────────────────
select t.login(2);
select t.check('Member saves their own (encrypted) Groq key', $$insert into ai_keys (key_iv, key_data, last4) values ('iv', 'enc', '1234')$$, 'ok');
select t.login(3);
select t.assert('Other member cannot see someone else''s key', t.num('select count(*) from ai_keys') = 0);
select t.check('Other member cannot overwrite it', $$update ai_keys set last4 = 'xxxx'$$, 'denied');
select t.login(1);
select t.assert('Admin cannot see members'' keys', t.num('select count(*) from ai_keys') = 0);

-- ── Meeting log: shared with the team; leaders' meetings only for leaders ──
select t.login(3);  -- Rocco (Marketing, not a leader)
select t.check('Member records a training session for the team', $$insert into meetings (title, kind) values ('Pricing training', 'training')$$, 'ok');
select t.check('Non-leader cannot create a leaders'' meeting', $$insert into meetings (title, kind) values ('Secret', 'leaders')$$, 'denied');
select t.login(4);  -- Lassi (Team Leader group)
select t.check('Leader records a leaders'' meeting', $$insert into meetings (title, kind) values ('Leaders weekly', 'leaders')$$, 'ok');
select t.assert('Leader sees both meetings', t.num('select count(*) from meetings') = 2);
select t.login(2);  -- Stefan (Finance)
select t.assert('Member sees the training session', t.num($$select count(*) from meetings where kind = 'training'$$) = 1);
select t.assert('Member does not see the leaders'' meeting', t.num($$select count(*) from meetings where kind = 'leaders'$$) = 0);
select t.check('Member cannot edit someone else''s meeting', $$update meetings set title = 'x' where title = 'Pricing training'$$, 'denied');
select t.check('Member cannot delete someone else''s meeting', $$delete from meetings where title = 'Pricing training'$$, 'denied');
select t.login(3);
select t.check('Author can fix their meeting''s notes', $$update meetings set notes = 'Fixed' where title = 'Pricing training'$$, 'ok');
select t.check('Author cannot turn it into a leaders'' meeting', $$update meetings set kind = 'leaders' where title = 'Pricing training'$$, 'denied');
select t.login(1);  -- Alvaro (admin)
select t.assert('Admin sees the leaders'' meeting', t.num($$select count(*) from meetings where kind = 'leaders'$$) = 1);

-- Meeting audio follows who can see the meeting
select t.login(4);
select t.check('Leader uploads audio for their leaders'' meeting',
  $$insert into storage.objects (bucket_id, name) select 'meetings', id || '/chunk-000.webm' from meetings where kind = 'leaders'$$, 'ok');
select t.login(3);
select t.check('Author uploads audio for their training session',
  $$insert into storage.objects (bucket_id, name) select 'meetings', id || '/chunk-000.webm' from meetings where kind = 'training'$$, 'ok');
select t.login(2);
select t.assert('Member can play the training audio', t.num($$select count(*) from storage.objects o join meetings m on o.name like m.id || '/%' where m.kind = 'training'$$) = 1);
select t.assert('Member cannot reach the leaders'' audio', t.num($$select count(*) from storage.objects where bucket_id = 'meetings'$$) = 1);
select t.check('Member cannot add audio to someone else''s meeting',
  $$insert into storage.objects (bucket_id, name) select 'meetings', id || '/chunk-009.webm' from meetings where kind = 'training'$$, 'denied');
select t.assert('Member cannot see private Base camp recordings of others', t.num($$select count(*) from storage.objects where bucket_id = 'recordings'$$) = 0);

-- ── Drive archive: secrets never reachable; archived parts follow meeting visibility ──
reset role;
insert into app_secrets (key, iv, data) values ('google_refresh_token', 'iv', 'enc');
insert into meeting_audio (meeting_id, part, drive_file_id) select id, 'chunk-000.webm', 'drive-' || kind from meetings;
set role authenticated;
select t.login(1);
select t.check('Even an admin cannot read server secrets', $$select * from app_secrets$$, 'denied');
select t.login(2);
select t.assert('Member sees archived parts of team meetings only', t.num('select count(*) from meeting_audio') = 1);
select t.check('Member cannot add archive entries', $$insert into meeting_audio (meeting_id, part, drive_file_id) select id, 'x', 'y' from meetings limit 1$$, 'denied');
select t.login(4);
select t.assert('Leader sees archived parts of leaders'' meetings too', t.num('select count(*) from meeting_audio') = 2);

-- ── Idea lab: shared with the team; authors own their ideas ──
select t.login(3);
select t.check('Member posts an idea', $$insert into lab_ideas (title, pitch, kind) values ('Campus coffee bike', 'Sell coffee from a bike', 'product')$$, 'ok');
select t.check('Member cannot post as someone else', $$insert into lab_ideas (created_by, title) select id, 'Fake' from profiles where full_name = 'Stefan'$$, 'denied');
select t.login(2);
select t.assert('Everyone sees the idea', t.num($$select count(*) from lab_ideas$$) = 1);
select t.check('Member votes once', $$insert into lab_votes (idea_id) select id from lab_ideas$$, 'ok');
select t.check('...and cannot vote twice', $$insert into lab_votes (idea_id) select id from lab_ideas$$, 'denied');
select t.check('Member comments', $$insert into lab_comments (idea_id, body) select id, 'Love it' from lab_ideas$$, 'ok');
select t.check('Member cannot edit someone else''s idea', $$update lab_ideas set title = 'x'$$, 'denied');
select t.check('Member cannot delete someone else''s idea', $$delete from lab_ideas$$, 'denied');
select t.login(3);
select t.check('Author cannot delete another member''s vote', $$delete from lab_votes$$, 'denied');
select t.check('Author updates the analysis of their idea', $$update lab_ideas set score = 72, status = 'analyzed'$$, 'ok');
select t.login(1);
select t.check('Admin can remove a comment', $$delete from lab_comments where body = 'Love it'$$, 'ok');

-- ── Notifications, repeating tasks, calendar feeds ──────────
select t.login(3);  -- Rocco (Marketing)
select t.check('Marketing member adds a card on their board',
  $$insert into cards (board_id, list_id, title, created_by) select b.id, l.id, 'Shoot product photos', public.my_profile_id() from boards b join board_lists l on l.board_id = b.id where b.slug = 'marketing' order by l.position limit 1$$, 'ok');
select t.check('...and assigns Stefan', $$insert into card_assignees (card_id, user_id) select c.id, p.id from cards c, profiles p where c.title = 'Shoot product photos' and p.full_name = 'Stefan'$$, 'ok');
select t.assert('Rocco cannot read Stefan''s notifications', t.num($$select count(*) from notifications where data->>'title' = 'Shoot product photos'$$) = 0);
select t.check('Nobody can create notifications directly', $$insert into notifications (user_id, kind) select id, 'assigned' from profiles limit 1$$, 'denied');
select t.check('Marketing member makes a weekly repeating task',
  $$insert into recurring_tasks (board_id, title, cadence, next_run) select id, 'Weekly content plan', 'weekly', current_date from boards where slug = 'marketing'$$, 'ok');
select t.login(2);  -- Stefan (Finance)
select t.assert('Stefan was notified about the assignment', t.num($$select count(*) from notifications where data->>'title' = 'Shoot product photos'$$) = 1);
select t.check('Stefan marks it read', $$update notifications set read_at = now() where data->>'title' = 'Shoot product photos'$$, 'ok');
select t.check('Finance member cannot add repeating tasks to Marketing''s board',
  $$insert into recurring_tasks (board_id, title, cadence, next_run) select id, 'Hijack', 'weekly', current_date from boards where slug = 'marketing'$$, 'denied');
select t.check('Member creates their own calendar feed', $$insert into calendar_feeds default values$$, 'ok');
select t.login(3);
select t.assert('Others cannot see someone else''s calendar feed', t.num('select count(*) from calendar_feeds') = 0);
reset role;
select t.assert('Repeating task runs', public.run_recurring() >= 1);
select t.assert('Repeating task created its card', (select count(*) from cards where title = 'Weekly content plan') = 1);
select t.assert('...and moves to next week', (select next_run from recurring_tasks where title = 'Weekly content plan') = current_date + 7);
set role authenticated;

-- ── Finance upgrade: projects, no deletes, month close, reversals, claims, audit, product linking ──
select t.login(2);  -- Stefan (Finance)
select t.check('Finance creates a project', $$insert into projects (name, budget) values ('Campus stall', 100)$$, 'ok');
select t.check('Finance logs a sale in a project with a payment method',
  $$insert into sales (date, description, amount, cost, project_id, payment_method, logged_by) select current_date, 'Stall sale', 20, 8, id, 'bizum', public.my_profile_id() from projects where name = 'Campus stall'$$, 'ok');
select t.check('Nobody can hard-delete a sale (fixes are reversals)', $$delete from sales where description = 'Stall sale'$$, 'denied');
select t.check('Reversing entry with a reason', $$insert into sales (date, description, amount, cost, reverses_id, reason) select current_date, 'Reversal', -20, -8, id, 'Typo' from sales where description = 'Stall sale'$$, 'ok');
select t.check('Finance closes last month', $$insert into month_locks (month) values (date_trunc('month', current_date - interval '1 month')::date)$$, 'ok');
select t.check('A closed month can''t receive entries', $$insert into sales (date, description, amount) values (date_trunc('month', current_date - interval '1 month')::date + 2, 'Late', 5)$$, 'denied');
select t.assert('Finance sees the audit log', t.num('select count(*) from finance_audit') > 0);
select t.check('Finance cannot read the sheet queue directly', $$select * from sheet_sync_queue$$, 'denied');
select t.login(3);  -- Rocco (Marketing)
select t.check('Non-finance cannot create projects', $$insert into projects (name) values ('Hijack')$$, 'denied');
select t.check('Non-finance cannot log sales', $$insert into sales (description, amount) values ('x', 1)$$, 'denied');
select t.assert('Non-finance cannot read the audit log', t.num('select count(*) from finance_audit') = 0);
select t.check('Any member submits an expense claim', $$insert into expense_claims (amount, description) values (12, 'Tape for the stall')$$, 'ok');
select t.check('...but cannot approve it themselves', $$update expense_claims set status = 'approved'$$, 'denied');
select t.check('Non-finance cannot close months', $$insert into month_locks (month) values (date_trunc('month', current_date)::date)$$, 'denied');
select t.login(5);  -- Mario (Communications)
select t.assert('Members don''t see other people''s claims', t.num('select count(*) from expense_claims') = 0);
select t.login(2);
select t.check('Finance approves the claim', $$update expense_claims set status = 'approved', decided_by = public.my_profile_id(), decided_at = now()$$, 'ok');
select t.check('Finance adds a stock item', $$insert into inventory (product, stock, unit_cost, price, low_stock) values ('Tote bag', 10, 3, 12, 3)$$, 'ok');
select t.check('Sale of a stock item (linking off)', $$insert into sales (description, amount, item_id, quantity) select 'Tote', 24, id, 2 from inventory where product = 'Tote bag'$$, 'ok');
select t.assert('With linking OFF, stock doesn''t change', (select stock from inventory where product = 'Tote bag') = 10);
select t.login(1);
select t.check('Admin switches product linking on', $$update app_flags set enabled = true where key = 'product_linking'$$, 'ok');
select t.login(2);
select t.check('Sale of a stock item (linking on)', $$insert into sales (description, amount, item_id, quantity) select 'Tote', 24, id, 2 from inventory where product = 'Tote bag'$$, 'ok');
select t.assert('With linking ON, stock goes down and cost fills in', (select stock from inventory where product = 'Tote bag') = 8
  and (select cost from sales where description = 'Tote' order by created_at desc limit 1) = 6);

-- ── Marketing section ───────────────────────────────────────
select t.login(3);  -- Rocco (Marketing)
select t.check('Marketing plans a post with tags', $$insert into content_items (title, tags, status) values ('Tote reel', '{"format":"reel","hook_message":"question"}', 'scheduled')$$, 'ok');
select t.check('Marketing logs 7-day numbers', $$insert into content_metrics (content_id, age_hours, views, reach, saves, shares) select id, 168, 1200, 900, 30, 12 from content_items where title = 'Tote reel'$$, 'ok');
select t.check('Marketing writes a brief', $$insert into briefs (title, hypothesis) values ('Launch week', 'Questions beat claims')$$, 'ok');
select t.check('Marketing creates a short link', $$insert into go_links (slug, destination) values ('bio', 'https://example.com')$$, 'ok');
select t.check('Marketing creates a discount code', $$insert into discount_codes (code, channel) values ('IG10', 'instagram')$$, 'ok');
select t.check('Marketing logs a DM inquiry', $$insert into inquiries (handle, product) values ('@ana', 'tote')$$, 'ok');
select t.login(2);  -- Stefan (Finance)
select t.assert('Everyone sees the content log', t.num('select count(*) from content_items') >= 1);
select t.check('Finance cannot edit posts', $$update content_items set decision = 'kill'$$, 'denied');
select t.check('Finance cannot change the tag glossary', $$insert into tag_glossary (tag_type, value) values ('format', 'hack')$$, 'denied');
select t.check('Finance logs a sale with code + heard-about', $$insert into sales (description, amount, code, heard_about) values ('IG sale', 15, 'IG10', 'instagram')$$, 'ok');
select t.check('Finance opens a stall day', $$insert into stall_sessions (place) values ('Campus hall')$$, 'ok');
select t.check('Nobody fakes link clicks from the browser', $$insert into go_clicks (link_id) select id from go_links limit 1$$, 'denied');
select t.login(5);
select t.check('Communications cannot log inquiries', $$insert into inquiries (handle) values ('@x')$$, 'denied');

-- ── Scout (lead finder) + council ───────────────────────────
select t.login(3);  -- Rocco (Marketing)
select t.check('Marketing creates a Scout project', $$insert into scout_projects (title, offer, niche) values ('Café content', 'Instagram content', 'cafés')$$, 'ok');
select t.check('Marketing starts a search', $$insert into scout_searches (project_id, country_code, city) select id, 'ES', 'Bilbao' from scout_projects limit 1$$, 'ok');
select t.check('Marketing stores a place', $$insert into scout_places (fingerprint, name) values ('cafe-x|43.26|-2.93', 'Café X')$$, 'ok');
select t.check('Marketing saves a lead', $$insert into scout_leads (project_id, place_id, score, fit) select p.id, pl.id, 80, 'strong' from scout_projects p, scout_places pl limit 1$$, 'ok');
select t.check('Same place cannot be judged twice for a project', $$insert into scout_leads (project_id, place_id) select p.id, pl.id from scout_projects p, scout_places pl limit 1$$, 'denied');
select t.check('Marketing assigns the lead to Mario', $$update scout_leads set owner_id = (select id from profiles where full_name = 'Mario')$$, 'ok');
select t.login(2);  -- Stefan (Finance)
select t.assert('Everyone sees Scout leads', t.num('select count(*) from scout_leads') = 1);
select t.check('Finance cannot start searches', $$insert into scout_searches (project_id, country_code, city) select id, 'ES', 'Madrid' from scout_projects limit 1$$, 'denied');
select t.check('Finance cannot change leads', $$update scout_leads set status = 'won'$$, 'denied');
select t.login(5);  -- Mario (Comms), owner of the lead
select t.check('The lead owner moves it along', $$update scout_leads set status = 'contacted'$$, 'ok');
select t.check('The lead owner cannot hand it to someone else', $$update scout_leads set owner_id = (select id from profiles where full_name = 'Stefan')$$, 'denied');
select t.check('Member runs the council on an idea', $$insert into lab_councils (idea_id) select id from lab_ideas limit 1$$, 'ok');
select t.login(2);
select t.check('Others cannot overwrite that council', $$update lab_councils set status = 'failed'$$, 'denied');

-- ── Base camp reminders ──────────────────────────────────────
select t.login(3);
select t.check('Member adds a reminder', $$insert into reminders (title, remind_at, priority) values ('Call printer', now() + interval '1 hour', 'high')$$, 'ok');
select t.login(2);
select t.assert('Others cannot see my reminders', t.num('select count(*) from reminders') = 0);
select t.check('Others cannot edit my reminders', $$update reminders set done = true$$, 'denied');
select t.check('Nobody adds a reminder for someone else', $$insert into reminders (owner_id, title, remind_at) select id, 'x', now() from profiles where full_name = 'Rocco'$$, 'denied');

-- ── Team tasks from the team leader ─────────────────────────
select t.login(4);  -- Lassi (Team Leader)
select t.check('Team leader gives a task', $$insert into team_tasks (title) values ('Post one story each')$$, 'ok');
select t.check('Team leader gives it to Rocco and Stefan', $$insert into team_task_people (task_id, user_id) select tt.id, p.id from team_tasks tt, profiles p where p.full_name in ('Rocco', 'Stefan')$$, 'ok');
select t.login(3);  -- Rocco
select t.assert('Rocco is told about the task', t.num($$select count(*) from notifications where kind = 'team_task'$$) = 1);
select t.check('Members cannot give tasks', $$insert into team_tasks (title) values ('x')$$, 'denied');
select t.check('Rocco ticks his own task', $$update team_task_people set done_at = now() where user_id = my_profile_id()$$, 'ok');
select t.assert('Rocco cannot tick Stefan''s task', t.num($$with u as (update team_task_people set done_at = now() where user_id <> my_profile_id() returning 1) select count(*) from u$$) = 0);
select t.check('Rocco cannot move his task to someone else', $$update team_task_people set user_id = (select id from profiles where full_name = 'Mario') where user_id = my_profile_id()$$, 'denied');
select t.login(5);  -- Mario, not on the task
select t.assert('Everyone sees who finished', t.num('select count(*) from team_task_people where done_at is not null') = 1);
select t.check('Members cannot delete tasks', $$delete from team_tasks$$, 'denied');

-- ── Team activity totals ────────────────────────────────────
select t.assert('Members see team activity totals', t.num('select count(*) from team_activity(now() - interval ''30 days'')') > 0);

-- ── Removed member / logged-out visitor ──────────────────────
select t.login(1);
select t.check('Admin deactivates a member',
  $$update profiles set active = false where full_name = 'Mario'$$, 'ok');
select t.login(5);
select t.assert('Deactivated member sees nothing', t.num('select count(*) from profiles') = 0);
select t.assert('Deactivated member gets no activity totals', t.num('select count(*) from team_activity(now() - interval ''30 days'')') = 0);

reset role;
set role anon;
select t.check('Logged-out visitor cannot read anything',
  $$select * from profiles$$, 'denied');
reset role;
