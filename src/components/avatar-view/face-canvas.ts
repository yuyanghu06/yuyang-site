import * as THREE from "three";

export function createSmilingFaceTexture(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create the avatar face texture");
  context.filter = "saturate(145%) brightness(72%) contrast(122%)";
  context.drawImage(image, 0, 0, 512, 512, 0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function createFaceCanvas(texture: THREE.Texture) {
  const columns = 12;
  const rows = 16;
  const width = 0.205;
  const height = 0.255;
  // Blender authoring is Z-up; glTF/Three.js is Y-up. Convert the approved
  // Blender canvas coordinates as (x, y, z) -> (x, z, -y).
  const center = new THREE.Vector3(-0.004, 1.44, 0.166);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const normalizedX = (u - 0.5) * 2;
      positions.push(
        center.x + (u - 0.5) * width,
        center.y + (v - 0.5) * height,
        center.z - 0.025 * normalizedX * normalizedX,
      );
      uvs.push(u, v);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + 1;
      const d = (row + 1) * (columns + 1) + column;
      const c = d + 1;
      indices.push(a, d, b, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
}
