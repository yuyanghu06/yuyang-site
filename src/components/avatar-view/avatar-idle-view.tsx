"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createFaceCanvas, createSmilingFaceTexture } from "./face-canvas";
import { createFixedBodyAnimationClip } from "./fixed-body-animation";

const IDLE_MODEL_URL = "/models/yuyang-avatar-idle-loop-v2.glb";
const FACE_ATLAS_URL = "/style-references/avatar/yuyang-avatar-face-talking-atlas.png";

export default function AvatarIdleView() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
    const cameraCenterY = 0.85;
    camera.position.set(0, cameraCenterY, 4.8);
    camera.lookAt(0, cameraCenterY, 0);

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

    const applyCamera = () => {
      const viewHeight = 1.92;
      const viewWidth = viewHeight * renderAspect;
      camera.left = -viewWidth / 2;
      camera.right = viewWidth / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
    };

    applyCamera();

    new GLTFLoader()
      .loadAsync(IDLE_MODEL_URL)
      .then((gltf) => {
        if (disposed) return;
        const avatarRoot = gltf.scene;
        scene.add(avatarRoot);
        avatarRoot.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.frustumCulled = false;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if ("roughness" in material) material.roughness = 0.72;
          }
        });

        if (gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(avatarRoot);
          mixer.clipAction(createFixedBodyAnimationClip(gltf.animations[0])).play();
          mixer.update(0);
        }

        host.dataset.ready = "true";

        new THREE.ImageLoader()
          .loadAsync(FACE_ATLAS_URL)
          .then((atlasImage) => {
            if (disposed) return;
            const head = avatarRoot.getObjectByName("Head");
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
        console.error("[AvatarCall] Could not load idle avatar", error);
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
  }, []);

  return <div ref={hostRef} className="avatar-call__avatar-view" aria-label="Smiling Yuyang avatar idling" />;
}
