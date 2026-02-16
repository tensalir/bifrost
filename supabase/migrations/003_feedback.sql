-- Stakeholder feedback consolidation (replaces Excel sheet)
-- feedback_rounds: e.g. "WC 9th Feb 2026"
-- feedback_experiments: one per Monday item, grouped by agency
-- feedback_entries: Strategy / Design / Copy feedback per experiment

create table if not exists feedback_rounds (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  monday_board_id text not null,
  created_at      timestamptz not null default now()
);

create table if not exists feedback_experiments (
  id               uuid primary key default gen_random_uuid(),
  round_id         uuid not null references feedback_rounds(id) on delete cascade,
  monday_item_id   text not null,
  experiment_name  text not null default '',
  agency           text not null default '',
  brief_link       text,
  is_urgent        boolean not null default false,
  figma_accessible boolean not null default false,
  sent_to_monday   boolean not null default false,
  sent_at          timestamptz,
  summary_cache    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(round_id, monday_item_id)
);

create table if not exists feedback_entries (
  id            uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references feedback_experiments(id) on delete cascade,
  role          text not null check (role in ('strategy', 'design', 'copy')),
  author        text not null default '',
  content       text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(experiment_id, role)
);

create index if not exists idx_feedback_experiments_round on feedback_experiments(round_id);
create index if not exists idx_feedback_experiments_agency on feedback_experiments(round_id, agency);
create index if not exists idx_feedback_entries_experiment on feedback_entries(experiment_id);
