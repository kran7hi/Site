"use client";

import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  InteractionSoundCue,
  InteractionSoundDetail,
} from "./useInteractionAudio";

type Expression = "neutral" | "surprised" | "drag" | "release" | "blink";

export type CursorMode = "idle" | "grab" | "drag" | "draw" | "pull";

export type ElasticAvatarProps = {
  className?: string;
  onCursorModeChange?: (mode: CursorMode) => void;
  onSoundCue?: (
    cue: InteractionSoundCue,
    detail?: InteractionSoundDetail,
  ) => void;
};

const IMAGE_SOURCES: Record<Expression, string> = {
  neutral: "/character/head-neutral-v3.png",
  surprised: "/character/head-surprised-v3.png",
  drag: "/character/head-drag-v3.png",
  release: "/character/head-release-v3.png",
  blink: "/character/head-blink-v3.png?v=5",
};

const EXPRESSIONS = Object.keys(IMAGE_SOURCES) as Expression[];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const RELEASE_HOLD_MS = 640;
const BLINK_HOLD_MS = 92;
const BLINK_DELAYS_MS = [3300, 5100, 3900, 5900, 4400, 5400, 3600];

type AvatarEngine = {
  width: number;
  height: number;
  canvasLeft: number;
  canvasTop: number;
  dpr: number;
  pointerId: number | null;
  keyboardDragging: boolean;
  draggingHead: boolean;
  drawingTrail: boolean;
  hovered: boolean;
  pointerSeen: boolean;
  reducedMotion: boolean;
  pointerX: number;
  pointerY: number;
  easedX: number;
  easedY: number;
  blinkIndex: number;
  dragValue: number;
  dragVelocity: number;
  hoverValue: number;
  dragDistance: number;
  dragStartX: number;
  dragStartY: number;
  lastSoundX: number;
  lastSoundY: number;
  lastClientX: number;
  lastClientY: number;
  headX: number;
  headY: number;
  headSize: number;
  headScale: number;
  trailHasInk: boolean;
};

export function ElasticAvatar({
  className,
  onCursorModeChange,
  onSoundCue,
}: ElasticAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCursorModeChange);
  const soundCallbackRef = useRef(onSoundCue);
  const cursorModeRef = useRef<CursorMode>("idle");
  const expressionRef = useRef<Expression>("neutral");
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stampTrailRef = useRef<(x: number, y: number, speed: number) => void>(
    () => undefined,
  );
  const [expression, setExpression] = useState<Expression>("neutral");
  const [expressionTransitionMs, setExpressionTransitionMs] = useState(150);
  const engineRef = useRef<AvatarEngine>({
    width: 0,
    height: 0,
    canvasLeft: 0,
    canvasTop: 0,
    dpr: 1,
    pointerId: null,
    keyboardDragging: false,
    draggingHead: false,
    drawingTrail: false,
    hovered: false,
    pointerSeen: false,
    reducedMotion: false,
    pointerX: 0,
    pointerY: 0,
    easedX: 0,
    easedY: 0,
    blinkIndex: 0,
    dragValue: 0,
    dragVelocity: 0,
    hoverValue: 0,
    dragDistance: 0,
    dragStartX: 0,
    dragStartY: 0,
    lastSoundX: 0,
    lastSoundY: 0,
    lastClientX: 0,
    lastClientY: 0,
    headX: 0,
    headY: 0,
    headSize: 390,
    headScale: 1,
    trailHasInk: false,
  });

  useEffect(() => {
    callbackRef.current = onCursorModeChange;
  }, [onCursorModeChange]);

  useEffect(() => {
    soundCallbackRef.current = onSoundCue;
  }, [onSoundCue]);

  const setCursorMode = (mode: CursorMode) => {
    if (cursorModeRef.current === mode) return;
    cursorModeRef.current = mode;
    callbackRef.current?.(mode);
  };

  const emitSound = (
    cue: InteractionSoundCue,
    detail?: InteractionSoundDetail,
  ) => {
    soundCallbackRef.current?.(cue, detail);
  };

  const setPortraitExpression = (next: Expression, transitionMs = 150) => {
    if (expressionRef.current === next) return;
    const previous = expressionRef.current;
    const duration =
      engineRef.current.reducedMotion || previous === "blink" || next === "blink"
        ? 0
        : transitionMs;

    expressionRef.current = next;
    setExpressionTransitionMs(duration);
    setExpression(next);
  };

  const clearReleaseTimer = () => {
    if (releaseTimerRef.current !== null) {
      clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
  };

  const clearBlinkTimers = () => {
    if (blinkTimerRef.current !== null) {
      clearTimeout(blinkTimerRef.current);
      blinkTimerRef.current = null;
    }
    if (blinkEndTimerRef.current !== null) {
      clearTimeout(blinkEndTimerRef.current);
      blinkEndTimerRef.current = null;
    }
  };

  const scheduleBlink = () => {
    clearBlinkTimers();
    const engine = engineRef.current;
    if (engine.reducedMotion) return;

    const nextBlinkDelay =
      BLINK_DELAYS_MS[engine.blinkIndex % BLINK_DELAYS_MS.length];
    engine.blinkIndex += 1;

    blinkTimerRef.current = setTimeout(() => {
      blinkTimerRef.current = null;
      if (
        !engine.draggingHead &&
        !engine.drawingTrail &&
        !engine.hovered &&
        expressionRef.current === "neutral"
      ) {
        setPortraitExpression("blink");
        blinkEndTimerRef.current = setTimeout(() => {
          blinkEndTimerRef.current = null;
          if (expressionRef.current === "blink") {
            setPortraitExpression("neutral");
          }
          scheduleBlink();
        }, BLINK_HOLD_MS);
        return;
      }
      scheduleBlink();
    }, nextBlinkDelay);
  };

  const applyHoverState = (hovered: boolean) => {
    const engine = engineRef.current;
    if (hovered === engine.hovered) return;

    engine.hovered = hovered;
    clearBlinkTimers();
    const releaseIsSettling =
      expressionRef.current === "release" && releaseTimerRef.current !== null;

    if (!releaseIsSettling) {
      setPortraitExpression(
        hovered ? "surprised" : "neutral",
        hovered ? 105 : 170,
      );
      if (!hovered) scheduleBlink();
    }
    if (hovered && !releaseIsSettling) {
      emitSound("wake", { pan: engine.pointerX });
    }
    setCursorMode(hovered ? "grab" : "idle");
  };

  const updatePointer = (
    event: ReactPointerEvent<HTMLCanvasElement>,
    bounds: DOMRect,
  ) => {
    const engine = engineRef.current;
    engine.pointerX = clamp(
      ((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 2,
      -1.15,
      1.15,
    );
    engine.pointerY = clamp(
      ((event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5) * 2,
      -1.15,
      1.15,
    );
  };

  const isInsideHead = (
    clientX: number,
    clientY: number,
    bounds: DOMRect,
    padding = 1,
  ) => {
    const engine = engineRef.current;
    const localX = clientX - bounds.left;
    const localY = clientY - bounds.top;
    const radiusX = engine.headSize * engine.headScale * 0.36 * padding;
    const radiusY = engine.headSize * engine.headScale * 0.44 * padding;
    const x = (localX - engine.headX) / Math.max(radiusX, 1);
    const y = (localY - engine.headY) / Math.max(radiusY, 1);
    return x * x + y * y <= 1;
  };

  const isInsideRestingHead = (
    clientX: number,
    clientY: number,
    bounds: DOMRect,
  ) => {
    const engine = engineRef.current;
    const localX = clientX - bounds.left;
    const localY = clientY - bounds.top;
    const radiusX = engine.headSize * 0.36;
    const radiusY = engine.headSize * 0.44;
    const x = (localX - engine.width * 0.5) / Math.max(radiusX, 1);
    const y = (localY - engine.height * 0.505) / Math.max(radiusY, 1);
    return x * x + y * y <= 1;
  };

  const finishPointer = (
    event?: ReactPointerEvent<HTMLCanvasElement>,
  ) => {
    const engine = engineRef.current;
    if (event && engine.pointerId !== event.pointerId) return;

    if (event) {
      const bounds = canvasRef.current?.getBoundingClientRect();
      const insideCanvas =
        bounds &&
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;
      engine.lastClientX = event.clientX;
      engine.lastClientY = event.clientY;
      engine.pointerSeen = Boolean(
        insideCanvas &&
          event.pointerType !== "touch" &&
          event.type !== "pointercancel",
      );
      if (!engine.pointerSeen) {
        engine.pointerX = 0;
        engine.pointerY = 0;
      }
    }

    const wasDraggingHead = engine.draggingHead;
    const wasDrawingTrail = engine.drawingTrail;
    const wasKeyboardDragging = engine.keyboardDragging;
    engine.pointerId = null;
    engine.keyboardDragging = false;
    engine.draggingHead = false;
    engine.drawingTrail = false;

    if (wasDraggingHead) {
      emitSound("release", {
        intensity: clamp(
          engine.dragDistance / Math.max(engine.headSize * 0.52, 1),
          0.2,
          1,
        ),
        pan: engine.pointerX,
      });
      clearReleaseTimer();
      const bounds = canvasRef.current?.getBoundingClientRect();
      engine.hovered =
        engine.pointerSeen && !wasKeyboardDragging && bounds
          ? isInsideRestingHead(
              event?.clientX ?? engine.lastClientX,
              event?.clientY ?? engine.lastClientY,
              bounds,
            )
          : false;

      setPortraitExpression("release", 135);
      releaseTimerRef.current = setTimeout(() => {
        releaseTimerRef.current = null;
        const latestBounds = canvasRef.current?.getBoundingClientRect();
        const hoverPadding = engine.hovered ? 1.09 : 1;
        engine.hovered =
          engine.pointerSeen && latestBounds
            ? isInsideHead(
                engine.lastClientX,
                engine.lastClientY,
                latestBounds,
                hoverPadding,
              )
            : false;
        setPortraitExpression(
          engine.hovered ? "surprised" : "neutral",
          260,
        );
        setCursorMode(engine.hovered ? "grab" : "idle");
        scheduleBlink();
      }, RELEASE_HOLD_MS);
      setCursorMode(engine.hovered ? "grab" : "idle");
    } else if (wasDrawingTrail) {
      setCursorMode(engine.hovered ? "grab" : "idle");
      scheduleBlink();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const head = headRef.current;
    if (!canvas || !head) return;

    let disposed = false;
    const engine = engineRef.current;
    const context = canvas.getContext("2d", { alpha: true });
    const trailCanvas = document.createElement("canvas");
    const trailContext = trailCanvas.getContext("2d", { alpha: true });
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!context || !trailContext) return;

    const imageSources = new Set(Object.values(IMAGE_SOURCES));
    for (const source of imageSources) {
      const image = new Image();
      image.decoding = "async";
      image.src = source;
    }

    const syncSize = () => {
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(bounds.width);
      const height = Math.round(bounds.height);
      engine.canvasLeft = bounds.left;
      engine.canvasTop = bounds.top;
      const pixelWidth = Math.max(1, Math.round(width * dpr));
      const pixelHeight = Math.max(1, Math.round(height * dpr));
      const lowWidth = clamp(Math.ceil(width / 18), 42, 108);
      const lowHeight = clamp(Math.ceil(height / 18), 28, 64);

      if (
        canvas.width !== pixelWidth ||
        canvas.height !== pixelHeight ||
        engine.width !== width ||
        engine.height !== height
      ) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        engine.width = width;
        engine.height = height;
        engine.dpr = dpr;
      }

      if (trailCanvas.width !== lowWidth || trailCanvas.height !== lowHeight) {
        trailCanvas.width = lowWidth;
        trailCanvas.height = lowHeight;
        engine.trailHasInk = false;
      }
    };

    stampTrailRef.current = (clientX, clientY, speed) => {
      if (engine.reducedMotion || engine.width <= 0 || engine.height <= 0) return;
      const bounds = canvas.getBoundingClientRect();
      const x =
        ((clientX - bounds.left) / Math.max(bounds.width, 1)) * trailCanvas.width;
      const y =
        ((clientY - bounds.top) / Math.max(bounds.height, 1)) * trailCanvas.height;
      const radius = 1.5 + clamp(speed / 16, 0, 1) * 2.7;
      const gradient = trailContext.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, "rgba(28, 28, 28, 0.98)");
      gradient.addColorStop(0.58, "rgba(28, 28, 28, 0.82)");
      gradient.addColorStop(1, "rgba(28, 28, 28, 0)");
      trailContext.fillStyle = gradient;
      trailContext.beginPath();
      trailContext.arc(x, y, radius, 0, Math.PI * 2);
      trailContext.fill();

      for (let index = 0; index < 3; index += 1) {
        const phase = clientX * 0.017 + clientY * 0.013 + index * 2.1;
        const offsetX = Math.cos(phase) * (radius + index * 0.8);
        const offsetY = Math.sin(phase * 1.17) * (radius + index * 0.55);
        trailContext.fillStyle = `rgba(28, 28, 28, ${0.58 - index * 0.12})`;
        trailContext.fillRect(
          Math.round(x + offsetX),
          Math.round(y + offsetY),
          index === 0 ? 2 : 1,
          index === 2 ? 2 : 1,
        );
      }
      engine.trailHasInk = true;
    };

    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(canvas);
    syncSize();

    const handleMotionChange = () => {
      engine.reducedMotion = motionQuery.matches;
      if (engine.reducedMotion) {
        engine.pointerId = null;
        engine.keyboardDragging = false;
        engine.dragValue = 0;
        engine.dragVelocity = 0;
        engine.hoverValue = 0;
        engine.easedX = 0;
        engine.easedY = 0;
        engine.hovered = false;
        engine.draggingHead = false;
        engine.drawingTrail = false;
        clearBlinkTimers();
        clearReleaseTimer();
        setPortraitExpression("neutral", 0);
        setCursorMode("idle");
      } else {
        scheduleBlink();
      }
    };

    engine.reducedMotion = motionQuery.matches;
    motionQuery.addEventListener("change", handleMotionChange);
    if (!engine.reducedMotion) scheduleBlink();

    const tick = (time: number) => {
      if (disposed) return;
      syncSize();

      const elapsed = lastFrameRef.current
        ? time - lastFrameRef.current
        : 1000 / 60;
      const step = clamp(elapsed / (1000 / 60), 0.25, 2.2);
      lastFrameRef.current = time;

      if (engine.reducedMotion) {
        engine.easedX = 0;
        engine.easedY = 0;
        engine.dragValue = 0;
        engine.hoverValue = 0;
      } else {
        const pointerEase = 1 - Math.pow(1 - 0.075, step);
        engine.easedX += (engine.pointerX - engine.easedX) * pointerEase;
        engine.easedY += (engine.pointerY - engine.easedY) * pointerEase;
        const hoverTarget = engine.hovered && !engine.draggingHead ? 1 : 0;
        const hoverEase = 1 - Math.pow(1 - 0.13, step);
        engine.hoverValue += (hoverTarget - engine.hoverValue) * hoverEase;

        const dragTarget = engine.draggingHead ? 1 : 0;
        const stiffness = engine.draggingHead ? 0.19 : 0.075;
        const damping = engine.draggingHead ? 0.68 : 0.79;
        engine.dragVelocity +=
          (dragTarget - engine.dragValue) * stiffness * step;
        engine.dragVelocity *= Math.pow(damping, step);
        engine.dragValue += engine.dragVelocity * step;
        if (
          !engine.draggingHead &&
          Math.abs(engine.dragValue) < 0.0003 &&
          Math.abs(engine.dragVelocity) < 0.0003
        ) {
          engine.dragValue = 0;
          engine.dragVelocity = 0;
        }
      }

      const minDimension = Math.min(engine.width, engine.height);
      const headSize = clamp(minDimension * 0.46, 330, 455);
      const distanceFactor = clamp(engine.dragDistance / Math.max(minDimension, 1), 0, 0.8);
      const dragValue = engine.dragValue;
      const baseX = engine.width * 0.5;
      const baseY = engine.height * 0.505;
      const idleX = engine.easedX * headSize * 0.05;
      const idleY = engine.easedY * headSize * 0.035;
      const dragX = engine.easedX * headSize * 0.82 * dragValue;
      const dragY = engine.easedY * headSize * 0.56 * dragValue;
      const motionFactor = engine.reducedMotion ? 0 : 1;
      const idleFactor =
        (1 - clamp(Math.abs(dragValue), 0, 1)) * motionFactor;
      const idlePhase = time * 0.0011;
      const bobX = Math.sin(idlePhase * 0.7) * 5 * idleFactor;
      const bobY = Math.cos(idlePhase) * 4 * idleFactor;
      const shake = dragValue * (1.5 + distanceFactor * 5);
      const shakeX = Math.cos(time * 0.075) * shake;
      const shakeY = Math.sin(time * 0.079 + 0.4) * shake;
      const scale = clamp(
        1 + engine.hoverValue * 0.15 - dragValue * (0.15 + distanceFactor * 0.1),
        0.69,
        1.17,
      );
      const rotation =
        -Math.sin(idlePhase * 0.55) * 1.2 * idleFactor +
        engine.easedX * dragValue * 3.2;

      engine.headSize = headSize;
      engine.headScale = scale;
      engine.headX = baseX + idleX + dragX + bobX + shakeX;
      engine.headY = baseY + idleY + dragY + bobY + shakeY;

      const pointerLocalX = engine.lastClientX - engine.canvasLeft;
      const pointerLocalY = engine.lastClientY - engine.canvasTop;
      if (
        engine.pointerSeen &&
        !engine.draggingHead &&
        !engine.drawingTrail
      ) {
        const hoverPadding = engine.hovered ? 1.09 : 1;
        const hitX =
          (pointerLocalX - engine.headX) /
          Math.max(headSize * scale * 0.36 * hoverPadding, 1);
        const hitY =
          (pointerLocalY - engine.headY) /
          Math.max(headSize * scale * 0.44 * hoverPadding, 1);
        applyHoverState(hitX * hitX + hitY * hitY <= 1);
      } else if (
        !engine.pointerSeen &&
        engine.hovered &&
        !engine.draggingHead &&
        !engine.drawingTrail
      ) {
        applyHoverState(false);
      }

      head.style.width = `${headSize}px`;
      head.style.height = `${headSize}px`;
      head.style.transform =
        `translate3d(${engine.headX}px, ${engine.headY}px, 0) ` +
        `translate3d(-50%, -50%, 0) rotate(${rotation}deg) scale(${scale})`;
      head.style.setProperty(
        "--portrait-depth-x",
        `${-engine.easedX * (2.5 + dragValue * 8)}px`,
      );
      head.style.setProperty(
        "--portrait-depth-y",
        `${-engine.easedY * (2 + dragValue * 5)}px`,
      );
      head.style.setProperty(
        "--portrait-hair-x",
        `${-engine.easedX * (1.4 + dragValue * 4.5)}px`,
      );
      head.style.setProperty(
        "--portrait-hair-y",
        `${-engine.easedY * (1.1 + dragValue * 2.8)}px`,
      );
      head.style.setProperty("--portrait-drag", `${clamp(dragValue, 0, 1)}`);

      if (engine.trailHasInk) {
        trailContext.save();
        trailContext.globalCompositeOperation = "destination-in";
        trailContext.fillStyle = `rgba(255,255,255,${Math.pow(0.965, step)})`;
        trailContext.fillRect(0, 0, trailCanvas.width, trailCanvas.height);
        trailContext.restore();
      }

      context.setTransform(engine.dpr, 0, 0, engine.dpr, 0, 0);
      context.clearRect(0, 0, engine.width, engine.height);
      if (engine.trailHasInk && !engine.reducedMotion) {
        context.imageSmoothingEnabled = false;
        context.drawImage(trailCanvas, 0, 0, engine.width, engine.height);
      }

      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      motionQuery.removeEventListener("change", handleMotionChange);
      clearBlinkTimers();
      clearReleaseTimer();
      stampTrailRef.current = () => undefined;
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastFrameRef.current = 0;
    };
  }, []);

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    const bounds = event.currentTarget.getBoundingClientRect();
    updatePointer(event, bounds);
    engine.pointerSeen = event.pointerType !== "touch";

    const dx = event.clientX - engine.lastClientX;
    const dy = event.clientY - engine.lastClientY;
    const speed = Math.hypot(dx, dy);
    engine.lastClientX = event.clientX;
    engine.lastClientY = event.clientY;

    if (engine.draggingHead && engine.pointerId === event.pointerId) {
      engine.dragDistance = Math.hypot(
        event.clientX - engine.dragStartX,
        event.clientY - engine.dragStartY,
      );
      const soundTravel = Math.hypot(
        event.clientX - engine.lastSoundX,
        event.clientY - engine.lastSoundY,
      );
      if (soundTravel >= 14) {
        engine.lastSoundX = event.clientX;
        engine.lastSoundY = event.clientY;
        emitSound("drag", {
          intensity: clamp(speed / 24, 0.16, 1),
          pan: engine.pointerX,
        });
      }
      setCursorMode("drag");
      return;
    }

    if (engine.drawingTrail && engine.pointerId === event.pointerId) {
      stampTrailRef.current(event.clientX, event.clientY, speed);
      const soundTravel = Math.hypot(
        event.clientX - engine.lastSoundX,
        event.clientY - engine.lastSoundY,
      );
      if (soundTravel >= 11) {
        engine.lastSoundX = event.clientX;
        engine.lastSoundY = event.clientY;
        emitSound("draw", {
          intensity: clamp(speed / 18, 0.14, 1),
          pan: engine.pointerX,
        });
      }
      setCursorMode("draw");
      return;
    }

    const hovered = isInsideHead(event.clientX, event.clientY, bounds);
    applyHoverState(hovered);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const engine = engineRef.current;
    const bounds = event.currentTarget.getBoundingClientRect();
    updatePointer(event, bounds);
    engine.pointerSeen = event.pointerType !== "touch";
    engine.lastClientX = event.clientX;
    engine.lastClientY = event.clientY;
    clearBlinkTimers();
    clearReleaseTimer();

    if (isInsideHead(event.clientX, event.clientY, bounds)) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      engine.pointerId = event.pointerId;
      engine.draggingHead = !engine.reducedMotion;
      engine.drawingTrail = false;
      engine.hovered = true;
      engine.dragStartX = event.clientX;
      engine.dragStartY = event.clientY;
      engine.dragDistance = 0;
      engine.lastSoundX = event.clientX;
      engine.lastSoundY = event.clientY;
      setPortraitExpression(engine.reducedMotion ? "release" : "drag", 85);
      emitSound("grab", { pan: engine.pointerX });
      setCursorMode(engine.reducedMotion ? "grab" : "drag");
      if (engine.reducedMotion) {
        releaseTimerRef.current = setTimeout(() => {
          releaseTimerRef.current = null;
          const hovered = engine.pointerSeen && engine.hovered;
          setPortraitExpression(hovered ? "surprised" : "neutral", 0);
          setCursorMode(hovered ? "grab" : "idle");
        }, 420);
      }
      return;
    }

    if (
      expressionRef.current === "blink" ||
      expressionRef.current === "release"
    ) {
      setPortraitExpression("neutral", 110);
    }

    if (event.pointerType !== "touch" && !engine.reducedMotion) {
      event.currentTarget.setPointerCapture(event.pointerId);
      engine.pointerId = event.pointerId;
      engine.drawingTrail = true;
      engine.draggingHead = false;
      engine.lastSoundX = event.clientX;
      engine.lastSoundY = event.clientY;
      stampTrailRef.current(event.clientX, event.clientY, 0);
      emitSound("draw", { intensity: 0.2, pan: engine.pointerX });
      setCursorMode("draw");
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    finishPointer(event);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    if (engine.pointerId !== event.pointerId) return;

    clearReleaseTimer();
    clearBlinkTimers();
    engine.pointerId = null;
    engine.keyboardDragging = false;
    engine.draggingHead = false;
    engine.drawingTrail = false;
    engine.hovered = false;
    engine.pointerSeen = false;
    engine.pointerX = 0;
    engine.pointerY = 0;
    setPortraitExpression("neutral", 160);
    setCursorMode("idle");
    scheduleBlink();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onPointerLeave = () => {
    const engine = engineRef.current;
    engine.pointerSeen = false;
    if (engine.draggingHead || engine.drawingTrail) return;
    engine.pointerX = 0;
    engine.pointerY = 0;
    applyHoverState(false);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLCanvasElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const engine = engineRef.current;
    if (!event.repeat) {
      emitSound("grab", { pan: event.key === "ArrowLeft" ? -0.5 : 0.5 });
    }
    if (engine.reducedMotion) {
      clearReleaseTimer();
      setPortraitExpression("release", 0);
      releaseTimerRef.current = setTimeout(() => {
        releaseTimerRef.current = null;
        const hovered = engine.pointerSeen && engine.hovered;
        setPortraitExpression(hovered ? "surprised" : "neutral", 0);
        setCursorMode(hovered ? "grab" : "idle");
      }, 420);
      return;
    }
    clearBlinkTimers();
    clearReleaseTimer();
    engine.keyboardDragging = true;
    engine.draggingHead = true;
    engine.pointerSeen = false;
    engine.pointerX = event.key === "ArrowLeft" ? -0.8 : 0.8;
    engine.pointerY = 0;
    engine.dragDistance = engine.width * 0.3;
    setPortraitExpression("drag", 85);
    setCursorMode("drag");
  };

  const onKeyUp = (event: ReactKeyboardEvent<HTMLCanvasElement>) => {
    if (
      (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
      engineRef.current.keyboardDragging
    ) {
      event.preventDefault();
      finishPointer();
    }
  };

  const rigStyle = {
    "--expression-duration": `${expressionTransitionMs}ms`,
  } as CSSProperties;

  return (
    <div className="avatar-world" aria-hidden="false">
      <canvas
        ref={canvasRef}
        className={className}
        role="img"
        tabIndex={0}
        aria-label="Interactive caricature of Kranthi. Move over the face, drag it around, or draw through the background. Use the left and right arrow keys for keyboard interaction."
        aria-keyshortcuts="ArrowLeft ArrowRight"
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={() => finishPointer()}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={() => {
          if (engineRef.current.keyboardDragging) finishPointer();
        }}
      >
        Interactive caricature of Kranthi
      </canvas>

      <div
        ref={headRef}
        className="avatar-rig"
        data-expression={expression}
        style={rigStyle}
        aria-hidden="true"
      >
        <span className="avatar-rig__shadow" />
        {EXPRESSIONS.map((candidate) => (
          <div
            className={`avatar-rig__frame${
              candidate === expression ? " is-active" : ""
            }`}
            key={candidate}
          >
            <img
              className="avatar-rig__image"
              src={IMAGE_SOURCES[candidate]}
              alt=""
              draggable={false}
            />
            <img
              className="avatar-rig__depth avatar-rig__depth--hair"
              src={IMAGE_SOURCES[candidate]}
              alt=""
              draggable={false}
            />
            <img
              className="avatar-rig__depth avatar-rig__depth--features"
              src={IMAGE_SOURCES[candidate]}
              alt=""
              draggable={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default ElasticAvatar;
