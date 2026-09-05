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
    await expect(page.locator("#play-ticks")).toHaveText("0 ticks");
    await page.locator("#run-graph").click();
    await expect(page.locator("#chat-log .bubble.assistant").last()).toContainText("Ghost run");
    await expect(page.locator("#play-ticks")).toHaveText("1 tick");
  });

  test("Check button loads infer, ghosts, and reports gaps", async ({ page }) => {
    const replies = page.locator("#chat-log .bubble.assistant");
    const before = await replies.count();
    await page.locator("#check-path").click();
    await expect(replies).toHaveCount(before + 1);
    await expect(replies.last()).toContainText("Check done");
    await expect(replies.last()).toContainText("Ghost");
    await expect(page.locator(".node[data-kind=trigger]")).toHaveCount(1);
    await expect(page.locator("#play-lab")).toHaveText("infer");
    await expect(page.locator("#play-ticks")).toHaveText("1 tick");
  });

  test("factory pressure chat is retrain, not pptx", async ({ page }) => {
    const reply = await chat(
      page,
      "8 pressure sensors from factory c ingest last week's anomaly model then retrain"
    );
    await expect(reply).toContainText("Ghost sketch");
    await expect(reply).toContainText("factory.c");
    await expect(reply).not.toContainText("export_pptx");
    await expect(reply).not.toContainText("Assumed inventory");
    await expect(page.locator("#play-lab")).toHaveText("retrain");
    await page.locator(".node[data-kind=foundry]").click();
    await expect(page.locator("#inspect-card")).toContainText("Cortex DAG");
    await expect(page.locator("#inspect-card")).not.toContainText("export_pptx");
  });

  test("cctv human detection is owned infer, not watchlist", async ({ page }) => {
    const reply = await chat(page, "create a full flow for cctv human detection");
    await expect(reply).toContainText("Ghost sketch");
    await expect(reply).not.toContainText("Assumed inventory");
    await expect(page.locator(".node[data-kind=trigger]")).toHaveCount(1);
    await expect(page.locator("#play-lab")).toHaveText("infer");
    await page.locator(".node[data-kind=insight]").click();
    await expect(page.getByTestId("region-mark")).toBeVisible();
    await expect(page.getByTestId("region-mark")).toContainText("human");
  });

  test("cortex brain shows pages-sketch compile", async ({ page }) => {
    await expect(page.getByTestId("cortex-brain")).toContainText("pages-sketch");
    await page.locator("[data-seed=train]").click();
    await expect(page.getByTestId("cortex-brain")).toContainText("train");
    await page.screenshot({ path: shot("cortex-brain.png") });
  });

  test("email chat is a Gmail draft, not pptx", async ({ page }) => {
    const reply = await chat(page, "generate email connector with grant access send to my email");
    await expect(reply).toContainText("Ghost notify");
    await expect(reply).not.toContainText("export_pptx");
    await expect(page.locator("#play-lab")).toHaveText("warehouse");
    await page.locator(".node[data-kind=tool_call]").click();
    await expect(page.locator("#inspect-card")).toContainText("draft_email");
  });
});
