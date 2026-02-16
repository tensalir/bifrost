-- Per-user pinned Figma projects
-- Requires Supabase Auth (references auth.users)

create table if not exists pinned_projects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  pinned_at  timestamptz not null default now(),
  unique(user_id, project_id)
);

create index if not exists idx_pinned_user on pinned_projects(user_id);

-- RLS: users can only see/manage their own pins
alter table pinned_projects enable row level security;

create policy "Users can view their own pins"
  on pinned_projects for select
  using (auth.uid() = user_id);

create policy "Users can insert their own pins"
  on pinned_projects for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own pins"
  on pinned_projects for delete
  using (auth.uid() = user_id);
