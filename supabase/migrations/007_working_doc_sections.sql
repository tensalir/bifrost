-- Working doc sections (Idea, Why, Audience, etc.) per assignment, stored as JSONB.
alter table briefing_assignments
  add column if not exists working_doc_sections jsonb not null default '{}';
