import * as THREE from "three";
import type { AvatarEmote } from "@/agent/types";

type EmoteSource = {
  clip: THREE.AnimationClip;
  movingBonePattern: RegExp;
  playbackRate?: number;
};

type EmoteSources = Partial<Record<AvatarEmote, EmoteSource>>;

const createPersistentSceneClip = (name: AvatarEmote, source: EmoteSource, idle: THREE.AnimationClip) => {
  const playbackRate = source.playbackRate ?? 1;
  const sourceTracks = new Map(source.clip.tracks.map((track) => [track.name, track]));
  const duration = source.clip.duration / playbackRate;
  const tracks = idle.tracks.map((idleTrack) => {
    const sourceTrack = sourceTracks.get(idleTrack.name);
    const keepsMotion = sourceTrack
      && sourceTrack.name.endsWith(".quaternion")
      && source.movingBonePattern.test(sourceTrack.name);
    if (keepsMotion) {
      const track = sourceTrack.clone();
      const valueSize = track.getValueSize();
      const idleValues = idleTrack.values.slice(0, valueSize);
      track.values.set(idleValues, 0);
      track.values.set(idleValues, track.values.length - valueSize);
      track.scale(1 / playbackRate);
      return track;
    }

    const track = idleTrack.clone();
    const valueSize = track.getValueSize();
    const idleValues = idleTrack.values.slice(0, valueSize);
    track.times = new Float32Array([0, duration]);
    track.values = new Float32Array(valueSize * 2);
    track.values.set(idleValues, 0);
    track.values.set(idleValues, valueSize);
    return track;
  });
  return new THREE.AnimationClip(`${name}_persistent_scene`, duration, tracks);
};

export function createAvatarEmotePlayer(
  mixer: THREE.AnimationMixer,
  idleClip: THREE.AnimationClip,
  sources: EmoteSources,
  onStateChange?: (emote: AvatarEmote | null) => void,
) {
  const idleAction = mixer.clipAction(idleClip);
  const actions = new Map<AvatarEmote, THREE.AnimationAction>();
  let activeAction: THREE.AnimationAction | null = null;
  let activeComplete: (() => void) | undefined;

  for (const [name, source] of Object.entries(sources) as [AvatarEmote, EmoteSource][]) {
    const action = mixer.clipAction(createPersistentSceneClip(name, source, idleClip));
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    actions.set(name, action);
  }

  const handleFinished = (event: { action: THREE.AnimationAction }) => {
    if (event.action !== activeAction) return;
    activeAction.stop();
    activeAction = null;
    idleAction.reset().play();
    onStateChange?.(null);
    const complete = activeComplete;
    activeComplete = undefined;
    complete?.();
  };
  mixer.addEventListener("finished", handleFinished);

  return {
    play(emote: AvatarEmote, onComplete?: () => void) {
      const action = actions.get(emote);
      if (!action) return false;
      if (activeAction) {
        activeAction.stop();
        const interruptedComplete = activeComplete;
        activeComplete = undefined;
        interruptedComplete?.();
      }
      idleAction.stop();
      activeAction = action;
      activeComplete = onComplete;
      onStateChange?.(emote);
      action.reset().play();
      mixer.timeScale = 1;
      return true;
    },
    dispose() {
      mixer.removeEventListener("finished", handleFinished);
      activeAction?.stop();
      onStateChange?.(null);
      actions.clear();
    },
  };
}
