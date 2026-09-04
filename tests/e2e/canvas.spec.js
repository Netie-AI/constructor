// Canvas e2e: sample graph, rail add, chat commands, approaches, ghost toggle, reset.
// Runs against the static site on http://127.0.0.1:8125 (see playwright.config.js).
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

async function openMoreBlocks(page) {
  const panel = page.locator("details.quiet").filter({ has: page.locator("[data-add=agent]") });
  await panel.locator("summary").click();
  await expect(page.locator("[data-add=agent]")).toBeVisible();
}

test.describe("canvas", () => {
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

  test("renders 8 sample nodes with zero console errors", async ({ page }) => {
    await expect(page.locator("#nodes .node")).toHaveCount(8);
    await expect(page.locator(".node[data-kind=ingest]")).toHaveCount(1);
    await expect(page.locator(".node[data-kind=ontology]")).toHaveCount(1);
    await expect(page.locator(".node[data-kind=app]")).toHaveCount(1);
    await expect(page.locator("#wires path")).toHaveCount(7);
    await expect(page.locator("#chat-log .bubble.assistant").first()).toContainText("Chat warehouse");
    await expect(page.locator("#power")).toContainText("Sketch (no fetch)");
    await expect(page.locator("#approaches .approach")).toHaveCount(3);
    expect(errors, "console errors after load").toEqual([]);
    await page.screenshot({ path: shot("canvas-default.png") });
  });

  test("rail [data-add=agent] adds a 9th node and opens #cal-pop", async ({ page }) => {
    await expect(page.locator("#cal-pop")).toBeHidden();
    await openMoreBlocks(page);
    await page.locator("[data-add=agent]").click();
    await expect(page.locator(".node")).toHaveCount(9);
    await expect(page.locator(".node[data-kind=agent]")).toHaveCount(1);
    await expect(page.locator("#cal-pop")).toBeVisible();
    await expect(page.locator("#event-title")).toHaveText("Agent");
    await expect(page.locator("#event-fields select[name=persona]")).toHaveValue("worker");
    await page.screenshot({ path: shot("canvas-popover.png") });
    await page.locator("#event-close").click();
    await expect(page.locator("#cal-pop")).toBeHidden();
  });

  test("app edit is a skin, not a warehouse fetch", async ({ page }) => {
    await page.locator(".node[data-kind=app] .node-edit").click();
    await expect(page.locator("#event-title")).toHaveText("App");
    await expect(page.locator("#event-fields select[name=skin]")).toHaveValue("warehouse");
    await expect(page.locator("#event-fields select[name=fetch_from]")).toHaveCount(0);
    await expect(page.locator("#event-fields select[name=action_type]")).toHaveCount(0);
    await expect(page.getByTestId("block-io")).toContainText("EMIT warehouse");
    await page.locator("#event-close").click();
    await page.locator(".node[data-kind=ingest] .node-edit").click();
    await expect(page.locator("#event-fields select[name=fetch_from]")).toHaveValue("warehouse.inventory");
    await expect(page.locator("#event-fields select[name=skin]")).toHaveCount(0);
  });

  test("chat 'add audit' adds a node", async ({ page }) => {
    const reply = await chat(page, "add audit");
    await expect(reply).toContainText("Added audit");
    await expect(page.locator(".node")).toHaveCount(9);
    await expect(page.locator(".node[data-kind=audit]")).toHaveCount(2);
  });

  test("chat 'propose 3' renders .approach cards with one .winner", async ({ page }) => {
    const reply = await chat(page, "propose 3");
    await expect(reply).toContainText("Ranked 3");
    await expect(reply).toContainText("Winner:");
    const cards = page.locator("#approaches .approach");
    await expect(cards).toHaveCount(3);
    await expect(page.locator("#approaches .approach.winner")).toHaveCount(1);
    await expect(cards.first()).toHaveClass(/winner/);
    await expect(cards.first().locator(".eyebrow")).toContainText("WINNER");
    await page.screenshot({ path: shot("canvas-propose.png") });

    // The header button routes through the same command.
    await page.locator("#propose").click();
    await expect(page.locator("#chat-log .bubble.assistant").last()).toContainText("Ranked 3");
    await expect(page.locator("#approaches .approach.winner")).toHaveCount(1);
  });

  test("ghost toggle text flips", async ({ page }) => {
    const btn = page.locator("#ghost-toggle");
    await expect(btn).toHaveText("Ghost on");
    await expect(page.locator("body")).toHaveClass(/ghost-mode/);
    await btn.click();
    await expect(btn).toHaveText("Ghost off");
    await expect(page.locator("body")).not.toHaveClass(/ghost-mode/);
    await expect(page.locator("#chat-log .bubble.assistant").last()).toHaveText("Ghost off.");
    await btn.click();
    await expect(btn).toHaveText("Ghost on");
    await expect(page.locator("body")).toHaveClass(/ghost-mode/);
  });

  test("reset restores 8 nodes", async ({ page }) => {
    await openMoreBlocks(page);
    await page.locator("[data-add=agent]").click();
    await expect(page.locator(".node")).toHaveCount(9);
    await page.locator("#reset-graph").click();
    await expect(page.locator(".node")).toHaveCount(8);
    await expect(page.locator(".node[data-kind=agent]")).toHaveCount(0);
    await page.reload();
    await expect(page.locator(".node")).toHaveCount(8);
  });

  test("export JSON downloads the graph", async ({ page }) => {
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#export-json").click()]);
    expect(download.suggestedFilename()).toBe("constructor-graph.json");
    const parsed = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
    expect(Array.isArray(parsed.nodes)).toBe(true);
    expect(parsed.nodes).toHaveLength(8);
    expect(parsed.edges).toHaveLength(7);
  });
});
