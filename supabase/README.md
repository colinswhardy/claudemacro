# MacroLog Supabase setup

This is Phase 0/1 of moving MacroLog off phone-only `localStorage` and onto a shared
Supabase backend, so a future fitness app can read the same data.

## Steps

1. Go to [supabase.com](https://supabase.com), sign up, and create a new project.
   Pick a region close to you. Note the database password it generates (not needed
   day-to-day, but keep it somewhere safe).

2. In the new project, go to **Project Settings → API** and copy two values:
   - **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`)
   - **anon public** key (a long JWT string)

   Send both of these back so the app code can be wired up to your project.
   These are safe to embed in client-side code — every table has Row Level Security
   turned on, so the `anon` key alone can't read or write anyone's data without a
   valid login.

3. Go to **Authentication → Providers** and confirm **Email** is enabled (on by default).

4. Create your one user account: **Authentication → Users → Add user**, enter your
   email and a password. This is the single account both MacroLog and your future
   fitness app will sign into.

5. Go to **SQL Editor → New query**, paste the contents of `schema.sql` from this
   folder, and click **Run**. This creates all the tables and security policies.
   You should see six new tables appear under **Table Editor**.

Once steps 1–5 are done and you've sent over the Project URL + anon key, the next
phase is wiring MacroLog's login screen and sync engine up to this project.

## Migrations

`schema.sql` is the source of truth for a fresh install, but your database already
exists — running it again won't add new columns to an existing table. When a change
needs a new column, run the matching snippet below once in **SQL Editor → New query**.
Each is listed with the date/reason it was added, and only needs to be run once.

### 2026-07 — brand + protein-source override on food log entries

Needed for: editable food name/brand on logged entries, and the manual
plant-vs-animal-protein override. Until this is run, those two new fields save
locally on your phone but won't sync to the cloud or across devices (everything else
in the app is unaffected).

```sql
alter table food_log_entries add column if not exists brand text;
alter table food_log_entries add column if not exists animal_override boolean;
```
