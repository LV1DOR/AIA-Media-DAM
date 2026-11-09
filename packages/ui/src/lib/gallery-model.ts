import type { Asset } from "@aia/contracts";
export type GalleryMode = "grid" | "masonry" | "list";
export type GallerySort = "recent" | "oldest" | "name";
export function buildNativeSearch(
  query: string | readonly string[],
  filters: { year: string; event: string; championship: string },
) {
  const names = {
    year: "year",
    event: "event89",
    championship: "championship",
  };
  return [
    (
      (typeof query === "string" ? query : query.join(" "))
        .normalize("NFKC")
        .trim()
        .match(/"[^"]*"|\S+/g) || []
    )
      .map((term) =>
        /^(?:"?)(?:19|20)\d{2}(?:"?)$/.test(term)
          ? '"year:' + term.replaceAll('"', "") + '"'
          : term.toLocaleLowerCase("en"),
      )
      .join(" "),
    ...Object.entries(filters)
      .filter(([, value]) => value.trim())
      .map(
        ([name, value]) =>
          '"' +
          names[name as keyof typeof names] +
          ":" +
          value.replaceAll('"', "").trim() +
          '"',
      ),
  ]
    .filter(Boolean)
    .join(" ");
}
export function previewDimensions(asset: Asset) {
  const width = asset.previewWidth,
    height = asset.previewHeight;
  return width &&
    height &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
    ? { width, height }
    : { width: 4, height: 3 };
}
export function orderAssets(assets: Asset[], sort: GallerySort) {
  if (sort === "recent") return assets;
  return [...assets].sort(
    sort === "name"
      ? (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true })
      : (a, b) => a.id - b.id,
  );
}
export function nextSelection(
  current: ReadonlySet<number>,
  id: number,
  visible: number[],
  anchor: number | null,
  range: boolean,
  limit = 100,
) {
  const next = new Set(current),
    start = anchor === null ? -1 : visible.indexOf(anchor),
    end = visible.indexOf(id);
  if (range && start >= 0 && end >= 0)
    for (const candidate of visible.slice(
      Math.min(start, end),
      Math.max(start, end) + 1,
    ))
      next.add(candidate);
  else if (next.has(id)) next.delete(id);
  else next.add(id);
  return next.size > limit ? new Set(current) : next;
}
