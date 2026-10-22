"use client";

import { isSanDiegoView, type GeographicMapView, type LandmarkCameraViewId } from "@/agent/context/camera-views";

export type SiteAudioView = GeographicMapView;

type FadeHandle = { cancel: () => void };
export type SiteAudioChannel = "effects" | "music";

const EXPONENTIAL_STRENGTH = 5;
const MIN_AUDIBLE_VOLUME = 0.0001;
const clampVolume = (volume: number) => Math.min(1, Math.max(0, volume));
const activeFades = new WeakMap<HTMLAudioElement, FadeHandle>();
const channelAudio = {
  effects: new Set<HTMLAudioElement>(),
  music: new Set<HTMLAudioElement>(),
};
const channelMuted: Record<SiteAudioChannel, boolean> = { effects: false, music: false };
const musicMuteListeners = new Set<() => void>();

const registerChannelAudio = (audio: HTMLAudioElement, channel: SiteAudioChannel) => {
  channelAudio[channel].add(audio);
  audio.muted = channelMuted[channel];
  return audio;
};

export const getSiteAudioMuted = (channel: SiteAudioChannel) => channelMuted[channel];

export const setSiteAudioMuted = (channel: SiteAudioChannel, muted: boolean) => {
  channelMuted[channel] = muted;
  channelAudio[channel].forEach((audio) => {
    audio.muted = muted;
  });
  if (channel === "music") musicMuteListeners.forEach((listener) => listener());
};

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
  const safeTarget = clampVolume(targetVolume);
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
    const progress = Math.min(1, Math.max(0, (now - startedAt) / durationMs));
    const eased = exponentialProgress(progress, fadingIn);
    audio.volume = clampVolume(fromVolume + (safeTarget - fromVolume) * eased);
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
let audioGesturePrimed = false;
const hasAudioActivation = () => audioGesturePrimed
  || (typeof navigator !== "undefined" && navigator.userActivation?.hasBeenActive === true);
const getDialogueAudio = () => {
  if (!dialogueAudio) {
    dialogueAudio = registerChannelAudio(new Audio("/audio/sans-dialogue-blip.mp3"), "effects");
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
  if (audio.paused) void audio.play().catch(() => undefined);
};

export const stopDialogueBlip = () => {
  dialogueAudio?.pause();
};

export const primeDialogueAudio = async () => {
  // The experience CTA calls this synchronously from its user gesture.
  audioGesturePrimed = true;
  const audio = getDialogueAudio();
  const volume = audio.volume;
  audio.volume = 0;
  audio.currentTime = 0;
  try {
    await audio.play();
  } finally {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = volume;
  }
};

export type MapAudioState = {
  view: SiteAudioView;
  selectedLandmark: LandmarkCameraViewId | null;
  experienceStarted: boolean;
  cameraLocked: boolean;
  cameraTransitioning: boolean;
  globeTransitioning: boolean;
};

export const createMapAudioController = () => {
  const sources = new Map<HTMLAudioElement, string>();
  const createAudio = (source: string, channel: SiteAudioChannel, loop = false) => {
    // Even metadata preload can fetch an entire MP3. Leave sources unset until needed.
    const audio = registerChannelAudio(new Audio(), channel);
    audio.preload = "none";
    audio.loop = loop;
    audio.volume = 0;
    sources.set(audio, source);
    return audio;
  };
  const prepareAudio = (audio: HTMLAudioElement) => {
    if (audio.getAttribute("src")) return;
    audio.preload = "auto";
    audio.src = sources.get(audio)!;
    audio.load();
  };
  const releaseAudio = (audio: HTMLAudioElement) => {
    stopAndReset(audio);
    audio.preload = "none";
    if (!audio.getAttribute("src")) return;
    audio.removeAttribute("src");
    audio.load();
  };
  const crowd = createAudio("/audio/community-crowd-talking-1m20.m4a", "effects", true);
  const mall = createAudio("/audio/vons-shopping-mall-ambience.mp3", "effects", true);
  const birds = createAudio("/audio/san-diego-suburban-birds.mp3", "effects", true);
  const ambience = createAudio("/audio/far-away-city-traffic-ambience.m4a", "effects", true);
  const zoom = createAudio("/audio/gamestudio-world-cloud-zoom.mp3", "effects");
  const backgroundTracks = [
    "/audio/background-416-chiptune.m4a",
    "/audio/background-platform-shoes.m4a",
    "/audio/background-pixel-dreams.m4a",
    "/audio/background-exploration-chiptune.m4a",
  ].map((source) => createAudio(source, "music"));

  const CROWD_VOLUME = 0.216;
  const CROWD_FADE_MS = 250;
  const AMBIENCE_BASE_VOLUME = 0.27378;
  const AMBIENCE_CLOSE_VOLUME = 0.328536;
  const AMBIENCE_FADE_MS = 1200;
  const ZOOM_VOLUME = 0.1;
  const ZOOM_FADE_MS = 200;
  const BACKGROUND_VOLUME = 0.06;
  const BACKGROUND_CROSSFADE_MS = 3000;
  const BACKGROUND_PREPARE_SECONDS = 12;
  let crowdEnabled = false;
  let mallEnabled = false;
  let birdsEnabled = false;
  let ambienceTarget = 0;
  let zoomWatcher = 0;
  let zoomGeneration = 0;
  let backgroundEnabled = false;
  let backgroundStarted = false;
  let backgroundIndex = 0;
  let backgroundGeneration = 0;
  let sanDiegoPrepared = false;
  let disposed = false;
  const loopGenerations = new WeakMap<HTMLAudioElement, number>();

  const prepareSanDiego = () => {
    if (disposed || sanDiegoPrepared || !hasAudioActivation()) return;
    sanDiegoPrepared = true;
    prepareAudio(mall);
    prepareAudio(birds);
  };

  const setLoop = (audio: HTMLAudioElement, enabled: boolean, target: number, fadeMs: number) => {
    const generation = (loopGenerations.get(audio) ?? 0) + 1;
    loopGenerations.set(audio, generation);
    if (enabled) {
      activeFades.get(audio)?.cancel();
      prepareAudio(audio);
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

  const playBackgroundTrack = (index: number, previousIndex?: number, resume = false) => {
    if (disposed || !backgroundEnabled || channelMuted.music || !hasAudioActivation()) return;
    const audio = backgroundTracks[index];
    const generation = ++backgroundGeneration;
    backgroundIndex = index;
    backgroundStarted = true;
    activeFades.get(audio)?.cancel();
    prepareAudio(audio);
    if (!resume) audio.currentTime = 0;
    audio.volume = 0;
    void audio.play().then(() => {
      if (!disposed && backgroundGeneration === generation && backgroundEnabled && !channelMuted.music) {
        fadeAudioVolume(audio, BACKGROUND_VOLUME, BACKGROUND_CROSSFADE_MS);
        if (previousIndex !== undefined) {
          const previous = backgroundTracks[previousIndex];
          fadeAudioVolume(previous, 0, BACKGROUND_CROSSFADE_MS, () => releaseAudio(previous));
        }
      }
    }).catch(() => {
      if (!disposed && backgroundGeneration === generation) {
        backgroundIndex = previousIndex ?? index;
        backgroundStarted = previousIndex !== undefined;
      }
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
      if (channelMuted.music) releaseAudio(audio);
      else fadeAudioVolume(audio, 0, BACKGROUND_CROSSFADE_MS, () => releaseAudio(audio));
    }
  };

  const updateBackgroundPlaylist = () => {
    if (!backgroundEnabled || channelMuted.music) return;
    if (!backgroundStarted) {
      playBackgroundTrack(backgroundIndex);
      return;
    }
    const current = backgroundTracks[backgroundIndex];
    const duration = current.duration;
    const remaining = duration - current.currentTime;
    const nextIndex = (backgroundIndex + 1) % backgroundTracks.length;
    if (Number.isFinite(duration) && remaining <= BACKGROUND_PREPARE_SECONDS) {
      prepareAudio(backgroundTracks[nextIndex]);
    }
    const shouldAdvance = current.ended
      || (Number.isFinite(duration) && remaining <= BACKGROUND_CROSSFADE_MS / 1000);
    if (!shouldAdvance) return;
    playBackgroundTrack(nextIndex, backgroundIndex);
  };

  const syncMusicMute = () => {
    if (disposed) return;
    backgroundGeneration += 1;
    if (channelMuted.music) {
      for (const audio of backgroundTracks) {
        activeFades.get(audio)?.cancel();
        audio.pause();
        if (!backgroundEnabled) releaseAudio(audio);
      }
      return;
    }
    if (!backgroundEnabled) return;
    if (!backgroundStarted) {
      playBackgroundTrack(backgroundIndex);
      return;
    }
    // Resume the selected track at its paused time, keeping only its prepared successor.
    const nextIndex = (backgroundIndex + 1) % backgroundTracks.length;
    backgroundTracks.forEach((audio, index) => {
      if (index !== backgroundIndex && index !== nextIndex) releaseAudio(audio);
    });
    playBackgroundTrack(backgroundIndex, undefined, true);
  };
  musicMuteListeners.add(syncMusicMute);

  const update = ({ view, selectedLandmark, experienceStarted, cameraLocked, cameraTransitioning, globeTransitioning }: MapAudioState) => {
    if (disposed) return;
    const playbackEnabled = experienceStarted && hasAudioActivation();
    if (playbackEnabled && isSanDiegoView(view)) prepareSanDiego();
    setBackgroundEnabled(playbackEnabled);
    updateBackgroundPlaylist();
    const nextMallEnabled = playbackEnabled && isSanDiegoView(view) && selectedLandmark === "torrey-highlands-plaza"
      && cameraLocked && !cameraTransitioning && !globeTransitioning;
    if (nextMallEnabled !== mallEnabled) {
      mallEnabled = nextMallEnabled;
      setLoop(mall, mallEnabled, CROWD_VOLUME, CROWD_FADE_MS);
    }
    const nextCrowdEnabled = playbackEnabled && (view === "washington" || view === "union" || (isSanDiegoView(view) && selectedLandmark !== "torrey-highlands-plaza"))
      && cameraLocked && !cameraTransitioning && !globeTransitioning;
    if (nextCrowdEnabled !== crowdEnabled) {
      crowdEnabled = nextCrowdEnabled;
      setLoop(crowd, crowdEnabled, CROWD_VOLUME, CROWD_FADE_MS);
    }

    const nextBirdsEnabled = playbackEnabled && isSanDiegoView(view) && !cameraLocked && !cameraTransitioning && !globeTransitioning;
    if (nextBirdsEnabled !== birdsEnabled) {
      birdsEnabled = nextBirdsEnabled;
      setLoop(birds, birdsEnabled, AMBIENCE_CLOSE_VOLUME, AMBIENCE_FADE_MS);
    }

    const nextAmbienceTarget = !playbackEnabled || globeTransitioning || view === "globe" || isSanDiegoView(view)
      ? 0
      : view === "manhattan" ? AMBIENCE_BASE_VOLUME : AMBIENCE_CLOSE_VOLUME;
    if (nextAmbienceTarget !== ambienceTarget) {
      ambienceTarget = nextAmbienceTarget;
      setLoop(ambience, ambienceTarget > 0, ambienceTarget, AMBIENCE_FADE_MS);
    }
  };

  const playGlobeTransition = () => {
    if (disposed || !hasAudioActivation()) return;
    const generation = ++zoomGeneration;
    cancelAnimationFrame(zoomWatcher);
    stopAndReset(zoom);
    prepareAudio(zoom);
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
    musicMuteListeners.delete(syncMusicMute);
    disposed = true;
    zoomGeneration += 1;
    backgroundGeneration += 1;
    cancelAnimationFrame(zoomWatcher);
    for (const audio of [crowd, mall, birds, ambience, zoom, ...backgroundTracks]) {
      loopGenerations.set(audio, (loopGenerations.get(audio) ?? 0) + 1);
      releaseAudio(audio);
      channelAudio[backgroundTracks.includes(audio) ? "music" : "effects"].delete(audio);
    }
  };

  return { dispose, playGlobeTransition, prepareSanDiego, update };
};
