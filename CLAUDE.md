# MacroLog

Personal calorie/macro tracking PWA for Colin. Single user, single active device at a time. Hosted on GitHub Pages at `https://colinswhardy.github.io/claudemacro/` (repo `colinswhardy/claudemacro`). Backend is a single production Supabase project (Postgres + PostgREST + GoTrue auth) — there is no staging environment and no test database; every push to `main` deploys straight to the live site and the live DB.

## Files

- `index.html` (~3500 lines) — the entire app: HTML shell + `<style>` + one big inline `<script>`. No build step, no framework, no bundler, no TypeScript, no npm dependencies. A second tiny `<script>` at the bottom just registers the service worker.
- `sw.js` — service worker. Network-first for the app shell (cache name `macrolog-v2`), so a redeploy is picked up on next load instead of being stuck on a stale cache.
- `manifest.json` — PWA manifest.
- `supabase/schema.sql` + `supabase/README.md` — the DB schema and one-time setup walkthrough. Six tables, all RLS-scoped to `auth.uid() = user_id`: `food_log_entries`, `weight_entries`, `recipes`, `custom_barcodes`, `user_settings`, `user_app_data` (favorites/recentFoods/foodCache, one JSON blob per key).
- `tests/run-tests.js` — loads the real `<script>` block from `index.html` into a sandboxed Node `vm` context (with minimal `document`/`localStorage`/`history`/`fetch` stubs) and unit-tests the pure/state-only functions directly. Run with `node tests/run-tests.js` from the project root. Node is installed locally for this (`node --version` → v24+).

## Architecture

**Tiny hand-rolled render engine**, not a framework: every state change does a full `root.innerHTML = renderApp()` replace (see `render()`/`rerender()` near line 863, and don't skip reading the "Back button / gesture navigation" comment block right above it — it governs a lot of what "closing a screen" means throughout the file). Event handling is delegation on the root `#app` element via `data-action` (click), `data-bind` (text input, read on `input` event), `data-change` (file/select inputs), `data-enter` (Enter key). Three flat handler objects: `actions.X`, `inputActions.X`, `changeActions.X` — every `data-action="X"`/`data-bind="X"`/`data-change="X"` must resolve to a same-named entry in one of these, or it's dead on click.

**Critical ordering gotcha:** `actions`/`inputActions`/`changeActions` are declared via `const actions = {}` etc. partway through the file (~line 863 area). Any `actions.foo = ...` assignment placed *before* that declaration throws a TDZ `ReferenceError` that halts the entire script — the app just shows "Loading..." forever, on every device, with no console access on a phone to see why. This has happened before. Before any commit that adds new top-level `actions.X =` / `inputActions.X =` / `changeActions.X =` assignments, verify none of them appear above their object's `const` declaration.

**No build step = no compiler safety net.** A syntax error is a runtime failure on Colin's phone, not a red squiggle. Before every push: extract the two `<script>` blocks and run `node --check` on the big one, then `node tests/run-tests.js`. Both are fast (seconds) and are not optional — they're what catches the class of bug described above before it ships.

### Section map (`index.html`)

| Lines | Section |
|---|---|
| 1–96 | `<style>` (dark theme, all colors hardcoded — no CSS variables beyond `color-scheme`) |
| 98–170 | Constants (`C` = color tokens used from JS) |
| 171–195 | Date/format utils |
| 181–195 | `db` — thin `localStorage` wrapper (`db.get`/`db.set`, keys prefixed `ml_`) |
| 195–241 | `state` — the single global mutable state object, and `DEFAULT_SETTINGS` |
| 242–856 | API helpers: Supabase auth/session, `supabaseTable()` (generic authed PostgREST fetch), all the `push*ToCloud`/`pull*FromCloud`/`merge*FromCloud` functions, `pullAndMergeAll()`, USDA/Open Food Facts/barcode search, `estimateWithClaude`/`estimateWithGemini` |
| 857–1046 | Tiny render engine: `render()`/`rerender()`, toast (`showToast`), **back-button nav model** (`computeNavDepth`/`syncNavHistoryDepth`/`collapseOneNavLevel`/`stepBackOneLevel` — see below), event delegation listeners |
| 1047–1122 | Generic UI helpers (`progressBar`, `btn`, `card`, `textInput`, etc.) |
| 1123–1191 | App shell (`renderApp`, tab bar, header) |
| 1192–1253 | Data helpers (`getDayTotals`, `addFoodToLog`, `removeFoodFromLog`) |
| 1254–1552 | Dashboard tab |
| 1553–2602 | Food tab — search, AI estimate, manual entry, barcode scan, recipe builder + ingredient picker, "adding food" detail screen |
| 2603–2812 | Food wizard screen (guided portion-size flow) |
| 2813–3098 | Weight tab |
| 3099–3459 | Strategy tab (targets, AI settings, data export/import/clear) |
| 3460–end | Init: boot sequence, `visibilitychange` and `popstate` listeners |

### Food tab screen model

`renderFoodTab()` gates on 7 mutually-exclusive flags on `state.ui.food` (via `foodUi()`), checked in priority order — first truthy one wins the whole screen: `scanningBarcode`, `loggingRecipe`, `recipeBuilder` (which itself nests a `picker` sub-state for the ingredient picker, and `picker.selecting`), `wizardType`, `showAI`, `manualEntry`, `addingFood`. Falls through to the search/history/favorites/recipes sub-tabs if none are set.

### Back-button / navigation (added 2026-07)

The app has no router. `computeNavDepth()` derives a 3-tier depth purely from `state` (0 = dashboard tab, 1 = any other tab at its base, 2 = any Food-tab sub-screen from the list above). `render()` calls `syncNavHistoryDepth()` at the top of every call, which auto-`pushState`s to match depth *increases* — no action needs to manually push history, entering any deeper screen is handled generically. Exiting a level is different: a screen's own Cancel/Back/Confirm-and-exit action must call `stepBackOneLevel()` instead of clearing its own flag directly, which triggers `history.back()`; the single `popstate` listener (bottom of file) is the one place that actually calls `collapseOneNavLevel()` and mutates state, so physical back/gesture and in-app buttons collapse identically. Actions that route through `stepBackOneLevel()` also lost the implicit double-submit guard they used to get from synchronously nulling their own flag — they carry an explicit `_confirmLock` 600ms debounce guard instead (grep `_confirmLock` for the pattern; apply it to any new confirm-and-exit action). A few transitions are deliberately *not* routed through `stepBackOneLevel()` because they're lateral swaps between two depth-2 screens, not a real exit (e.g. barcode-scan → adding-food after a successful lookup) — see the comment above `collapseOneNavLevel` for the full reasoning.

### Sync engine

Offline-first: `localStorage` is the instant source of truth; every save function also calls `scheduleCloudSync()` (debounced 2.5s) to push the full current dataset as a PostgREST upsert. `pullAndMergeAll()` runs on login and on boot — pulls first (so a fresh device's defaults never clobber real account data), merges cloud rows into local state **in place** (never snapshot-and-replace-wholesale — that was a real bug, see git history), with newer-wins conflict resolution by `updated_at` for food logs and weights (recipes stay additive-only — that table has no `updated_at` column). A short-lived "recently deleted" tombstone (`recentlyDeletedIds`, ~30s) stops a background sync's pull from resurrecting something just deleted locally if the pull races ahead of the delete landing server-side. "Clear All Data" issues real `DELETE`s against all 6 tables when signed in — pushing an empty local dataset alone would never actually clear the cloud copy, since pushes are upsert-only.

## Conventions

- Text inputs deliberately do **not** trigger `rerender()` on keystroke (would steal focus mid-type) — `inputActions.X` handlers patch specific DOM elements directly (e.g. flipping a button's `disabled`) instead of re-rendering. This is a recurring source of "button doesn't update" bugs when adding a new input; check for this pattern before assuming a fresh flag will "just work."
- **Serving-size quantity selection** (added 2026-07): the three "pick a food, then set how much" screens (Adding Food, recipe ingredient picker, wizard result) share `renderServingControls`/`computeQtyWeight`/`patchMacroPreview` (near `macroStat`, ~line 2338). Tapping a serving chip (e.g. "1 cookie (33g)") sets a `servingBasis` and switches the input to a quantity ("2" → 66g) instead of raw grams; "Enter grams instead" clears `servingBasis` to go back to typing grams directly. Each screen keeps its own `weight`/`servingBasis`/`qty` trio in its own UI sub-object (`fu.addWeight`/`addServingBasis`/`addQty`, `pk.weight`/`servingBasis`/`qty`, `wiz.weight`/`servingBasis`/`qty`) — all must be reset together (`servingBasis = null; qty = "1"`) at every point a new food is selected/estimated, or a stale quantity basis will carry over to an unrelated food.
- **Auto-calculated calories** (added 2026-07): Manual Entry and the "barcode not found" custom-entry screen both derive calories from protein/carbs/fat via `calcCaloriesFromMacros` (Atwater 4/4/9, same factors as the Strategy tab's target math) — editing any of the three macro fields recomputes and DOM-patches the calories input. Editing calories directly still works and isn't overwritten unless a macro field is touched again afterward (it's a one-way derivation, not a two-way lock).
- **Search-as-you-type** (added 2026-07): `inputActions.foodQuery` (~line 1770) shows two layers of results as you type, both feeding the same `fu.results` and patched into `#foodResultsBlock` via `patchFoodResultsBlock()` rather than a full `rerender()` (would blur the input mid-keystroke). Instant layer: `localFoodMatches(q)` does a synchronous substring match against `recentFoods`/`favorites`/`foodCache` — no network, fires on every keystroke once the query is 2+ chars. Debounced layer: `liveFoodSearch(q, mySeq)` fires USDA + Open Food Facts 450ms after the last keystroke (3+ chars, to avoid hammering USDA's shared rate-limited demo key — see Known deferred items). Both this and the explicit tap/Enter path (`doFoodSearch`) share one module-level `foodSearchSeq` counter bumped on every keystroke/explicit search; an in-flight request checks its captured `mySeq` against the current counter before applying results, so a slow older request can't clobber a faster newer one. Anything that changes this flow should preserve that guard — it's the difference between "search as you type" and "search results randomly flicker to a stale query."
- Numeric parses use `Math.max(0, parseFloat(x) || 0)` to reject negatives; falsy-zero-prone spots use an explicit `isNaN()` check instead of `|| default` where `0` is a legitimate value (e.g. weight).
- Double-submit guards on "confirm and add" actions use a `_confirmLock`/`_aiAddLock`-style timestamp debounce (600ms) stored on the relevant UI sub-object, not a DOM `disabled` flip alone.
- **Two-step delete confirmation** (added 2026-07): recipes, dashboard log entries, weight entries, and custom barcodes all use an arm/confirm/cancel pattern instead of deleting on a single tap — a UI field holds the id/date/code pending confirmation (`fu.confirmDeleteRecipeId`, `state.ui.confirmRemoveEntryId`, `wu.confirmDeleteDate`, `su.confirmDeleteBarcodeCode`), the row conditionally renders a Cancel/"Delete?" pair instead of its normal buttons when it matches, and only the confirmed action actually deletes (and clears the flag). Follow this same shape for any new destructive single-tap action rather than adding a bare confirm() dialog or deleting immediately.
- **Deleting a row that syncs to Supabase needs three things, not just a local delete**: (1) remove it from local state, (2) `scheduleCloudDelete(table, idColumn, idValue)` to issue the real DELETE (push functions are upsert-only and never remove cloud rows on their own), (3) make sure that table has a bucket in `recentlyDeletedIds` (near `mergeFoodLogsFromCloud`) and that its `merge*FromCloud` function checks `wasRecentlyDeleted(table, id)` before re-adding a row — otherwise a background pull racing the DELETE resurrects what was just removed. `weight_entries` (keyed by `log_date`, no local `id` tracked) and `custom_barcodes` (keyed by `barcode`) both went through this in 2026-07 alongside `food_log_entries`/`recipes`.
- Recipe deletion, log-entry removal, weight-entry deletion, and custom-barcode CRUD all have direct unit test coverage in `tests/run-tests.js` (arm-but-don't-delete, confirm-actually-deletes, tombstone-blocks-resurrection) — extend these rather than only hand-testing on the phone when touching this code.

## Deploy

`git push origin main` → GitHub Pages auto-builds, typically live within 1–2 minutes. No CI, no staging slot. Verify a push landed with a direct fetch, e.g.:
```powershell
(Invoke-WebRequest -Uri "https://colinswhardy.github.io/claudemacro/index.html" -Headers @{"Cache-Control"="no-cache"}).Content -match "some-string-from-the-change"
```

## Known deferred items (raised, explicitly not implemented)

- API keys (Claude/Gemini) sync to the cloud as part of the settings blob — a UX tradeoff (cross-device convenience) left as-is, not an oversight.
- USDA search uses the shared `DEMO_KEY` — needs Colin to register a free personal key at api.data.gov. Live search-as-you-type (see Conventions) increases call volume against this shared key somewhat; the 450ms debounce + 3-char minimum is the mitigation for now.
- Recipes' merge conflict resolution is additive-only (no `updated_at` column on that table) — upgrading it needs a schema migration first.
- Feature ideas from a competitive review (activity logging, meal templates, water tracking, micronutrients, label OCR, etc.) were explicitly scoped out as reference-only, not a backlog.
