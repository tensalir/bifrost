-- Evidence RAG: datasets + chunks with vector search for briefing assistant.
-- Embeddings: Voyage VECTOR(1024). Retrieval is server-side only (service key).

create extension if not exists vector;

-- One row per ingested extract (e.g. one CSV run).
create table if not exists evidence_datasets (
  id                uuid primary key default gen_random_uuid(),
  dataset_key       text not null,   -- e.g. "Meta ad data_2026-02-16-1325"
  source_filename   text not null,
  extracted_at      timestamptz not null,
  created_at        timestamptz not null default now()
);

create index if not exists idx_evidence_datasets_key on evidence_datasets(dataset_key);
create index if not exists idx_evidence_datasets_extracted on evidence_datasets(extracted_at desc);

-- Chunks with embeddings. content_hash + dataset_id for idempotent upserts.
create table if not exists evidence_chunks (
  id                  uuid primary key default gen_random_uuid(),
  dataset_id          uuid not null references evidence_datasets(id) on delete cascade,
  datasource_id        text not null,   -- canonical: ad_performance, social_comments, etc.
  product_or_use_case  text,
  content             text not null,
  content_hash         text not null,   -- deterministic hash for idempotency
  embedding            vector(1024) not null,
  source_row_id        text,
  recency             text,             -- ISO date or label
  context_json        jsonb,            -- metric_context, extra provenance
  created_at          timestamptz not null default now(),
  unique(dataset_id, content_hash)
);

create index if not exists idx_evidence_chunks_dataset on evidence_chunks(dataset_id);
create index if not exists idx_evidence_chunks_datasource on evidence_chunks(datasource_id);
create index if not exists idx_evidence_chunks_product on evidence_chunks(product_or_use_case);
create index if not exists idx_evidence_chunks_recency on evidence_chunks(recency);

-- HNSW index for fast approximate nearest-neighbor search (cosine).
create index if not exists idx_evidence_chunks_embedding on evidence_chunks
  using hnsw (embedding vector_cosine_ops);

-- RLS: no policies so anon/auth get no rows; service_role bypasses RLS (server-only access).
alter table evidence_datasets enable row level security;
alter table evidence_chunks enable row level security;

-- Filtered vector search: optional dataset_id, datasource_id, product_or_use_case, since (recency).
create or replace function match_evidence_chunks(
  query_embedding vector(1024),
  match_count int default 10,
  similarity_threshold float default 0.3,
  filter_dataset_id uuid default null,
  filter_datasource_id text default null,
  filter_product text default null,
  filter_since text default null
)
returns table (
  id uuid,
  dataset_id uuid,
  datasource_id text,
  product_or_use_case text,
  content text,
  source_row_id text,
  recency text,
  context_json jsonb,
  similarity float
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    c.id,
    c.dataset_id,
    c.datasource_id,
    c.product_or_use_case,
    c.content,
    c.source_row_id,
    c.recency,
    c.context_json,
    1 - (c.embedding <=> query_embedding) as similarity
  from evidence_chunks c
  where
    1 - (c.embedding <=> query_embedding) > similarity_threshold
    and (filter_dataset_id is null or c.dataset_id = filter_dataset_id)
    and (filter_datasource_id is null or c.datasource_id = filter_datasource_id)
    and (filter_product is null or c.product_or_use_case ilike '%' || filter_product || '%')
    and (filter_since is null or c.recency >= filter_since)
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;

grant execute on function match_evidence_chunks to service_role;

-- Optional: track ingestion progress for resumable runs (script writes checkpoint here or to a local file).
create table if not exists evidence_ingestion_runs (
  id              uuid primary key default gen_random_uuid(),
  dataset_id      uuid not null references evidence_datasets(id) on delete cascade,
  status          text not null default 'running',  -- running, completed, failed
  last_row_index  int not null default 0,
  last_content_hash text,
  error_message   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(dataset_id)
);

alter table evidence_ingestion_runs enable row level security;

comment on table evidence_datasets is 'One row per evidence extract (e.g. Meta CSV run); used to pin retrieval to a dataset.';
comment on table evidence_chunks is 'Evidence chunks with Voyage 1024-d embeddings; idempotent by (dataset_id, content_hash).';
comment on table evidence_ingestion_runs is 'Checkpoint for resumable CSV ingestion (last_row_index).';
comment on function match_evidence_chunks is 'Vector similarity search with optional filters; used by briefing assistant evidence retrieval.';
