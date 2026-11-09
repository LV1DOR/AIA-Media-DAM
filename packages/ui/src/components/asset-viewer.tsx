"use client";
import { useMemo } from "react";
import type { Asset } from "@aia/contracts";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Download from "yet-another-react-lightbox/plugins/download";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Video from "yet-another-react-lightbox/plugins/video";
import Captions from "yet-another-react-lightbox/plugins/captions";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import "yet-another-react-lightbox/plugins/captions.css";
export default function AssetViewer({
  assets,
  id,
  onClose,
}: {
  assets: Asset[];
  id: number;
  onClose: () => void;
}) {
  const slides = useMemo(
    () =>
      assets.map((asset) => ({
        ...(asset.kind === "video"
          ? {
              type: "video" as const,
              sources: [
                {
                  src: "/api/library/" + asset.id + "/video",
                  type: "video/mp4",
                },
              ],
              poster: "/api/library/" + asset.id + "/preview",
            }
          : {
              src: "/api/library/" + asset.id + "/preview",
            }),
        alt: asset.title,
        title: asset.title,
        description: [asset.event, asset.year, asset.championship]
          .filter(Boolean)
          .join(" · "),
        thumbnail: "/api/library/" + asset.id + "/preview?size=thm",
        download: {
          url: "/api/library/" + asset.id + "/download",
          filename: asset.filename,
        },
      })),
    [assets],
  );
  return (
    <Lightbox
      open
      index={Math.max(
        0,
        assets.findIndex((asset) => asset.id === id),
      )}
      close={onClose}
      slides={slides}
      plugins={[Zoom, Fullscreen, Download, Thumbnails, Video, Captions]}
      carousel={{ preload: 1, finite: true }}
      animation={{ fade: 180, swipe: 220 }}
      video={{ autoPlay: false }}
      zoom={{ maxZoomPixelRatio: 3 }}
      thumbnails={{ width: 70, height: 48, gap: 8 }}
      download={{
        download: ({ slide }) => {
          if (typeof slide.download === "object")
            window.location.assign(slide.download.url);
        },
      }}
    />
  );
}
