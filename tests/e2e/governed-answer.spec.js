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

  test("refusal filter lists each reason and the unlabelled case", async ({ page }) => {
    await page.setInputFiles("#ga-file", FIXTURE);
    const filter = page.locator("#ga-refusal-filter");
    const reasons = [
      ["pacing (rate limit / no healthy key)", "governed-answer-refused-pacing.png"],
      ["not yet an approved query", "governed-answer-refused-not-approved.png"],
      ["wrong level of detail", "governed-answer-refused-wrong-detail.png"],
      ["truly missing data", "governed-answer-refused-missing-data.png"],
      ["unlabelled", "governed-answer-refused-unlabelled.png"],
    ];
    for (const pair of reasons) {
      await filter.selectOption(pair[0]);
      const cards = page.locator('[data-testid="ga-card"]');
      await expect(cards).toHaveCount(1);
      await expect(cards).toHaveAttribute("data-state", "refused");
      await expect(cards.locator('[data-testid="ga-refusal-chip"]')).toHaveText(pair[0]);
      await expect(cards.locator('[data-testid="ga-badge"]')).toHaveCount(0);
      await cards.screenshot({ path: shot(pair[1]) });
    }
    await filter.selectOption("truly missing data");
    await expect(page.locator('[data-testid="ga-missing"]')).toHaveText("missing: example measure");
    await expect(page.locator('[data-testid="ga-would-answer"]')).toHaveText("would answer: example_file");
    await filter.selectOption("unlabelled");
    await expect(page.locator('[data-testid="ga-card"]')).not.toContainText("515151");
    await filter.selectOption("refusals");
    await expect(page.locator('[data-testid="ga-card"]')).toHaveCount(5);
    await filter.selectOption("");
    await expect(page.locator('[data-testid="ga-card"]')).toHaveCount(9);
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
