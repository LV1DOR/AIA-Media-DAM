"use client";

import { useEffect, useRef } from "react";

/** Adapted from the owner's SmoothFollower. Decorative: native pointer and
 * text caret remain available; no React renders are scheduled per frame. */
export default function SmoothFollower() {
  const rootRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current,
      dot = dotRef.current,
      ring = ringRef.current;
    if (!root || !dot || !ring) return;
    const fine = matchMedia("(any-hover: hover) and (any-pointer: fine)");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const target = { x: 0, y: 0 },
      inner = { x: 0, y: 0 },
      outer = { x: 0, y: 0 };
    let frame = 0,
      lastTime = 0,
      initialized = false;
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      initialized = false;
      root.classList.remove("is-active");
      root.dataset.hovering = "false";
    };
    const enabled = () => fine.matches && !reduced.matches && !document.hidden;
    const hover = (element: Element | null) => {
      const interactive = element?.closest(
        'a,button,img,input,textarea,select,label,summary,[role="button"],[role="menuitem"],[contenteditable="true"],canvas.lanyard-canvas,[data-cursor-interactive]',
      );
      const value = String(
        !!interactive && !element?.closest(':disabled,[aria-disabled="true"]'),
      );
      if (root.dataset.hovering !== value) root.dataset.hovering = value;
    };
    const paint = (time: number) => {
      frame = 0;
      if (!enabled() || !initialized) return;
      const elapsed = Math.min(64, Math.max(1, time - lastTime));
      lastTime = time;
      const move = (position: typeof target, smoothing: number) => {
        const factor = 1 - Math.pow(1 - smoothing, elapsed / (1000 / 60));
        position.x += (target.x - position.x) * factor;
        position.y += (target.y - position.y) * factor;
      };
      move(inner, 0.2);
      move(outer, 0.1);
      const moving =
        Math.abs(target.x - inner.x) +
          Math.abs(target.y - inner.y) +
          Math.abs(target.x - outer.x) +
          Math.abs(target.y - outer.y) >
        0.1;
      if (!moving) {
        Object.assign(inner, target);
        Object.assign(outer, target);
      }
      dot.style.transform = `translate3d(${inner.x}px,${inner.y}px,0) translate(-50%,-50%)`;
      ring.style.transform = `translate3d(${outer.x}px,${outer.y}px,0) translate(-50%,-50%)`;
      if (moving) frame = requestAnimationFrame(paint);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !enabled()) {
        stop();
        return;
      }
      target.x = event.clientX;
      target.y = event.clientY;
      if (!initialized) {
        Object.assign(inner, target);
        Object.assign(outer, target);
        lastTime = performance.now();
        initialized = true;
      }
      root.classList.add("is-active");
      hover(event.target instanceof Element ? event.target : null);
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const leave = (event: PointerEvent) => {
      if (!event.relatedTarget) stop();
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") stop();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Tab") stop();
    };
    const scroll = () => {
      if (initialized) hover(document.elementFromPoint(target.x, target.y));
    };
    const preference = () => {
      if (!enabled()) stop();
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerout", leave, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("blur", stop);
    window.addEventListener("keydown", keyboard);
    window.addEventListener("scroll", scroll, { passive: true, capture: true });
    document.addEventListener("visibilitychange", preference);
    fine.addEventListener("change", preference);
    reduced.addEventListener("change", preference);
    return () => {
      stop();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerout", leave);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("blur", stop);
      window.removeEventListener("keydown", keyboard);
      window.removeEventListener("scroll", scroll, true);
      document.removeEventListener("visibilitychange", preference);
      fine.removeEventListener("change", preference);
      reduced.removeEventListener("change", preference);
    };
  }, []);

  return (
    <div ref={rootRef} className="smooth-follower" aria-hidden="true">
      <span ref={dotRef} className="smooth-follower-dot" />
      <span ref={ringRef} className="smooth-follower-ring" />
    </div>
  );
}
