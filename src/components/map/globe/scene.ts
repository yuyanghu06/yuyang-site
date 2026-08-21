import * as THREE from "three";

export const GLOBE_RADIUS = 360;
export const GLOBE_START_CAMERA_DISTANCE = 1920;
export const GLOBE_MAX_CAMERA_DISTANCE = GLOBE_START_CAMERA_DISTANCE;
export const MANHATTAN_LATITUDE = 40.7128;
export const MANHATTAN_LONGITUDE = -74.006;
// Axis calibration from the replacement GLB: the central U.S. sits around
// model longitude 135° (-95° W in WGS84). A small westward visual correction
// places the low-poly coastline's NYC destination at WGS84 + 224°.
export const IMPORTED_EARTH_NYC_LATITUDE = MANHATTAN_LATITUDE;
export const IMPORTED_EARTH_NYC_LONGITUDE = MANHATTAN_LONGITUDE + 224;

export function globePoint(latitude: number, longitude: number, radius: number) {
  const latitudeRadians = THREE.MathUtils.degToRad(latitude);
  const longitudeRadians = THREE.MathUtils.degToRad(longitude);
  return new THREE.Vector3(
    Math.cos(latitudeRadians) * Math.cos(longitudeRadians) * radius,
    Math.sin(latitudeRadians) * radius,
    -Math.cos(latitudeRadians) * Math.sin(longitudeRadians) * radius,
  );
}

export function globeTangentQuaternion(latitude: number, longitude: number) {
  const latitudeRadians = THREE.MathUtils.degToRad(latitude);
  const longitudeRadians = THREE.MathUtils.degToRad(longitude);
  const outward = globePoint(latitude, longitude, 1);
  const east = new THREE.Vector3(
    -Math.sin(longitudeRadians),
    0,
    -Math.cos(longitudeRadians),
  );
  const north = new THREE.Vector3(
    -Math.sin(latitudeRadians) * Math.cos(longitudeRadians),
    Math.cos(latitudeRadians),
    Math.sin(latitudeRadians) * Math.sin(longitudeRadians),
  );

  return new THREE.Quaternion()
    .setFromRotationMatrix(new THREE.Matrix4().makeBasis(east, north, outward));
}

export function northUpGlobeQuaternion(latitude: number, longitude: number) {
  // Invert the local east/north/outward frame so longitude stays horizontal,
  // latitude stays vertical, and the selected coordinate faces the camera.
  return globeTangentQuaternion(latitude, longitude).invert();
}

export function createWatercolorGlobe() {
  const group = new THREE.Group();
  group.name = "Imported low-poly globe with Manhattan destination";
  const placeholder = new THREE.Mesh(
    new THREE.IcosahedronGeometry(GLOBE_RADIUS, 4),
    new THREE.MeshStandardMaterial({
      color: 0x7894a0,
      roughness: 0.94,
      metalness: 0,
    }),
  );
  placeholder.name = "Powder blue globe loading placeholder";
  group.add(placeholder);

  const manhattanNormal = globePoint(IMPORTED_EARTH_NYC_LATITUDE, IMPORTED_EARTH_NYC_LONGITUDE, 1);
  group.quaternion.copy(
    northUpGlobeQuaternion(IMPORTED_EARTH_NYC_LATITUDE, IMPORTED_EARTH_NYC_LONGITUDE),
  );
  const marker = new THREE.Group();
  marker.name = "Manhattan globe destination";
  marker.position.copy(manhattanNormal).multiplyScalar(GLOBE_RADIUS + 4);
  marker.quaternion.copy(
    globeTangentQuaternion(IMPORTED_EARTH_NYC_LATITUDE, IMPORTED_EARTH_NYC_LONGITUDE),
  );
  const markerFill = new THREE.Mesh(
    new THREE.CircleGeometry(2.1, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }),
  );
  const leader = new THREE.Group();
  const leaderMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  const leaderLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(2, 0, 1),
      new THREE.Vector3(18, 14, 1),
      new THREE.Vector3(68, 14, 1),
    ]),
    leaderMaterial,
  );
  leader.add(leaderLine);
  leader.scale.setScalar(0.9);
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 512;
  labelCanvas.height = 96;
  const labelContext = labelCanvas.getContext("2d");
  if (!labelContext) throw new Error("Could not create the Manhattan label canvas");
  labelContext.font = "600 55px Helvetica Neue, Arial, sans-serif";
  labelContext.fillStyle = "#ffffff";
  labelContext.textBaseline = "middle";
  labelContext.fillText("New York City", 8, labelCanvas.height / 2);
  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  labelTexture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({
    map: labelTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  }));
  label.position.set(139, 14, 2);
  label.scale.set(136.5, 26, 1);
  const calloutHitMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    colorWrite: false,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const markerHitTarget = new THREE.Mesh(new THREE.CircleGeometry(13, 24), calloutHitMaterial);
  markerHitTarget.name = "NYC dot padded interaction target";
  markerHitTarget.position.z = 3;
  const leaderHitTarget = new THREE.Mesh(new THREE.PlaneGeometry(72, 16), calloutHitMaterial);
  leaderHitTarget.name = "NYC leader padded interaction target";
  leaderHitTarget.position.set(36, 8, 3);
  markerFill.renderOrder = 4;
  leader.renderOrder = 4;
  label.renderOrder = 4;
  marker.add(markerFill, leader, label, markerHitTarget, leaderHitTarget);
  group.add(marker);
  return { group, marker, leader, placeholder };
}

export function createStarField() {
  const group = new THREE.Group();
  let randomState = 0x91e10da5;
  const random = () => {
    randomState |= 0;
    randomState = randomState + 0x6d2b79f5 | 0;
    let value = Math.imul(randomState ^ randomState >>> 15, 1 | randomState);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
  const addLayer = (count: number, size: number, opacity: number) => {
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = THREE.MathUtils.lerp(-2100, 2100, random());
      positions[index * 3 + 1] = THREE.MathUtils.lerp(-1300, 1300, random());
      positions[index * 3 + 2] = THREE.MathUtils.lerp(-1050, -620, random());
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    group.add(new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size,
        sizeAttenuation: true,
        transparent: true,
        opacity,
        toneMapped: false,
      }),
    ));
  };
  addLayer(900, 7.5, 0.92);
  addLayer(180, 11.5, 1);
  group.name = "Apple Earth-inspired crisp white star field";
  return group;
}


