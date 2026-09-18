import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

/**
 * Visual QA helper: signs into the demo account and captures representative
 * screens at desktop and mobile widths. Not part of the app runtime.
 *
 *   npm run start &            # or npm run dev
 *   npx tsx scripts/screenshots.ts http://localhost:3210
 */
const BASE = process.argv[2] ?? "http://localhost:3210";
const OUT = process.argv[3] ?? "/tmp/foodlist-qa";
const CHROMIUM =
  process.env.CHROMIUM_PATH ??
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";

const ROUTES: { name: string; path: string; fullPage?: boolean }[] = [
  { name: "home", path: "/" },
  { name: "decide", path: "/decide" },
  { name: "decide-filtered", path: "/decide?occasion=date_night&vibe=nicer&maxSpend=60" },
  { name: "places", path: "/places" },
  { name: "places-map", path: "/places?view=map" },
  { name: "map", path: "/map" },
  { name: "profile", path: "/profile" },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROMIUM, headless: true });

  try {
    for (const viewport of [
      { label: "desktop", width: 1440, height: 900 },
      { label: "mobile", width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();

      await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
      await page.screenshot({ path: `${OUT}/${viewport.label}-login.png`, fullPage: true });
      console.log(`${viewport.label}/login captured`);

      await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
      await page
        .getByRole("button", { name: /Explore the demo with Cyprus data/i })
        .click();
      await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
      await page.waitForLoadState("networkidle");

      for (const route of ROUTES) {
        await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle").catch(() => undefined);
        await assertNoErrorPage(page, route.path);
        await page.screenshot({ path: `${OUT}/${viewport.label}-${route.name}.png`, fullPage: true });
        console.log(`${viewport.label}/${route.name} captured`);
      }

      // Place detail: follow the first place card link so the id is real.
      await page.goto(`${BASE}/places`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle");
      const firstCard = page.locator('a[href^="/places/"]').first();
      await firstCard.click();
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: `${OUT}/${viewport.label}-place-detail.png`, fullPage: true });
      console.log(`${viewport.label}/place-detail captured (${page.url()})`);

      // Add-place dialog.
      await page.goto(`${BASE}/places`, { waitUntil: "domcontentloaded" });
      await page
        .getByRole("button", { name: /^Add place$|^Add$/ })
        .first()
        .click();
      await page.getByPlaceholder(/Tocayo, brunch Strovolos/i).fill("brunch");
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${OUT}/${viewport.label}-add-place.png` });
      console.log(`${viewport.label}/add-place captured`);

      // Log-visit dialog.
      await page.goto(`${BASE}/places`, { waitUntil: "domcontentloaded" });
      await page.locator('a[href^="/places/"]').first().click();
      await page.getByRole("button", { name: /Log (first|another) visit/i }).first().click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/${viewport.label}-log-visit.png` });
      console.log(`${viewport.label}/log-visit captured`);

      await context.close();
    }
  } finally {
    await browser.close();
  }
}

async function assertNoErrorPage(page: import("playwright-core").Page, path: string) {
  const errorHeading = page.getByText("Something went wrong", { exact: false });
  if ((await errorHeading.count()) > 0) {
    const detail = await page.locator("main, body").first().innerText();
    throw new Error(`Error page rendered for ${path}: ${detail.slice(0, 300)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
