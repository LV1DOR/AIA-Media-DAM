"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { api } from "../lib/api";
import GridMotion from "./react-bits/GridMotion";

// Sign-in is public: reuse the approved receiver artwork, never private NAS URLs.
// Different crops give the same photo-wall treatment without publishing media.
const crops = [
  "15% 80%",
  "85% 65%",
  "50% 95%",
  "90% 20%",
  "20% 35%",
  "65% 60%",
];
const defaults = crops.map((position, index) => (
  <img
    key={index}
    src="/circuit-golden-hour.png"
    alt=""
    draggable={false}
    decoding="async"
    style={{
      objectFit: "cover",
      width: "100%",
      height: "100%",
      transform: "scale(1.8)",
      transformOrigin: position,
    }}
  />
));
export function SignInBackground() {
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]);
  const request = useRef<Promise<{
    photos: { id: string; url: string }[];
  }> | null>(null);
  useEffect(() => {
    let active = true;
    request.current ??= api("/public/backgrounds");
    request.current
      .then((result) => {
        if (active) setPhotos(result.photos);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const items = useMemo(
    () =>
      photos.length
        ? photos.map((photo) => ({ src: photo.url, alt: "" }))
        : defaults,
    [photos],
  );
  return (
    <div className="sign-in-background" aria-hidden="true">
      <GridMotion
        items={items}
        rows={4}
        aspectRatio={1.33}
        gap={14}
        radius={12}
        angle={-12}
        tilt={0}
        speed={18}
        direction="alternate"
        parallax={0.15}
        spotlight={0.25}
        dim={0.35}
        fade={0.3}
      />
    </div>
  );
}
