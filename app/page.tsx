"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ElasticAvatar, type CursorMode } from "./ElasticAvatar";
import { InkCursor } from "./InkCursor";
import { useInteractionAudio } from "./useInteractionAudio";

const expressions = [
  {
    src: "/character/head-neutral-v3.png",
    alt: "Illustrated neutral expression of Kranthi",
    name: "Calm",
    note: "Default setting",
  },
  {
    src: "/character/head-surprised-v3.png",
    alt: "Illustrated surprised expression of Kranthi",
    name: "Whoa",
    note: "Hover reaction",
  },
  {
    src: "/character/head-drag-v3.png",
    alt: "Illustrated dragging expression of Kranthi",
    name: "Hold",
    note: "Active drag",
  },
  {
    src: "/character/head-release-v3.png",
    alt: "Illustrated laughing expression of Kranthi",
    name: "Release",
    note: "Elastic reset",
  },
];

export default function Home() {
  const [isOpen, setIsOpen] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [cursorMode, setCursorMode] = useState<CursorMode>("idle");
  const { enabled: soundEnabled, playSound, toggleSound } =
    useInteractionAudio();
  const panelRef = useRef<HTMLElement>(null);
  const currentProgress = useRef(0);
  const suppressClick = useRef(false);
  const drag = useRef({
    active: false,
    startX: 0,
    startProgress: 0,
    moved: 0,
    lastSoundX: 0,
  });

  const progress = isDragging ? dragProgress : isOpen ? 1 : 0;

  const setPanel = useCallback(
    (open: boolean) => {
      const target = open ? 1 : 0;
      const movedFromTarget = Math.abs(currentProgress.current - target);
      if (open !== isOpen || movedFromTarget > 0.04) {
        playSound(open ? "panel-open" : "panel-close", {
          intensity: Math.min(1, Math.max(0.25, movedFromTarget)),
          pan: 0.6,
        });
      }
      setIsOpen(open);
      setDragProgress(target);
      currentProgress.current = target;
    },
    [isOpen, playSound],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPanel(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setPanel]);

  const togglePanel = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setPanel(!isOpen);
  };

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      active: true,
      startX: event.clientX,
      startProgress: isOpen ? 1 : currentProgress.current,
      moved: 0,
      lastSoundX: event.clientX,
    };
    setIsDragging(true);
    setCursorMode("drag");
  };

  const onHandlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current.active) return;

    const panelWidth = panelRef.current?.getBoundingClientRect().width ?? 720;
    const delta = drag.current.startX - event.clientX;
    const next = Math.max(
      0,
      Math.min(1, drag.current.startProgress + delta / panelWidth),
    );

    drag.current.moved = Math.max(drag.current.moved, Math.abs(delta));
    currentProgress.current = next;
    setDragProgress(next);
    if (
      drag.current.moved > 4 &&
      Math.abs(event.clientX - drag.current.lastSoundX) >= 11
    ) {
      drag.current.lastSoundX = event.clientX;
      playSound("panel-pull", {
        intensity: Math.min(1, Math.max(0.2, Math.abs(delta) / 180)),
        pan: 0.6,
      });
    }
  };

  const finishHandleDrag = () => {
    if (!drag.current.active) return;

    const moved = drag.current.moved > 4;
    const nextOpen = currentProgress.current > 0.38;
    drag.current.active = false;
    setIsDragging(false);
    setCursorMode("pull");

    if (moved) {
      suppressClick.current = true;
      setPanel(nextOpen);
    }
  };

  const shellStyle = { "--panel-progress": progress } as CSSProperties;
  const panelStyle = {
    transform: `translate3d(${(1 - progress) * 100}%, 0, 0)`,
  } as CSSProperties;

  return (
    <main className="site-shell" style={shellStyle}>
      <InkCursor mode={cursorMode} />
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__texture" aria-hidden="true" />

        <header className="hero__header">
          <a className="wordmark" href="#hero-title" aria-label="Kranthi, home">
            <span className="wordmark__mark" aria-hidden="true" />
          </a>
          <button
            className="sound-toggle"
            type="button"
            aria-label="Sound effects"
            aria-pressed={soundEnabled}
            data-enabled={soundEnabled}
            onClick={toggleSound}
          >
            <span aria-hidden="true">SFX</span>
            {soundEnabled ? "ON" : "OFF"}
          </button>
          <p>Interactive caricature · 2026</p>
        </header>

        <div className="hero__content">
          <div className="hero__title-wrap">
            <p className="hero__kicker">Who am I?</p>
            <h1 id="hero-title">
              KRAN<span>THI</span>
            </h1>
          </div>

          <div className="avatar-stage">
            <ElasticAvatar
              className="avatar-canvas"
              onCursorModeChange={setCursorMode}
              onSoundCue={playSound}
            />
            <p className="scribble scribble--left" aria-hidden="true">
              Loose waves
              <br /> Heavy brows <span>↗</span>
            </p>
            <p className="scribble scribble--right" aria-hidden="true">
              Broad bridge
              <br /> Rounded tip <span>↖</span>
            </p>
            <p className="scribble scribble--drag" aria-hidden="true">
              Hover · grab · drag
              <span>↑</span>
            </p>
          </div>

          <p className="hero__lede">
            A hand-inked caricature built from the details
            <br /> that make me, me.
          </p>
        </div>

        <div className="hero__footer" aria-hidden="true">
          <span>01 · Hover</span>
          <span>02 · Grab</span>
          <span>03 · Draw</span>
          <span>04 · Pull</span>
        </div>
      </section>

      <aside
        ref={panelRef}
        className={`profile-panel${isDragging ? " is-dragging" : ""}`}
        style={panelStyle}
        aria-label="About Kranthi"
      >
        <button
          className="pull-handle"
          type="button"
          aria-expanded={isOpen}
          aria-controls="profile-content"
          onClick={togglePanel}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={finishHandleDrag}
          onPointerCancel={finishHandleDrag}
          onPointerEnter={() => setCursorMode("pull")}
          onPointerLeave={() => {
            if (!drag.current.active) setCursorMode("idle");
          }}
        >
          <span className="pull-handle__hint">{isOpen ? "Push?" : "Pull?"}</span>
          <img
            src="/character/pull-hand.png"
            alt=""
            aria-hidden="true"
            draggable={false}
          />
        </button>

        <div className="profile-panel__scroll" id="profile-content">
          <div className="panel-head">
            <p className="panel-kicker">Behind the caricature</p>
            <button
              className="panel-close"
              type="button"
              onClick={() => setPanel(false)}
              tabIndex={isOpen ? 0 : -1}
              aria-label="Close profile panel"
            >
              <img src="/character/close-sign.png" alt="" aria-hidden="true" />
            </button>
          </div>

          <div className="panel-doodle" aria-hidden="true">
            <img src="/character/head-release-v3.png" alt="" />
            <p>Yep. Still me.</p>
          </div>

          <section className="intro" aria-labelledby="about-title">
            <h2 id="about-title">
              Sup, I&apos;m
              <br /> <span>Kranthi.</span>
            </h2>
            <div className="intro__copy">
              <p>
                I&apos;m Kranthi, a senior backend software developer working
                primarily in Java and the JVM ecosystem.
              </p>
              <p>
                I build APIs, services, integrations, and the logic behind the
                screen—the systems that keep products reliable after a click.
                This caricature is the rare bit of me that runs in the browser.
              </p>
            </div>
          </section>

          <section className="feature-list" aria-labelledby="features-title">
            <div className="feature-list__head">
              <p className="panel-kicker">Backend notes</p>
              <h2 id="features-title">What runs underneath.</h2>
            </div>
            <dl>
              <div>
                <dt>Role</dt>
                <dd>
                  Senior backend developer—the responsibility is longer than
                  the title
                </dd>
              </div>
              <div>
                <dt>Java</dt>
                <dd>The main language. Semicolons included</dd>
              </div>
              <div>
                <dt>Systems</dt>
                <dd>APIs, services, integrations, and data flows</dd>
              </div>
              <div>
                <dt>Standard</dt>
                <dd>Reliable, observable, maintainable—or it isn&apos;t done</dd>
              </div>
            </dl>
          </section>

          <section className="expressions" aria-labelledby="expressions-title">
            <div className="expressions__head">
              <p className="panel-kicker">Four moods, one face</p>
              <h2 id="expressions-title">Expressions.</h2>
            </div>
            <div className="expressions__grid">
              {expressions.map((expression, index) => (
                <figure className="expression-card" key={expression.src}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <img src={expression.src} alt={expression.alt} loading="lazy" />
                  <figcaption>
                    <strong>{expression.name}</strong>
                    <small>{expression.note}</small>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>

          <footer className="panel-footer">
            <p>Pull. React. Repeat.</p>
            <span>Kranthi · Interactive caricature · 2026</span>
          </footer>
        </div>
      </aside>
    </main>
  );
}
