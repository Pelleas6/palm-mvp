import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("quick reset clears only active map filters", async () => {
  const source = await readFile(new URL("../components/WorldMap.js", import.meta.url), "utf8");
  const helper = source.match(/const resetFiltersOnly = \(\) => \{([\s\S]*?)\n  \};/);

  assert.ok(helper, "the quick filter reset handler must exist");
  assert.match(helper[1], /filtersRef\.current = next;/);
  assert.match(helper[1], /setFilters\(next\);/);
  assert.doesNotMatch(helper[1], /fitWorld|setPanelOpen|setFiltersOpen/);
  assert.match(source, /className="quick-filter-reset"[\s\S]*onClick=\{resetFiltersOnly\}[\s\S]*aria-label="Réinitialiser les filtres"/);
});
