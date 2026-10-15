-- Removes ALL demo data again (sales, expenses, tasks, team tasks, blockers, decisions, prospects, complaints, stock, content, DMs, links, morale).
begin;
delete from inquiries where handle like '[DEMO]%';
delete from sales where description like '[DEMO]%';
delete from expenses where description like '[DEMO]%';
delete from cards where title like '[DEMO]%';
delete from team_tasks where title like '[DEMO]%';
delete from blockers where description like '[DEMO]%';
delete from decisions where decision like '[DEMO]%';
delete from prospects where name like '[DEMO]%';
delete from complaints where customer like '[DEMO]%';
delete from inventory where product like '[DEMO]%';
delete from content_items where title like '[DEMO]%';
delete from go_links where slug like 'demo-%';
delete from morale_checks where comment = '[DEMO]';
delete from activity_log where summary::text like '%[DEMO]%';
delete from notifications where data::text like '%[DEMO]%';
commit;
