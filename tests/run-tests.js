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
  "copyFoodEntryToDate: copyFoodEntryToDate, " +
  "scheduleCloudSync: scheduleCloudSync, flushPendingCloudSyncs: flushPendingCloudSyncs, " +
  "mergeRecentFoodsFromCloud: mergeRecentFoodsFromCloud, mergeFavoritesFromCloud: mergeFavoritesFromCloud, mergeFoodCacheFromCloud: mergeFoodCacheFromCloud, " +
  "barcodeCodeForEntry: barcodeCodeForEntry, weightChartXPositions: weightChartXPositions, " +
  "dbResultsExcludingHistory: dbResultsExcludingHistory, " +
  "foodBaseGrams: foodBaseGrams, foodQuantityLabel: foodQuantityLabel, " +
  "isAnimalProteinEntry: isAnimalProteinEntry, entryBrandLine: entryBrandLine, entryHasZeroMacros: entryHasZeroMacros, " +
  "addFoodToLog: addFoodToLog, updateFoodEntry: updateFoodEntry, " +
  "flattenFoodLogsForSync: flattenFoodLogsForSync, " +
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
// Regression test for the reported bug: "Loonie Dog" logged at 235 kcal / 83g, then re-added
// from History came back as 195 kcal. Root cause: absolute-portion foods (Manual Entry, AI
// Estimate, Recipe) had no servingSizes recorded, so calcMacrosForWeight assumed a 100g base
// and rescaled 235 * (83/100) = 195.45 -> 195. loggedWeight (always set on these foods) is now
// the fallback base instead of a blind 100g guess.
test("calcMacrosForWeight: an absolute-portion food (no servingSizes) uses loggedWeight as its base, not 100g", function () {
  const loonieDog = { per100g: false, calories: 235, protein: 8, carbs: 20, fat: 14, fiber: 1, loggedWeight: 83, servingSizes: [] };
  assertEqual(M.calcMacrosForWeight(loonieDog, 83), { calories: 235, protein: 8, carbs: 20, fat: 14, fiber: 1 }, "re-adding at the exact same weight must return the exact original macros");
});
test("calcMacrosForWeight: foodBaseGrams prefers servingSizes over loggedWeight when both are present", function () {
  const food = { per100g: false, calories: 100, protein: 5, carbs: 10, fat: 2, fiber: 0, loggedWeight: 83, servingSizes: [{ label: "1 serving", grams: 50 }] };
  assertEqual(M.foodBaseGrams(food), 50, "an explicit serving size still wins over loggedWeight");
});
test("foodBaseGrams: per100g foods always use 100 regardless of loggedWeight", function () {
  assertEqual(M.foodBaseGrams({ per100g: true, loggedWeight: 83 }), 100, "per100g takes priority");
});
test("foodBaseGrams: falls all the way through to 100 when nothing else is available", function () {
  assertEqual(M.foodBaseGrams({ per100g: false }), 100, "last resort");
});

// ==== foodQuantityLabel ====
test("foodQuantityLabel: per100g foods always show kcal/100g", function () {
  assertEqual(M.foodQuantityLabel({ per100g: true, servingSizes: [] }), "kcal/100g", "database foods");
});
test("foodQuantityLabel: absolute-portion foods show their real portion, not a misleading /100g", function () {
  assertEqual(M.foodQuantityLabel({ per100g: false, loggedWeight: 83, servingSizes: [] }), "kcal/83g", "matches the actual portion the calories describe");
});

// ==== round1 ====
test("round1: rounds to one decimal place", function () {
  assertEqual(M.round1(1.24), 1.2, "round down");
  assertEqual(M.round1(1.25), 1.3, "round half up");
  assertEqual(M.round1(1.26), 1.3, "round up");
});

// ==== isAnimalProteinEntry (manual per-entry override) ====
test("isAnimalProteinEntry: null override (Auto) falls through to the keyword guess", function () {
  assertEqual(M.isAnimalProteinEntry({ name: "Grilled Chicken", animalOverride: null }), true, "auto-detected as animal");
  assertEqual(M.isAnimalProteinEntry({ name: "Lentil Soup", animalOverride: null }), false, "auto-detected as plant");
});
test("isAnimalProteinEntry: a manual override wins over the keyword guess in both directions", function () {
  assertEqual(M.isAnimalProteinEntry({ name: "Grilled Chicken", animalOverride: false }), false, "manually marked plant despite the word chicken");
  assertEqual(M.isAnimalProteinEntry({ name: "Lentil Soup", animalOverride: true }), true, "manually marked animal despite no matching keyword");
});

// ==== entryBrandLine (dashboard card display) ====
test("entryBrandLine: shows a real, distinct brand", function () {
  assertEqual(M.entryBrandLine({ brand: "Schneiders", source: "Open Food Facts (Barcode)" }), "Schneiders", "real brand shown");
});
test("entryBrandLine: hides the line when there's no brand", function () {
  assertEqual(M.entryBrandLine({ brand: "", source: "USDA" }), null, "empty brand suppressed");
  assertEqual(M.entryBrandLine({ source: "USDA" }), null, "missing brand field suppressed");
});
test("entryBrandLine: hides the line when the brand would just repeat the source line underneath", function () {
  assertEqual(M.entryBrandLine({ brand: "Manual Entry", source: "Manual Entry" }), null, "no point showing the same text twice");
});

// ==== entryHasZeroMacros (dashboard warning flag) ====
test("entryHasZeroMacros: flags an entry with no protein/carbs/fat recorded", function () {
  assertEqual(M.entryHasZeroMacros({ macros: { calories: 150, protein: 0, carbs: 0, fat: 0, fiber: 0 } }), true, "flagged despite having calories -- that's the whole point, calories with no macro breakdown is the suspicious case");
});
test("entryHasZeroMacros: a normal entry with real macros is not flagged", function () {
  assertEqual(M.entryHasZeroMacros({ macros: { calories: 150, protein: 5, carbs: 20, fat: 3, fiber: 1 } }), false, "has real macros");
});
test("entryHasZeroMacros: only one or two zero macros is not flagged (e.g. pure fat or pure carbs is plausible)", function () {
  assertEqual(M.entryHasZeroMacros({ macros: { calories: 100, protein: 0, carbs: 0, fat: 11, fiber: 0 } }), false, "pure fat (e.g. oil) is a real food, not flagged");
});

// ==== actions.saveEntryDetails (edit name/brand/plant-protein override after logging) ====
test("actions.saveEntryDetails: edits name, brand, and animal override together", function () {
  M.state.date = "2026-07-21";
  M.state.foodLogs = { "2026-07-21": [{ id: "e1", name: "hot dog", brand: "", source: "Open Food Facts (Barcode)", weight: 83, macros: { calories: 235, protein: 8, carbs: 20, fat: 14, fiber: 1 }, animalOverride: null }] };
  M.state.ui = { editingEntryId: "e1", entryNameInput: "Loonie Dog", entryBrandInput: "Schneiders", entryAnimalOverrideInput: true };
  M.actions.saveEntryDetails();
  const saved = M.state.foodLogs["2026-07-21"][0];
  assertEqual(saved.name, "Loonie Dog", "name updated");
  assertEqual(saved.brand, "Schneiders", "brand updated");
  assertEqual(saved.animalOverride, true, "override updated");
  assertEqual(M.state.ui.editingEntryId, null, "editor closes on save");
});
test("addFoodToLog: carries brand and animalOverride from the food object onto the log entry", function () {
  M.state.date = "2026-07-21";
  M.state.foodLogs = {};
  M.addFoodToLog({ id: "off_1", name: "Hot Dog", brand: "Schneiders", source: "Open Food Facts (Barcode)", loggedWeight: 83, calories: 235, protein: 8, carbs: 20, fat: 14, fiber: 1, animalOverride: true });
  const entry = M.state.foodLogs["2026-07-21"][0];
  assertEqual(entry.brand, "Schneiders", "brand carried onto the entry");
  assertEqual(entry.animalOverride, true, "override carried onto the entry");
});
test("addFoodToLog: defaults brand to empty string and override to null when the food doesn't specify them", function () {
  M.state.date = "2026-07-21";
  M.state.foodLogs = {};
  M.addFoodToLog({ id: "usda_1", name: "Broccoli", source: "USDA", calories: 34, protein: 3, carbs: 7, fat: 0, fiber: 3 });
  const entry = M.state.foodLogs["2026-07-21"][0];
  assertEqual(entry.brand, "", "no brand defaults to empty string, not undefined");
  assertEqual(entry.animalOverride, null, "no override defaults to null (Auto)");
});
test("actions.saveEntryDetails: refuses to save a blank name", function () {
  M.state.date = "2026-07-21";
  M.state.foodLogs = { "2026-07-21": [{ id: "e1", name: "Loonie Dog", brand: "Schneiders", source: "Open Food Facts (Barcode)", weight: 83, macros: { calories: 235, protein: 8, carbs: 20, fat: 14, fiber: 1 }, animalOverride: null }] };
  M.state.ui = { editingEntryId: "e1", entryNameInput: "   ", entryBrandInput: "Schneiders", entryAnimalOverrideInput: null };
  M.actions.saveEntryDetails();
  assertEqual(M.state.foodLogs["2026-07-21"][0].name, "Loonie Dog", "original name preserved, blank rejected");
  assertEqual(M.state.ui.editingEntryId, "e1", "editor stays open since nothing was saved");
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

// ==== copyFoodEntryToDate ====
test("copyFoodEntryToDate: duplicates the entry onto the target date with a new id", function () {
  M.state.date = "2026-07-16";
  M.state.foodLogs = { "2026-07-16": [{ id: "e1", foodId: "f1", name: "Oatmeal", weight: 100, macros: { calories: 150, protein: 5, carbs: 27, fat: 3, fiber: 4 }, timestamp: "2026-07-16T08:00:00.000Z", source: "USDA" }] };
  const ok = M.copyFoodEntryToDate("e1", "2026-07-17");
  assertEqual(ok, true, "copy succeeds");
  assertEqual(M.state.foodLogs["2026-07-16"].length, 1, "original entry untouched, still on the source date");
  assertEqual(M.state.foodLogs["2026-07-17"].length, 1, "one new entry on the target date");
  const copy = M.state.foodLogs["2026-07-17"][0];
  assertEqual(copy.name, "Oatmeal", "food data carried over");
  assertEqual(copy.macros.calories, 150, "macros carried over");
  assertEqual(copy.id === "e1", false, "copy gets its own id, distinct from the original");
});
test("copyFoodEntryToDate: copying onto the same date is allowed (duplicate a second serving)", function () {
  M.state.date = "2026-07-16";
  M.state.foodLogs = { "2026-07-16": [{ id: "e1", foodId: "f1", name: "Snack", weight: 50, macros: { calories: 100, protein: 2, carbs: 10, fat: 5, fiber: 1 }, timestamp: "2026-07-16T08:00:00.000Z", source: "Manual" }] };
  const ok = M.copyFoodEntryToDate("e1", "2026-07-16");
  assertEqual(ok, true, "same-date copy succeeds (unlike move, which treats this as a no-op)");
  assertEqual(M.state.foodLogs["2026-07-16"].length, 2, "now two entries on the same day");
});
test("copyFoodEntryToDate: unknown entry id fails without touching state", function () {
  M.state.date = "2026-07-16";
  M.state.foodLogs = { "2026-07-16": [{ id: "e1", foodId: "f1", name: "Oatmeal", weight: 100, macros: { calories: 150, protein: 5, carbs: 27, fat: 3, fiber: 4 } }] };
  const ok = M.copyFoodEntryToDate("does_not_exist", "2026-07-17");
  assertEqual(ok, false, "no matching entry to copy");
  assertEqual(M.state.foodLogs["2026-07-17"], undefined, "no entry created on the target date");
});
test("actions.copyEntryTomorrow: leaves the editor open (unlike moving, which closes it)", function () {
  M.state.date = "2026-07-16";
  M.state.foodLogs = { "2026-07-16": [{ id: "e1", foodId: "f1", name: "Oatmeal", weight: 100, macros: { calories: 150, protein: 5, carbs: 27, fat: 3, fiber: 4 } }] };
  M.state.ui = { editingEntryId: "e1", entrySection: "copy" };
  M.actions.copyEntryTomorrow();
  assertEqual(M.state.ui.editingEntryId, "e1", "editor stays open on the same entry for repeat copies");
  assertEqual(M.state.foodLogs["2026-07-17"].length, 1, "copy landed on tomorrow");
});
test("actions.moveEntryToday: moves an entry from a past viewed day back to the real current date", function () {
  const today = M.fmtDate(new Date());
  M.state.date = "2026-01-01"; // a day in the past being viewed -- distinct from "today"
  M.state.foodLogs = { "2026-01-01": [{ id: "e1", foodId: "f1", name: "Leftover Pizza", weight: 200, macros: { calories: 500, protein: 20, carbs: 60, fat: 20, fiber: 3 } }] };
  M.state.ui = { editingEntryId: "e1", entrySection: "move" };
  M.actions.moveEntryToday();
  assertEqual(M.state.foodLogs["2026-01-01"].length, 0, "removed from the viewed day");
  assertEqual(M.state.foodLogs[today].length, 1, "moved onto the real current date, not just \"tomorrow\" relative to the viewed day");
  assertEqual(M.state.ui.editingEntryId, null, "editor closes, matching moveEntryYesterday/Tomorrow");
});
test("actions.copyEntryToday: duplicates an entry from a past viewed day onto today, leaving the original", function () {
  const today = M.fmtDate(new Date());
  M.state.date = "2026-01-01";
  M.state.foodLogs = { "2026-01-01": [{ id: "e1", foodId: "f1", name: "Leftover Pizza", weight: 200, macros: { calories: 500, protein: 20, carbs: 60, fat: 20, fiber: 3 } }] };
  M.state.ui = { editingEntryId: "e1", entrySection: "copy" };
  M.actions.copyEntryToday();
  assertEqual(M.state.foodLogs["2026-01-01"].length, 1, "original untouched on the viewed day");
  assertEqual(M.state.foodLogs[today].length, 1, "copy landed on the real current date");
  assertEqual(M.state.ui.editingEntryId, "e1", "editor stays open, matching copyEntryYesterday/Tomorrow");
});

// ==== scheduleCloudSync / flushPendingCloudSyncs ====
// Guards against the exact bug this was built to fix: a debounced push that never fires
// because the app was backgrounded/closed within the 2.5s window, leaving an entry stranded
// in local storage with no cloud copy.
test("flushPendingCloudSyncs: fires a pending debounced push immediately instead of waiting out the timer", function () {
  M.state.session = { userId: "test-user", accessToken: "tok", expiresAt: Date.now() + 100000 };
  let calls = 0;
  M.scheduleCloudSync("testKind", function () { calls++; return Promise.resolve({ data: [] }); });
  assertEqual(calls, 0, "push has not fired yet -- still inside the debounce window");
  M.flushPendingCloudSyncs();
  assertEqual(calls, 1, "flush fires the pending push right away");
  M.state.session = null;
});
test("flushPendingCloudSyncs: a second flush with nothing pending is a safe no-op", function () {
  M.state.session = { userId: "test-user", accessToken: "tok", expiresAt: Date.now() + 100000 };
  let calls = 0;
  M.scheduleCloudSync("testKind2", function () { calls++; return Promise.resolve({ data: [] }); });
  M.flushPendingCloudSyncs();
  M.flushPendingCloudSyncs();
  assertEqual(calls, 1, "flushing twice does not double-fire the same push");
  M.state.session = null;
});
test("scheduleCloudSync: a second schedule for the same kind before flush replaces, not duplicates, the pending push", function () {
  M.state.session = { userId: "test-user", accessToken: "tok", expiresAt: Date.now() + 100000 };
  let firstCalls = 0, secondCalls = 0;
  M.scheduleCloudSync("testKind3", function () { firstCalls++; return Promise.resolve({ data: [] }); });
  M.scheduleCloudSync("testKind3", function () { secondCalls++; return Promise.resolve({ data: [] }); });
  M.flushPendingCloudSyncs();
  assertEqual(firstCalls, 0, "the superseded push never fires");
  assertEqual(secondCalls, 1, "only the latest scheduled push for that kind fires");
  M.state.session = null;
});

// ==== whole-blob merges restore history into an empty local store ====
// These merges are the second half of the "history empty sometimes" fix: pullAndMergeAll now
// pulls+merges BEFORE pushing, and these additive merges must repopulate an empty local store
// from the cloud (rather than the old order, where an empty local was pushed up and clobbered
// the cloud master copy). The reorder itself is verified by reading pullAndMergeAll; these
// tests pin the invariant the reorder depends on -- merging is purely additive and never drops.
test("mergeRecentFoodsFromCloud: repopulates an empty local history from the cloud", function () {
  M.state.recentFoods = [];
  const added = M.mergeRecentFoodsFromCloud([
    { id: "f1", name: "Oatmeal" }, { id: "f2", name: "Chicken" },
  ]);
  assertEqual(added, 2, "both cloud items restored");
  assertEqual(M.state.recentFoods.length, 2, "local history repopulated");
});
test("mergeRecentFoodsFromCloud: keeps local items and unions in only the new cloud ones", function () {
  M.state.recentFoods = [{ id: "f1", name: "Oatmeal (local)" }];
  const added = M.mergeRecentFoodsFromCloud([
    { id: "f1", name: "Oatmeal (cloud)" }, { id: "f3", name: "Rice" },
  ]);
  assertEqual(added, 1, "only the genuinely-new cloud item is added");
  assertEqual(M.state.recentFoods.length, 2, "local item preserved, not overwritten");
  assertEqual(M.state.recentFoods[0].name, "Oatmeal (local)", "local copy of a shared id wins (no clobber)");
});
test("mergeFavoritesFromCloud: repopulates empty local favorites from the cloud", function () {
  M.state.favorites = [];
  const added = M.mergeFavoritesFromCloud([{ id: "fav1", name: "Almonds" }]);
  assertEqual(added, 1, "favorite restored from cloud");
});
test("mergeFoodCacheFromCloud: repopulates empty local foodCache from the cloud", function () {
  M.state.foodCache = {};
  const added = M.mergeFoodCacheFromCloud({ c1: { id: "c1", name: "Quinoa" } });
  assertEqual(added, 1, "cache entry restored");
  assertEqual(M.state.foodCache.c1.name, "Quinoa", "cache entry present by id");
});
test("merge functions treat a null/absent cloud blob as a no-op (fresh account, no data yet)", function () {
  M.state.recentFoods = [{ id: "f1", name: "Oatmeal" }];
  assertEqual(M.mergeRecentFoodsFromCloud(null), 0, "null cloud blob adds nothing");
  assertEqual(M.state.recentFoods.length, 1, "local untouched when cloud has nothing");
});

// ==== barcodeCodeForEntry / saveBarcodeCorrection ====
test("barcodeCodeForEntry: extracts the code from a hand-entered custom barcode entry", function () {
  assertEqual(M.barcodeCodeForEntry({ foodId: "barcode_012345678905", source: "Custom Barcode Entry" }), "012345678905", "barcode_ prefix stripped");
});
test("barcodeCodeForEntry: extracts the code from an Open Food Facts barcode scan", function () {
  assertEqual(M.barcodeCodeForEntry({ foodId: "off_5000159484695", source: "Open Food Facts (Barcode)" }), "5000159484695", "off_ prefix stripped for a barcode scan");
});
test("barcodeCodeForEntry: returns null for a text-searched OFF item (id may not be a real barcode)", function () {
  assertEqual(M.barcodeCodeForEntry({ foodId: "off_12345", source: "Open Food Facts" }), null, "plain OFF search source is excluded");
});
test("barcodeCodeForEntry: returns null for non-barcode foods (USDA, manual, AI)", function () {
  assertEqual(M.barcodeCodeForEntry({ foodId: "usda_9999", source: "USDA" }), null, "USDA item");
  assertEqual(M.barcodeCodeForEntry({ foodId: "manual_123", source: "Manual Entry" }), null, "manual entry");
  assertEqual(M.barcodeCodeForEntry({ foodId: null, source: "AI Estimate" }), null, "missing foodId");
});
test("actions.saveBarcodeCorrection: writes the entry's current weight+macros into customBarcodes so future scans use them", function () {
  M.state.date = "2026-07-20";
  M.state.customBarcodes = {};
  M.state.foodLogs = { "2026-07-20": [{
    id: "e1", foodId: "off_5000159484695", name: "Chocolate Bar", source: "Open Food Facts (Barcode)",
    weight: 45, macros: { calories: 240, protein: 3, carbs: 26, fat: 13, fiber: 1 },
  }] };
  M.actions.saveBarcodeCorrection("e1");
  const corrected = M.state.customBarcodes["5000159484695"];
  assertEqual(!!corrected, true, "a custom barcode override now exists keyed by the raw barcode");
  assertEqual(corrected.calories, 240, "corrected macros captured");
  assertEqual(corrected.per100g, false, "stored per-serving, matching hand-entered custom barcodes");
  assertEqual(corrected.servingSizes[0].grams, 45, "the logged weight becomes the serving size");
});
test("actions.saveBarcodeCorrection: does nothing for a non-barcode entry", function () {
  M.state.date = "2026-07-20";
  M.state.customBarcodes = {};
  M.state.foodLogs = { "2026-07-20": [{ id: "e2", foodId: "usda_1", name: "Broccoli", source: "USDA", weight: 100, macros: { calories: 34, protein: 3, carbs: 7, fat: 0, fiber: 3 } }] };
  M.actions.saveBarcodeCorrection("e2");
  assertEqual(Object.keys(M.state.customBarcodes).length, 0, "no override created for a non-barcode food");
});

// ==== dbResultsExcludingHistory (search: "Eaten before" group vs database group) ====
test("dbResultsExcludingHistory: drops database hits already shown in the history group", function () {
  const history = [{ id: "usda_1", name: "Oatmeal", calories: 150, protein: 5 }];
  const db = [
    { id: "usda_1", name: "Oatmeal", calories: 150, protein: 5, source: "USDA" },
    { id: "usda_2", name: "Oat Bran", calories: 240, protein: 17, source: "USDA" },
  ];
  const out = M.dbResultsExcludingHistory(history, db);
  assertEqual(out.length, 1, "the already-eaten item is not repeated in the database group");
  assertEqual(out[0].id, "usda_2", "the genuinely new database hit remains");
});
test("dbResultsExcludingHistory: empty history returns all database results", function () {
  const db = [{ id: "usda_1", name: "Oatmeal", calories: 150, protein: 5, source: "USDA" }];
  assertEqual(M.dbResultsExcludingHistory([], db).length, 1, "nothing filtered when history is empty");
  assertEqual(M.dbResultsExcludingHistory(null, db).length, 1, "null history is treated as empty");
});
test("dbResultsExcludingHistory: still de-duplicates USDA against Open Food Facts within the database group", function () {
  const db = [
    { id: "usda_1", name: "Almonds", calories: 579, protein: 21, source: "USDA" },
    { id: "off_9", name: "Almonds", calories: 579, protein: 21, source: "Open Food Facts" },
  ];
  const out = M.dbResultsExcludingHistory([], db);
  assertEqual(out.length, 1, "same food from both databases collapses to one row");
});

// ==== weightChartXPositions (time-proportional X axis) ====
test("weightChartXPositions: consecutive days are evenly spaced", function () {
  const xs = M.weightChartXPositions(["2026-07-01", "2026-07-02", "2026-07-03"], 0, 100);
  assertEqual(xs, [0, 50, 100], "3 consecutive days at 0/50/100");
});
test("weightChartXPositions: a skipped day leaves a proportional gap, not an even one", function () {
  // Days 1, 2, then 4 (day 3 skipped). Middle point should sit 1/3 across (day 2 of a 3-day
  // span), NOT halfway as evenly-spaced-by-index would put it.
  const xs = M.weightChartXPositions(["2026-07-01", "2026-07-02", "2026-07-04"], 0, 300);
  assertEqual(xs, [0, 100, 300], "middle day at 1/3 of the span, reflecting the real gap after it");
});
test("weightChartXPositions: a larger gap stretches proportionally", function () {
  // Day 1, day 2, day 12: the last point is 11 days from the start, the middle 1 day in.
  const xs = M.weightChartXPositions(["2026-07-01", "2026-07-02", "2026-07-12"], 0, 110);
  assertEqual(xs[1], 10, "one day into an 11-day span = 10px of 110");
  assertEqual(xs[2], 110, "final day at the right edge");
});
test("weightChartXPositions: degenerate single-date span collapses to the left edge", function () {
  assertEqual(M.weightChartXPositions(["2026-07-01", "2026-07-01"], 5, 100), [5, 5], "no time span, both at x0");
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
test("mergeFoodLogsFromCloud: brand and animal_override round-trip from a cloud row", function () {
  M.state.foodLogs = {};
  M.recentlyDeletedIds.food_log_entries.clear();
  M.mergeFoodLogsFromCloud([{
    id: "log_brand1", log_date: "2026-07-15", food_id: "off_1", name: "Hot Dog", weight: 100,
    calories: 250, protein: 10, carbs: 5, fat: 20, fiber: 0, source: "Open Food Facts (Barcode)",
    brand: "Schneiders", animal_override: true,
    logged_at: "2026-07-15T00:00:00.000Z", updated_at: "2026-07-15T00:00:00.000Z",
  }]);
  const entry = M.state.foodLogs["2026-07-15"][0];
  assertEqual(entry.brand, "Schneiders", "brand carried over from the cloud row");
  assertEqual(entry.animalOverride, true, "animal_override carried over as animalOverride (camelCase, boolean true)");
});
test("flattenFoodLogsForSync: always includes brand/animal_override keys, even when unset (PostgREST bulk upsert needs a consistent column set across every row)", function () {
  M.state.session = { userId: "test-user" };
  M.state.date = "2026-07-15";
  M.state.foodLogs = { "2026-07-15": [
    { id: "e1", name: "Broccoli", weight: 100, macros: { calories: 34, protein: 3, carbs: 7, fat: 0, fiber: 3 } }, // no brand/animalOverride set at all
  ] };
  const rows = M.flattenFoodLogsForSync();
  assertEqual("brand" in rows[0], true, "brand key present even when the entry never set one");
  assertEqual(rows[0].brand, null, "explicit null, not omitted");
  assertEqual("animal_override" in rows[0], true, "animal_override key present even when unset");
  assertEqual(rows[0].animal_override, null, "explicit null, not omitted");
  M.state.session = null;
});
test("flattenFoodLogsForSync: carries a set brand/animalOverride through to the row", function () {
  M.state.session = { userId: "test-user" };
  M.state.date = "2026-07-15";
  M.state.foodLogs = { "2026-07-15": [
    { id: "e2", name: "Hot Dog", brand: "Schneiders", animalOverride: true, weight: 100, macros: { calories: 250, protein: 10, carbs: 5, fat: 20, fiber: 0 } },
  ] };
  const rows = M.flattenFoodLogsForSync();
  assertEqual(rows[0].brand, "Schneiders", "brand carried through");
  assertEqual(rows[0].animal_override, true, "animalOverride carried through as animal_override (snake_case)");
  M.state.session = null;
});
test("mergeFoodLogsFromCloud: a null animal_override/brand from the cloud maps to null, not undefined", function () {
  M.state.foodLogs = {};
  M.recentlyDeletedIds.food_log_entries.clear();
  M.mergeFoodLogsFromCloud([{
    id: "log_brand2", log_date: "2026-07-15", food_id: "usda_1", name: "Broccoli", weight: 100,
    calories: 34, protein: 3, carbs: 7, fat: 0, fiber: 3, source: "USDA",
    brand: null, animal_override: null,
    logged_at: "2026-07-15T00:00:00.000Z", updated_at: "2026-07-15T00:00:00.000Z",
  }]);
  const entry = M.state.foodLogs["2026-07-15"][0];
  assertEqual(entry.brand, null, "no brand stays null");
  assertEqual(entry.animalOverride, null, "no override stays null (auto-guess still applies)");
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
