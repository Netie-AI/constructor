// Labs: train / infer / retrain stay 8 nodes. Infer shows a mock region mark.
// Pages never fetch. Ghost ticks are a walk counter, not XP.
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

test.describe("labs", () => {
  let errors;

  test.beforeEach(async ({ page }) => {
    errors = [];
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

  test("train lab keeps 8 nodes and stream connector", async ({ page }) => {
    await page.locator("[data-seed=train]").click();
    await expect(page.locator("#nodes .node")).toHaveCount(8);
    await expect(page.locator("#play-lab")).toHaveText("train");
    await expect(page.locator("#play-insight")).toContainText("Mock train");
    await page.locator(".node[data-kind=connector]").click();
    await expect(page.locator("#inspect-card")).toContainText("stream");
    await page.screenshot({ path: shot("lab-train.png") });
  });

  test("infer lab has trigger + mock region mark", async ({ page }) => {
    await page.locator("[data-seed=infer]").click();
    await expect(page.locator("#nodes .node")).toHaveCount(8);
    await expect(page.locator(".node[data-kind=trigger]")).toHaveCount(1);
    await expect(page.locator(".node[data-kind=enhance]")).toHaveCount(1);
    await expect(page.locator("#wires path")).toHaveCount(7);
    await page.locator(".node[data-kind=insight]").click();
    await expect(page.getByTestId("region-mark")).toBeVisible();
    await expect(page.getByTestId("region-mark")).toContainText("bent_particle");
    await expect(page.locator("#play-insight")).toContainText("bent particle");
    await page.screenshot({ path: shot("lab-infer.png") });
  });

  test("retrain lab is Cortex DAG notes, not Airflow", async ({ page }) => {
    await page.locator("[data-seed=retrain]").click();
    await expect(page.locator("#nodes .node")).toHaveCount(8);
    await page.locator(".node[data-kind=foundry]").click();
    await expect(page.locator("#inspect-card")).toContainText("Cortex DAG");
    await expect(page.locator("#inspect-card")).toContainText("Not Apache Airflow");
    await page.screenshot({ path: shot("lab-retrain.png") });
  });

  test("voice and image labs reuse 8 kinds", async ({ page }) => {
    await page.locator("details.quiet summary").first().click();
    await page.locator("[data-seed=voice]").click();
    await expect(page.locator("#nodes .node")).toHaveCount(8);
    await expect(page.locator("#play-lab")).toHaveText("voice");
    await page.locator("[data-seed=image]").click();
    await expect(page.locator("#nodes .node")).toHaveCount(8);
    await page.locator(".node[data-kind=insight]").click();
    await expect(page.getByTestId("region-mark")).toContainText("artifact");
  });

  test("chat lab infer and define block", async ({ page }) => {
    const loaded = await chat(page, "lab infer");
    await expect(loaded).toContainText("infer");
    await expect(page.locator(".node[data-kind=trigger]")).toHaveCount(1);
    const defined = await chat(page, "define block particle.mark");
    await expect(defined).toContainText("Defined block particle.mark");
    await expect(page.locator(".node")).toHaveCount(9);
    await expect(page.locator(".node[data-kind=tool_call]")).toHaveCount(1);
  });

  test("ghost run bumps play ticks", async ({ page }) => {
    const before = await page.locator("#play-ticks").textContent();
    const n = parseInt(before, 10) || 0;
    await page.locator("#run-graph").click();
    await expect(page.locator("#chat-log .bubble.assistant").last()).toContainText("Ghost run");
    const expectLabel = n + 1 === 1 ? "1 tick" : n + 1 + " ticks";
    await expect(page.locator("#play-ticks")).toHaveText(expectLabel);
  });

  test("loop lab is a walkable ingest-train-infer-retrain cycle", async ({ page }) => {
    await page.locator("[data-seed=loop]").click();
    await expect(page.locator("#nodes .node")).toHaveCount(8);
    await expect(page.locator(".node[data-kind=train]")).toHaveCount(1);
    await expect(page.locator(".node[data-kind=infer]")).toHaveCount(1);
    await expect(page.locator(".node[data-kind=retrain]")).toHaveCount(1);
    await expect(page.locator("#play-lab")).toHaveText("loop");
    await expect(page.locator("#phase-strip [data-phase=ingest]")).toHaveClass(/on/);
    await expect(page.locator("#play-insight")).toContainText("Phase 1/4 ingest");
    await page.locator("#run-graph").click();
    await expect(page.locator("#chat-log .bubble.assistant").last()).toContainText("loss=");
    await expect(page.locator("#chat-log .bubble.assistant").last()).toContainText("Loaded 12");
    await expect(page.locator("#play-insight")).toContainText("loss=");
    await expect(page.locator("#phase-strip [data-phase=train]")).toHaveClass(/on/);
    await page.locator("#phase-strip [data-phase=retrain]").click();
    await expect(page.locator("#phase-strip [data-phase=retrain]")).toHaveClass(/on/);
    await expect(page.locator(".node[data-kind=retrain]")).toHaveClass(/phase-now/);
    await page.locator(".node[data-kind=train] .node-edit").click();
    await expect(page.locator("#event-title")).toHaveText("Train");
    await expect(page.getByTestId("block-io")).toContainText("weights");
    await page.screenshot({ path: shot("lab-loop.png") });
  });

  test("help mark explains Run press and type", async ({ page }) => {
    await page.locator('[data-help=run]').click();
    await expect(page.locator("#help-pop")).toBeVisible();
    await expect(page.locator("#help-title")).toHaveText("Run");
    await expect(page.locator("#help-press")).toHaveText("Run");
    await expect(page.locator("#help-type")).toHaveText("run");
    await expect(page.locator("#help-body")).toContainText("Ghost-walks");
    await page.screenshot({ path: shot("help-run.png") });
    await page.locator("#help-close").click();
    await expect(page.locator("#help-pop")).toBeHidden();
  });

  test("chat chip lab loop and add train are interactive", async ({ page }) => {
    await page.locator('#chat-chips [data-chip="lab loop"]').click();
    await expect(page.locator("#chat-log .bubble.assistant").last()).toContainText("loop");
    await expect(page.locator(".node[data-kind=train]")).toHaveCount(1);
    await page.locator("[data-add=train]").click();
    await expect(page.locator(".node[data-kind=train]")).toHaveCount(2);
    await expect(page.locator("#cal-pop")).toBeVisible();
    await expect(page.locator("#event-title")).toHaveText("Train");
  });
});
