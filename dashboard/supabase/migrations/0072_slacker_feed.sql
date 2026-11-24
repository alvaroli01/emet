-- Alvaro, 2026-11-24: Exposing Slackers proof fills itself from what people do in emet (tasks, files they upload,
-- visits, notes, ideas, leads, sales…), so nobody has to type it. One row per thing, per person, for one Mon–Sun week.
-- Files come with their bucket + path; the page opens them with the viewer's own rights (storage RLS still applies).
-- Project things only show for projects the viewer can see. Private ("My board", personal documents) never show.

create or replace function public.slacker_feed(ws date)
returns table (user_id uuid, kind text, title text, detail text, at timestamptz, bucket text, path text, link text)
language sql stable security definer set search_path = '' as $$
  with w as (select (ws::timestamp at time zone 'Europe/Madrid') as t0, ((ws + 7)::timestamp at time zone 'Europe/Madrid') as t1)
  select * from (
    -- Tasks finished (their own part), with the hand-in file if any
    select a.user_id, 'task', c.title, null::text, coalesce(a.done_at, c.completed_at), case when a.file_path is not null then 'task-files' end, a.file_path, null::text
    from public.card_assignees a join public.cards c on c.id = a.card_id join public.boards b on b.id = c.board_id and b.owner_id is null, w
    where coalesce(a.done_at, c.completed_at) >= w.t0 and coalesce(a.done_at, c.completed_at) < w.t1
      and (b.project_id is null or public.can_view_project(b.project_id))
    union all -- Company documents uploaded
    select d.uploaded_by, 'file', d.name, null, d.created_at, 'documents', d.path, null
    from public.doc_files d, w where d.scope = 'company' and d.created_at >= w.t0 and d.created_at < w.t1
    union all -- Project files uploaded
    select f.uploaded_by, 'file', f.name, pr.name, f.created_at, 'projects', f.path, null
    from public.project_files f join public.projects pr on pr.id = f.project_id, w
    where f.created_at >= w.t0 and f.created_at < w.t1 and public.can_view_project(f.project_id)
    union all -- Customer visits, community and learning points (with their file / link)
    select m.user_id, m.kind, coalesce(nullif(m.note, ''), m.kind), m.amount::text, (m.happened_on::timestamp at time zone 'Europe/Madrid'), case when m.file_path is not null then 'point-files' end, m.file_path, m.link
    from public.member_points m where m.happened_on >= ws and m.happened_on < ws + 7
    union all -- Meeting notes written
    select n.created_by, 'meeting', left(coalesce(nullif(n.notes, ''), 'Meeting notes'), 140), n.meeting_date::text, n.created_at, null, null, null
    from public.meeting_notes n, w where n.created_at >= w.t0 and n.created_at < w.t1
    union all -- Ideas pitched in the Idea lab
    select i.created_by, 'idea', i.title, i.score::text, i.created_at, null, null, null
    from public.lab_ideas i, w where i.created_at >= w.t0 and i.created_at < w.t1
    union all -- Scout leads worked (contacted, meeting, won, lost or visited)
    select l.owner_id, 'lead', p.name, coalesce(l.visit_result, l.status), l.updated_at, null, null, null
    from public.scout_leads l join public.scout_places p on p.id = l.place_id, w
    where l.updated_at >= w.t0 and l.updated_at < w.t1 and l.status not in ('new', 'ignored')
    union all -- Sales
    select coalesce(s.rep_id, s.logged_by), 'sale', coalesce(nullif(s.description, ''), 'Sale'), s.amount::text, s.created_at, null, null, null
    from public.sales s where s.date >= ws and s.date < ws + 7 and s.reverses_id is null and s.amount > 0
    union all -- Posts published
    select c.owner_id, 'post', coalesce(nullif(c.title, ''), c.platform), c.platform, c.posted_at, null, null, null
    from public.content_posts c, w where c.posted_at >= w.t0 and c.posted_at < w.t1
    union all -- Project updates
    select u.created_by, 'update', left(u.body, 140), pr.name, u.created_at, null, null, null
    from public.project_updates u join public.projects pr on pr.id = u.project_id, w
    where u.created_at >= w.t0 and u.created_at < w.t1 and public.can_view_project(u.project_id)
    union all -- New prospects added
    select pp.owner_id, 'prospect', pp.name, pp.stage, pp.created_at, null, null, null
    from public.prospects pp, w where pp.created_at >= w.t0 and pp.created_at < w.t1
    union all -- Fines and strikes (proof works both ways)
    select k.user_id, 'strike', coalesce(nullif(k.note, ''), k.kind), k.fine::text, (k.happened_on::timestamp at time zone 'Europe/Madrid'), null, null, null
    from public.strikes k where k.happened_on >= ws and k.happened_on < ws + 7
  ) x(user_id, kind, title, detail, at, bucket, path, link)
  where x.user_id is not null and (public.is_member() or public.is_coach())
  order by x.at
$$;
revoke execute on function public.slacker_feed(date) from public, anon;
grant execute on function public.slacker_feed(date) to authenticated;
