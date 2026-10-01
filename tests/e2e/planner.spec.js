// Planner canvas: plan, answer-spec chips, ontology proposal cards.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const SCREENS = path.join(__dirname, "..", "..", "test-results", "screens");
function shot(name) {
  fs.mkdirSync(SCREENS, { recursive: true });
  return path.join(SCREENS, name);
}

async function chat(page, text) {
  const replies = page.locator("#chat-log .bubble.assistant");
  const before = await replies.count();
  await page.fill("#chat-input", text);
  await page.press("#chat-input", "Enter");
  await expect(replies).toHaveCount(before + 1);
  return replies.last();
}

test.describe("planner", () => {
  let errors;

  test.beforeEach(async ({ page }) => {
    errors = [];
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
  });

  test.afterEach(async () => {
    expect(errors, "browser console must stay clean").toEqual([]);
  });

  test("demo plan, spec chips, and proposed ontology cards render on the canvas", async ({ page }) => {
    await page.locator("#chat-close").click();
    await page.getByTestId("open-planner").click();
    const panel = page.getByTestId("planner-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId("planner-intent")).toHaveText("database");
    await expect(panel.getByTestId("planner-synthetic")).toContainText("synthetic example");
    await expect(panel.getByTestId("planner-goal")).toContainText("governed row answer");
    await expect(panel.getByTestId("planner-success")).toBeVisible();
    await expect(panel.getByTestId("planner-steps")).toContainText("DMS SQL");
    await expect(panel.getByTestId("planner-budget")).toContainText("$0.02");
    await expect(panel.getByTestId("planner-budget")).toContainText("$5");
    await expect(panel.getByTestId("planner-gates")).toContainText("withheld");
    await expect(panel.getByTestId("planner-chip")).toHaveCount(6);
    await expect(panel.locator("[data-kind=grain]")).toContainText("one row per order");
    await expect(panel.locator("[data-kind=column]")).toHaveCount(3);
    await expect(panel.getByTestId("planner-card").first()).toContainText("PROPOSED");
    await expect(panel.getByTestId("planner-ontology")).not.toContainText("CERTIFIED");
    const fetches = await page.evaluate(() => window.__fetches);
    expect(fetches).toEqual([]);
    await page.screenshot({ path: shot("planner-canvas.png") });
    await panel.getByTestId("planner-plan-body").screenshot({ path: shot("planner-plan.png") });
    await panel.getByTestId("planner-spec").screenshot({ path: shot("planner-spec-chips.png") });
    await panel.getByTestId("planner-ontology").screenshot({ path: shot("planner-ontology-cards.png") });

    const first = panel.getByTestId("planner-card").first();
    await first.getByTestId("planner-accept").click();
    await expect(first).toContainText("ACCEPTED");
    await expect(first).not.toContainText("CERTIFIED");
    const stillProposed = panel.locator("[data-status=proposed]");
    await expect(stillProposed.first()).toBeVisible();
    await panel.getByTestId("planner-ontology").screenshot({ path: shot("planner-ontology-accepted.png") });

    const specDownload = page.waitForEvent("download");
    await panel.getByTestId("planner-export-spec").click();
    const specFile = await specDownload;
    const specPath = path.join(SCREENS, "answer-spec.json");
    await specFile.saveAs(specPath);
    const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
    expect(spec.schema).toBe("netie.answer-spec/1");
    expect(spec.columns).toEqual(["order_id", "status", "region"]);
    expect(spec.sql).toBeUndefined();

    const ontoDownload = page.waitForEvent("download");
    await panel.getByTestId("planner-export-ontology").click();
    const ontoFile = await ontoDownload;
    const ontoPath = path.join(SCREENS, "ontology-proposals.json");
    await ontoFile.saveAs(ontoPath);
    const exported = JSON.parse(fs.readFileSync(ontoPath, "utf8"));
    expect(exported.certified).toBe(false);
    expect(exported.items).toHaveLength(1);
    expect(exported.items[0].status).toBe("accepted");
  });

  test("an unclear request asks one question and does not ghost-compile", async ({ page }) => {
    const reply = await chat(page, "Do the thing");
    await expect(reply).toContainText("Which job is this");
    await expect(reply).not.toContainText("Ghost sketch");
    await expect(page.getByTestId("planner-panel")).toBeVisible();
    await expect(page.getByTestId("planner-intent")).toHaveText("unclear");
    await expect(page.getByTestId("planner-clarify")).toContainText("?");
    const fetches = await page.evaluate(() => window.__fetches);
    expect(fetches).toEqual([]);
  });

  test("a database chat shows spec chips on the canvas", async ({ page }) => {
    await chat(page, "Show the invoice rows for supplier north, columns invoice_id amount");
    const panel = page.getByTestId("planner-panel");
    await expect(panel.getByTestId("planner-intent")).toHaveText("database");
    await expect(panel.locator("[data-kind=column]").nth(0)).toHaveText("invoice_id");
    await expect(panel.locator("[data-kind=column]").nth(1)).toHaveText("amount");
    await expect(page.locator("#power")).toContainText("Sketch (no fetch)");
  });

  test("planner panel fits a narrow viewport", async ({ page }) => {
    await page.locator("#chat-close").click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId("open-planner").click();
    const panel = page.getByTestId("planner-panel");
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box.width).toBeLessThanOrEqual(390);
    await expect(panel.getByTestId("planner-intent")).toHaveText("database");
  });
});
