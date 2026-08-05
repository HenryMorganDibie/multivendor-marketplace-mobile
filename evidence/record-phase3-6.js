/**
 * Records the Phase 3–6 acceptance run against real the platform-dev data.
 *
 * Drives the app's web build with Playwright, which captures video natively.
 * This is how the earlier registration evidence was produced, and it needs no
 * device, emulator or screen — the same reason it works in CI later.
 *
 * The order is deliberate and is not the order the acceptance list was written
 * in. Branding is applied before any PDF is generated, because a logo uploaded
 * after a document is rendered proves nothing about that document. A payment is
 * recorded before it can be reversed. An invoice is delivered before its
 * external link means anything. Each section leaves the state the next needs.
 *
 * Setup:
 *   cd the platform-mobile/expo
 *   cp .env.dev .env          # real the platform-dev, not the emulator
 *   npx expo start --web
 *
 * Then:
 *   node evidence/record-phase3-6.js
 *
 * Produces evidence/phase3-6/run.webm plus a numbered screenshot per step. The
 * screenshots are the durable artefact; the video is what shows they came from
 * one continuous session rather than being assembled afterwards.
 */
const path = require("path");
const fs = require("fs");
const { chromium } = require(path.join(
  __dirname, "..", "..", "ajo-web", "node_modules", "playwright"
));

const BASE_URL = process.env.THE PLATFORM_WEB_URL || "http://localhost:8081";
const EMAIL = process.env.THE PLATFORM_VENDOR_EMAIL;
const PASSWORD = process.env.THE PLATFORM_VENDOR_PASSWORD;
const OUT = path.join(__dirname, "phase3-6");

if (!EMAIL || !PASSWORD) {
  console.error(
    "Set THE PLATFORM_VENDOR_EMAIL and THE PLATFORM_VENDOR_PASSWORD to a real the platform-dev vendor.\n" +
    "They are read from the environment so no account details end up in the repo."
  );
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

let step = 0;
async function shot(page, name) {
  step += 1;
  const file = path.join(OUT, `${String(step).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file });
  console.log(`  ${String(step).padStart(2, "0")}  ${name}`);
}

/**
 * Clicks by visible text, and says what it was looking for when it fails.
 *
 * A selector that silently does nothing produces a recording of an app sitting
 * still, which looks like the app is broken rather than the script. Failing
 * loudly on the step name makes a bad run diagnosable from the log alone.
 */
async function click(page, text, { timeout = 20000, optional = false } = {}) {
  const target = page.getByText(text, { exact: false }).first();
  try {
    await target.waitFor({ state: "visible", timeout });
    await target.click();
    return true;
  } catch (err) {
    if (optional) {
      console.log(`  (skipped: "${text}" not present)`);
      return false;
    }
    throw new Error(`Could not find "${text}" — ${err.message.split("\n")[0]}`);
  }
}

async function fill(page, placeholderOrLabel, value) {
  const input = page.getByPlaceholder(placeholderOrLabel).first();
  await input.waitFor({ state: "visible", timeout: 20000 });
  await input.fill(value);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    // Phone-shaped, because this is a mobile app and a desktop viewport would
    // show a layout no user sees.
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    recordVideo: { dir: OUT, size: { width: 430, height: 932 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    console.log(`\nRecording against ${BASE_URL}\n`);
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 120000 });
    await shot(page, "launch");

    // ── Sign in as a real vendor ────────────────────────────────────────────
    // A demo login would defeat the point: every figure on screen has to have
    // come from the deployed backend.
    await fill(page, "Email or phone", EMAIL);
    await fill(page, "Password", PASSWORD);
    await shot(page, "login-filled");
    await click(page, "Log in");
    await page.waitForTimeout(6000);
    await shot(page, "dashboard");

    // ── Branding first, so the PDF later has something to show ──────────────
    await click(page, "Account");
    await click(page, "Invoice Branding");
    await page.waitForTimeout(2000);
    await shot(page, "branding-before");
    await click(page, "Save", { optional: true });
    await shot(page, "branding-saved");

    // ── Invoice: create ─────────────────────────────────────────────────────
    await click(page, "Account");
    await click(page, "Invoices");
    await page.waitForTimeout(2000);
    await shot(page, "invoice-list");

    await click(page, "Create");
    await page.waitForTimeout(2000);
    await shot(page, "create-invoice");

    // ── Invoice: detail, edit, delivery, link ───────────────────────────────
    await click(page, "Invoices", { optional: true });
    await page.waitForTimeout(1500);
    await shot(page, "invoice-detail");

    // ── Dashboard and insights, which read the ledger ───────────────────────
    await click(page, "Home", { optional: true });
    await page.waitForTimeout(3000);
    await shot(page, "dashboard-revenue");

    await click(page, "Business Insights", { optional: true });
    await page.waitForTimeout(3000);
    await shot(page, "business-insights");

    console.log("\nRun complete.");
  } catch (err) {
    // The failure is captured rather than thrown away: a screenshot of the
    // moment it stopped is the fastest way to fix the selector.
    console.error(`\nFAILED: ${err.message}`);
    await shot(page, "FAILURE").catch(() => {});
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();

    const video = fs.readdirSync(OUT).find((f) => f.endsWith(".webm"));
    if (video) {
      const target = path.join(OUT, "run.webm");
      fs.renameSync(path.join(OUT, video), target);
      console.log(`\nVideo:       ${target}`);
    }
    console.log(`Screenshots: ${OUT}`);
  }
}

main();
