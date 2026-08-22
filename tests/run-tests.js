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
  // Node's TextEncoder, forwarded so utf8ByteLength measures real UTF-8 bytes in tests too.
  TextEncoder: TextEncoder,
  // Node's atob, forwarded so dataUrlToBlob can decode pending photos in upload tests.
  atob: atob,
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
  "mergeCustomBarcodesFromCloud: mergeCustomBarcodesFromCloud, filterFoodsByQuery: filterFoodsByQuery, " +
  "isAnimalProteinFood: isAnimalProteinFood, getDayTotals: getDayTotals, " +
  "estimateMaintenanceCalories: estimateMaintenanceCalories, computeGoalPlan: computeGoalPlan, " +
  "copyFoodEntryToDate: copyFoodEntryToDate, " +
  "scheduleCloudSync: scheduleCloudSync, flushPendingCloudSyncs: flushPendingCloudSyncs, " +
  "mergeRecentFoodsFromCloud: mergeRecentFoodsFromCloud, mergeFavoritesFromCloud: mergeFavoritesFromCloud, mergeFoodCacheFromCloud: mergeFoodCacheFromCloud, " +
  "barcodeCodeForEntry: barcodeCodeForEntry, weightChartXPositions: weightChartXPositions, " +
  "dbResultsExcludingHistory: dbResultsExcludingHistory, " +
  "renderFoodResultGroups: renderFoodResultGroups, renderIngredientResultsBlock: renderIngredientResultsBlock, " +
  "renderPickerHistoryListBlock: renderPickerHistoryListBlock, pickerBrowseRow: pickerBrowseRow, " +
  "renderIngredientPickerScreen: renderIngredientPickerScreen, " +
  "deliverScannedFood: deliverScannedFood, handleBarcodeDetected: handleBarcodeDetected, " +
  "recipeMatchesQuery: recipeMatchesQuery, matchingRecipes: matchingRecipes, filterRecipesByQuery: filterRecipesByQuery, " +
  "historyExcludingRecipes: historyExcludingRecipes, recipeAsFood: recipeAsFood, renderRecipesListBlock: renderRecipesListBlock, " +
  "foodBaseGrams: foodBaseGrams, foodQuantityLabel: foodQuantityLabel, " +
  "isAnimalProteinEntry: isAnimalProteinEntry, entryBrandLine: entryBrandLine, entryHasZeroMacros: entryHasZeroMacros, " +
  "animalOverrideForFood: animalOverrideForFood, " +
  "entryTimestampForTime: entryTimestampForTime, entryTimeInputValue: entryTimeInputValue, " +
  "entryTimeLabel: entryTimeLabel, renderEntryEditor: renderEntryEditor, " +
  "targetsForDate: targetsForDate, recordTargetChange: recordTargetChange, syncTargetBaseline: syncTargetBaseline, " +
  "targetSnapshotOf: targetSnapshotOf, sameTargets: sameTargets, earliestLoggedDate: earliestLoggedDate, " +
  "mergeTargetHistoryFromCloud: mergeTargetHistoryFromCloud, renderTargetHistoryBlock: renderTargetHistoryBlock, " +
  "addFoodToLog: addFoodToLog, updateFoodEntry: updateFoodEntry, " +
  "flattenFoodLogsForSync: flattenFoodLogsForSync, " +
  "weightRangeStats: weightRangeStats, weightStatsRangeLabel: weightStatsRangeLabel, weightChartCutoff: weightChartCutoff, " +
  "updateFoodRecordEverywhere: updateFoodRecordEverywhere, " +
  "anchorFoodBase: anchorFoodBase, positiveGramsOr: positiveGramsOr, aiItemGrams: aiItemGrams, " +
  "entryMatchesFood: entryMatchesFood, rescaleEntryMacros: rescaleEntryMacros, " +
  "groupEntriesByHourNewestFirst: groupEntriesByHourNewestFirst, foodMatchesQuery: foodMatchesQuery, " +
  "propagateCustomFoodEdit: propagateCustomFoodEdit, foodUi: foodUi, " +
  "foodRecordIsNewer: foodRecordIsNewer, mergeFoodListFromCloud: mergeFoodListFromCloud, " +
  "pruneFoodCache: pruneFoodCache, FOOD_CACHE_CAP: FOOD_CACHE_CAP, recordSyncFailure: recordSyncFailure, " +
  "pushAppDataToCloud: pushAppDataToCloud, " +
  "moveFoodEntryToDate: moveFoodEntryToDate, exportSnapshot: exportSnapshot, " +
  "loadPendingDeletes: loadPendingDeletes, savePendingDeletes: savePendingDeletes, " +
  "hasPendingDelete: hasPendingDelete, enqueuePendingDelete: enqueuePendingDelete, " +
  "dequeuePendingDelete: dequeuePendingDelete, removeFoodFromLog: removeFoodFromLog, " +
  "fitsKeepaliveQuota: fitsKeepaliveQuota, utf8ByteLength: utf8ByteLength, " +
  "dayBoostFor: dayBoostFor, boostCalories: boostCalories, getDayTargets: getDayTargets, " +
  "writeDayBoost: writeDayBoost, mergeDayBoostsFromCloud: mergeDayBoostsFromCloud, " +
  "renderDayBoostBlock: renderDayBoostBlock, logoSvg: logoSvg, " +
  "signedKcal: signedKcal, weeklyDeltaLog: weeklyDeltaLog, renderWeeklyDeltaCard: renderWeeklyDeltaCard, " +
  "KEEPALIVE_BODY_BUDGET_BYTES: KEEPALIVE_BODY_BUDGET_BYTES, supabaseTable: supabaseTable, " +
  "flattenWeightsForSync: flattenWeightsForSync, pushWeightsToCloud: pushWeightsToCloud, " +
  "dashboardFeedFor: dashboardFeedFor, mergeDashboardFeedFromCloud: mergeDashboardFeedFromCloud, " +
  "renderDashboardFeedBlock: renderDashboardFeedBlock, pullAndMergeAll: pullAndMergeAll, " +
  "hourGroupMacros: hourGroupMacros, barcodeScanConfirm: barcodeScanConfirm, " +
  "BARCODE_CONFIRM_MS: BARCODE_CONFIRM_MS, BARCODE_CONFIRM_MIN_READS: BARCODE_CONFIRM_MIN_READS, " +
  "BARCODE_CONFIRM_STALE_MS: BARCODE_CONFIRM_STALE_MS, " +
  "weightChartHitBands: weightChartHitBands, renderSelectedWeightSlot: renderSelectedWeightSlot, " +
  "weightRangeDays: weightRangeDays, weightChartWindowBounds: weightChartWindowBounds, " +
  "weightTrendSeries: weightTrendSeries, WEIGHT_TREND_DAYS: WEIGHT_TREND_DAYS, " +
  "weightTrendReadout: weightTrendReadout, weightGoalProjection: weightGoalProjection, " +
  "scaleMealItem: scaleMealItem, scaleMealItemsToWeight: scaleMealItemsToWeight, " +
  "mealTotalsMacros: mealTotalsMacros, renderQuickMealChips: renderQuickMealChips, " +
  "dataHealthBasisFindings: dataHealthBasisFindings, dataHealthAtwaterFindings: dataHealthAtwaterFindings, " +
  "dataHealthRecordFindings: dataHealthRecordFindings, runDataHealthCheck: runDataHealthCheck, " +
  "buildInsightsSummary: buildInsightsSummary, renderInsightsSection: renderInsightsSection, " +
  "phaseCoach: phaseCoach, renderPhaseCoachCard: renderPhaseCoachCard, " +
  "phaseDeltaColor: phaseDeltaColor, phaseRateColor: phaseRateColor, " +
  "wizardSearchTerm: wizardSearchTerm, wizardSearchQuery: wizardSearchQuery, " +
  "searchUSDA: searchUSDA, " +
  "WIZARD_CONFIGS: WIZARD_CONFIGS, renderWizardScreen: renderWizardScreen, " +
  "applyCalorieTargetWithLocks: applyCalorieTargetWithLocks, renderWeightGoalsSection: renderWeightGoalsSection, " +
  "renderDisplaySection: renderDisplaySection, " +
  "clampWeightPanOffset: clampWeightPanOffset, renderWeightTab: renderWeightTab, " +
  "waistEntryIsEmpty: waistEntryIsEmpty, mergeWaistEntriesFromCloud: mergeWaistEntriesFromCloud, " +
  "waistEntriesForDisplay: waistEntriesForDisplay, waistUnitLabel: waistUnitLabel, " +
  "renderWaistSection: renderWaistSection, isPendingWaistPhoto: isPendingWaistPhoto, " +
  "progressPhotoPathsInEntries: progressPhotoPathsInEntries, rewriteProgressPhotoPath: rewriteProgressPhotoPath, " +
  "renderWeightChart: renderWeightChart, renderManualEntryScreen: renderManualEntryScreen, " +
  "flattenRecipesForSync: flattenRecipesForSync, " +
  "PERSISTED_COLLECTIONS: PERSISTED_COLLECTIONS, NON_BACKED_UP_KEYS: NON_BACKED_UP_KEYS, " +
  "changeActions: changeActions, " +
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

// ==== editing the time of day an entry was eaten ====
// The dashboard groups the log by hour off entry.timestamp, so re-timing an entry is also the
// mechanism for moving it into an hour that has nothing logged in it yet.
function isoLocal(y, mo, d, h, mi) { return new Date(y, mo - 1, d, h, mi, 0, 0).toISOString(); }
test("entryTimestampForTime: combines the entry's log date with the chosen wall-clock time", function () {
  const stamp = M.entryTimestampForTime("2026-07-21", "07:30");
  assertEqual(stamp, isoLocal(2026, 7, 21, 7, 30), "local 07:30 on that date");
  const d = new Date(stamp);
  assertEqual(d.getHours(), 7, "reads back as 7 in local time");
  assertEqual(d.getMinutes(), 30, "and 30 minutes");
  assertEqual(d.getSeconds(), 0, "seconds zeroed so hand-set times sort predictably");
});
// Built via the local-time Date constructor, never by splicing into the UTC ISO string -- that
// would shift the entry by the timezone offset and land it in the wrong hour (or wrong day).
test("entryTimestampForTime: keeps the entry on its own calendar date at the extremes", function () {
  const midnight = new Date(M.entryTimestampForTime("2026-07-21", "00:00"));
  assertEqual(M.fmtDate(midnight), "2026-07-21", "00:00 stays on the same local day");
  assertEqual(midnight.getHours(), 0, "and reads as hour 0");
  const late = new Date(M.entryTimestampForTime("2026-07-21", "23:59"));
  assertEqual(M.fmtDate(late), "2026-07-21", "23:59 does not roll into the next day");
  assertEqual(late.getHours(), 23, "and reads as hour 23");
});
test("entryTimestampForTime: rejects junk rather than writing a bad stamp", function () {
  assertEqual(M.entryTimestampForTime("2026-07-21", "25:00"), null, "hour out of range");
  assertEqual(M.entryTimestampForTime("2026-07-21", "12:75"), null, "minute out of range");
  assertEqual(M.entryTimestampForTime("2026-07-21", "lunch"), null, "not a time at all");
  assertEqual(M.entryTimestampForTime("2026-07-21", ""), null, "blank");
  assertEqual(M.entryTimestampForTime("2026-07-21", null), null, "null");
});
test("entryTimeInputValue: renders 24-hour HH:MM for the native time picker", function () {
  assertEqual(M.entryTimeInputValue({ timestamp: isoLocal(2026, 7, 21, 7, 5) }), "07:05", "zero-padded");
  assertEqual(M.entryTimeInputValue({ timestamp: isoLocal(2026, 7, 21, 18, 30) }), "18:30", "afternoon stays 24-hour");
  assertEqual(M.entryTimeInputValue({ timestamp: "not-a-date" }), "", "unparseable stamp yields an empty field, not NaN:NaN");
});
test("saveEntryTime: re-times the entry in place and bumps updatedAt for conflict resolution", function () {
  M.state.date = "2026-07-21";
  M.state.foodLogs = { "2026-07-21": [{ id: "e1", foodId: "f1", name: "Toast", weight: 60, macros: { calories: 160, protein: 5, carbs: 30, fat: 2, fiber: 2 }, timestamp: isoLocal(2026, 7, 21, 19, 0), updatedAt: "2026-07-21T19:00:00.000Z" }] };
  M.state.ui = { editingEntryId: "e1", entryTimeInput: "07:30" };
  M.actions.saveEntryTime();
  const saved = M.state.foodLogs["2026-07-21"][0];
  assertEqual(new Date(saved.timestamp).getHours(), 7, "moved to 7am");
  assertEqual(M.fmtDate(new Date(saved.timestamp)), "2026-07-21", "still on the same day -- re-timing is not a move");
  assertEqual(saved.updatedAt !== "2026-07-21T19:00:00.000Z", true, "updatedAt bumped, or the merge would bounce the change back");
  assertEqual(M.state.ui.editingEntryId, null, "editor closes on save");
});
test("saveEntryTime: refuses an unparseable time instead of corrupting the stamp", function () {
  M.state.date = "2026-07-21";
  const original = isoLocal(2026, 7, 21, 19, 0);
  M.state.foodLogs = { "2026-07-21": [{ id: "e1", name: "Toast", weight: 60, macros: { calories: 160, protein: 5, carbs: 30, fat: 2, fiber: 2 }, timestamp: original }] };
  M.state.ui = { editingEntryId: "e1", entryTimeInput: "nope" };
  M.actions.saveEntryTime();
  assertEqual(M.state.foodLogs["2026-07-21"][0].timestamp, original, "timestamp untouched");
  assertEqual(M.state.ui.editingEntryId, "e1", "editor stays open so the mistake is visible");
});
// The second half of the request: moving food into a time of day with nothing logged in it.
test("re-timing lands an entry in an hour group that did not exist before", function () {
  M.state.date = "2026-07-21";
  M.state.foodLogs = { "2026-07-21": [
    { id: "e1", name: "Dinner", weight: 300, macros: { calories: 700 }, timestamp: isoLocal(2026, 7, 21, 19, 0) },
    { id: "e2", name: "Toast", weight: 60, macros: { calories: 160 }, timestamp: isoLocal(2026, 7, 21, 19, 30) },
  ] };
  const before = M.groupEntriesByHourNewestFirst(M.state.foodLogs["2026-07-21"]).map(function(g){ return g.hour; });
  assertEqual(before, [19], "everything sits in one hour to start with");
  M.state.ui = { editingEntryId: "e2", entryTimeInput: "07:30" };
  M.actions.saveEntryTime();
  const after = M.groupEntriesByHourNewestFirst(M.state.foodLogs["2026-07-21"]);
  assertEqual(after.map(function(g){ return g.hour; }), [19, 7], "a 7am group appeared on its own, newest hour first");
  assertEqual(after[1].label, "7 AM", "labelled from the timestamp, not from a fixed list of hours");
  assertEqual(after[1].items.length, 1, "and holds the re-timed entry");
  assertEqual(after[1].items[0].name, "Toast", "the right one");
});
test("renderEntryEditor: the Time tab is offered and Move Day still reachable beside it", function () {
  M.state.date = "2026-07-21";
  M.state.foodCache = {};
  const entry = { id: "e1", foodId: "f1", name: "Toast", weight: 60, macros: { calories: 160, protein: 5, carbs: 30, fat: 2, fiber: 2 }, timestamp: isoLocal(2026, 7, 21, 7, 30) };
  M.state.foodLogs = { "2026-07-21": [entry] };
  M.state.ui = { editingEntryId: "e1", entrySection: "time" };
  const html = M.renderEntryEditor(entry);
  assertEqual(html.indexOf('data-arg="time"') >= 0, true, "Time tab button rendered");
  assertEqual(html.indexOf('data-arg="move"') >= 0, true, "Move Day tab still present");
  assertEqual(html.indexOf('data-action="saveEntryTime"') >= 0, true, "save action wired");
  assertEqual(html.indexOf('type="time"') >= 0, true, "a real time field, so any time is reachable");
  assertEqual(html.indexOf('data-action="setEntryTimePreset"') >= 0, true, "meal presets offered");
  // The Move Day tab must still render its own body -- an early branch that swallowed it would
  // leave the tab visible but dead.
  M.state.ui.entrySection = "move";
  const moveHtml = M.renderEntryEditor(entry);
  assertEqual(moveHtml.indexOf('data-action="moveEntryCustomDate"') >= 0, true, "Move Day body intact");
  assertEqual(moveHtml.indexOf('data-action="saveEntryTime"') >= 0, false, "and is not the Time body");
});

// ==== the plant/animal call sticks to the FOOD, not just one entry ====
// It used to be per-entry only: re-adding the same food from History re-guessed from the name,
// so a correction had to be redone on every single serving, forever.
function resetProteinOverrideFixtures() {
  M.state.date = "2026-07-21";
  M.state.foodLogs = {};
  M.state.recentFoods = [];
  M.state.favorites = [];
  M.state.foodCache = {};
}
test("isAnimalProteinEntry: an entry's own call still outranks the food record's", function () {
  resetProteinOverrideFixtures();
  M.state.foodCache = { p1: { id: "p1", name: "Protein Shake", animalOverride: true } };
  assertEqual(M.isAnimalProteinEntry({ foodId: "p1", name: "Protein Shake", animalOverride: false }), false, "this-serving override wins");
});
test("isAnimalProteinEntry: falls back to the food record before guessing from the name", function () {
  resetProteinOverrideFixtures();
  M.state.foodCache = { p1: { id: "p1", name: "Protein Shake", animalOverride: false } };
  assertEqual(M.isAnimalProteinEntry({ foodId: "p1", name: "Protein Shake", animalOverride: null }), false, "record's saved call used");
  M.state.foodCache = {};
  M.state.recentFoods = [{ id: "p1", name: "Protein Shake", animalOverride: false }];
  assertEqual(M.isAnimalProteinEntry({ foodId: "p1", name: "Protein Shake", animalOverride: null }), false, "recentFoods is the fallback when foodCache has no copy");
});
test("isAnimalProteinEntry: still guesses from the name when nothing has been saved", function () {
  resetProteinOverrideFixtures();
  assertEqual(M.isAnimalProteinEntry({ foodId: "x", name: "Grilled Chicken", animalOverride: null }), true, "keyword guess unchanged");
  assertEqual(M.isAnimalProteinEntry({ foodId: "x", name: "Black Beans", animalOverride: null }), false, "and for plants");
});
test("animalOverrideForFood: a saved false is preserved, not collapsed into 'nothing saved'", function () {
  resetProteinOverrideFixtures();
  M.state.foodCache = { p1: { id: "p1", animalOverride: false } };
  assertEqual(M.animalOverrideForFood("p1"), false, "an explicit 'this is plant protein' survives");
  M.state.foodCache = { p2: { id: "p2" } };
  assertEqual(M.animalOverrideForFood("p2"), null, "an unset record reads as nothing saved");
  assertEqual(M.animalOverrideForFood(null), null, "no foodId is safe");
});
test("saveEntryDetails: the protein-source call is written back onto the food record", function () {
  resetProteinOverrideFixtures();
  M.state.recentFoods = [{ id: "p1", name: "Protein Shake", animalOverride: null }];
  M.state.favorites = [{ id: "p1", name: "Protein Shake", animalOverride: null }];
  M.state.foodCache = { p1: { id: "p1", name: "Protein Shake", animalOverride: null } };
  M.state.foodLogs = { "2026-07-21": [{ id: "e1", foodId: "p1", name: "Protein Shake", brand: "", weight: 300, macros: { calories: 160, protein: 30, carbs: 5, fat: 2, fiber: 0 }, animalOverride: null }] };
  M.state.ui = { editingEntryId: "e1", entryAnimalOverrideInput: false };
  M.actions.saveEntryDetails();
  assertEqual(M.state.foodLogs["2026-07-21"][0].animalOverride, false, "saved on the entry");
  assertEqual(M.state.recentFoods[0].animalOverride, false, "and propagated to History's record");
  assertEqual(M.state.favorites[0].animalOverride, false, "and to Favorites");
  assertEqual(M.state.foodCache.p1.animalOverride, false, "and to the food cache");
});
test("saveEntryDetails: name and brand stay per-entry, only the protein source propagates", function () {
  resetProteinOverrideFixtures();
  M.state.recentFoods = [{ id: "p1", name: "Protein Shake", brand: "", animalOverride: null }];
  M.state.foodCache = { p1: { id: "p1", name: "Protein Shake", brand: "", animalOverride: null } };
  M.state.foodLogs = { "2026-07-21": [{ id: "e1", foodId: "p1", name: "Protein Shake", brand: "", weight: 300, macros: { calories: 160, protein: 30, carbs: 5, fat: 2, fiber: 0 }, animalOverride: null }] };
  M.state.ui = { editingEntryId: "e1", entryNameInput: "Shake (leftovers)", entryBrandInput: "Homemade", entryAnimalOverrideInput: false };
  M.actions.saveEntryDetails();
  assertEqual(M.state.foodLogs["2026-07-21"][0].name, "Shake (leftovers)", "entry renamed");
  assertEqual(M.state.recentFoods[0].name, "Protein Shake", "the food record keeps its own name");
  assertEqual(M.state.recentFoods[0].brand, "", "and its own brand");
  assertEqual(M.state.recentFoods[0].animalOverride, false, "but takes the protein-source call");
});
test("saveEntryDetails: choosing Auto clears the saved call instead of leaving it stuck", function () {
  resetProteinOverrideFixtures();
  M.state.recentFoods = [{ id: "p1", name: "Protein Shake", animalOverride: false }];
  M.state.foodCache = { p1: { id: "p1", name: "Protein Shake", animalOverride: false } };
  M.state.foodLogs = { "2026-07-21": [{ id: "e1", foodId: "p1", name: "Protein Shake", brand: "", weight: 300, macros: { calories: 160, protein: 30, carbs: 5, fat: 2, fiber: 0 }, animalOverride: false }] };
  M.state.ui = { editingEntryId: "e1", entryAnimalOverrideInput: null };
  M.actions.saveEntryDetails();
  assertEqual(M.state.recentFoods[0].animalOverride, null, "record returned to keyword guessing");
  assertEqual(M.animalOverrideForFood("p1"), null, "nothing saved any more");
});
// The point of the whole thing: entries logged BEFORE the correction have animalOverride:null,
// and must pick up the saved call with no data migration -- the same way the keyword guess has
// always applied retroactively.
test("getDayTotals: correcting one serving fixes the plant-protein rollup for every past one", function () {
  resetProteinOverrideFixtures();
  M.state.settings.showPlantProtein = true;
  M.state.foodCache = { p1: { id: "p1", name: "Morning Smoothie", animalOverride: null } };
  M.state.foodLogs = { "2026-07-21": [
    { id: "e1", foodId: "p1", name: "Morning Smoothie", weight: 300, macros: { calories: 160, protein: 30, carbs: 5, fat: 2, fiber: 0 }, animalOverride: null },
    { id: "e2", foodId: "p1", name: "Morning Smoothie", weight: 300, macros: { calories: 160, protein: 30, carbs: 5, fat: 2, fiber: 0 }, animalOverride: null },
  ] };
  assertEqual(M.getDayTotals("2026-07-21").plantProtein, 60, "both read as plant while the name doesn't match a keyword");
  M.state.foodCache.p1.animalOverride = true;
  assertEqual(M.getDayTotals("2026-07-21").plantProtein, 0, "one saved call reclassifies both servings at once");
});
test("addFoodToLog: a future log of a corrected food inherits the call", function () {
  resetProteinOverrideFixtures();
  M.addFoodToLog({ id: "p1", name: "Protein Shake", source: "Manual Entry", loggedWeight: 300, calories: 160, protein: 30, carbs: 5, fat: 2, fiber: 0, animalOverride: false });
  assertEqual(M.state.foodLogs["2026-07-21"][0].animalOverride, false, "carried onto the new entry from the food record");
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

// ==== weightRangeStats / weightStatsRangeLabel (Avg Daily/Weekly Change following the chart's selected range) ====
test("weightRangeStats: computes avg/day and per-week from the first and last point in the window", function () {
  const stats = M.weightRangeStats([
    { date: "2026-07-01", weight: 180 }, { date: "2026-07-08", weight: 179 },
  ]);
  assertEqual(stats.avgDaily, -0.14, "1 lb lost over 7 days = -1/7 rounded to 2 decimals");
  assertEqual(stats.weeklyChange, -1, "1 lb lost over exactly 7 days = -1/week");
});
test("weightRangeStats: uses only the first and last point, ignoring points in between", function () {
  const stats = M.weightRangeStats([
    { date: "2026-07-01", weight: 180 }, { date: "2026-07-04", weight: 400 } /* noise */, { date: "2026-07-08", weight: 179 },
  ]);
  assertEqual(stats.weeklyChange, -1, "middle point does not affect the net change calculation");
});
test("weightRangeStats: null with fewer than 2 points (not enough data in the range)", function () {
  assertEqual(M.weightRangeStats([{ date: "2026-07-01", weight: 180 }]), null, "a single point can't show a trend");
  assertEqual(M.weightRangeStats([]), null, "empty range");
  assertEqual(M.weightRangeStats(null), null, "null input treated as empty, not a crash");
});
test("weightStatsRangeLabel: maps each chip value to a readable caption", function () {
  assertEqual(M.weightStatsRangeLabel("7d"), "last 7 days");
  assertEqual(M.weightStatsRangeLabel("30d"), "last 30 days");
  assertEqual(M.weightStatsRangeLabel("90d"), "last 90 days");
  assertEqual(M.weightStatsRangeLabel("6m"), "last 6 months");
  assertEqual(M.weightStatsRangeLabel("all"), "all time");
});

// ==== weightChartCutoff (fixed 2026-07: the "7d seems to start from Monday" bug) ====
// The old implementation compared Date.now() (a moving clock-time) against each entry's
// local-midnight timestamp, so the cutoff fell partway through a calendar day rather than at a
// clean boundary -- these tests are pure date-string-in, timestamp-out, so they pin the exact
// boundary regardless of what time of day it is when the suite runs (unlike the old code,
// nothing here reads the real clock).
test("weightChartCutoff: \"7d\" is a real 7-calendar-day window, inclusive of the reference day", function () {
  const cutoff = M.weightChartCutoff("7d", "2026-07-23"); // a Thursday
  assertEqual(M.fmtDate(new Date(cutoff)), "2026-07-17", "cutoff lands exactly 6 days back (7 days total, inclusive)");
});
test("weightChartCutoff: a weigh-in exactly on the cutoff day is included, one day earlier is not", function () {
  const cutoff = M.weightChartCutoff("7d", "2026-07-23");
  const onBoundary = new Date(2026, 6, 17).getTime(); // local midnight, same convention as parseDateStr
  const dayBefore = new Date(2026, 6, 16).getTime();
  assertEqual(onBoundary >= cutoff, true, "the 7th day back is included");
  assertEqual(dayBefore >= cutoff, false, "the 8th day back is excluded");
});
test("weightChartCutoff: reproduces the reported bug scenario -- \"last 7 days\" measured from a Sunday must still include the Sunday one week back, not start on the following Monday", function () {
  // 2026-07-19 is a Sunday. The bug specifically manifested when "today" was a Sunday, because
  // Date.now() (some time later that Sunday) always sorts after that same Sunday's own
  // midnight timestamp one week back, silently excluding it.
  const cutoff = M.weightChartCutoff("7d", "2026-07-19");
  assertEqual(M.fmtDate(new Date(cutoff)), "2026-07-13", "cutoff is the Sunday one week back, not the Monday after it");
});
test("weightChartCutoff: 30d/90d/6m use the same inclusive-of-today convention", function () {
  assertEqual(M.fmtDate(new Date(M.weightChartCutoff("30d", "2026-07-23"))), "2026-06-24", "30 calendar days inclusive");
  assertEqual(M.fmtDate(new Date(M.weightChartCutoff("90d", "2026-07-23"))), "2026-04-25", "90 calendar days inclusive");
  assertEqual(M.fmtDate(new Date(M.weightChartCutoff("6m", "2026-07-23"))), "2026-01-25", "~6 months (180 days) inclusive");
});
test("weightChartCutoff: \"all\" (and anything unrecognized) admits everything", function () {
  assertEqual(M.weightChartCutoff("all", "2026-07-23"), 0, "no lower bound for All");
  assertEqual(M.weightChartCutoff("bogus", "2026-07-23"), 0, "unrecognized value falls back to no bound rather than throwing");
});

// ==== weight range chip -> stats mode wiring ====
test("actions.setWeightRange: arms statsFollowsRange so Avg Daily/Weekly Change switch to that window", function () {
  M.state.ui = { weight: { timeRange: "30d", statsFollowsRange: false } };
  M.actions.setWeightRange("7d");
  assertEqual(M.state.ui.weight.timeRange, "7d", "chart range updated");
  assertEqual(M.state.ui.weight.statsFollowsRange, true, "stats now follow the selected range");
});
test("actions.resetWeightStatsRange: reverts stats to the starting-point calculation without touching the chart's range", function () {
  M.state.ui = { weight: { timeRange: "90d", statsFollowsRange: true } };
  M.actions.resetWeightStatsRange();
  assertEqual(M.state.ui.weight.statsFollowsRange, false, "stats reverted to starting-point mode");
  assertEqual(M.state.ui.weight.timeRange, "90d", "chart keeps showing whatever range was selected");
});

// ==== updateFoodRecordEverywhere / History item editing ====
test("updateFoodRecordEverywhere: updates a food present in recentFoods only", function () {
  M.state.recentFoods = [{ id: "f1", name: "Oatmeal", calories: 150, protein: 5, carbs: 27, fat: 3 }];
  M.state.favorites = [];
  M.state.foodCache = {};
  const ok = M.updateFoodRecordEverywhere("f1", { name: "Steel-Cut Oatmeal" });
  assertEqual(ok, true, "update applied");
  assertEqual(M.state.recentFoods[0].name, "Steel-Cut Oatmeal", "recentFoods entry corrected");
});
test("updateFoodRecordEverywhere: propagates to favorites and foodCache when the same id is present there too", function () {
  M.state.recentFoods = [{ id: "f2", name: "Hot Dog", calories: 235, protein: 10, carbs: 5, fat: 20 }];
  M.state.favorites = [{ id: "f2", name: "Hot Dog", calories: 235, protein: 10, carbs: 5, fat: 20 }];
  M.state.foodCache = { f2: { id: "f2", name: "Hot Dog", calories: 235, protein: 10, carbs: 5, fat: 20 } };
  M.updateFoodRecordEverywhere("f2", { brand: "Schneiders" });
  assertEqual(M.state.favorites[0].brand, "Schneiders", "favorites copy also corrected");
  assertEqual(M.state.foodCache.f2.brand, "Schneiders", "foodCache copy also corrected");
});
test("updateFoodRecordEverywhere: leaves favorites/foodCache untouched when the food isn't present there", function () {
  M.state.recentFoods = [{ id: "f3", name: "Rice", calories: 130, protein: 3, carbs: 28, fat: 0 }];
  M.state.favorites = [{ id: "other", name: "Something Else" }];
  M.state.foodCache = {};
  M.updateFoodRecordEverywhere("f3", { name: "Brown Rice" });
  assertEqual(M.state.favorites[0].name, "Something Else", "unrelated favorite untouched");
});
test("updateFoodRecordEverywhere: returns false and changes nothing for an unknown food id", function () {
  M.state.recentFoods = [{ id: "f4", name: "Toast" }];
  const ok = M.updateFoodRecordEverywhere("does_not_exist", { name: "x" });
  assertEqual(ok, false, "no match in recentFoods");
  assertEqual(M.state.recentFoods[0].name, "Toast", "unrelated entry untouched");
});
test("actions.saveFoodRecordMacros: rescales loggedMacros to the corrected base at the same logged weight", function () {
  // A 100g-base food incorrectly saved as 235 kcal (should be based on macros); loggedWeight
  // 83g means loggedMacros should reflect 83g of the CORRECTED macros, not the stale ones.
  M.state.recentFoods = [{
    id: "f5", name: "Loonie Dog", calories: 235, protein: 8, carbs: 20, fat: 12, fiber: 0,
    per100g: false, servingSizes: [{ label: "100g", grams: 100 }],
    loggedWeight: 83, loggedMacros: { calories: 195, protein: 6.6, carbs: 16.6, fat: 10, fiber: 0 },
  }];
  M.state.favorites = []; M.state.foodCache = {};
  const originalGetElementById = documentStub.getElementById;
  documentStub.getElementById = function(id) {
    // editMacroCaloriesInput simulates the live auto-calc having already run (10*4+5*4+20*9=240)
    // and the user leaving it as-is -- the override case is covered by a separate test below.
    const map = { editMacro_protein: "10", editMacro_carbs: "5", editMacro_fat: "20", editMacro_fiber: "0", editMacroCaloriesInput: "240" };
    return { value: map[id] };
  };
  try {
    M.actions.saveFoodRecordMacros("f5");
  } finally {
    documentStub.getElementById = originalGetElementById; // restore -- this stub is a shared singleton across the whole test run
  }
  const food = M.state.recentFoods[0];
  assertEqual(food.protein, 10, "base protein corrected");
  assertEqual(food.calories, 240, "base calories recalculated via Atwater (10*4 + 5*4 + 20*9 = 240)");
  assertEqual(food.loggedMacros.calories, 199, "loggedMacros rescaled to 83g of the corrected 100g base (240 * 83/100 = 199.2 -> 199)");
  assertEqual(food.loggedMacros.protein, 8.3, "loggedMacros protein rescaled the same way (10 * 0.83 = 8.3)");
});
test("actions.saveFoodRecordMacros: an overridden calories value wins over the P/C/F Atwater calculation (the alcohol case)", function () {
  // A shot of vodka: ~0g protein/carbs/fat but real calories from the alcohol itself, which
  // Atwater math over P/C/F can't see at all. Saving must keep the calories the user actually
  // entered, not silently discard it back down to 240 = the P/C/F-only value.
  M.state.recentFoods = [{ id: "f6", name: "Vodka Shot", calories: 97, protein: 0, carbs: 0, fat: 0, fiber: 0, per100g: false, servingSizes: [{ label: "44g", grams: 44 }] }];
  M.state.favorites = []; M.state.foodCache = {};
  const originalGetElementById = documentStub.getElementById;
  documentStub.getElementById = function(id) {
    const map = { editMacro_protein: "0", editMacro_carbs: "0", editMacro_fat: "0", editMacro_fiber: "0", editMacroCaloriesInput: "97" };
    return { value: map[id] };
  };
  try {
    M.actions.saveFoodRecordMacros("f6");
  } finally {
    documentStub.getElementById = originalGetElementById;
  }
  assertEqual(M.state.recentFoods[0].calories, 97, "the entered 97 kcal survives, not the Atwater 0*4+0*4+0*9=0 that P/C/F alone implies");
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

// ==== filterFoodsByQuery (History/Favorites live search) ====
test("filterFoodsByQuery: substring match is case-insensitive", function () {
  const list = [{ name: "Ice Cream" }, { name: "Ice Water" }, { name: "Bread" }];
  assertEqual(M.filterFoodsByQuery(list, "ice").length, 2, "matches both ice- foods");
  assertEqual(M.filterFoodsByQuery(list, "ICE-CREAM".slice(0,3)).length, 2, "case-insensitive");
});
test("filterFoodsByQuery: blank query returns the full list unfiltered", function () {
  const list = [{ name: "Ice Cream" }, { name: "Bread" }];
  assertEqual(M.filterFoodsByQuery(list, "").length, 2, "empty query is a no-op filter");
  assertEqual(M.filterFoodsByQuery(list, "   ").length, 2, "whitespace-only query is a no-op filter");
});
test("filterFoodsByQuery: no match returns an empty array", function () {
  const list = [{ name: "Ice Cream" }];
  assertEqual(M.filterFoodsByQuery(list, "zzz").length, 0, "no substring match");
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

// ==== recipe ingredient picker search (must behave exactly like the Food tab's search) ====
// The picker used to search USDA/Open Food Facts only, on an explicit tap/Enter: a food Colin
// had entered by hand or eaten before was simply unreachable while building a recipe, even
// though the same food was one tap away on the Food tab. These pin the parity.
function openIngredientPickerForTest() {
  M.state.tab = "food";
  M.state.ui = {};
  const fu = M.foodUi();
  fu.recipeBuilder = { editingId: null, name: "", ingredients: [], picker: null };
  M.actions.openIngredientPicker();
  return M.foodUi().recipeBuilder;
}
// Queries stay under 3 characters on purpose: the local group fires from the 1st character,
// while the remote databases are only hit at 3+, so these never schedule a network call.
test("ingredientQuery: previously-eaten and manually-added foods appear from the first character", function () {
  M.state.recentFoods = [{ id: "man1", name: "Loonie Dog", source: "Manual Entry", per100g: false, loggedWeight: 83, calories: 235, protein: 8, carbs: 20, fat: 14 }];
  M.state.favorites = [];
  M.state.foodCache = {};
  const rb = openIngredientPickerForTest();
  M.inputActions.ingredientQuery("l");
  assertEqual(rb.picker.historyResults.length, 1, "local match from a single character");
  assertEqual(rb.picker.historyResults[0].name, "Loonie Dog", "the hand-entered food is reachable while building a recipe");
  assertEqual(rb.picker.results.length, 0, "database group stays empty until the debounced search returns");
});
test("ingredientQuery: also matches by brand, same rule as the Food tab", function () {
  M.state.recentFoods = [{ id: "man2", name: "Loonie Dog", brand: "Schneiders", source: "Manual Entry", calories: 235, protein: 8, carbs: 20, fat: 14 }];
  M.state.favorites = [];
  M.state.foodCache = {};
  const rb = openIngredientPickerForTest();
  M.inputActions.ingredientQuery("sc");
  assertEqual(rb.picker.historyResults.length, 1, "brand match, not just name");
});
test("ingredientQuery: clearing the box clears the local group", function () {
  M.state.recentFoods = [{ id: "man3", name: "Chili", source: "Manual Entry", calories: 100, protein: 8, carbs: 5, fat: 4 }];
  M.state.favorites = [];
  M.state.foodCache = {};
  const rb = openIngredientPickerForTest();
  M.inputActions.ingredientQuery("ch");
  assertEqual(rb.picker.historyResults.length, 1, "matched first");
  M.inputActions.ingredientQuery("");
  assertEqual(rb.picker.historyResults.length, 0, "empty query shows nothing");
});
// The "Eaten before" rows can originate from favorites or the food cache, not just
// recentFoods, so selectIngredientFood has to search historyResults itself -- inferring the
// source list from srcTab alone would drop a cache-only hit on the floor (tapped, nothing
// happens), which is exactly the bug selectFoodForAdd was already fixed for.
test("selectIngredientFood: resolves a food that only exists in the local history group", function () {
  M.state.recentFoods = [];
  M.state.favorites = [];
  M.state.foodCache = { c9: { id: "c9", name: "Quinoa", source: "USDA", per100g: true, calories: 120, protein: 4, carbs: 21, fat: 2 } };
  const rb = openIngredientPickerForTest();
  M.inputActions.ingredientQuery("qu");
  M.actions.selectIngredientFood("c9", "history");
  assertEqual(!!rb.picker.selecting, true, "the tapped row actually opened the portion screen");
  assertEqual(rb.picker.selecting.name, "Quinoa", "resolved the cached food");
  assertEqual(rb.picker.servingBasis, null, "serving basis reset for the newly picked food");
  assertEqual(rb.picker.qty, "1", "quantity reset alongside it");
});
test("selectIngredientFood: a database hit still resolves from the results list", function () {
  M.state.recentFoods = [];
  M.state.favorites = [];
  M.state.foodCache = {};
  const rb = openIngredientPickerForTest();
  rb.picker.results = [{ id: "usda_1", name: "Brown Rice", source: "USDA", per100g: true, calories: 112, protein: 2.6, carbs: 24, fat: 0.9 }];
  M.actions.selectIngredientFood("usda_1");
  assertEqual(rb.picker.selecting.name, "Brown Rice", "database group unaffected by the new history lookup");
});
// ==== browsing History from the ingredient picker ====
// Search only reaches a food you can remember the name of. History is the durable 500-entry
// "everything ever added" list, and scrolling it is how you find the one you can't name --
// it was reachable from the Food tab but not while building a recipe.
test("ingredient picker: History is a browse mode with its own filter, separate from the Food tab's", function () {
  M.state.recentFoods = [
    { id: "h1", name: "Loonie Dog", source: "Manual Entry", calories: 235, protein: 8, carbs: 20, fat: 14 },
    { id: "h2", name: "Greek Yogurt", source: "USDA", calories: 120, protein: 17, carbs: 7, fat: 1 },
  ];
  const rb = openIngredientPickerForTest();
  assertEqual(rb.picker.historyQuery, "", "picker opens with its own empty history filter");
  M.actions.setPickerMode("history");
  assertEqual(rb.picker.mode, "history", "History is a selectable picker mode");
  const all = M.renderPickerHistoryListBlock(rb.picker);
  assertEqual(all.indexOf("Loonie Dog") >= 0 && all.indexOf("Greek Yogurt") >= 0, true, "unfiltered list shows the whole history");
  M.inputActions.pickerHistoryQuery("yog");
  assertEqual(rb.picker.historyQuery, "yog", "filter stored on the picker");
  assertEqual(M.foodUi().historyQuery, "", "the Food tab's own History filter is untouched");
  const filtered = M.renderPickerHistoryListBlock(rb.picker);
  assertEqual(filtered.indexOf("Greek Yogurt") >= 0, true, "match kept");
  assertEqual(filtered.indexOf("Loonie Dog") >= 0, false, "non-match filtered out");
});
test("renderPickerHistoryListBlock: rows add to the recipe, they do not log the food", function () {
  M.state.recentFoods = [{ id: "h1", name: "Loonie Dog", source: "Manual Entry", calories: 235, protein: 8, carbs: 20, fat: 14 }];
  const rb = openIngredientPickerForTest();
  const html = M.renderPickerHistoryListBlock(rb.picker);
  assertEqual(html.indexOf('data-action="selectIngredientFood"') >= 0, true, "rows target the picker");
  assertEqual(html.indexOf('data-action="selectFoodForAdd"') >= 0, false, "no leakage of the Food tab's log action");
  assertEqual(html.indexOf('data-arg2="history"') >= 0, true, "srcTab lets selectIngredientFood resolve from recentFoods");
});
test("renderPickerHistoryListBlock: empty and no-match states", function () {
  M.state.recentFoods = [];
  const rb = openIngredientPickerForTest();
  assertEqual(M.renderPickerHistoryListBlock(rb.picker).indexOf("No food history yet") >= 0, true, "empty history explains itself");
  M.state.recentFoods = [{ id: "h1", name: "Loonie Dog", calories: 235, protein: 8, carbs: 20, fat: 14 }];
  rb.picker.historyQuery = "zzz";
  assertEqual(M.renderPickerHistoryListBlock(rb.picker).indexOf("No matches") >= 0, true, "filtered-to-nothing explains itself");
});
// Browsing means no query was ever typed, so historyResults is empty -- the food has to be
// resolved from state.recentFoods via srcTab, the path a tap from the browse list relies on.
test("selectIngredientFood: resolves a browsed History row with no search having been run", function () {
  M.state.recentFoods = [{ id: "h7", name: "Leftover Rice", source: "Manual Entry", per100g: false, loggedWeight: 150, calories: 200, protein: 4, carbs: 44, fat: 0 }];
  M.state.favorites = [];
  M.state.foodCache = {};
  const rb = openIngredientPickerForTest();
  M.actions.setPickerMode("history");
  assertEqual(rb.picker.historyResults.length, 0, "nothing was searched for");
  M.actions.selectIngredientFood("h7", "history");
  assertEqual(!!rb.picker.selecting, true, "the tapped row opened the portion screen");
  assertEqual(rb.picker.selecting.name, "Leftover Rice", "resolved straight out of recentFoods");
  assertEqual(rb.picker.servingBasis, null, "serving basis reset for the newly picked food");
  assertEqual(rb.picker.qty, "1", "quantity reset alongside it");
});
// ==== scanning a barcode straight into a recipe ====
// The camera screen is shared with the Food tab, so the only thing separating "add this to the
// recipe" from "log this to today" is where the successful lookup is delivered.
function openPickerAndScanForTest() {
  const rb = openIngredientPickerForTest();
  M.actions.openIngredientBarcodeScan();
  return rb;
}
test("openIngredientBarcodeScan: raises the camera on top of the builder without destroying it", function () {
  const rb = openPickerAndScanForTest();
  const fu = M.foodUi();
  assertEqual(fu.scanningBarcode, true, "camera screen is up");
  assertEqual(fu.scanTarget, "ingredient", "result is retargeted at the picker");
  assertEqual(fu.recipeBuilder === rb, true, "the half-built recipe survived (openBarcodeScan would have wiped state.ui)");
  assertEqual(!!fu.recipeBuilder.picker, true, "and so did the picker underneath it");
  assertEqual(M.computeNavDepth(), 2, "a lateral swap between depth-2 screens, not a new nav level");
});
test("deliverScannedFood: an ingredient scan lands in the picker's portion screen, not today's log", function () {
  openPickerAndScanForTest();
  const food = { id: "barcode_111", name: "Trail Mix", per100g: false, baseGrams: 40, calories: 200, protein: 5, carbs: 20, fat: 12, servingSizes: [{ label: "40g", grams: 40 }] };
  M.deliverScannedFood(food, "40");
  const fu = M.foodUi();
  assertEqual(fu.recipeBuilder.picker.selecting.name, "Trail Mix", "scanned food opened the ingredient portion screen");
  assertEqual(fu.recipeBuilder.picker.weight, "40", "carried its portion through");
  assertEqual(fu.recipeBuilder.picker.servingBasis, null, "serving basis reset for the scanned food");
  assertEqual(fu.addingFood, null, "nothing was queued for today's log");
  assertEqual(fu.scanningBarcode, false, "camera screen closed");
  assertEqual(fu.scanTarget, null, "target cleared so the next plain scan logs normally");
});
test("deliverScannedFood: a plain Food-tab scan still lands in Adding Food", function () {
  M.state.tab = "food";
  M.state.ui = {};
  const fu = M.foodUi();
  fu.scanningBarcode = true;
  const food = { id: "barcode_222", name: "Oat Bar", per100g: false, baseGrams: 60, calories: 240, protein: 6, carbs: 30, fat: 10 };
  M.deliverScannedFood(food, "60");
  assertEqual(fu.addingFood.name, "Oat Bar", "unchanged default route");
  assertEqual(fu.addWeight, "60", "weight carried through");
});
// A lookup can still be in flight when the user backs out. Falling through to the default
// route would then hijack them into logging the item to today's log -- a thing they never
// asked for -- so a delivery that arrives after the scan screen closed is dropped.
test("deliverScannedFood: a result arriving after the user backed out is dropped, not rerouted", function () {
  openPickerAndScanForTest();
  M.collapseOneNavLevel(); // physical back out of the camera
  const fu = M.foodUi();
  assertEqual(fu.scanningBarcode, false, "back-out closed the scan");
  assertEqual(fu.scanTarget, null, "and cleared the retarget");
  M.deliverScannedFood({ id: "barcode_333", name: "Late Result", calories: 100, protein: 1, carbs: 1, fat: 1 }, "50");
  assertEqual(fu.addingFood, null, "the late result did not open Adding Food");
  assertEqual(fu.recipeBuilder.picker.selecting, null, "and did not silently appear in the picker either");
});
test("deliverScannedFood: an ingredient scan whose picker closed mid-lookup does not fall back to logging", function () {
  const rb = openPickerAndScanForTest();
  rb.picker = null; // picker abandoned while the lookup was in flight
  M.deliverScannedFood({ id: "barcode_444", name: "Orphan", calories: 100, protein: 1, carbs: 1, fat: 1 }, "50");
  assertEqual(M.foodUi().addingFood, null, "no hand-off to today's log");
  assertEqual(M.foodUi().scanningBarcode, false, "scan still closed out cleanly");
});
// A barcode already corrected/remembered resolves with no network, so this exercises the whole
// handleBarcodeDetected path (not just the hand-off) against the ingredient route.
test("handleBarcodeDetected: a remembered barcode scanned from the picker becomes an ingredient", function () {
  const rb = openPickerAndScanForTest();
  M.state.customBarcodes = { "5000159484695": { id: "barcode_5000159484695", name: "Snickers", per100g: false, baseGrams: 48, loggedWeight: 48, calories: 245, protein: 4, carbs: 28, fat: 12, servingSizes: [{ label: "48g", grams: 48 }] } };
  M.handleBarcodeDetected("5000159484695");
  assertEqual(rb.picker.selecting.name, "Snickers", "remembered product opened the ingredient portion screen");
  assertEqual(rb.picker.weight, "48", "remembered portion prefilled");
  assertEqual(M.foodUi().addingFood, null, "not logged to today");
});
test("saveCustomBarcode: a not-found barcode entered by hand from the picker becomes an ingredient", function () {
  const rb = openPickerAndScanForTest();
  M.state.customBarcodes = {};
  const fu = M.foodUi();
  fu.scanNotFoundCode = "999";
  fu.customBarcodeManual = { name: "Bulk Oats", weight: "80", calories: "300", protein: "10", carbs: "54", fat: "5", fiber: "8" };
  M.actions.saveCustomBarcode();
  assertEqual(M.state.customBarcodes["999"].name, "Bulk Oats", "still remembered for future scans");
  assertEqual(rb.picker.selecting.name, "Bulk Oats", "and handed to the ingredient portion screen");
  assertEqual(rb.picker.weight, "80", "with the portion just entered");
  assertEqual(fu.addingFood, null, "not logged to today");
});
test("renderIngredientPickerScreen: search mode offers the barcode scanner", function () {
  M.state.recentFoods = [];
  M.state.favorites = [];
  M.state.recipes = [];
  const rb = openIngredientPickerForTest();
  const html = M.renderIngredientPickerScreen(M.foodUi(), rb);
  assertEqual(html.indexOf('data-action="openIngredientBarcodeScan"') >= 0, true, "Scan Barcode button present in the picker");
  assertEqual(html.indexOf('data-action="openBarcodeScan"') >= 0, false, "not the Food tab's scanner, which would wipe the builder");
  assertEqual(html.indexOf('data-arg="history"') >= 0, true, "History is offered as a picker mode");
});
test("renderIngredientResultsBlock: labels both groups and wires rows to the picker's own action", function () {
  const pk = {
    query: "rice", searching: false,
    historyResults: [{ id: "h1", name: "Leftover Rice", source: "Manual Entry", calories: 130, protein: 3, carbs: 28, fat: 0 }],
    results: [{ id: "usda_2", name: "Brown Rice", source: "USDA", calories: 112, protein: 2.6, carbs: 24, fat: 0.9 }],
  };
  const html = M.renderIngredientResultsBlock(pk);
  assertEqual(html.indexOf("Eaten before") >= 0, true, "local group header rendered");
  assertEqual(html.indexOf("Food databases") >= 0, true, "database group header rendered");
  assertEqual(html.indexOf('data-action="selectIngredientFood"') >= 0, true, "rows target the picker, not the Food tab");
  assertEqual(html.indexOf('data-action="selectFoodForAdd"') >= 0, false, "no leakage of the Food tab's action into the picker");
});
// ==== recipes as search results (reachable without going to the Recipes sub-tab) ====
function recipeFixture(id, name, ingredients) {
  return { id: id, name: name, ingredients: ingredients, createdAt: "2026-07-01T00:00:00.000Z" };
}
const CHILI = recipeFixture("r_chili", "Beef Chili", [
  { id: "i1", name: "Ground Beef", weight: 400, calories: 800, protein: 70, carbs: 0, fat: 56, fiber: 0 },
  { id: "i2", name: "Kidney Beans", weight: 200, calories: 250, protein: 15, carbs: 45, fat: 1, fiber: 12 },
]);
test("recipeMatchesQuery: case-insensitive substring on the recipe name", function () {
  assertEqual(M.recipeMatchesQuery(CHILI, "chil"), true, "substring match");
  assertEqual(M.recipeMatchesQuery(CHILI, "beef"), true, "matches anywhere in the name");
  assertEqual(M.recipeMatchesQuery(CHILI, "zzz"), false, "no match");
  assertEqual(M.recipeMatchesQuery(null, "x"), false, "null recipe does not throw");
  assertEqual(M.recipeMatchesQuery({ id: "r0" }, "x"), false, "a recipe with no name does not throw");
});
test("matchingRecipes: finds saved recipes by name", function () {
  M.state.recipes = [CHILI, recipeFixture("r_oats", "Overnight Oats", [])];
  assertEqual(M.matchingRecipes("oat").length, 1, "one match");
  assertEqual(M.matchingRecipes("oat")[0].name, "Overnight Oats", "the right one");
  assertEqual(M.matchingRecipes("e").length, 2, "both match a common letter");
});
test("filterRecipesByQuery: an empty query returns the whole list (Recipes sub-tab default)", function () {
  const list = [CHILI, recipeFixture("r_oats", "Overnight Oats", [])];
  assertEqual(M.filterRecipesByQuery(list, "").length, 2, "unfiltered");
  assertEqual(M.filterRecipesByQuery(list, "  ").length, 2, "whitespace-only is still unfiltered");
  assertEqual(M.filterRecipesByQuery(list, "chili").length, 1, "filtered");
});
// Logging a recipe leaves a "recipe_food_<id>" snapshot in recentFoods, so without this the
// same name renders in both the recipes group and the "Eaten before" group.
test("historyExcludingRecipes: drops the logged snapshot of a recipe already shown as a recipe", function () {
  const history = [
    { id: "recipe_food_r_chili", name: "Beef Chili", source: "Recipe" },
    { id: "man1", name: "Chili Powder", source: "Manual Entry" },
  ];
  const out = M.historyExcludingRecipes([CHILI], history);
  assertEqual(out.length, 1, "snapshot removed");
  assertEqual(out[0].id, "man1", "unrelated history entry kept");
});
test("historyExcludingRecipes: leaves history alone when no recipes matched", function () {
  const history = [{ id: "recipe_food_r_chili", name: "Beef Chili", source: "Recipe" }];
  assertEqual(M.historyExcludingRecipes([], history).length, 1, "no recipes group means nothing to de-dupe against");
  assertEqual(M.historyExcludingRecipes(null, history).length, 1, "null recipe list treated as empty");
});
test("foodQuery: a saved recipe surfaces from the first character typed into the Food tab search", function () {
  M.state.tab = "food";
  M.state.ui = {};
  M.state.recipes = [CHILI];
  M.state.recentFoods = [{ id: "recipe_food_r_chili", name: "Beef Chili", source: "Recipe", calories: 1050, protein: 85, carbs: 45, fat: 57 }];
  M.state.favorites = [];
  M.state.foodCache = {};
  const fu = M.foodUi();
  M.inputActions.foodQuery("ch");
  assertEqual(fu.recipeResults.length, 1, "recipe found without visiting the Recipes tab");
  assertEqual(fu.recipeResults[0].name, "Beef Chili", "the right recipe");
  assertEqual(fu.historyResults.length, 0, "its stale logged snapshot is not also listed");
});
test("recipeAsFood: anchors macros to the recipe's own full weight, so a part portion scales", function () {
  const food = M.recipeAsFood(CHILI);
  assertEqual(food.baseGrams, 600, "400g beef + 200g beans");
  assertEqual(food.calories, 1050, "summed ingredient calories");
  assertEqual(M.calcMacrosForWeight(food, 600).calories, 1050, "full recipe returns the full total");
  assertEqual(M.calcMacrosForWeight(food, 300).calories, 525, "half the recipe is half the calories");
});
test("recipeAsFood: a recipe with no weighed ingredients falls back to a 100g base, never 0", function () {
  const empty = M.recipeAsFood(recipeFixture("r_empty", "Empty", []));
  assertEqual(empty.baseGrams, 100, "no divide-by-zero base");
});
test("selectIngredientRecipe: nests a saved recipe into the recipe being built", function () {
  M.state.recipes = [CHILI];
  const rb = openIngredientPickerForTest();
  M.actions.selectIngredientRecipe("r_chili");
  assertEqual(rb.picker.selecting.name, "Beef Chili", "opened the portion screen for the recipe");
  assertEqual(rb.picker.selecting.baseGrams, 600, "carried its full-recipe anchor");
  rb.picker.weight = "300";
  M.actions.confirmAddIngredient();
  assertEqual(rb.ingredients.length, 1, "added as a single ingredient row");
  assertEqual(rb.ingredients[0].name, "Beef Chili", "named after the recipe");
  assertEqual(rb.ingredients[0].calories, 525, "scaled to the 300g picked");
});
test("selectIngredientRecipe: a recipe cannot be added to itself", function () {
  M.state.recipes = [CHILI];
  const rb = openIngredientPickerForTest();
  rb.editingId = "r_chili";
  M.actions.selectIngredientRecipe("r_chili");
  assertEqual(rb.picker.selecting, null, "self-nesting refused");
  M.inputActions.ingredientQuery("ch");
  assertEqual(rb.picker.recipeResults.length, 0, "and it is not even offered while being edited");
});
test("renderFoodResultGroups: the recipes group leads and uses the caller's recipe action", function () {
  M.state.recipes = [CHILI];
  const html = M.renderFoodResultGroups({
    recipes: [CHILI],
    history: [{ id: "h3", name: "Chili Powder", source: "Manual Entry", calories: 10, protein: 0, carbs: 2, fat: 0 }],
    dbResults: [], searching: false, query: "chili",
    action: "selectFoodForAdd", recipeAction: "logRecipe", emptyText: "none",
  });
  assertEqual(html.indexOf("Your recipes") >= 0, true, "recipes group header rendered");
  assertEqual(html.indexOf("Your recipes") < html.indexOf("Eaten before"), true, "recipes listed above eaten-before");
  assertEqual(html.indexOf('data-action="logRecipe"') >= 0, true, "recipe rows open the log-recipe screen");
});
test("renderIngredientResultsBlock: recipe rows target the picker's nesting action instead", function () {
  const html = M.renderIngredientResultsBlock({
    query: "chili", searching: false, recipeResults: [CHILI], historyResults: [], results: [],
  });
  assertEqual(html.indexOf('data-action="selectIngredientRecipe"') >= 0, true, "nests rather than logs");
  assertEqual(html.indexOf('data-action="logRecipe"') >= 0, false, "the Food tab's recipe action does not leak in");
});
test("renderFoodResultGroups: the empty-results message only shows when all three groups are empty", function () {
  const withRecipe = M.renderFoodResultGroups({
    recipes: [CHILI], history: [], dbResults: [], searching: false, query: "chili",
    action: "selectFoodForAdd", recipeAction: "logRecipe", emptyText: "No results.",
  });
  assertEqual(withRecipe.indexOf("No results.") >= 0, false, "a recipe-only match is not 'no results'");
  const withNothing = M.renderFoodResultGroups({
    recipes: [], history: [], dbResults: [], searching: false, query: "zzz",
    action: "selectFoodForAdd", recipeAction: "logRecipe", emptyText: "No results.",
  });
  assertEqual(withNothing.indexOf("No results.") >= 0, true, "genuinely empty still says so");
});
test("renderRecipesListBlock: the Recipes sub-tab filter narrows the list", function () {
  M.state.recipes = [CHILI, recipeFixture("r_oats", "Overnight Oats", [])];
  M.state.ui = {};
  const fu = M.foodUi();
  fu.recipesQuery = "oat";
  const html = M.renderRecipesListBlock(fu);
  assertEqual(html.indexOf("Overnight Oats") >= 0, true, "match shown");
  assertEqual(html.indexOf("Beef Chili") >= 0, false, "non-match hidden");
  fu.recipesQuery = "zzz";
  assertEqual(M.renderRecipesListBlock(fu).indexOf("No matches for") >= 0, true, "empty filter state");
  fu.recipesQuery = "";
  assertEqual(M.renderRecipesListBlock(fu).indexOf("Beef Chili") >= 0, true, "cleared filter shows everything again");
});

test("renderFoodResultGroups: the Food tab's own rows keep their default action", function () {
  const html = M.renderFoodResultGroups({
    history: [{ id: "h2", name: "Oats", source: "USDA", calories: 389, protein: 17, carbs: 66, fat: 7 }],
    dbResults: [], searching: false, query: "oats", action: "selectFoodForAdd", emptyText: "none",
  });
  assertEqual(html.indexOf('data-action="selectFoodForAdd"') >= 0, true, "unchanged behaviour for the search screen");
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

// ============================================================
// BASE-PORTION ANCHOR (baseGrams) -- the "macros don't scale to the new weight" bug
// ============================================================

// ==== positiveGramsOr / aiItemGrams ====
test("positiveGramsOr: rejects blank, NaN, zero, negative and Infinity", function () {
  assertEqual(M.positiveGramsOr("", 100), 100, "blank falls back");
  assertEqual(M.positiveGramsOr("abc", 100), 100, "NaN falls back");
  assertEqual(M.positiveGramsOr(0, 100), 100, "zero is not a usable portion");
  assertEqual(M.positiveGramsOr(-50, 100), 100, "negative falls back");
  assertEqual(M.positiveGramsOr("1e999", 100), 100, "Infinity falls back");
  assertEqual(M.positiveGramsOr("83", 100), 83, "a valid numeric string is used");
  assertEqual(M.positiveGramsOr(0.5, 100), 0.5, "a small positive weight is legitimate");
});
test("aiItemGrams: a missing or zero quantity_grams falls back to 100 instead of leaving no anchor", function () {
  assertEqual(M.aiItemGrams({ quantity_grams: 400 }), 400, "uses the estimate");
  assertEqual(M.aiItemGrams({}), 100, "omitted quantity_grams");
  assertEqual(M.aiItemGrams({ quantity_grams: 0 }), 100, "zero quantity_grams");
  assertEqual(M.aiItemGrams(null), 100, "null item");
});

// ==== foodBaseGrams / anchorFoodBase ====
test("foodBaseGrams: an explicit baseGrams wins over servingSizes and loggedWeight", function () {
  const food = { per100g: false, baseGrams: 166, servingSizes: [{ label: "83g", grams: 83 }], loggedWeight: 50 };
  assertEqual(M.foodBaseGrams(food), 166, "explicit anchor beats both inferences");
});
test("foodBaseGrams: null food returns the 100g last resort instead of throwing", function () {
  assertEqual(M.foodBaseGrams(null), 100, "null guard");
});
test("anchorFoodBase: freezes the currently-inferred base into an explicit field", function () {
  const legacy = { per100g: false, calories: 500, loggedWeight: 400 };
  assertEqual(M.anchorFoodBase(legacy).baseGrams, 400, "legacy record upgraded from its inferred base");
  assertEqual(legacy.baseGrams, undefined, "the original object is not mutated");
});
test("anchorFoodBase: overwriting loggedWeight afterwards can no longer move the base", function () {
  const food = Object.assign({}, M.anchorFoodBase({ per100g: false, calories: 500, loggedWeight: 400 }), { loggedWeight: 200 });
  assertEqual(M.foodBaseGrams(food), 400, "base stays at the portion the macros describe");
  assertEqual(M.calcMacrosForWeight(food, 400).calories, 500, "400g still reads 500 kcal, not 1000");
});
// The reported compounding bug: an AI Estimate (no servingSizes) re-added from History at a new
// weight used to re-anchor its unchanged absolute macros to that new weight, doubling the food
// every round trip.
test("confirmAddFood: re-adding an absolute-macro food at a new weight does not re-anchor it", function () {
  M.state.date = "2026-07-20";
  M.state.foodLogs = {}; M.state.recentFoods = []; M.state.favorites = []; M.state.foodCache = {};
  M.state.ui = {}; // let foodUi() build its defaults, same as the real boot path
  M.addFoodToLog({
    id: "ai_1", name: "Chili", source: "AI Estimate", calories: 500, protein: 30, carbs: 40, fat: 22, fiber: 5,
    loggedWeight: 400, baseGrams: 400,
    loggedMacros: { calories: 500, protein: 30, carbs: 40, fat: 22, fiber: 5 },
  });
  // Re-add from History at half the portion.
  M.actions.selectFoodForAdd("ai_1", "history");
  M.state.ui.food.addWeight = "200"; M.state.ui.food._confirmLock = 0;
  M.actions.confirmAddFood();
  const half = M.state.foodLogs["2026-07-20"][1];
  assertEqual(half.macros.calories, 250, "200g of a 400g/500kcal food is 250 kcal");
  // ...and back to the original portion, which must return the original numbers.
  M.actions.selectFoodForAdd("ai_1", "history");
  M.state.ui.food.addWeight = "400"; M.state.ui.food._confirmLock = 0;
  M.actions.confirmAddFood();
  const full = M.state.foodLogs["2026-07-20"][2];
  assertEqual(full.macros.calories, 500, "back at 400g it is 500 kcal again, not 1000");
  assertEqual(M.state.recentFoods[0].baseGrams, 400, "the History record kept its base");
});

// ==== entryMatchesFood / rescaleEntryMacros ====
test("entryMatchesFood: true for an untouched entry, false once its macros are hand-corrected", function () {
  const food = { per100g: false, baseGrams: 100, calories: 200, protein: 10, carbs: 20, fat: 8, fiber: 1 };
  const clean = { weight: 50, macros: { calories: 100, protein: 5, carbs: 10, fat: 4, fiber: 0.5 } };
  const edited = { weight: 50, macros: { calories: 140, protein: 5, carbs: 10, fat: 4, fiber: 0.5 } };
  assertEqual(M.entryMatchesFood(clean, food), true, "untouched entry still matches its source");
  assertEqual(M.entryMatchesFood(edited, food), false, "a corrected entry no longer matches");
  assertEqual(M.entryMatchesFood(clean, null), false, "no source food");
  assertEqual(M.entryMatchesFood({ weight: 0, macros: { calories: 1 } }, food), false, "unusable entry weight");
  // Fiber is one of the four editable fields, so a fiber-only correction must also count as
  // "modified" -- otherwise the next portion change silently reverts it.
  const fiberOnly = { weight: 50, macros: { calories: 100, protein: 5, carbs: 10, fat: 4, fiber: 6 } };
  assertEqual(M.entryMatchesFood(fiberOnly, food), false, "a fiber-only correction is still a correction");
});
test("rescaleEntryMacros: an entry with no macros object degrades instead of throwing", function () {
  M.state.foodCache = {};
  assertEqual(M.rescaleEntryMacros({ foodId: "x", weight: 50 }, 100), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }, "zeros, not a thrown TypeError mid-render");
});
test("rescaleEntryMacros: an untouched entry re-derives from its source food", function () {
  M.state.foodCache = { f1: { id: "f1", per100g: true, calories: 200, protein: 10, carbs: 20, fat: 8, fiber: 2 } };
  const entry = { foodId: "f1", weight: 100, macros: { calories: 200, protein: 10, carbs: 20, fat: 8, fiber: 2 } };
  assertEqual(M.rescaleEntryMacros(entry, 250).calories, 500, "scaled off the food's own base");
});
test("rescaleEntryMacros: a hand-corrected entry scales from its own macros, keeping the correction", function () {
  M.state.foodCache = { f1: { id: "f1", per100g: true, calories: 200, protein: 10, carbs: 20, fat: 8, fiber: 2 } };
  const corrected = { foodId: "f1", weight: 100, macros: { calories: 300, protein: 15, carbs: 30, fat: 12, fiber: 3 } };
  assertEqual(M.rescaleEntryMacros(corrected, 200).calories, 600, "doubles the corrected 300, not the source's 200");
  assertEqual(M.rescaleEntryMacros(corrected, 200).protein, 30, "protein follows the correction too");
});
test("rescaleEntryMacros: no source food and no usable old weight keeps the macros rather than emitting NaN", function () {
  M.state.foodCache = {};
  const broken = { foodId: "gone", weight: 0, macros: { calories: 120, protein: 6, carbs: 12, fat: 4, fiber: 1 } };
  assertEqual(M.rescaleEntryMacros(broken, 200), { calories: 120, protein: 6, carbs: 12, fat: 4, fiber: 1 }, "unchanged, not Infinity/NaN");
});
test("rescaleEntryMacros: no source food but a usable old weight scales proportionally", function () {
  M.state.foodCache = {};
  const orphan = { foodId: "gone", weight: 50, macros: { calories: 120, protein: 6, carbs: 12, fat: 4, fiber: 1 } };
  assertEqual(M.rescaleEntryMacros(orphan, 100), { calories: 240, protein: 12, carbs: 24, fat: 8, fiber: 2 }, "doubled");
});

// ==== propagateCustomFoodEdit ====
// The exact reported symptom: correct a custom food's macros while the entry sits at a weight
// other than the food's original portion, then change the portion -- the macros used to come
// back completely unchanged, because the food record still claimed the ORIGINAL base.
test("propagateCustomFoodEdit: a macro correction re-anchors the food to the entry's weight", function () {
  M.state.date = "2026-07-21";
  M.state.recentFoods = []; M.state.favorites = []; M.state.foodCache = {}; M.state.customBarcodes = {};
  const food = {
    id: "manual_1", name: "Dog", source: "Manual Entry", per100g: false,
    calories: 235, protein: 10, carbs: 20, fat: 13, fiber: 1,
    baseGrams: 83, loggedWeight: 83, servingSizes: [{ label: "83g", grams: 83 }],
    loggedMacros: { calories: 235, protein: 10, carbs: 20, fat: 13, fiber: 1 },
  };
  M.state.recentFoods = [food];
  M.state.foodCache = { manual_1: food };
  const entry = { id: "log_1", foodId: "manual_1", source: "Manual Entry", weight: 166, macros: { calories: 470, protein: 20, carbs: 40, fat: 26, fiber: 2 } };
  const newMacros = { calories: 474, protein: 20, carbs: 40, fat: 26, fiber: 2 };
  M.propagateCustomFoodEdit(entry, newMacros);
  assertEqual(M.state.foodCache.manual_1.baseGrams, 166, "cache re-anchored to the entry's weight");
  assertEqual(M.state.recentFoods[0].calories, 474, "History got the correction too, not just the cache");
  assertEqual(M.state.recentFoods[0].baseGrams, 166, "History re-anchored as well");
  // Halving the portion must now actually halve the macros.
  const corrected = Object.assign({}, entry, { macros: newMacros });
  assertEqual(M.rescaleEntryMacros(corrected, 83).calories, 237, "83g is half of the corrected 474, not 474 again");
});
test("propagateCustomFoodEdit: a custom-barcode correction restates servingSizes, not just baseGrams", function () {
  M.state.recentFoods = []; M.state.favorites = []; M.state.foodCache = {};
  M.state.customBarcodes = { "123": { id: "barcode_123", name: "Bar", per100g: false, calories: 100, protein: 5, carbs: 10, fat: 3, fiber: 0, baseGrams: 40, servingSizes: [{ label: "40g", grams: 40 }] } };
  const entry = { id: "log_2", foodId: "barcode_123", source: "Custom Barcode Entry", weight: 60, macros: { calories: 150, protein: 7.5, carbs: 15, fat: 4.5, fiber: 0 } };
  M.propagateCustomFoodEdit(entry, { calories: 160, protein: 8, carbs: 16, fat: 5, fiber: 0 });
  assertEqual(M.state.customBarcodes["123"].baseGrams, 60, "barcode record re-anchored");
  assertEqual(M.state.customBarcodes["123"].servingSizes, [{ label: "60g", grams: 60 }], "servingSizes restated -- handleBarcodeDetected reads the portion from here");
  assertEqual(M.state.customBarcodes["123"].calories, 160, "corrected macros stored");
});
test("propagateCustomFoodEdit: an unusable entry weight leaves the base alone rather than anchoring to 0g", function () {
  M.state.recentFoods = []; M.state.favorites = []; M.state.customBarcodes = {};
  M.state.foodCache = { manual_2: { id: "manual_2", per100g: false, calories: 100, protein: 5, carbs: 10, fat: 2, fiber: 0, baseGrams: 50 } };
  M.propagateCustomFoodEdit({ id: "l", foodId: "manual_2", source: "Manual Entry", weight: 0, macros: { calories: 100 } }, { calories: 120, protein: 6, carbs: 12, fat: 3, fiber: 0 });
  assertEqual(M.state.foodCache.manual_2.baseGrams, 50, "base untouched");
  assertEqual(M.state.foodCache.manual_2.calories, 120, "macros still corrected");
});

// ==== updateFoodRecordEverywhere ====
test("updateFoodRecordEverywhere: reaches the cache even when the food has aged out of History", function () {
  M.state.recentFoods = []; M.state.favorites = [];
  M.state.foodCache = { x1: { id: "x1", calories: 100 } };
  assertEqual(M.updateFoodRecordEverywhere("x1", { calories: 250 }), true, "reports that something matched");
  assertEqual(M.state.foodCache.x1.calories, 250, "cache updated despite the History miss");
});
test("updateFoodRecordEverywhere: reports false when nothing anywhere matches", function () {
  M.state.recentFoods = []; M.state.favorites = []; M.state.foodCache = {};
  assertEqual(M.updateFoodRecordEverywhere("nope", { calories: 1 }), false, "no store matched");
  assertEqual(M.updateFoodRecordEverywhere(null, { calories: 1 }), false, "null id guard");
});

test("foodBaseGrams: a stringified baseGrams from JSON still returns a number", function () {
  const g = M.foodBaseGrams({ per100g: false, baseGrams: "166" });
  assertEqual(typeof g, "number", "callers divide by this and pass it to round1");
  assertEqual(g, 166, "value preserved");
});

// ==== saveFoodRecordMacros / saveEditBarcode propagation ====
test("saveFoodRecordMacros: restates loggedMacros even when the record has no loggedWeight", function () {
  M.state.recentFoods = [{ id: "h1", name: "Old", per100g: false, baseGrams: 50, calories: 100, protein: 5, carbs: 10, fat: 2, fiber: 0,
    loggedMacros: { calories: 100, protein: 5, carbs: 10, fat: 2, fiber: 0 } }];
  M.state.favorites = []; M.state.foodCache = {};
  M.state.ui = {};
  const originalGetElementById = documentStub.getElementById;
  documentStub.getElementById = function(id) {
    const map = { editMacro_protein: "10", editMacro_carbs: "20", editMacro_fat: "4", editMacro_fiber: "1", editMacroCaloriesInput: "200" };
    return { value: map[id] };
  };
  try {
    M.actions.saveFoodRecordMacros("h1");
  } finally {
    documentStub.getElementById = originalGetElementById; // shared singleton -- always restore
  }
  const rec = M.state.recentFoods[0];
  assertEqual(rec.calories, 200, "base macros corrected");
  // addFoodToLog prefers loggedMacros, so a stale one would silently win over the correction.
  assertEqual(rec.loggedMacros.calories, 200, "snapshot restated, not left stale at 100");
  assertEqual(rec.loggedWeight, 50, "loggedWeight paired with the snapshot's basis");
});
test("saveEditBarcode: the correction reaches History, not just customBarcodes and the cache", function () {
  M.state.customBarcodes = { "999": { id: "barcode_999", name: "Bar", per100g: false, calories: 100, protein: 5, carbs: 10, fat: 3, fiber: 0, baseGrams: 40, servingSizes: [{ label: "40g", grams: 40 }] } };
  M.state.recentFoods = [{ id: "barcode_999", name: "Bar", calories: 100, protein: 5, carbs: 10, fat: 3, fiber: 0, baseGrams: 40 }];
  M.state.favorites = []; M.state.foodCache = {};
  M.state.ui = { strategy: { editingBarcodeCode: "999", editBarcodeManual: { name: "Bar", weight: "60", calories: "150", protein: "7.5", carbs: "15", fat: "4.5", fiber: "0" } } };
  M.actions.saveEditBarcode();
  assertEqual(M.state.customBarcodes["999"].calories, 150, "barcode record updated");
  assertEqual(M.state.recentFoods[0].calories, 150, "History record updated too");
  assertEqual(M.state.recentFoods[0].baseGrams, 60, "History re-anchored to the new weight");
  assertEqual(M.state.recentFoods[0].servingSizes === M.state.customBarcodes["999"].servingSizes, false, "servingSizes is not one array aliased across stores");
});

// ============================================================
// DASHBOARD LOG ORDERING (newest first)
// ============================================================
test("groupEntriesByHourNewestFirst: hour groups run newest to oldest", function () {
  const groups = M.groupEntriesByHourNewestFirst([
    { id: "a", timestamp: "2026-07-21T09:15:00" },
    { id: "b", timestamp: "2026-07-21T17:40:00" },
    { id: "c", timestamp: "2026-07-21T13:05:00" },
  ]);
  assertEqual(groups.map(function(g){ return g.hour; }), [17, 13, 9], "5 PM, then 1 PM, then 9 AM");
  assertEqual(groups[0].label, "5 PM", "label derived from the hour");
});
test("groupEntriesByHourNewestFirst: entries inside an hour run newest first", function () {
  const groups = M.groupEntriesByHourNewestFirst([
    { id: "early", timestamp: "2026-07-21T12:05:00" },
    { id: "late", timestamp: "2026-07-21T12:50:00" },
    { id: "mid", timestamp: "2026-07-21T12:30:00" },
  ]);
  assertEqual(groups.length, 1, "all three share the noon hour");
  assertEqual(groups[0].items.map(function(e){ return e.id; }), ["late", "mid", "early"], "newest first within the group");
});
test("groupEntriesByHourNewestFirst: identical timestamps put the later-added entry first", function () {
  const groups = M.groupEntriesByHourNewestFirst([
    { id: "first", timestamp: "2026-07-21T08:00:00" },
    { id: "second", timestamp: "2026-07-21T08:00:00" },
  ]);
  assertEqual(groups[0].items.map(function(e){ return e.id; }), ["second", "first"], "insertion order broken in reverse, not preserved");
});
test("groupEntriesByHourNewestFirst: an entry moved in from another day sorts by its real time, not array position", function () {
  // A copied/moved entry is appended last but carries an older timestamp.
  const groups = M.groupEntriesByHourNewestFirst([
    { id: "logged_today", timestamp: "2026-07-21T18:00:00" },
    { id: "moved_in", timestamp: "2026-07-21T07:00:00" },
  ]);
  assertEqual(groups.map(function(g){ return g.hour; }), [18, 7], "6 PM group above the 7 AM group despite insertion order");
});
test("groupEntriesByHourNewestFirst: an unparseable timestamp is bucketed, not rendered as 'NaN AM'", function () {
  const groups = M.groupEntriesByHourNewestFirst([{ id: "bad", timestamp: "not-a-date" }]);
  assertEqual(groups.length, 1, "still grouped");
  assertEqual(groups[0].label, "12 AM", "falls into hour 0");
});
test("groupEntriesByHourNewestFirst: midnight and noon get distinct 12-hour labels", function () {
  const groups = M.groupEntriesByHourNewestFirst([
    { id: "midnight", timestamp: "2026-07-21T00:30:00" },
    { id: "noon", timestamp: "2026-07-21T12:30:00" },
  ]);
  assertEqual(groups.map(function(g){ return g.label; }), ["12 PM", "12 AM"], "noon is PM, midnight is AM");
});
test("groupEntriesByHourNewestFirst: empty and missing input return an empty list", function () {
  assertEqual(M.groupEntriesByHourNewestFirst([]).length, 0, "empty array");
  assertEqual(M.groupEntriesByHourNewestFirst(null).length, 0, "null guard");
});

// ============================================================
// BRAND-AWARE LOCAL SEARCH
// ============================================================
test("foodMatchesQuery: matches on brand as well as name", function () {
  const food = { name: "Loonie Dog", brand: "Schneiders" };
  assertEqual(M.foodMatchesQuery(food, "loonie"), true, "name match");
  assertEqual(M.foodMatchesQuery(food, "schneid"), true, "brand match");
  assertEqual(M.foodMatchesQuery(food, "zzz"), false, "no match");
});
test("foodMatchesQuery: name and brand are tested separately, never concatenated", function () {
  // "dog schneiders" only matches if the two fields were joined into one string.
  assertEqual(M.foodMatchesQuery({ name: "Loonie Dog", brand: "Schneiders" }, "dog schneiders"), false, "no straddling match across fields");
});
test("foodMatchesQuery: a record missing name or brand does not throw", function () {
  assertEqual(M.foodMatchesQuery({ brand: "Kraft" }, "kraft"), true, "no name field");
  assertEqual(M.foodMatchesQuery({ name: "Rice" }, "rice"), true, "no brand field");
  assertEqual(M.foodMatchesQuery(null, "x"), false, "null food");
});
test("filterFoodsByQuery: History/Favorites filtering finds a food by its brand", function () {
  const list = [{ name: "Loonie Dog", brand: "Schneiders" }, { name: "Bread", brand: "Wonder" }];
  assertEqual(M.filterFoodsByQuery(list, "Schneiders").length, 1, "brand match, case-insensitive");
  assertEqual(M.filterFoodsByQuery(list, "wonder")[0].name, "Bread", "the right row came back");
});
test("localFoodMatches: the search screen's 'Eaten before' group also matches on brand", function () {
  M.state.recentFoods = [{ id: "r1", name: "Loonie Dog", brand: "Schneiders", source: "Manual Entry", calories: 235, protein: 10, carbs: 20, fat: 13 }];
  M.state.favorites = []; M.state.foodCache = {};
  assertEqual(M.localFoodMatches("schneiders").length, 1, "found by brand with no network round trip");
  assertEqual(M.localFoodMatches("loonie").length, 1, "still found by name");
});

// ============================================================
// PROPERTY: every food-creation path anchors its macros to a real portion
// ============================================================
// This is the test that would have caught BOTH base-grams bugs before they shipped, and
// it's what keeps catching them as new logging paths get added. It deliberately asserts
// nothing about any individual path's arithmetic -- only the one invariant all of them
// must satisfy:
//
//   The food record left behind in History, asked for its macros at the weight that was
//   just logged, returns exactly the macros that were just logged -- and keeps doing so
//   after the food is re-logged at some other weight.
//
// Both shipped bugs were violations of that, in different paths: a macro correction that
// moved the numbers without moving the base, and a re-log that moved the base without
// moving the numbers. Per-path tests missed them because each path looked right in
// isolation; the invariant is what ties them together.
//
// Adding a food-creation action without setting baseGrams fails this by name, so nobody
// has to re-derive why the anchor matters. Register new paths in FOOD_CREATION_PATHS.

function assertMacrosClose(actual, expected, msg) {
  const keys = ["calories", "protein", "carbs", "fat", "fiber"];
  // Tolerances match calcMacrosForWeight's own rounding: whole-number calories (max 0.5
  // divergence), 1dp macros (max 0.05). Anything larger is a real anchor mismatch.
  const bad = keys.filter(function (k) {
    const tol = k === "calories" ? 1 : 0.15;
    return Math.abs((actual[k] || 0) - (expected[k] || 0)) > tol;
  });
  if (bad.length === 0) { pass++; }
  else {
    fail++;
    console.error("FAIL: " + msg + "\n  diverged on: " + bad.join(", ") +
      "\n  expected: " + JSON.stringify(expected) + "\n  actual:   " + JSON.stringify(actual));
  }
}

function resetForPathTest() {
  M.state.date = "2026-07-22";
  M.state.foodLogs = {};
  M.state.recentFoods = [];
  M.state.favorites = [];
  M.state.foodCache = {};
  M.state.customBarcodes = {};
  M.state.recipes = [];
  M.state.ui = {}; // let foodUi() rebuild its real defaults, as on a fresh boot
  return M.foodUi();
}

// Each path: set up exactly the UI state its action reads, then invoke it. Anything that
// lands one entry in the log via addFoodToLog belongs here.
const FOOD_CREATION_PATHS = [
  {
    name: "Manual Entry (addManualEntry)",
    covers: ["addManualEntry"],
    run: function (fu) {
      fu.manual = { name: "Loonie Dog", calories: "235", protein: "10", carbs: "20", fat: "13", fiber: "1", weight: "83" };
      M.actions.addManualEntry();
    },
  },
  {
    name: "AI Estimate, single result (addAiResult)",
    covers: ["addAiResult"],
    run: function (fu) {
      fu.aiResults = [{ name: "Chili", calories: 500, protein: 30, carbs: 40, fat: 22, fiber: 5, quantity_grams: 400 }];
      M.actions.addAiResult("0");
    },
  },
  {
    name: "AI Estimate, combined (addAiResultsCombined)",
    covers: ["addAiResultsCombined"],
    run: function (fu) {
      fu.aiDesc = "steak and potatoes";
      fu.aiResults = [
        { name: "Steak", calories: 400, protein: 40, carbs: 0, fat: 26, fiber: 0, quantity_grams: 200 },
        { name: "Potatoes", calories: 180, protein: 4, carbs: 38, fat: 1, fiber: 4, quantity_grams: 150 },
      ];
      M.actions.addAiResultsCombined();
    },
  },
  {
    name: "AI compare result, single (addAiCompareResult)",
    covers: ["addAiCompareResult"],
    run: function (fu) {
      fu.aiCompareResults = [{ name: "Curry", calories: 620, protein: 25, carbs: 60, fat: 30, fiber: 6, quantity_grams: 350 }];
      M.actions.addAiCompareResult("0");
    },
  },
  {
    name: "AI compare result, combined (addAiCompareResultsCombined)",
    covers: ["addAiCompareResultsCombined"],
    run: function (fu) {
      fu.aiDesc = "curry and rice";
      fu.aiCompareResults = [
        { name: "Curry", calories: 620, protein: 25, carbs: 60, fat: 30, fiber: 6, quantity_grams: 350 },
        { name: "Rice", calories: 200, protein: 4, carbs: 44, fat: 0.5, fiber: 1, quantity_grams: 150 },
      ];
      M.actions.addAiCompareResultsCombined();
    },
  },
  {
    name: "Recipe (confirmLogRecipe)",
    covers: ["confirmLogRecipe"],
    run: function (fu) {
      fu.loggingRecipe = {
        id: "r1", name: "Chili Batch",
        ingredients: [
          { id: "i1", name: "Beef", weight: 500, calories: 1250, protein: 100, carbs: 0, fat: 90, fiber: 0 },
          { id: "i2", name: "Beans", weight: 400, calories: 440, protein: 28, carbs: 76, fat: 2, fiber: 20 },
        ],
      };
      fu.loggingWeight = "300"; // a third of the batch
      M.actions.confirmLogRecipe();
    },
  },
  {
    name: "Database food re-added from search (confirmAddFood, per100g)",
    covers: ["confirmAddFood"],
    run: function (fu) {
      fu.addingFood = {
        id: "usda_1", name: "Chicken Breast", source: "USDA", per100g: true,
        calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, servingSizes: [],
      };
      fu.addWeight = "175";
      M.actions.confirmAddFood();
    },
  },
  {
    name: "Absolute-macro food re-added from History (confirmAddFood, no servingSizes)",
    covers: [],
    run: function (fu) {
      // The exact shape bug 2 lived in, and deliberately a LEGACY record: no servingSizes and
      // no baseGrams, so loggedWeight is the only thing the base can be inferred from -- which
      // is the field confirmAddFood is about to overwrite. Seeding baseGrams here (as an
      // earlier version of this fixture did) pre-applies the fix and lets the path pass even
      // with anchorFoodBase removed, which mutation testing caught. Leave it off: this is the
      // record shape already sitting in the live cloud data from before the fix.
      fu.addingFood = {
        id: "ai_hist", name: "Leftover Chili", source: "AI Estimate", per100g: false,
        calories: 500, protein: 30, carbs: 40, fat: 22, fiber: 5,
        loggedWeight: 400,
      };
      fu.addWeight = "250";
      M.actions.confirmAddFood();
    },
  },
  {
    name: "Wizard (wizardConfirmAdd)",
    covers: ["wizardConfirmAdd"],
    run: function (fu) {
      fu.wizardType = "steak";
      fu.wizard = {
        step: 2, selections: { prep: "Cooked" }, weight: "220", servingBasis: null, qty: "1",
        showAI: false, aiDesc: "", aiLoading: false, aiError: null, searchResults: [], searching: false,
        selectedFood: {
          id: "ai_wiz", name: "Ribeye", source: "AI Estimate", state: "Cooked", per100g: false,
          calories: 600, protein: 48, carbs: 0, fat: 45, fiber: 0,
          baseGrams: 250, servingSizes: [{ label: "250g", grams: 250 }],
        },
      };
      M.actions.wizardConfirmAdd();
    },
  },
  {
    name: "One-tap meal chip (logQuickMeal)",
    covers: ["logQuickMeal"],
    run: function (fu) {
      M.state.recipes = [{
        id: "r_meal", name: "Usual Breakfast", quickLog: true,
        ingredients: [
          { id: "i1", name: "Kirstens Sourdough", weight: 100, calories: 262, protein: 10, carbs: 52, fat: 1.5, fiber: 2 },
          { id: "i2", name: "High Protein Shake", weight: 325, calories: 159, protein: 30, carbs: 2.9, fat: 2.5, fiber: 0 },
        ],
        createdAt: "2026-07-22T00:00:00.000Z", updatedAt: "2026-07-22T00:00:00.000Z",
      }];
      M.actions.logQuickMeal("r_meal");
    },
  },
  {
    name: "Custom barcode entry (saveCustomBarcode then confirmAddFood)",
    covers: [],
    run: function (fu) {
      // scanningBarcode is part of the real precondition, not scaffolding: the "product not
      // found" form only ever renders inside renderBarcodeScanScreen, and saveCustomBarcode's
      // hand-off now drops results that arrive after the scan screen has been left.
      fu.scanningBarcode = true;
      fu.scanNotFoundCode = "0123456789012";
      fu.customBarcodeManual = { name: "Protein Bar", weight: "60", calories: "220", protein: "20", carbs: "22", fat: "7", fiber: "3" };
      M.actions.saveCustomBarcode(); // sets fu.addingFood + fu.addWeight for the next screen
      M.actions.confirmAddFood();
    },
  },
];

FOOD_CREATION_PATHS.forEach(function (path) {
  test("food-creation invariant: " + path.name, function () {
    const fu = resetForPathTest();
    path.run(fu);

    const entries = M.state.foodLogs[M.state.date] || [];
    assertEqual(entries.length, 1, path.name + " logged exactly one entry");
    if (entries.length !== 1) return;
    const entry = entries[0];
    const record = M.state.recentFoods.find(function (f) { return f.id === entry.foodId; });
    assertEqual(!!record, true, path.name + " left a History record behind");
    if (!record) return;

    // (1) The anchor exists and is the one actually in force.
    const base = M.foodBaseGrams(record);
    assertEqual(typeof record.baseGrams === "number" && record.baseGrams > 0 && isFinite(record.baseGrams), true,
      path.name + ": record carries an explicit positive baseGrams (got " + JSON.stringify(record.baseGrams) + ")");
    assertEqual(base, record.baseGrams, path.name + ": foodBaseGrams returns the explicit anchor, not an inference");

    // (2) Round-trip: asking the record for the weight just logged returns what was logged.
    // This is the property both bugs broke.
    assertMacrosClose(M.calcMacrosForWeight(record, entry.weight), entry.macros,
      path.name + ": record re-derives the logged macros at the logged weight");

    // (3) Re-logging at another weight must not move the anchor. Bug 2 compounded here --
    // every round trip through the adding-food screen doubled the food.
    const originalWeight = entry.weight;
    const originalMacros = entry.macros;
    M.actions.selectFoodForAdd(record.id, "history");
    M.state.ui.food.addWeight = String(originalWeight * 2);
    M.state.ui.food._confirmLock = 0;
    M.actions.confirmAddFood();

    M.actions.selectFoodForAdd(record.id, "history");
    M.state.ui.food.addWeight = String(originalWeight);
    M.state.ui.food._confirmLock = 0;
    M.actions.confirmAddFood();

    const roundTripped = (M.state.foodLogs[M.state.date] || []).slice(-1)[0];
    assertEqual(roundTripped.weight, originalWeight, path.name + ": round-tripped entry is back at the original weight");
    assertMacrosClose(roundTripped.macros, originalMacros,
      path.name + ": re-logging at 2x then back at 1x returns the original macros (no drift)");
    assertEqual(M.foodBaseGrams(M.state.recentFoods.find(function (f) { return f.id === entry.foodId; })), base,
      path.name + ": the base survived two re-logs unchanged");
  });
});

test("food-creation invariant: the suite actually covers every addFoodToLog caller", function () {
  // Guards the guard. If someone adds a logging path and doesn't register it in
  // FOOD_CREATION_PATHS, the property test above silently stops being exhaustive -- it would
  // still pass, while covering less. So derive the real list of logging actions from the
  // source and compare it to what the suite exercises. Named rather than counted: a count
  // nets to zero when one path is removed and another added on the same commit.
  // Rename the declaration so it doesn't read as a call site of itself.
  const src = require("fs").readFileSync(indexPath, "utf8").replace(/function addFoodToLog\(/g, "function __addFoodToLogDecl(");
  const blocks = [...src.matchAll(/\nactions\.([A-Za-z0-9_]+)\s*=/g)];
  // An action's body ends at the next actions.X OR the next top-level function, whichever
  // comes first -- without the second bound the slice runs past the action into unrelated
  // top-level code and misattributes its calls to whichever action happened to precede it.
  const nextTopLevelFn = function (from) {
    const i = src.indexOf("\nfunction ", from);
    return i < 0 ? src.length : i;
  };
  const loggingActions = blocks
    .filter(function (m, i) {
      const nextAction = i + 1 < blocks.length ? blocks[i + 1].index : src.length;
      const end = Math.min(nextAction, nextTopLevelFn(m.index + 1));
      return src.slice(m.index, end).indexOf("addFoodToLog(") >= 0;
    })
    .map(function (m) { return m[1]; })
    .sort();

  const covered = [];
  FOOD_CREATION_PATHS.forEach(function (p) { p.covers.forEach(function (a) { if (covered.indexOf(a) < 0) covered.push(a); }); });
  covered.sort();

  assertEqual(loggingActions, covered,
    "every action that calls addFoodToLog must be registered in FOOD_CREATION_PATHS -- " +
    "uncovered: [" + loggingActions.filter(function (a) { return covered.indexOf(a) < 0; }) + "], " +
    "stale entries: [" + covered.filter(function (a) { return loggingActions.indexOf(a) < 0; }) + "]");

  // Second, weaker net: catches a logging path added as a bare function rather than an
  // actions.X entry, which the block scan above would not see at all.
  const callSites = (src.match(/addFoodToLog\(/g) || []).length; // declaration already renamed out
  assertEqual(callSites, loggingActions.length,
    "all " + callSites + " addFoodToLog call sites live inside an actions.X handler; " +
    "if this diverges, a logging path was added somewhere the coverage scan can't see it");
});

// ============================================================
// CROSS-DEVICE CONVERGENCE (newer-wins on the whole-blob collections)
// ============================================================
test("foodRecordIsNewer: only prefers the cloud copy when it actually claims to be newer", function () {
  const older = { updatedAt: "2026-07-20T10:00:00.000Z" };
  const newer = { updatedAt: "2026-07-22T10:00:00.000Z" };
  assertEqual(M.foodRecordIsNewer(newer, older), true, "newer cloud wins");
  assertEqual(M.foodRecordIsNewer(older, newer), false, "older cloud loses");
  // Backward compatibility: everything already stored predates updatedAt entirely.
  assertEqual(M.foodRecordIsNewer({}, {}), false, "neither stamped -> local wins, as before");
  assertEqual(M.foodRecordIsNewer({}, newer), false, "unstamped cloud never beats a stamped local");
  assertEqual(M.foodRecordIsNewer(newer, {}), true, "stamped cloud beats an unstamped local");
  assertEqual(M.foodRecordIsNewer({ updatedAt: "garbage" }, older), false, "unparseable cloud stamp makes no claim");
});
test("mergeFoodListFromCloud: adds unknown foods and updates known ones only when newer", function () {
  const local = [
    { id: "a", calories: 100, updatedAt: "2026-07-20T10:00:00.000Z" },
    { id: "b", calories: 200, updatedAt: "2026-07-25T10:00:00.000Z" },
    { id: "c", calories: 300 },
  ];
  const changed = M.mergeFoodListFromCloud(local, [
    { id: "a", calories: 111, updatedAt: "2026-07-24T10:00:00.000Z" }, // newer -> wins
    { id: "b", calories: 222, updatedAt: "2026-07-21T10:00:00.000Z" }, // older -> loses
    { id: "c", calories: 333 },                                        // unstamped -> loses
    { id: "d", calories: 444 },                                        // unknown -> added
  ]);
  assertEqual(changed, 2, "one updated, one added");
  assertEqual(local.map(function (f) { return f.id + ":" + f.calories; }),
    ["a:111", "b:200", "c:300", "d:444"], "only the genuinely newer record was replaced");
});
test("mergeFoodListFromCloud: mutates in place and tolerates junk rows", function () {
  const local = [];
  const ref = local;
  M.mergeFoodListFromCloud(local, [null, {}, { id: "x", calories: 1 }]);
  assertEqual(ref === local, true, "same array object -- a concurrent local mutation isn't dropped");
  assertEqual(local.length, 1, "rows with no id are skipped rather than throwing");
});
// The gap called out after the baseGrams fix shipped: the repair was per-device only, because
// a second device holding that food id would never accept the corrected copy.
test("convergence: a correction on device A reaches device B through the cloud blob", function () {
  const drifted = { id: "manual_1", name: "Dog", calories: 500, baseGrams: 200 };

  // Device A holds the drifted record and corrects it.
  M.state.recentFoods = [Object.assign({}, drifted)];
  M.state.favorites = []; M.state.foodCache = { manual_1: Object.assign({}, drifted) };
  M.updateFoodRecordEverywhere("manual_1", { calories: 235, baseGrams: 83 });
  const corrected = M.state.recentFoods[0];
  assertEqual(typeof corrected.updatedAt, "string", "a correction stamps updatedAt, or it can never propagate");

  // Device B still holds the drifted copy, and pulls A's blob.
  M.state.recentFoods = [Object.assign({}, drifted)];
  M.state.foodCache = { manual_1: Object.assign({}, drifted) };
  M.mergeRecentFoodsFromCloud([corrected]);
  M.mergeFoodCacheFromCloud({ manual_1: corrected });
  assertEqual(M.state.recentFoods[0].calories, 235, "History on device B took the correction");
  assertEqual(M.state.recentFoods[0].baseGrams, 83, "including the repaired base");
  assertEqual(M.state.foodCache.manual_1.baseGrams, 83, "and the cache, which drives portion re-derivation");
});
test("convergence: device B's stale copy cannot overwrite device A's correction on the way back", function () {
  const stale = { id: "manual_1", calories: 500, baseGrams: 200 };
  const corrected = { id: "manual_1", calories: 235, baseGrams: 83, updatedAt: "2026-07-25T12:00:00.000Z" };
  M.state.recentFoods = [Object.assign({}, corrected)];
  M.state.favorites = []; M.state.foodCache = {};
  M.mergeRecentFoodsFromCloud([stale]);
  assertEqual(M.state.recentFoods[0].calories, 235, "an unstamped stale record never wins");
});
// Round-trip through the actual sync serialisation, which no earlier test crossed.
test("sync round-trip: baseGrams survives push serialisation and pull merge", function () {
  M.state.recentFoods = [{ id: "m1", name: "Dog", calories: 235, baseGrams: 83, loggedWeight: 83, updatedAt: "2026-07-25T12:00:00.000Z" }];
  M.state.favorites = []; M.state.foodCache = {};
  // pushAppDataToCloud sends state.recentFoods as-is inside a JSON body; emulate the wire.
  const onWire = JSON.parse(JSON.stringify(M.state.recentFoods));
  assertEqual(onWire[0].baseGrams, 83, "baseGrams is a plain number and survives JSON");
  // A fresh device pulls it.
  M.state.recentFoods = [];
  M.mergeRecentFoodsFromCloud(onWire);
  assertEqual(M.state.recentFoods[0].baseGrams, 83, "arrives intact on the other side");
  assertEqual(M.calcMacrosForWeight(M.state.recentFoods[0], 166).calories, 470,
    "and still scales correctly after the round trip");
});

test("mergeRecentFoodsFromCloud: a pull cannot grow History past its 500 cap", function () {
  M.state.recentFoods = [];
  M.state.favorites = []; M.state.foodCache = {};
  const cloud = [];
  for (let i = 0; i < 600; i++) cloud.push({ id: "f" + i, name: "Food " + i, lastUsed: new Date(2026, 0, 1, 0, 0, i).toISOString() });
  M.mergeRecentFoodsFromCloud(cloud);
  assertEqual(M.state.recentFoods.length, 500, "capped after the merge, not just after the next log");
  // Sorted most-recent-first, so the cap drops the oldest rather than an arbitrary 100.
  assertEqual(M.state.recentFoods[0].id, "f599", "most recently used survives at the top");
  assertEqual(M.state.recentFoods.some(function (f) { return f.id === "f0"; }), false, "the oldest is what got dropped");
});
test("mergeFavoritesFromCloud: a pull cannot grow Favorites past its 100 cap", function () {
  M.state.favorites = []; M.state.recentFoods = []; M.state.foodCache = {};
  const cloud = [];
  for (let i = 0; i < 150; i++) cloud.push({ id: "v" + i, addedAt: new Date(2026, 0, 1, 0, 0, i).toISOString() });
  M.mergeFavoritesFromCloud(cloud);
  assertEqual(M.state.favorites.length, 100, "capped after the merge");
});
test("merge cap: the local array object is preserved, never reassigned", function () {
  M.state.recentFoods = [{ id: "keep", lastUsed: "2026-07-25T10:00:00.000Z" }];
  const ref = M.state.recentFoods;
  M.mergeRecentFoodsFromCloud([{ id: "new", lastUsed: "2026-07-26T10:00:00.000Z" }]);
  assertEqual(ref === M.state.recentFoods, true, "in-place: a concurrent local mutation isn't dropped by a swap");
  assertEqual(M.state.recentFoods[0].id, "new", "and it's recency-ordered");
});

// ============================================================
// FOOD CACHE GROWTH
// ============================================================
test("pruneFoodCache: does nothing while under the cap", function () {
  M.state.foodCache = { a: { id: "a" }, b: { id: "b" } };
  M.state.recentFoods = []; M.state.favorites = []; M.state.customBarcodes = {}; M.state.foodLogs = {};
  assertEqual(M.pruneFoodCache(), 0, "no eviction below the cap");
  assertEqual(Object.keys(M.state.foodCache).length, 2, "nothing dropped");
});
test("pruneFoodCache: over the cap, keeps everything still reachable and drops only orphans", function () {
  M.state.foodCache = {};
  for (let i = 0; i < M.FOOD_CACHE_CAP + 50; i++) M.state.foodCache["orphan_" + i] = { id: "orphan_" + i };
  // One reference of each kind, all of which must survive.
  M.state.foodCache.keep_history = { id: "keep_history" };
  M.state.foodCache.keep_fav = { id: "keep_fav" };
  M.state.foodCache.keep_barcode = { id: "keep_barcode" };
  M.state.foodCache.keep_logged = { id: "keep_logged" };
  M.state.recentFoods = [{ id: "keep_history" }];
  M.state.favorites = [{ id: "keep_fav" }];
  M.state.customBarcodes = { "999": { id: "keep_barcode" } };
  M.state.foodLogs = { "2026-07-25": [{ id: "log_1", foodId: "keep_logged" }] };

  const dropped = M.pruneFoodCache();
  assertEqual(dropped > 0, true, "orphans were evicted");
  assertEqual(!!M.state.foodCache.keep_history, true, "a History-referenced food is kept");
  assertEqual(!!M.state.foodCache.keep_fav, true, "a Favorites-referenced food is kept");
  assertEqual(!!M.state.foodCache.keep_barcode, true, "a custom-barcode food is kept");
  // This one matters most: dropping it would break rescaleEntryMacros for that logged entry.
  assertEqual(!!M.state.foodCache.keep_logged, true, "a food referenced by a logged entry is kept");
  assertEqual(!!M.state.foodCache.orphan_0, false, "an unreachable food is dropped");
});
test("pruneFoodCache: a logged entry keeps its food even when the food aged out of History", function () {
  M.state.foodCache = {};
  for (let i = 0; i < M.FOOD_CACHE_CAP + 10; i++) M.state.foodCache["o" + i] = { id: "o" + i };
  M.state.foodCache.old_food = { id: "old_food", calories: 200, baseGrams: 100 };
  M.state.recentFoods = []; M.state.favorites = []; M.state.customBarcodes = {};
  M.state.foodLogs = { "2026-01-01": [{ id: "log_old", foodId: "old_food", weight: 100, macros: { calories: 200, protein: 0, carbs: 0, fat: 0, fiber: 0 } }] };
  M.pruneFoodCache();
  assertEqual(!!M.state.foodCache.old_food, true, "kept -- History's 500 cap must not silently break old entries' portion maths");
});

// ============================================================
// FAILURE VISIBILITY
// ============================================================
test("recordSyncFailure: a failed push is recorded rather than leaving a stale 'last synced'", function () {
  M.state.lastSyncError = null;
  M.recordSyncFailure("foodLogs", "JWT expired");
  assertEqual(M.state.lastSyncError.kind, "foodLogs", "which collection failed");
  assertEqual(M.state.lastSyncError.message, "JWT expired", "and why");
  assertEqual(typeof M.state.lastSyncError.at, "number", "and when");
});

// ============================================================
// EDITABLE BASE PORTION (the repair path for a drifted record)
// ============================================================
test("saveFoodRecordMacros: editing the basis re-anchors the food and rescales its snapshot", function () {
  M.state.recentFoods = [{
    id: "drift_1", name: "Chili", per100g: false,
    calories: 500, protein: 30, carbs: 40, fat: 22, fiber: 5,
    baseGrams: 200, loggedWeight: 200, // drifted: these macros really describe 400g
    loggedMacros: { calories: 500, protein: 30, carbs: 40, fat: 22, fiber: 5 },
  }];
  M.state.favorites = []; M.state.foodCache = {};
  M.state.ui = {};
  M.foodUi().foodEditBaseInput = "400"; // the user repairs the basis
  const originalGetElementById = documentStub.getElementById;
  documentStub.getElementById = function (id) {
    const map = { editMacro_protein: "30", editMacro_carbs: "40", editMacro_fat: "22", editMacro_fiber: "5", editMacroCaloriesInput: "500" };
    return { value: map[id] };
  };
  try { M.actions.saveFoodRecordMacros("drift_1"); }
  finally { documentStub.getElementById = originalGetElementById; }

  const fixed = M.state.recentFoods[0];
  assertEqual(fixed.baseGrams, 400, "base repaired to the portion the numbers actually describe");
  assertEqual(M.calcMacrosForWeight(fixed, 400).calories, 500, "400g now reads 500 kcal");
  assertEqual(M.calcMacrosForWeight(fixed, 200).calories, 250, "and 200g correctly reads half");
  assertEqual(M.foodUi().foodEditBaseInput, null, "the input is cleared, so it can't re-anchor the next food opened");
});
test("saveFoodRecordMacros: a blank or zero basis falls back rather than anchoring to 0g", function () {
  M.state.recentFoods = [{ id: "d2", per100g: false, calories: 100, protein: 5, carbs: 10, fat: 2, fiber: 0, baseGrams: 50, loggedWeight: 50 }];
  M.state.favorites = []; M.state.foodCache = {};
  M.state.ui = {};
  M.foodUi().foodEditBaseInput = "0";
  const originalGetElementById = documentStub.getElementById;
  documentStub.getElementById = function (id) {
    const map = { editMacro_protein: "5", editMacro_carbs: "10", editMacro_fat: "2", editMacro_fiber: "0", editMacroCaloriesInput: "100" };
    return { value: map[id] };
  };
  try { M.actions.saveFoodRecordMacros("d2"); }
  finally { documentStub.getElementById = originalGetElementById; }
  assertEqual(M.state.recentFoods[0].baseGrams, 50, "kept the previous base; 0g would divide by zero in every rescale");
});

// ============================================================
// MOVE DAY MUST SURVIVE SYNC
// ============================================================
// A log entry's log_date is editable (Move Day), so it is part of what a merge has to
// reconcile. It wasn't: a newer cloud copy was written back over the slot the entry already
// occupied, leaving it filed under the day it used to be on. Combined with moveFoodEntryToDate
// not bumping updatedAt, a move made on one device never reached the other, each device pushed
// its own log_date back, and the two disagreed about which day the food belonged to -- wrong
// calorie totals on both days, indefinitely.
test("moveFoodEntryToDate: bumps updatedAt so the move can win a conflict", function () {
  M.state.date = "2026-07-20";
  M.state.foodLogs = { "2026-07-20": [{ id: "mv1", name: "Lunch", weight: 200, macros: { calories: 400 }, timestamp: "2026-07-20T12:00:00.000Z", updatedAt: "2026-07-20T12:00:00.000Z" }] };
  assertEqual(M.moveFoodEntryToDate("mv1", "2026-07-25"), true, "move reported success");
  const moved = M.state.foodLogs["2026-07-25"][0];
  assertEqual(moved.updatedAt !== "2026-07-20T12:00:00.000Z", true, "updatedAt advanced past the pre-move stamp");
  assertEqual(M.state.foodLogs["2026-07-20"].length, 0, "and it left the old day");
});
test("mergeFoodLogsFromCloud: a newer cloud copy on a different date is RE-FILED, not overwritten in place", function () {
  M.state.foodLogs = { "2026-07-20": [{ id: "mv2", foodId: "f", name: "Dinner", weight: 300, macros: { calories: 600, protein: 30, carbs: 60, fat: 20, fiber: 4 }, timestamp: "2026-07-20T18:00:00.000Z", updatedAt: "2026-07-20T18:00:00.000Z" }] };
  M.mergeFoodLogsFromCloud([{
    id: "mv2", log_date: "2026-07-25", food_id: "f", name: "Dinner", weight: 300,
    calories: 600, protein: 30, carbs: 60, fat: 20, fiber: 4,
    logged_at: "2026-07-20T18:00:00.000Z", updated_at: "2026-07-26T09:00:00.000Z",
  }]);
  assertEqual((M.state.foodLogs["2026-07-20"] || []).length, 0, "removed from the stale date");
  assertEqual((M.state.foodLogs["2026-07-25"] || []).length, 1, "landed on the date the cloud says it's on");
  assertEqual(M.state.foodLogs["2026-07-25"][0].macros.calories, 600, "with its macros intact");
});
test("mergeFoodLogsFromCloud: an OLDER cloud copy cannot drag a locally-moved entry back", function () {
  M.state.foodLogs = { "2026-07-25": [{ id: "mv3", name: "Dinner", weight: 300, macros: { calories: 600 }, timestamp: "2026-07-20T18:00:00.000Z", updatedAt: "2026-07-26T10:00:00.000Z" }] };
  M.mergeFoodLogsFromCloud([{ id: "mv3", log_date: "2026-07-20", name: "Dinner", weight: 300, calories: 600, protein: 0, carbs: 0, fat: 0, fiber: 0, logged_at: "2026-07-20T18:00:00.000Z", updated_at: "2026-07-20T18:00:00.000Z" }]);
  assertEqual((M.state.foodLogs["2026-07-25"] || []).length, 1, "the newer local move stands");
  assertEqual((M.state.foodLogs["2026-07-20"] || []).length, 0, "and nothing reappeared on the old date");
});
test("mergeFoodLogsFromCloud: a same-date update still writes in place", function () {
  M.state.foodLogs = { "2026-07-25": [{ id: "mv4", name: "Old", weight: 100, macros: { calories: 100 }, timestamp: "2026-07-25T08:00:00.000Z", updatedAt: "2026-07-25T08:00:00.000Z" }] };
  M.mergeFoodLogsFromCloud([{ id: "mv4", log_date: "2026-07-25", name: "New", weight: 200, calories: 250, protein: 0, carbs: 0, fat: 0, fiber: 0, logged_at: "2026-07-25T08:00:00.000Z", updated_at: "2026-07-26T08:00:00.000Z" }]);
  assertEqual(M.state.foodLogs["2026-07-25"].length, 1, "no duplicate created");
  assertEqual(M.state.foodLogs["2026-07-25"][0].name, "New", "updated in place");
});

// ============================================================
// DELETES MUST BE DURABLE
// ============================================================
// A DELETE used to be fired and forgotten, with only a 30s in-memory tombstone standing between
// a failed delete and the next pull re-adding the row -- silently, permanently, and on a
// calorie tracker that means the day's total quietly goes back up.
test("scheduleCloudDelete: queues the delete so it survives a reload", function () {
  M.savePendingDeletes([]);
  M.state.session = null; // offline / signed out: the request can't even be attempted
  M.enqueuePendingDelete("food_log_entries", "id", "log_x");
  assertEqual(M.hasPendingDelete("food_log_entries", "log_x"), true, "queued");
  assertEqual(M.loadPendingDeletes().length, 1, "persisted to storage, so a reload doesn't lose it");
});
test("enqueuePendingDelete: is idempotent", function () {
  M.savePendingDeletes([]);
  M.enqueuePendingDelete("food_log_entries", "id", "dup");
  M.enqueuePendingDelete("food_log_entries", "id", "dup");
  assertEqual(M.loadPendingDeletes().length, 1, "the same delete isn't queued twice");
});
test("wasRecentlyDeleted: an outstanding delete blocks resurrection regardless of the 30s TTL", function () {
  M.savePendingDeletes([]);
  M.recentlyDeletedIds.food_log_entries.clear();
  M.enqueuePendingDelete("food_log_entries", "id", "log_y");
  // No in-memory tombstone at all -- this is the post-reload state, where the old code had
  // nothing left to block the row with.
  assertEqual(M.wasRecentlyDeleted("food_log_entries", "log_y"), true, "the queue itself is the tombstone");
});
test("a deleted entry stays deleted through a pull even after its tombstone expires", function () {
  M.savePendingDeletes([]);
  M.recentlyDeletedIds.food_log_entries.clear();
  M.state.foodLogs = {};
  M.enqueuePendingDelete("food_log_entries", "id", "log_z"); // its DELETE failed earlier
  M.mergeFoodLogsFromCloud([{ id: "log_z", log_date: "2026-07-26", name: "Snack", weight: 50, calories: 250, protein: 0, carbs: 0, fat: 0, fiber: 0, logged_at: "2026-07-26T15:00:00.000Z", updated_at: "2026-07-26T15:00:00.000Z" }]);
  assertEqual((M.state.foodLogs["2026-07-26"] || []).length, 0, "the cloud's stale copy was not merged back in");
});
test("pending deletes: concurrent confirmations don't restore each other's entries", function () {
  // flushPendingDeletes retries the queue with Promise.all, so several deletes confirm at once.
  // An implementation that re-read the queue from storage on each dequeue would have each call
  // filter the same stale snapshot and the last write would resurrect the others' entries.
  M.savePendingDeletes([]);
  ["a", "b", "c"].forEach(function (id) { M.enqueuePendingDelete("food_log_entries", "id", id); });
  assertEqual(M.loadPendingDeletes().length, 3, "three queued");
  M.dequeuePendingDelete("food_log_entries", "a");
  M.dequeuePendingDelete("food_log_entries", "b");
  M.dequeuePendingDelete("food_log_entries", "c");
  assertEqual(M.loadPendingDeletes().length, 0, "all three cleared, none restored by a later write");
});
test("dequeuePendingDelete: a confirmed delete stops blocking that id", function () {
  M.savePendingDeletes([]);
  M.recentlyDeletedIds.food_log_entries.clear();
  M.enqueuePendingDelete("food_log_entries", "id", "log_done");
  M.dequeuePendingDelete("food_log_entries", "log_done");
  assertEqual(M.hasPendingDelete("food_log_entries", "log_done"), false, "cleared once the server confirmed it");
});
test("pending deletes are scoped per table, not global by id", function () {
  M.savePendingDeletes([]);
  M.enqueuePendingDelete("weight_entries", "log_date", "2026-07-25");
  assertEqual(M.hasPendingDelete("weight_entries", "2026-07-25"), true, "blocked for its own table");
  assertEqual(M.hasPendingDelete("food_log_entries", "2026-07-25"), false, "but not for an unrelated one");
  M.savePendingDeletes([]);
});

// ============================================================
// EXPORT IS THE BACKUP -- IT HAS TO BE COMPLETE
// ============================================================
test("exportSnapshot: carries every collection needed to restore, foodCache included", function () {
  const keys = Object.keys(M.exportSnapshot());
  ["settings", "foodLogs", "weights", "favorites", "recentFoods", "foodCache", "recipes", "customBarcodes"].forEach(function (k) {
    assertEqual(keys.indexOf(k) >= 0, true, "export includes " + k);
  });
});
test("exportSnapshot: foodCache round-trips the baseGrams that logged entries depend on", function () {
  M.state.foodCache = { m1: { id: "m1", per100g: false, calories: 235, protein: 10, carbs: 20, fat: 13, fiber: 1, baseGrams: 83 } };
  const restored = JSON.parse(JSON.stringify(M.exportSnapshot()));
  assertEqual(restored.foodCache.m1.baseGrams, 83, "anchor survives the backup");
  // Without this, a restored entry can no longer re-derive its macros from its source food.
  assertEqual(M.calcMacrosForWeight(restored.foodCache.m1, 166).calories, 470, "and still scales after a restore");
});

// ============================================================
// PER-DAY MACRO BOOSTS (heavy-activity days)
// ============================================================
// getDayTargets' BASE now comes from targetsForDate, so these boost-math tests have to control
// that source too -- an empty targetHistory is what makes state.settings the base, which is the
// condition they were written under.
M.state.targetHistory = {};
test("getDayTargets: no boost returns the base targets untouched", function () {
  M.state.targetHistory = {};
  M.state.settings.calorieTarget = 1876; M.state.settings.proteinTarget = 163;
  M.state.settings.carbsTarget = 153; M.state.settings.fatTarget = 68;
  M.state.dayBoosts = {};
  const t = M.getDayTargets("2026-07-28");
  assertEqual(t, { calorieTarget: 1876, proteinTarget: 163, carbsTarget: 153, fatTarget: 68, boost: null }, "base pass-through");
});
test("getDayTargets: a boost raises that day's macros and derives the calories via Atwater", function () {
  M.state.targetHistory = {};
  M.state.dayBoosts = { "2026-07-28": { protein: 20, carbs: 30, fat: 5, updatedAt: "2026-07-28T10:00:00.000Z" } };
  const t = M.getDayTargets("2026-07-28");
  assertEqual(t.proteinTarget, 183, "protein +20");
  assertEqual(t.carbsTarget, 183, "carbs +30");
  assertEqual(t.fatTarget, 73, "fat +5");
  assertEqual(t.calorieTarget, 1876 + 20 * 4 + 30 * 4 + 5 * 9, "calories rise by 4/4/9 of the boost grams");
  // The boost is per-DAY: every other date still reads base.
  assertEqual(M.getDayTargets("2026-07-27").calorieTarget, 1876, "adjacent day unaffected");
});
test("getDayTargets: an all-zero boost entry means toggled off, not a zero-shaped boost", function () {
  M.state.targetHistory = {};
  M.state.dayBoosts = { "2026-07-28": { protein: 0, carbs: 0, fat: 0, updatedAt: "2026-07-28T10:00:00.000Z" } };
  assertEqual(M.getDayTargets("2026-07-28").boost, null, "zero entry is inert");
  assertEqual(M.getDayTargets("2026-07-28").calorieTarget, 1876, "targets are base");
});
test("bumpDayBoost: steps up, steps down, goes negative, stamps updatedAt", function () {
  M.state.dayBoosts = {}; M.state.date = "2026-07-28"; M.state.ui = {};
  M.state.settings.fatTarget = 68;
  M.actions.bumpDayBoost("protein", "10");
  M.actions.bumpDayBoost("protein", "10");
  M.actions.bumpDayBoost("fat", "5");
  assertEqual(M.dayBoostFor("2026-07-28"), { protein: 20, carbs: 0, fat: 5 }, "accumulates per macro");
  M.actions.bumpDayBoost("fat", "-5");
  M.actions.bumpDayBoost("fat", "-5"); // below zero: allowed now -- removing calories is the point
  assertEqual(M.state.dayBoosts["2026-07-28"].fat, -5, "negative boost is a legitimate value");
  assertEqual(typeof M.state.dayBoosts["2026-07-28"].updatedAt, "string", "stamped so the merge can resolve it");
  M.actions.bumpDayBoost("weight", "10");
  assertEqual(M.dayBoostFor("2026-07-28").protein, 20, "an unknown macro key is rejected, not written");
});
test("bumpDayBoost: a negative boost floors at minus-the-base-target, never below", function () {
  M.state.dayBoosts = {}; M.state.date = "2026-07-28"; M.state.ui = {};
  M.state.settings.fatTarget = 12;
  M.actions.bumpDayBoost("fat", "-5");
  M.actions.bumpDayBoost("fat", "-5");
  M.actions.bumpDayBoost("fat", "-5"); // would be -15, base is only 12
  assertEqual(M.state.dayBoosts["2026-07-28"].fat, -12, "floored so the effective target bottoms out at exactly 0");
  M.state.settings.fatTarget = 68;
});
test("getDayTargets: a negative boost lowers the day's targets, floored at zero", function () {
  M.state.targetHistory = {};
  M.state.settings.calorieTarget = 1876; M.state.settings.proteinTarget = 163;
  M.state.settings.carbsTarget = 153; M.state.settings.fatTarget = 68;
  M.state.dayBoosts = { "2026-07-29": { protein: 0, carbs: -50, fat: -10, updatedAt: "2026-07-28T10:00:00.000Z" } };
  const t = M.getDayTargets("2026-07-29");
  assertEqual(t.carbsTarget, 103, "carbs −50");
  assertEqual(t.fatTarget, 58, "fat −10");
  assertEqual(t.calorieTarget, 1876 - 50 * 4 - 10 * 9, "calories drop by 4/4/9 of the removed grams");
  // Absurdly negative stored values (e.g. synced from a future version) still can't produce
  // a negative target -- the progress-bar math divides by these.
  M.state.dayBoosts = { "2026-07-29": { protein: -999, carbs: -999, fat: -999, updatedAt: "2026-07-28T10:00:00.000Z" } };
  const t2 = M.getDayTargets("2026-07-29");
  assertEqual(t2.proteinTarget >= 0 && t2.carbsTarget >= 0 && t2.fatTarget >= 0 && t2.calorieTarget >= 0, true, "all targets floored at 0");
});
test("signedKcal: explicit sign both directions", function () {
  assertEqual(M.signedKcal(320), "+320", "surplus/boost");
  assertEqual(M.signedKcal(-240), "−240", "deficit/reduction");
  assertEqual(M.signedKcal(0), "+0", "zero reads as +0");
});
test("clearDayBoost: writes zeros (a sync tombstone) rather than deleting the entry", function () {
  M.state.dayBoosts = { "2026-07-28": { protein: 20, carbs: 0, fat: 0, updatedAt: "2026-07-28T10:00:00.000Z" } };
  M.state.date = "2026-07-28"; M.state.ui = {};
  M.actions.clearDayBoost();
  assertEqual(M.dayBoostFor("2026-07-28"), null, "boost is off");
  assertEqual(!!M.state.dayBoosts["2026-07-28"], true, "but the entry survives as a tombstone");
});
test("mergeDayBoostsFromCloud: newer wins per date; a newer zero beats an older boost (cross-device toggle-off)", function () {
  M.state.dayBoosts = {
    "2026-07-27": { protein: 10, carbs: 0, fat: 0, updatedAt: "2026-07-27T09:00:00.000Z" },
    "2026-07-28": { protein: 20, carbs: 0, fat: 0, updatedAt: "2026-07-28T09:00:00.000Z" },
  };
  M.mergeDayBoostsFromCloud({
    "2026-07-27": { protein: 0, carbs: 0, fat: 0, updatedAt: "2026-07-27T12:00:00.000Z" }, // newer OFF
    "2026-07-28": { protein: 99, carbs: 0, fat: 0, updatedAt: "2026-07-28T08:00:00.000Z" }, // older -> loses
    "2026-07-26": { protein: 0, carbs: 40, fat: 0, updatedAt: "2026-07-26T09:00:00.000Z" }, // unknown -> added
  });
  assertEqual(M.dayBoostFor("2026-07-27"), null, "the toggle-off propagated");
  assertEqual(M.state.dayBoosts["2026-07-28"].protein, 20, "the older cloud copy lost");
  assertEqual(M.dayBoostFor("2026-07-26").carbs, 40, "a boost set on the other device arrived");
});
test("exportSnapshot: includes dayBoosts", function () {
  M.state.dayBoosts = { "2026-07-28": { protein: 20, carbs: 0, fat: 0, updatedAt: "2026-07-28T09:00:00.000Z" } };
  assertEqual(!!M.exportSnapshot().dayBoosts, true, "the backup carries per-day boosts");
});
test("renderDayBoostBlock: renders the chip closed, the steppers open, and never throws", function () {
  M.state.ui = {}; M.state.date = "2026-07-28";
  const closed = M.renderDayBoostBlock(null);
  assertEqual(closed.indexOf("toggleDayBoostPanel") >= 0, true, "chip is wired");
  assertEqual(closed.indexOf("bumpDayBoost") >= 0, false, "steppers hidden while closed");
  M.state.ui.dayBoostOpen = true;
  const open = M.renderDayBoostBlock({ protein: 20, carbs: 30, fat: 5 });
  assertEqual(open.indexOf("bumpDayBoost") >= 0, true, "steppers visible");
  assertEqual(open.indexOf("+" + (20 * 4 + 30 * 4 + 5 * 9) + " kcal") >= 0, true, "chip shows the derived calories");
  assertEqual(open.indexOf("clearDayBoost") >= 0, true, "clear offered when active");
});
// ==== 7-day deficit/surplus log ====
test("weeklyDeltaLog: seven calendar days ending on the anchor, oldest first", function () {
  M.state.targetHistory = {};
  M.state.settings.calorieTarget = 2000;
  M.state.foodLogs = {};
  const rows = M.weeklyDeltaLog("2026-07-28", 7);
  assertEqual(rows.length, 7, "seven rows");
  assertEqual(rows[0].date, "2026-07-22", "starts six days back");
  assertEqual(rows[6].date, "2026-07-28", "ends on the anchor day");
});
test("weeklyDeltaLog: delta is intake minus the BASE settings goal, boost or no boost", function () {
  M.state.targetHistory = {};
  M.state.settings.calorieTarget = 2000;
  M.state.foodLogs = {
    "2026-07-27": [{ id: "a", macros: { calories: 1700 } }],
    "2026-07-28": [{ id: "b", macros: { calories: 2350 } }],
  };
  // A boost on the 28th must NOT move the yardstick -- the log scores against the standing
  // goal from Strategy, else a boost hides the very surplus it was meant to budget for.
  M.state.dayBoosts = { "2026-07-28": { protein: 50, carbs: 0, fat: 0, updatedAt: "2026-07-28T10:00:00.000Z" } };
  const rows = M.weeklyDeltaLog("2026-07-28", 7);
  const d27 = rows.find(function(r){ return r.date === "2026-07-27"; });
  const d28 = rows.find(function(r){ return r.date === "2026-07-28"; });
  assertEqual(d27.delta, -300, "300 kcal deficit");
  assertEqual(d28.delta, 350, "350 kcal surplus, measured against 2000, not the boosted target");
});
test("weeklyDeltaLog: unlogged days are flagged, not counted as giant deficits", function () {
  M.state.targetHistory = {};
  M.state.settings.calorieTarget = 2000;
  M.state.foodLogs = { "2026-07-28": [{ id: "a", macros: { calories: 1900 } }] };
  const rows = M.weeklyDeltaLog("2026-07-28", 7);
  const unlogged = rows.filter(function(r){ return !r.logged; });
  assertEqual(unlogged.length, 6, "six empty days flagged");
  assertEqual(rows[6].logged, true, "the logged day counts");
  // The card's net must therefore be -100, not -100 - 6*2000.
  const net = rows.filter(function(r){ return r.logged; }).reduce(function(a, r){ return a + r.delta; }, 0);
  assertEqual(net, -100, "net sums logged days only");
});
test("weeklyDeltaLog: spans a month boundary by calendar days", function () {
  M.state.targetHistory = {};
  M.state.settings.calorieTarget = 2000;
  M.state.foodLogs = {};
  const rows = M.weeklyDeltaLog("2026-08-03", 7);
  assertEqual(rows[0].date, "2026-07-28", "window reaches back across the month edge");
});
test("renderWeeklyDeltaCard: renders rows, net, and the no-data state without throwing", function () {
  M.state.targetHistory = {};
  M.state.dayBoosts = {};
  M.state.settings.calorieTarget = 2000;
  M.state.date = "2026-07-28";
  M.state.foodLogs = { "2026-07-28": [{ id: "a", macros: { calories: 1900 } }] };
  const html = M.renderWeeklyDeltaCard();
  assertEqual(html.indexOf("Last 7 Days") >= 0, true, "card title");
  assertEqual(html.indexOf("−100") >= 0, true, "the day's deficit is shown signed");
  assertEqual(html.indexOf("no log") >= 0, true, "empty days say so");
  M.state.foodLogs = {};
  assertEqual(M.renderWeeklyDeltaCard().indexOf("Nothing logged") >= 0, true, "empty week has a friendly state");
});
test("weeklyDeltaLog: rows also carry the day's SET target (base + boost) and its own delta", function () {
  M.state.targetHistory = {};
  M.state.settings.calorieTarget = 2000;
  M.state.foodLogs = {
    "2026-07-27": [{ id: "a", macros: { calories: 1700 } }],
    "2026-07-28": [{ id: "b", macros: { calories: 2350 } }],
  };
  // +50g protein boost on the 28th -> that day's SET target is 2000 + 200 = 2200.
  M.state.dayBoosts = { "2026-07-28": { protein: 50, carbs: 0, fat: 0, updatedAt: "2026-07-28T10:00:00.000Z" } };
  const rows = M.weeklyDeltaLog("2026-07-28", 7);
  const d27 = rows.find(function(r){ return r.date === "2026-07-27"; });
  const d28 = rows.find(function(r){ return r.date === "2026-07-28"; });
  assertEqual([d27.dayTarget, d27.dayDelta, d27.boosted], [2000, -300, false], "an unboosted day: set target == base, same delta");
  assertEqual([d28.dayTarget, d28.dayDelta, d28.boosted], [2200, 150, true], "the boosted day is also scored against the target he actually set");
  assertEqual(d28.delta, 350, "while the base-goal scoring is still carried unchanged");
  M.state.dayBoosts = {};
});
test("renderWeeklyDeltaCard: a boosted week shows the ⚡ target column and BOTH running nets", function () {
  M.state.targetHistory = {};
  M.state.settings.calorieTarget = 2000;
  M.state.date = "2026-07-28";
  M.state.foodLogs = {
    "2026-07-27": [{ id: "a", macros: { calories: 1700 } }],
    "2026-07-28": [{ id: "b", macros: { calories: 2350 } }],
  };
  M.state.dayBoosts = { "2026-07-28": { protein: 50, carbs: 0, fat: 0, updatedAt: "2026-07-28T10:00:00.000Z" } };
  const html = M.renderWeeklyDeltaCard();
  assertEqual(html.indexOf("⚡2,200") >= 0, true, "the boosted day's set target is a visible column entry");
  assertEqual(html.indexOf("+150") >= 0, true, "the row's delta is vs that set target, matching what the progress bar said that day");
  assertEqual(html.indexOf("Net vs day targets") >= 0, true, "the running counter vs day targets");
  assertEqual(html.indexOf("Net vs standing goal") >= 0, true, "and the un-boosted yardstick stays on the card");
  assertEqual(html.indexOf("−150") >= 0, true, "day-target net: -300 + 150");
  assertEqual(html.indexOf("+50") >= 0, true, "standing-goal net: -300 + 350");
  M.state.dayBoosts = {};
});
test("renderWeeklyDeltaCard: a boost-free week keeps the single familiar net line", function () {
  M.state.targetHistory = {};
  M.state.dayBoosts = {};
  M.state.settings.calorieTarget = 2000;
  M.state.date = "2026-07-28";
  M.state.foodLogs = { "2026-07-28": [{ id: "a", macros: { calories: 1900 } }] };
  const html = M.renderWeeklyDeltaCard();
  assertEqual(html.indexOf("Net (1 logged day)") >= 0, true, "the familiar single-net label");
  assertEqual(html.indexOf("Net vs standing goal") === -1, true, "no duplicate second line when the two yardsticks are identical");
  assertEqual(html.indexOf("2,000") >= 0, true, "the target column still shows the day's goal");
});

// ==== target history: a past day is scored against the goal that was standing THEN ====
// Reported as: switching from a cut to a bulk made months-old, perfectly on-plan days suddenly
// read as enormous under-eating, because every past day was being measured against the NEW
// target. Every test here resets targetHistory so it can't leak into the suites around it.
function resetTargetHistory() {
  M.state.targetHistory = {};
  M.state.dayBoosts = {};
  M.state.foodLogs = {};
  M.syncTargetBaseline();
}
const TODAY = M.fmtDate(new Date());
test("targetsForDate: with no history recorded, every day falls back to current settings", function () {
  resetTargetHistory();
  M.state.settings.calorieTarget = 1876;
  M.state.settings.proteinTarget = 163;
  assertEqual(M.targetsForDate("2026-01-01").calorieTarget, 1876, "unchanged pre-feature behaviour");
  assertEqual(M.targetsForDate("2026-01-01").proteinTarget, 163, "macros too");
});
test("targetsForDate: picks the most recent change dated on or before the day", function () {
  resetTargetHistory();
  M.state.targetHistory = {
    "2026-03-01": { calorieTarget: 1876, proteinTarget: 163, carbsTarget: 153, fatTarget: 68, updatedAt: "2026-03-01T00:00:00.000Z" },
    "2026-07-15": { calorieTarget: 2800, proteinTarget: 180, carbsTarget: 300, fatTarget: 80, updatedAt: "2026-07-15T00:00:00.000Z" },
  };
  assertEqual(M.targetsForDate("2026-05-10").calorieTarget, 1876, "a day inside the cut uses the cut target");
  assertEqual(M.targetsForDate("2026-07-15").calorieTarget, 2800, "the change applies from its own day forward");
  assertEqual(M.targetsForDate("2026-09-01").calorieTarget, 2800, "and stays in effect after");
  // Set current settings to something unmistakable first: a day older than every recorded
  // change must extend the OLDEST record backwards, never fall through to today's target --
  // that fall-through would be the original bug all over again.
  M.state.settings.calorieTarget = 9999;
  assertEqual(M.targetsForDate("2026-02-01").calorieTarget, 1876, "a day before any entry uses the earliest recorded one, not current settings");
  resetTargetHistory();
});
test("recordTargetChange: does nothing when the targets didn't actually move", function () {
  resetTargetHistory();
  M.state.settings.calorieTarget = 2000;
  M.syncTargetBaseline();
  assertEqual(M.recordTargetChange(), false, "no entry written for an unrelated settings save");
  assertEqual(Object.keys(M.state.targetHistory).length, 0, "history untouched");
});
// The one and only moment the OLD target is still knowable. Without this baseline every past
// day falls through to the NEW target -- exactly the distortion being fixed.
test("recordTargetChange: the first change back-fills a baseline holding the old target", function () {
  resetTargetHistory();
  M.state.foodLogs = { "2026-03-02": [{ id: "a", macros: { calories: 1800 } }], "2026-06-01": [{ id: "b", macros: { calories: 1850 } }] };
  M.state.settings.calorieTarget = 1876;
  M.state.settings.proteinTarget = 163;
  M.syncTargetBaseline();
  M.state.settings.calorieTarget = 2800; // the cut -> bulk switch
  assertEqual(M.recordTargetChange(), true, "a real change is recorded");
  assertEqual(M.state.targetHistory["2026-03-02"].calorieTarget, 1876, "baseline back-filled at the earliest logged day, holding the OLD target");
  assertEqual(M.state.targetHistory[TODAY].calorieTarget, 2800, "and today carries the new one");
  assertEqual(M.targetsForDate("2026-05-10").calorieTarget, 1876, "so a day from the cut still reads against the cut goal");
  assertEqual(M.targetsForDate(TODAY).calorieTarget, 2800, "while today reads against the bulk goal");
  resetTargetHistory();
});
test("recordTargetChange: a second change adds today's entry without disturbing the earlier ones", function () {
  resetTargetHistory();
  M.state.targetHistory = { "2026-03-01": { calorieTarget: 1876, proteinTarget: 163, carbsTarget: 153, fatTarget: 68, updatedAt: "2026-03-01T00:00:00.000Z" } };
  M.state.settings.calorieTarget = 1876;
  M.syncTargetBaseline();
  M.state.settings.calorieTarget = 2400;
  M.recordTargetChange();
  assertEqual(M.state.targetHistory["2026-03-01"].calorieTarget, 1876, "the earlier record is left alone");
  assertEqual(M.state.targetHistory[TODAY].calorieTarget, 2400, "today updated");
  resetTargetHistory();
});
// Typing "2800" fires an inputAction per keystroke; keying by date is what stops "2", "28" and
// "280" being persisted as three separate target changes.
test("recordTargetChange: repeated edits on one day overwrite rather than accumulate", function () {
  resetTargetHistory();
  M.state.settings.calorieTarget = 1876;
  M.syncTargetBaseline();
  [2, 28, 280, 2800].forEach(function (v) { M.state.settings.calorieTarget = v; M.recordTargetChange(); });
  assertEqual(Object.keys(M.state.targetHistory).length, 1, "one entry for today, not four");
  assertEqual(M.state.targetHistory[TODAY].calorieTarget, 2800, "holding the final value");
  resetTargetHistory();
});
test("recordTargetChange: stays inert until boot has established a baseline", function () {
  resetTargetHistory();
  M.syncTargetBaseline();
  const saved = M.targetSnapshotOf(M.state.settings);
  assertEqual(M.sameTargets(saved, M.targetSnapshotOf(M.state.settings)), true, "baseline matches settings after sync");
});
// The actual reported symptom.
test("weeklyDeltaLog: a cut day keeps reading as on-plan after switching to a bulk", function () {
  resetTargetHistory();
  M.state.targetHistory = {
    "2026-03-01": { calorieTarget: 1900, proteinTarget: 163, carbsTarget: 153, fatTarget: 68, updatedAt: "2026-03-01T00:00:00.000Z" },
    "2026-07-26": { calorieTarget: 2800, proteinTarget: 180, carbsTarget: 300, fatTarget: 80, updatedAt: "2026-07-26T00:00:00.000Z" },
  };
  M.state.foodLogs = {
    "2026-07-24": [{ id: "a", macros: { calories: 1880 } }], // a cut day, essentially on target
    "2026-07-28": [{ id: "b", macros: { calories: 2750 } }], // a bulk day, essentially on target
  };
  const rows = M.weeklyDeltaLog("2026-07-28", 7);
  const cutDay = rows.find(function(r){ return r.date === "2026-07-24"; });
  const bulkDay = rows.find(function(r){ return r.date === "2026-07-28"; });
  assertEqual(cutDay.target, 1900, "the cut day is scored against the cut goal");
  assertEqual(cutDay.delta, -20, "so it reads as 20 under, not ~920 under");
  assertEqual(bulkDay.target, 2800, "the bulk day is scored against the bulk goal");
  assertEqual(bulkDay.delta, -50, "50 under");
  resetTargetHistory();
});
test("getDayTargets: the base comes from that day's target, with the day boost still applied on top", function () {
  resetTargetHistory();
  M.state.targetHistory = {
    "2026-03-01": { calorieTarget: 1900, proteinTarget: 160, carbsTarget: 150, fatTarget: 60, updatedAt: "2026-03-01T00:00:00.000Z" },
    "2026-07-26": { calorieTarget: 2800, proteinTarget: 180, carbsTarget: 300, fatTarget: 80, updatedAt: "2026-07-26T00:00:00.000Z" },
  };
  assertEqual(M.getDayTargets("2026-07-24").calorieTarget, 1900, "an old day shows the old goal");
  assertEqual(M.getDayTargets("2026-07-24").proteinTarget, 160, "macros follow too");
  assertEqual(M.getDayTargets("2026-07-28").calorieTarget, 2800, "a recent day shows the current goal");
  M.state.dayBoosts = { "2026-07-24": { protein: 10, carbs: 0, fat: 0, updatedAt: "2026-07-24T10:00:00.000Z" } };
  assertEqual(M.getDayTargets("2026-07-24").calorieTarget, 1940, "boost still stacks on the historical base");
  resetTargetHistory();
});
test("renderWeeklyDeltaCard: names one goal when the week shares it, otherwise says each day's own", function () {
  resetTargetHistory();
  M.state.date = "2026-07-28";
  M.state.settings.calorieTarget = 2000;
  M.state.foodLogs = { "2026-07-28": [{ id: "a", macros: { calories: 1900 } }] };
  assertEqual(M.renderWeeklyDeltaCard().indexOf("vs 2,000 kcal goal") >= 0, true, "single goal named");
  M.state.targetHistory = {
    "2026-03-01": { calorieTarget: 1900, proteinTarget: 1, carbsTarget: 1, fatTarget: 1, updatedAt: "2026-03-01T00:00:00.000Z" },
    "2026-07-26": { calorieTarget: 2800, proteinTarget: 1, carbsTarget: 1, fatTarget: 1, updatedAt: "2026-07-26T00:00:00.000Z" },
  };
  const spanning = M.renderWeeklyDeltaCard();
  assertEqual(spanning.indexOf("each day") >= 0, true, "a week straddling a change refuses to name one number");
  assertEqual(spanning.indexOf("vs 2,800 kcal goal") >= 0, false, "and does not mislabel the older days");
  resetTargetHistory();
});
test("mergeTargetHistoryFromCloud: per-date newer-wins, same rule as day boosts", function () {
  resetTargetHistory();
  M.state.targetHistory = { "2026-07-26": { calorieTarget: 2800, proteinTarget: 1, carbsTarget: 1, fatTarget: 1, updatedAt: "2026-07-26T10:00:00.000Z" } };
  M.mergeTargetHistoryFromCloud({
    "2026-07-26": { calorieTarget: 2900, proteinTarget: 1, carbsTarget: 1, fatTarget: 1, updatedAt: "2026-07-26T12:00:00.000Z" },
    "2026-03-01": { calorieTarget: 1900, proteinTarget: 1, carbsTarget: 1, fatTarget: 1, updatedAt: "2026-03-01T00:00:00.000Z" },
  });
  assertEqual(M.state.targetHistory["2026-07-26"].calorieTarget, 2900, "newer cloud stamp wins");
  assertEqual(M.state.targetHistory["2026-03-01"].calorieTarget, 1900, "a date this device never had is added");
  M.mergeTargetHistoryFromCloud({ "2026-07-26": { calorieTarget: 1, proteinTarget: 1, carbsTarget: 1, fatTarget: 1, updatedAt: "2026-07-26T01:00:00.000Z" } });
  assertEqual(M.state.targetHistory["2026-07-26"].calorieTarget, 2900, "an older cloud stamp does not clobber");
  resetTargetHistory();
});
test("exportSnapshot: carries targetHistory, or a restored backup rescores every past day", function () {
  resetTargetHistory();
  M.state.targetHistory = { "2026-03-01": { calorieTarget: 1900, proteinTarget: 1, carbsTarget: 1, fatTarget: 1, updatedAt: "2026-03-01T00:00:00.000Z" } };
  assertEqual(M.exportSnapshot().targetHistory["2026-03-01"].calorieTarget, 1900, "included in the backup");
  resetTargetHistory();
});
test("renderTargetHistoryBlock: hidden until there is something to show", function () {
  resetTargetHistory();
  assertEqual(M.renderTargetHistoryBlock(), "", "nothing rendered on an untouched install");
  M.state.targetHistory = {
    "2026-03-01": { calorieTarget: 1900, proteinTarget: 1, carbsTarget: 1, fatTarget: 1, updatedAt: "2026-03-01T00:00:00.000Z" },
    "2026-07-26": { calorieTarget: 2800, proteinTarget: 1, carbsTarget: 1, fatTarget: 1, updatedAt: "2026-07-26T00:00:00.000Z" },
  };
  const html = M.renderTargetHistoryBlock();
  assertEqual(html.indexOf("Target History") >= 0, true, "section heading");
  assertEqual(html.indexOf("1,900 kcal") >= 0 && html.indexOf("2,800 kcal") >= 0, true, "both periods listed");
  assertEqual(html.indexOf("now") >= 0, true, "the current period runs to now");
  resetTargetHistory();
});

test("logoSvg: emits a well-formed mark with the gradient and both paths", function () {
  const svg = M.logoSvg(22);
  assertEqual(svg.indexOf('width="22"') >= 0, true, "sized as asked");
  assertEqual((svg.match(/<path /g) || []).length, 2, "ring + M glyph");
  assertEqual(svg.indexOf("linearGradient") >= 0, true, "gradient present");
});

// ============================================================
// SOURCE HYGIENE
// ============================================================
test("index.html contains no stray control bytes", function () {
  // A raw NUL byte once landed in a string literal here. JS accepts it, so node --check and the
  // whole suite passed while git, grep and every text tool reported the file as binary -- and a
  // control byte in the shipped payload is the kind of thing that breaks a CDN, a minifier or an
  // editor much later, far from the change that introduced it. Tab/LF/CR are the only control
  // characters that legitimately appear.
  const src = require("fs").readFileSync(indexPath, "utf8");
  const offenders = [];
  for (let i = 0; i < src.length; i++) {
    const c = src.charCodeAt(i);
    if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) {
      offenders.push({ at: i, code: "0x" + c.toString(16), line: src.slice(0, i).split("\n").length });
      if (offenders.length >= 5) break;
    }
  }
  assertEqual(offenders, [], "no control bytes outside tab/newline/carriage-return");
});

// ============================================================
// KEEPALIVE QUOTA -- the silent weight-sync outage
// ============================================================
// fetch({keepalive:true}) has a hard 64KiB body quota (shared across in-flight keepalive
// requests); exceeding it rejects IMMEDIATELY with no network request -- invisible in server
// logs. The weights push sends the full history (~170KB after a multi-year CSV import), so
// the day keepalive shipped, every weight push started dying client-side while smaller pushes
// kept working. These tests pin the two defences: big bodies never request keepalive, and a
// keepalive rejection is retried once without it.
test("fitsKeepaliveQuota: small bodies qualify, big bodies don't, absent body does", function () {
  assertEqual(M.fitsKeepaliveQuota("{\"a\":1}"), true, "small JSON fits");
  assertEqual(M.fitsKeepaliveQuota(null), true, "no body (GET) always qualifies");
  assertEqual(M.fitsKeepaliveQuota("x".repeat(M.KEEPALIVE_BODY_BUDGET_BYTES + 1)), false, "over budget is excluded");
});
test("utf8ByteLength: counts bytes, not UTF-16 code units", function () {
  assertEqual(M.utf8ByteLength("abc"), 3, "ASCII is 1 byte per char");
  // A char like 'é' is 1 UTF-16 unit but 2 UTF-8 bytes; multibyte content must not sneak a
  // too-large body under the quota by being measured in .length.
  assertEqual(M.utf8ByteLength("é") > 1, true, "multibyte chars measured as bytes");
});
test("the real weights payload shape at 694 rows exceeds the keepalive budget", function () {
  // Reconstructs the outage arithmetic: rows in the exact shape flattenWeightsForSync sends,
  // at the row count the production table held when the sync died.
  M.state.session = { userId: "82a3a1b2-d5ba-4a9b-9cfd-c13ad83d9e26", accessToken: "t", refreshToken: "r", expiresAt: Date.now() + 3600000 };
  M.state.weights = {};
  const d = new Date(2022, 0, 20);
  for (let i = 0; i < 694; i++) {
    const key = M.fmtDate(d);
    M.state.weights[key] = { weight: 180.4, unit: "lbs", timestamp: "2026-07-17T16:49:04.227Z", updatedAt: "2026-07-17T16:49:04.227Z" };
    d.setDate(d.getDate() + 1);
  }
  const body = JSON.stringify(M.flattenWeightsForSync());
  assertEqual(M.fitsKeepaliveQuota(body), false, "the payload that killed the sync is correctly kept off keepalive (" + M.utf8ByteLength(body) + " bytes)");
});

// ==== Fitness Dashboard feed (read-only) ====
const FEED_ROW = {
  date: "2026-08-02", activity_burn_kcal: 670, burn_counted: true,
  base_target_kcal: 1703, boost_kcal: 0, recommended_target_kcal: 2373,
  tdee_kcal: 2849, tdee_low_kcal: 2752, tdee_high_kcal: 2946, tdee_status: "ok",
  updated_at: "2026-08-02T12:00:00.000Z",
};

test("dashboardFeedFor: reads a published day", function () {
  M.state.dashboardFeed = { "2026-08-02": FEED_ROW };
  const f = M.dashboardFeedFor("2026-08-02");
  assertEqual(f.recommended, 2373, "the dashboard's recommended total");
  assertEqual(f.burn, 670, "calibrated activity burn");
  assertEqual(f.tdee, 2849, "rolling measured maintenance");
});

test("dashboardFeedFor: an unpublished day is null, not zeros", function () {
  M.state.dashboardFeed = { "2026-08-02": FEED_ROW };
  assertEqual(M.dashboardFeedFor("2026-07-04"), null, "a day with no row");
  assertEqual(M.dashboardFeedFor("2026-08-02") !== null, true, "control: the published day still reads");
});

test("dashboardFeedFor: a row with no recommendation is null", function () {
  // The dashboard skips days it has no goals for, but a null must never render as "0 kcal".
  M.state.dashboardFeed = { "2026-08-02": Object.assign({}, FEED_ROW, { recommended_target_kcal: null }) };
  assertEqual(M.dashboardFeedFor("2026-08-02"), null, "no recommendation means nothing to show");
});

test("dashboardFeedFor: a gated TDEE is null, never 0", function () {
  M.state.dashboardFeed = { "2026-08-02": Object.assign({}, FEED_ROW, {
    tdee_kcal: null, tdee_low_kcal: null, tdee_high_kcal: null, tdee_status: "insufficient_data" }) };
  const f = M.dashboardFeedFor("2026-08-02");
  assertEqual(f.tdee, null, "an ungated estimate stays absent rather than reading as zero maintenance");
  assertEqual(f.recommended, 2373, "the rest of the row is still usable");
});

test("mergeDashboardFeedFromCloud: keeps rows outside the published window", function () {
  // The dashboard publishes a trailing 14 days. A wholesale replace would drop every older
  // cached row on each sync -- which is why the merge is per-date.
  M.state.dashboardFeed = { "2026-07-01": Object.assign({}, FEED_ROW, { date: "2026-07-01" }) };
  M.mergeDashboardFeedFromCloud([FEED_ROW]);
  assertEqual(Object.keys(M.state.dashboardFeed).sort(), ["2026-07-01", "2026-08-02"], "old row survived a newer window");
});

test("mergeDashboardFeedFromCloud: the cloud copy wins for a date already held", function () {
  M.state.dashboardFeed = { "2026-08-02": Object.assign({}, FEED_ROW, { recommended_target_kcal: 1 }) };
  M.mergeDashboardFeedFromCloud([FEED_ROW]);
  assertEqual(M.dashboardFeedFor("2026-08-02").recommended, 2373, "dashboard is the sole writer, so it is authoritative");
});

test("mergeDashboardFeedFromCloud: an empty or absent pull changes nothing", function () {
  M.state.dashboardFeed = { "2026-08-02": FEED_ROW };
  assertEqual(M.mergeDashboardFeedFromCloud(null), 0, "null pull");
  assertEqual(M.mergeDashboardFeedFromCloud([]), 0, "empty pull");
  assertEqual(M.dashboardFeedFor("2026-08-02").recommended, 2373, "cache intact");
});

test("renderDashboardFeedBlock: renders nothing for an unpublished day", function () {
  M.state.dashboardFeed = {};
  assertEqual(M.renderDashboardFeedBlock("2026-08-02", { calorieTarget: 2000 }), "", "no empty framed block");
});

test("renderDashboardFeedBlock: shows the total, the burn and the maintenance band", function () {
  M.state.dashboardFeed = { "2026-08-02": FEED_ROW };
  const html = M.renderDashboardFeedBlock("2026-08-02", { calorieTarget: 2000 });
  assertEqual(html.indexOf("2,373") > -1, true, "the dashboard's recommended total");
  assertEqual(html.indexOf("670 kcal from activity") > -1, true, "the burn is named");
  assertEqual(html.indexOf("2,752–2,946") > -1, true, "the TDEE uncertainty band is shown, not just the point estimate");
});

test("renderDashboardFeedBlock: says so plainly on a rest day", function () {
  M.state.dashboardFeed = { "2026-08-02": Object.assign({}, FEED_ROW, { activity_burn_kcal: 0, recommended_target_kcal: 1703 }) };
  const html = M.renderDashboardFeedBlock("2026-08-02", { calorieTarget: 1703 });
  assertEqual(html.indexOf("No activity burn logged") > -1, true, "zero burn is a real answer, not missing data");
});

test("renderDashboardFeedBlock: flags a meaningful gap but stays quiet about rounding", function () {
  M.state.dashboardFeed = { "2026-08-02": FEED_ROW };
  const wide = M.renderDashboardFeedBlock("2026-08-02", { calorieTarget: 2000 });
  assertEqual(wide.indexOf("vs your target") > -1, true, "a 373 kcal gap is worth acting on");
  const close = M.renderDashboardFeedBlock("2026-08-02", { calorieTarget: 2360 });
  assertEqual(close.indexOf("vs your target") > -1, false, "a 13 kcal gap is noise, not a finding");
});

test("the feed is SHADOW MODE: it never moves the day's actual targets", function () {
  // The whole safety property of this feature. If getDayTargets ever starts reading the feed,
  // a number Colin never chose is silently driving his calorie goal -- that needs its own
  // switch and its own decision, not to arrive as a side effect of being able to read it.
  M.state.targetHistory = {};
  M.state.dayBoosts = {};
  M.state.settings.calorieTarget = 2000;
  const before = M.getDayTargets("2026-08-02").calorieTarget;
  M.state.dashboardFeed = { "2026-08-02": FEED_ROW };
  assertEqual(M.getDayTargets("2026-08-02").calorieTarget, before, "the published 2,373 does not become the target");
  assertEqual(before, 2000, "control: the target is still MacroLog's own");
});

(async function asyncTailThenExit() {
  const okResponse = function () {
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve([]); } });
  };
  async function atest(name, fn) {
    try { await fn(); } catch (e) { fail++; console.error("FAIL (threw): " + name + "\n  " + (e.stack || e)); }
  }
  M.state.session = { userId: "u", accessToken: "tok", refreshToken: "r", expiresAt: Date.now() + 3600000 };

  await atest("supabaseTable: an oversized body is sent as a normal fetch, not rejected pre-flight", async function () {
    const calls = [];
    sandbox.fetch = function (url, init) { calls.push(init); return okResponse(); };
    const res = await M.supabaseTable("weight_entries?on_conflict=id", { method: "POST", body: [{ big: "x".repeat(M.KEEPALIVE_BODY_BUDGET_BYTES * 2) }] });
    assertEqual(calls.length, 1, "exactly one fetch went out");
    assertEqual(calls[0].keepalive, false, "without keepalive, so the quota can't reject it");
    assertEqual(res.error === undefined, true, "and the push succeeds");
  });

  await atest("supabaseTable: a small body still gets keepalive (the backgrounding protection)", async function () {
    const calls = [];
    sandbox.fetch = function (url, init) { calls.push(init); return okResponse(); };
    await M.supabaseTable("weight_entries?on_conflict=id", { method: "POST", body: [{ small: 1 }] });
    assertEqual(calls[0].keepalive, true, "small pushes keep the survive-teardown property");
  });

  await atest("supabaseTable: a keepalive pre-flight rejection is retried once without keepalive", async function () {
    // The 64KiB quota is SHARED across in-flight keepalive requests, so even a small body can
    // be rejected when several pushes fire together. Nothing was sent, so a retry is safe.
    const calls = [];
    sandbox.fetch = function (url, init) {
      calls.push(init);
      if (init.keepalive) return Promise.reject(new TypeError("Failed to fetch"));
      return okResponse();
    };
    const res = await M.supabaseTable("food_log_entries?on_conflict=id", { method: "POST", body: [{ small: 1 }] });
    assertEqual(calls.length, 2, "retried exactly once");
    assertEqual(calls[0].keepalive, true, "first attempt asked for keepalive");
    assertEqual(calls[1].keepalive, false, "retry dropped it");
    assertEqual(res.error === undefined, true, "and the data still went through");
  });

  await atest("supabaseTable: a genuine network failure still reports an error", async function () {
    sandbox.fetch = function () { return Promise.reject(new TypeError("Failed to fetch")); };
    const res = await M.supabaseTable("weight_entries", {});
    assertEqual(typeof res.error, "string", "offline surfaces as {error}, never a throw");
  });

  await atest("pullAndMergeAll: a broken dashboard_feed pull does NOT abort the sync", async function () {
    // The one way this read-only extra could do real harm. Every other pull is allowed to
    // abort the sync before the push, because pushing on top of a failed pull is the clobber
    // risk. The feed is another app's table -- missing on a fresh project, or briefly 500ing
    // -- and letting it join that guard would silently stop food and weights from syncing.
    const posts = [];
    sandbox.fetch = function (url, init) {
      if (String(url).indexOf("dashboard_feed") > -1) {
        return Promise.resolve({ ok: false, status: 404, json: function () {
          return Promise.resolve({ message: 'relation "public.dashboard_feed" does not exist' }); } });
      }
      if (init && init.method === "POST") posts.push(String(url));
      return okResponse();
    };
    M.state.dashboardFeed = { "2026-08-02": FEED_ROW };
    // Give the food push something to send: it short-circuits on an empty dataset, which
    // would make the assertion below pass vacuously whether the guard works or not.
    M.state.foodLogs = { "2026-08-02": [{ id: "log_1", name: "Test", weight: 100,
      macros: { calories: 200, protein: 10, carbs: 20, fat: 5, fiber: 1 },
      timestamp: "2026-08-02T12:00:00.000Z", updatedAt: "2026-08-02T12:00:00.000Z" }] };

    const res = await M.pullAndMergeAll();

    assertEqual(res.error, undefined, "the sync still reports success");
    assertEqual(posts.some(function (u) { return u.indexOf("food_log_entries") > -1; }), true,
      "and the food push still ran");
    assertEqual(posts.some(function (u) { return u.indexOf("dashboard_feed") > -1; }), false,
      "nothing is ever written back to the dashboard's table");
    assertEqual(M.dashboardFeedFor("2026-08-02").recommended, 2373,
      "the cached row survives a failed pull instead of being blanked");
  });

  await atest("pullAndMergeAll: a successful feed pull is merged into state", async function () {
    sandbox.fetch = function (url) {
      if (String(url).indexOf("dashboard_feed") > -1) {
        return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve([FEED_ROW]); } });
      }
      return okResponse();
    };
    M.state.dashboardFeed = {};
    const res = await M.pullAndMergeAll();
    assertEqual(res.error, undefined, "sync ok");
    assertEqual(M.dashboardFeedFor("2026-08-02").recommended, 2373, "the published row landed");
  });

  // Restore the default no-network stub for anything after us.
  sandbox.fetch = function () { return Promise.reject(new Error("network disabled in tests")); };

  // ==== THE BACKUP CONTRACT ====
  // These are the tests that make "is everything actually backed up?" a fact rather than a
  // memory. They walk PERSISTED_COLLECTIONS and check each entry is wired into every path that
  // has to know about it -- and, crucially, check the reverse direction too: that no persisted
  // key exists in the source WITHOUT being declared. A new collection added without a backup
  // path is the failure this suite is here to catch, and it fails silently in every other way
  // (nothing breaks; the data is just gone the next time he logs in on a new device).
  test("backup contract: the registry is non-empty and its two lists don't overlap", function () {
    assertEqual(M.PERSISTED_COLLECTIONS.length > 0, true, "registry has entries");
    const backed = M.PERSISTED_COLLECTIONS.map(function (c) { return c.key; });
    const overlap = backed.filter(function (k) { return M.NON_BACKED_UP_KEYS.indexOf(k) > -1; });
    assertEqual(overlap, [], "no key is both backed up and exempt");
  });

  test("backup contract: every collection is in exportSnapshot()", function () {
    const snap = M.exportSnapshot();
    M.PERSISTED_COLLECTIONS.forEach(function (c) {
      assertEqual(Object.prototype.hasOwnProperty.call(snap, c.key), true, c.key + " is in the export snapshot");
    });
  });

  test("backup contract: every collection is restored by importData", function () {
    const src = String(M.changeActions.importData);
    M.PERSISTED_COLLECTIONS.forEach(function (c) {
      assertEqual(src.indexOf("data." + c.key) > -1, true, c.key + " is restored on import");
    });
  });

  test("backup contract: every collection is wiped by clearAllData", function () {
    const src = String(M.actions.clearAllData);
    M.PERSISTED_COLLECTIONS.forEach(function (c) {
      assertEqual(src.indexOf("state." + c.key) > -1, true, c.key + " is cleared by Clear All Data");
    });
  });

  test("backup contract: every collection has a real push/pull/merge trio", function () {
    M.PERSISTED_COLLECTIONS.forEach(function (c) {
      [c.push, c.pull, c.merge].forEach(function (fnName) {
        assertEqual(typeof sandbox[fnName], "function", c.key + ": " + fnName + " exists");
      });
    });
  });

  test("backup contract: pullAndMergeAll actually calls each collection's pull and push", function () {
    const src = String(M.pullAndMergeAll);
    M.PERSISTED_COLLECTIONS.forEach(function (c) {
      assertEqual(src.indexOf(c.pull) > -1, true, c.key + ": pulled during a full sync");
      assertEqual(src.indexOf(c.push) > -1, true, c.key + ": pushed during a full sync");
    });
  });

  // The reverse check, and the one that catches a collection added in six months' time: scan
  // the real source for every localStorage key it reads or writes, and require each to be
  // accounted for. Adding db.set("newThing", ...) without registering it fails right here.
  test("backup contract: every persisted localStorage key is declared", function () {
    const declared = M.PERSISTED_COLLECTIONS.map(function (c) { return c.key; }).concat(M.NON_BACKED_UP_KEYS);
    const seen = new Set();
    [...html.matchAll(/db\.(?:get|set)\(\s*"([^"]+)"/g)].forEach(function (m) { seen.add(m[1]); });
    assertEqual(seen.size > 0, true, "the scan found some keys (the regex still matches)");
    [...seen].sort().forEach(function (key) {
      assertEqual(declared.indexOf(key) > -1, true,
        'localStorage key "' + key + '" is declared in PERSISTED_COLLECTIONS or NON_BACKED_UP_KEYS');
    });
  });

  // ==== recipes: newer-wins merge (was additive-only) ====
  // The bug this replaced: a recipe edited on one device could never reach a device that
  // already had it, and that device's blind id-upsert then pushed its stale copy back over the
  // edit -- so the change wasn't just missing on one screen, it was destroyed in the cloud.
  function resetRecipeState() {
    M.state.recipes = [];
    M.savePendingDeletes([]);
    M.recentlyDeletedIds.recipes.clear();
  }
  test("mergeRecipesFromCloud: a newer cloud copy replaces the local one", function () {
    resetRecipeState();
    M.state.recipes.push({ id: "recipe_1", name: "Chili", ingredients: [{ name: "beans", weight: 100 }], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" });
    const n = M.mergeRecipesFromCloud([{ id: "recipe_1", name: "Chili (better)", ingredients: [{ name: "beans", weight: 200 }], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-02-01T00:00:00Z" }]);
    assertEqual(n, 1, "counted as changed");
    assertEqual(M.state.recipes[0].name, "Chili (better)", "the newer name won");
    assertEqual(M.state.recipes[0].ingredients[0].weight, 200, "the newer ingredients won");
    assertEqual(M.state.recipes.length, 1, "replaced in place, not duplicated");
  });
  test("mergeRecipesFromCloud: an older cloud copy does not clobber a local edit", function () {
    resetRecipeState();
    M.state.recipes.push({ id: "recipe_1", name: "Local edit", ingredients: [], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-03-01T00:00:00Z" });
    const n = M.mergeRecipesFromCloud([{ id: "recipe_1", name: "Stale", ingredients: [], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-02-01T00:00:00Z" }]);
    assertEqual(n, 0, "nothing changed");
    assertEqual(M.state.recipes[0].name, "Local edit", "the local edit survived");
  });
  test("mergeRecipesFromCloud: an unstamped cloud copy leaves local alone (backward compatible)", function () {
    resetRecipeState();
    M.state.recipes.push({ id: "recipe_1", name: "Local", ingredients: [] });
    M.mergeRecipesFromCloud([{ id: "recipe_1", name: "Cloud", ingredients: [] }]);
    assertEqual(M.state.recipes[0].name, "Local", "no stamp on either side keeps local, exactly as before");
  });
  test("mergeRecipesFromCloud: a recipe only in the cloud is still added", function () {
    resetRecipeState();
    const n = M.mergeRecipesFromCloud([{ id: "recipe_9", name: "New", ingredients: [], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }]);
    assertEqual(n, 1, "added");
    assertEqual(M.state.recipes[0].name, "New", "the cloud-only recipe arrived");
  });
  test("mergeRecipesFromCloud: a just-deleted recipe is not resurrected", function () {
    resetRecipeState();
    M.markRecentlyDeleted("recipes", "recipe_1");
    M.mergeRecipesFromCloud([{ id: "recipe_1", name: "Zombie", ingredients: [], updated_at: "2030-01-01T00:00:00Z" }]);
    assertEqual(M.state.recipes.length, 0, "tombstone still beats a newer cloud stamp");
    M.recentlyDeletedIds.recipes.clear();
  });
  test("flattenRecipesForSync: sends updated_at so the other device can resolve the conflict", function () {
    resetRecipeState();
    const prevSession = M.state.session;
    M.state.session = { userId: "u1" };
    M.state.recipes.push({ id: "recipe_1", name: "R", ingredients: [], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-05-05T00:00:00Z" });
    const rows = M.flattenRecipesForSync();
    assertEqual(rows[0].updated_at, "2026-05-05T00:00:00Z", "the stamp is in the payload");
    M.state.session = prevSession;
    resetRecipeState();
  });

  // ==== custom barcodes: newer-wins merge (was additive-only) ====
  // Same failure as recipes, with a sharper edge: these rows are what the scanner trusts ahead
  // of Open Food Facts, so a stale one is silently wrong on every future scan of that product.
  // The stamp lives inside the `food` jsonb because the table has no updated_at column.
  function resetBarcodeState() {
    M.state.customBarcodes = {};
    M.savePendingDeletes([]);
    M.recentlyDeletedIds.custom_barcodes.clear();
  }
  test("mergeCustomBarcodesFromCloud: a newer correction replaces the local copy", function () {
    resetBarcodeState();
    M.state.customBarcodes["123"] = { id: "barcode_123", name: "Old", calories: 100, updatedAt: "2026-01-01T00:00:00Z" };
    const n = M.mergeCustomBarcodesFromCloud([{ barcode: "123", food: { id: "barcode_123", name: "Corrected", calories: 240, updatedAt: "2026-02-01T00:00:00Z" } }]);
    assertEqual(n, 1, "counted as changed");
    assertEqual(M.state.customBarcodes["123"].calories, 240, "the correction arrived");
  });
  test("mergeCustomBarcodesFromCloud: an older cloud copy does not clobber a local correction", function () {
    resetBarcodeState();
    M.state.customBarcodes["123"] = { id: "barcode_123", name: "Local fix", calories: 240, updatedAt: "2026-03-01T00:00:00Z" };
    const n = M.mergeCustomBarcodesFromCloud([{ barcode: "123", food: { id: "barcode_123", name: "Stale", calories: 100, updatedAt: "2026-02-01T00:00:00Z" } }]);
    assertEqual(n, 0, "nothing changed");
    assertEqual(M.state.customBarcodes["123"].calories, 240, "the local correction survived");
  });
  test("mergeCustomBarcodesFromCloud: an unstamped cloud copy leaves local alone", function () {
    resetBarcodeState();
    M.state.customBarcodes["123"] = { id: "barcode_123", calories: 240 };
    M.mergeCustomBarcodesFromCloud([{ barcode: "123", food: { id: "barcode_123", calories: 100 } }]);
    assertEqual(M.state.customBarcodes["123"].calories, 240, "no stamp keeps local, exactly as before");
  });
  test("mergeCustomBarcodesFromCloud: a barcode only in the cloud is still added", function () {
    resetBarcodeState();
    const n = M.mergeCustomBarcodesFromCloud([{ barcode: "999", food: { id: "barcode_999", calories: 50 } }]);
    assertEqual(n, 1, "added");
    assertEqual(M.state.customBarcodes["999"].calories, 50, "the cloud-only barcode arrived");
    resetBarcodeState();
  });
  test("saveBarcodeCorrection stamps updatedAt, or the correction can never win a merge", function () {
    resetBarcodeState();
    const prevLogs = M.state.foodLogs, prevDate = M.state.date;
    M.state.date = "2026-08-10";
    M.state.foodLogs = { "2026-08-10": [{
      id: "log_1", foodId: "barcode_555", name: "Bar", source: "Custom Barcode Entry",
      weight: 60, macros: { calories: 250, protein: 20, carbs: 25, fat: 8, fiber: 1 },
    }] };
    M.actions.saveBarcodeCorrection("log_1");
    assertEqual(typeof M.state.customBarcodes["555"].updatedAt, "string", "the saved correction carries a stamp");
    M.state.foodLogs = prevLogs; M.state.date = prevDate;
    resetBarcodeState();
  });

  // ==== hourGroupMacros (per-hour P/C/F on the dashboard log headings) ====
  test("hourGroupMacros: sums calories and the three macros", function () {
    const items = [
      { name: "Rice", foodId: "f1", macros: { calories: 200, protein: 4, carbs: 44, fat: 1 } },
      { name: "Oil", foodId: "f2", macros: { calories: 120, protein: 0, carbs: 0, fat: 14 } },
    ];
    const g = M.hourGroupMacros(items);
    assertEqual([g.calories, g.protein, g.carbs, g.fat], [320, 4, 44, 15], "totals for the hour");
  });
  test("hourGroupMacros: plant protein uses the keyword guess by default", function () {
    const g = M.hourGroupMacros([
      { name: "Chicken Breast", foodId: "a", macros: { calories: 200, protein: 40, carbs: 0, fat: 4 } },
      { name: "Black Beans", foodId: "b", macros: { calories: 120, protein: 8, carbs: 20, fat: 1 } },
    ]);
    assertEqual([g.protein, g.plantProtein], [48, 8], "total protein is all of it; the bracket is the plant share");
  });
  test("hourGroupMacros: an entry's own animalOverride beats the keyword guess", function () {
    // "Chicken-flavoured" seitan: the name says animal, the manual call says plant.
    const g = M.hourGroupMacros([
      { name: "Chicken Style Seitan", foodId: "c", animalOverride: false, macros: { calories: 150, protein: 25, carbs: 5, fat: 2 } },
    ]);
    assertEqual([g.protein, g.plantProtein], [25, 25], "the override is respected, same as getDayTotals");
  });
  test("hourGroupMacros: empty and missing input are zeros, not NaN", function () {
    assertEqual(M.hourGroupMacros([]), { calories: 0, protein: 0, carbs: 0, fat: 0, plantProtein: 0 }, "empty hour");
    assertEqual(M.hourGroupMacros(null), { calories: 0, protein: 0, carbs: 0, fat: 0, plantProtein: 0 }, "null guard");
  });
  test("hourGroupMacros: the hour rows sum to the day's totals", function () {
    const prevLogs = M.state.foodLogs, prevDate = M.state.date, prevCache = M.state.foodCache;
    M.state.foodCache = {};
    M.state.date = "2026-08-10";
    M.state.foodLogs = { "2026-08-10": [
      { id: "1", name: "Eggs", foodId: "e", timestamp: "2026-08-10T08:15:00", macros: { calories: 200, protein: 18, carbs: 2, fat: 14, fiber: 0 } },
      { id: "2", name: "Lentil Soup", foodId: "l", timestamp: "2026-08-10T12:30:00", macros: { calories: 300, protein: 16, carbs: 40, fat: 6, fiber: 9 } },
      { id: "3", name: "Tofu Stir Fry", foodId: "t", timestamp: "2026-08-10T12:50:00", macros: { calories: 400, protein: 22, carbs: 30, fat: 18, fiber: 5 } },
    ] };
    const day = M.getDayTotals("2026-08-10");
    const groups = M.groupEntriesByHourNewestFirst(M.state.foodLogs["2026-08-10"]);
    const summed = groups.reduce(function (a, grp) {
      const g = M.hourGroupMacros(grp.items);
      return { calories: a.calories + g.calories, protein: a.protein + g.protein, carbs: a.carbs + g.carbs, fat: a.fat + g.fat, plantProtein: a.plantProtein + g.plantProtein };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, plantProtein: 0 });
    assertEqual(summed.calories, day.calories, "calories reconcile");
    assertEqual(summed.protein, day.protein, "protein reconciles");
    assertEqual(summed.carbs, day.carbs, "carbs reconcile");
    assertEqual(summed.fat, day.fat, "fat reconciles");
    assertEqual(summed.plantProtein, day.plantProtein, "the plant share reconciles with the Protein bar");
    M.state.foodLogs = prevLogs; M.state.date = prevDate; M.state.foodCache = prevCache;
  });

  // ==== barcodeScanConfirm (the scan-too-fast fix) ====
  // The scanner used to act on the FIRST frame that decoded anything -- the frame most likely
  // to be a misread, because the camera is still focusing. A misread code is a code no database
  // has, which is why it surfaced as "barcode doesn't exist" and why rescanning worked.
  const CMS = M.BARCODE_CONFIRM_MS;
  test("barcodeScanConfirm: a single sighting is never accepted", function () {
    const r = M.barcodeScanConfirm(null, "0123456789012", 1000);
    assertEqual(r.accepted, null, "one frame is not enough");
    assertEqual(r.pending.reads, 1, "but progress is recorded");
  });
  test("barcodeScanConfirm: a second sighting inside the window is still not accepted", function () {
    const a = M.barcodeScanConfirm(null, "X", 1000);
    const b = M.barcodeScanConfirm(a.pending, "X", 1000 + CMS - 1);
    assertEqual(b.accepted, null, "two reads, but they don't span the window yet");
    assertEqual(b.pending.reads, 2, "the read still counted");
  });
  test("barcodeScanConfirm: the same code twice across the window is accepted", function () {
    const a = M.barcodeScanConfirm(null, "X", 1000);
    const b = M.barcodeScanConfirm(a.pending, "X", 1000 + CMS);
    assertEqual(b.accepted, "X", "agreed on by two frames spanning " + CMS + "ms");
  });
  test("barcodeScanConfirm: a disagreeing frame discards the misread and starts over", function () {
    const a = M.barcodeScanConfirm(null, "MISREAD", 1000);
    const b = M.barcodeScanConfirm(a.pending, "REAL", 1030);
    assertEqual(b.accepted, null, "the new code has to earn its own confirmation");
    assertEqual([b.pending.code, b.pending.reads], ["REAL", 1], "progress restarted on the new code");
    const c = M.barcodeScanConfirm(b.pending, "REAL", 1030 + CMS);
    assertEqual(c.accepted, "REAL", "and the real one confirms normally");
  });
  test("barcodeScanConfirm: a frame that reads nothing preserves progress", function () {
    // Otherwise one blurred frame mid-confirmation restarts the count, and on a shaky hand the
    // scanner could take arbitrarily long -- turning a fix for 'too fast' into 'never fires'.
    const a = M.barcodeScanConfirm(null, "X", 1000);
    const blank = M.barcodeScanConfirm(a.pending, null, 1050);
    assertEqual(blank.pending.reads, 1, "the blank frame didn't reset it");
    const c = M.barcodeScanConfirm(blank.pending, "X", 1000 + CMS);
    assertEqual(c.accepted, "X", "confirmation still lands");
  });
  test("barcodeScanConfirm: progress goes stale so an old glimpse can't pair with a fresh read", function () {
    const a = M.barcodeScanConfirm(null, "X", 1000);
    const late = M.barcodeScanConfirm(a.pending, "X", 1000 + M.BARCODE_CONFIRM_STALE_MS + 1);
    assertEqual(late.accepted, null, "too long since the last sighting to count as agreement");
    assertEqual(late.pending.reads, 1, "started over instead");
  });
  test("barcodeScanConfirm: no code and no pending state is a no-op", function () {
    assertEqual(M.barcodeScanConfirm(null, null, 1000), { pending: null, accepted: null }, "idle frame");
  });

  // ==== weightChartHitBands (bigger tap targets on the weight chart) ====
  test("weightChartHitBands: bands are contiguous and cover the whole plot", function () {
    const xs = [40, 100, 300, 450];
    const bands = M.weightChartHitBands(xs, 36, 450);
    assertEqual(bands[0].x, 36, "first band starts at the left edge");
    assertEqual(Math.round(bands[3].x + bands[3].width), 450, "last band ends at the right edge");
    for (let i = 1; i < bands.length; i++) {
      assertClose(bands[i].x, bands[i - 1].x + bands[i - 1].width, 0.001, "no gap between band " + (i - 1) + " and " + i);
    }
  });
  test("weightChartHitBands: every point falls inside its own band", function () {
    const xs = [36, 120, 121, 400, 450];
    const bands = M.weightChartHitBands(xs, 36, 450);
    xs.forEach(function (x, i) {
      const inside = x >= bands[i].x - 0.001 && x <= bands[i].x + bands[i].width + 0.001;
      assertEqual(inside, true, "point " + i + " at x=" + x + " is inside its own band");
    });
  });
  test("weightChartHitBands: a lone point gets the entire plot width", function () {
    assertEqual(M.weightChartHitBands([200], 36, 450), [{ x: 36, width: 414 }], "nothing else to compete with");
  });
  test("weightChartHitBands: a tap anywhere in the plot maps to the nearest point", function () {
    const xs = [40, 140, 240];
    const bands = M.weightChartHitBands(xs, 36, 450);
    const owner = function (x) {
      for (let i = 0; i < bands.length; i++) if (x >= bands[i].x && x <= bands[i].x + bands[i].width) return i;
      return -1;
    };
    assertEqual(owner(36), 0, "far left belongs to the first point");
    assertEqual(owner(89), 0, "just left of the midpoint");
    assertEqual(owner(91), 1, "just right of the midpoint");
    assertEqual(owner(449), 2, "far right belongs to the last point (no dead space)");
  });
  test("renderWeightChart: the tap targets are full-height rects painted after the dots", function () {
    const svg = M.renderWeightChart([{ date: "2026-08-01", weight: 180 }, { date: "2026-08-05", weight: 179 }], 150, "2026-08-05");
    assertEqual(svg.indexOf('<rect') > -1, true, "hit bands are rendered");
    assertEqual(svg.indexOf('data-action="selectWeightPoint"') > -1, true, "and they're tappable");
    assertEqual(svg.indexOf('r="12"') === -1, true, "the old small circular hit area is gone");
    assertEqual(svg.lastIndexOf('<rect') > svg.lastIndexOf('<circle'), true, "rects paint last, so they catch the tap");
  });

  // ==== renderSelectedWeightSlot (the readout above the chart) ====
  // The slot must be the same height in every state -- that's the entire reason it moved above
  // the chart and is always rendered. If any state changes height, the chart shifts under the
  // user's thumb as they tap along the line, which is what this replaced.
  test("renderSelectedWeightSlot: identical height whether or not a point is selected", function () {
    const wu = { timeRange: "30d", confirmDeleteDate: null };
    const empty = M.renderSelectedWeightSlot(null, wu, "lbs");
    const filled = M.renderSelectedWeightSlot({ date: "2026-08-05", weight: 179.4 }, wu, "lbs");
    const confirming = M.renderSelectedWeightSlot({ date: "2026-08-05", weight: 179.4 }, { timeRange: "30d", confirmDeleteDate: "2026-08-05" }, "lbs");
    const heightOf = function (h) { const m = h.match(/height:(\d+)px/); return m ? m[1] : null; };
    assertEqual(heightOf(empty) !== null, true, "the slot declares a fixed height");
    assertEqual(heightOf(filled), heightOf(empty), "selecting a point doesn't move the chart");
    assertEqual(heightOf(confirming), heightOf(empty), "confirming a delete doesn't move it either");
  });
  test("renderSelectedWeightSlot: shows the weight, date and both controls when selected", function () {
    const out = M.renderSelectedWeightSlot({ date: "2026-08-05", weight: 179.4 }, { timeRange: "30d", confirmDeleteDate: null }, "lbs");
    assertEqual(out.indexOf("179.4 lbs") > -1, true, "the weight and unit are shown");
    assertEqual(out.indexOf('data-action="askDeleteWeight"') > -1, true, "delete is still reachable");
    assertEqual(out.indexOf('data-action="selectWeightPoint"') > -1, true, "dismiss is still reachable");
  });
  test("renderSelectedWeightSlot: the All range spells out the year", function () {
    const out = M.renderSelectedWeightSlot({ date: "2024-08-05", weight: 190 }, { timeRange: "all", confirmDeleteDate: null }, "lbs");
    assertEqual(out.indexOf("2024") > -1, true, "a multi-year range needs the year to be unambiguous");
  });

  // ==== Manual Entry -> Save as Recipe ====
  test("saveManualAsRecipe: creates a one-ingredient recipe from what was typed", function () {
    const prevRecipes = M.state.recipes;
    M.state.recipes = [];
    const fu = M.foodUi();
    fu.manual = { name: "Protein Shake", weight: "400", calories: "320", protein: "40", carbs: "20", fat: "8", fiber: "3" };
    fu._recipeSaveLock = 0;
    M.actions.saveManualAsRecipe();
    assertEqual(M.state.recipes.length, 1, "a recipe was saved");
    const r = M.state.recipes[0];
    assertEqual(r.name, "Protein Shake", "named from the food name");
    assertEqual(r.ingredients.length, 1, "one ingredient holding the whole thing");
    assertEqual([r.ingredients[0].weight, r.ingredients[0].calories, r.ingredients[0].protein], [400, 320, 40], "macros carried over as typed");
    assertEqual(typeof r.updatedAt, "string", "stamped for the newer-wins merge");
    M.state.recipes = prevRecipes;
  });
  test("saveManualAsRecipe: refuses to save an unnamed recipe", function () {
    const prevRecipes = M.state.recipes;
    M.state.recipes = [];
    const fu = M.foodUi();
    fu.manual = { name: "   ", weight: "100", calories: "50", protein: "1", carbs: "1", fat: "1", fiber: "0" };
    fu._recipeSaveLock = 0;
    M.actions.saveManualAsRecipe();
    assertEqual(M.state.recipes.length, 0, "a nameless recipe could never be found again");
    M.state.recipes = prevRecipes;
  });
  test("saveManualAsRecipe: does not log anything to today", function () {
    const prevRecipes = M.state.recipes, prevLogs = M.state.foodLogs, prevDate = M.state.date;
    M.state.recipes = []; M.state.foodLogs = {}; M.state.date = "2026-08-10";
    const fu = M.foodUi();
    fu.manual = { name: "Chili", weight: "500", calories: "600", protein: "30", carbs: "60", fat: "20", fiber: "12" };
    fu._recipeSaveLock = 0;
    M.actions.saveManualAsRecipe();
    assertEqual(M.state.recipes.length, 1, "the recipe was saved");
    assertEqual((M.state.foodLogs["2026-08-10"] || []).length, 0, "saving a definition is not eating it");
    M.state.recipes = prevRecipes; M.state.foodLogs = prevLogs; M.state.date = prevDate;
  });
  test("saveManualAsRecipe: double-tap doesn't create two recipes", function () {
    const prevRecipes = M.state.recipes;
    M.state.recipes = [];
    const fu = M.foodUi();
    fu.manual = { name: "Oats", weight: "80", calories: "300", protein: "10", carbs: "54", fat: "5", fiber: "8" };
    fu._recipeSaveLock = 0;
    M.actions.saveManualAsRecipe();
    M.actions.saveManualAsRecipe();
    assertEqual(M.state.recipes.length, 1, "the 600ms lock held");
    M.state.recipes = prevRecipes;
  });
  test("renderManualEntryScreen: offers Save as Recipe alongside Add to Log", function () {
    const fu = M.foodUi();
    fu.manual = { name: "", weight: "100", calories: "", protein: "", carbs: "", fat: "", fiber: "" };
    const out = M.renderManualEntryScreen(fu);
    assertEqual(out.indexOf('data-action="saveManualAsRecipe"') > -1, true, "the button is on the screen");
    assertEqual(out.indexOf('data-action="addManualEntry"') > -1, true, "and logging still is too");
  });

  // ==== weight chart: manual range + panning ====
  test("weightRangeDays: named chips, the manual count, and the unbounded cases", function () {
    assertEqual(M.weightRangeDays("7d", 0), 7, "7d");
    assertEqual(M.weightRangeDays("6m", 0), 180, "6m");
    assertEqual(M.weightRangeDays("all", 0), null, "All is unbounded");
    assertEqual(M.weightRangeDays("manual", 45), 45, "manual uses the applied day count");
    assertEqual(M.weightRangeDays("manual", "45"), 45, "a string count still parses");
    assertEqual(M.weightRangeDays("manual", 1), null, "a 1-day chart is meaningless");
    assertEqual(M.weightRangeDays("manual", 0), null, "unconfigured Manual behaves like All, not a guess");
  });
  test("weightChartWindowBounds: 7d spans exactly 7 calendar days ending on the viewed day", function () {
    const b = M.weightChartWindowBounds("7d", 0, 0, "2026-08-13");
    assertEqual(b.startMs, new Date(2026, 7, 7).getTime(), "starts 6 days back at local midnight");
    assertEqual(b.endMs, new Date(2026, 7, 13).getTime(), "ends on the viewed day itself");
  });
  test("weightChartWindowBounds: the pan offset slides the whole window back, both ends", function () {
    const b = M.weightChartWindowBounds("7d", 0, 7, "2026-08-13");
    assertEqual(b.startMs, new Date(2026, 6, 31).getTime(), "start moved back a week");
    assertEqual(b.endMs, new Date(2026, 7, 6).getTime(), "end moved back a week too -- newer entries drop out");
  });
  test("weightChartWindowBounds: manual uses the entered day count", function () {
    const b = M.weightChartWindowBounds("manual", 14, 0, "2026-08-13");
    assertEqual(b.startMs, new Date(2026, 6, 31).getTime(), "14 calendar days inclusive of the end day");
  });
  test("weightChartWindowBounds: unbounded ranges admit everything, pan or no pan", function () {
    const b = M.weightChartWindowBounds("all", 0, 5, "2026-08-13");
    assertEqual(b.startMs, 0, "no lower bound");
    assertEqual(b.endMs === Infinity, true, "no upper bound");
  });
  test("weightChartCutoff: still the un-panned window's start, so its old callers keep working", function () {
    assertEqual(M.weightChartCutoff("30d", "2026-08-13"), M.weightChartWindowBounds("30d", 0, 0, "2026-08-13").startMs, "named range");
    assertEqual(M.weightChartCutoff("all", "2026-08-13"), 0, "All admits everything");
  });
  test("clampWeightPanOffset: bounded below by 0 and above by the data span", function () {
    // Jul 1 -> Aug 13 is a 43-day span; a 7-day window can therefore sit at most 37 days back
    // (earliest weigh-in at the window's left edge) before it shows guaranteed-empty space.
    assertEqual(M.clampWeightPanOffset(100, 7, "2026-07-01", "2026-08-13"), 37, "clamped to the far limit");
    assertEqual(M.clampWeightPanOffset(Infinity, 7, "2026-07-01", "2026-08-13"), 37, "Infinity asks for the far limit exactly");
    assertEqual(M.clampWeightPanOffset(-5, 7, "2026-07-01", "2026-08-13"), 0, "never negative");
    assertEqual(M.clampWeightPanOffset(10, 7, "2026-07-01", "2026-08-13"), 10, "an in-range offset passes through");
    assertEqual(M.clampWeightPanOffset(9, null, "2026-07-01", "2026-08-13"), 0, "an unbounded range can't pan");
    assertEqual(M.clampWeightPanOffset(9, 7, null, "2026-08-13"), 0, "no data, no pan");
  });
  test("weightStatsRangeLabel: manual reads as its day count", function () {
    assertEqual(M.weightStatsRangeLabel("manual", 45), "last 45 days", "manual with a count");
    assertEqual(M.weightStatsRangeLabel("30d"), "last 30 days", "named chips unchanged");
  });
  test("renderWeightTab: six chips on one line ending in Manual, pan strip, swipeable chart", function () {
    const prevWeights = M.state.weights, prevUi = M.state.ui, prevDate = M.state.date;
    M.state.date = "2026-08-13";
    M.state.weights = {
      "2026-06-01": { weight: 185, unit: "lbs", timestamp: "2026-06-01T08:00:00.000Z" },
      "2026-08-01": { weight: 181, unit: "lbs", timestamp: "2026-08-01T08:00:00.000Z" },
      "2026-08-10": { weight: 180, unit: "lbs", timestamp: "2026-08-10T08:00:00.000Z" },
    };
    M.state.ui = {};
    const out = M.renderWeightTab();
    const chipOrder = out.indexOf('data-arg="all"') < out.indexOf('data-action="openManualRange"');
    assertEqual(out.indexOf('data-action="openManualRange"') > -1, true, "the Manual chip exists");
    assertEqual(chipOrder, true, "and sits to the right of All");
    assertEqual(out.indexOf(">Manual<") > -1, true, "labelled Manual while inactive");
    assertEqual(out.indexOf('data-action="panWeightChart"') > -1, true, "pan strip present for a bounded range");
    assertEqual(out.indexOf('data-panzone="weight"') > -1, true, "the chart is a swipe target");
    M.state.weights = prevWeights; M.state.ui = prevUi; M.state.date = prevDate;
  });
  test("applyManualRange: applies a valid day count, rejects a useless one", function () {
    const prevWeights = M.state.weights, prevUi = M.state.ui, prevDate = M.state.date;
    M.state.date = "2026-08-13";
    M.state.weights = {
      "2026-08-01": { weight: 181, unit: "lbs", timestamp: "2026-08-01T08:00:00.000Z" },
      "2026-08-10": { weight: 180, unit: "lbs", timestamp: "2026-08-10T08:00:00.000Z" },
    };
    M.state.ui = {};
    M.actions.openManualRange();
    const wu = M.state.ui.weight;
    assertEqual(wu.showManualPanel, true, "the chip opens the popup");
    wu.manualDaysInput = "45";
    M.actions.applyManualRange();
    assertEqual([wu.timeRange, wu.manualDays, wu.showManualPanel], ["manual", 45, false], "applied and closed");
    assertEqual(wu.panOffsetDays, 0, "re-anchored to the latest weigh-in");
    assertEqual(M.renderWeightTab().indexOf(">45d<") > -1, true, "the active chip shows its day count");
    wu.manualDaysInput = "1";
    M.actions.applyManualRange();
    assertEqual(wu.manualDays, 45, "a 1-day request is refused, the applied count stands");
    M.state.weights = prevWeights; M.state.ui = prevUi; M.state.date = prevDate;
  });
  test("renderWeightTab: panning into a gap keeps the card, with a placeholder instead of a dead end", function () {
    const prevWeights = M.state.weights, prevUi = M.state.ui, prevDate = M.state.date;
    M.state.date = "2026-08-13";
    M.state.weights = {
      "2026-06-01": { weight: 185, unit: "lbs", timestamp: "2026-06-01T08:00:00.000Z" },
      "2026-08-10": { weight: 180, unit: "lbs", timestamp: "2026-08-10T08:00:00.000Z" },
      "2026-08-12": { weight: 179.5, unit: "lbs", timestamp: "2026-08-12T08:00:00.000Z" },
    };
    M.state.ui = { weight: { input: "", timeRange: "7d", importMsg: "", editingStart: false, startInputDate: "", startInputWeight: "", selectedPoint: null, confirmDeleteDate: null, statsFollowsRange: false, manualDays: 0, manualDaysInput: "", showManualPanel: false, panOffsetDays: 30 } };
    const out = M.renderWeightTab();
    assertEqual(out.indexOf("No weigh-ins in this window") > -1, true, "empty window says so");
    assertEqual(out.indexOf('data-action="panWeightChart"') > -1, true, "and the pan controls are still there to get back");
    M.state.weights = prevWeights; M.state.ui = prevUi; M.state.date = prevDate;
  });

  // ==== weight chart: 7-day trend line ====
  test("weightTrendSeries: trailing 7-calendar-day average over dense daily data", function () {
    const data = [];
    for (let i = 1; i <= 10; i++) data.push({ date: "2026-08-" + String(i).padStart(2, "0"), weight: i });
    const trend = M.weightTrendSeries(data, data.map(function (p) { return p.date; }));
    assertEqual(trend[0], 1, "first day averages only itself");
    assertEqual(trend[3], 2.5, "day 4 averages days 1-4");
    assertEqual(trend[6], 4, "day 7 averages the full first week (1..7)");
    assertEqual(trend[9], 7, "day 10 averages days 4-10 -- the window slides");
  });
  test("weightTrendSeries: a logging gap averages fewer points, never reaches further back", function () {
    const data = [{ date: "2026-07-01", weight: 180 }, { date: "2026-07-20", weight: 170 }, { date: "2026-07-22", weight: 172 }];
    const trend = M.weightTrendSeries(data, ["2026-07-20", "2026-07-22"]);
    assertEqual(trend[0], 170, "Jul 20's window holds only itself -- Jul 1 is 19 days out, not 'the previous point'");
    assertEqual(trend[1], 171, "Jul 22 averages Jul 20 + Jul 22");
  });
  test("weightTrendSeries: history outside the charted window still feeds the trend", function () {
    // A 7d chart window showing only Aug 8-10 must not pretend Aug 4-7 weigh-ins don't exist.
    const all = [];
    ["2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09", "2026-08-10"].forEach(function (d, i) {
      all.push({ date: d, weight: 160 - i }); // 160..154
    });
    const trend = M.weightTrendSeries(all, ["2026-08-08", "2026-08-09", "2026-08-10"]);
    assertEqual(trend[0], 158, "Aug 8 averages Aug 4-8 (160+159+158+157+156)/5, using pre-window history");
    assertEqual(trend[2], 157, "Aug 10 averages the full week");
  });
  test("renderWeightChart: draws the trend path, with NO text label on the line", function () {
    const data = [{ date: "2026-08-01", weight: 180 }, { date: "2026-08-05", weight: 179 }, { date: "2026-08-09", weight: 178 }];
    const withTrend = M.renderWeightChart(data, null, null, [180, 179.5, 179]);
    assertEqual(withTrend.indexOf("#A855F7") > -1, true, "the violet trend path is drawn");
    assertEqual(withTrend.indexOf("7d trend"), -1, "no label -- it overlapped the line (the slot readout identifies it instead)");
    const withoutTrend = M.renderWeightChart(data, null, null);
    assertEqual(withoutTrend.indexOf("#A855F7"), -1, "omitting trend values draws no trend");
    const lonePoint = M.renderWeightChart([data[0]], null, null, [180]);
    assertEqual(lonePoint.indexOf("#A855F7"), -1, "a single point gets no trend line");
  });
  test("renderWeightTab: the chart carries the 7-day trend", function () {
    const prevWeights = M.state.weights, prevUi = M.state.ui, prevDate = M.state.date;
    M.state.date = "2026-08-13";
    M.state.weights = {
      "2026-08-01": { weight: 181, unit: "lbs", timestamp: "2026-08-01T08:00:00.000Z" },
      "2026-08-10": { weight: 180, unit: "lbs", timestamp: "2026-08-10T08:00:00.000Z" },
      "2026-08-12": { weight: 179.5, unit: "lbs", timestamp: "2026-08-12T08:00:00.000Z" },
    };
    M.state.ui = {};
    assertEqual(M.renderWeightTab().indexOf("#A855F7") > -1, true, "trend line rendered from the tab");
    M.state.weights = prevWeights; M.state.ui = prevUi; M.state.date = prevDate;
  });
  test("weightTrendReadout: the tapped day's 7-day average, and its change vs a week earlier", function () {
    const data = [];
    for (let i = 1; i <= 14; i++) data.push({ date: "2026-08-" + String(i).padStart(2, "0"), weight: 168 - i }); // 167 down to 154
    const r = M.weightTrendReadout(data, "2026-08-14");
    assertEqual(r.avg, 157, "average of Aug 8-14 (160..154)");
    assertEqual(r.change, -7, "vs the Aug 1-7 average (164..160) -- steady 1lb/day shows as -7/week");
    const early = M.weightTrendReadout(data, "2026-08-03");
    assertEqual(early.avg, 166, "first-week average still reads (Aug 1-3: 167,166,165)");
    assertEqual(early.change, null, "but has no earlier week to compare against");
    assertEqual(M.weightTrendReadout(data, "2027-01-01"), null, "a date with no weigh-ins within 7 days has no readout");
  });
  test("renderSelectedWeightSlot: the tap readout shows day weight AND the 7d trend, same height as ever", function () {
    const wu = { timeRange: "30d", confirmDeleteDate: null };
    const sel = { date: "2026-08-14", weight: 154 };
    const withTrend = M.renderSelectedWeightSlot(sel, wu, "lbs", { avg: 157, change: -1.6 });
    assertEqual(withTrend.indexOf("154 lbs") > -1, true, "the day's own weight");
    assertEqual(withTrend.indexOf("7d avg 157") > -1, true, "the trend average through that day");
    assertEqual(withTrend.indexOf("−1.6 in 7d") > -1 || withTrend.indexOf("-1.6 in 7d") > -1, true, "and the week's smoothed change");
    const firstWeek = M.renderSelectedWeightSlot(sel, wu, "lbs", { avg: 157, change: null });
    assertEqual(firstWeek.indexOf("in 7d"), -1, "no change shown when history has no prior week");
    const heightOf = function (h) { const m = h.match(/height:(\d+)px/); return m ? m[1] : null; };
    assertEqual(heightOf(withTrend), heightOf(M.renderSelectedWeightSlot(null, wu, "lbs")), "the slot stays fixed-height -- the chart must not shift");
  });

  // ==== waist measurements (Strategy > Waist & Photos) ====
  test("waistEntryIsEmpty: tombstones are empty, anything real is not", function () {
    assertEqual(M.waistEntryIsEmpty(null), true, "missing entry");
    assertEqual(M.waistEntryIsEmpty({ waist: null, notes: "", photos: [], updatedAt: "2026-08-13T00:00:00.000Z" }), true, "the delete tombstone");
    assertEqual(M.waistEntryIsEmpty({ waist: 34.5, notes: "", photos: [] }), false, "a measurement");
    assertEqual(M.waistEntryIsEmpty({ waist: null, notes: "note", photos: [] }), false, "a notes-only entry");
    assertEqual(M.waistEntryIsEmpty({ waist: null, notes: "", photos: ["data:image/jpeg;base64,x"] }), false, "a photos-only entry");
  });
  test("mergeWaistEntriesFromCloud: adds new dates, and a newer cloud edit wins", function () {
    const prev = M.state.waistEntries;
    M.state.waistEntries = { "2026-08-01": { waist: 35, notes: "", photos: [], updatedAt: "2026-08-01T00:00:00.000Z" } };
    const changed = M.mergeWaistEntriesFromCloud({
      "2026-08-01": { waist: 34.5, notes: "corrected", photos: [], updatedAt: "2026-08-02T00:00:00.000Z" },
      "2026-08-05": { waist: 34, notes: "", photos: [], updatedAt: "2026-08-05T00:00:00.000Z" },
    });
    assertEqual(changed, 2, "both rows applied");
    assertEqual(M.state.waistEntries["2026-08-01"].waist, 34.5, "the newer cloud edit reached this device");
    assertEqual(M.state.waistEntries["2026-08-05"].waist, 34, "the new date was added");
    M.state.waistEntries = prev;
  });
  test("mergeWaistEntriesFromCloud: an older cloud copy never overwrites a newer local edit", function () {
    const prev = M.state.waistEntries;
    M.state.waistEntries = { "2026-08-01": { waist: 34, notes: "fixed here", photos: [], updatedAt: "2026-08-03T00:00:00.000Z" } };
    const changed = M.mergeWaistEntriesFromCloud({ "2026-08-01": { waist: 35, notes: "", photos: [], updatedAt: "2026-08-01T00:00:00.000Z" } });
    assertEqual(changed, 0, "nothing applied");
    assertEqual(M.state.waistEntries["2026-08-01"].waist, 34, "local edit kept");
    M.state.waistEntries = prev;
  });
  test("mergeWaistEntriesFromCloud: a newer tombstone carries a delete across devices", function () {
    const prev = M.state.waistEntries;
    M.state.waistEntries = { "2026-08-01": { waist: 35, notes: "", photos: ["data:image/jpeg;base64,x"], updatedAt: "2026-08-01T00:00:00.000Z" } };
    M.mergeWaistEntriesFromCloud({ "2026-08-01": { waist: null, notes: "", photos: [], updatedAt: "2026-08-02T00:00:00.000Z" } });
    assertEqual(M.waistEntryIsEmpty(M.state.waistEntries["2026-08-01"]), true, "the delete made on the other device lands here");
    M.state.waistEntries = prev;
  });
  await atest("saveWaistEntry: writes a stamped entry and clears the form (no photos = fully offline)", async function () {
    const prevWaist = M.state.waistEntries, prevUi = M.state.ui;
    M.state.waistEntries = {};
    M.state.ui = { strategy: { section: "waist", waistDate: "2026-08-01", waistInput: "34.5", waistNotes: "  feeling leaner  ", waistPhotos: [], waistEditingDate: null, confirmDeleteWaistDate: null, viewingPhoto: null, waistSaving: false } };
    await M.actions.saveWaistEntry();
    const e = M.state.waistEntries["2026-08-01"];
    assertEqual(e.waist, 34.5, "the measurement was saved");
    assertEqual(e.notes, "feeling leaner", "notes saved trimmed");
    assertEqual(typeof e.updatedAt, "string", "stamped, or the merge can never propagate it");
    assertEqual(M.state.ui.strategy.waistInput, "", "the form cleared for the next entry");
    M.state.waistEntries = prevWaist; M.state.ui = prevUi;
  });
  await atest("saveWaistEntry: an all-empty form saves nothing", async function () {
    const prevWaist = M.state.waistEntries, prevUi = M.state.ui;
    M.state.waistEntries = {};
    M.state.ui = { strategy: { section: "waist", waistDate: "2026-08-01", waistInput: "", waistNotes: "   ", waistPhotos: [], waistEditingDate: null, confirmDeleteWaistDate: null, viewingPhoto: null, waistSaving: false } };
    await M.actions.saveWaistEntry();
    assertEqual(Object.keys(M.state.waistEntries).length, 0, "no empty entry was created");
    M.state.waistEntries = prevWaist; M.state.ui = prevUi;
  });
  await atest("saveWaistEntry: correcting the date while editing tombstones the old date", async function () {
    const prevWaist = M.state.waistEntries, prevUi = M.state.ui;
    M.state.waistEntries = { "2026-08-01": { waist: 35, notes: "", photos: [], updatedAt: "2026-08-01T00:00:00.000Z" } };
    M.state.ui = {};
    M.actions.editWaistEntry("2026-08-01");
    M.state.ui.strategy.waistDate = "2026-08-02";
    await M.actions.saveWaistEntry();
    assertEqual(M.state.waistEntries["2026-08-02"].waist, 35, "the entry moved to the corrected date");
    assertEqual(M.waistEntryIsEmpty(M.state.waistEntries["2026-08-01"]), true, "the old date holds a tombstone");
    assertEqual(typeof M.state.waistEntries["2026-08-01"].updatedAt, "string", "stamped, so the move wins the merge on other devices");
    M.state.waistEntries = prevWaist; M.state.ui = prevUi;
  });

  // ==== progress photo FILES (Supabase Storage) ====
  test("isPendingWaistPhoto: data URLs are pending, storage paths are not", function () {
    assertEqual(M.isPendingWaistPhoto("data:image/jpeg;base64,AAAA"), true, "an un-uploaded form photo");
    assertEqual(M.isPendingWaistPhoto("u1/2026-08-13-abc.jpg"), false, "an uploaded file's path");
  });
  test("progressPhotoPathsInEntries: collects only real storage paths", function () {
    const paths = M.progressPhotoPathsInEntries({
      "2026-08-01": { waist: 35, photos: ["u1/a.jpg", "data:image/jpeg;base64,AAAA"] },
      "2026-08-02": { waist: null, notes: "", photos: [], updatedAt: "x" }, // tombstone
      "2026-08-03": { waist: 34, photos: ["u1/b.jpg"] },
    });
    assertEqual(paths, ["u1/a.jpg", "u1/b.jpg"], "paths only -- pending data URLs and tombstones contribute nothing");
  });
  test("rewriteProgressPhotoPath: swaps the account folder, keeps the filename", function () {
    assertEqual(M.rewriteProgressPhotoPath("old-uid/2026-08-13-x.jpg", "new-uid"), "new-uid/2026-08-13-x.jpg", "cross-account restore lands in the importer's own folder");
  });
  await atest("saveWaistEntry: uploads pending photos to Storage and stores their PATHS, never bytes", async function () {
    const prevWaist = M.state.waistEntries, prevUi = M.state.ui, prevSession = M.state.session;
    M.state.waistEntries = {};
    M.state.session = { userId: "u1", accessToken: "tok", refreshToken: "r", expiresAt: Date.now() + 3600000 };
    const calls = [];
    sandbox.fetch = function (url, init) {
      calls.push({ url: String(url), init: init || {} });
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } });
    };
    M.state.ui = { strategy: { section: "waist", waistDate: "2026-08-13", waistInput: "34", waistNotes: "", waistPhotos: ["data:image/jpeg;base64,AAAA"], waistEditingDate: null, confirmDeleteWaistDate: null, viewingPhoto: null, waistSaving: false } };
    await M.actions.saveWaistEntry();
    const e = M.state.waistEntries["2026-08-13"];
    assertEqual(e.photos.length, 1, "one photo on the entry");
    assertEqual(e.photos[0].indexOf("u1/2026-08-13-") === 0, true, "stored as a storage path in the user's own folder");
    assertEqual(e.photos[0].indexOf("data:"), -1, "no image bytes anywhere in the entry");
    const upload = calls.find(function (c) { return c.url.indexOf("/storage/v1/object/progress-photos/u1/") > -1 && c.init.method === "POST"; });
    assertEqual(!!upload, true, "uploaded to the progress-photos bucket");
    assertEqual(upload.init.headers["x-upsert"], "true", "upsert, so a retried save can't fail on already-exists");
    sandbox.fetch = function () { return Promise.reject(new Error("network disabled in tests")); };
    M.state.waistEntries = prevWaist; M.state.ui = prevUi; M.state.session = prevSession;
  });
  await atest("saveWaistEntry: refuses pending photos while signed out, keeping the form", async function () {
    const prevWaist = M.state.waistEntries, prevUi = M.state.ui, prevSession = M.state.session;
    M.state.waistEntries = {};
    M.state.session = null;
    M.state.ui = { strategy: { section: "waist", waistDate: "2026-08-13", waistInput: "34", waistNotes: "", waistPhotos: ["data:image/jpeg;base64,AAAA"], waistEditingDate: null, confirmDeleteWaistDate: null, viewingPhoto: null, waistSaving: false } };
    await M.actions.saveWaistEntry();
    assertEqual(Object.keys(M.state.waistEntries).length, 0, "nothing saved -- an entry must never reference a file that was never uploaded");
    assertEqual(M.state.ui.strategy.waistPhotos.length, 1, "the form keeps the photo for a retry");
    assertEqual(M.state.ui.strategy.waistInput, "34", "and the rest of the form too");
    M.state.waistEntries = prevWaist; M.state.ui = prevUi; M.state.session = prevSession;
  });
  await atest("saveWaistEntry: a failed upload aborts the whole save with the form intact", async function () {
    const prevWaist = M.state.waistEntries, prevUi = M.state.ui, prevSession = M.state.session;
    M.state.waistEntries = {};
    M.state.session = { userId: "u1", accessToken: "tok", refreshToken: "r", expiresAt: Date.now() + 3600000 };
    sandbox.fetch = function () {
      return Promise.resolve({ ok: false, status: 500, json: function () { return Promise.resolve({ message: "storage down" }); } });
    };
    M.state.ui = { strategy: { section: "waist", waistDate: "2026-08-13", waistInput: "34", waistNotes: "", waistPhotos: ["data:image/jpeg;base64,AAAA"], waistEditingDate: null, confirmDeleteWaistDate: null, viewingPhoto: null, waistSaving: false } };
    await M.actions.saveWaistEntry();
    assertEqual(Object.keys(M.state.waistEntries).length, 0, "no entry written on upload failure");
    assertEqual(M.state.ui.strategy.waistPhotos.length, 1, "the form keeps everything for a retry");
    assertEqual(M.state.ui.strategy.waistSaving, false, "the saving flag is released");
    sandbox.fetch = function () { return Promise.reject(new Error("network disabled in tests")); };
    M.state.waistEntries = prevWaist; M.state.ui = prevUi; M.state.session = prevSession;
  });
  await atest("editing an entry and removing a photo deletes its file on save -- and only its file", async function () {
    const prevWaist = M.state.waistEntries, prevUi = M.state.ui, prevSession = M.state.session;
    M.state.waistEntries = { "2026-08-10": { waist: 34, notes: "", photos: ["u1/a.jpg", "u1/b.jpg"], updatedAt: "2026-08-10T00:00:00.000Z" } };
    M.state.session = { userId: "u1", accessToken: "tok", refreshToken: "r", expiresAt: Date.now() + 3600000 };
    const calls = [];
    sandbox.fetch = function (url, init) {
      calls.push({ url: String(url), init: init || {} });
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } });
    };
    M.state.ui = {};
    M.actions.editWaistEntry("2026-08-10");
    M.state.ui.strategy.waistPhotos = ["u1/a.jpg"]; // removed b
    await M.actions.saveWaistEntry();
    await new Promise(function (r) { setTimeout(r, 0); }); // the file delete is fire-and-forget
    assertEqual(M.state.waistEntries["2026-08-10"].photos, ["u1/a.jpg"], "the entry keeps the remaining photo");
    const del = calls.find(function (c) { return c.init.method === "DELETE" && c.url.indexOf("/storage/v1/object/progress-photos") > -1; });
    assertEqual(!!del, true, "a storage delete went out");
    assertEqual(String(del.init.body).indexOf("u1/b.jpg") > -1, true, "for the removed photo");
    assertEqual(String(del.init.body).indexOf("u1/a.jpg"), -1, "and not the kept one");
    sandbox.fetch = function () { return Promise.reject(new Error("network disabled in tests")); };
    M.state.waistEntries = prevWaist; M.state.ui = prevUi; M.state.session = prevSession;
  });
  await atest("deleteWaistEntry: the entry's photo files are deleted with it", async function () {
    const prevWaist = M.state.waistEntries, prevUi = M.state.ui, prevSession = M.state.session;
    M.state.waistEntries = { "2026-08-05": { waist: 34, notes: "", photos: ["u1/gone.jpg"], updatedAt: "2026-08-05T00:00:00.000Z" } };
    M.state.session = { userId: "u1", accessToken: "tok", refreshToken: "r", expiresAt: Date.now() + 3600000 };
    const calls = [];
    sandbox.fetch = function (url, init) {
      calls.push({ url: String(url), init: init || {} });
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } });
    };
    M.state.ui = {};
    M.actions.deleteWaistEntry("2026-08-05");
    await new Promise(function (r) { setTimeout(r, 0); });
    assertEqual(M.waistEntryIsEmpty(M.state.waistEntries["2026-08-05"]), true, "the entry is tombstoned");
    const del = calls.find(function (c) { return c.init.method === "DELETE" && c.url.indexOf("/storage/v1/object/progress-photos") > -1; });
    assertEqual(!!del && String(del.init.body).indexOf("u1/gone.jpg") > -1, true, "and its file was deleted from storage");
    sandbox.fetch = function () { return Promise.reject(new Error("network disabled in tests")); };
    M.state.waistEntries = prevWaist; M.state.ui = prevUi; M.state.session = prevSession;
  });
  test("the export/import/clear paths all know about the photo files (source contract)", function () {
    assertEqual(String(M.actions.exportData).indexOf("waistPhotoData") > -1, true, "export inlines the photo bytes -- paths alone are not a backup");
    assertEqual(String(M.changeActions.importData).indexOf("waistPhotoData") > -1, true, "import puts them back into storage");
    assertEqual(String(M.actions.clearAllData).indexOf("listProgressPhotoPaths") > -1, true, "Clear All Data wipes the storage folder too");
  });
  test("renderWaistSection: a storage-path photo renders through the authenticated loader", function () {
    const prevWaist = M.state.waistEntries, prevUi = M.state.ui, prevSession = M.state.session;
    M.state.session = null; // loader no-ops signed out; the img still renders with its path marker
    M.state.waistEntries = { "2026-08-01": { waist: 35, notes: "", photos: ["u9/x.jpg"], updatedAt: "2026-08-01T00:00:00.000Z" } };
    M.state.ui = {};
    const out = M.renderWaistSection();
    assertEqual(out.indexOf('data-photopath="u9/x.jpg"') > -1, true, "the thumbnail carries its path for the async patch");
    assertEqual(out.indexOf("u9/x.jpg\" src=") === -1 && out.indexOf('src="u9/x.jpg"') === -1, true, "the raw path is never used as an img src (it wouldn't authenticate)");
    M.state.waistEntries = prevWaist; M.state.ui = prevUi; M.state.session = prevSession;
  });
  test("waist delete: two-step, and leaves a stamped tombstone rather than removing the key", function () {
    const prevWaist = M.state.waistEntries, prevUi = M.state.ui;
    M.state.waistEntries = { "2026-08-05": { waist: 34, notes: "hi", photos: [], updatedAt: "2026-08-05T00:00:00.000Z" } };
    M.state.ui = {};
    M.actions.askDeleteWaistEntry("2026-08-05");
    assertEqual(M.waistEntryIsEmpty(M.state.waistEntries["2026-08-05"]), false, "arming does not delete");
    assertEqual(M.state.ui.strategy.confirmDeleteWaistDate, "2026-08-05", "armed");
    M.actions.deleteWaistEntry("2026-08-05");
    const t = M.state.waistEntries["2026-08-05"];
    assertEqual(M.waistEntryIsEmpty(t), true, "confirming deletes");
    assertEqual(t !== undefined, true, "the key stays, as a tombstone for the merge");
    assertEqual(Date.parse(t.updatedAt) > Date.parse("2026-08-05T00:00:00.000Z"), true, "fresh stamp so the delete wins elsewhere");
    assertEqual(M.state.ui.strategy.confirmDeleteWaistDate, null, "disarmed");
    M.state.waistEntries = prevWaist; M.state.ui = prevUi;
  });
  test("waistEntriesForDisplay: newest first, tombstones hidden, deltas vs the previous measurement", function () {
    const prev = M.state.waistEntries;
    M.state.waistEntries = {
      "2026-08-01": { waist: 35, notes: "", photos: [], updatedAt: "2026-08-01T00:00:00.000Z" },
      "2026-08-08": { waist: 34, notes: "cut going well", photos: [], updatedAt: "2026-08-08T00:00:00.000Z" },
      "2026-08-12": { waist: null, notes: "", photos: [], updatedAt: "2026-08-12T00:00:00.000Z" },
      "2026-08-20": { waist: 33, notes: "", photos: [], updatedAt: "2026-08-20T00:00:00.000Z" },
    };
    const rows = M.waistEntriesForDisplay();
    assertEqual(rows.map(function (r) { return r.date; }), ["2026-08-20", "2026-08-08", "2026-08-01"], "newest first, tombstone excluded");
    assertEqual(rows.map(function (r) { return r.delta; }), [-1, -1, null], "each delta measured against the previous actual measurement");
    M.state.waistEntries = prev;
  });
  test("waistUnitLabel: follows the weight unit's measurement system", function () {
    const prevUnit = M.state.settings.weightUnit;
    M.state.settings.weightUnit = "lbs";
    assertEqual(M.waistUnitLabel(), "in", "imperial weight, imperial waist");
    M.state.settings.weightUnit = "kg";
    assertEqual(M.waistUnitLabel(), "cm", "metric weight, metric waist");
    M.state.settings.weightUnit = prevUnit;
  });
  test("renderWaistSection: form, list, photos and controls are all wired", function () {
    const prevWaist = M.state.waistEntries, prevUi = M.state.ui, prevUnit = M.state.settings.weightUnit;
    M.state.settings.weightUnit = "lbs";
    M.state.waistEntries = { "2026-08-01": { waist: 35, notes: "note here", photos: ["data:image/jpeg;base64,AAA"], updatedAt: "2026-08-01T00:00:00.000Z" } };
    M.state.ui = {};
    const out = M.renderWaistSection();
    assertEqual(out.indexOf('data-bind="waistNotes"') > -1, true, "the notes box is bound");
    assertEqual(out.indexOf('data-change="waistPhotos"') > -1, true, "the photo picker is bound");
    assertEqual(out.indexOf('data-action="saveWaistEntry"') > -1, true, "save is wired");
    assertEqual(out.indexOf("35 in") > -1, true, "the saved measurement is listed with its unit");
    assertEqual(out.indexOf("note here") > -1, true, "notes are shown");
    assertEqual(out.indexOf('data-action="viewWaistPhoto"') > -1, true, "photos open the lightbox");
    assertEqual(out.indexOf('data-action="editWaistEntry"') > -1, true, "entries can be edited");
    assertEqual(out.indexOf('data-action="askDeleteWaistEntry"') > -1, true, "delete is two-step armed");
    M.state.waistEntries = prevWaist; M.state.ui = prevUi; M.state.settings.weightUnit = prevUnit;
  });

  // ==== one-tap meals: adjustable components on a single entry ====
  test("scaleMealItem: proportional rescale with the app's rounding", function () {
    const scaled = M.scaleMealItem({ name: "Sourdough", weight: 100, calories: 262, protein: 10, carbs: 52, fat: 1.5, fiber: 2 }, 50);
    assertEqual([scaled.weight, scaled.calories, scaled.protein, scaled.carbs, scaled.fat, scaled.fiber], [50, 131, 5, 26, 0.8, 1], "halved cleanly");
  });
  test("scaleMealItemsToWeight: exact total is a no-op, other targets scale every item", function () {
    const items = [{ name: "A", weight: 100, calories: 200, protein: 10, carbs: 20, fat: 5, fiber: 1 }, { name: "B", weight: 300, calories: 150, protein: 30, carbs: 3, fat: 2, fiber: 0 }];
    const same = M.scaleMealItemsToWeight(items, 400);
    assertEqual([same[0].calories, same[1].calories], [200, 150], "logging at the items' own total keeps them verbatim");
    const half = M.scaleMealItemsToWeight(items, 200);
    assertEqual([half[0].weight, half[1].weight], [50, 150], "half the meal halves each item");
    assertEqual([half[0].calories, half[1].calories], [100, 75], "and their macros");
  });
  test("logQuickMeal: one entry, carrying its components, totalling their macros", function () {
    const prevRecipes = M.state.recipes, prevLogs = M.state.foodLogs, prevUi = M.state.ui, prevDate = M.state.date;
    M.state.date = "2026-08-18"; M.state.foodLogs = {}; M.state.ui = {};
    M.state.recipes = [{ id: "r1", name: "Usual Breakfast", quickLog: true, ingredients: [
      { id: "i1", name: "Sourdough", weight: 100, calories: 262, protein: 10, carbs: 52, fat: 1.5, fiber: 2 },
      { id: "i2", name: "Shake", weight: 325, calories: 159, protein: 30, carbs: 2.9, fat: 2.5, fiber: 0 },
    ], createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" }];
    M.actions.logQuickMeal("r1");
    const entries = M.state.foodLogs["2026-08-18"] || [];
    assertEqual(entries.length, 1, "logged as ONE thing");
    assertEqual(entries[0].macros.calories, 421, "totals summed from the items");
    assertEqual(entries[0].mealItems.length, 2, "components travel on the entry");
    assertEqual(entries[0].source, "Meal", "labelled as a meal");
    M.state.recipes = prevRecipes; M.state.foodLogs = prevLogs; M.state.ui = prevUi; M.state.date = prevDate;
  });
  test("saveMealItems: changing one component's amount recomputes the entry from its items", function () {
    const prevLogs = M.state.foodLogs, prevUi = M.state.ui, prevDate = M.state.date;
    M.state.date = "2026-08-18";
    M.state.foodLogs = { "2026-08-18": [{ id: "m1", name: "Usual Breakfast", weight: 425, source: "Meal",
      macros: { calories: 421, protein: 40, carbs: 54.9, fat: 4, fiber: 2 },
      mealItems: [
        { name: "Sourdough", weight: 100, calories: 262, protein: 10, carbs: 52, fat: 1.5, fiber: 2 },
        { name: "Shake", weight: 325, calories: 159, protein: 30, carbs: 2.9, fat: 2.5, fiber: 0 },
      ],
      timestamp: "2026-08-01T12:00:00.000Z", updatedAt: "2026-08-01T12:00:00.000Z" }] };
    M.state.ui = { editingEntryId: "m1", mealItemInputs: { 0: "50" } };
    M.actions.saveMealItems();
    const e = M.state.foodLogs["2026-08-18"][0];
    assertEqual(e.mealItems[0].weight, 50, "the sourdough came down to 50g");
    assertEqual(e.mealItems[1].weight, 325, "the untouched shake stayed");
    assertEqual(e.macros.calories, 290, "entry totals recomputed (131 + 159)");
    assertEqual(e.weight, 375, "entry weight follows the items");
    assertEqual(Date.parse(e.updatedAt) > Date.parse("2026-08-01T12:00:00.000Z"), true, "stamped, so the edit syncs");
    M.state.foodLogs = prevLogs; M.state.ui = prevUi; M.state.date = prevDate;
  });
  test("renderEntryEditor: a meal entry opens on an Items tab; a plain entry has no such tab", function () {
    const prevUi = M.state.ui;
    M.state.ui = {};
    const meal = { id: "m1", name: "B", weight: 425, macros: { calories: 421, protein: 40, carbs: 55, fat: 4, fiber: 2 },
      mealItems: [{ name: "Sourdough", weight: 100, calories: 262, protein: 10, carbs: 52, fat: 1.5, fiber: 2 }] };
    const html = M.renderEntryEditor(meal);
    assertEqual(html.indexOf('data-arg="items"') > -1, true, "Items tab offered");
    assertEqual(html.indexOf('data-bind="mealItemWeight"') > -1, true, "per-item amount inputs render (default section)");
    const plain = M.renderEntryEditor({ id: "p1", name: "Rice", weight: 100, macros: { calories: 126, protein: 2.8, carbs: 28, fat: 0.3, fiber: 0.3 } });
    assertEqual(plain.indexOf('data-arg="items"'), -1, "no Items tab on a non-meal entry");
    M.state.ui = prevUi;
  });
  test("renderQuickMealChips: only quick-flagged recipes with ingredients get a chip", function () {
    const prev = M.state.recipes;
    M.state.recipes = [
      { id: "r1", name: "Usual Breakfast", quickLog: true, ingredients: [{ name: "X", weight: 100, calories: 100, protein: 1, carbs: 1, fat: 1, fiber: 0 }] },
      { id: "r2", name: "Chili Batch", ingredients: [{ name: "Y", weight: 100, calories: 100, protein: 1, carbs: 1, fat: 1, fiber: 0 }] },
    ];
    const html = M.renderQuickMealChips();
    assertEqual(html.indexOf("Usual Breakfast") > -1, true, "flagged recipe is a chip");
    assertEqual(html.indexOf("Chili Batch"), -1, "unflagged recipe is not");
    M.state.recipes = [];
    assertEqual(M.renderQuickMealChips(), "", "no flagged recipes, no row");
    M.state.recipes = prev;
  });
  test("meal sync wiring: meal_items and quick_log ride the payloads as explicit values", function () {
    const prevSession = M.state.session, prevLogs = M.state.foodLogs, prevRecipes = M.state.recipes;
    M.state.session = { userId: "u1" };
    M.state.foodLogs = { "2026-08-18": [{ id: "a", name: "Rice", weight: 100, macros: { calories: 126, protein: 2.8, carbs: 28, fat: 0.3, fiber: 0.3 }, timestamp: "2026-08-18T12:00:00.000Z", updatedAt: "2026-08-18T12:00:00.000Z" }] };
    const row = M.flattenFoodLogsForSync()[0];
    assertEqual("meal_items" in row, true, "column always present in the shared upsert column set");
    assertEqual(row.meal_items, null, "explicit null for a non-meal, never undefined");
    M.state.recipes = [{ id: "r1", name: "X", ingredients: [], createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" }];
    assertEqual(M.flattenRecipesForSync()[0].quick_log, false, "unflagged recipe sends explicit false");
    M.state.session = prevSession; M.state.foodLogs = prevLogs; M.state.recipes = prevRecipes;
  });

  // ==== data health check ====
  test("dataHealthBasisFindings: flags the rice signature, leaves consistent foods alone", function () {
    const prev = M.state.foodLogs;
    M.state.foodLogs = {
      "2026-08-01": [{ id: "a", foodId: "rice", name: "Rice", weight: 100, macros: { calories: 87 } },
                     { id: "b", foodId: "oats", name: "Oats", weight: 80, macros: { calories: 300 } }],
      "2026-08-02": [{ id: "c", foodId: "rice", name: "Rice", weight: 100, macros: { calories: 130 } },
                     { id: "d", foodId: "oats", name: "Oats", weight: 40, macros: { calories: 150 } }],
    };
    const findings = M.dataHealthBasisFindings();
    assertEqual(findings.length, 1, "one food flagged");
    assertEqual([findings[0].name, findings[0].minBasis, findings[0].maxBasis], ["Rice", 87, 130], "the inconsistent one, with its spread");
    M.state.foodLogs = prev;
  });
  test("dataHealthAtwaterFindings: flags calorie/macro disagreement, tolerates rounding", function () {
    const prev = M.state.foodLogs;
    M.state.foodLogs = { "2026-08-01": [
      { id: "a", name: "Beer", weight: 473, macros: { calories: 128, protein: 0.9, carbs: 4.3, fat: 0 } },
      { id: "b", name: "Chicken", weight: 100, macros: { calories: 165, protein: 31, carbs: 0, fat: 3.6 } },
    ] };
    const findings = M.dataHealthAtwaterFindings();
    assertEqual(findings.length, 1, "only the alcohol-style gap is flagged");
    assertEqual(findings[0].name, "Beer", "beer's 128 vs ~21 from macros");
    M.state.foodLogs = prev;
  });
  test("dataHealthRecordFindings: flags the baseGrams drift class", function () {
    const prevRecent = M.state.recentFoods, prevFav = M.state.favorites, prevCache = M.state.foodCache;
    M.state.favorites = []; M.state.foodCache = {};
    M.state.recentFoods = [
      // The stale-snapshot drift class (bug 1 in the baseGrams saga): base macros corrected to
      // 126/100g, but the loggedMacros snapshot still holds the old wrong 89 kcal at 102.5g --
      // which addFoodToLog would prefer on the next re-add. (The OTHER drift class, a moved
      // base with a consistent snapshot, is what the basis-spread check catches instead.)
      { id: "r1", name: "White rice, cooked", calories: 126, baseGrams: 100, loggedWeight: 102.5, loggedMacros: { calories: 89 } },
      { id: "r2", name: "Clean food", calories: 200, baseGrams: 100, loggedWeight: 50, loggedMacros: { calories: 100 } },
    ];
    const findings = M.dataHealthRecordFindings();
    assertEqual(findings.length, 1, "the drifted record only");
    assertEqual(findings[0].name, "White rice, cooked", "by name");
    M.state.recentFoods = prevRecent; M.state.favorites = prevFav; M.state.foodCache = prevCache;
  });

  // ==== goal projection ====
  test("weightGoalProjection: projects the trend's weekly rate to the goal date", function () {
    const data = [];
    for (let i = 1; i <= 14; i++) data.push({ date: "2026-08-" + String(i).padStart(2, "0"), weight: 168 - i });
    const p = M.weightGoalProjection(data, "2026-08-14", 150);
    assertEqual(p.reached, undefined, "not there yet");
    assertEqual(p.date, "2026-08-21", "avg 157 at -7/wk reaches 150 in one week");
    assertEqual(p.weeks, 1, "one week out");
  });
  test("weightGoalProjection: declares arrival, and stays silent when it can't know", function () {
    const data = [];
    for (let i = 1; i <= 14; i++) data.push({ date: "2026-08-" + String(i).padStart(2, "0"), weight: 168 - i });
    assertEqual(M.weightGoalProjection(data, "2026-08-14", 157.1).reached, true, "within 0.25 of goal = arrived");
    assertEqual(M.weightGoalProjection(data, "2026-08-14", 160), null, "trend moving AWAY from the goal says nothing");
    assertEqual(M.weightGoalProjection(data, "2026-08-14", null), null, "no goal, no projection");
    const flat = [{ date: "2026-08-01", weight: 160 }, { date: "2026-08-07", weight: 160 }, { date: "2026-08-14", weight: 160 }];
    assertEqual(M.weightGoalProjection(flat, "2026-08-14", 150), null, "a flat trend has no pace to project");
  });

  // ==== insights ====
  test("buildInsightsSummary: compact aggregates, never raw entries or keys", function () {
    const prevLogs = M.state.foodLogs, prevWeights = M.state.weights, prevDate = M.state.date, prevTargets = M.state.targetHistory;
    M.state.date = "2026-08-18"; M.state.targetHistory = {};
    M.state.settings.calorieTarget = 1876; M.state.settings.claudeApiKey = "sk-test-should-never-appear";
    M.state.foodLogs = {
      "2026-08-17": [{ id: "a", name: "Rice", weight: 100, macros: { calories: 126, protein: 2.8, carbs: 28, fat: 0.3, fiber: 0.3 } }],
      "2026-08-18": [{ id: "b", name: "Shake", weight: 325, macros: { calories: 159, protein: 30, carbs: 2.9, fat: 2.5, fiber: 0 } }],
    };
    M.state.weights = { "2026-08-17": { weight: 152.4, unit: "lbs" } };
    const s = M.buildInsightsSummary();
    assertEqual(s.days.length, 2, "both logged days aggregated");
    assertEqual(s.days[1].kcal, 159, "day totals, not entry lists");
    assertEqual(s.today.remaining.kcal, 1876 - 159, "today's remaining math");
    assertEqual(s.mostLoggedFoods.length, 2, "top foods present");
    assertEqual(JSON.stringify(s).indexOf("sk-test") === -1, true, "the API key is never in the payload");
    M.state.foodLogs = prevLogs; M.state.weights = prevWeights; M.state.date = prevDate; M.state.targetHistory = prevTargets;
    M.state.settings.claudeApiKey = "";
  });
  await atest("generateInsights: refuses without an API key, sets the error state, sends nothing", async function () {
    const prevUi = M.state.ui;
    let fetched = false;
    sandbox.fetch = function () { fetched = true; return Promise.reject(new Error("should not be called")); };
    M.state.ui = {};
    M.state.settings.claudeApiKey = "";
    await M.actions.generateInsights();
    assertEqual(typeof M.state.ui.strategy.insightsError, "string", "a visible error, not a silent no-op");
    assertEqual(fetched, false, "and no network request went out");
    sandbox.fetch = function () { return Promise.reject(new Error("network disabled in tests")); };
    M.state.ui = prevUi;
  });
  test("renderInsightsSection: renders, and gates the button on having a key", function () {
    const prevUi = M.state.ui;
    M.state.ui = {};
    M.state.settings.claudeApiKey = "";
    const noKey = M.renderInsightsSection();
    assertEqual(noKey.indexOf('data-action="generateInsights"') > -1, true, "the button exists");
    assertEqual(noKey.indexOf("disabled") > -1, true, "but is disabled without a key");
    M.state.settings.claudeApiKey = "sk-x";
    const withKey = M.renderInsightsSection();
    assertEqual(withKey.indexOf("AI Settings to use this"), -1, "no key warning once a key exists");
    M.state.settings.claudeApiKey = "";
    M.state.ui = prevUi;
  });

  // ==== food wizard: query building and the no-dead-end guarantee ====
  test("wizardSearchQuery: human option text is trimmed into database-friendly queries", function () {
    assertEqual(M.wizardSearchQuery(M.WIZARD_CONFIGS.steak, { prep: "Cooked", cut: "Ribeye", fat: "Medium (some visible fat)" }),
      "Steak Cooked Ribeye Medium", "parenthetical qualifiers stripped");
    assertEqual(M.wizardSearchQuery(M.WIZARD_CONFIGS.eggs, { prep: "Fried", addedFat: "None" }),
      "Eggs Fried", "'None' never reaches the query -- 'Eggs Fried None' was a real query this built");
    assertEqual(M.wizardSearchQuery(M.WIZARD_CONFIGS.pasta, { type: "White / Regular", state: "Dry Weight", sauce: "None / Plain" }),
      "Pasta White Dry Weight", "slashed alternatives keep their first half; 'None / Plain' vanishes");
    assertEqual(M.wizardSearchTerm("Other"), null, "Other is a UI escape, not a search term");
    assertEqual(M.wizardSearchTerm("As-Served"), null, "As-Served likewise");
  });
  await atest("wizardSelect: zero database results falls through to the AI screen, never a silent loop", async function () {
    sandbox.fetch = function () { return Promise.reject(new Error("network down")); }; // both searches catch to []
    M.state.ui = {};
    const fu = M.foodUi();
    fu.wizardType = "eggs";
    fu.wizard = { step: 1, selections: { prep: "Fried" }, weight: "", servingBasis: null, qty: "1", showAI: false, aiDesc: "", aiLoading: false, aiError: null, searchResults: [], searching: false, selectedFood: null, searchFailedQuery: null };
    await M.actions.wizardSelect("Butter");
    assertEqual(fu.wizard.showAI, true, "lands on the AI screen instead of looping the last step");
    assertEqual(fu.wizard.searching, false, "spinner released");
    assertEqual(fu.wizard.searchFailedQuery, "Eggs Fried Butter", "the failed query is named in the notice");
    assertEqual(fu.wizard.aiDesc, "typical portion", "seeded so Estimate is enabled with one tap");
    sandbox.fetch = function () { return Promise.reject(new Error("network disabled in tests")); };
  });
  await atest("wizardSelect: a too-specific query broadens once before giving up", async function () {
    const queries = [];
    sandbox.fetch = function (url) {
      const u = String(url);
      const q = decodeURIComponent((u.match(/[?&](?:query|search_terms)=([^&]*)/) || [])[1] || "");
      queries.push(q);
      if (u.indexOf("api.nal.usda.gov") > -1 && q === "Steak Cooked") {
        return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ foods: [{ fdcId: 1, description: "Beef steak, cooked", foodNutrients: [{ nutrientName: "Energy", value: 250 }, { nutrientName: "Protein", value: 26 }] }] }); } });
      }
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ foods: [], products: [] }); } });
    };
    M.state.ui = {};
    const fu = M.foodUi();
    fu.wizardType = "steak";
    fu.wizard = { step: 2, selections: { prep: "Cooked", cut: "Ribeye" }, weight: "", servingBasis: null, qty: "1", showAI: false, aiDesc: "", aiLoading: false, aiError: null, searchResults: [], searching: false, selectedFood: null, searchFailedQuery: null };
    await M.actions.wizardSelect("Well-Marbled (visible fat)");
    assertEqual(queries.some(function (q) { return q === "Steak Cooked Ribeye Well-Marbled"; }), true, "tried the specific (cleaned) query first");
    assertEqual(fu.wizard.selectedFood != null, true, "the broadened 'Steak Cooked' retry found a generic record");
    assertEqual(fu.wizard.selectedFood.name, "Beef steak, cooked", "and auto-selected it");
    assertEqual(fu.wizard.showAI, false, "no AI fallback needed");
    sandbox.fetch = function () { return Promise.reject(new Error("network disabled in tests")); };
  });
  test("renderWizardScreen: shows a searching state while the lookups run", function () {
    M.state.ui = {};
    const fu = M.foodUi();
    fu.wizardType = "eggs";
    fu.wizard = { step: 1, selections: { prep: "Fried" }, searching: true, searchResults: [], selectedFood: null, showAI: false, weight: "", qty: "1", servingBasis: null, aiDesc: "", aiLoading: false, aiError: null, searchFailedQuery: null };
    assertEqual(M.renderWizardScreen(fu).indexOf("Searching food databases") > -1, true, "the final tap visibly does something");
  });

  await atest("searchUSDA: uses the personal key from settings, falls back to DEMO_KEY when blank", async function () {
    const urls = [];
    sandbox.fetch = function (url) {
      urls.push(String(url));
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ foods: [] }); } });
    };
    M.state.settings.usdaApiKey = "MY-PERSONAL-KEY";
    await M.searchUSDA("chicken");
    assertEqual(urls[0].indexOf("api_key=MY-PERSONAL-KEY") > -1, true, "personal key on the request");
    M.state.settings.usdaApiKey = "";
    await M.searchUSDA("chicken");
    assertEqual(urls[1].indexOf("api_key=DEMO_KEY") > -1, true, "blank falls back to the shared demo key");
    M.state.settings.usdaApiKey = "";
    sandbox.fetch = function () { return Promise.reject(new Error("network disabled in tests")); };
  });

  // ==== phases & coach (experimental, default OFF) ====
  // estimateMaintenanceCalories reads the REAL clock (last 28 days), so these fixtures build
  // dates relative to today. Flat 155 lb weigh-ins + 2,000 kcal complete days => measured
  // maintenance is exactly 2,000 and the 7d trend is 155 with zero weekly change.
  function daysAgoStr(n) { const d = new Date(); d.setDate(d.getDate() - n); return M.fmtDate(d); }
  const coachPrevSettings = JSON.parse(JSON.stringify(M.state.settings));
  function coachFixture(settingsOverrides, weight) {
    M.state.foodLogs = {}; M.state.weights = {}; M.state.targetHistory = {};
    for (let i = 1; i <= 16; i++) {
      M.state.foodLogs[daysAgoStr(i)] = [{ id: "e" + i, name: "Meal", weight: 500, macros: { calories: 2000, protein: 150, carbs: 200, fat: 60, fiber: 20 } }];
    }
    for (let i = 0; i <= 20; i++) {
      M.state.weights[daysAgoStr(i)] = { weight: weight || 155, unit: "lbs", timestamp: "2026-01-01T00:00:00.000Z" };
    }
    Object.assign(M.state.settings, {
      phasesEnabled: true, weightUnit: "lbs", calorieTarget: 1876, proteinTarget: 163, carbsTarget: 153, fatTarget: 68,
      macroLocks: { protein: false, carbs: false, fat: false }, goalWeight: 150, goalDate: "", goalRatePerWeek: "",
      goalType: "cut", phaseStartedAt: daysAgoStr(2), phaseStartCalories: 1876, phaseStartTrendAvg: 155,
      reverseStage: 1, reverseStage2At: null, maintainAnchor: null, maintainBand: 2, bulkRate: 0.75,
    }, settingsOverrides || {});
  }
  test("phases are permanent: the Reverse chip and coach card always render in Weight Goals", function () {
    coachFixture({});
    const goals = M.renderWeightGoalsSection();
    assertEqual(goals.indexOf("Reverse Diet") > -1, true, "the fourth phase chip");
    assertEqual(goals.indexOf("applyCoachSuggestion") > -1 || goals.indexOf("Coach") > -1, true, "the coach card");
    assertEqual(M.renderDisplaySection().indexOf("togglePhasesEnabled"), -1, "the experimental toggle is gone -- the feature graduated");
  });
  test("phaseDeltaColor / phaseRateColor: the good direction follows the phase", function () {
    coachFixture({ goalType: "cut" });
    const cutUnder = M.phaseDeltaColor(-200), cutOver = M.phaseDeltaColor(200);
    coachFixture({ goalType: "bulk" });
    assertEqual(M.phaseDeltaColor(200), cutUnder, "a surplus in a bulk is the same green a deficit is in a cut");
    assertEqual(M.phaseDeltaColor(-200), cutOver, "and a deficit in a bulk is the failure color");
    assertEqual(M.phaseRateColor(0.7), cutUnder, "gaining while bulking is green");
    coachFixture({ goalType: "maintain" });
    assertEqual(M.phaseDeltaColor(100), M.phaseDeltaColor(-100), "at maintenance, small misses either way read the same (green)");
    assertEqual(M.phaseDeltaColor(100), cutUnder, "and that color is the success color");
    assertEqual(M.phaseDeltaColor(500) !== cutUnder && M.phaseDeltaColor(500) !== cutOver, true, "big maintenance drift is amber, not red -- drift, not failure");
  });
  test("renderWeeklyDeltaCard: the verdict sentence follows the phase", function () {
    coachFixture({ goalType: "bulk" });
    M.state.date = daysAgoStr(0);
    M.state.targetHistory = {};
    M.state.settings.calorieTarget = 2000;
    M.state.foodLogs[daysAgoStr(0)] = [{ id: "s1", name: "Big day", weight: 100, macros: { calories: 2400, protein: 100, carbs: 100, fat: 100, fiber: 0 } }];
    const html = M.renderWeeklyDeltaCard();
    assertEqual(html.indexOf("surplus your bulk plans for") > -1, true, "a surplus during a bulk is the plan working, not a slip");
  });
  test("phaseCoach cut: goal reached suggests starting the reverse diet", function () {
    coachFixture({ goalWeight: 155 }); // trend avg is exactly 155
    const s = M.phaseCoach();
    assertEqual(s.switchTo, "reverse", "the RP next step");
    assertEqual(s.title.indexOf("Goal reached") > -1, true, "celebrated");
  });
  test("phaseCoach cut: a stalled trend suggests a ~100 kcal drop", function () {
    coachFixture(); // goal 150, trend flat at 155 => stalled
    const s = M.phaseCoach();
    assertEqual(s.apply.calories, 1776, "current 1876 minus 100");
  });
  test("phaseCoach reverse step 1: suggests the RP midpoint between end-cut and maintenance", function () {
    coachFixture({ goalType: "reverse" });
    const s = M.phaseCoach();
    assertEqual(s.apply.calories, 1940, "(1876 + 2000) / 2, rounded to 10");
    assertEqual(s.apply.stage, undefined, "not a stage advance yet");
  });
  test("phaseCoach reverse step 1: after ~3 weeks at the midpoint, suggests full maintenance", function () {
    coachFixture({ goalType: "reverse", phaseStartedAt: daysAgoStr(22), calorieTarget: 1940 });
    const s = M.phaseCoach();
    assertEqual(s.apply.calories, 2000, "step 2 is the full measured maintenance");
    assertEqual(s.apply.stage, 2, "and advances the stage when applied");
  });
  test("applyCoachSuggestion: applies the shown suggestion through the macro locks", function () {
    coachFixture({ goalType: "reverse", phaseStartedAt: daysAgoStr(22), calorieTarget: 1940, macroLocks: { protein: true, carbs: false, fat: false } });
    M.actions.applyCoachSuggestion();
    assertEqual(M.state.settings.calorieTarget, 2000, "target applied");
    assertEqual(M.state.settings.proteinTarget, 163, "locked protein untouched -- the step went to carbs/fat");
    assertEqual(M.state.settings.reverseStage, 2, "stage advanced");
    assertEqual(typeof M.state.settings.reverseStage2At, "string", "stage-2 start stamped");
  });
  test("phaseCoach maintain: drift beyond the ±2 band suggests a correction; in-band says hold", function () {
    coachFixture({ goalType: "maintain", maintainAnchor: 150, maintainBand: 2, calorieTarget: 2000 }, 153);
    const s = M.phaseCoach();
    assertEqual(s.apply.calories, 1875, "trend 153 vs anchor 150 = +3 drift, trim 125");
    coachFixture({ goalType: "maintain", maintainAnchor: 155, maintainBand: 2, calorieTarget: 2000 });
    assertEqual(M.phaseCoach().apply, null, "inside the band, nothing to change");
  });
  test("phaseCoach maintain: NO hold timelines -- the bulk door is open from day one in band", function () {
    // Colin's call (2026-08-18): he won't maintain for long, so no week-counting gate.
    coachFixture({ goalType: "maintain", maintainAnchor: 155, maintainBand: 2, calorieTarget: 2000, phaseStartedAt: daysAgoStr(1) });
    const s = M.phaseCoach();
    assertEqual(s.switchTo, "bulk", "one day in and the switch is already offered");
    assertEqual(s.lines.join(" ").indexOf("Consolidating"), -1, "no consolidation week-counting in the copy");
  });
  test("phaseCoach bulk: below maintenance suggests the +0.75/wk surplus target", function () {
    coachFixture({ goalType: "bulk", calorieTarget: 2000 });
    const s = M.phaseCoach();
    assertEqual(s.apply.calories, 2375, "maintenance 2000 + round(0.75 * 3500 / 7)");
  });
  test("phaseCoach bulk: gaining too slowly vs the 0.75 target suggests +100", function () {
    coachFixture({ goalType: "bulk", calorieTarget: 2400 }); // flat trend = 0/wk gain
    const s = M.phaseCoach();
    assertEqual(s.apply.calories, 2500, "under half the target pace, add 100");
  });
  test("setGoalType: entering a phase stamps its starting point (only when phases are on)", function () {
    coachFixture({ goalType: "cut", phaseStartedAt: daysAgoStr(30), phaseStartCalories: 1700 });
    M.actions.setGoalType("reverse");
    assertEqual(M.state.settings.phaseStartedAt, daysAgoStr(0), "stamped today");
    assertEqual(M.state.settings.phaseStartCalories, 1876, "from the current target");
    assertEqual(M.state.settings.reverseStage, 1, "reverse starts at step 1");
    M.actions.setGoalType("reverse"); // re-tap the active chip
    assertEqual(M.state.settings.phaseStartedAt, daysAgoStr(0), "re-tapping does not re-stamp");
  });
  test("phases UI: the reverse phase renders its coach card in Weight Goals", function () {
    coachFixture({ goalType: "reverse" });
    const goals = M.renderWeightGoalsSection();
    assertEqual(goals.indexOf("Reverse Diet") > -1, true, "the fourth chip");
    assertEqual(goals.indexOf("Coach") > -1, true, "the coach card renders in Weight Goals");
  });
  // Leave no residue for anything after us.
  M.state.foodLogs = {}; M.state.weights = {}; M.state.targetHistory = {};
  Object.assign(M.state.settings, coachPrevSettings);
  M.syncTargetBaseline();

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail > 0 ? 1 : 0);
})();
