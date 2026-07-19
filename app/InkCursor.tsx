"use client";

import { useEffect, useRef } from "react";
import type { CursorMode } from "./ElasticAvatar";

const LABELS: Record<CursorMode | "link", string> = {
  idle: "",
  grab: "GRAB",
  drag: "HOLD",
  draw: "DRAW",
  pull: "PULL",
  link: "GO",
};

export function InkCursor({ mode }: { mode: CursorMode }) {
  const cursorRef = useRef<HTMLSpanElement>(null);
  const rippleRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const modeRef = useRef(mode);

  useEffect(() => {
    modeRef.current = mode;
    const cursor = cursorRef.current;
    const label = labelRef.current;
    if (cursor && label) {
      cursor.dataset.mode = mode;
      label.textContent = LABELS[mode];
    }
  }, [mode]);

  useEffect(() => {
    const cursor = cursorRef.current;
    const ripple = rippleRef.current;
    const label = labelRef.current;
    if (!cursor || !ripple || !label) return;

    const finePointer = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!finePointer.matches || reducedMotion.matches) return;

    let lastX = window.innerWidth / 2;
    let lastY = window.innerHeight / 2;
    let lastTime = performance.now();
    document.body.classList.add("has-ink-cursor");

    const applyMode = (eventTarget: EventTarget | null) => {
      let next: CursorMode | "link" = modeRef.current;
      if (
        next === "idle" &&
        eventTarget instanceof Element &&
        eventTarget.closest("a, button")
      ) {
        next = "link";
      }
      cursor.dataset.mode = next;
      label.textContent = LABELS[next];
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      cursor.classList.add("is-visible");
      applyMode(event.target);

      const now = performance.now();
      const elapsed = Math.max(12, now - lastTime);
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      const velocity = clamp(Math.hypot(dx, dy) / elapsed, 0, 2.4);
      const stretch = velocity * 0.22;
      cursor.style.transform =
        `translate3d(${event.clientX}px, ${event.clientY}px, 0) ` +
        `translate3d(-50%, -50%, 0) ` +
        `scale(${1 + stretch}, ${1 - stretch * 0.32})`;

      lastX = event.clientX;
      lastY = event.clientY;
      lastTime = now;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      cursor.classList.add("is-pressed");
      applyMode(event.target);
      ripple.getAnimations().forEach((animation) => animation.cancel());
      ripple.animate(
        [
          { opacity: 0.72, transform: "scale(0.35)" },
          { opacity: 0, transform: "scale(2.4)" },
        ],
        { duration: 520, easing: "cubic-bezier(.16,.8,.2,1)" },
      );
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      cursor.classList.remove("is-pressed");
      applyMode(event.target);
    };

    const onWindowOut = (event: MouseEvent) => {
      if (event.relatedTarget === null) cursor.classList.remove("is-visible");
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("mouseout", onWindowOut);

    return () => {
      document.body.classList.remove("has-ink-cursor");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("mouseout", onWindowOut);
    };
  }, []);

  return (
    <span ref={cursorRef} className="ink-cursor" aria-hidden="true">
      <span className="ink-cursor__dot" />
      <span ref={labelRef} className="ink-cursor__label" />
      <span ref={rippleRef} className="ink-cursor__ripple" />
    </span>
  );
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export default InkCursor;
