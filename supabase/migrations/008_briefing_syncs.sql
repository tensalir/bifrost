-- Plugin sync tracking: log when Monday briefings are synced into Figma (for versioning later).
create table if not exists briefing_syncs (
  id                uuid primary key default gen_random_uuid(),
  monday_item_id    text not null,
  monday_board_id   text not null,
  monday_item_name  text not null,
  batch_canonical   text not null,
  figma_file_key    text not null,
  figma_page_id     text,
  figma_page_name   text,
  synced_at         timestamptz not null default now(),
  monday_snapshot   jsonb,
  version           int not null default 1,
  sync_status       text not null default 'synced',
  unique(monday_item_id, figma_file_key)
);

create index if not exists idx_briefing_syncs_figma_file on briefing_syncs(figma_file_key);
create index if not exists idx_briefing_syncs_monday_item on briefing_syncs(monday_item_id);
