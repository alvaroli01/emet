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

-- ── Google Calendar links: only the owner ──────────────────
select t.login(2);
select t.check('Member saves their own (encrypted) Google Calendar link', $$insert into google_calendars (url_iv, url_data) values ('iv', 'enc')$$, 'ok');
select t.login(3);
select t.assert('Other member cannot see someone else''s Google link', t.num('select count(*) from google_calendars') = 0);
select t.check('Other member cannot overwrite it', $$update google_calendars set url_data = 'x'$$, 'denied');
select t.check('Other member cannot delete it', $$delete from google_calendars$$, 'denied');
select t.login(1);
select t.assert('Admin cannot see members'' Google links', t.num('select count(*) from google_calendars') = 0);
select t.login(2);
select t.assert('Owner still has their link, unchanged', t.num($q$select count(*) from google_calendars where url_data = 'enc'$q$) = 1);

-- ── Documents: company (leaders write, everyone reads) + private My folder ──
select t.login(4);  -- Lassi, Team Leader
select t.check('Leader creates a company folder', $$insert into doc_folders (scope, name) values ('company', 'Contracts')$$, 'ok');
select t.check('Leader adds a company file', $$insert into doc_files (scope, folder_id, name, size, path) select 'company', id, 'Team Contract.pdf', 1000, 'company/x/Team Contract.pdf' from doc_folders where name = 'Contracts'$$, 'ok');
select t.check('Leader uploads it to storage', $$insert into storage.objects (bucket_id, name) values ('documents', 'company/x/Team Contract.pdf')$$, 'ok');
select t.login(3);  -- Rocco, member
select t.assert('Member sees the company folder and file', t.num($$select count(*) from doc_files where scope = 'company'$$) = 1 and t.num($$select count(*) from doc_folders where scope = 'company'$$) = 1);
select t.assert('Member can open the company file in storage', t.num($$select count(*) from storage.objects where bucket_id = 'documents' and name like 'company/%'$$) = 1);
select t.check('Member cannot create a company folder', $$insert into doc_folders (scope, name) values ('company', 'Mine')$$, 'denied');
select t.check('Member cannot add a company file', $$insert into doc_files (scope, name, size, path) values ('company', 'x.pdf', 1, 'company/y/x.pdf')$$, 'denied');
select t.check('Member cannot rename a company file', $$update doc_files set name = 'hacked' where scope = 'company'$$, 'denied');
select t.check('Member cannot delete a company file', $$delete from doc_files where scope = 'company'$$, 'denied');
select t.check('Member cannot upload into company storage', $$insert into storage.objects (bucket_id, name) values ('documents', 'company/z/evil.pdf')$$, 'denied');
select t.check('Member cannot delete company storage', $$delete from storage.objects where bucket_id = 'documents' and name like 'company/%'$$, 'denied');
select t.assert('Member was notified about the new company document', t.num($$select count(*) from notifications where kind = 'company_doc' and data->>'name' = 'Team Contract.pdf'$$) = 1);
select t.check('Member keeps a private folder', $$insert into doc_folders (scope, owner_id, name) values ('personal', my_profile_id(), 'Uni')$$, 'ok');
select t.check('Member adds a private file', $$insert into doc_files (scope, owner_id, folder_id, name, size, path) select 'personal', my_profile_id(), id, 'cv.pdf', 10, 'personal/' || my_profile_id() || '/f/cv.pdf' from doc_folders where name = 'Uni'$$, 'ok');
select t.check('Member uploads the private file to storage', $$insert into storage.objects (bucket_id, name) values ('documents', 'personal/' || my_profile_id() || '/f/cv.pdf')$$, 'ok');
select t.check('Private file cannot go into a company folder', $$insert into doc_files (scope, owner_id, folder_id, name, size, path) select 'personal', my_profile_id(), id, 'a', 1, 'personal/' || my_profile_id() || '/g/a' from doc_folders where name = 'Contracts'$$, 'denied');
select t.check('Member cannot make a private folder for someone else', $$insert into doc_folders (scope, owner_id, name) select 'personal', id, 'x' from profiles where full_name = 'Stefan'$$, 'denied');
select t.check('Files over 25 MB are refused', $$insert into doc_files (scope, owner_id, name, size, path) values ('personal', my_profile_id(), 'big', 26214401, 'personal/' || my_profile_id() || '/h/big')$$, 'denied');
select t.login(2);  -- Stefan
select t.assert('Other member cannot see Rocco''s private folder or files', t.num($$select count(*) from doc_folders where scope = 'personal'$$) = 0 and t.num($$select count(*) from doc_files where scope = 'personal'$$) = 0);
select t.assert('Other member cannot open Rocco''s private file in storage', t.num($$select count(*) from storage.objects where bucket_id = 'documents' and name like 'personal/%'$$) = 0);
select t.check('Other member cannot put a file into Rocco''s private storage', $$insert into storage.objects (bucket_id, name) select 'documents', 'personal/' || id || '/q/x' from profiles where full_name = 'Rocco'$$, 'denied');
select t.login(1);  -- Alvaro, admin
select t.assert('Admin cannot see members'' private files', t.num($$select count(*) from doc_files where scope = 'personal'$$) = 0);
select t.assert('Admin cannot open members'' private storage', t.num($$select count(*) from storage.objects where bucket_id = 'documents' and name like 'personal/%'$$) = 0);
select t.assert('Storage total counts every document', public.documents_storage_used() = 1010);
select t.login(4);
select t.check('Leader deletes the company folder (file goes with it)', $$delete from doc_folders where name = 'Contracts'$$, 'ok');
select t.assert('Company file was removed with its folder', t.num($$select count(*) from doc_files where scope = 'company'$$) = 0);

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
select t.check('Finance cannot create a project (leaders do, 2026-10-21)', $$insert into projects (name, budget) values ('Campus stall', 100)$$, 'denied');
select t.login(4);  -- Lassi (Team Leader)
select t.check('Leader creates a project', $$insert into projects (name, budget) values ('Campus stall', 100)$$, 'ok');
select t.login(2);
select t.check('Finance can still update a project''s budget', $$update projects set budget = 150 where name = 'Campus stall'$$, 'ok');
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
select t.check('Marketing shares its Scout project with the team (private by default since 27 Oct)', $$update scout_projects set shared = true$$, 'ok');
select t.login(2);  -- Stefan (Finance)
select t.assert('Everyone sees a shared Scout project''s leads', t.num('select count(*) from scout_leads') = 1);
select t.check('Anyone can search in a shared Scout project (28 Oct)', $$insert into scout_searches (project_id, country_code, city) select id, 'ES', 'Madrid' from scout_projects limit 1$$, 'ok');
select t.check('...but not change its setup', $$update scout_projects set niche = 'x'$$, 'denied');
select t.check('...and work its leads', $$update scout_leads set status = 'contacted'$$, 'ok');
select t.login(5);  -- Mario (Comms), owner of the lead
select t.check('The lead owner moves it along', $$update scout_leads set status = 'contacted'$$, 'ok');
select t.check('On a shared project the team can also reassign a lead (28 Oct)', $$update scout_leads set owner_id = (select id from profiles where full_name = 'Stefan')$$, 'ok');
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

-- ── My Projects: leaders create, members work, others see nothing ──
set role authenticated;
select t.login(3);
select t.check('Member cannot create a project', $$insert into projects (name) values ('Nope')$$, 'denied');
select t.login(4);  -- Lassi, leader
select t.check('Leader creates a project', $$insert into projects (name, goal) values ('Market stall', 2000)$$, 'ok');
select t.check('Leader adds Rocco to it', $$insert into project_members (project_id, user_id) select p.id, r.id from projects p, profiles r where p.name = 'Market stall' and r.full_name = 'Rocco'$$, 'ok');
select t.check('Leader creates the project board (and reads it back, like the app does)', $$insert into boards (slug, name, project_id) select 'project-' || id, name, id from projects where name = 'Market stall' returning id$$, 'ok');
select t.check('Leader adds a list to it', $$insert into board_lists (board_id, name) select id, 'To do' from boards where slug like 'project-%'$$, 'ok');
select t.login(3);  -- Rocco, member of the project
select t.assert('Member sees the project', t.num($$select count(*) from projects where name = 'Market stall'$$) = 1);
select t.assert('Member was notified about being added', t.num($$select count(*) from notifications where kind = 'project_added'$$) = 1);
select t.check('Member cannot add a task to the project (leaders do, 2026-10-21)', $$insert into cards (board_id, list_id, title, created_by) select b.id, l.id, 'Sneaky', my_profile_id() from boards b join board_lists l on l.board_id = b.id where b.slug like 'project-%'$$, 'denied');
select t.check('Member cannot add a column to the project board', $$insert into board_lists (board_id, name) select id, 'Mine' from boards where slug like 'project-%'$$, 'denied');
select t.login(4);
select t.check('Leader adds a task on the project board', $$insert into cards (board_id, list_id, title, created_by) select b.id, l.id, 'Book the stall', my_profile_id() from boards b join board_lists l on l.board_id = b.id where b.slug like 'project-%'$$, 'ok');
select t.login(3);
select t.check('Member works on that task (moves / renames it)', $$update cards set title = 'Book the stall (paid)' where title = 'Book the stall'$$, 'ok');
select t.check('Member cannot delete the project task', $$delete from cards where title = 'Book the stall (paid)'$$, 'denied');
select t.check('Member adds a link', $$insert into project_links (project_id, title, url) select id, 'Budget', 'https://docs.google.com/spreadsheets/d/x' from projects where name = 'Market stall'$$, 'ok');
select t.check('Links must be https', $$insert into project_links (project_id, title, url) select id, 'Bad', 'javascript:alert(1)' from projects where name = 'Market stall'$$, 'denied');
select t.check('Member posts an update', $$insert into project_updates (project_id, body) select id, 'Stall booked' from projects where name = 'Market stall'$$, 'ok');
select t.check('Member uploads a project file', $$insert into storage.objects (bucket_id, name) select 'projects', id || '/f/plan.pdf' from projects where name = 'Market stall'$$, 'ok');
select t.check('Member cannot add people', $$insert into project_members (project_id, user_id) select p.id, r.id from projects p, profiles r where p.name = 'Market stall' and r.full_name = 'Emily'$$, 'denied');
select t.check('Member cannot change the project', $$update projects set goal = 1 where name = 'Market stall'$$, 'denied');
select t.login(6);  -- Emily, not a member
select t.assert('Non-member does not see the project', t.num($$select count(*) from projects where name = 'Market stall'$$) = 0);
select t.assert('Non-member does not see its board, lists or tasks', t.num($$select count(*) from boards where slug like 'project-%'$$) = 0 and t.num($$select count(*) from board_lists l join boards b on b.id = l.board_id where b.project_id is not null$$) = 0 and t.num($$select count(*) from cards where title like 'Book the stall%'$$) = 0);
select t.assert('Non-member does not see links, updates or files', t.num('select count(*) from project_links') = 0 and t.num('select count(*) from project_updates') = 0 and t.num($$select count(*) from storage.objects where bucket_id = 'projects'$$) = 0);
select t.assert('Non-member activity feed has no project task titles', t.num($$select count(*) from activity_log where summary->>'label' like 'Book the stall%'$$) = 0);
select t.check('Non-member cannot add a task to the project board', $$insert into cards (board_id, list_id, title, created_by) select b.id, l.id, 'x', my_profile_id() from boards b join board_lists l on l.board_id = b.id where b.slug like 'project-%'$$, 'denied');
select t.assert('Team boards are still visible to everyone', t.num($$select count(*) from boards where project_id is null$$) > 0);
select t.login(2);  -- Stefan, Finance (not a member)
select t.assert('Finance sees the project name to tag sales', t.num($$select count(*) from projects where name = 'Market stall'$$) = 1);
select t.assert('Finance does not see the project links', t.num('select count(*) from project_links') = 0);
select t.check('Finance tags a sale with the project', $$insert into sales (date, description, amount, cost, project_id, payment_method, logged_by) select current_date, 'Market stall sale', 120, 40, id, 'bizum', public.my_profile_id() from projects where name = 'Market stall'$$, 'ok');
select t.login(3);
select t.assert('Member sees the project money', (select revenue from project_money((select id from projects where name = 'Market stall'))) = 120);
-- Project tick-off tasks (like "From the team leader", but inside one project)
select t.login(4);
select t.check('Leader gives a project task', $$insert into team_tasks (title, project_id) select 'Bring the cash box', id from projects where name = 'Market stall'$$, 'ok');
select t.check('...to Rocco', $$insert into team_task_people (task_id, user_id) select tt.id, p.id from team_tasks tt, profiles p where tt.title = 'Bring the cash box' and p.full_name = 'Rocco'$$, 'ok');
select t.login(3);
select t.assert('Project member sees the project task', t.num($$select count(*) from team_tasks where title = 'Bring the cash box'$$) = 1);
select t.check('Project member ticks it off', $$update team_task_people set done_at = now() where task_id = (select id from team_tasks where title = 'Bring the cash box') and user_id = my_profile_id()$$, 'ok');
select t.assert('The notification opens the project', t.num($$select count(*) from notifications where kind = 'team_task' and link like '/projects/%'$$) = 1);
select t.login(6);
select t.assert('Non-member cannot see the project task or who has it', t.num($$select count(*) from team_tasks where title = 'Bring the cash box'$$) = 0 and t.num($$select count(*) from team_task_people tp join team_tasks tt on tt.id = tp.task_id where tt.title = 'Bring the cash box'$$) = 0);
select t.check('Non-leader cannot give a project task', $$insert into team_tasks (title, project_id) select 'x', id from projects limit 1$$, 'denied');
select t.assert('Company-wide leader tasks are still visible to everyone', t.num($$select count(*) from team_tasks where project_id is null$$) >= 0);
select t.login(4);
select t.check('Leader removes Rocco', $$delete from project_members where user_id = (select id from profiles where full_name = 'Rocco')$$, 'ok');
select t.login(3);
select t.assert('Removed member loses the project at once', t.num($$select count(*) from projects where name = 'Market stall'$$) = 0 and t.num($$select count(*) from cards where title like 'Book the stall%'$$) = 0);
select t.login(4);
select t.assert('Project task links open the project', (select card_link(id) from cards where title like 'Book the stall%') like '/projects/%?tab=tasks&card=%');
select t.check('Leader deletes the project', $$delete from projects where name = 'Market stall'$$, 'ok');
select t.assert('Its board, links and updates went with it', t.num($$select count(*) from boards where slug like 'project-%'$$) = 0 and t.num('select count(*) from project_links') = 0 and t.num('select count(*) from project_updates') = 0);
select t.login(2);
select t.assert('The sale stays, untagged', t.num($$select count(*) from sales where description = 'Market stall sale' and project_id is null$$) = 1);
reset role;
-- ── Scout key pool: lend your Groq key to Scout ─────────────
set role authenticated;
select t.login(3);
select t.check('Member saves a key', $$insert into ai_keys (key_iv, key_data, last4) values ('iv', 'enc', 'abcd')$$, 'ok');
select t.check('...and lends it to Scout', $$update ai_keys set lend_scout = true$$, 'ok');
select t.login(6);
select t.assert('Lending does not show the key to anyone', t.num('select count(*) from ai_keys') = 0);
select t.check('Browser cannot write key usage', $$select ai_usage_event(my_profile_id(), 'x', 5, null, false)$$, 'denied');
select t.assert('Members see who lends a key (names only)', (select count(*) from scout_lenders()) = 1);
select t.login(1);
select t.assert('Admins cannot see a lent key either', t.num($$select count(*) from ai_keys where last4 = 'abcd'$$) = 0);
reset role;
select ai_usage_event((select id from profiles where full_name = 'Rocco'), 'openai/gpt-oss-120b', 1000, null, false);
select ai_usage_event((select id from profiles where full_name = 'Rocco'), 'openai/gpt-oss-120b', 500, now() + interval '1 minute', false);
set role authenticated;
select t.login(3);
select t.assert('Owner sees Scout usage of their key, added up', t.num($$select tokens from ai_key_usage where model = 'openai/gpt-oss-120b'$$) = 1500);
select t.login(6);
select t.assert('Nobody else sees it', t.num('select count(*) from ai_key_usage') = 0);
reset role;
-- ── Mistral backup key: only the owner ──────────────────────
set role authenticated;
select t.login(3);
select t.check('Member saves their Mistral backup key', $$insert into backup_keys (key_iv, key_data, last4) values ('iv', 'enc', 'm123')$$, 'ok');
select t.login(6);
select t.assert('Nobody else sees it', t.num('select count(*) from backup_keys') = 0);
select t.check('Nobody else can change it', $$update backup_keys set last4 = 'xxxx'$$, 'denied');
select t.login(1);
select t.assert('Admins cannot see it either', t.num('select count(*) from backup_keys') = 0);
reset role;
-- ── Notion: each member's own connections and exports ───────
set role authenticated;
select t.login(3);
select t.check('Member saves a Notion connection', $$insert into notion_connections (workspace_id, workspace_name, token_iv, token_data) values ('ws1', 'Uni', 'iv', 'enc')$$, 'ok');
select t.check('...and remembers an export', $$insert into notion_exports (kind, source_id, notion_page_id, url) values ('meeting', gen_random_uuid(), 'p1', 'https://notion.so/p1')$$, 'ok');
select t.login(6);
select t.assert('Nobody else sees the Notion connection', t.num('select count(*) from notion_connections') = 0);
select t.assert('...or the export', t.num('select count(*) from notion_exports') = 0);
select t.check('...or can change it', $$update notion_connections set workspace_name = 'x'$$, 'denied');
select t.login(1);
select t.assert('Admins cannot see a Notion connection either', t.num('select count(*) from notion_connections') = 0);
reset role;
-- ── Coach (Leire): views everything, adds tasks on any team board, edits only her own tasks ──
reset role;
insert into profiles (full_name, email, role_title, is_coach) values ('Leire', 'leire@emet.invalid', 'Coach', true);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000007', 'leire@emet.invalid');
set role authenticated;
select t.login(7);
select t.check('Coach adds a task to the Marketing board',
  $$insert into cards (board_id, list_id, title, created_by)
    select b.id, l.id, 'Coach: prepare the pitch', my_profile_id()
      from boards b join board_lists l on l.board_id = b.id and l.name = 'To do' where b.slug = 'marketing'$$, 'ok');
select t.check('...and assigns Rocco to it',
  $$insert into card_assignees (card_id, user_id) select c.id, p.id from cards c, profiles p where c.title = 'Coach: prepare the pitch' and p.full_name = 'Rocco'$$, 'ok');
select t.check('...and can edit her own task',
  $$update cards set title = 'Coach: prepare the pitch deck' where title = 'Coach: prepare the pitch'$$, 'ok');
select t.assert('Coach sees the team''s work', t.num('select count(*) from cards') > 1);
select t.check('Coach cannot log a sale', $$insert into sales (description, amount) values ('x', 1)$$, 'denied');
select t.check('Coach cannot add a column to a team board',
  $$insert into board_lists (board_id, name) select id, 'Coach col' from boards where slug = 'marketing'$$, 'denied');
select t.login(3);
select t.check('Rocco makes a Marketing task', $$insert into cards (board_id, list_id, title, created_by)
    select b.id, l.id, 'Rocco task', my_profile_id() from boards b join board_lists l on l.board_id = b.id and l.name = 'To do' where b.slug = 'marketing'$$, 'ok');
select t.login(7);
select t.assert('Coach cannot change someone else''s task', t.num($$with u as (update cards set title = 'hacked' where title = 'Rocco task' returning 1) select count(*) from u$$) = 0);
select t.check('Coach cannot make herself admin', $$update profiles set is_admin = true where full_name = 'Leire'$$, 'denied');
reset role;
-- ── Task pop-up: the "you got a task" notification carries the due date ──
set role authenticated;
select t.login(4);
select t.check('Leader gives Rocco a dated task', $$insert into team_tasks (title, due_on) values ('Send the invoice', '2026-10-30')$$, 'ok');
select t.check('...to Rocco', $$insert into team_task_people (task_id, user_id) select tt.id, p.id from team_tasks tt, profiles p where tt.title = 'Send the invoice' and p.full_name = 'Rocco'$$, 'ok');
select t.login(3);
select t.assert('Rocco''s notification says when it is due', t.num($$select count(*) from notifications where kind = 'team_task' and data->>'title' = 'Send the invoice' and data->>'due' = '2026-10-30'$$) = 1);
select t.login(7);
select t.check('Coach dates her task', $$update cards set due_at = '2026-10-31T10:00:00Z' where title = 'Coach: prepare the pitch deck'$$, 'ok');
select t.check('...and assigns Emily', $$insert into card_assignees (card_id, user_id) select c.id, p.id from cards c, profiles p where c.title = 'Coach: prepare the pitch deck' and p.full_name = 'Emily'$$, 'ok');
select t.login(6);
select t.assert('Emily''s notification says when it is due', t.num($$select count(*) from notifications where kind = 'assigned' and data->>'due' like '2026-10-31%'$$) = 1);
reset role;
-- ── Subscriptions: repeating costs that book themselves as expenses ──
set role authenticated;
select t.login(2);  -- Stefan (Finance)
select t.check('Finance adds a monthly subscription', $$insert into subscriptions (name, amount, every, unit, starts_on) values ('Canva', 12, 1, 'month', (now() at time zone 'Europe/Madrid')::date)$$, 'ok');
select t.check('Finance adds a weekly one that started two weeks ago', $$insert into subscriptions (name, amount, every, unit, starts_on) values ('Ads', 5, 1, 'week', (now() at time zone 'Europe/Madrid')::date - 14)$$, 'ok');
select t.check('Amount must be above zero', $$insert into subscriptions (name, amount) values ('Free', 0)$$, 'denied');
select t.login(3);  -- Rocco (Marketing)
select t.assert('Members see the subscriptions', t.num('select count(*) from subscriptions') = 2);
select t.check('Members cannot add subscriptions', $$insert into subscriptions (name, amount) values ('x', 1)$$, 'denied');
select t.check('Members cannot delete subscriptions', $$delete from subscriptions$$, 'denied');
select t.check('Members cannot run the charges', $$select run_subscriptions()$$, 'denied');
select t.assert('Members charging now does nothing', t.num('select charge_subscriptions_now()') = 0);
select t.login(2);
select t.assert('Finance charging now books 4 expenses (1 Canva + 3 weekly)', t.num('select charge_subscriptions_now()') = 4);
select t.assert('...each one an expense linked to its subscription', t.num($$select count(*) from expenses where subscription_id is not null$$) = 4);
select t.assert('...dated on its own charge day', t.num($$select count(distinct date) from expenses e join subscriptions s on s.id = e.subscription_id where s.name = 'Ads'$$) = 3);
select t.assert('Running again books nothing twice', t.num('select charge_subscriptions_now()') = 0);
select t.assert('Canva''s next charge is one month later', t.num($$select count(*) from subscriptions where name = 'Canva' and next_charge_on = ((now() at time zone 'Europe/Madrid')::date + interval '1 month')::date$$) = 1);
reset role;
select t.assert('The daily job can run the charges', (select run_subscriptions()) = 0);
-- A charge whose day falls in a closed month is booked today instead
insert into month_locks (month) values (date_trunc('month', (now() at time zone 'Europe/Madrid')::date - interval '1 month')::date) on conflict do nothing;
set role authenticated;
select t.login(2);
select t.check('Finance adds one that was due last month', $$insert into subscriptions (name, amount, every, unit, starts_on) values ('Hosting', 3, 1, 'month', ((now() at time zone 'Europe/Madrid')::date - interval '1 month')::date)$$, 'ok');
select t.assert('Closed-month charge still books (2 charges)', t.num('select charge_subscriptions_now()') = 2);
select t.assert('...both dated today', t.num($$select count(*) from expenses e join subscriptions s on s.id = e.subscription_id where s.name = 'Hosting' and e.date = (now() at time zone 'Europe/Madrid')::date$$) = 2);
select t.check('Finance deletes a subscription we stopped paying', $$delete from subscriptions where name = 'Canva'$$, 'ok');
select t.assert('...and its past expenses stay in the books', t.num($$select count(*) from expenses where description = 'Canva'$$) = 1);
reset role;

-- ── Team tasks that need a file to finish ──
set role authenticated;
select t.login(4);  -- Lassi (Team Leader)
select t.check('Leader gives a task that needs a file', $$insert into team_tasks (title, needs_file) values ('Upload your flyer', true)$$, 'ok');
select t.check('...to Rocco', $$insert into team_task_people (task_id, user_id) select tt.id, p.id from team_tasks tt, profiles p where tt.title = 'Upload your flyer' and p.full_name = 'Rocco'$$, 'ok');
select t.login(3);  -- Rocco
select t.check('Rocco cannot finish it without a file', $$update team_task_people set done_at = now() where user_id = my_profile_id() and task_id = (select id from team_tasks where title = 'Upload your flyer')$$, 'denied');
select t.check('Rocco cannot point at a file that was never uploaded', $$update team_task_people set file_path = my_profile_id() || '/t/ghost.pdf', done_at = now() where user_id = my_profile_id() and task_id = (select id from team_tasks where title = 'Upload your flyer')$$, 'denied');
select t.check('Rocco uploads his file', $$insert into storage.objects (bucket_id, name) values ('task-files', my_profile_id() || '/t/flyer.pdf')$$, 'ok');
select t.check('Rocco cannot upload into someone else''s folder', $$insert into storage.objects (bucket_id, name) select 'task-files', id || '/t/x.pdf' from profiles where full_name = 'Stefan'$$, 'denied');
select t.check('Rocco hands it in with the file', $$update team_task_people set file_path = my_profile_id() || '/t/flyer.pdf', file_name = 'flyer.pdf', done_at = now() where user_id = my_profile_id() and task_id = (select id from team_tasks where title = 'Upload your flyer')$$, 'ok');
select t.check('Rocco cannot turn off "needs a file"', $$update team_tasks set needs_file = false where title = 'Upload your flyer'$$, 'denied');
select t.login(5);  -- Mario
select t.assert('Other members cannot open Rocco''s file', t.num($$select count(*) from storage.objects where bucket_id = 'task-files'$$) = 0);
select t.login(4);
select t.assert('The leader can open it', t.num($$select count(*) from storage.objects where bucket_id = 'task-files'$$) = 1);
select t.check('Normal tasks still tick without a file', $$insert into team_tasks (title) values ('Just tick it')$$, 'ok');
reset role;
-- ── Training leaders: one or more people lead training for a whole week (Mon–Sun) ──
set role authenticated;
select t.login(1);  -- Alvaro (admin)
select t.check('Admin sets Lassi and Rocco as next week''s leaders', $$insert into training_leaders (week_start, user_id) select '2026-10-26', id from profiles where full_name in ('Lassi', 'Rocco')$$, 'ok');
select t.check('A week must start on a Monday', $$insert into training_leaders (week_start, user_id) select '2026-10-27', id from profiles where full_name = 'Emily'$$, 'denied');
select t.check('Nobody is added twice to the same week', $$insert into training_leaders (week_start, user_id) select '2026-10-26', id from profiles where full_name = 'Lassi'$$, 'denied');
select t.login(3);  -- Rocco
select t.assert('Everyone sees the training leaders', t.num('select count(*) from training_leaders') = 2);
select t.check('Members cannot set leaders', $$insert into training_leaders (week_start, user_id) select '2026-11-02', my_profile_id()$$, 'denied');
select t.check('Members cannot remove leaders', $$delete from training_leaders$$, 'denied');
select t.check('Members cannot run the Monday reminder', $$select notify_training_leaders('2026-10-26')$$, 'denied');
reset role;
select t.assert('Monday: both leaders are told', (select notify_training_leaders('2026-10-26')) = 2);
select t.assert('...only once', (select notify_training_leaders('2026-10-26')) = 0);
select t.assert('Other days: nobody is told', (select notify_training_leaders('2026-10-27')) = 0);
set role authenticated;
select t.login(3);
select t.assert('Rocco got "you lead training this week"', t.num($$select count(*) from notifications where kind = 'training_lead' and data->>'week' = '2026-10-26'$$) = 1);
select t.login(1);
select t.check('Admin removes a leader from a week', $$delete from training_leaders where week_start = '2026-10-26' and user_id = (select id from profiles where full_name = 'Rocco')$$, 'ok');
reset role;
-- ── Project plan: expected revenue (goal), expected profit and budget, editable by Finance ──
set role authenticated;
select t.login(2);  -- Stefan (Finance)
select t.check('Finance sets a project''s expected revenue, profit and budget', $$update projects set goal = 2000, expected_profit = 600, budget = 400 where name = 'Campus stall'$$, 'ok');
select t.assert('...and it is saved', t.num($$select count(*) from projects where name = 'Campus stall' and goal = 2000 and expected_profit = 600 and budget = 400$$) = 1);
select t.assert('Finance sees projects they are not a member of', t.num($$select count(*) from projects p where name = 'Campus stall' and not exists (select 1 from project_members m where m.project_id = p.id and m.user_id = my_profile_id())$$) = 1);
select t.login(3);  -- Rocco (Marketing)
select t.check('Others cannot change the plan', $$update projects set expected_profit = 1 where name = 'Campus stall'$$, 'denied');
reset role;
-- ── Presence: "last active" = last time someone had emet open (not only the last logged change) ──
set role authenticated;
select t.login(3);  -- Rocco
select t.check('Opening emet records that I was here', $$select touch_presence()$$, 'ok');
select t.assert('...once per person', t.num('select count(*) from presence where user_id = my_profile_id()') = 1);
select t.check('Nobody can fake someone else''s visit', $$insert into presence (user_id, last_seen_at) select id, now() from profiles where full_name = 'Stefan'$$, 'denied');
select t.check('Nobody can change someone else''s visit', $$update presence set last_seen_at = now() - interval '9 days'$$, 'denied');
select t.login(2);  -- Stefan
select t.assert('Team members see when others were last here', t.num('select count(*) from presence') = 1);
reset role;
-- ── Points: community points, customer visits, learning points (each person logs their own) ──
set role authenticated;
select t.login(3);  -- Rocco
select t.check('Rocco logs a customer visit', $$insert into member_points (kind, amount, note) values ('visit', 1, 'Café Iruña')$$, 'ok');
select t.check('...and 2 community points', $$insert into member_points (kind, amount) values ('community', 2)$$, 'ok');
select t.check('Only the three kinds exist', $$insert into member_points (kind, amount) values ('bonus', 1)$$, 'denied');
select t.check('No zero or negative points', $$insert into member_points (kind, amount) values ('learning', 0)$$, 'denied');
select t.check('Nobody logs points for someone else', $$insert into member_points (user_id, kind, amount) select id, 'visit', 1 from profiles where full_name = 'Stefan'$$, 'denied');
select t.login(2);  -- Stefan
select t.assert('Everyone sees everyone''s points', t.num($$select coalesce(sum(amount), 0) from member_points p join profiles r on r.id = p.user_id where r.full_name = 'Rocco'$$) = 3);
select t.check('Others cannot change my points', $$update member_points set amount = 50$$, 'denied');
select t.check('Others cannot delete my points', $$delete from member_points$$, 'denied');
select t.login(3);
select t.check('Rocco fixes his own entry', $$update member_points set amount = 3 where kind = 'community'$$, 'ok');
select t.check('...and deletes one', $$delete from member_points where kind = 'visit'$$, 'ok');
reset role;
-- ── Scout for everyone: anyone can scout their own project; selling teams can scout all ──
set role authenticated;
select t.login(2);  -- Stefan (Finance, not a selling team)
select t.check('Anyone creates their own Scout project', $$insert into scout_projects (title, offer, niche) values ('Stefan idea', 'Bookkeeping help', 'small shops')$$, 'ok');
select t.assert('...and may scout it', t.num($$select count(*) from scout_projects where title = 'Stefan idea' and can_scout_project(id)$$) = 1);
select t.check('...starts a search in it', $$insert into scout_searches (project_id, country_code, city) select id, 'ES', 'Bilbao' from scout_projects where title = 'Stefan idea'$$, 'ok');
select t.check('...saves a place it found', $$insert into scout_places (fingerprint, name) values ('stefan-shop-1', 'Tienda Uno')$$, 'ok');
select t.check('...and judges it as a lead', $$insert into scout_leads (project_id, place_id, score) select p.id, pl.id, 70 from scout_projects p, scout_places pl where p.title = 'Stefan idea' and pl.fingerprint = 'stefan-shop-1'$$, 'ok');
select t.check('...renames their own project', $$update scout_projects set title = 'Stefan idea v2' where title = 'Stefan idea'$$, 'ok');
select t.check('Cannot change someone else''s Scout project', $$update scout_projects set title = 'x' where title = 'Café content'$$, 'denied');
select t.check('Can search in someone else''s shared Scout project', $$insert into scout_searches (project_id, country_code, city) select id, 'ES', 'Vitoria' from scout_projects where title = 'Café content'$$, 'ok');
select t.check('...and its search can save leads there', $$insert into scout_leads (project_id, place_id) select p.id, pl.id from scout_projects p, scout_places pl where p.title = 'Café content' and pl.fingerprint = 'stefan-shop-1'$$, 'ok');
select t.login(7);  -- Leire (coach, no group, not a selling team)
select t.check('Others cannot change my Scout project', $$update scout_projects set title = 'hijack' where title = 'Stefan idea v2'$$, 'denied');
select t.check('...nor delete it', $$delete from scout_projects where title = 'Stefan idea v2'$$, 'denied');
select t.login(2);
select t.check('Stefan shares his Scout project with the team', $$update scout_projects set shared = true where title = 'Stefan idea v2'$$, 'ok');
select t.login(3);  -- Rocco (Marketing)
select t.check('Selling teams work on shared Scout projects', $$update scout_projects set niche = 'shops' where title = 'Stefan idea v2'$$, 'ok');
reset role;

-- ── Project leads: places people found themselves, visited or not, and how it went ──
set role authenticated;
select t.login(1);
select t.check('Leader adds Rocco to Campus stall', $$insert into project_members (project_id, user_id) select p.id, r.id from projects p, profiles r where p.name = 'Campus stall' and r.full_name = 'Rocco'$$, 'ok');
select t.login(3);  -- Rocco, project member
select t.check('A project member adds a place to visit', $$insert into project_places (project_id, name, address) select id, 'Bar Txoko', 'Calle Mayor 3' from projects where name = 'Campus stall'$$, 'ok');
select t.check('...marks it visited: a yes', $$update project_places set visited_on = current_date, visit_result = 'yes', visit_note = 'Wants 20 units' where name = 'Bar Txoko'$$, 'ok');
select t.check('Only yes / maybe / no', $$update project_places set visit_result = 'great' where name = 'Bar Txoko'$$, 'denied');
select t.check('Nobody adds a place for someone else', $$insert into project_places (project_id, name, added_by) select p.id, 'x', r.id from projects p, profiles r where p.name = 'Campus stall' and r.full_name = 'Stefan'$$, 'denied');
select t.login(6);  -- Emily, not in the project
select t.assert('Outsiders don''t see the project''s places', t.num('select count(*) from project_places') = 0);
select t.check('Outsiders cannot add places', $$insert into project_places (project_id, name) select id, 'x' from projects where name = 'Campus stall'$$, 'denied');
reset role;
update scout_leads set saved_project_id = (select id from projects where name = 'Campus stall') where place_id = (select id from scout_places where fingerprint = 'stefan-shop-1');
set role authenticated;
select t.login(6);
select t.check('Outsiders cannot mark a Scout lead visited', $$select mark_lead_visit((select id from scout_leads where saved_project_id is not null limit 1), current_date, 'no', null)$$, 'denied');
select t.login(3);
select t.check('A project member marks a Scout lead visited: maybe', $$select mark_lead_visit((select id from scout_leads where saved_project_id is not null limit 1), current_date, 'maybe', 'Call back Friday')$$, 'ok');
select t.assert('...and it is saved', t.num($$select count(*) from scout_leads where visit_result = 'maybe' and visited_on is not null$$) = 1);
select t.check('...and can undo it', $$select mark_lead_visit((select id from scout_leads where saved_project_id is not null limit 1), null, null, null)$$, 'ok');
reset role;
-- ── Points: a file (e.g. the post-mortem) on an entry ──
set role authenticated;
select t.login(3);  -- Rocco
select t.check('Rocco uploads his post-mortem', $$insert into storage.objects (bucket_id, name) values ('point-files', my_profile_id() || '/postmortem.pdf')$$, 'ok');
select t.check('...and logs community points with it', $$insert into member_points (kind, amount, file_path, file_name) values ('community', 1, my_profile_id() || '/postmortem.pdf', 'postmortem.pdf')$$, 'ok');
select t.check('A file must be in my own folder', $$insert into member_points (kind, amount, file_path) select 'community', 1, id || '/x.pdf' from profiles where full_name = 'Stefan'$$, 'denied');
select t.check('Nobody uploads into someone else''s folder', $$insert into storage.objects (bucket_id, name) select 'point-files', id || '/x.pdf' from profiles where full_name = 'Stefan'$$, 'denied');
select t.login(2);
select t.assert('Team members can open the post-mortem', t.num($$select count(*) from storage.objects where bucket_id = 'point-files'$$) = 1);
reset role;

-- ── Scout privacy: new Scout projects are private until shared ──
set role authenticated;
select t.login(7);  -- Leire
select t.check('Leire makes a private Scout project', $$insert into scout_projects (title, offer, niche) values ('Leire secret', 'Coaching', 'startups')$$, 'ok');
select t.check('...with a search', $$insert into scout_searches (project_id, country_code, city) select id, 'ES', 'Bilbao' from scout_projects where title = 'Leire secret'$$, 'ok');
select t.check('...and a lead', $$insert into scout_leads (project_id, place_id, score) select p.id, pl.id, 50 from scout_projects p, scout_places pl where p.title = 'Leire secret' and pl.fingerprint = 'stefan-shop-1'$$, 'ok');
select t.login(3);  -- Rocco (selling team)
select t.assert('Others don''t see a private Scout project', t.num($$select count(*) from scout_projects where title = 'Leire secret'$$) = 0);
select t.assert('...nor its searches', t.num($$select count(*) from scout_searches s join scout_projects p on p.id = s.project_id where p.created_by = (select id from profiles where full_name = 'Leire')$$) = 0);
select t.assert('...nor its leads', t.num($$select count(*) from scout_leads where score = 50$$) = 0);
select t.check('...nor change it, even a selling team', $$update scout_projects set niche = 'x' where title = 'Leire secret'$$, 'denied');
select t.login(1);  -- admin
select t.assert('Private means private, even for admins', t.num($$select count(*) from scout_projects where title = 'Leire secret'$$) = 0);
select t.login(7);
select t.check('Leire shares it', $$update scout_projects set shared = true where title = 'Leire secret'$$, 'ok');
select t.login(3);
select t.assert('Once shared, the team sees it', t.num($$select count(*) from scout_projects where title = 'Leire secret'$$) = 1);
select t.assert('...and its leads', t.num($$select count(*) from scout_leads where score = 50$$) = 1);
reset role;

-- ── Save several Scout leads to a project at once ──
set role authenticated;
select t.login(2);  -- Stefan: his Scout project, not a member of Campus stall
select t.check('Cannot add leads to a project I am not in', $$select save_leads_to_project(array(select id from scout_leads where project_id = (select id from scout_projects where title = 'Stefan idea v2')), (select id from projects where name = 'Campus stall'))$$, 'denied');
reset role;
insert into project_members (project_id, user_id) select p.id, r.id from projects p, profiles r where p.name = 'Campus stall' and r.full_name = 'Stefan';
update scout_leads set saved_project_id = null;
set role authenticated;
select t.login(2);
select t.assert('Stefan adds his leads to Campus stall in one go', (select save_leads_to_project(array(select id from scout_leads where project_id = (select id from scout_projects where title = 'Stefan idea v2')), (select id from projects where name = 'Campus stall'))) = 1);
select t.check('Can add leads from a shared Scout project to my project', $$select save_leads_to_project(array(select id from scout_leads where score = 50), (select id from projects where name = 'Campus stall'))$$, 'ok');
select t.login(3);  -- Rocco, Campus stall member
select t.assert('Project members see the saved leads', t.num($$select count(*) from scout_leads where saved_project_id = (select id from projects where name = 'Campus stall')$$) = 2);
reset role;

-- ── My board: a personal task board only its owner can see ──
set role authenticated;
select t.login(3);  -- Rocco
select t.assert('Rocco gets his own board', (select my_board()) is not null);
select t.assert('...the same one every time', (select my_board()) = (select my_board()));
select t.assert('...with To do, Doing, Done', t.num($$select count(*) from board_lists where board_id = my_board()$$) = 3);
select t.check('Rocco adds a private task', $$insert into cards (board_id, list_id, title, created_by) select my_board(), id, 'Buy a birthday present', my_profile_id() from board_lists where board_id = my_board() and name = 'To do'$$, 'ok');
select t.check('...moves it', $$update cards set list_id = (select id from board_lists where board_id = my_board() and name = 'Doing') where title = 'Buy a birthday present'$$, 'ok');
select t.check('...adds a column', $$insert into board_lists (board_id, name, position) values (my_board(), 'Someday', 9)$$, 'ok');
select t.check('...can be assigned to it himself', $$insert into card_assignees (card_id, user_id) select id, my_profile_id() from cards where title = 'Buy a birthday present'$$, 'ok');
select t.check('...but cannot assign anyone else (that would reveal it)', $$insert into card_assignees (card_id, user_id) select c.id, p.id from cards c, profiles p where c.title = 'Buy a birthday present' and p.full_name = 'Stefan'$$, 'denied');
select t.login(1);  -- admin
select t.assert('Nobody else sees the task, not even an admin', t.num($$select count(*) from cards where title = 'Buy a birthday present'$$) = 0);
select t.assert('...nor the board', t.num($$select count(*) from boards b join profiles p on p.id = b.owner_id where p.full_name = 'Rocco'$$) = 0);
select t.check('...nor change it', $$update cards set title = 'x' where title = 'Buy a birthday present'$$, 'denied');
select t.assert('...and it never reaches the activity feed', t.num($$select count(*) from activity_log where summary::text like '%birthday%'$$) = 0);
select t.check('Nobody adds tasks to someone else''s board', $$insert into cards (board_id, list_id, title) select b.id, l.id, 'x' from boards b join board_lists l on l.board_id = b.id join profiles p on p.id = b.owner_id where p.full_name = 'Rocco' limit 1$$, 'denied');
reset role;
select t.assert('The weekly report skips private boards', (select count(*) from cards c join boards b on b.id = c.board_id where b.owner_id is null and c.title = 'Buy a birthday present') = 0);
-- ── Phone notifications (web push) ──
set role authenticated;
select t.login(3);  -- Rocco
select t.check('Rocco turns on phone notifications', $$select save_push_subscription('https://push.example/rocco-1', 'p256', 'auth')$$, 'ok');
select t.assert('...his phone is saved once', t.num($$select count(*) from push_subscriptions where user_id = my_profile_id()$$) = 1);
select t.check('Push addresses must be https', $$select save_push_subscription('http://evil.example/x', 'p', 'a')$$, 'denied');
select t.login(2);  -- Stefan
select t.assert('Nobody sees someone else''s phones', t.num('select count(*) from push_subscriptions') = 0);
select t.check('Nobody removes someone else''s phone', $$delete from push_subscriptions$$, 'denied');
select t.check('Same phone, new person (shared device): it moves to them', $$select save_push_subscription('https://push.example/rocco-1', 'p256', 'auth')$$, 'ok');
select t.assert('...and is now Stefan''s', t.num('select count(*) from push_subscriptions') = 1);
select t.check('Stefan turns them off', $$delete from push_subscriptions where endpoint = 'https://push.example/rocco-1'$$, 'ok');
reset role;
select t.assert('Phone pushes are only for tasks, projects and deadlines',
  push_worthy('assigned', '{}') and push_worthy('team_task', '{}') and push_worthy('due_soon', '{}') and push_worthy('project_added', '{}')
  and push_worthy('project_post', '{"what":"project_files"}') and not push_worthy('project_post', '{"what":"project_links"}') and not push_worthy('card_comment', '{}'));
-- One day before: team-leader tasks get the reminder too (not only board tasks)
set role authenticated;
select t.login(4);  -- Lassi
select t.check('Leader gives a task due tomorrow', $$insert into team_tasks (title, due_on) values ('Hand in the survey', (now() at time zone 'Europe/Madrid')::date + 1)$$, 'ok');
select t.check('...to Rocco', $$insert into team_task_people (task_id, user_id) select tt.id, p.id from team_tasks tt, profiles p where tt.title = 'Hand in the survey' and p.full_name = 'Rocco'$$, 'ok');
reset role;
select t.assert('The daily job reminds Rocco: 1 day left', (select notify_due_tomorrow()) >= 1);
select t.assert('...exactly once', (select count(*) from notifications n join profiles p on p.id = n.user_id where p.full_name = 'Rocco' and n.kind = 'due_soon' and n.data->>'title' = 'Hand in the survey') = 1);
select notify_due_tomorrow();
select t.assert('...even if the job runs twice', (select count(*) from notifications n join profiles p on p.id = n.user_id where p.full_name = 'Rocco' and n.kind = 'due_soon' and n.data->>'title' = 'Hand in the survey') = 1);
select t.assert('Push calls with a wrong secret are refused', not check_push_secret('x') and not check_push_secret(repeat('a', 64)));
set role authenticated;
select t.login(1);
select t.check('Members cannot test push secrets', $$select check_push_secret(repeat('a', 64))$$, 'denied');
reset role;
-- ── Private Scout projects stay private for searches too ──
set role authenticated;
select t.login(7);  -- Leire
select t.check('Leire makes a second, private Scout project', $$insert into scout_projects (title, offer, niche) values ('Leire private 2', 'x', 'y')$$, 'ok');
select t.login(2);
select t.check('Nobody else can search in a private Scout project', $$insert into scout_searches (project_id, country_code, city) select id, 'ES', 'Bilbao' from scout_projects where title = 'Leire private 2'$$, 'denied');
select t.check('...even knowing its id', $$insert into scout_searches (project_id, country_code, city) select id, 'ES', 'Bilbao' from scout_projects where created_by = (select id from profiles where full_name = 'Leire') and not shared$$, 'denied');
select t.check('...nor write leads into it', $$insert into scout_leads (project_id, place_id) select p.id, pl.id from scout_projects p, scout_places pl where p.title = 'Leire private 2' and pl.fingerprint = 'stefan-shop-1'$$, 'denied');
reset role;

-- ── Sunday: everyone learns next week's training leaders ──
reset role;
delete from training_leaders;
insert into training_leaders (week_start, user_id) select '2026-11-02', id from profiles where full_name in ('Lassi', 'Rocco');
select t.assert('On Sunday everyone is told who leads training next week', (select notify_training_week('2026-11-01')) > 1);
select t.assert('...with the names', (select count(*) from notifications where kind = 'training_week' and data->>'names' like '%Lassi%' and data->>'names' like '%Rocco%') > 1);
select t.assert('...once', (select notify_training_week('2026-11-01')) = 0);
select t.assert('Not on other days', (select notify_training_week('2026-11-02')) = 0);
select t.assert('Nothing when nobody is set for next week', (select notify_training_week('2026-11-08')) = 0);
select t.assert('It goes to phones too', push_worthy('training_week', '{}') and push_worthy('training_lead', '{}'));
set role authenticated;
select t.login(3);
select t.check('Members cannot send it', $$select notify_training_week('2026-11-01')$$, 'denied');
reset role;
-- ── Scout hook (reason to contact today) is stored with the lead ──
set role authenticated;
select t.login(3);
select t.check('A lead keeps its hook', $$update scout_leads set hook = '{"kind":"hiring","text":"Buscan camarero"}' where saved_project_id is not null$$, 'ok');
select t.assert('...readable by the team', t.num($$select count(*) from scout_leads where hook->>'kind' = 'hiring'$$) >= 1);
reset role;
-- ── Leaders: group leaders use the Team Leaders tools (not full admin) ──
set role authenticated;
select t.login(1);  -- Alvaro (admin)
select t.check('Admin marks Rocco as a leader', $$update profiles set is_leader = true where full_name = 'Rocco'$$, 'ok');
select t.login(3);  -- Rocco
select t.assert('Rocco is a leader now', (select is_leader()));
select t.check('A leader cannot make others leaders', $$update profiles set is_leader = true where full_name = 'Emily'$$, 'denied');
select t.check('Leaders give tasks', $$insert into team_tasks (title) values ('Leader task from Rocco')$$, 'ok');
select t.check('Leaders set training leaders', $$insert into training_leaders (week_start, user_id) select '2026-11-09', id from profiles where full_name = 'Emily'$$, 'ok');
select t.check('...but are not admins (cannot create projects)', $$insert into projects (name) values ('Rocco project')$$, 'denied');
select t.login(6);  -- Emily
select t.assert('Emily is not a leader', not (select is_leader()));
select t.check('Members cannot make themselves leaders', $$update profiles set is_leader = true where id = my_profile_id()$$, 'denied');
reset role;

-- ── Strikes: 1 for normal, 3 for big; late arrival also €3; 3 strikes in a quarter = the €75 punishment ──
set role authenticated;
select t.login(3);  -- Rocco, leader
select t.check('Leader gives Emily a strike for sleeping in class', $$insert into strikes (user_id, kind, happened_on) select id, 'sleeping', '2026-10-27' from profiles where full_name = 'Emily'$$, 'ok');
select t.check('...and one for arriving 10+ min late', $$insert into strikes (user_id, kind, happened_on) select id, 'late_arrival', '2026-10-27' from profiles where full_name = 'Emily'$$, 'ok');
select t.assert('Late arrival counts 1 and costs €3', t.num($$select count(*) from strikes where kind = 'late_arrival' and weight = 1 and fine = 3$$) = 1);
select t.assert('No punishment yet at 2 strikes', t.num($$select count(*) from strike_punishments$$) = 0);
select t.check('Missing a validation is 3 strikes', $$insert into strikes (user_id, kind, happened_on) select id, 'missed_validation', '2026-10-28' from profiles where full_name = 'Emily'$$, 'ok');
select t.assert('...weight 3', t.num($$select count(*) from strikes where kind = 'missed_validation' and weight = 3$$) = 1);
select t.assert('Reaching 3 strikes creates the punishment', t.num($$select count(*) from strike_punishments$$) = 1);
select t.assert('...due 2 days after she is told', t.num($$select count(*) from strike_punishments where due_on = told_on + 2$$) = 1);
select t.check('Only known kinds', $$insert into strikes (user_id, kind) select id, 'bad_vibes' from profiles where full_name = 'Emily'$$, 'denied');
select t.check('Missing a customer deadline is 3 more', $$insert into strikes (user_id, kind, happened_on) select id, 'missed_customer_deadline', '2026-10-28' from profiles where full_name = 'Emily'$$, 'ok');
select t.assert('6+ strikes in a quarter: a second punishment', t.num($$select count(*) from strike_punishments$$) = 2);
select t.check('Leader marks the €3 paid', $$update strikes set paid_at = now() where kind = 'late_arrival'$$, 'ok');
select t.check('A strike given by mistake is removed', $$delete from strikes where kind = 'missed_customer_deadline'$$, 'ok');
select t.assert('...and its extra punishment goes with it', t.num($$select count(*) from strike_punishments$$) = 1);
select t.check('Leader marks the punishment done (€75 brought)', $$update strike_punishments set done_at = now()$$, 'ok');
select t.check('An old strike from last quarter', $$insert into strikes (user_id, kind, happened_on) select id, 'phone', '2026-09-15' from profiles where full_name = 'Emily'$$, 'ok');
select t.assert('Every 3 months it starts again from 0', (select strike_total(id, '2026-10-28') from profiles where full_name = 'Emily') = 5
  and (select strike_total(id, '2026-09-30') from profiles where full_name = 'Emily') = 1);
select t.login(6);  -- Emily
select t.assert('Emily is told about her strikes and the punishment', t.num($$select count(*) from notifications where kind in ('strike', 'punishment')$$) >= 4);
select t.check('Emily cannot mark her own €3 unpaid/paid', $$update strikes set paid_at = null$$, 'denied');
select t.check('...nor delete a strike', $$delete from strikes$$, 'denied');
select t.check('...nor give one', $$insert into strikes (user_id, kind) select id, 'phone' from profiles where full_name = 'Stefan'$$, 'denied');
select t.login(2);  -- Stefan, member view
select t.assert('Everyone can see strikes', t.num($$select count(*) from strikes s join profiles p on p.id = s.user_id where p.full_name = 'Emily'$$) = 4);
select t.assert('Strikes and punishments reach phones', push_worthy('strike', '{}') and push_worthy('punishment', '{}'));
reset role;

-- ── Coach: sees every project and what people work on, changes nothing ──
set role authenticated;
select t.login(7);  -- Leire
select t.assert('Coach sees projects she is not in', t.num($$select count(*) from projects p where name = 'Campus stall' and not exists (select 1 from project_members m where m.project_id = p.id and m.user_id = my_profile_id())$$) = 1);
select t.assert('...and who is in them', t.num('select count(*) from project_members') > 0);
select t.check('Coach cannot change a project', $$update projects set name = 'x'$$, 'denied');
select t.check('Coach cannot post in a project', $$insert into project_updates (project_id, body, created_by) select id, 'hi', my_profile_id() from projects limit 1$$, 'denied');
select t.check('Coach cannot add project places', $$insert into project_places (project_id, name) select id, 'x' from projects limit 1$$, 'denied');
reset role;
