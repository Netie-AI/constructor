// Object map: click a node, merge, dismiss, Esc. Offline. No live calls.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const AxeBuilder = require("@axe-core/playwright");

const SCREENS = path.join(__dirname, "..", "..", "test-results", "screens");
const ARTIFACTS = "/opt/cursor/artifacts/screenshots";
test.use({ video: "on" });

function shot(name) {
  fs.mkdirSync(SCREENS, { recursive: true });
  return path.join(SCREENS, name);
}

function publish(name) {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  fs.copyFileSync(path.join(SCREENS, name), path.join(ARTIFACTS, name));
}

async function boot(page) {
  const errors = [];
  await page.addInitScript(() => {
    window.__fetches = [];
    const orig = window.fetch;
    window.fetch = function () {
      window.__fetches.push(String(arguments[0]));
      return orig.apply(this, arguments);
    };
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push("console.error: " + msg.text());
  });
  page.on("pageerror", (err) => errors.push("pageerror: " + err.message));
  await page.goto("/");
  await expect(page.locator(".node")).toHaveCount(8);
  const close = page.locator("#chat-close");
  if (await close.isVisible()) await close.click();
  return errors;
}

test.describe("object map", () => {
  let errors;

  test.beforeEach(async ({ page }) => {
    errors = await boot(page);
  });

  test.afterEach(async () => {
    expect(errors, "browser console must stay clean").toEqual([]);
  });

  test("click, merge, dismiss, and Esc stay a proposal", async ({ page }) => {
    await page.screenshot({ path: shot("before-object-map.png") });
    publish("before-object-map.png");
    await page.getByTestId("open-object-map").click();
    await expect(page.getByTestId("object-map")).toBeVisible();
    await expect(page.getByTestId("map-label")).toHaveText("synthetic object map, not a live catalog");
    await expect(page.getByTestId("map-node")).toHaveCount(5);
    await page.locator("[data-testid=map-node][data-id=orders]").click();
    const panel = page.getByTestId("map-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId("map-title")).toHaveText("Order");
    await expect(panel.getByTestId("map-status")).toHaveText("PROPOSED");
    await expect(panel.getByTestId("map-source")).toContainText("orders");
    await expect(panel.getByTestId("map-columns")).toContainText("order_id, status, region, amount");
    await expect(panel.getByTestId("map-fields")).toContainText("key order_id");
    await expect(panel.getByTestId("map-links")).toContainText("for-order");
    await expect(panel).not.toContainText("CERTIFIED");
    const vendor = page.locator("[data-testid=map-suggestion][data-id='suppliers~vendors']");
    await expect(vendor).toContainText("name similarity");
    await expect(vendor.getByTestId("map-confidence")).toHaveText("1");
    await page.screenshot({ path: shot("after-object-map.png") });
    publish("after-object-map.png");
    await vendor.getByTestId("map-merge").click();
    await expect(vendor.getByTestId("map-merge-note")).toContainText("Not applied");
    const recorded = await page.evaluate(() => {
      const row = window.SkinState.get().merges[0];
      return {
        schema: window.SkinState.get().schema,
        status: row.status,
        applied: row.applied,
        certified: row.certified,
        nodes: document.querySelectorAll("[data-testid=map-node]").length,
      };
    });
    expect(recorded).toEqual({
      schema: "netie.skin-state/1",
      status: "proposed",
      applied: false,
      certified: false,
      nodes: 5,
    });
    const orderPair = page.locator("[data-testid=map-suggestion][data-id='orders~purchase_orders']");
    await orderPair.getByTestId("map-dismiss").click();
    await expect(page.locator("[data-testid=map-suggestion][data-id='orders~purchase_orders']")).toHaveCount(0);
    await expect(vendor).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(page.getByTestId("object-map")).toBeVisible();
    const fetches = await page.evaluate(() => window.__fetches);
    expect(fetches).toEqual([]);
  });

  test("axe A and AA on the open object map", async ({ page }) => {
    await page.getByTestId("open-object-map").click();
    await page.locator("[data-testid=map-node][data-id=orders]").click();
    await expect(page.getByTestId("map-panel")).toBeVisible();
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const brief = result.violations.map((row) => ({
      id: row.id,
      impact: row.impact,
      nodes: row.nodes.length,
      help: row.help,
      targets: row.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    }));
    fs.mkdirSync(SCREENS, { recursive: true });
    fs.writeFileSync(path.join(SCREENS, "axe-object-map.json"), JSON.stringify(brief, null, 2));
    expect(result.violations, JSON.stringify(brief, null, 2)).toEqual([]);
  });
});
