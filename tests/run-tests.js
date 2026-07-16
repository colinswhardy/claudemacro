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
  "computeQtyWeight: computeQtyWeight, calcCaloriesFromMacros: calcCaloriesFromMacros, localFoodMatches: localFoodMatches, " +
  "mergeCustomBarcodesFromCloud: mergeCustomBarcodesFromCloud, filterFoodsByName: filterFoodsByName, " +
  "isAnimalProteinFood: isAnimalProteinFood, getDayTotals: getDayTotals, " +
  "estimateMaintenanceCalories: estimateMaintenanceCalories, computeGoalPlan: computeGoalPlan, " +
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

// ==== isAnimalProteinFood / getDayTotals plant-protein rollup ====
test("isAnimalProteinFood: matches an obvious meat food", function () {
  assertEqual(M.isAnimalProteinFood("Grilled Chicken Breast"), true, "chicken matches");
  assertEqual(M.isAnimalProteinFood("Beef Steak"), true, "beef matches");
});
test("isAnimalProteinFood: matches dairy, egg, and fish/seafood", function () {
  assertEqual(M.isAnimalProteinFood("Greek Yogurt"), true, "dairy matches");
  assertEqual(M.isAnimalProteinFood("Scrambled Eggs"), true, "egg matches");
  assertEqual(M.isAnimalProteinFood("Grilled Salmon"), true, "fish matches");
});
test("isAnimalProteinFood: plant foods with no animal keyword are not flagged", function () {
  assertEqual(M.isAnimalProteinFood("Lentil Soup"), false, "lentils");
  assertEqual(M.isAnimalProteinFood("Black Beans"), false, "beans");
  assertEqual(M.isAnimalProteinFood("Tofu Stir Fry"), false, "tofu");
});
test("isAnimalProteinFood: word-boundary guards against substring false positives", function () {
  assertEqual(M.isAnimalProteinFood("Roasted Eggplant Curry"), false, "\"egg\" inside \"eggplant\" must not match (Eggplant Parmesan would legitimately match on \"parmesan\" instead, so it's not a clean test case)");
  assertEqual(M.isAnimalProteinFood("Hamster Food"), false, "\"ham\" inside \"hamster\" must not match (contrived, but guards the regex)");
});
test("isAnimalProteinFood: compound words without a natural boundary are still caught", function () {
  assertEqual(M.isAnimalProteinFood("Hamburger"), true, "\"ham\" alone wouldn't match inside \"hamburger\" without the explicit compound entry");
  assertEqual(M.isAnimalProteinFood("Cheeseburger"), true, "same issue for \"cheese\" inside \"cheeseburger\"");
});
test("isAnimalProteinFood: case-insensitive", function () {
  assertEqual(M.isAnimalProteinFood("CHICKEN BREAST"), true, "matches regardless of case");
});
test("getDayTotals: plant-protein total only counts entries without an animal keyword", function () {
  M.state.foodLogs = { "2026-07-16": [
    { id: "e1", name: "Chicken Breast", macros: { calories: 200, protein: 40, carbs: 0, fat: 4, fiber: 0 } },
    { id: "e2", name: "Black Beans", macros: { calories: 150, protein: 10, carbs: 27, fat: 1, fiber: 8 } },
    { id: "e3", name: "Almonds", macros: { calories: 170, protein: 6, carbs: 6, fat: 15, fiber: 3 } },
  ] };
  const totals = M.getDayTotals("2026-07-16");
  assertEqual(totals.protein, 56, "protein still sums everything");
  assertEqual(totals.plantProtein, 16, "plant-protein total excludes the chicken entry's 40g");
});
test("getDayTotals: a mixed-keyword dish is attributed fully to animal protein (floor, not exact)", function () {
  M.state.foodLogs = { "2026-07-16": [
    { id: "e1", name: "Chicken and Black Bean Burrito", macros: { calories: 400, protein: 30, carbs: 40, fat: 10, fiber: 6 } },
  ] };
  const totals = M.getDayTotals("2026-07-16");
  assertEqual(totals.plantProtein, 0, "any animal keyword match attributes the whole entry to animal protein");
});
test("getDayTotals: an empty day has zero plant-protein total, not NaN/undefined", function () {
  M.state.foodLogs = {};
  assertEqual(M.getDayTotals("2026-07-16").plantProtein, 0, "zero for a day with no entries");
});

// ==== estimateMaintenanceCalories / computeGoalPlan ====
// Both are relative to the real current date (they window over "the last 28 days"), so the
// synthetic logs are built with date offsets from today rather than fixed dates.
function daysAgoStr(n) { return M.fmtDate(new Date(Date.now() - n * 86400000)); }
function seedMaintenanceData(opts) {
  // opts: { intake, foodDays, firstWeight, lastWeight, weightSpanDays }
  M.state.settings = Object.assign({}, M.DEFAULT_SETTINGS, { weightUnit: "lbs" });
  M.state.foodLogs = {};
  for (let i = 1; i <= opts.foodDays; i++) {
    M.state.foodLogs[daysAgoStr(i)] = [{ id: "e" + i, name: "Meal", macros: { calories: opts.intake, protein: 0, carbs: 0, fat: 0, fiber: 0 } }];
  }
  M.state.weights = {};
  M.state.weights[daysAgoStr(opts.weightSpanDays)] = { weight: opts.firstWeight, unit: "lbs", timestamp: "", updatedAt: "" };
  M.state.weights[daysAgoStr(0)] = { weight: opts.lastWeight, unit: "lbs", timestamp: "", updatedAt: "" };
}
test("estimateMaintenanceCalories: flat weight means maintenance equals average intake", function () {
  seedMaintenanceData({ intake: 2000, foodDays: 20, firstWeight: 180, lastWeight: 180, weightSpanDays: 20 });
  const est = M.estimateMaintenanceCalories();
  assertEqual(est.maintenance, 2000, "no weight change: burning exactly what's eaten");
  assertEqual(est.daysUsed, 20, "all complete days counted");
});
test("estimateMaintenanceCalories: losing weight means maintenance is above intake", function () {
  // 2 lbs lost over 14 days while eating 2000/day: deficit was 2*3500/14 = 500/day, so TDEE ~2500
  seedMaintenanceData({ intake: 2000, foodDays: 14, firstWeight: 182, lastWeight: 180, weightSpanDays: 14 });
  assertEqual(M.estimateMaintenanceCalories().maintenance, 2500, "intake + measured deficit");
});
test("estimateMaintenanceCalories: sub-800-kcal days are treated as incomplete and skipped", function () {
  seedMaintenanceData({ intake: 2000, foodDays: 15, firstWeight: 180, lastWeight: 180, weightSpanDays: 20 });
  M.state.foodLogs[daysAgoStr(16)] = [{ id: "partial", name: "Snack", macros: { calories: 300, protein: 0, carbs: 0, fat: 0, fiber: 0 } }];
  const est = M.estimateMaintenanceCalories();
  assertEqual(est.daysUsed, 15, "the 300-kcal day is excluded");
  assertEqual(est.maintenance, 2000, "average is not dragged down by the partial day");
});
test("estimateMaintenanceCalories: returns null with too few logged days", function () {
  seedMaintenanceData({ intake: 2000, foodDays: 5, firstWeight: 180, lastWeight: 180, weightSpanDays: 20 });
  assertEqual(M.estimateMaintenanceCalories(), null, "5 food days is below the 10-day minimum");
});
test("estimateMaintenanceCalories: returns null when weigh-ins span under 14 days", function () {
  seedMaintenanceData({ intake: 2000, foodDays: 20, firstWeight: 180, lastWeight: 180, weightSpanDays: 7 });
  assertEqual(M.estimateMaintenanceCalories(), null, "a 7-day weight window is too noisy to trust");
});
test("computeGoalPlan: by-date recommendation puts a cut below maintenance", function () {
  seedMaintenanceData({ intake: 2000, foodDays: 20, firstWeight: 180, lastWeight: 180, weightSpanDays: 20 });
  M.state.settings.goalWeight = 170;
  M.state.settings.goalDate = daysAgoStr(-70); // 70 days out = 10 weeks
  M.state.settings.goalRatePerWeek = "";
  const plan = M.computeGoalPlan(2500);
  assertEqual(plan.byDate.ratePerWeek, -1, "10 lbs over 10 weeks = 1 lb/week loss");
  assertEqual(plan.byDate.calories, 2000, "maintenance 2500 minus a 500/day deficit");
  assertEqual(plan.byRate, undefined, "no rate chosen, no by-rate row");
});
test("computeGoalPlan: by-rate recommendation includes pace, calories, and projected weeks", function () {
  seedMaintenanceData({ intake: 2000, foodDays: 20, firstWeight: 180, lastWeight: 180, weightSpanDays: 20 });
  M.state.settings.goalWeight = 170;
  M.state.settings.goalDate = "";
  M.state.settings.goalRatePerWeek = "2";
  const plan = M.computeGoalPlan(2500);
  assertEqual(plan.byRate.ratePerWeek, -2, "direction inferred from goal being below current");
  assertEqual(plan.byRate.calories, 1500, "maintenance 2500 minus a 1000/day deficit");
  assertEqual(plan.byRate.weeks, 5, "10 lbs at 2/week");
});
test("computeGoalPlan: a bulk goal comes out above maintenance", function () {
  seedMaintenanceData({ intake: 2000, foodDays: 20, firstWeight: 180, lastWeight: 180, weightSpanDays: 20 });
  M.state.settings.goalWeight = 190;
  M.state.settings.goalDate = "";
  M.state.settings.goalRatePerWeek = "1";
  const plan = M.computeGoalPlan(2500);
  assertEqual(plan.byRate.ratePerWeek, 1, "positive rate for a bulk");
  assertEqual(plan.byRate.calories, 3000, "maintenance 2500 plus a 500/day surplus");
});
test("computeGoalPlan: a target date in the past yields no by-date row (and null with no rate either)", function () {
  seedMaintenanceData({ intake: 2000, foodDays: 20, firstWeight: 180, lastWeight: 180, weightSpanDays: 20 });
  M.state.settings.goalWeight = 170;
  M.state.settings.goalDate = daysAgoStr(5); // already passed
  M.state.settings.goalRatePerWeek = "";
  assertEqual(M.computeGoalPlan(2500), null, "nothing actionable to recommend");
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
test("mergeWeightsFromCloud: does not resurrect a recently-deleted weight entry", function () {
  M.state.weights = {};
  M.recentlyDeletedIds.weight_entries.clear();
  M.markRecentlyDeleted("weight_entries", "2026-07-10");
  const changed = M.mergeWeightsFromCloud([{ log_date: "2026-07-10", weight: 179, unit: "lbs", logged_at: "2026-07-10T00:00:00.000Z", updated_at: "2026-07-10T00:00:00.000Z" }]);
  assertEqual(changed, 0, "tombstoned date is not re-added");
  assertEqual(M.state.weights["2026-07-10"], undefined, "weights stays empty for that date");
});
test("actions.deleteWeight: removes the local entry and tombstones it against a racing pull", function () {
  M.state.session = null; // no network call attempted, only the local + tombstone effects are checked
  M.state.weights = { "2026-07-11": { weight: 180, unit: "lbs", timestamp: "2026-07-11T00:00:00.000Z", updatedAt: "2026-07-11T00:00:00.000Z" } };
  M.state.ui = { weight: { selectedPoint: "2026-07-11", confirmDeleteDate: "2026-07-11" } };
  M.actions.deleteWeight("2026-07-11");
  assertEqual(M.state.weights["2026-07-11"], undefined, "entry removed locally");
  assertEqual(M.wasRecentlyDeleted("weight_entries", "2026-07-11"), true, "tombstoned so a racing pull can't resurrect it");
  assertEqual(M.state.ui.weight.selectedPoint, null, "chart selection cleared");
  assertEqual(M.state.ui.weight.confirmDeleteDate, null, "confirm state cleared");
});

// ==== mergeCustomBarcodesFromCloud ====
test("mergeCustomBarcodesFromCloud: adds a genuinely new barcode", function () {
  M.state.customBarcodes = {};
  M.recentlyDeletedIds.custom_barcodes.clear();
  const added = M.mergeCustomBarcodesFromCloud([{ barcode: "111", food: { id: "barcode_111", name: "Trail Mix", calories: 400 } }]);
  assertEqual(added, 1, "one barcode added");
  assertEqual(M.state.customBarcodes["111"].name, "Trail Mix", "food data present");
});
test("mergeCustomBarcodesFromCloud: does not resurrect a recently-deleted barcode", function () {
  M.state.customBarcodes = {};
  M.recentlyDeletedIds.custom_barcodes.clear();
  M.markRecentlyDeleted("custom_barcodes", "222");
  const added = M.mergeCustomBarcodesFromCloud([{ barcode: "222", food: { id: "barcode_222", name: "Deleted Snack", calories: 200 } }]);
  assertEqual(added, 0, "tombstoned barcode is not re-added");
  assertEqual(M.state.customBarcodes["222"], undefined, "customBarcodes stays empty for that code");
});
test("actions.deleteBarcode: removes the local entry and tombstones it against a racing pull", function () {
  M.state.session = null;
  M.state.customBarcodes = { "333": { id: "barcode_333", name: "Snack", calories: 150 } };
  M.state.ui = { strategy: { editingBarcodeCode: null, editBarcodeManual: null, confirmDeleteBarcodeCode: "333" } };
  M.actions.deleteBarcode("333");
  assertEqual(M.state.customBarcodes["333"], undefined, "entry removed locally");
  assertEqual(M.wasRecentlyDeleted("custom_barcodes", "333"), true, "tombstoned so a racing pull can't resurrect it");
  assertEqual(M.state.ui.strategy.confirmDeleteBarcodeCode, null, "confirm state cleared");
});

// ==== filterFoodsByName (History/Favorites live search) ====
test("filterFoodsByName: substring match is case-insensitive", function () {
  const list = [{ name: "Ice Cream" }, { name: "Ice Water" }, { name: "Bread" }];
  assertEqual(M.filterFoodsByName(list, "ice").length, 2, "matches both ice- foods");
  assertEqual(M.filterFoodsByName(list, "ICE-CREAM".slice(0,3)).length, 2, "case-insensitive");
});
test("filterFoodsByName: blank query returns the full list unfiltered", function () {
  const list = [{ name: "Ice Cream" }, { name: "Bread" }];
  assertEqual(M.filterFoodsByName(list, "").length, 2, "empty query is a no-op filter");
  assertEqual(M.filterFoodsByName(list, "   ").length, 2, "whitespace-only query is a no-op filter");
});
test("filterFoodsByName: no match returns an empty array", function () {
  const list = [{ name: "Ice Cream" }];
  assertEqual(M.filterFoodsByName(list, "zzz").length, 0, "no substring match");
});

// ==== two-step delete confirmation (recipes, log entries) ====
test("askDeleteRecipe: arms the confirm state but does not delete yet", function () {
  M.state.recipes = [{ id: "r1", name: "Chili", ingredients: [] }];
  M.state.ui = { food: { confirmDeleteRecipeId: null } };
  M.actions.askDeleteRecipe("r1");
  assertEqual(M.state.recipes.length, 1, "recipe still present after just arming");
  assertEqual(M.state.ui.food.confirmDeleteRecipeId, "r1", "confirm state now points at the recipe");
});
test("cancelDeleteRecipe: disarms without deleting", function () {
  M.state.recipes = [{ id: "r1", name: "Chili", ingredients: [] }];
  M.state.ui = { food: { confirmDeleteRecipeId: "r1" } };
  M.actions.cancelDeleteRecipe();
  assertEqual(M.state.recipes.length, 1, "recipe untouched");
  assertEqual(M.state.ui.food.confirmDeleteRecipeId, null, "confirm state cleared");
});
test("deleteRecipe: actually removes the recipe (the confirmed step)", function () {
  M.state.recipes = [{ id: "r1", name: "Chili", ingredients: [] }];
  M.state.ui = { food: { confirmDeleteRecipeId: "r1" } };
  M.actions.deleteRecipe("r1");
  assertEqual(M.state.recipes.length, 0, "recipe removed");
  assertEqual(M.state.ui.food.confirmDeleteRecipeId, null, "confirm state cleared");
});
test("askRemoveFood: arms the confirm state but does not remove the log entry yet", function () {
  M.state.date = "2026-07-15";
  M.state.foodLogs = { "2026-07-15": [{ id: "e1", name: "Toast", weight: 50, macros: { calories: 100, protein: 3, carbs: 20, fat: 1, fiber: 1 } }] };
  M.state.ui = { confirmRemoveEntryId: null };
  M.actions.askRemoveFood("e1");
  assertEqual(M.state.foodLogs["2026-07-15"].length, 1, "entry still present after just arming");
  assertEqual(M.state.ui.confirmRemoveEntryId, "e1", "confirm state now points at the entry");
});
test("removeFood: actually removes the entry (the confirmed step)", function () {
  M.state.date = "2026-07-15";
  M.state.foodLogs = { "2026-07-15": [{ id: "e1", name: "Toast", weight: 50, macros: { calories: 100, protein: 3, carbs: 20, fat: 1, fiber: 1 } }] };
  M.state.ui = { confirmRemoveEntryId: "e1" };
  M.actions.removeFood("e1");
  assertEqual(M.state.foodLogs["2026-07-15"].length, 0, "entry removed");
  assertEqual(M.state.ui.confirmRemoveEntryId, null, "confirm state cleared");
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

// ==== calcCaloriesFromMacros (auto-calculated calories in Manual Entry / custom barcode) ====
test("calcCaloriesFromMacros: applies Atwater factors (4/4/9)", function () {
  assertEqual(M.calcCaloriesFromMacros(20, 10, 5), 165, "20p*4 + 10c*4 + 5f*9 = 80+40+45");
});
test("calcCaloriesFromMacros: blank fields treated as zero, no crash", function () {
  assertEqual(M.calcCaloriesFromMacros("", "10", ""), 40, "only carbs counted");
  assertEqual(M.calcCaloriesFromMacros("", "", ""), 0, "all blank is zero, not NaN");
});

// ==== localFoodMatches (instant recent/favorites/cache matches while typing) ====
test("localFoodMatches: matches a previously-logged food by substring, case-insensitively", function () {
  M.state.recentFoods = [{ id: "r1", name: "Ice Cream", source: "USDA", calories: 200, protein: 4, carbs: 24, fat: 11 }];
  M.state.favorites = [];
  M.state.foodCache = {};
  const matches = M.localFoodMatches("ice");
  assertEqual(matches.length, 1, "one recent match");
  assertEqual(matches[0].name, "Ice Cream", "matched the recent item");
});
test("localFoodMatches: does not duplicate a food present in both recentFoods and favorites", function () {
  const food = { id: "f1", name: "Almonds", source: "USDA", calories: 579, protein: 21, carbs: 22, fat: 50 };
  M.state.recentFoods = [food];
  M.state.favorites = [food];
  M.state.foodCache = {};
  assertEqual(M.localFoodMatches("almond").length, 1, "de-duplicated by id across lists");
});
test("localFoodMatches: tags a foodCache-only hit as Cached without mutating the cached entry", function () {
  M.state.recentFoods = [];
  M.state.favorites = [];
  M.state.foodCache = { c1: { id: "c1", name: "Quinoa", source: "USDA", calories: 120, protein: 4, carbs: 21, fat: 2 } };
  const matches = M.localFoodMatches("quinoa");
  assertEqual(matches[0].source, "USDA (Cached)", "cached source suffix applied");
  assertEqual(M.state.foodCache.c1.source, "USDA", "original cache entry left untouched");
});
test("localFoodMatches: no match returns an empty array", function () {
  M.state.recentFoods = [{ id: "r1", name: "Ice Cream", source: "USDA", calories: 200, protein: 4, carbs: 24, fat: 11 }];
  M.state.favorites = [];
  M.state.foodCache = {};
  assertEqual(M.localFoodMatches("zzz").length, 0, "no substring match");
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
