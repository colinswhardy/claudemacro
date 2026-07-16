// Minimal test harness for MacroLog's pure/state-only logic.
//
// index.html has no build step and no module system, so this loads the actual
// <script> block from index.html into a sandboxed VM context with just enough
// browser stubs (document/localStorage/fetch) for the whole file to execute
// top-to-bottom without crashing, then pulls out the functions worth testing
// directly instead of re-implementing their logic here.
//
// Run with: node tests/run-tests.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const indexPath = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(indexPath, "utf8");
const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(function (m) { return m[1]; });
if (scriptMatches.length === 0) throw new Error("No <script> blocks found in index.html");
// The app logic lives in the longer of the <script> blocks; the other is the
// tiny service-worker registration snippet.
const mainScript = scriptMatches.reduce(function (a, b) { return a.length >= b.length ? a : b; });

// ---- Minimal browser stubs ----
function makeFakeElement() {
  const el = {
    _innerHTML: "", style: {}, dataset: {}, value: "",
    addEventListener: function () {}, removeEventListener: function () {},
    getAttribute: function () { return null; }, setAttribute: function () {},
    focus: function () {}, select: function () {}, click: function () {},
    closest: function () { return null; }, appendChild: function () {}, remove: function () {},
    querySelector: function () { return null; }, querySelectorAll: function () { return []; },
  };
  Object.defineProperty(el, "innerHTML", {
    get: function () { return this._innerHTML; },
    set: function (v) { this._innerHTML = v; },
  });
  return el;
}

const localStorageStub = (function () {
  const store = new Map();
  return {
    getItem: function (k) { return store.has(k) ? store.get(k) : null; },
    setItem: function (k, v) { store.set(k, String(v)); },
    removeItem: function (k) { store.delete(k); },
    clear: function () { store.clear(); },
  };
})();

const documentStub = {
  hidden: false,
  body: makeFakeElement(),
  getElementById: function () { return makeFakeElement(); },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  createElement: function () { return makeFakeElement(); },
  addEventListener: function () {},
  removeEventListener: function () {},
};

const historyStub = {
  state: null,
  pushState: function () {},
  replaceState: function () {},
  back: function () {},
  go: function () {},
};

const sandbox = {
  document: documentStub,
  localStorage: localStorageStub,
  navigator: { onLine: true },
  fetch: function () { return Promise.reject(new Error("network disabled in tests")); },
  console: console,
  setTimeout: setTimeout, clearTimeout: clearTimeout,
  URL: { createObjectURL: function () { return "blob:test"; }, revokeObjectURL: function () {} },
  Blob: function () {},
  FileReader: function () { this.onload = null; this.readAsText = function () {}; this.readAsDataURL = function () {}; },
  history: historyStub,
  addEventListener: function () {},
  removeEventListener: function () {},
  screen: { orientation: null },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// Appended (not prepended) so it runs in the same top-level scope as the app script and
// can reach its const/let/function bindings -- those aren't visible from outside the vm
// context otherwise, since only `var`/function declarations become context properties.
const exportLine =
  "\n;globalThis.__t = { calcMacrosForWeight: calcMacrosForWeight, round1: round1, parseCsvLine: parseCsvLine, " +
  "mergeFoodLogsFromCloud: mergeFoodLogsFromCloud, mergeWeightsFromCloud: mergeWeightsFromCloud, mergeRecipesFromCloud: mergeRecipesFromCloud, " +
  "wasRecentlyDeleted: wasRecentlyDeleted, markRecentlyDeleted: markRecentlyDeleted, recentlyDeletedIds: recentlyDeletedIds, " +
  "computeNavDepth: computeNavDepth, collapseOneNavLevel: collapseOneNavLevel, showToast: showToast, fmtDate: fmtDate, " +
  "computeQtyWeight: computeQtyWeight, " +
  "inputActions: inputActions, actions: actions, state: state, DEFAULT_SETTINGS: DEFAULT_SETTINGS };\n";

try {
  vm.runInContext(mainScript + exportLine, sandbox, { filename: "index.html<script>" });
} catch (e) {
  console.error("FATAL: could not load index.html's script into the test sandbox:");
  console.error(e.stack || e);
  process.exit(1);
}

const M = sandbox.__t;

// ---- tiny test runner ----
let pass = 0, fail = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; }
  else { fail++; console.error("FAIL: " + msg + "\n  expected: " + e + "\n  actual:   " + a); }
}
function assertClose(actual, expected, tolerance, msg) {
  if (Math.abs(actual - expected) <= tolerance) { pass++; }
  else { fail++; console.error("FAIL: " + msg + "\n  expected ~" + expected + " (+/-" + tolerance + ")\n  actual:   " + actual); }
}
function test(name, fn) {
  try { fn(); } catch (e) { fail++; console.error("FAIL (threw): " + name + "\n  " + (e.stack || e)); }
}

// ==== calcMacrosForWeight ====
test("calcMacrosForWeight: per100g scales linearly", function () {
  const food = { per100g: true, calories: 200, protein: 20, carbs: 10, fat: 5, fiber: 2 };
  assertEqual(M.calcMacrosForWeight(food, 150), { calories: 300, protein: 30, carbs: 15, fat: 7.5, fiber: 3 }, "150g of a per-100g food");
});
test("calcMacrosForWeight: scales from first serving size when not per100g", function () {
  const food = { per100g: false, calories: 100, protein: 5, carbs: 20, fat: 2, fiber: 1, servingSizes: [{ label: "1 slice", grams: 50 }] };
  assertEqual(M.calcMacrosForWeight(food, 100), { calories: 200, protein: 10, carbs: 40, fat: 4, fiber: 2 }, "double the base serving size");
});
test("calcMacrosForWeight: null food returns zeros", function () {
  assertEqual(M.calcMacrosForWeight(null, 100), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }, "null food guard");
});
test("calcMacrosForWeight: falls back to a 100g base with no serving sizes", function () {
  const food = { per100g: false, calories: 50, protein: 1, carbs: 1, fat: 1, fiber: 0 };
  assertEqual(M.calcMacrosForWeight(food, 200), { calories: 100, protein: 2, carbs: 2, fat: 2, fiber: 0 }, "default 100g base");
});

// ==== round1 ====
test("round1: rounds to one decimal place", function () {
  assertEqual(M.round1(1.24), 1.2, "round down");
  assertEqual(M.round1(1.25), 1.3, "round half up");
  assertEqual(M.round1(1.26), 1.3, "round up");
});

// ==== parseCsvLine ====
test("parseCsvLine: simple comma-separated fields", function () {
  assertEqual(M.parseCsvLine("a,b,c"), ["a", "b", "c"], "plain split");
});
test("parseCsvLine: quoted field containing a comma (the Renpho export bug)", function () {
  assertEqual(M.parseCsvLine('"May 22, 2026",70.5'), ["May 22, 2026", "70.5"], "quoted comma stays in one field");
});
test("parseCsvLine: escaped double-quote inside a quoted field", function () {
  assertEqual(M.parseCsvLine('"He said ""hi""",ok'), ['He said "hi"', "ok"], "doubled quote unescapes to one");
});
test("parseCsvLine: empty fields are preserved", function () {
  assertEqual(M.parseCsvLine("a,,c"), ["a", "", "c"], "empty middle field");
});

// ==== fmtDate ====
test("fmtDate: uses local calendar-date components, not UTC", function () {
  // Constructed via the (year, month, day, ...) form, which the JS spec always interprets as
  // local time -- unlike toISOString(), which is always UTC and is exactly what caused the
  // app to open to the wrong day for hours every evening in a timezone behind UTC.
  const d = new Date(2026, 6, 15, 23, 30, 0); // July 15, 2026, 11:30 PM local
  assertEqual(M.fmtDate(d), "2026-07-15", "matches the local Y-M-D regardless of the test runner's own timezone");
});
test("fmtDate: pads single-digit month and day", function () {
  const d = new Date(2026, 0, 5, 8, 0, 0); // January 5, 2026
  assertEqual(M.fmtDate(d), "2026-01-05", "zero-padded");
});

// ==== mergeFoodLogsFromCloud ====
test("mergeFoodLogsFromCloud: does not resurrect a recently-deleted local entry", function () {
  M.state.foodLogs = {};
  M.recentlyDeletedIds.food_log_entries.clear();
  M.markRecentlyDeleted("food_log_entries", "log_123");
  const changed = M.mergeFoodLogsFromCloud([{
    id: "log_123", log_date: "2026-07-15", food_id: "f1", name: "Deleted Item", weight: 100,
    calories: 100, protein: 1, carbs: 1, fat: 1, fiber: 0, source: "Manual",
    logged_at: "2026-07-15T00:00:00.000Z", updated_at: "2026-07-15T00:00:00.000Z",
  }]);
  assertEqual(changed, 0, "tombstoned row is not re-added");
  assertEqual(Object.keys(M.state.foodLogs).length, 0, "foodLogs stays empty");
});
test("mergeFoodLogsFromCloud: adds a genuinely new cloud row", function () {
  M.state.foodLogs = {};
  M.recentlyDeletedIds.food_log_entries.clear();
  const changed = M.mergeFoodLogsFromCloud([{
    id: "log_999", log_date: "2026-07-15", food_id: "f1", name: "New Item", weight: 100,
    calories: 100, protein: 1, carbs: 1, fat: 1, fiber: 0, source: "Manual",
    logged_at: "2026-07-15T00:00:00.000Z", updated_at: "2026-07-15T00:00:00.000Z",
  }]);
  assertEqual(changed, 1, "one row added");
  assertEqual(M.state.foodLogs["2026-07-15"][0].id, "log_999", "entry present under the right date");
});
test("mergeFoodLogsFromCloud: an older cloud row does not overwrite a newer local edit", function () {
  M.state.foodLogs = { "2026-07-15": [{
    id: "log_1", name: "Local Newer", weight: 100,
    macros: { calories: 200, protein: 1, carbs: 1, fat: 1, fiber: 0 },
    timestamp: "2026-07-15T00:00:00.000Z", updatedAt: "2026-07-15T12:00:00.000Z",
  }] };
  const changed = M.mergeFoodLogsFromCloud([{
    id: "log_1", log_date: "2026-07-15", food_id: null, name: "Cloud Older", weight: 50,
    calories: 50, protein: 1, carbs: 1, fat: 1, fiber: 0, source: "Synced",
    logged_at: "2026-07-15T00:00:00.000Z", updated_at: "2026-07-15T01:00:00.000Z",
  }]);
  assertEqual(changed, 0, "no change applied");
  assertEqual(M.state.foodLogs["2026-07-15"][0].name, "Local Newer", "local edit is preserved");
});
test("mergeFoodLogsFromCloud: a newer cloud row replaces the local one", function () {
  M.state.foodLogs = { "2026-07-15": [{
    id: "log_1", name: "Local Older", weight: 100,
    macros: { calories: 200, protein: 1, carbs: 1, fat: 1, fiber: 0 },
    timestamp: "2026-07-15T00:00:00.000Z", updatedAt: "2026-07-15T00:00:00.000Z",
  }] };
  const changed = M.mergeFoodLogsFromCloud([{
    id: "log_1", log_date: "2026-07-15", food_id: null, name: "Cloud Newer", weight: 75,
    calories: 75, protein: 2, carbs: 2, fat: 2, fiber: 0, source: "Synced",
    logged_at: "2026-07-15T12:00:00.000Z", updated_at: "2026-07-15T12:00:00.000Z",
  }]);
  assertEqual(changed, 1, "change applied");
  assertEqual(M.state.foodLogs["2026-07-15"][0].name, "Cloud Newer", "cloud edit wins");
});

// ==== mergeWeightsFromCloud ====
test("mergeWeightsFromCloud: adds a new date", function () {
  M.state.weights = {};
  const changed = M.mergeWeightsFromCloud([{ log_date: "2026-07-10", weight: 180, unit: "lbs", logged_at: "2026-07-10T00:00:00.000Z", updated_at: "2026-07-10T00:00:00.000Z" }]);
  assertEqual(changed, 1, "one weight added");
  assertEqual(M.state.weights["2026-07-10"].weight, 180, "weight value correct");
});
test("mergeWeightsFromCloud: keeps a newer local value over an older cloud value", function () {
  M.state.weights = { "2026-07-10": { weight: 179, unit: "lbs", timestamp: "2026-07-10T08:00:00.000Z", updatedAt: "2026-07-10T08:00:00.000Z" } };
  const changed = M.mergeWeightsFromCloud([{ log_date: "2026-07-10", weight: 999, unit: "lbs", logged_at: "2026-07-10T01:00:00.000Z", updated_at: "2026-07-10T01:00:00.000Z" }]);
  assertEqual(changed, 0, "no change");
  assertEqual(M.state.weights["2026-07-10"].weight, 179, "local weight kept");
});

// ==== mergeRecipesFromCloud ====
test("mergeRecipesFromCloud: does not resurrect a recently-deleted recipe", function () {
  M.state.recipes = [];
  M.recentlyDeletedIds.recipes.clear();
  M.markRecentlyDeleted("recipes", "recipe_1");
  const added = M.mergeRecipesFromCloud([{ id: "recipe_1", name: "Deleted Recipe", ingredients: [], created_at: "2026-07-15T00:00:00.000Z" }]);
  assertEqual(added, 0, "tombstoned recipe is not re-added");
});
test("mergeRecipesFromCloud: adds a genuinely new recipe", function () {
  M.state.recipes = [];
  M.recentlyDeletedIds.recipes.clear();
  const added = M.mergeRecipesFromCloud([{ id: "recipe_2", name: "New Recipe", ingredients: [], created_at: "2026-07-15T00:00:00.000Z" }]);
  assertEqual(added, 1, "one recipe added");
});

// ==== macro-lock redistribution math (inputActions.calorieTarget) ====
test("calorieTarget: redistributes proportionally across unlocked macros", function () {
  M.state.settings = Object.assign({}, M.DEFAULT_SETTINGS, { proteinTarget: 150, carbsTarget: 150, fatTarget: 50, macroLocks: {} });
  M.inputActions.calorieTarget("2000");
  const set = M.state.settings;
  assertEqual(set.calorieTarget, 2000, "calorieTarget is set directly");
  const totalCal = set.proteinTarget * 4 + set.carbsTarget * 4 + set.fatTarget * 9;
  assertClose(totalCal, 2000, 10, "redistributed macros sum back to ~target calories (rounding drift allowed)");
});
test("calorieTarget: a locked macro's grams are left untouched", function () {
  M.state.settings = Object.assign({}, M.DEFAULT_SETTINGS, { proteinTarget: 150, carbsTarget: 150, fatTarget: 50, macroLocks: { fat: true } });
  M.inputActions.calorieTarget("2000");
  assertEqual(M.state.settings.fatTarget, 50, "locked fat target is unchanged");
});
test("calorieTarget: all-locked leaves nothing to redistribute into (no crash)", function () {
  M.state.settings = Object.assign({}, M.DEFAULT_SETTINGS, { proteinTarget: 150, carbsTarget: 150, fatTarget: 50, macroLocks: { protein: true, carbs: true, fat: true } });
  M.inputActions.calorieTarget("2000");
  assertEqual(M.state.settings.proteinTarget, 150, "locked protein unchanged");
  assertEqual(M.state.settings.carbsTarget, 150, "locked carbs unchanged");
  assertEqual(M.state.settings.fatTarget, 50, "locked fat unchanged");
});

// ==== computeQtyWeight (portion-size quantity selection) ====
test("computeQtyWeight: multiplies quantity by a serving's grams", function () {
  assertEqual(M.computeQtyWeight("2", 33), 66, "2 cookies at 33g each");
});
test("computeQtyWeight: fractional quantity rounds to one decimal", function () {
  assertEqual(M.computeQtyWeight("1.5", 33), 49.5, "1.5 servings");
});
test("computeQtyWeight: blank/invalid quantity treated as zero", function () {
  assertEqual(M.computeQtyWeight("", 33), 0, "empty string");
  assertEqual(M.computeQtyWeight("abc", 33), 0, "non-numeric");
});

// ==== navigation depth (back-button model) ====
test("computeNavDepth: dashboard tab is depth 0", function () {
  M.state.tab = "dashboard";
  M.state.ui = {};
  assertEqual(M.computeNavDepth(), 0, "dashboard is the base level");
});
test("computeNavDepth: a non-dashboard tab with no sub-screen is depth 1", function () {
  M.state.tab = "weight";
  M.state.ui = {};
  assertEqual(M.computeNavDepth(), 1, "weight tab base is depth 1");
});
test("computeNavDepth: a Food sub-screen is depth 2", function () {
  M.state.tab = "food";
  M.state.ui = { food: { showAI: true } };
  assertEqual(M.computeNavDepth(), 2, "AI screen open is depth 2");
});
test("computeNavDepth: Food tab with no sub-screen open is depth 1", function () {
  M.state.tab = "food";
  M.state.ui = { food: {} };
  assertEqual(M.computeNavDepth(), 1, "food search base is depth 1");
});

test("collapseOneNavLevel: closes an open Food sub-screen back to depth 1", function () {
  M.state.tab = "food";
  M.state.ui = { food: { manualEntry: true } };
  const collapsed = M.collapseOneNavLevel();
  assertEqual(collapsed, true, "returns true when something was collapsed");
  assertEqual(M.state.ui.food.manualEntry, false, "manualEntry cleared");
  assertEqual(M.computeNavDepth(), 1, "now at depth 1");
});
test("collapseOneNavLevel: from a non-dashboard tab base, goes to dashboard", function () {
  M.state.tab = "strategy";
  M.state.ui = {};
  const collapsed = M.collapseOneNavLevel();
  assertEqual(collapsed, true, "returns true when something was collapsed");
  assertEqual(M.state.tab, "dashboard", "tab reset to dashboard");
});
test("collapseOneNavLevel: at the base level, there's nothing left to collapse", function () {
  M.state.tab = "dashboard";
  M.state.ui = {};
  const collapsed = M.collapseOneNavLevel();
  assertEqual(collapsed, false, "returns false at the base level -- this is where the browser should exit instead");
});
test("collapseOneNavLevel: closing the AI screen also clears its stale result state", function () {
  M.state.tab = "food";
  M.state.ui = { food: { showAI: true, aiResults: [{ name: "x" }], aiError: "oops" } };
  M.collapseOneNavLevel();
  assertEqual(M.state.ui.food.showAI, false, "showAI cleared");
  assertEqual(M.state.ui.food.aiResults, null, "stale AI results cleared");
  assertEqual(M.state.ui.food.aiError, null, "stale AI error cleared");
});
test("collapseOneNavLevel: closing the AI screen also clears aiDesc/aiPhoto so a cancelled attempt can't silently resurface next time", function () {
  M.state.tab = "food";
  M.state.ui = { food: { showAI: true, aiDesc: "leftover description", aiPhoto: "base64data" } };
  M.collapseOneNavLevel();
  assertEqual(M.state.ui.food.aiDesc, "", "aiDesc reset on close");
  assertEqual(M.state.ui.food.aiPhoto, null, "aiPhoto reset on close");
});

// ==== toast ====
test("showToast: sets state.toast immediately (synchronously, before its auto-hide timer)", function () {
  M.state.toast = null;
  M.showToast("Food Added");
  assertEqual(M.state.toast, "Food Added", "toast message is set right away");
});

// ==== confirm-lock debounce (shared by addManualEntry/confirmAddFood/confirmLogRecipe/
// wizardConfirmAdd/saveRecipe/deleteRecipeFromBuilder -- addManualEntry is the simplest to
// set up and exercises the exact pattern the others share) ====
test("addManualEntry: a rapid double-tap only logs one entry", function () {
  M.state.date = "2026-07-15";
  M.state.foodLogs = {};
  M.state.ui = { food: { manual: { name: "Test Food", calories: "100", protein: "10", carbs: "10", fat: "5", fiber: "0", weight: "100" }, manualEntry: true } };
  M.actions.addManualEntry();
  M.actions.addManualEntry(); // rapid second tap, well within the 600ms debounce window
  const entries = M.state.foodLogs["2026-07-15"] || [];
  assertEqual(entries.length, 1, "only one entry logged despite two rapid calls");
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail > 0 ? 1 : 0);
