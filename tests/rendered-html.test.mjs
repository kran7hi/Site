import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders Kranthi's interactive illustrated caricature", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Kranthi — An Interactive Caricature<\/title>/i);
  assert.match(html, /\/brand\/horse-mark\.png/);
  assert.match(html, /Who am I\?/);
  assert.match(html, /Sup, I/);
  assert.match(html, /senior backend software developer/i);
  assert.match(html, /What runs underneath\./);
  assert.match(html, /Pull\. React\. Repeat\./);
  assert.doesNotMatch(html, /Character notes|Wavy, full|flecked with grey/i);
  assert.doesNotMatch(html, /Your site is taking shape/);
});

test("ships the illustrated character set without direct photo assets", async () => {
  const [page, layout, styles, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /ElasticAvatar/);
  assert.match(page, /className="wordmark__mark"/);
  assert.match(page, /href="\/"/);
  assert.doesNotMatch(page, /href="#hero-title"/);
  assert.match(page, /window\.history\.replaceState\(null, "", "\/"\)/);
  assert.match(page, /window\.location\.reload\(\)/);
  assert.doesNotMatch(page, />\s*K :D\s*</);
  assert.match(layout, /\/brand\/horse-mark\.png/);
  assert.match(styles, /\/brand\/horse-gallop\.webp/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(
    styles,
    /\.avatar-canvas\s*\{[^}]*-webkit-touch-callout:\s*none;[^}]*-webkit-user-select:\s*none;[^}]*user-select:\s*none;/s,
  );
  assert.match(page, /character\/head-neutral-v3\.png/);
  assert.match(page, /character\/pull-hand\.png/);
  assert.match(page, /aria-expanded=\{isOpen\}/);
  assert.match(page, /profile-panel/);
  assert.doesNotMatch(page, /SkeletonPreview/);
  assert.doesNotMatch(page, /public\/images|kranthi-hero\.jpg|\.HEIC/i);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await Promise.all([
    access(new URL("../public/character/head-neutral-v3.png", import.meta.url)),
    access(new URL("../public/character/head-surprised-v3.png", import.meta.url)),
    access(new URL("../public/character/head-drag-v3.png", import.meta.url)),
    access(new URL("../public/character/head-release-v3.png", import.meta.url)),
    access(new URL("../public/character/head-blink-v3.png", import.meta.url)),
    access(new URL("../public/character/pull-hand.png", import.meta.url)),
    access(new URL("../public/brand/horse-mark.png", import.meta.url)),
    access(new URL("../public/brand/horse-gallop.webp", import.meta.url)),
  ]);

  const gallop = await readFile(
    new URL("../public/brand/horse-gallop.webp", import.meta.url),
  );
  assert.equal(gallop.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(gallop.subarray(8, 12).toString("ascii"), "WEBP");
  assert.ok(gallop.includes(Buffer.from("ANIM")));
  assert.ok(gallop.toString("latin1").match(/ANMF/g)?.length >= 12);

  await assert.rejects(access(new URL("../public/images", import.meta.url)));
});

test("stages release recovery and natural blinking", async () => {
  const avatar = await readFile(
    new URL("../app/ElasticAvatar.tsx", import.meta.url),
    "utf8",
  );

  assert.match(avatar, /const RELEASE_HOLD_MS = 640/);
  assert.match(avatar, /isInsideRestingHead/);
  assert.match(avatar, /releaseIsSettling/);
  assert.match(avatar, /src=\{IMAGE_SOURCES\[candidate\]\}/);
  assert.doesNotMatch(
    avatar,
    /GAZE_SOURCES|GAZE_APERTURE_SOURCES|BASE_IMAGE_SOURCES|portrait-gaze/,
  );
  assert.match(avatar, /const BLINK_HOLD_MS = 92/);
  assert.match(avatar, /previous === "blink" \|\| next === "blink"/);
  assert.match(avatar, /BLINK_DELAYS_MS/);
});

test("keeps mobile face drags separate from page scrolling", async () => {
  const [avatar, styles] = await Promise.all([
    readFile(new URL("../app/ElasticAvatar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(avatar, /className="avatar-rig__hit-area"/);
  assert.match(avatar, /className="avatar-rig__hit-area"[\s\S]*onPointerDown=\{onPointerDown\}/);
  assert.match(styles, /\.avatar-canvas\s*\{[^}]*touch-action:\s*pan-y;/s);
  assert.match(styles, /\.avatar-rig__hit-area\s*\{[^}]*touch-action:\s*none;/s);
});

test("adds original gesture-gated interaction sounds and a persistent mute control", async () => {
  const [page, avatar, audio] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ElasticAvatar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/useInteractionAudio.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /useInteractionAudio/);
  assert.match(page, /className="sound-toggle"/);
  assert.match(page, /aria-pressed=\{soundEnabled\}/);
  assert.match(page, /onSoundCue=\{playSound\}/);
  assert.match(avatar, /emitSound\("wake"/);
  assert.match(avatar, /emitSound\("grab"/);
  assert.match(avatar, /emitSound\("release"/);
  assert.match(audio, /new AudioContextClass\(\{ latencyHint: "interactive" \}\)/);
  assert.match(audio, /createDynamicsCompressor/);
  assert.match(audio, /COOLDOWN_MS/);
  assert.match(audio, /kranthi-sfx-enabled/);
  assert.doesNotMatch(audio, /unityispower|\.ogg|new Audio\(/i);
});
