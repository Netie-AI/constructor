// One-shot Try it, the i button, and solid tokens. Offline. No live calls.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const AxeBuilder = require("@axe-core/playwright");

const SCREENS = path.join(__dirname, "..", "..", "test-results", "screens");
test.use({ video: "on" });
function shot(name) {
  fs.mkdirSync(SCREENS, { recursive: true });
  return path.join(SCREENS, name);
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

test.describe("try it and info popover", () => {
  let errors;

  test.beforeEach(async ({ page }) => {
    errors = await boot(page);
  });

  test.afterEach(async () => {
    expect(errors, "browser console must stay clean").toEqual([]);
  });

  test("i button opens on hover, pins on click, and closes on Esc", async ({ page }) => {
    await page.getByTestId("open-planner").click();
    const btn = page.getByTestId("info-plan-body");
    const pop = page.locator("#info-plan-body");
    await expect(btn).toHaveAttribute("aria-label", "Plan details");
    await expect(pop).toHaveAttribute("role", "dialog");
    await expect(pop).toBeHidden();
    await btn.hover();
    await expect(btn).toHaveAttribute("aria-expanded", "true");
    await expect(pop).toBeVisible();
    await page.mouse.move(1100, 200);
    await expect(pop).toBeHidden();
    await btn.focus();
    await expect(pop).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(pop).toBeHidden();
    await btn.click();
    await expect(btn).toHaveAttribute("aria-expanded", "true");
    await page.mouse.move(1100, 200);
    await expect(pop).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(pop).toBeHidden();
    await expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  test("empty Try it runs the labelled fixture and node edits propagate", async ({ page }) => {
    await page.getByTestId("try-run").click();
    await expect(page.getByTestId("try-fixture")).toContainText("synthetic orders table, not a live table");
    const panel = page.getByTestId("planner-panel");
    await expect(panel.getByTestId("planner-intent")).toHaveText("database");
    await expect(panel.getByTestId("planner-goal")).toBeVisible();
    await expect(panel.getByTestId("planner-card").first()).toContainText("PROPOSED");
    await expect(panel.getByTestId("planner-ontology")).not.toContainText("CERTIFIED");
    await expect(panel.getByTestId("answer-state")).toHaveText("withheld");
    await expect(panel.getByTestId("answer-badge")).toHaveText("badge off");
    await expect(panel.getByTestId("answer-values")).toHaveText("values empty");
    const certified = await page.evaluate(() => window.PlannerUI.cards().some((card) => card.certified === true));
    expect(certified).toBe(false);
    await expect(page.locator(".node")).toHaveCount(5);
    const kinds = await page.locator(".node").evaluateAll((els) => els.map((el) => el.dataset.kind));
    expect(kinds).toEqual(["ingest", "ontology", "insight", "agent", "app"]);
    await expect(page.locator("#wires path")).toHaveCount(4);
    await page.getByTestId("planner-accept-all").click();
    await expect(panel.locator("[data-status=proposed]")).toHaveCount(0);
    await expect(panel.getByTestId("planner-card").first()).toContainText("ACCEPTED");
    const still = await page.evaluate(() => window.PlannerUI.cards().every((card) => card.status === "accepted" && card.certified === false));
    expect(still).toBe(true);
    await page.screenshot({ path: shot("after-try-it.png") });
    await panel.getByTestId("planner-ontology").screenshot({ path: shot("after-planner-card.png") });

    await page.locator("#open-ontology").click();
    await expect(page.getByTestId("os-proposals")).toContainText("accepted");
    await page.screenshot({ path: shot("after-studio.png") });
    await page.getByTestId("os-close").click();

    await page.locator(".node[data-kind=app]").click();
    await page.getByTestId("node-rename").fill("Ledger answer");
    await page.getByTestId("node-rename").blur();
    await expect(page.getByTestId("answer-title")).toHaveText("Ledger answer");
    await page.getByTestId("node-lane").selectOption("KB");
    await expect(page.locator(".node[data-kind=app]").getByTestId("node-lane-chip")).toHaveText("KB");
    await page.getByTestId("node-earlier").click();
    const reordered = await page.locator(".node").evaluateAll((els) => els.map((el) => el.dataset.kind));
    expect(reordered[3]).toBe("app");
    expect(reordered[4]).toBe("agent");
    await page.locator(".node[data-kind=app]").click();
    await page.getByTestId("node-remove").click();
    await expect(page.locator(".node")).toHaveCount(4);
    const fetches = await page.evaluate(() => window.__fetches);
    expect(fetches).toEqual([]);
  });

  test("a dropped CSV fixture is the only table and stays uncertified", async ({ page }) => {
    await page.locator("#try-it").evaluate((form) => {
      const dt = new DataTransfer();
      const file = new File(["order_id,status\nA-1,open\nA-2,held\n"], "orders-sample.csv", { type: "text/csv" });
      dt.items.add(file);
      form.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    });
    await expect(page.getByTestId("try-fixture")).toContainText("orders-sample.csv");
    await page.getByTestId("try-input").fill("list open orders where status is open");
    await page.getByTestId("try-run").click();
    await expect(page.getByTestId("planner-intent")).toHaveText("database");
    await expect(page.getByTestId("planner-card").first()).toContainText("PROPOSED");
    const certified = await page.evaluate(() => window.PlannerUI.cards().some((card) => card.certified === true));
    expect(certified).toBe(false);
    const fetches = await page.evaluate(() => window.__fetches);
    expect(fetches).toEqual([]);
  });

  test("nodes and the planner sit on a solid surface", async ({ page }) => {
    const bg = await page.locator(".node").first().evaluate((el) => getComputedStyle(el).backgroundColor);
    const blur = await page.locator(".node").first().evaluate((el) => getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter || "none");
    expect(bg).toBe("rgb(18, 18, 18)");
    expect(blur === "none" || blur === "").toBe(true);
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(font.toLowerCase()).toContain("system-ui");
  });

  test("axe on Try it, the planner, and Studio", async ({ page }) => {
    await page.getByTestId("try-run").click();
    await expect(page.getByTestId("planner-panel")).toBeVisible();
    const planner = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    await page.locator("#open-ontology").click();
    await expect(page.getByTestId("ontology-studio")).toBeVisible();
    const studio = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const brief = (result) => result.violations.map((row) => ({
      id: row.id,
      impact: row.impact,
      nodes: row.nodes.length,
      help: row.help,
      targets: row.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    }));
    const out = { planner: brief(planner), studio: brief(studio) };
    fs.mkdirSync(SCREENS, { recursive: true });
    fs.writeFileSync(path.join(SCREENS, "axe-try-it.json"), JSON.stringify(out, null, 2));
    const serious = []
      .concat(planner.violations, studio.violations)
      .filter((row) => row.impact === "serious" || row.impact === "critical");
    expect(serious, JSON.stringify(out, null, 2)).toEqual([]);
  });
});
