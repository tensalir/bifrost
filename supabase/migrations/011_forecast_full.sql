-- Forecast full conversion: extend FC overrides and add CS detail rows table.
-- Supports full spreadsheet parity (header block, channel mix, manual boost, production tables, briefing rows).

-- Extend forecast_fc_overrides for full FC header and production data
alter table forecast_fc_overrides
  add column if not exists adspend_target_global numeric,
  add column if not exists adspend_target_expansion numeric,
  add column if not exists creative_budget_pct numeric default 0.08,
  add column if not exists channel_mix_json jsonb,
  add column if not exists use_case_boost_json jsonb,
  add column if not exists asset_production_json jsonb;

-- Individual briefing rows per month (replaces cramming into detail_rows_json)
create table if not exists forecast_cs_detail_rows (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references forecast_runs(id) on delete cascade,
  month_key         text not null,
  row_index         int not null,
  siobhan_ref       text,
  content_bucket     text,
  static_count      int not null default 0,
  video_count       int not null default 0,
  carousel_count    int not null default 0,
  ideation_starter  text,
  experiment_name   text,
  notes             text,
  type_use_case     text,
  brief_owner       text,
  localisation_or_growth text,
  studio_agency     text,
  agency_ref       text,
  num_assets        int generated always as (static_count + video_count + carousel_count) stored,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_forecast_cs_detail_rows_run_month on forecast_cs_detail_rows(run_id, month_key);
