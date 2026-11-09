"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Asset } from "@aia/contracts";
import {
  ImageGallery,
  GallerySkeleton,
  type ImageGalleryProps,
} from "./ui/image-gallery";
import { orderAssets, type GallerySort } from "../lib/gallery-model";
import { api } from "../lib/api";

type Props = Omit<ImageGalleryProps, "assets"> & {
  initialAssets: Asset[];
  total: number;
  query: string;
  kind: string;
  sort: GallerySort;
  onVisibleAssets: (assets: Asset[]) => void;
};

/** Measured 48-item windows. Offscreen metadata/images are released and refetched
 * on return. Only small height placeholders remain; selected metadata is owned
 * separately by the workspace. Native pagination stays server-side. */
export function InfiniteGallery({
  initialAssets,
  total,
  query,
  kind,
  sort,
  onVisibleAssets,
  ...gallery
}: Props) {
  const [count, setCount] = useState(1),
    [ready, setReady] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null),
    visible = useRef(new Map<number, Asset[]>());
  const [automatic, setAutomatic] = useState(true);
  const advancing = useRef(false);
  const [ended, setEnded] = useState(false);
  const owners = useRef(new Map<number, number>());
  const prepare = useCallback(
    (page: number, items: Asset[]) =>
      items.filter((item) => {
        const owner = owners.current.get(item.id);
        if (owner !== undefined && owner !== page) return false;
        owners.current.set(item.id, page);
        return true;
      }),
    [],
  );
  const last = ended ? count : Math.max(1, Math.ceil(total / 48));
  const change = useCallback(
    (page: number, assets: Asset[]) => {
      if (assets.length) visible.current.set(page, assets);
      else visible.current.delete(page);
      onVisibleAssets(
        [...visible.current.entries()]
          .sort((a, b) => a[0] - b[0])
          .flatMap(([, items]) => items),
      );
    },
    [onVisibleAssets],
  );
  const advance = useCallback(() => {
    if (advancing.current) return;
    advancing.current = true;
    setReady(false);
    setCount((n) => Math.min(last, n + 1));
  }, [last]);
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !automatic || !ready || count >= last) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) advance();
      },
      { rootMargin: "400px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [automatic, ready, count, last, advance]);
  return (
    <div className="infinite-gallery">
      {Array.from({ length: count }, (_, page) => (
        <GalleryWindow
          key={page}
          page={page}
          seed={page === 0 ? initialAssets : undefined}
          query={query}
          kind={kind}
          sort={sort}
          gallery={gallery}
          onChange={change}
          prepare={prepare}
          onReady={
            page === count - 1
              ? (size) => {
                  advancing.current = false;
                  setReady(true);
                  if (size < 48) setEnded(true);
                }
              : undefined
          }
        />
      ))}
      <div ref={sentinel} className="infinite-gallery-end" aria-live="polite">
        <p>
          {count >= last && ready
            ? "You have reached the end of these results."
            : `${Math.min(count * 48, total).toLocaleString()} of ${total.toLocaleString()} media items reached`}
        </p>
        {count < last && (
          <button
            className="button secondary"
            disabled={!ready}
            onClick={advance}
          >
            {ready ? "Load more media" : "Loading media..."}
          </button>
        )}
        {count < last && (
          <label>
            <input
              type="checkbox"
              checked={automatic}
              onChange={(e) => setAutomatic(e.target.checked)}
            />{" "}
            Load automatically as I scroll
          </label>
        )}
      </div>
    </div>
  );
}

function GalleryWindow({
  page,
  seed,
  query,
  kind,
  sort,
  gallery,
  onChange,
  onReady,
  prepare,
}: {
  page: number;
  seed?: Asset[];
  query: string;
  kind: string;
  sort: GallerySort;
  gallery: Omit<ImageGalleryProps, "assets">;
  onChange: (page: number, assets: Asset[]) => void;
  onReady?: (size: number) => void;
  prepare: (page: number, items: Asset[]) => Asset[];
}) {
  const ref = useRef<HTMLDivElement>(null),
    height = useRef(2600),
    readyRef = useRef(onReady);
  readyRef.current = onReady;
  const [near, setNear] = useState(page === 0),
    [items, setItems] = useState<Asset[] | null>(seed || null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [measured, setMeasured] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const element = ref.current;
        if (
          !entries[0].isIntersecting &&
          element?.contains(document.activeElement)
        )
          return;
        setNear(entries[0].isIntersecting);
      },
      { rootMargin: "800px" },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!near) {
      setItems(null);
      return;
    }
    if (seed) {
      setItems(prepare(page, seed));
      return;
    }
    const controller = new AbortController();
    setError("");
    api(
      "/library?" +
        new URLSearchParams({
          search: query,
          kind,
          state: "0",
          page: String(page),
        }),
      { signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted) setItems(prepare(page, data.items));
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [near, page, seed, query, kind, retry, prepare]);
  useEffect(() => {
    const ordered = near && items ? orderAssets(items, sort) : [];
    onChange(page, ordered);
    if (near && items) readyRef.current?.(items.length);
    return () => onChange(page, []);
  }, [near, items, sort, onChange, page]);
  useEffect(() => {
    const element = ref.current;
    if (!element || !near || !items) return;
    const observer = new ResizeObserver(() => {
      if (element.offsetHeight > 100) {
        height.current = element.offsetHeight;
        setMeasured(true);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [near, items, gallery.mode]);
  return (
    <section
      ref={ref}
      data-gallery-window={page}
      aria-label={`Media group ${page + 1}`}
      onBlurCapture={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (bounds.bottom < -800 || bounds.top > window.innerHeight + 800)
          setNear(false);
      }}
      style={!near ? { height: height.current } : undefined}
    >
      {near &&
        (items ? (
          <ImageGallery {...gallery} assets={orderAssets(items, sort)} />
        ) : error ? (
          <div className="infinite-gallery-error" role="alert">
            <p>{error}</p>
            <button
              className="button secondary"
              onClick={() => setRetry((n) => n + 1)}
            >
              Retry loading media
            </button>
          </div>
        ) : (
          <div style={{ minHeight: measured ? height.current : 500 }}>
            <GallerySkeleton />
          </div>
        ))}
    </section>
  );
}
