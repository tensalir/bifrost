-- Store client/split-engine assignment id so GET can return stable ids.
alter table briefing_assignments add column if not exists client_id text;
create unique index if not exists idx_briefing_assignments_sprint_client
  on briefing_assignments(sprint_id, client_id) where client_id is not null;
