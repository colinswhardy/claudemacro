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
  brand text,                          -- real brand (from USDA/OFF) or a manual correction; blank/null falls back to source in the UI
  weight numeric not null,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  fiber numeric not null default 0,
  source text,
  animal_override boolean,             -- null = auto-guess plant/animal protein from the name; true/false = manual correction
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

-- ============================================================
-- DASHBOARD FEED (written by the Fitness Dashboard, READ by MacroLog)
-- ============================================================
-- The one table here MacroLog does not own. The Fitness Dashboard (a separate app with its
-- own database) publishes one row per day describing what it measured -- calibrated activity
-- burn, the calorie target it would recommend, and its rolling measured TDEE -- and MacroLog
-- displays it on the dashboard beside its own targets (see renderDashboardFeedBlock).
--
-- Already created in the live project by the dashboard's own migration (2026-08-02); this
-- block exists so this file stays a complete description of the database, and so a
-- from-scratch rebuild produces it too.
--
-- MacroLog has NO write path to this table and must not grow one: the dashboard recomputes
-- and re-upserts these rows, so anything written from here is overwritten on its next
-- publish. Two writers on one table is exactly the conflict class the sync engine avoids.
create table if not exists dashboard_feed (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  activity_burn_kcal integer,                   -- calibrated NET burn for the day; 0 on rest days
  burn_counted boolean not null default true,   -- did the dashboard count it in its own total
  base_target_kcal integer,                     -- the dashboard's base target in force that day
  boost_kcal integer not null default 0,
  recommended_target_kcal integer,              -- base + (burn if counted) + boost
  tdee_kcal integer,                            -- rolling measured maintenance; null (never 0)
  tdee_low_kcal integer,                        -- while the estimate is gated on too little data
  tdee_high_kcal integer,
  tdee_status text,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table dashboard_feed enable row level security;
-- "for all" rather than select-only on purpose: the dashboard writes with the service key
-- (which bypasses RLS), but if it were ever pointed at a signed-in session instead, a
-- select-only policy would silently start rejecting its writes. The rows are derived and
-- self-healing -- the next publish overwrites anything wrong -- so read-only on MacroLog's
-- side is enforced by having no write path in the client, not by this policy.
create policy "own rows" on dashboard_feed for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Storage: progress photos (added 2026-08-13)
-- ============================================================
-- Waist progress photos are FILES in a private bucket, not rows. The photos' bytes must
-- never live inline in user_app_data / localStorage: localStorage is ~5MB shared with all
-- of MacroLog's data, so inline base64 photos would have started failing food/weight
-- writes within ~30 photos. Entries in user_app_data reference these files by path
-- ("userId/filename.jpg").
--
-- Already applied to the live project (2026-08-13, migration `progress_photos_bucket`);
-- kept here so a from-scratch rebuild produces it too.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 10485760, array['image/jpeg'])
on conflict (id) do nothing;

-- Files live under {auth.uid()}/{filename}; every verb is scoped to the caller's own
-- folder. All four are needed: the app's x-upsert upload does insert-or-update.
create policy "progress photos select own" on storage.objects
  for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "progress photos insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "progress photos update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "progress photos delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
