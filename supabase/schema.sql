-- MacroLog Supabase schema
-- Run this once in your Supabase project's SQL Editor (Project > SQL Editor > New query > paste > Run).
-- Safe to re-run: uses "if not exists" / "or replace" where practical, but on a second run the
-- "create table" statements will error if the tables already exist -- that's expected, it means
-- you already ran this.

create extension if not exists "pgcrypto";

-- ============================================================
-- FOOD LOG ENTRIES (what you ate, per day)
-- ============================================================
create table food_log_entries (
  id text primary key,                 -- same id scheme MacroLog already uses (log_<timestamp>_<rand>)
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,              -- the day this was logged against (YYYY-MM-DD)
  food_id text,                        -- links back to the food definition (usda_/off_/recipe_food_/manual_/barcode_/ai_ ids)
  name text not null,
  weight numeric not null,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  fiber numeric not null default 0,
  source text,
  logged_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index food_log_entries_user_date_idx on food_log_entries (user_id, log_date);

-- ============================================================
-- WEIGHT ENTRIES
-- ============================================================
create table weight_entries (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  weight numeric not null,
  unit text not null default 'lbs',
  logged_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

-- ============================================================
-- RECIPES (your saved multi-ingredient meals)
-- ============================================================
create table recipes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  ingredients jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- CUSTOM BARCODES (nutrition info you typed in yourself for an unrecognized barcode)
-- ============================================================
create table custom_barcodes (
  barcode text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  food jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, barcode)
);

-- ============================================================
-- SETTINGS (single JSON blob per user -- targets, AI keys, unit prefs, etc.)
-- ============================================================
create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ============================================================
-- APP DATA CACHES (favorites / recentFoods / foodCache -- UI convenience state,
-- not analysis-worthy data, so these stay as simple blobs rather than normalized tables)
-- ============================================================
create table user_app_data (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,           -- 'favorites' | 'recentFoods' | 'foodCache'
  data jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Every table is only readable/writable by the row's own user_id, even though the
-- anon public key is embedded in client code -- Supabase enforces this server-side
-- based on the logged-in user's auth token.
-- ============================================================
alter table food_log_entries enable row level security;
alter table weight_entries   enable row level security;
alter table recipes          enable row level security;
alter table custom_barcodes  enable row level security;
alter table user_settings    enable row level security;
alter table user_app_data    enable row level security;

create policy "own rows only" on food_log_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on weight_entries   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on recipes          for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on custom_barcodes  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on user_settings    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on user_app_data    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
