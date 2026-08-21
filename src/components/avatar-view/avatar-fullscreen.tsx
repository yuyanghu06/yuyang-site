"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createFaceCanvas, createSmilingFaceTexture } from "./face-canvas";

const FACE_ATLAS_URL = "/style-references/avatar/yuyang-avatar-face-talking-atlas.png";
const FULLSCREEN_CAMERA_CENTER = new THREE.Vector3(-0.38, 1.45, 0);
const FULLSCREEN_VIEW_HEIGHT = 0.86;
const VERTICAL_RENDER_OVERSCAN = 1.3;

export type AvatarAnimationSource = {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer | null;
};

type AvatarFullscreenProps = {
  ariaLabel: string;
  loadAvatar: () => Promise<AvatarAnimationSource>;
  loadErrorMessage: string;
};

export default function AvatarFullscreen({ ariaLabel, loadAvatar, loadErrorMessage }: AvatarFullscreenProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
    camera.position.set(FULLSCREEN_CAMERA_CENTER.x, FULLSCREEN_CAMERA_CENTER.y, 4.8);
    camera.lookAt(FULLSCREEN_CAMERA_CENTER);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

    let mixer: THREE.AnimationMixer | null = null;
    let faceTexture: THREE.Texture | null = null;
    let disposed = false;
    const clock = new THREE.Clock();
    let animationFrame = 0;

    const overscannedViewHeight = FULLSCREEN_VIEW_HEIGHT * VERTICAL_RENDER_OVERSCAN;
    const viewWidth = overscannedViewHeight * renderAspect;
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = overscannedViewHeight / 2;
    camera.bottom = -overscannedViewHeight / 2;
    camera.updateProjectionMatrix();

    loadAvatar()
      .then(({ root, mixer: loadedMixer }) => {
        if (disposed) {
          loadedMixer?.stopAllAction();
          return;
        }

        mixer = loadedMixer;
        scene.add(root);
        root.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.frustumCulled = false;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if ("roughness" in material) material.roughness = 0.72;
          }
        });

        host.dataset.ready = "true";

        new THREE.ImageLoader()
          .loadAsync(FACE_ATLAS_URL)
          .then((atlasImage) => {
            if (disposed) return;
            const head = root.getObjectByName("Head");
            if (!head) throw new Error("Avatar Head bone was not found");
            faceTexture = createSmilingFaceTexture(atlasImage);
            const face = createFaceCanvas(faceTexture);
            scene.add(face);
            head.attach(face);
            face.renderOrder = 3;
          })
          .catch((error: unknown) => {
            console.error("[AvatarCall] Could not load the avatar face", error);
            host.dataset.faceError = "true";
          });
      })
      .catch((error: unknown) => {
        console.error(loadErrorMessage, error);
        host.dataset.error = "true";
      });

    const render = () => {
      animationFrame = requestAnimationFrame(render);
      mixer?.update(Math.min(clock.getDelta(), 0.05));
      renderer.render(scene, camera);
    };
    render();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      mixer?.stopAllAction();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.dispose();
        }
      });
      faceTexture?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [loadAvatar, loadErrorMessage]);

  return <div ref={hostRef} className="avatar-call__avatar-view" aria-label={ariaLabel} />;
}
