// Real-browser end-to-end test of the barcode scanner (added 2026-09-28).
//
// NOT part of `node tests/run-tests.js` -- it needs Playwright and a Chromium build:
//   npm i -g playwright && npx playwright install chromium     (once)
//   node tests/e2e/scanner.js
// Everything else is self-contained: it serves the repo over http on a free port, loads the
// REAL index.html in headless Chromium, and fakes only the hardware edges. getUserMedia hands
// back a canvas stream (white until the test "shows" a barcode, then red), and BarcodeDetector
// is a stand-in that behaves like the native one in the way that matters here: it reads the
// CURRENT FRAME of the element it is handed (drawImage), so a paused or detached element
// yields a frozen frame. Supabase and Open Food Facts are routed to canned responses; nothing
// touches the network.
//
// Why a browser test exists for this one screen: the "scanner just hangs" bug of 2026-09 was
// invisible to the vm sandbox (no real DOM, no media elements) and to every watchdog --
// nothing failed, the loop simply detected forever against a <video> that a rerender() had
// removed from the document (which pauses it). Scenarios 2 and 3 are that bug, with the two
// real-life triggers; both fail on the pre-fix code and pass on the fix.

const http = require("http");
const fs = require("fs");
const path = require("path");

function loadPlaywright() {
  try { return require("playwright"); } catch (e) {}
  try {
    const root = require("child_process").execSync("npm root -g", { encoding: "utf8" }).trim();
    return require(path.join(root, "playwright"));
  } catch (e) {}
  console.log("SKIP: playwright is not installed (npm i -g playwright && npx playwright install chromium)");
  process.exit(0);
}
const pw = loadPlaywright();

const repoRoot = path.join(__dirname, "..", "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
function serveRepo() {
  return new Promise(function (resolve) {
    const server = http.createServer(function (req, res) {
      const urlPath = decodeURIComponent(req.url.split("?")[0]);
      const file = path.join(repoRoot, urlPath === "/" ? "index.html" : urlPath);
      if (!file.startsWith(repoRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", function () { resolve({ server: server, url: "http://127.0.0.1:" + server.address().port }); });
  });
}

const OFF_PRODUCT = { status: 1, product: { code: "0068200465708", product_name: "Test Milk", brands: "TestCo",
  nutriments: { "energy-kcal_100g": 52, proteins_100g: 8, carbohydrates_100g: 4, fat_100g: 0.1, fiber_100g: 0 } } };

// Runs before any page script: fake camera + fake detector + a signed-in session.
const FAKES = `
  window.__detCalls = 0; window.__showBarcode = false;
  window.BarcodeDetector = class {
    constructor(opts) { this.opts = opts; }
    static getSupportedFormats() { return Promise.resolve(["ean_13", "upc_a"]); }
    async detect(video) {
      window.__detCalls++;
      const c = window.__detCanvas || (window.__detCanvas = document.createElement("canvas"));
      c.width = 64; c.height = 48;
      const ctx = c.getContext("2d");
      ctx.drawImage(video, 0, 0, 64, 48);
      const px = ctx.getImageData(32, 24, 1, 1).data;
      if (px[0] > 200 && px[1] < 60 && px[2] < 60) return [{ rawValue: "0068200465708", format: "ean_13" }];
      return [];
    }
  };
  navigator.mediaDevices.getUserMedia = async function () {
    const c = document.createElement("canvas"); c.width = 320; c.height = 240;
    const ctx = c.getContext("2d");
    const paint = function () { ctx.fillStyle = window.__showBarcode ? "#f00" : "#fff"; ctx.fillRect(0, 0, 320, 240); };
    paint(); setInterval(paint, 40);
    return c.captureStream(15);
  };
  try { localStorage.setItem("ml_supabaseSession", JSON.stringify({ userId: "u-test", accessToken: "t", refreshToken: "r", expiresAt: Date.now() + 3600000 })); } catch (e) {}
`;

let failures = 0;
function check(cond, label) { if (!cond) { failures++; console.log("  FAIL: " + label); } }

// Opens the scanner in a fresh page, runs `midScan` once the camera loop is up, then shows
// the barcode and reports where things ended up.
async function scenario(baseUrl, name, midScan) {
  const browser = await pw.chromium.launch();
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", function (e) { errors.push(String(e)); });
  await page.route("**/*supabase.co/**", function (route) { route.fulfill({ status: 200, contentType: "application/json", body: "[]" }); });
  await page.route("**/*openfoodfacts.org/**", function (route) { route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(OFF_PRODUCT) }); });
  await page.addInitScript(FAKES);
  await page.goto(baseUrl + "/index.html");
  await page.waitForFunction(function () { return typeof actions !== "undefined" && document.getElementById("app").innerHTML.length > 500; });
  await page.evaluate(function () { actions.setTab("food"); actions.openBarcodeScan(); });
  await page.waitForSelector("#barcodeVideo");
  await page.waitForFunction(function () { return window.__detCalls > 5; }, null, { timeout: 5000 }); // loop is running
  const result = await midScan(page);
  const out = await page.evaluate(function () {
    const fu = state.ui.food || {};
    let diag = null; try { diag = JSON.parse(localStorage.getItem("ml_scanDiag")); } catch (e) {}
    return { calls: window.__detCalls, scanning: !!fu.scanningBarcode, adding: fu.addingFood ? fu.addingFood.name : null, diag: diag };
  });
  console.log("[" + name + "] detect() calls: " + out.calls + " | scanning: " + out.scanning + " | Adding Food: " + out.adding +
    " | diag: " + (out.diag ? "swaps=" + out.diag.swaps + " reads=" + out.diag.reads + " accepted=" + out.diag.accepted + " lookup=" + out.diag.lookup + " endedBy=" + out.diag.endedBy : "none") +
    (errors.length ? " | PAGE ERRORS: " + errors.join("; ") : ""));
  check(errors.length === 0, name + ": no page errors");
  await browser.close();
  return Object.assign(out, result || {});
}

async function showBarcodeAndWait(page) {
  await page.evaluate(function () { window.__showBarcode = true; });
  try {
    await page.waitForFunction(function () { return !!(state.ui.food && state.ui.food.addingFood); }, null, { timeout: 5000 });
    return { landed: true };
  } catch (e) { return { landed: false }; }
}

(async function () {
  const { server, url } = await serveRepo();
  try {
    // 1. Control: a scan with nothing else going on.
    let r = await scenario(url, "plain scan", showBarcodeAndWait);
    check(r.landed && r.adding === "Test Milk", "plain scan lands in Adding Food");
    check(r.diag && r.diag.swaps === 0 && r.diag.lookup === "ok" && r.diag.endedBy === "accepted", "plain scan diagnostics");

    // 2. THE BUG, generic trigger: something rerender()s while the scanner is open (for real:
    //    the boot sync merging something in). The <video> is rebuilt; the loop must follow it.
    r = await scenario(url, "rerender mid-scan", async function (page) {
      await page.evaluate(function () { rerender(); });
      await page.waitForTimeout(300);
      return showBarcodeAndWait(page);
    });
    check(r.landed && r.adding === "Test Milk", "a rerender mid-scan does not strand the detection loop");
    check(r.diag && r.diag.swaps === 1, "the swap was counted (diagnostics name this failure class)");

    // 3. THE BUG, the everyday trigger: the "Food Added" toast from the previous item hides
    //    itself with a rerender() 900ms later -- log one, tap Scan for the next, camera comes
    //    up inside that window.
    r = await scenario(url, "toast mid-scan", async function (page) {
      await page.evaluate(function () { showToast("Food Added"); });
      await page.waitForTimeout(1200); // past the toast's own hide rerender
      return showBarcodeAndWait(page);
    });
    check(r.landed && r.adding === "Test Milk", "the Food Added toast's hide-rerender does not kill the next scan");
    check(r.diag && r.diag.swaps === 2, "both toast rerenders (show + hide) were followed");

    // 4. Closing the scanner must actually stop the loop -- a tick whose detect() was in
    //    flight when the camera stopped used to schedule the next frame regardless.
    r = await scenario(url, "close mid-scan", async function (page) {
      await page.evaluate(function () { actions.closeBarcodeScan(); });
      await page.waitForTimeout(400);
      const a = await page.evaluate(function () { return window.__detCalls; });
      await page.waitForTimeout(600);
      const b = await page.evaluate(function () { return window.__detCalls; });
      return { callsAfterClose: b - a };
    });
    check(r.callsAfterClose === 0, "no detect() calls after the scanner was closed (got " + r.callsAfterClose + ")");
    check(r.scanning === false && r.adding === null, "closed cleanly, nothing delivered");
  } finally {
    server.close();
  }
  console.log(failures === 0 ? "\nscanner e2e: all scenarios passed" : "\nscanner e2e: " + failures + " check(s) FAILED");
  process.exit(failures === 0 ? 0 : 1);
})().catch(function (e) { console.error("HARNESS ERROR", e); process.exit(2); });
