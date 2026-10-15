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
    await expect(vendor.getByTestId("map-confidence")).toHaveText("95%");
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

  test("edge labels stay on the line and off the nodes", async ({ page }) => {
    await page.getByTestId("open-object-map").click();
    const labels = page.getByTestId("map-edge-label");
    await expect(labels).toHaveCount(3);
    const forOrder = page.locator("[data-testid=map-edge-label][data-type=for-order]");
    await expect(forOrder).toHaveCount(1);
    const fill = await forOrder.locator(".map-edge-label-bg").evaluate((el) => getComputedStyle(el).fill);
    expect(fill).toBe("rgb(28, 28, 28)");
    const canvas = await page.getByTestId("map-canvas").boundingBox();
    const labelBoxes = await labels.evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, type: node.getAttribute("data-type") };
    }));
    const nodeBoxes = await page.getByTestId("map-node").evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }));
    function hits(a, b) {
      return a.x < b.x + b.width - 0.5 && a.x + a.width - 0.5 > b.x && a.y < b.y + b.height - 0.5 && a.y + a.height - 0.5 > b.y;
    }
    labelBoxes.forEach((label) => {
      expect(label.x).toBeGreaterThanOrEqual(canvas.x - 0.5);
      expect(label.y).toBeGreaterThanOrEqual(canvas.y - 0.5);
      expect(label.x + label.width).toBeLessThanOrEqual(canvas.x + canvas.width + 0.5);
      expect(label.y + label.height).toBeLessThanOrEqual(canvas.y + canvas.height + 0.5);
      nodeBoxes.forEach((node) => {
        expect(hits(label, node), label.type + " overlaps a node").toBe(false);
      });
    });
    for (let i = 0; i < labelBoxes.length; i++) {
      for (let j = i + 1; j < labelBoxes.length; j++) {
        expect(hits(labelBoxes[i], labelBoxes[j])).toBe(false);
      }
    }
  });

  test("header tools stay one line", async ({ page }) => {
    await page.getByTestId("open-object-map").click();
    const zoom = page.getByTestId("map-zoom-in");
    await expect(zoom).toHaveAttribute("aria-label", "Zoom in");
    await expect(zoom).toHaveText("+");
    await expect(page.getByTestId("map-zoom-out")).toHaveAttribute("aria-label", "Zoom out");
    await expect(page.getByTestId("map-reset-view")).toHaveAttribute("aria-label", "Reset view");
    await expect(page.getByTestId("map-close")).toHaveAttribute("aria-label", "Close");
    const zoomBox = await zoom.boundingBox();
    const titleBox = await page.locator("#object-map h2").boundingBox();
    expect(zoomBox.height).toBeLessThanOrEqual(36);
    expect(titleBox.height).toBeLessThanOrEqual(36);
    const wrapped = await zoom.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
    expect(wrapped).toBe(false);
  });

  test("first merge buttons stay on screen at 1024x640", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.getByTestId("open-object-map").click();
    const first = page.getByTestId("map-suggestion").first();
    await expect(first).toHaveAttribute("data-id", "suppliers~vendors");
    for (const name of ["map-merge", "map-dismiss"]) {
      const button = first.getByTestId(name);
      const box = await button.boundingBox();
      expect(box).toBeTruthy();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(1024);
      expect(box.y + box.height).toBeLessThanOrEqual(640);
      const hit = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el ? el.getAttribute("data-testid") : "";
      }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
      expect(hit).toBe(name);
    }
    await page.screenshot({ path: shot("after-object-map-1024.png") });
    publish("after-object-map-1024.png");
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
