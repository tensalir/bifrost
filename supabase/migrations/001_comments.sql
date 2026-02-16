-- Heimdall comment persistence schema
-- Run this in your Supabase SQL editor or via CLI migration

-- Tracks synced Figma files
create table if not exists comment_files (
  file_key   text primary key,
  file_name  text not null default '',
  last_synced_at timestamptz not null default now(),
  total_comments int not null default 0
);

-- Individual comments, one row per Figma comment
create table if not exists comments (
  id            text primary key,
  file_key      text not null references comment_files(file_key) on delete cascade,
  page_id       text not null default '',
  page_name     text not null default '',
  node_id       text,
  node_name     text not null default '',
  parent_id     text,
  order_number  int,
  author        text not null default '',
  author_avatar text not null default '',
  message       text not null default '',
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  thread_depth  int not null default 0,
  reply_count   int not null default 0
);

create index if not exists idx_comments_file_key on comments(file_key);
create index if not exists idx_comments_node_id on comments(node_id);
create index if not exists idx_comments_page_id on comments(file_key, page_id);

-- Cached AI summaries per layer
create table if not exists comment_summaries (
  id            uuid primary key default gen_random_uuid(),
  file_key      text not null,
  node_id       text not null,
  summary       text not null default '',
  comment_count int not null default 0,
  generated_at  timestamptz not null default now(),
  unique(file_key, node_id)
);

create index if not exists idx_summaries_lookup on comment_summaries(file_key, node_id);
