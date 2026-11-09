"use client";
// Adapted from the owner's 21st.dev ImageGallery / AnimatedImage; original retained in docs/frontend/references.
import React, { memo, useMemo, useRef, useState, useEffect } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import {
  MasonryPhotoAlbum,
  RowsPhotoAlbum,
  type Photo,
} from "react-photo-album";
import {
  Image as ImageIcon,
  Video,
  Expand,
  MoreHorizontal,
  Download,
  Send,
  Info,
  Tags,
} from "lucide-react";
import { formatBytes, type Asset } from "@aia/contracts";
import { AspectRatio } from "./aspect-ratio";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./dropdown-menu";
import { TagPopover } from "../tag-editor";
import { cn } from "../../lib/utils";
import { previewDimensions, type GalleryMode } from "../../lib/gallery-model";
import "react-photo-album/styles.css";
type AssetPhoto = Photo & { asset: Asset };
export const AnimatedImage = memo(function AnimatedImage({
  asset,
  className,
}: {
  asset: Asset;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null),
    isInView = useInView(ref, { once: true, margin: "160px" }),
    reduced = useReducedMotion();
  const [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false);
  const src = "/api/library/" + asset.id + "/preview?size=thm",
    dimensions = previewDimensions(asset);
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);
  return (
    <AspectRatio
      ref={ref}
      ratio={dimensions.width / dimensions.height}
      className={cn("gallery-image bg-muted", className)}
      data-loaded={loaded}
    >
      {!loaded && !failed && (
        <span className="gallery-image-skeleton" aria-hidden="true" />
      )}
      {failed ? (
        <span
          className="gallery-image-error"
          role="img"
          aria-label={"Preview unavailable for " + asset.title}
        >
          <ImageIcon size={24} />
          <small>Preview unavailable</small>
        </span>
      ) : (
        <img
          alt={asset.title}
          src={src}
          width={dimensions.width}
          height={dimensions.height}
          loading="lazy"
          decoding="async"
          className={cn("gallery-photograph", {
            "is-visible": !!reduced || (isInView && loaded),
          })}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true);
            setLoaded(false);
          }}
        />
      )}
    </AspectRatio>
  );
});
export type ImageGalleryProps = {
  assets: Asset[];
  mode: GalleryMode;
  selected: ReadonlySet<number>;
  onSelect: (id: number, range: boolean) => void;
  onOpen: (id: number) => void;
  onPreview: (id: number) => void;
  onShare: (assets: Asset[]) => void;
  busy?: boolean;
  canEditTags?: boolean;
  onTagsSaved?: () => void;
};
export function ImageGallery({
  assets,
  mode,
  selected,
  onSelect,
  onOpen,
  onPreview,
  onShare,
  busy,
  canEditTags,
  onTagsSaved,
}: ImageGalleryProps) {
  const [tagAsset, setTagAsset] = useState<number | null>(null);
  const photos = useMemo<AssetPhoto[]>(
    () =>
      assets.map((asset) => ({
        key: String(asset.id),
        src: "/api/library/" + asset.id + "/preview?size=thm",
        alt: asset.title,
        ...previewDimensions(asset),
        asset,
      })),
    [assets],
  );
  const controls = (asset: Asset) => (
    <>
      <label className="gallery-check" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          aria-label={"Select " + asset.title}
          checked={selected.has(asset.id)}
          onChange={(event) =>
            onSelect(asset.id, !!(event.nativeEvent as MouseEvent).shiftKey)
          }
        />
      </label>
      <div
        className="gallery-card-actions"
        onClick={(e) => e.stopPropagation()}
      >
        {canEditTags && (
          <TagPopover
            asset={asset}
            onSaved={onTagsSaved || (() => {})}
            open={tagAsset === asset.id}
            onOpenChange={(open) => setTagAsset(open ? asset.id : null)}
          />
        )}
        <button
          className="gallery-icon"
          aria-label={"Fullscreen " + asset.title}
          onClick={() => onPreview(asset.id)}
        >
          <Expand size={15} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="gallery-icon"
              aria-label={"Actions for " + asset.title}
            >
              <MoreHorizontal size={17} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpen(asset.id)}>
              <Info />
              Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onPreview(asset.id)}>
              <Expand />
              Fullscreen preview
            </DropdownMenuItem>
            {canEditTags && (
              <DropdownMenuItem
                onSelect={() => setTimeout(() => setTagAsset(asset.id), 0)}
              >
                <Tags />
                Edit tags
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onShare([asset])}>
              <Send />
              Share
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={"/api/library/" + asset.id + "/download"}>
                <Download />
                Download original
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
  if (mode === "list")
    return (
      <div
        className="gallery-list"
        role="table"
        aria-label="Media assets"
        aria-busy={busy}
      >
        <div role="row" className="gallery-list-heading">
          <span role="columnheader">Asset</span>
          <span role="columnheader">Event</span>
          <span role="columnheader">Format</span>
          <span role="columnheader">Size</span>
        </div>
        {assets.map((asset) => (
          <article
            key={asset.id}
            role="row"
            className={cn(
              "gallery-list-row",
              selected.has(asset.id) && "is-selected",
              selected.size > 0 && "selection-mode",
            )}
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest("button,input,label,a")) {
                if (selected.size) onSelect(asset.id, e.shiftKey);
                else onOpen(asset.id);
              }
            }}
          >
            <label onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={selected.has(asset.id)}
                aria-label={"Select " + asset.title}
                onChange={(event) =>
                  onSelect(
                    asset.id,
                    !!(event.nativeEvent as MouseEvent).shiftKey,
                  )
                }
              />
            </label>
            <div role="cell" className="gallery-list-name-cell">
              <button
                className="gallery-list-name"
                aria-label={"View " + asset.title}
                aria-pressed={
                  selected.size ? selected.has(asset.id) : undefined
                }
                onClick={(e) =>
                  selected.size
                    ? onSelect(asset.id, e.shiftKey)
                    : onOpen(asset.id)
                }
              >
                <span className="gallery-list-thumb">
                  <AnimatedImage asset={asset} />
                </span>
                <span>
                  <strong>{asset.title}</strong>
                  <small>{asset.year || "Year not set"}</small>
                </span>
              </button>
            </div>
            <span role="cell" className="gallery-list-event">
              {asset.event || "—"}
            </span>
            <span role="cell">{asset.extension.toUpperCase()}</span>
            <span role="cell">
              {asset.bytes ? formatBytes(asset.bytes) : "—"}
            </span>
            <div
              role="cell"
              className="gallery-list-actions"
              onClick={(e) => e.stopPropagation()}
            >
              {canEditTags && (
                <TagPopover
                  asset={asset}
                  onSaved={onTagsSaved || (() => {})}
                  open={tagAsset === asset.id}
                  onOpenChange={(open) => setTagAsset(open ? asset.id : null)}
                />
              )}
              <button
                className="gallery-icon"
                aria-label={"Fullscreen " + asset.title}
                onClick={() => onPreview(asset.id)}
              >
                <Expand size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
    );
  const render = {
    wrapper: (
      { children, ...props }: React.ComponentPropsWithRef<"div">,
      { photo }: { photo: AssetPhoto },
    ) => (
      <article
        {...props}
        className={cn(
          props.className,
          "gallery-card focus-card",
          selected.size > 0 && "selection-mode",
          selected.has(photo.asset.id) && "is-selected",
        )}
        onClick={(e) => {
          if (
            !(e.target as HTMLElement).closest(
              "button,input,label,a,[role=menuitem]",
            )
          ) {
            if (selected.size) onSelect(photo.asset.id, e.shiftKey);
            else onOpen(photo.asset.id);
          }
        }}
      >
        <button
          className="gallery-card-open"
          aria-label={"View " + photo.asset.title}
          aria-pressed={
            selected.size ? selected.has(photo.asset.id) : undefined
          }
          onClick={(e) =>
            selected.size
              ? onSelect(photo.asset.id, e.shiftKey)
              : onOpen(photo.asset.id)
          }
        >
          {children}
        </button>
        {controls(photo.asset)}
        <div className="gallery-caption">
          <strong>{photo.asset.title}</strong>
          <span>
            {photo.asset.kind === "video" ? (
              <Video size={12} />
            ) : (
              <ImageIcon size={12} />
            )}{" "}
            {photo.asset.extension.toUpperCase()}
            <i />
            {photo.asset.event || photo.asset.year || "AIA Media"}
          </span>
        </div>
      </article>
    ),
    image: (_props: unknown, { photo }: { photo: AssetPhoto }) => (
      <AnimatedImage asset={photo.asset} />
    ),
  };
  return (
    <div className="media-gallery" aria-label="Media gallery" aria-busy={busy}>
      {mode === "masonry" ? (
        <MasonryPhotoAlbum
          photos={photos}
          columns={(width) =>
            width < 520 ? 2 : width < 850 ? 3 : width < 1250 ? 4 : 5
          }
          spacing={12}
          render={render}
          skeleton={<GallerySkeleton />}
        />
      ) : (
        <RowsPhotoAlbum
          photos={photos}
          targetRowHeight={230}
          rowConstraints={{ singleRowMaxHeight: 300 }}
          spacing={12}
          render={render}
          skeleton={<GallerySkeleton />}
        />
      )}
    </div>
  );
}
export function GallerySkeleton() {
  return (
    <div className="gallery-skeleton" aria-label="Loading media" role="status">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} />
      ))}
    </div>
  );
}
