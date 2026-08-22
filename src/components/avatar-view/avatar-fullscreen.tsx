"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const FULLSCREEN_CAMERA_CENTER = new THREE.Vector3(-0.38, 1.45, 0);
const FULLSCREEN_VIEW_HEIGHT = 0.86;
const VERTICAL_RENDER_OVERSCAN = 1.3;
const MAX_PIXEL_RATIO = 1.5;
const FRAME_INTERVAL_MS = 1000 / 30;
const FULLSCREEN_AVATAR_SCALE = 2.25;
const AVATAR_FRAME_CENTER_HEIGHT_RATIO = 0.83;
const AVATAR_HORIZONTAL_CAMERA_OFFSET_RATIO = 0.56 / FULLSCREEN_AVATAR_SCALE;

export type AvatarAnimationSource = {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer | null;
  update?: (elapsedSeconds: number, talking: boolean) => void;
  dispose?: () => void;
};

type AvatarFullscreenProps = {
  ariaLabel: string;
  loadAvatar: () => Promise<AvatarAnimationSource>;
  loadErrorMessage: string;
  onReady?: () => void;
  talking?: boolean;
};

export default function AvatarFullscreen({ ariaLabel, loadAvatar, loadErrorMessage, onReady, talking = false }: AvatarFullscreenProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const talkingRef = useRef(talking);

  useEffect(() => {
    talkingRef.current = talking;
  }, [talking]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
    camera.position.set(FULLSCREEN_CAMERA_CENTER.x, FULLSCREEN_CAMERA_CENTER.y, 4.8);
    camera.lookAt(FULLSCREEN_CAMERA_CENTER);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);
    const renderWidth = Math.max(host.clientWidth, 1);
    const renderHeight = Math.max(host.clientHeight, 1);
    const renderAspect = renderWidth / renderHeight;
    renderer.setSize(renderWidth, renderHeight, false);
    host.style.setProperty("--avatar-render-width", `${renderWidth}px`);
    host.style.setProperty("--avatar-render-height", `${renderHeight}px`);

    scene.add(new THREE.HemisphereLight(0xfffbf2, 0x46504e, 2.15));
    const key = new THREE.DirectionalLight(0xfff1dd, 3.1);
    key.position.set(-2.2, 3.5, 4.2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdce8e2, 1.35);
    fill.position.set(2.8, 2.2, 1.6);
    scene.add(fill);
    const cameraLight = new THREE.PointLight(0xffd28f, 3.2, 8, 1.35);
    cameraLight.position.copy(camera.position).add(new THREE.Vector3(0, 0, -1.2));
    scene.add(cameraLight);

    let mixer: THREE.AnimationMixer | null = null;
    let updateAnimation: AvatarAnimationSource["update"];
    let disposeAnimation: AvatarAnimationSource["dispose"];
    let disposed = false;
    let animationFrame = 0;
    let lastFrameTime = performance.now();
    let animationElapsedSeconds = 0;

    const overscannedViewHeight = FULLSCREEN_VIEW_HEIGHT * VERTICAL_RENDER_OVERSCAN;
    const viewWidth = overscannedViewHeight * renderAspect;
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = overscannedViewHeight / 2;
    camera.bottom = -overscannedViewHeight / 2;
    camera.updateProjectionMatrix();

    loadAvatar()
      .then(async ({ root, mixer: loadedMixer, update, dispose }) => {
        if (disposed) {
          loadedMixer?.stopAllAction();
          dispose?.();
          return;
        }

        mixer = loadedMixer;
        updateAnimation = update;
        disposeAnimation = dispose;
        scene.add(root);
        root.updateWorldMatrix(true, true);
        const avatarBounds = new THREE.Box3().setFromObject(root);
        const avatarSize = avatarBounds.getSize(new THREE.Vector3());
        const avatarCenter = avatarBounds.getCenter(new THREE.Vector3());
        const avatarHeight = Math.max(avatarSize.y, 0.001);
        const framedCenter = new THREE.Vector3(
          avatarCenter.x - avatarHeight * AVATAR_HORIZONTAL_CAMERA_OFFSET_RATIO,
          avatarBounds.min.y + avatarHeight * AVATAR_FRAME_CENTER_HEIGHT_RATIO,
          avatarCenter.z,
        );
        const framedViewHeight = Math.max(FULLSCREEN_VIEW_HEIGHT, avatarHeight * 1.12) / FULLSCREEN_AVATAR_SCALE;
        const framedOverscanHeight = framedViewHeight * VERTICAL_RENDER_OVERSCAN;
        const framedViewWidth = framedOverscanHeight * renderAspect;
        camera.position.set(framedCenter.x, framedCenter.y, avatarBounds.max.z + 4.8);
        camera.lookAt(framedCenter);
        camera.left = -framedViewWidth / 2;
        camera.right = framedViewWidth / 2;
        camera.top = framedOverscanHeight / 2;
        camera.bottom = -framedOverscanHeight / 2;
        camera.updateProjectionMatrix();
        cameraLight.position.copy(camera.position).add(new THREE.Vector3(0, 0, -1.2));
        root.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.frustumCulled = false;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if ("roughness" in material) material.roughness = 1.8;
            if (material instanceof THREE.MeshStandardMaterial) material.emissiveIntensity = 1.04;
            if (material instanceof THREE.MeshPhysicalMaterial) material.specularIntensity = 2.5;
          }
        });

        await renderer.compileAsync(scene, camera);
        if (disposed) return;
        renderer.render(scene, camera);
        host.dataset.ready = "true";
        onReady?.();
      })
      .catch((error: unknown) => {
        console.error(loadErrorMessage, error);
        host.dataset.error = "true";
      });

    const render = (time: number) => {
      animationFrame = requestAnimationFrame(render);
      const elapsed = time - lastFrameTime;
      if (elapsed < FRAME_INTERVAL_MS) return;
      lastFrameTime = time - (elapsed % FRAME_INTERVAL_MS);
      const elapsedSeconds = Math.min(elapsed / 1000, 0.1);
      animationElapsedSeconds += elapsedSeconds;
      mixer?.update(elapsedSeconds);
      updateAnimation?.(animationElapsedSeconds, talkingRef.current);
      renderer.render(scene, camera);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        return;
      }
      if (animationFrame !== 0) return;
      lastFrameTime = performance.now();
      animationFrame = requestAnimationFrame(render);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    animationFrame = requestAnimationFrame(render);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      mixer?.stopAllAction();
      disposeAnimation?.();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [loadAvatar, loadErrorMessage, onReady]);

  return <div ref={hostRef} className="avatar-call__avatar-view" aria-label={ariaLabel} />;
}
