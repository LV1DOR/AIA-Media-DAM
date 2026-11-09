import test from "node:test";
import assert from "node:assert/strict";
import {
  previewDimensions,
  nextSelection,
  orderAssets,
  buildNativeSearch,
} from "../packages/ui/src/lib/gallery-model.js";
import type { Asset } from "../packages/contracts/src/index.js";
const asset = (id: number, title = "Asset " + id): Asset => ({
  id,
  title,
  filename: title + ".jpg",
  extension: "jpg",
  kind: "photo",
  state: 0,
  access: 0,
  year: "2026",
  event: "Event",
  bytes: 1200,
  created: "2026-11-08",
});
test("search combines independent chips, folds case and scopes a year to metadata", () => {
  const filters = { year: "", event: "", championship: "" };
  assert.equal(buildNativeSearch("MotoGP 2026", filters), 'motogp "year:2026"');
  assert.equal(buildNativeSearch("Racing", filters), "racing");
  assert.equal(buildNativeSearch("racing", filters), "racing");
  assert.equal(
    buildNativeSearch('"Race weekend" 2026', filters),
    '"race weekend" "year:2026"',
  );
});
test("pill boundaries do not change word, tag, event or year search semantics", () => {
  const filters = { year: "", event: "", championship: "" };
  for (const terms of [
    ["MotoGP", "2026"],
    ["Racing", "Circuit"],
    ["Race", "weekend", "2026"],
    ["Algarve", "Grand", "Prix"],
  ]) {
    assert.equal(
      buildNativeSearch([terms.join(" ")], filters),
      buildNativeSearch(terms, filters),
    );
    assert.equal(
      buildNativeSearch(
        [terms.slice(0, 2).join(" "), ...terms.slice(2)],
        filters,
      ),
      buildNativeSearch(terms, filters),
    );
    assert.equal(
      buildNativeSearch(terms.join(" "), filters),
      buildNativeSearch(terms, filters),
    );
  }
});
test("gallery dimensions use native previews and deterministic fallback without inventing original size", () => {
  assert.deepEqual(
    previewDimensions({ ...asset(1), previewWidth: 900, previewHeight: 1200 }),
    { width: 900, height: 1200 },
  );
  assert.deepEqual(
    previewDimensions({ ...asset(1), previewWidth: -1, previewHeight: 0 }),
    { width: 4, height: 3 },
  );
  assert.deepEqual(previewDimensions(asset(1)), previewDimensions(asset(1)));
});
test("range selection follows displayed ordering and preserves selections on other pages", () => {
  const before = new Set([99]);
  const selected = nextSelection(before, 4, [5, 4, 3, 2, 1], 2, true);
  assert.deepEqual(
    [...selected].sort((a, b) => a - b),
    [2, 3, 4, 99],
  );
  assert.deepEqual([...before], [99]);
  assert.deepEqual(
    [...nextSelection(selected, 3, [5, 4, 3, 2, 1], 2, false)].sort(
      (a, b) => a - b,
    ),
    [2, 4, 99],
  );
  const capped = nextSelection(
    new Set(Array.from({ length: 100 }, (_, i) => i + 1)),
    101,
    [101],
    null,
    false,
  );
  assert.equal(capped.size, 100);
  assert.equal(capped.has(101), false);
});
test("sorting is deterministic, page scoped and never mutates fetched assets", () => {
  const input = [
    asset(10, "Image 10"),
    asset(2, "Image 2"),
    asset(1, "Image 1"),
  ];
  assert.deepEqual(
    orderAssets(input, "name").map((a) => a.id),
    [1, 2, 10],
  );
  assert.deepEqual(
    orderAssets(input, "oldest").map((a) => a.id),
    [1, 2, 10],
  );
  assert.equal(orderAssets(input, "recent"), input);
  assert.deepEqual(
    input.map((a) => a.id),
    [10, 2, 1],
  );
});
test("native metadata filters quote field scopes and preserve collection search context", () => {
  assert.equal(
    buildNativeSearch("!collection12", {
      year: "2026",
      event: 'Race "weekend"',
      championship: "",
    }),
    '!collection12 "year:2026" "event89:Race weekend"',
  );
  assert.equal(
    buildNativeSearch("  paddock ", { year: "", event: "", championship: "" }),
    "paddock",
  );
});
