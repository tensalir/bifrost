-- Flexible sprint batches: batch_type (monthly vs campaign), assignment source, per-assignment board target.

-- a) batch_type on briefing_sprint_batches
alter table briefing_sprint_batches
  add column if not exists batch_type text not null default 'monthly'
  check (batch_type in ('monthly', 'campaign'));

-- b) source on briefing_assignments
alter table briefing_assignments
  add column if not exists source text not null default 'split'
  check (source in ('split', 'imported', 'manual'));

-- c) target_board_id on briefing_assignments (per-assignment board override)
alter table briefing_assignments
  add column if not exists target_board_id text;
