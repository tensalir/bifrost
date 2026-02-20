-- Forecast tool: runs (per upload), use-case data rows, and optional manual overrides.
-- Raw upload snapshot kept for parity debugging; normalized rows drive FC/CS engine.

create table if not exists forecast_runs (
  id                uuid primary key default gen_random_uuid(),
  name              text,
  uploaded_at       timestamptz not null default now(),
  workbook_filename text,
  sheet_names       text[],
  month_keys        text[],
  created_at        timestamptz not null default now()
);

create table if not exists forecast_use_case_rows (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references forecast_runs(id) on delete cascade,
  row_index        int not null,
  year_num         int,
  month_date       date,
  use_case         text not null,
  graph_spent      numeric,
  graph_revenue    numeric,
  roas             numeric,
  results_spent    numeric,
  spent_pct_total  numeric,
  forecasted_spent numeric,
  forecasted_revenue numeric,
  raw_json         jsonb,
  created_at       timestamptz not null default now()
);

create table if not exists forecast_fc_overrides (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references forecast_runs(id) on delete cascade,
  month_key         text not null,
  total_ads_needed  int,
  asset_mix_json    jsonb,
  funnel_json      jsonb,
  asset_type_json   jsonb,
  created_at       timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(run_id, month_key)
);

create table if not exists forecast_cs_overrides (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references forecast_runs(id) on delete cascade,
  month_key         text not null,
  studio_agency_json jsonb,
  detail_rows_json  jsonb,
  created_at       timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(run_id, month_key)
);

create index if not exists idx_forecast_use_case_rows_run on forecast_use_case_rows(run_id);
create index if not exists idx_forecast_fc_overrides_run on forecast_fc_overrides(run_id);
create index if not exists idx_forecast_cs_overrides_run on forecast_cs_overrides(run_id);
