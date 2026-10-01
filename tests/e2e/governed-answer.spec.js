// Governed Answer panel: file picker, three render states, Pages URL refusal.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const FIXTURE = path.join(__dirname, "..", "fixtures", "governed-answer.example.jsonl");
const SCREENS = path.join(__dirname, "..", "..", "test-results", "screens");

function shot(name) {
  fs.mkdirSync(SCREENS, { recursive: true });
  return path.join(SCREENS, name);
}

test.describe("governed answer", () => {
  let errors;

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push("console.error: " + msg.text());
    });
    page.on("pageerror", (err) => errors.push("pageerror: " + err.message));
    await page.goto("/");
    await expect(page.locator("#governed-answer")).toBeVisible();
    await expect(page.locator("#ga-status")).toContainText("No stored run");
  });

  test.afterEach(async () => {
    expect(errors, "browser console must stay clean").toEqual([]);
  });

  test("file picker renders governed, no-link, and withheld", async ({ page }) => {
    await page.setInputFiles("#ga-file", FIXTURE);
    await expect(page.locator("#ga-status")).toContainText("example data, not a measured result");
    await expect(page.locator('[data-testid="ga-card"]')).toHaveCount(9);

    const governed = page.locator('[data-testid="ga-card"][data-state="governed"]').first();
    await expect(governed.locator('[data-testid="ga-badge"]')).toHaveText("governed");
    await expect(governed.locator('[data-testid="ga-sql"]')).toContainText("SELECT example_col FROM example_table");
    await expect(governed.locator('[data-testid="ga-rows"]')).toContainText("example-token");
    await expect(governed.locator('[data-testid="ga-source"]')).toContainText("example-source");
    await expect(governed.locator('[data-testid="ga-source"]')).toContainText("example_table");
    await expect(governed.locator('[data-testid="ga-link"]')).toContainText("example_key");
    await expect(governed.locator('[data-testid="ga-verdict"]')).toContainText("row-match: match");
    await expect(governed.locator('[data-testid="ga-example"]')).toHaveText("example data, not a measured result");
    await governed.screenshot({ path: shot("governed-answer-governed.png") });

    const unlinked = page.locator('[data-testid="ga-card"][data-state="unlinked"]');
    await expect(unlinked.locator('[data-testid="ga-badge"]')).toHaveCount(0);
    await expect(unlinked.locator('[data-testid="ga-idea"]')).toHaveText("example model idea with no ontology link");
    await expect(unlinked.locator('[data-testid="ga-values"]')).toHaveText("");
    await expect(unlinked).toContainText("no link");
    await unlinked.screenshot({ path: shot("governed-answer-nolink.png") });

    const withheld = page.locator('[data-testid="ga-card"][data-state="withheld"]');
    await expect(withheld.locator('[data-testid="ga-withheld"]')).toHaveText("WITHHELD");
    await expect(withheld.locator('[data-testid="ga-badge"]')).toHaveCount(0);
    await expect(withheld.locator('[data-testid="ga-sql"]')).toHaveCount(0);
    await expect(withheld.locator('[data-testid="ga-rows"]')).toHaveCount(0);
    await expect(withheld).not.toContainText("424242");
    await withheld.screenshot({ path: shot("governed-answer-withheld.png") });

    const refused = page.locator('[data-testid="ga-card"][data-state="refused"]').first();
    await expect(refused.locator('[data-testid="ga-refused"]')).toHaveText("refused");
    await expect(refused.locator('[data-testid="ga-refusal-chip"]')).toHaveText("unlabelled");
    await expect(refused).not.toContainText("515151");

    const forecast = page.locator('[data-testid="ga-card"][data-state="governed"]').nth(1);
    await expect(forecast.locator('[data-testid="ga-rows"]')).toContainText("example-forecast-token");
    await expect(forecast.locator('[data-testid="ga-badge"]')).toHaveText("governed");

    await page.locator("#governed-answer").screenshot({ path: shot("governed-answer-panel.png") });
  });

  test("refusal filter maps GEN-01 and leaves other codes unlabelled", async ({ page }) => {
    await page.setInputFiles("#ga-file", FIXTURE);
    const filter = page.locator("#ga-refusal-filter");
    await filter.selectOption("pacing (rate limit / no healthy key)");
    const pacing = page.locator('[data-testid="ga-card"]');
    await expect(pacing).toHaveCount(1);
    await expect(pacing).toHaveAttribute("data-state", "refused");
    await expect(pacing.locator('[data-testid="ga-refusal-chip"]')).toHaveText("pacing (rate limit / no healthy key)");
    await expect(pacing.locator('[data-testid="ga-badge"]')).toHaveCount(0);
    await expect(pacing).not.toContainText("insights_timeout");
    await pacing.screenshot({ path: shot("governed-answer-refused-pacing.png") });
    for (const reason of ["not yet an approved query", "wrong level of detail", "truly missing data"]) {
      await filter.selectOption(reason);
      await expect(page.locator('[data-testid="ga-card"]')).toHaveCount(0);
    }
    await filter.selectOption("unlabelled");
    const unlabelled = page.locator('[data-testid="ga-card"]');
    await expect(unlabelled).toHaveCount(4);
    await expect(unlabelled.first()).toHaveAttribute("data-state", "refused");
    await expect(unlabelled.locator('[data-testid="ga-refusal-chip"]').first()).toHaveText("unlabelled");
    await expect(page.locator('[data-testid="ga-missing"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="ga-would-answer"]')).toHaveCount(0);
    await expect(unlabelled).not.toContainText("515151");
    await unlabelled.first().screenshot({ path: shot("governed-answer-refused-unlabelled.png") });
    await filter.selectOption("refusals");
    await expect(page.locator('[data-testid="ga-card"]')).toHaveCount(5);
    await filter.selectOption("");
    await expect(page.locator('[data-testid="ga-card"]')).toHaveCount(9);
  });

  test("shared answer stays withheld and uses the i popover", async ({ page }) => {
    const answer = page.getByTestId("ga-shared-answer");
    await expect(answer.getByTestId("ga-shared-title")).toHaveText("Answer");
    await expect(answer.getByTestId("ga-shared-badge")).toHaveText("badge off");
    await expect(answer.getByTestId("ga-shared-state")).toHaveText("withheld");
    await expect(answer.getByTestId("ga-shared-values")).toHaveText("values empty");
    const btn = page.getByTestId("ga-info");
    const pop = page.locator("#info-ga-answer");
    await expect(btn).toHaveClass(/info-btn/);
    await expect(pop).toHaveClass(/info-pop/);
    await expect(pop).toHaveAttribute("role", "dialog");
    await expect(pop).toBeHidden();
    await btn.hover();
    await expect(btn).toHaveAttribute("aria-expanded", "true");
    await expect(pop).toBeVisible();
    await expect(pop).toContainText("GEN-01: insights_timeout");
    await page.keyboard.press("Escape");
    await expect(pop).toBeHidden();
    await page.setInputFiles("#ga-file", FIXTURE);
    const loaded = await page.evaluate(() => window.SkinState.get().answer);
    expect(loaded.state).toBe("withheld");
    expect(loaded.badge).toBe(false);
    expect(loaded.values).toEqual([]);
    await page.evaluate(() => {
      const cur = window.SkinState.get();
      window.SkinState.set(Object.assign({}, cur, {
        answer: { title: "Ledger", state: "linked", badge: true, values: ["999"] },
      }));
    });
    await expect(answer.getByTestId("ga-shared-title")).toHaveText("Ledger");
    await expect(answer.getByTestId("ga-shared-badge")).toHaveText("badge off");
    await expect(answer.getByTestId("ga-shared-state")).toHaveText("withheld");
    await expect(answer.getByTestId("ga-shared-values")).toHaveText("values empty");
    const after = await page.evaluate(() => window.SkinState.get().answer);
    expect(after.state).toBe("withheld");
    expect(after.badge).toBe(false);
    expect(after.values).toEqual([]);
    await expect(page.locator("#governed-answer")).not.toContainText("999");
    await page.locator("#governed-answer").screenshot({ path: shot("governed-answer-panel.png") });
  });

  test("URL load does not fetch on the Pages sketch", async ({ page }) => {
    const hits = [];
    page.on("request", (req) => {
      if (/example\.com|openai|cortex/.test(req.url())) hits.push(req.url());
    });
    await page.fill("#ga-url", "https://example.com/runs/phase.jsonl");
    await page.click("#ga-load-url");
    await expect(page.locator("#ga-status")).toContainText("Pages never fetch");
    expect(hits).toEqual([]);
    await expect(page.locator('[data-testid="ga-card"]')).toHaveCount(0);
  });
});
