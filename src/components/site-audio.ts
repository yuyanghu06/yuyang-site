"use client";

export type SiteAudioView = "globe" | "manhattan" | "washington" | "union";

type FadeHandle = { cancel: () => void };

const EXPONENTIAL_STRENGTH = 5;
const MIN_AUDIBLE_VOLUME = 0.0001;
const activeFades = new WeakMap<HTMLAudioElement, FadeHandle>();

const exponentialProgress = (progress: number, fadingIn: boolean) => {
  if (fadingIn) {
    return Math.expm1(EXPONENTIAL_STRENGTH * progress) / Math.expm1(EXPONENTIAL_STRENGTH);
  }
  return (1 - Math.exp(-EXPONENTIAL_STRENGTH * progress)) / (1 - Math.exp(-EXPONENTIAL_STRENGTH));
};

export const fadeAudioVolume = (
  audio: HTMLAudioElement,
  targetVolume: number,
  durationMs: number,
  onComplete?: () => void,
) => {
  activeFades.get(audio)?.cancel();
  const fromVolume = audio.volume;
  const safeTarget = Math.min(1, Math.max(0, targetVolume));
  if (durationMs <= 0 || Math.abs(fromVolume - safeTarget) < MIN_AUDIBLE_VOLUME) {
    audio.volume = safeTarget;
    onComplete?.();
    return { cancel: () => undefined } satisfies FadeHandle;
  }

  const startedAt = performance.now();
  const fadingIn = safeTarget > fromVolume;
  let frame = 0;
  let cancelled = false;
  const handle: FadeHandle = {
    cancel: () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (activeFades.get(audio) === handle) activeFades.delete(audio);
    },
  };
  activeFades.set(audio, handle);

  const update = (now: number) => {
    if (cancelled) return;
    const progress = Math.min(1, (now - startedAt) / durationMs);
    const eased = exponentialProgress(progress, fadingIn);
    audio.volume = fromVolume + (safeTarget - fromVolume) * eased;
    if (progress < 1) {
      frame = requestAnimationFrame(update);
      return;
    }
    audio.volume = safeTarget;
    activeFades.delete(audio);
    onComplete?.();
  };
  frame = requestAnimationFrame(update);
  return handle;
};

const stopAndReset = (audio: HTMLAudioElement) => {
  activeFades.get(audio)?.cancel();
  audio.pause();
  audio.currentTime = 0;
};

let dialogueAudio: HTMLAudioElement | null = null;
const getDialogueAudio = () => {
  if (!dialogueAudio) {
    dialogueAudio = new Audio("/audio/sans-dialogue-blip.mp3");
    dialogueAudio.preload = "auto";
    dialogueAudio.volume = 0.11;
    dialogueAudio.playbackRate = 1.4;
    dialogueAudio.preservesPitch = false;
  }
  return dialogueAudio;
};

export const playDialogueBlip = () => {
  const audio = getDialogueAudio();
  audio.currentTime = 0;
  void audio.play().catch(() => undefined);
};

export const stopDialogueBlip = () => {
  getDialogueAudio().pause();
};

export const primeDialogueAudio = async () => {
  const audio = getDialogueAudio();
  const volume = audio.volume;
  audio.volume = 0;
  audio.currentTime = 0;
  await audio.play();
  audio.pause();
  audio.currentTime = 0;
  audio.volume = volume;
};

export type MapAudioState = {
  view: SiteAudioView;
  experienceStarted: boolean;
  cameraLocked: boolean;
  cameraTransitioning: boolean;
  globeTransitioning: boolean;
};

export const createMapAudioController = () => {
  const crowd = new Audio("/audio/community-crowd-talking-1m20.m4a");
  crowd.loop = true;
  crowd.volume = 0;
  const ambience = new Audio("/audio/far-away-city-traffic-ambience.wav");
  ambience.loop = true;
  ambience.volume = 0;
  const zoom = new Audio("/audio/gamestudio-world-cloud-zoom.mp3");
  zoom.preload = "auto";
  zoom.volume = 0;
  const backgroundTracks = [
    "/audio/background-416-chiptune.mp3",
    "/audio/background-platform-shoes.mp3",
    "/audio/background-pixel-dreams.mp3",
    "/audio/background-exploration-chiptune.mp3",
  ].map((source) => {
    const audio = new Audio(source);
    audio.preload = "metadata";
    audio.volume = 0;
    return audio;
  });

  const CROWD_VOLUME = 0.216;
  const CROWD_FADE_MS = 250;
  const AMBIENCE_BASE_VOLUME = 0.27378;
  const AMBIENCE_CLOSE_VOLUME = 0.328536;
  const AMBIENCE_FADE_MS = 1200;
  const ZOOM_VOLUME = 0.1;
  const ZOOM_FADE_MS = 200;
  const BACKGROUND_VOLUME = 0.06;
  const BACKGROUND_CROSSFADE_MS = 3000;
  let crowdEnabled = false;
  let ambienceTarget = 0;
  let zoomWatcher = 0;
  let zoomGeneration = 0;
  let backgroundEnabled = false;
  let backgroundStarted = false;
  let backgroundIndex = 0;
  let backgroundGeneration = 0;
  const loopGenerations = new WeakMap<HTMLAudioElement, number>();

  const setLoop = (audio: HTMLAudioElement, enabled: boolean, target: number, fadeMs: number) => {
    const generation = (loopGenerations.get(audio) ?? 0) + 1;
    loopGenerations.set(audio, generation);
    if (enabled) {
      if (audio.paused) {
        audio.volume = 0;
        void audio.play().then(() => {
          if (loopGenerations.get(audio) === generation) fadeAudioVolume(audio, target, fadeMs);
        }).catch(() => undefined);
      } else {
        fadeAudioVolume(audio, target, fadeMs);
      }
      return;
    }
    fadeAudioVolume(audio, 0, fadeMs, () => stopAndReset(audio));
  };

  const playBackgroundTrack = (index: number) => {
    const audio = backgroundTracks[index];
    const generation = ++backgroundGeneration;
    backgroundIndex = index;
    backgroundStarted = true;
    audio.currentTime = 0;
    audio.volume = 0;
    void audio.play().then(() => {
      if (backgroundGeneration === generation && backgroundEnabled) {
        fadeAudioVolume(audio, BACKGROUND_VOLUME, BACKGROUND_CROSSFADE_MS);
      }
    }).catch(() => {
      if (backgroundGeneration === generation) backgroundStarted = false;
    });
  };

  const setBackgroundEnabled = (enabled: boolean) => {
    if (enabled === backgroundEnabled) return;
    backgroundEnabled = enabled;
    if (enabled) {
      playBackgroundTrack(backgroundIndex);
      return;
    }
    backgroundGeneration += 1;
    backgroundStarted = false;
    for (const audio of backgroundTracks) {
      fadeAudioVolume(audio, 0, BACKGROUND_CROSSFADE_MS, () => stopAndReset(audio));
    }
  };

  const updateBackgroundPlaylist = () => {
    if (!backgroundEnabled) return;
    if (!backgroundStarted) {
      playBackgroundTrack(backgroundIndex);
      return;
    }
    const current = backgroundTracks[backgroundIndex];
    const duration = current.duration;
    const shouldAdvance = current.ended
      || (Number.isFinite(duration) && duration - current.currentTime <= BACKGROUND_CROSSFADE_MS / 1000);
    if (!shouldAdvance) return;
    const previous = current;
    const nextIndex = (backgroundIndex + 1) % backgroundTracks.length;
    playBackgroundTrack(nextIndex);
    fadeAudioVolume(previous, 0, BACKGROUND_CROSSFADE_MS, () => stopAndReset(previous));
  };

  const update = ({ view, experienceStarted, cameraLocked, cameraTransitioning, globeTransitioning }: MapAudioState) => {
    setBackgroundEnabled(experienceStarted);
    updateBackgroundPlaylist();
    const nextCrowdEnabled = (view === "washington" || view === "union")
      && cameraLocked && !cameraTransitioning && !globeTransitioning;
    if (nextCrowdEnabled !== crowdEnabled) {
      crowdEnabled = nextCrowdEnabled;
      setLoop(crowd, crowdEnabled, CROWD_VOLUME, CROWD_FADE_MS);
    }

    const nextAmbienceTarget = globeTransitioning || view === "globe"
      ? 0
      : view === "manhattan" ? AMBIENCE_BASE_VOLUME : AMBIENCE_CLOSE_VOLUME;
    if (nextAmbienceTarget !== ambienceTarget) {
      ambienceTarget = nextAmbienceTarget;
      setLoop(ambience, ambienceTarget > 0, ambienceTarget, AMBIENCE_FADE_MS);
    }
  };

  const playGlobeTransition = () => {
    const generation = ++zoomGeneration;
    cancelAnimationFrame(zoomWatcher);
    stopAndReset(zoom);
    zoom.volume = 0;
    void zoom.play().then(() => {
      if (zoomGeneration === generation) fadeAudioVolume(zoom, ZOOM_VOLUME, ZOOM_FADE_MS);
    }).catch(() => undefined);
    const watchForFadeOut = () => {
      if (zoomGeneration !== generation) return;
      const duration = zoom.duration || 2.168;
      if (duration - zoom.currentTime <= ZOOM_FADE_MS / 1000) {
        fadeAudioVolume(zoom, 0, ZOOM_FADE_MS, () => stopAndReset(zoom));
        zoomWatcher = 0;
        return;
      }
      if (!zoom.paused && !zoom.ended) zoomWatcher = requestAnimationFrame(watchForFadeOut);
      else zoomWatcher = 0;
    };
    zoomWatcher = requestAnimationFrame(watchForFadeOut);
  };

  const dispose = () => {
    zoomGeneration += 1;
    backgroundGeneration += 1;
    cancelAnimationFrame(zoomWatcher);
    for (const audio of [crowd, ambience, zoom, ...backgroundTracks]) {
      loopGenerations.set(audio, (loopGenerations.get(audio) ?? 0) + 1);
      stopAndReset(audio);
      audio.src = "";
    }
  };

  return { dispose, playGlobeTransition, update };
};
