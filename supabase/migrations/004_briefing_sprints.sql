-- Briefing Assistant: sprints (Creative Strategy sprints), linked batches, and assignments.
-- A sprint can span multiple batches; each batch links to a Monday board and Figma file.

create table if not exists briefing_sprints (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists briefing_sprint_batches (
  id                uuid primary key default gen_random_uuid(),
  sprint_id         uuid not null references briefing_sprints(id) on delete cascade,
  batch_key         text not null,
  batch_label       text not null,
  monday_board_id   text,
  figma_file_key    text,
  created_at        timestamptz not null default now(),
  unique(sprint_id, batch_key)
);

create table if not exists briefing_assignments (
  id                 uuid primary key default gen_random_uuid(),
  sprint_id          uuid not null references briefing_sprints(id) on delete cascade,
  batch_key          text not null,
  content_bucket     text not null check (content_bucket in ('bau', 'native_style', 'experimental')),
  ideation_starter   text not null default '',
  product_or_use_case text not null,
  brief_owner        text not null default '',
  agency_ref         text not null,
  asset_count        int not null check (asset_count >= 1),
  format             text not null,
  funnel             text not null,
  campaign_partnership text,
  brief_name         text not null,
  monday_item_id     text,
  figma_page_url     text,
  status             text not null default 'draft' check (status in ('draft', 'edited', 'approved', 'synced_to_monday', 'queued')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_briefing_sprint_batches_sprint on briefing_sprint_batches(sprint_id);
create index if not exists idx_briefing_assignments_sprint on briefing_assignments(sprint_id);
create index if not exists idx_briefing_assignments_batch on briefing_assignments(sprint_id, batch_key);
