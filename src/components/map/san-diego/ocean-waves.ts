import * as THREE from "three";

/** Tiny ocean-only crests, batched in one draw and animated on the GPU. */
export function createTorreyPinesWaves(group: THREE.Group) {
  let ocean: THREE.Mesh | undefined;
  group.traverse((object) => {
    if (object instanceof THREE.Mesh && object.name === "Pacific_Ocean") ocean = object;
  });
  if (!ocean) throw new Error("Torrey Pines waves require the mapped Pacific Ocean surface.");
  ocean.updateWorldMatrix(true, false);
  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
  const waterHeight = (x: number, z: number) => {
    ray.ray.origin.set(x, 1000, z);
    return ray.intersectObject(ocean!, false)[0]?.point.y;
  };
  const anchors: { x: number; y: number; z: number; length: number }[] = [];
  for (let z = 2250; z < 7000; z += 180) {
    for (let x = -12600; x < -10100; x += 190) {
      const random = Math.sin(x * 0.031 + z * 0.017) * 43758.5453;
      const unit = random - Math.floor(random);
      if (unit < 0.52) continue;
      const px = x + unit * 70, pz = z + unit * 50;
      const y = waterHeight(px, pz);
      // The entire moving crest stays on ocean, including its shorelineward drift.
      if (y === undefined || [[-12, -22], [-12, 22], [12, -22], [12, 22]]
        .some(([dx, dz]) => waterHeight(px + dx, pz + dz) === undefined)) continue;
      anchors.push({ x: px, y: y + 0.12, z: pz, length: 28 + unit * 14 });
    }
  }
  const crests = anchors.length <= 96 ? anchors
    : Array.from({ length: 96 }, (_, index) => anchors[Math.floor((index + 0.5) * anchors.length / 96)]);
  const vertices: number[] = [];
  const edge = (x: number, side: number) => [x, 0, (1 - 4 * x * x) * 0.65 + side * 0.5];
  for (let index = 0; index < 8; index++) {
    const a = index / 8 - 0.5, b = (index + 1) / 8 - 0.5;
    vertices.push(...edge(a, -1), ...edge(b, -1), ...edge(b, 1), ...edge(a, -1), ...edge(b, 1), ...edge(a, 1));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, color: { value: new THREE.Color(0xe7eee5) } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float time;
      varying float opacity;
      void main() {
        float phase = fract(time / 18.0 + fract(instanceMatrix[3].x * 0.029 + instanceMatrix[3].z * 0.053));
        opacity = sin(phase * 3.14159265) * 0.42;
        vec4 crest = instanceMatrix * vec4(position, 1.0);
        crest.x += phase * 6.0;
        gl_Position = projectionMatrix * modelViewMatrix * crest;
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      varying float opacity;
      void main() {
        gl_FragColor = vec4(color, opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, crests.length);
  const transform = new THREE.Object3D();
  crests.forEach((anchor, index) => {
    transform.position.set(anchor.x, anchor.y, anchor.z);
    transform.rotation.y = Math.PI / 2;
    transform.scale.set(anchor.length, 1, 2.2);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
  });
  mesh.name = "Torrey Pines ocean wave crests";
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  if (mesh.boundingSphere) mesh.boundingSphere.radius += 8;
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  mesh.raycast = () => undefined;
  group.add(mesh);
  return {
    mesh,
    update: (elapsed: number, visible: boolean) => {
      mesh.visible = visible;
      if (visible) material.uniforms.time.value = elapsed;
    },
  };
}
