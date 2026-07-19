"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type InteractionSoundCue =
  | "wake"
  | "grab"
  | "drag"
  | "draw"
  | "release"
  | "panel-pull"
  | "panel-open"
  | "panel-close";

export type InteractionSoundDetail = {
  intensity?: number;
  pan?: number;
};

type AudioEngine = {
  context: AudioContext;
  compressor: DynamicsCompressorNode;
  master: GainNode;
  whiteNoise: AudioBuffer;
  brownNoise: AudioBuffer;
  lastPlayed: Map<InteractionSoundCue, number>;
};

const STORAGE_KEY = "kranthi-sfx-enabled";
const MASTER_LEVEL = 0.16;
const SILENCE = 0.0001;
const COOLDOWN_MS: Record<InteractionSoundCue, number> = {
  wake: 260,
  grab: 130,
  drag: 76,
  draw: 54,
  release: 300,
  "panel-pull": 92,
  "panel-open": 220,
  "panel-close": 220,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const makeNoise = (context: AudioContext, brown: boolean) => {
  const frameCount = Math.round(context.sampleRate * 0.7);
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  let previous = 0;

  for (let index = 0; index < frameCount; index += 1) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      previous = (previous + white * 0.085) / 1.085;
      data[index] = previous * 3.2;
    } else {
      data[index] = white;
    }
  }

  return buffer;
};

const connectWithPan = (
  engine: AudioEngine,
  source: AudioNode,
  pan: number,
) => {
  if (typeof engine.context.createStereoPanner !== "function") {
    source.connect(engine.compressor);
    return;
  }
  const panner = engine.context.createStereoPanner();
  panner.pan.value = clamp(pan, -0.28, 0.28);
  source.connect(panner);
  panner.connect(engine.compressor);
};

type ToneOptions = {
  delay?: number;
  duration: number;
  endFrequency: number;
  frequency: number;
  gain: number;
  pan: number;
  type?: OscillatorType;
};

const tone = (engine: AudioEngine, options: ToneOptions) => {
  const context = engine.context;
  const start = context.currentTime + (options.delay ?? 0);
  const end = start + options.duration;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();

  oscillator.type = options.type ?? "triangle";
  oscillator.frequency.setValueAtTime(options.frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(20, options.endFrequency),
    end,
  );
  envelope.gain.setValueAtTime(SILENCE, start);
  envelope.gain.linearRampToValueAtTime(options.gain, start + 0.004);
  envelope.gain.exponentialRampToValueAtTime(SILENCE, end);
  oscillator.connect(envelope);
  connectWithPan(engine, envelope, options.pan);
  oscillator.start(start);
  oscillator.stop(end + 0.015);
};

type NoiseOptions = {
  brown?: boolean;
  delay?: number;
  duration: number;
  endFrequency?: number;
  frequency: number;
  gain: number;
  pan: number;
  q?: number;
  type?: BiquadFilterType;
};

const noise = (engine: AudioEngine, options: NoiseOptions) => {
  const context = engine.context;
  const start = context.currentTime + (options.delay ?? 0);
  const end = start + options.duration;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const envelope = context.createGain();

  source.buffer = options.brown ? engine.brownNoise : engine.whiteNoise;
  source.loop = true;
  filter.type = options.type ?? "bandpass";
  filter.Q.value = options.q ?? 1.2;
  filter.frequency.setValueAtTime(options.frequency, start);
  if (options.endFrequency) {
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, options.endFrequency),
      end,
    );
  }
  envelope.gain.setValueAtTime(SILENCE, start);
  envelope.gain.linearRampToValueAtTime(options.gain, start + 0.002);
  envelope.gain.exponentialRampToValueAtTime(SILENCE, end);
  source.connect(filter);
  filter.connect(envelope);
  connectWithPan(engine, envelope, options.pan);
  source.start(start, Math.random() * 0.45);
  source.stop(end + 0.01);
};

const elasticRelease = (
  engine: AudioEngine,
  intensity: number,
  pan: number,
) => {
  const context = engine.context;
  const start = context.currentTime;
  const end = start + 0.25;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(145, start);
  oscillator.frequency.exponentialRampToValueAtTime(260, start + 0.032);
  oscillator.frequency.exponentialRampToValueAtTime(85, end);
  envelope.gain.setValueAtTime(SILENCE, start);
  envelope.gain.linearRampToValueAtTime(0.12 + intensity * 0.1, start + 0.004);
  envelope.gain.exponentialRampToValueAtTime(0.055, start + 0.05);
  envelope.gain.exponentialRampToValueAtTime(SILENCE, end);
  oscillator.connect(envelope);
  connectWithPan(engine, envelope, pan);
  oscillator.start(start);
  oscillator.stop(end + 0.015);

  tone(engine, {
    duration: 0.24,
    endFrequency: 52,
    frequency: 72,
    gain: 0.035 + intensity * 0.025,
    pan,
    type: "sine",
  });
  noise(engine, {
    duration: 0.025,
    frequency: 3500,
    gain: 0.04 + intensity * 0.025,
    pan,
    type: "highpass",
  });
};

const synthesize = (
  engine: AudioEngine,
  cue: InteractionSoundCue,
  detail: InteractionSoundDetail,
) => {
  const intensity = clamp(detail.intensity ?? 0.6, 0.12, 1);
  const pan = clamp(detail.pan ?? 0, -1, 1) * 0.26;

  switch (cue) {
    case "wake":
      tone(engine, {
        duration: 0.078,
        endFrequency: 760,
        frequency: 520,
        gain: 0.13,
        pan,
      });
      noise(engine, {
        duration: 0.032,
        frequency: 2400,
        gain: 0.035,
        pan,
      });
      break;
    case "grab":
      tone(engine, {
        duration: 0.102,
        endFrequency: 112,
        frequency: 185,
        gain: 0.18,
        pan,
      });
      noise(engine, {
        duration: 0.014,
        frequency: 2800,
        gain: 0.055,
        pan,
        type: "highpass",
      });
      break;
    case "drag":
      noise(engine, {
        brown: true,
        duration: 0.06,
        frequency: 650 + intensity * 850,
        gain: 0.035 + intensity * 0.045,
        pan,
        q: 2.2,
      });
      tone(engine, {
        duration: 0.062,
        endFrequency: 88 + intensity * 42,
        frequency: 105 + intensity * 62,
        gain: 0.022 + intensity * 0.026,
        pan,
      });
      break;
    case "draw":
      noise(engine, {
        duration: 0.044,
        endFrequency: 1800 + intensity * 900,
        frequency: 2500 + intensity * 1700,
        gain: 0.025 + intensity * 0.04,
        pan,
        q: 1.1,
      });
      break;
    case "release":
      elasticRelease(engine, intensity, pan);
      break;
    case "panel-pull":
      noise(engine, {
        brown: true,
        duration: 0.068,
        frequency: 760 + intensity * 720,
        gain: 0.032 + intensity * 0.035,
        pan: 0.16,
        q: 1.8,
      });
      tone(engine, {
        duration: 0.066,
        endFrequency: 92,
        frequency: 126,
        gain: 0.038,
        pan: 0.16,
      });
      break;
    case "panel-open":
      tone(engine, {
        duration: 0.052,
        endFrequency: 660,
        frequency: 610,
        gain: 0.105,
        pan: 0.12,
        type: "sine",
      });
      tone(engine, {
        delay: 0.066,
        duration: 0.064,
        endFrequency: 970,
        frequency: 915,
        gain: 0.09,
        pan: 0.12,
        type: "sine",
      });
      noise(engine, {
        duration: 0.12,
        endFrequency: 1200,
        frequency: 3000,
        gain: 0.022,
        pan: 0.12,
      });
      break;
    case "panel-close":
      tone(engine, {
        duration: 0.055,
        endFrequency: 680,
        frequency: 760,
        gain: 0.085,
        pan: 0.12,
        type: "sine",
      });
      tone(engine, {
        delay: 0.058,
        duration: 0.07,
        endFrequency: 430,
        frequency: 500,
        gain: 0.08,
        pan: 0.12,
        type: "sine",
      });
      break;
  }
};

export function useInteractionAudio() {
  const engineRef = useRef<AudioEngine | null>(null);
  const enabledRef = useRef(true);
  const [enabled, setEnabled] = useState(true);

  const ensureEngine = useCallback(() => {
    if (engineRef.current) return engineRef.current;

    let context: AudioContext | null = null;
    try {
      const AudioContextClass =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return null;

      context = new AudioContextClass({ latencyHint: "interactive" });
      const compressor = context.createDynamicsCompressor();
      const master = context.createGain();
      compressor.threshold.value = -18;
      compressor.knee.value = 8;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.12;
      master.gain.value = enabledRef.current ? MASTER_LEVEL : SILENCE;
      compressor.connect(master);
      master.connect(context.destination);

      engineRef.current = {
        context,
        compressor,
        master,
        whiteNoise: makeNoise(context, false),
        brownNoise: makeNoise(context, true),
        lastPlayed: new Map(),
      };
      return engineRef.current;
    } catch {
      if (
        context &&
        context.state !== "closed" &&
        typeof context.close === "function"
      ) {
        try {
          void context.close().catch(() => undefined);
        } catch {
          // Ignore cleanup failures from partial implementations.
        }
      }
      return null;
    }
  }, []);

  const unlock = useCallback(() => {
    if (!enabledRef.current) return;
    const engine = ensureEngine();
    if (engine && engine.context.state !== "running") {
      void engine.context.resume().catch(() => undefined);
    }
  }, [ensureEngine]);

  const playSound = useCallback(
    (cue: InteractionSoundCue, detail: InteractionSoundDetail = {}) => {
      if (!enabledRef.current) return;
      if (cue === "wake" && !engineRef.current) return;

      const engine = ensureEngine();
      if (!engine) return;
      const play = () => {
        if (!enabledRef.current || engine.context.state !== "running") return;
        const now = performance.now();
        const lastPlayed = engine.lastPlayed.get(cue) ?? -Infinity;
        if (now - lastPlayed < COOLDOWN_MS[cue]) return;
        engine.lastPlayed.set(cue, now);
        try {
          synthesize(engine, cue, detail);
        } catch {
          // Audio feedback must never interrupt the visual interaction.
        }
      };

      if (engine.context.state !== "running") {
        void engine.context.resume().then(play).catch(() => undefined);
      } else {
        play();
      }
    },
    [ensureEngine],
  );

  const toggleSound = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Storage is optional; sound still works for this visit.
    }

    const existing = engineRef.current;
    if (!next) {
      if (existing) {
        try {
          const now = existing.context.currentTime;
          existing.master.gain.cancelScheduledValues(now);
          existing.master.gain.setValueAtTime(existing.master.gain.value, now);
          existing.master.gain.exponentialRampToValueAtTime(
            SILENCE,
            now + 0.035,
          );
        } catch {
          // The stored preference still applies when audio is unavailable.
        }
      }
      return;
    }

    const engine = existing ?? ensureEngine();
    if (!engine) return;
    const enable = () => {
      if (!enabledRef.current) return;
      try {
        const now = engine.context.currentTime;
        engine.master.gain.cancelScheduledValues(now);
        engine.master.gain.setValueAtTime(SILENCE, now);
        engine.master.gain.linearRampToValueAtTime(MASTER_LEVEL, now + 0.04);
        tone(engine, {
          duration: 0.055,
          endFrequency: 710,
          frequency: 560,
          gain: 0.09,
          pan: 0,
          type: "sine",
        });
      } catch {
        // Keep the visual toggle usable on partial Web Audio implementations.
      }
    };
    if (engine.context.state !== "running") {
      void engine.context.resume().then(enable).catch(() => undefined);
    } else {
      enable();
    }
  }, [ensureEngine]);

  useEffect(() => {
    let preferenceFrame: number | null = null;
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "0") {
        enabledRef.current = false;
        preferenceFrame = window.requestAnimationFrame(() => {
          setEnabled(false);
        });
      }
    } catch {
      // Keep the default for storage-restricted browsers.
    }

    const unlockFromGesture = () => unlock();
    window.addEventListener("pointerdown", unlockFromGesture, true);
    window.addEventListener("keydown", unlockFromGesture, true);
    return () => {
      window.removeEventListener("pointerdown", unlockFromGesture, true);
      window.removeEventListener("keydown", unlockFromGesture, true);
      if (preferenceFrame !== null) {
        window.cancelAnimationFrame(preferenceFrame);
      }
    };
  }, [unlock]);

  useEffect(() => {
    const onVisibilityChange = () => {
      const context = engineRef.current?.context;
      if (document.hidden && context?.state === "running") {
        void context.suspend().catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      const context = engineRef.current?.context;
      engineRef.current = null;
      if (
        context &&
        context.state !== "closed" &&
        typeof context.close === "function"
      ) {
        try {
          void context.close().catch(() => undefined);
        } catch {
          // Ignore cleanup failures from partial implementations.
        }
      }
    };
  }, []);

  return { enabled, playSound, toggleSound };
}
