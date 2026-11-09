"use client";
import React, { lazy, Suspense, useEffect, useState } from "react";
import { useMotionPreference } from "../lib/motion-preference";
import { generateBadgeImages, type BadgeImages } from "../lib/badge-images";
const Lanyard = lazy(() => import("./react-bits/Lanyard"));
class GraphicsBoundary extends React.Component<
  {
    children: React.ReactNode;
    fallback: React.ReactNode;
    onUnavailable: () => void;
  },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onUnavailable();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export function AccountSuccess({
  name,
  photo,
  onContinue,
}: {
  name: string;
  photo: File | null;
  onContinue: () => void;
}) {
  const reduced = useMotionPreference();
  const [attempt, setAttempt] = useState(0);
  const [images, setImages] = useState<BadgeImages | null>(null),
    [fallback, setFallback] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let result: BadgeImages | undefined;
    (async () => {
      let portrait = photo;
      try {
        const response = await fetch("/api/auth/profile-photo", {
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (response.ok)
          portrait = new File([await response.blob()], "profile.webp", {
            type: "image/webp",
          });
      } catch (e) {
        if (controller.signal.aborted) throw e;
      }
      return generateBadgeImages(name, portrait, controller.signal);
    })()
      .then((value) => {
        result = value;
        if (!controller.signal.aborted) setImages(value);
        else value.destroy();
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      controller.abort();
      result?.destroy();
    };
  }, [name, photo]);
  const still = images ? (
    <img
      className="static-badge"
      src={images.front}
      alt={`Welcome badge for ${name}`}
    />
  ) : (
    <div className="badge-loading" role="status">
      {error
        ? "Badge preview unavailable. Your account is ready."
        : "Preparing your welcome badge…"}
    </div>
  );
  return (
    <section className="account-success">
      <span className="section-label">WELCOME TO AIA MEDIA</span>
      <h1>Account created successfully</h1>
      <p>{name}, your password and authenticator are ready.</p>
      <div className="badge-stage">
        {!images || fallback || reduced ? (
          still
        ) : (
          <GraphicsBoundary
            key={attempt}
            fallback={still}
            onUnavailable={() => setFallback(true)}
          >
            <Suspense fallback={still}>
              <Lanyard
                frontImage={images.front}
                backImage={images.back}
                strapImage={images.strap}
                orientation="portrait"
                finish="glossy"
                anchor="center"
                size={0.6}
                gravity={1}
                damping={0.6}
                elasticity={0.4}
                breeze={0.15}
                interactive
                intro
                onUnavailable={() => setFallback(true)}
                onReady={() => setReady(true)}
              />
              {!ready && <div className="badge-pending">{still}</div>}
            </Suspense>
          </GraphicsBoundary>
        )}
      </div>
      {images && !fallback && !reduced && (
        <p className="lanyard-instructions">
          Drag to swing. Click the badge to flip.
        </p>
      )}
      {fallback && (
        <p role="status">
          3D graphics are unavailable in this browser. Enable graphics
          acceleration in your browser settings, then{" "}
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setReady(false);
              setFallback(false);
              setAttempt((value) => value + 1);
            }}
          >
            Retry 3D badge
          </button>
        </p>
      )}
      <button className="button primary" onClick={onContinue}>
        Continue to your workspace
      </button>
    </section>
  );
}
