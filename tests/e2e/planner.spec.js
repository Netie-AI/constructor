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
    await expect(panel.getByTestId("planner-budget")).toContainText("20");
    await expect(panel.getByTestId("planner-budget")).toContainText("unlimited");
    await expect(panel.getByTestId("settings-source")).toContainText("Constructor");
    await expect(panel.getByTestId("effort-choice")).toContainText("auto chose medium");
    await expect(panel.getByTestId("effort-choice")).toContainText("predicted cost unknown");
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

  test("effort picker shows the cost preview and the confirm gate", async ({ page }) => {
    await page.locator("#chat-close").click();
    await page.evaluate(() => {
      const plan = window.Planner.plan("Write a javascript function that checks the plan schema", {
        synthetic: true,
        diffNames: ["planner.js", "planner-ui.js"],
      });
      window.PlannerUI.render(plan, { full: true });
    });
    const efforts = page.getByTestId("planner-efforts");
    await expect(efforts).toBeVisible();
    await expect(efforts.getByTestId("effort-low")).toContainText("No code");
    await expect(efforts.getByTestId("effort-low").getByTestId("effort-cost")).toHaveText("cost unknown");
    await expect(efforts.getByTestId("effort-low").getByTestId("effort-tokens")).toHaveText("tokens unknown");
    await expect(efforts.getByTestId("effort-low").getByTestId("effort-wire")).toContainText("cortex / governed");
    await expect(efforts.getByTestId("effort-medium")).toContainText("one module");
    await expect(efforts.getByTestId("effort-high").getByTestId("effort-wire")).toContainText("cursor-cloud-agents / outsourced-coding");
    await expect(efforts.getByTestId("effort-high")).toContainText("one PR with tests");
    await expect(efforts.getByTestId("effort-high").getByTestId("effort-brief")).toContainText("planner.js");
    await expect(efforts.getByTestId("effort-choice")).toContainText("auto chose high");
    await expect(efforts.getByTestId("effort-choice")).toContainText("predicted cost unknown");
    await expect(efforts.getByTestId("effort-log")).toContainText("build-code");
    await expect(efforts.getByTestId("effort-remaining")).toContainText("unlimited");
    await expect(efforts.getByTestId("effort-low").getByTestId("effort-cap")).toContainText("unlimited");
    await expect(efforts.getByTestId("effort-max")).toContainText("unlimited");
    await expect(efforts.getByTestId("effort-high-confirm")).toHaveCount(0);
    await efforts.getByTestId("planner-settings-open").click();
    await expect(efforts.getByTestId("settings-mode")).toHaveValue("auto");
    await expect(efforts.getByTestId("settings-confirm")).not.toBeChecked();
    await expect(efforts.getByTestId("settings-paid-call")).toHaveValue("");
    const fetches = await page.evaluate(() => window.__fetches);
    expect(fetches).toEqual([]);
    await efforts.screenshot({ path: shot("planner-effort-preview.png") });
    await page.getByTestId("planner-settings").screenshot({ path: shot("planner-settings.png") });

    await efforts.getByTestId("effort-high-start").click();
    await expect(page.getByTestId("effort-gate")).toContainText("No prompt is sent");
    const after = await page.evaluate(() => window.__fetches);
    expect(after).toEqual([]);
  });

  test("settings persist after reload and an empty cap stays unlimited", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem("netie.constructor.planner.settings");
      localStorage.removeItem("netie.constructor.planner.log");
    });
    await page.locator("#chat-close").click();
    await page.getByTestId("open-planner").click();
    await page.getByTestId("planner-settings-open").click();
    await page.getByTestId("settings-paid-call").fill("1.5");
    await page.getByTestId("settings-run").fill("12");
    await page.getByTestId("settings-max").fill("40");
    await page.getByTestId("settings-confirm").check();
    await page.getByTestId("settings-save").click();
    await expect(page.getByTestId("effort-remaining")).toContainText("$1.5");
    await expect(page.getByTestId("effort-remaining")).toContainText("$12");
    await expect(page.getByTestId("effort-remaining")).toContainText("$40");
    await expect(page.getByTestId("effort-choice")).toContainText("auto chose low");
    await expect(page.getByTestId("effort-high-confirm")).toHaveCount(0);
    await page.getByTestId("effort-high-start").click();
    await expect(page.getByTestId("effort-gate")).toContainText("No prompt is sent");
    await page.screenshot({ path: shot("planner-settings-saved.png") });

    await page.reload();
    await expect(page.locator(".node")).toHaveCount(8);
    const close = page.locator("#chat-close");
    if (await close.isVisible()) await close.click();
    await page.getByTestId("open-planner").click();
    await page.getByTestId("planner-settings-open").click();
    await expect(page.getByTestId("settings-paid-call")).toHaveValue("1.5");
    await expect(page.getByTestId("settings-run")).toHaveValue("12");
    await expect(page.getByTestId("settings-max")).toHaveValue("40");
    await expect(page.getByTestId("settings-confirm")).toBeChecked();
    await expect(page.getByTestId("settings-mode")).toHaveValue("auto");
    await page.getByTestId("settings-paid-call").fill("");
    await page.getByTestId("settings-run").fill("");
    await page.getByTestId("settings-max").fill("");
    await page.getByTestId("settings-save").click();
    await expect(page.getByTestId("effort-remaining")).toContainText("per call unlimited");
    await expect(page.getByTestId("effort-remaining")).toContainText("per run unlimited");
    await expect(page.getByTestId("effort-choice")).toContainText("auto chose medium");
    await expect(page.getByTestId("effort-low").getByTestId("effort-wire")).toContainText("cortex / governed");
    const fetches = await page.evaluate(() => window.__fetches);
    expect(fetches).toEqual([]);
  });

  test("DMS settings override local settings and an invalid payload falls back", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("netie.constructor.planner.settings", JSON.stringify({
        schema: "netie.planner-settings/1",
        effortMode: "auto",
        confirm: false,
        paidCallUsd: null,
        runUsd: 12,
        maxLevelBudgetUsd: null,
        spentUsd: null,
      }));
    });
    await page.locator("#chat-close").click();
    await page.getByTestId("open-planner").click();
    await expect(page.getByTestId("settings-source")).toContainText("Constructor");
    await expect(page.getByTestId("effort-remaining")).toContainText("$12");
    await page.evaluate(() => {
      window.postMessage({
        type: "netie.planner-settings",
        settings: {
          schema: "netie.planner-settings/1",
          effortMode: "auto",
          confirm: false,
          paidCallUsd: null,
          runUsd: 2,
          maxLevelBudgetUsd: null,
          spentUsd: null,
        },
      }, "*");
    });
    await expect(page.getByTestId("settings-source")).toContainText("DMS");
    await expect(page.getByTestId("effort-remaining")).toContainText("$2");
    await expect(page.getByTestId("effort-high-confirm")).toHaveCount(0);
    await expect(page.getByTestId("settings-source-warning")).toHaveCount(0);
    await page.screenshot({ path: shot("planner-settings-dms.png") });
    await page.evaluate(() => {
      window.postMessage({
        type: "netie.planner-settings",
        settings: { schema: "netie.planner-settings/1", effortMode: "turbo", runUsd: 2 },
      }, "*");
    });
    await expect(page.getByTestId("settings-source-warning")).toContainText("DMS settings were rejected");
    await expect(page.getByTestId("settings-source")).toContainText("Constructor");
    await expect(page.getByTestId("effort-remaining")).toContainText("$12");
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("netie.constructor.planner.settings")).runUsd);
    expect(stored).toBe(12);
    const fetches = await page.evaluate(() => window.__fetches);
    expect(fetches).toEqual([]);
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
