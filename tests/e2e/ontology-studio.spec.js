// Ontology Studio e2e, written against docs/ONTOLOGY_STUDIO.md test ids.
// Every test skips (with a printed line) until the integration lane lands #open-ontology
// in index.html, so the canvas suite stays green in the meantime.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const SCREENS = path.join(__dirname, "..", "..", "test-results", "screens");
const STUDIO = "[data-testid=ontology-studio]";
const PREFERRED_OBJECT = "inventory";

function shot(name) {
  fs.mkdirSync(SCREENS, { recursive: true });
  return path.join(SCREENS, name);
}

// Loads the page; skips the calling test when the studio integration is not there yet.
async function loadOrSkip(page) {
  await page.goto("/");
  await expect(page.locator(".node").first()).toBeVisible();
  const landed = await page.locator("#open-ontology").count();
  if (!landed) {
    console.log("[ontology-studio.spec] SKIP: #open-ontology not in index.html yet (integration not landed)");
  }
  test.skip(!landed, "integration not landed yet");
}

async function openStudio(page) {
  await loadOrSkip(page);
  await page.locator("#open-ontology").click();
  const studio = page.locator(STUDIO);
  await expect(studio).toBeVisible();
  await page.getByTestId("os-tab-objects").click();
  await expect(page.getByTestId("os-list").locator("[data-id]").first()).toBeVisible();
  return studio;
}

async function selectObject(page, preferred) {
  const list = page.getByTestId("os-list");
  let row = list.locator('[data-id="' + preferred + '"]');
  if (!(await row.count())) row = list.locator("[data-id]").first();
  const id = await row.getAttribute("data-id");
  await row.click();
  await expect(page.getByTestId("os-editor")).toBeVisible();
  await expect(page.getByTestId("os-props").locator("[data-prop]").first()).toBeVisible();
  return id;
}

function hasProperty(page, obj, prop) {
  return page.evaluate(
    ([o, p]) => {
      const g = window.Ontology && window.Ontology.get();
      const t = g && g.objectTypes && g.objectTypes[o];
      return !!(t && t.properties && t.properties[p]);
    },
    [obj, prop]
  );
}

async function addProperty(page, obj, propId, type) {
  const props = page.getByTestId("os-props");
  const before = await props.locator("[data-prop]").count();
  await page.getByTestId("os-prop-add").click();
  await expect(props.locator("[data-prop]")).toHaveCount(before + 1);
  const row = props.locator("[data-prop]").last();
  const idInput = row.locator("input:not([type=checkbox])").first();
  await idInput.fill(propId);
  await idInput.blur();
  const named = props.locator('[data-prop="' + propId + '"]');
  await expect(named).toHaveCount(1);
  await named.locator("select").first().selectOption(type);
  await expect.poll(() => hasProperty(page, obj, propId), { message: "Ontology.get() has " + obj + "." + propId }).toBe(true);
}

test.describe("ontology studio", () => {
  test("opens via #open-ontology and lists >= 11 object types", async ({ page }) => {
    await openStudio(page);
    await expect(page.locator(".node[data-kind=ontology] .sub").first()).toContainText("objects");
    const rows = page.getByTestId("os-list").locator("[data-id]");
    await expect.poll(() => rows.count()).toBeGreaterThanOrEqual(11);
    await expect(page.getByTestId("os-badge")).toBeVisible();
    await selectObject(page, PREFERRED_OBJECT);
    await page.screenshot({ path: shot("studio-objects.png") });
  });

  test("add property batch_no reaches Ontology.get() and the canvas Data point select", async ({ page }) => {
    await openStudio(page);
    const obj = await selectObject(page, PREFERRED_OBJECT);
    await addProperty(page, obj, "batch_no", "string");
    expect(await page.evaluate((o) => window.Ontology.propertyType(o, "batch_no"), obj)).toBe("string");

    await page.getByTestId("os-close").click();
    await expect(page.locator(STUDIO)).toBeHidden();

    await page.locator(".node[data-kind=ingest] .node-edit").first().click();
    await expect(page.locator("#cal-pop")).toBeVisible();
    await page.locator("#cal-pop select[name=object_type]").selectOption(obj);
    await expect(page.locator("#cal-pop select[name=object_type]")).toHaveValue(obj);
    await expect(page.locator('#cal-pop select[name=data_point] option[value="batch_no"]')).toHaveCount(1);
    await page.locator("#cal-pop select[name=data_point]").selectOption("batch_no");
    await expect(page.locator("#cal-pop select[name=data_type]")).toHaveValue("string");
  });

  test("removing the primary key shows 1 error with OBJ_NO_PRIMARY_KEY; undo clears it", async ({ page }) => {
    await openStudio(page);
    page.on("dialog", (dialog) => dialog.accept());
    const obj = await selectObject(page, PREFERRED_OBJECT);
    const pk = await page.evaluate((o) => window.Ontology.get().objectTypes[o].primaryKey, obj);
    expect(pk, "seed object has a primary key").toBeTruthy();

    const issues = page.getByTestId("os-issues");
    await expect(issues.locator("[data-code=OBJ_NO_PRIMARY_KEY]")).toHaveCount(0);
    await page.getByTestId("os-props").locator('[data-prop="' + pk + '"]').getByTestId("os-prop-del").click();
    await expect(page.getByTestId("os-badge")).toContainText("1 error");
    await expect.poll(() => issues.locator("[data-code=OBJ_NO_PRIMARY_KEY]").count()).toBeGreaterThanOrEqual(1);
    await expect(issues.locator("[data-code=OBJ_NO_PRIMARY_KEY]").first()).toContainText(obj);
    await expect.poll(() => page.evaluate(() => window.Ontology.validate().errors.map((e) => e.code))).toContain("OBJ_NO_PRIMARY_KEY");
    await page.screenshot({ path: shot("studio-issues.png") });

    await page.getByTestId("os-undo").click();
    await expect(issues.locator("[data-code=OBJ_NO_PRIMARY_KEY]")).toHaveCount(0);
    await expect(page.getByTestId("os-badge")).not.toContainText("1 error");
    await expect.poll(() => hasProperty(page, obj, pk)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.Ontology.validate().ok)).toBe(true);
  });

  test("export Turtle contains owl:Class", async ({ page }) => {
    await openStudio(page);
    await page.getByTestId("os-export").click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("os-export-turtle").click()]);
    const text = fs.readFileSync(await download.path(), "utf8");
    expect(text).toContain("owl:Class");
    expect(text).toContain("owl:DatatypeProperty");
    expect(text).toContain("owl:ObjectProperty");
    const direct = await page.evaluate(() => window.Ontology.exportTurtle());
    expect(direct).toContain("owl:Class");
  });

  test("reload keeps the change (localStorage)", async ({ page }) => {
    await openStudio(page);
    const obj = await selectObject(page, PREFERRED_OBJECT);
    await addProperty(page, obj, "batch_no", "string");
    const revision = await page.evaluate(() => window.Ontology.get().revision);

    await page.reload();
    await expect(page.locator(".node").first()).toBeVisible();
    await expect.poll(() => hasProperty(page, obj, "batch_no")).toBe(true);
    expect(await page.evaluate(() => window.Ontology.get().revision)).toBe(revision);

    await page.locator("#open-ontology").click();
    await expect(page.locator(STUDIO)).toBeVisible();
    await page.getByTestId("os-tab-objects").click();
    await selectObject(page, obj);
    await expect(page.getByTestId("os-props").locator('[data-prop="batch_no"]')).toHaveCount(1);
  });

  test("graph shows >= 11 [data-obj] boxes", async ({ page }) => {
    await openStudio(page);
    const boxes = page.getByTestId("os-graph").locator("[data-obj]");
    await expect.poll(() => boxes.count()).toBeGreaterThanOrEqual(11);
    await page.screenshot({ path: shot("studio-graph.png") });
  });

  test("Esc closes the studio; os-close closes it too", async ({ page }) => {
    const studio = await openStudio(page);
    await page.keyboard.press("Escape");
    await expect(studio).toBeHidden();
    expect(await page.evaluate(() => !!(window.OntologyStudio && window.OntologyStudio.isOpen()))).toBe(false);

    await page.locator("#open-ontology").click();
    await expect(studio).toBeVisible();
    await page.getByTestId("os-close").click();
    await expect(studio).toBeHidden();
  });
});
