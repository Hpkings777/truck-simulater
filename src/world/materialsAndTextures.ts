import * as THREE from 'three';
import { createInitialTruckState, TruckPhysicsState } from '../physics/vehiclePhysics';
import { TrafficVehicle } from '../physics/trafficSimulation';
import { getRoadPointAtDistance, HIGHWAY_LENGTH_M } from '../physics/highwaySpline';

export interface HighwayTextureSet {
  asphaltMap: THREE.CanvasTexture;
  asphaltNormalMap: THREE.CanvasTexture;
  asphaltRoughnessMap: THREE.CanvasTexture;
  concreteMap: THREE.CanvasTexture;
  concreteNormalMap: THREE.CanvasTexture;
  hazardConcreteMap: THREE.CanvasTexture;
  guardrailMap: THREE.CanvasTexture;
  guardrailNormalMap: THREE.CanvasTexture;
  terrainMap: THREE.CanvasTexture;
  terrainNormalMap: THREE.CanvasTexture;
  containerSideMap: THREE.CanvasTexture;
  containerRearMap: THREE.CanvasTexture;
  containerNormalMap: THREE.CanvasTexture;
  lorryTailgateMap: THREE.CanvasTexture;
  leatherNormalMap: THREE.CanvasTexture;
  tireTreadNormalMap: THREE.CanvasTexture;
  barkMap: THREE.CanvasTexture;
  cloudLayerMap: THREE.CanvasTexture;
  dashboardClusterMap: THREE.CanvasTexture;
  gpsNavMap: THREE.CanvasTexture;
  isUltra4KUpgraded: boolean;
  upgradeToUltra4K: (maxAnisotropy: number) => void;
  updateCabinDisplays: (
    state: TruckPhysicsState,
    traffic: TrafficVehicle[],
    isCabinActive?: boolean
  ) => void;
  createGantrySignTexture: (
    titleEn: string,
    titleHi: string,
    subLeft: string,
    subRight: string,
    routeBadge: string
  ) => THREE.CanvasTexture;
  createMilestoneTexture: (cityName: string, kmLeft: number) => THREE.CanvasTexture;
}

/**
 * Injects a custom GLSL procedural micro-aggregate & anisotropic road-sheen shader
 * into the highway asphalt MeshStandardMaterial so close-up asphalt has infinite detail.
 */
export function applyUltraMicroShaderToAsphalt(material: THREE.MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       varying vec3 vWorldPosMicro;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
       vWorldPosMicro = (modelMatrix * vec4(transformed, 1.0)).xyz;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       varying vec3 vWorldPosMicro;
       float hash12Micro(vec2 p) {
         vec3 p3 = fract(vec3(p.xyx) * 0.1031);
         p3 += dot(p3, p3.yzx + 33.33);
         return fract((p3.x + p3.y) * p3.z);
       }`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
       float microStone = hash12Micro(floor(vWorldPosMicro.xz * 38.0));
       float macroPatch = sin(vWorldPosMicro.z * 0.09 + vWorldPosMicro.x * 0.25) * 0.5 + 0.5;
       roughnessFactor = clamp(roughnessFactor + (microStone - 0.5) * 0.12 - macroPatch * 0.05, 0.22, 0.95);
       diffuseColor.rgb *= (0.94 + microStone * 0.12);`
    );
  };
  material.needsUpdate = true;
}

/**
 * Injects a custom GLSL metallic flake & clearcoat depth shader into the truck's body paint.
 */
export function applyUltraFlakeShaderToPaint(material: THREE.MeshPhysicalMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       varying vec3 vLocalPosFlake;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vLocalPosFlake = position;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       varying vec3 vLocalPosFlake;
       float flakeHash(vec3 p) {
         p = fract(p * 0.3183099 + 0.1);
         p *= 17.0;
         return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
       }`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
       float flake = flakeHash(floor(vLocalPosFlake * 95.0));
       roughnessFactor = clamp(roughnessFactor - flake * 0.06, 0.08, 0.45);
       diffuseColor.rgb += vec3(flake * 0.045, flake * 0.02, 0.0);`
    );
  };
  material.needsUpdate = true;
}

/**
 * Converts a grayscale heightmap canvas into a tangent-space RGB normal map texture.
 */
function createNormalMapFromHeightCanvas(
  heightCanvas: HTMLCanvasElement,
  strength = 2.6,
  maxAnisotropy = 8
): THREE.CanvasTexture {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, w, h).data;

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = w;
  normalCanvas.height = h;
  const dstCtx = normalCanvas.getContext('2d')!;
  const dstImg = dstCtx.createImageData(w, h);
  const dstData = dstImg.data;

  const sampleHeight = (x: number, y: number): number => {
    const wx = (x + w) % w;
    const wy = (y + h) % h;
    return srcData[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hL = sampleHeight(x - 1, y);
      const hR = sampleHeight(x + 1, y);
      const hU = sampleHeight(x, y - 1);
      const hD = sampleHeight(x, y + 1);

      const dx = (hL - hR) * strength;
      const dy = (hU - hD) * strength;
      const dz = 1.0;
      const invLen = 1.0 / Math.sqrt(dx * dx + dy * dy + dz * dz);

      const idx = (y * w + x) * 4;
      dstData[idx] = Math.round((dx * invLen * 0.5 + 0.5) * 255);
      dstData[idx + 1] = Math.round((dy * invLen * 0.5 + 0.5) * 255);
      dstData[idx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
      dstData[idx + 3] = 255;
    }
  }

  dstCtx.putImageData(dstImg, 0, 0);
  const tex = new THREE.CanvasTexture(normalCanvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Draws the 4-lane divided NH-44 asphalt texture onto the target canvas at any resolution (1024 or 2048/4096 UHD).
 */
function paintAsphaltCanvas(canvas: HTMLCanvasElement, grainSamples: number): void {
  const S = canvas.width;
  const scale = S / 1024;
  const actx = canvas.getContext('2d')!;

  actx.fillStyle = '#1f2226';
  actx.fillRect(0, 0, S, S);

  // Shoulders dusty brown-grey aggregate
  const leftShoulderGrad = actx.createLinearGradient(0, 0, 118 * scale, 0);
  leftShoulderGrad.addColorStop(0, '#443c32');
  leftShoulderGrad.addColorStop(0.75, '#332f2a');
  leftShoulderGrad.addColorStop(1, '#222428');
  actx.fillStyle = leftShoulderGrad;
  actx.fillRect(0, 0, 118 * scale, S);

  const rightShoulderGrad = actx.createLinearGradient(906 * scale, 0, S, 0);
  rightShoulderGrad.addColorStop(0, '#222428');
  rightShoulderGrad.addColorStop(0.25, '#332f2a');
  rightShoulderGrad.addColorStop(1, '#443c32');
  actx.fillStyle = rightShoulderGrad;
  actx.fillRect(906 * scale, 0, 118 * scale, S);

  // Central median edge dust & ambient occlusion strips
  const medGrad = actx.createLinearGradient(418 * scale, 0, 606 * scale, 0);
  medGrad.addColorStop(0, 'rgba(28, 25, 22, 0)');
  medGrad.addColorStop(0.12, 'rgba(68, 58, 45, 0.55)');
  medGrad.addColorStop(0.5, 'rgba(18, 16, 15, 0.85)');
  medGrad.addColorStop(0.88, 'rgba(68, 58, 45, 0.55)');
  medGrad.addColorStop(1, 'rgba(28, 25, 22, 0)');
  actx.fillStyle = medGrad;
  actx.fillRect(418 * scale, 0, 188 * scale, S);

  // Polished wheel wear tracks in all 4 lanes
  const laneCentersU = [0.188, 0.342, 0.658, 0.812];
  for (const u of laneCentersU) {
    const cx = u * S;
    const hw = 64 * scale;
    const grad = actx.createLinearGradient(cx - hw, 0, cx + hw, 0);
    grad.addColorStop(0, 'rgba(12, 14, 17, 0)');
    grad.addColorStop(0.24, 'rgba(10, 12, 15, 0.54)');
    grad.addColorStop(0.5, 'rgba(28, 31, 36, 0.16)');
    grad.addColorStop(0.76, 'rgba(10, 12, 15, 0.54)');
    grad.addColorStop(1, 'rgba(12, 14, 17, 0)');
    actx.fillStyle = grad;
    actx.fillRect(cx - hw, 0, hw * 2, S);
  }

  // Dense multi-scale stone aggregate & weathered bitumen patches
  for (let i = 0; i < grainSamples; i++) {
    const rx = (i * 7919) % S;
    const ry = (i * 6271) % S;
    const shade = 24 + ((i * 37) % 34);
    actx.fillStyle = `rgb(${shade}, ${shade + 1}, ${shade + 3})`;
    actx.fillRect(rx, ry, i % 3 === 0 ? 3 : 2, 2);
  }

  // Bitumen overband crack sealing snakes & repair patches
  actx.fillStyle = 'rgba(14, 16, 19, 0.68)';
  actx.fillRect(158 * scale, 180 * scale, 54 * scale, 195 * scale);
  actx.fillRect(318 * scale, 640 * scale, 66 * scale, 145 * scale);
  actx.fillRect(675 * scale, 380 * scale, 56 * scale, 165 * scale);

  // Longitudinal tar crack lines
  actx.strokeStyle = 'rgba(10, 11, 13, 0.82)';
  actx.lineWidth = 2.5 * scale;
  for (const crackX of [212, 365, 695, 835]) {
    actx.beginPath();
    actx.moveTo(crackX * scale, 0);
    for (let y = 64; y <= 1024; y += 64) {
      actx.lineTo((crackX + Math.sin(y * 0.04 + crackX) * 8) * scale, y * scale);
    }
    actx.stroke();
  }

  // Outer solid white shoulder edge markings
  actx.fillStyle = '#f1f5f9';
  actx.fillRect(110 * scale, 0, 10 * scale, S);
  actx.fillRect(904 * scale, 0, 10 * scale, S);

  // Inner yellow median edge markings
  actx.fillStyle = '#facc15';
  actx.fillRect(422 * scale, 0, 10 * scale, S);
  actx.fillRect(592 * scale, 0, 10 * scale, S);

  // Dashed white lane dividers (between L1 & L2 on both carriageways)
  actx.fillStyle = '#f8fafc';
  const leftDividerX = Math.round(0.265 * S) - 5 * scale;
  const rightDividerX = Math.round(0.735 * S) - 5 * scale;
  for (let y = 20; y < 1024; y += 128) {
    actx.fillRect(leftDividerX, y * scale, 10 * scale, 62 * scale);
    actx.fillRect(rightDividerX, y * scale, 10 * scale, 62 * scale);
  }

  // Rumble strips on outer shoulders
  actx.fillStyle = 'rgba(226, 232, 240, 0.44)';
  for (let y = 0; y < 1024; y += 24) {
    actx.fillRect(86 * scale, y * scale, 18 * scale, 10 * scale);
    actx.fillRect(920 * scale, y * scale, 18 * scale, 10 * scale);
  }
}

/**
 * Draws the 40ft Bharat Freight Corridor shipping container side livery at any resolution (1024 or 2048 UHD).
 */
function paintContainerSideCanvas(canvas: HTMLCanvasElement): void {
  const W = canvas.width;
  const H = canvas.height;
  const sx = W / 1024;
  const sy = H / 512;
  const kctx = canvas.getContext('2d')!;

  kctx.fillStyle = '#173152';
  kctx.fillRect(0, 0, W, H);

  for (let x = 0; x < 1024; x += 16) {
    kctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    kctx.fillRect(x * sx, 26 * sy, 6 * sx, 460 * sy);
    kctx.fillStyle = 'rgba(255, 255, 255, 0.11)';
    kctx.fillRect((x + 6) * sx, 26 * sy, 4 * sx, 460 * sy);
  }

  kctx.fillStyle = '#0c1d33';
  kctx.fillRect(0, 0, W, 32 * sy);
  kctx.fillRect(0, 480 * sy, W, 32 * sy);
  kctx.fillRect(0, 0, 28 * sx, H);
  kctx.fillRect(996 * sx, 0, 28 * sx, H);

  kctx.fillStyle = '#f59e0b';
  kctx.fillRect(60 * sx, 148 * sy, 904 * sx, 14 * sy);
  kctx.fillRect(60 * sx, 346 * sy, 904 * sx, 8 * sy);

  kctx.fillStyle = '#f8fafc';
  kctx.font = `700 ${Math.round(54 * sx)}px "Chakra Petch", sans-serif`;
  kctx.fillText('BHARAT FREIGHT CORRIDOR', 84 * sx, 232 * sy);
  kctx.fillStyle = '#fbbf24';
  kctx.font = `600 ${Math.round(28 * sx)}px "Plus Jakarta Sans", sans-serif`;
  kctx.fillText(
    'NH-44 GRAND TRUNK EXPRESS · HEAVY HAUL LOGISTICS · IN-HR-44',
    88 * sx,
    284 * sy
  );

  kctx.fillStyle = '#e2e8f0';
  kctx.font = `600 ${Math.round(22 * sx)}px "JetBrains Mono", monospace`;
  kctx.fillText('BFCL 449280-7', 775 * sx, 92 * sy);
  kctx.fillText('45G1 · MAX GROSS 32,500 KG', 682 * sx, 122 * sy);

  for (let x = 32; x < 992; x += 48) {
    kctx.fillStyle = x % 96 === 32 ? '#ef4444' : '#f8fafc';
    kctx.fillRect(x * sx, 488 * sy, 36 * sx, 12 * sy);
  }
}

export function createHighwayTextureSet(maxAnisotropy = 8): HighwayTextureSet {
  // ============================================================================
  // 1. 4-Lane Divided Highway Asphalt Albedo + Normal Map + Specular Roughness Map
  // ============================================================================
  const asphaltCanvas = document.createElement('canvas');
  asphaltCanvas.width = 1024;
  asphaltCanvas.height = 1024;
  paintAsphaltCanvas(asphaltCanvas, 26000);

  const asphaltHeightCanvas = document.createElement('canvas');
  asphaltHeightCanvas.width = 512;
  asphaltHeightCanvas.height = 512;
  const ahctx = asphaltHeightCanvas.getContext('2d')!;

  const asphaltRoughCanvas = document.createElement('canvas');
  asphaltRoughCanvas.width = 512;
  asphaltRoughCanvas.height = 512;
  const arctx = asphaltRoughCanvas.getContext('2d')!;

  arctx.fillStyle = 'rgb(212, 212, 212)';
  arctx.fillRect(0, 0, 512, 512);
  arctx.fillStyle = 'rgb(242, 242, 242)';
  arctx.fillRect(0, 0, 58, 512);
  arctx.fillRect(454, 0, 58, 512);

  const laneCentersU = [0.188, 0.342, 0.658, 0.812];
  for (const u of laneCentersU) {
    const rcx = u * 512;
    const rGrad = arctx.createLinearGradient(rcx - 32, 0, rcx + 32, 0);
    rGrad.addColorStop(0, 'rgba(210, 210, 210, 0)');
    rGrad.addColorStop(0.25, 'rgba(88, 88, 88, 0.88)');
    rGrad.addColorStop(0.5, 'rgba(175, 175, 175, 0.4)');
    rGrad.addColorStop(0.75, 'rgba(88, 88, 88, 0.88)');
    rGrad.addColorStop(1, 'rgba(210, 210, 210, 0)');
    arctx.fillStyle = rGrad;
    arctx.fillRect(rcx - 32, 0, 64, 512);
  }
  arctx.fillStyle = 'rgb(75, 75, 75)';
  arctx.fillRect(79, 90, 27, 97);
  arctx.fillRect(159, 320, 33, 72);

  ahctx.fillStyle = '#808080';
  ahctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 24000; i++) {
    const rx = (i * 4999) % 512;
    const ry = (i * 3571) % 512;
    const v = 74 + ((i * 53) % 108);
    ahctx.fillStyle = `rgb(${v},${v},${v})`;
    ahctx.fillRect(rx, ry, 2, 2);
  }
  ahctx.fillStyle = '#252525';
  for (let y = 0; y < 512; y += 12) {
    ahctx.fillRect(44, y, 8, 5);
    ahctx.fillRect(460, y, 8, 5);
  }

  const asphaltMap = new THREE.CanvasTexture(asphaltCanvas);
  asphaltMap.colorSpace = THREE.SRGBColorSpace;
  asphaltMap.wrapS = THREE.ClampToEdgeWrapping;
  asphaltMap.wrapT = THREE.RepeatWrapping;
  asphaltMap.anisotropy = maxAnisotropy;

  const asphaltNormalMap = createNormalMapFromHeightCanvas(asphaltHeightCanvas, 3.1, maxAnisotropy);
  asphaltNormalMap.repeat.set(4, 1);

  const asphaltRoughnessMap = new THREE.CanvasTexture(asphaltRoughCanvas);
  asphaltRoughnessMap.colorSpace = THREE.NoColorSpace;
  asphaltRoughnessMap.wrapS = THREE.ClampToEdgeWrapping;
  asphaltRoughnessMap.wrapT = THREE.RepeatWrapping;
  asphaltRoughnessMap.anisotropy = maxAnisotropy;

  // ============================================================================
  // 2. Precast Formwork Concrete Albedo + Normal Map
  // ============================================================================
  const concCanvas = document.createElement('canvas');
  concCanvas.width = 512;
  concCanvas.height = 512;
  const cctx = concCanvas.getContext('2d')!;
  cctx.fillStyle = '#827e77';
  cctx.fillRect(0, 0, 512, 512);

  const concGrad = cctx.createLinearGradient(0, 0, 0, 512);
  concGrad.addColorStop(0, 'rgba(30, 28, 25, 0.28)');
  concGrad.addColorStop(0.25, 'rgba(255, 255, 255, 0.05)');
  concGrad.addColorStop(0.8, 'rgba(40, 35, 28, 0.18)');
  concGrad.addColorStop(1, 'rgba(28, 24, 18, 0.62)');
  cctx.fillStyle = concGrad;
  cctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 6500; i++) {
    const x = (i * 1999) % 512;
    const y = (i * 2903) % 512;
    const v = 96 + ((i * 23) % 42);
    cctx.fillStyle = `rgb(${v}, ${v - 2}, ${v - 5})`;
    cctx.fillRect(x, y, 3, 3);
  }
  cctx.strokeStyle = 'rgba(32, 30, 27, 0.48)';
  cctx.lineWidth = 3;
  cctx.strokeRect(4, 4, 504, 248);
  cctx.strokeRect(4, 256, 504, 252);
  cctx.fillStyle = '#272522';
  for (const hx of [64, 256, 448]) {
    for (const hy of [64, 192, 320, 448]) {
      cctx.beginPath();
      cctx.arc(hx, hy, 5, 0, Math.PI * 2);
      cctx.fill();
    }
  }

  const concreteMap = new THREE.CanvasTexture(concCanvas);
  concreteMap.colorSpace = THREE.SRGBColorSpace;
  concreteMap.wrapS = THREE.RepeatWrapping;
  concreteMap.wrapT = THREE.RepeatWrapping;
  concreteMap.anisotropy = maxAnisotropy;
  const concreteNormalMap = createNormalMapFromHeightCanvas(concCanvas, 2.2, maxAnisotropy);

  // ============================================================================
  // 3. Indian Highway Black & Yellow Hazard Striped Concrete Curb Texture
  // ============================================================================
  const hazCanvas = document.createElement('canvas');
  hazCanvas.width = 512;
  hazCanvas.height = 128;
  const hctx = hazCanvas.getContext('2d')!;
  hctx.fillStyle = '#eab308';
  hctx.fillRect(0, 0, 512, 128);
  hctx.fillStyle = '#18181b';
  for (let x = -128; x < 640; x += 96) {
    hctx.beginPath();
    hctx.moveTo(x, 0);
    hctx.lineTo(x + 48, 0);
    hctx.lineTo(x + 16, 128);
    hctx.lineTo(x - 32, 128);
    hctx.closePath();
    hctx.fill();
  }
  const hazDirt = hctx.createLinearGradient(0, 75, 0, 128);
  hazDirt.addColorStop(0, 'rgba(24, 22, 18, 0)');
  hazDirt.addColorStop(1, 'rgba(24, 22, 18, 0.58)');
  hctx.fillStyle = hazDirt;
  hctx.fillRect(0, 75, 512, 53);

  const hazardConcreteMap = new THREE.CanvasTexture(hazCanvas);
  hazardConcreteMap.colorSpace = THREE.SRGBColorSpace;
  hazardConcreteMap.wrapS = THREE.RepeatWrapping;
  hazardConcreteMap.wrapT = THREE.ClampToEdgeWrapping;
  hazardConcreteMap.anisotropy = maxAnisotropy;

  // ============================================================================
  // 4. Galvanized Steel W-Beam Guardrail Albedo + Normal Map
  // ============================================================================
  const grCanvas = document.createElement('canvas');
  grCanvas.width = 256;
  grCanvas.height = 128;
  const gctx = grCanvas.getContext('2d')!;
  const grGrad = gctx.createLinearGradient(0, 0, 0, 128);
  grGrad.addColorStop(0, '#94a3b8');
  grGrad.addColorStop(0.22, '#e2e8f0');
  grGrad.addColorStop(0.5, '#475569');
  grGrad.addColorStop(0.78, '#e2e8f0');
  grGrad.addColorStop(1, '#64748b');
  gctx.fillStyle = grGrad;
  gctx.fillRect(0, 0, 256, 128);

  gctx.fillStyle = '#334155';
  for (let x = 16; x < 256; x += 64) {
    gctx.fillRect(x, 12, 4, 104);
    gctx.beginPath();
    gctx.arc(x + 10, 64, 5, 0, Math.PI * 2);
    gctx.fill();
  }
  gctx.fillStyle = '#ef4444';
  gctx.fillRect(118, 52, 20, 24);
  gctx.fillStyle = '#f8fafc';
  gctx.fillRect(138, 52, 10, 24);

  const guardrailMap = new THREE.CanvasTexture(grCanvas);
  guardrailMap.colorSpace = THREE.SRGBColorSpace;
  guardrailMap.wrapS = THREE.RepeatWrapping;
  guardrailMap.wrapT = THREE.ClampToEdgeWrapping;
  guardrailMap.anisotropy = maxAnisotropy;
  const guardrailNormalMap = createNormalMapFromHeightCanvas(grCanvas, 3.0, maxAnisotropy);

  // ============================================================================
  // 5. North Indian Alluvial Soil + Mustard/Wheat Field Patchwork + Normal Map
  // ============================================================================
  const terCanvas = document.createElement('canvas');
  terCanvas.width = 1024;
  terCanvas.height = 1024;
  const tctx = terCanvas.getContext('2d')!;
  tctx.fillStyle = '#4a432f';
  tctx.fillRect(0, 0, 1024, 1024);

  const fieldColors = [
    '#3d5220',
    '#5e582c',
    '#6b572b',
    '#2f4419',
    '#7a6424',
    '#475927',
    '#574829',
    '#384c1e',
  ];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 4; col++) {
      const fx = col * 256;
      const fy = row * 128;
      tctx.fillStyle = fieldColors[(row * 3 + col) % fieldColors.length];
      tctx.fillRect(fx + 4, fy + 4, 248, 120);

      tctx.fillStyle = 'rgba(22, 20, 13, 0.26)';
      const horizontal = (row + col) % 2 === 0;
      if (horizontal) {
        for (let f = 8; f < 120; f += 8) {
          tctx.fillRect(fx + 6, fy + f, 244, 3);
        }
      } else {
        for (let f = 8; f < 248; f += 8) {
          tctx.fillRect(fx + f, fy + 6, 3, 116);
        }
      }
      tctx.strokeStyle = '#3b3222';
      tctx.lineWidth = 6;
      tctx.strokeRect(fx + 2, fy + 2, 252, 124);
    }
  }
  for (let i = 0; i < 16000; i++) {
    const rx = (i * 3917) % 1024;
    const ry = (i * 2851) % 1024;
    tctx.fillStyle =
      i % 3 === 0
        ? 'rgba(198, 168, 72, 0.18)'
        : i % 3 === 1
          ? 'rgba(32, 44, 16, 0.22)'
          : 'rgba(92, 74, 46, 0.18)';
    tctx.fillRect(rx, ry, 4, 4);
  }

  const terrainMap = new THREE.CanvasTexture(terCanvas);
  terrainMap.colorSpace = THREE.SRGBColorSpace;
  terrainMap.wrapS = THREE.RepeatWrapping;
  terrainMap.wrapT = THREE.RepeatWrapping;
  terrainMap.repeat.set(28, 28);
  terrainMap.anisotropy = maxAnisotropy;

  const terrainNormalMap = createNormalMapFromHeightCanvas(terCanvas, 2.4, maxAnisotropy);
  terrainNormalMap.repeat.set(28, 28);

  // ============================================================================
  // 6. 40ft Shipping Container Livery (Side + Rear Doors + Corrugation Normal Map)
  // ============================================================================
  const contCanvas = document.createElement('canvas');
  contCanvas.width = 1024;
  contCanvas.height = 512;
  paintContainerSideCanvas(contCanvas);

  const containerSideMap = new THREE.CanvasTexture(contCanvas);
  containerSideMap.colorSpace = THREE.SRGBColorSpace;
  containerSideMap.anisotropy = maxAnisotropy;

  const contRearCanvas = document.createElement('canvas');
  contRearCanvas.width = 512;
  contRearCanvas.height = 512;
  const crctx = contRearCanvas.getContext('2d')!;
  crctx.fillStyle = '#152c4a';
  crctx.fillRect(0, 0, 512, 512);
  for (let x = 24; x < 488; x += 24) {
    crctx.fillStyle = 'rgba(0,0,0,0.22)';
    crctx.fillRect(x, 28, 10, 456);
  }
  crctx.fillStyle = '#090d14';
  crctx.fillRect(252, 20, 8, 472);
  crctx.strokeStyle = '#090d14';
  crctx.lineWidth = 10;
  crctx.strokeRect(18, 20, 476, 472);
  crctx.fillStyle = '#facc15';
  crctx.fillRect(36, 390, 184, 54);
  crctx.fillRect(292, 390, 184, 54);
  crctx.fillStyle = '#dc2626';
  crctx.fillRect(42, 396, 82, 42);
  crctx.fillRect(388, 396, 82, 42);
  crctx.textAlign = 'center';
  crctx.fillStyle = '#fbbf24';
  crctx.font = '700 20px "Chakra Petch", sans-serif';
  crctx.fillText('SPEED LIMIT 60 KM/H', 132, 92);
  crctx.fillStyle = '#e2e8f0';
  crctx.font = '700 17px "JetBrains Mono", monospace';
  crctx.fillText('KEEP 15M DISTANCE', 132, 124);

  crctx.fillStyle = '#f8fafc';
  crctx.font = '700 20px "JetBrains Mono", monospace';
  crctx.fillText('BFCL 449280-7', 380, 92);
  crctx.fillStyle = '#94a3b8';
  crctx.font = '700 16px "JetBrains Mono", monospace';
  crctx.fillText('45G1 · 32,500 KG', 380, 124);

  const containerRearMap = new THREE.CanvasTexture(contRearCanvas);
  containerRearMap.colorSpace = THREE.SRGBColorSpace;
  containerRearMap.anisotropy = maxAnisotropy;

  const contHeightCanvas = document.createElement('canvas');
  contHeightCanvas.width = 512;
  contHeightCanvas.height = 256;
  const chctx = contHeightCanvas.getContext('2d')!;
  chctx.fillStyle = '#808080';
  chctx.fillRect(0, 0, 512, 256);
  for (let x = 0; x < 512; x += 8) {
    chctx.fillStyle = '#e0e0e0';
    chctx.fillRect(x, 14, 4, 228);
    chctx.fillStyle = '#282828';
    chctx.fillRect(x + 4, 14, 4, 228);
  }
  const containerNormalMap = createNormalMapFromHeightCanvas(contHeightCanvas, 3.2, maxAnisotropy);

  // ============================================================================
  // 7. Indian Goods Lorry "HORN OK PLEASE" Hand-Painted Tailgate Texture
  // ============================================================================
  const lorryCanvas = document.createElement('canvas');
  lorryCanvas.width = 512;
  lorryCanvas.height = 512;
  const lctx = lorryCanvas.getContext('2d')!;
  lctx.fillStyle = '#92400e';
  lctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 42) {
    lctx.fillStyle = 'rgba(24, 16, 8, 0.35)';
    lctx.fillRect(16, y, 480, 6);
  }
  lctx.fillStyle = '#facc15';
  lctx.fillRect(36, 48, 440, 120);
  lctx.strokeStyle = '#dc2626';
  lctx.lineWidth = 8;
  lctx.strokeRect(42, 54, 428, 108);
  lctx.fillStyle = '#18181b';
  lctx.textAlign = 'center';
  lctx.font = '700 44px "Chakra Petch", sans-serif';
  lctx.fillText('HORN  OK  PLEASE', 256, 122);
  lctx.fillStyle = '#10b981';
  lctx.fillRect(198, 70, 116, 68);
  lctx.fillStyle = '#ffffff';
  lctx.fillText('OK', 256, 120);
  lctx.fillStyle = '#fef08a';
  lctx.font = '700 32px "Plus Jakarta Sans", sans-serif';
  lctx.fillText('ALL INDIA PERMIT · NH-44', 256, 260);
  lctx.fillStyle = '#ef4444';
  lctx.fillRect(36, 420, 440, 38);
  lctx.fillStyle = '#ffffff';
  lctx.font = '700 24px "JetBrains Mono", monospace';
  lctx.fillText('USE DIPPER AT NIGHT · BLOW HORN', 256, 446);

  const lorryTailgateMap = new THREE.CanvasTexture(lorryCanvas);
  lorryTailgateMap.colorSpace = THREE.SRGBColorSpace;
  lorryTailgateMap.anisotropy = maxAnisotropy;

  // ============================================================================
  // 8. Automotive Leather Grain Normal Map & Heavy Tire Tread Normal Map
  // ============================================================================
  const leatherHeight = document.createElement('canvas');
  leatherHeight.width = 256;
  leatherHeight.height = 256;
  const lhctx = leatherHeight.getContext('2d')!;
  lhctx.fillStyle = '#808080';
  lhctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const x = (i * 1777) % 256;
    const y = (i * 2311) % 256;
    const v = 95 + ((i * 29) % 65);
    lhctx.fillStyle = `rgb(${v},${v},${v})`;
    lhctx.fillRect(x, y, 2, 2);
  }
  const leatherNormalMap = createNormalMapFromHeightCanvas(leatherHeight, 1.8, maxAnisotropy);
  leatherNormalMap.repeat.set(8, 8);

  const tireHeight = document.createElement('canvas');
  tireHeight.width = 256;
  tireHeight.height = 256;
  const thctx = tireHeight.getContext('2d')!;
  thctx.fillStyle = '#303030';
  thctx.fillRect(0, 0, 256, 256);
  thctx.fillStyle = '#d8d8d8';
  for (let y = 0; y < 256; y += 24) {
    thctx.fillRect(14, y, 48, 16);
    thctx.fillRect(72, y + 6, 48, 16);
    thctx.fillRect(136, y, 48, 16);
    thctx.fillRect(194, y + 6, 48, 16);
  }
  const tireTreadNormalMap = createNormalMapFromHeightCanvas(tireHeight, 3.6, maxAnisotropy);
  tireTreadNormalMap.repeat.set(1, 6);

  // ============================================================================
  // 9. Tree Bark Albedo & Soft Radial-Faded High-Altitude Cirrus Cloud Texture
  // ============================================================================
  const barkCanvas = document.createElement('canvas');
  barkCanvas.width = 256;
  barkCanvas.height = 256;
  const bkctx = barkCanvas.getContext('2d')!;
  bkctx.fillStyle = '#4a3728';
  bkctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1200; i++) {
    const x = (i * 733) % 256;
    const y = (i * 919) % 256;
    bkctx.fillStyle = i % 2 === 0 ? '#36271c' : '#5e4735';
    bkctx.fillRect(x, y, 4, 24);
  }
  const barkMap = new THREE.CanvasTexture(barkCanvas);
  barkMap.colorSpace = THREE.SRGBColorSpace;
  barkMap.wrapS = THREE.RepeatWrapping;
  barkMap.wrapT = THREE.RepeatWrapping;

  // Radial-faded wispy clouds so the sky dome never shows a hard horizontal band
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 512;
  cloudCanvas.height = 512;
  const clctx = cloudCanvas.getContext('2d')!;
  clctx.clearRect(0, 0, 512, 512);
  for (let i = 0; i < 95; i++) {
    const angle = (i * 2.39996) % (Math.PI * 2);
    const dist = Math.sqrt(i / 95) * 195;
    const cx = 256 + Math.cos(angle) * dist;
    const cy = 256 + Math.sin(angle) * dist;
    const edgeFade = Math.max(0, 1 - dist / 215);
    const r = 28 + ((i * 37) % 54);
    const g = clctx.createRadialGradient(cx, cy, 2, cx, cy, r);
    g.addColorStop(0, `rgba(255, 252, 246, ${(0.18 * edgeFade).toFixed(3)})`);
    g.addColorStop(0.55, `rgba(255, 248, 238, ${(0.07 * edgeFade).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255, 248, 238, 0)');
    clctx.fillStyle = g;
    clctx.beginPath();
    clctx.arc(cx, cy, r, 0, Math.PI * 2);
    clctx.fill();
  }
  const cloudLayerMap = new THREE.CanvasTexture(cloudCanvas);
  cloudLayerMap.colorSpace = THREE.SRGBColorSpace;
  cloudLayerMap.wrapS = THREE.ClampToEdgeWrapping;
  cloudLayerMap.wrapT = THREE.ClampToEdgeWrapping;

  // ============================================================================
  // 10. Live 1st-Person Instrument Cluster & Live GPS Navigation Map Canvases
  // ============================================================================
  const dashCanvas = document.createElement('canvas');
  dashCanvas.width = 1024;
  dashCanvas.height = 512;
  const dctx = dashCanvas.getContext('2d')!;

  const dashboardClusterMap = new THREE.CanvasTexture(dashCanvas);
  dashboardClusterMap.colorSpace = THREE.SRGBColorSpace;
  dashboardClusterMap.anisotropy = maxAnisotropy;

  const gpsCanvas = document.createElement('canvas');
  gpsCanvas.width = 512;
  gpsCanvas.height = 384;
  const gpsCtx = gpsCanvas.getContext('2d')!;

  const gpsNavMap = new THREE.CanvasTexture(gpsCanvas);
  gpsNavMap.colorSpace = THREE.SRGBColorSpace;
  gpsNavMap.anisotropy = maxAnisotropy;

  let lastCabinRedrawMs = -1000;

  const updateCabinDisplays = (
    state: TruckPhysicsState,
    traffic: TrafficVehicle[],
    isCabinActive = true
  ) => {
    const now = performance.now();
    // Redraw at ~20Hz in 1st-person cabin view for silky-smooth diegetic gauges, or every 650ms in exterior views
    const minIntervalMs = isCabinActive ? 50 : 650;
    if (now - lastCabinRedrawMs < minIntervalMs) return;
    lastCabinRedrawMs = now;

    // --- A. Redraw High-Res Diegetic 1st-Person Instrument Cluster (1024x512) ---
    dctx.fillStyle = '#060a12';
    dctx.fillRect(0, 0, 1024, 512);

    // Brushed metallic outer cluster bezel with generous safe inset
    dctx.strokeStyle = '#334155';
    dctx.lineWidth = 8;
    dctx.strokeRect(8, 8, 1008, 496);

    const drawGauge = (
      cx: number,
      cy: number,
      r: number,
      title: string,
      unit: string,
      maxVal: number,
      step: number,
      currentVal: number,
      isRpm: boolean,
      digitalReadout: string
    ) => {
      const ringGrad = dctx.createRadialGradient(cx, cy, r - 12, cx, cy, r + 6);
      ringGrad.addColorStop(0, '#0f172a');
      ringGrad.addColorStop(0.65, '#64748b');
      ringGrad.addColorStop(1, '#1e293b');
      dctx.strokeStyle = ringGrad;
      dctx.lineWidth = 10;
      dctx.beginPath();
      dctx.arc(cx, cy, r, 0, Math.PI * 2);
      dctx.stroke();

      const faceGrad = dctx.createRadialGradient(cx, cy, 12, cx, cy, r - 5);
      faceGrad.addColorStop(0, '#111827');
      faceGrad.addColorStop(0.8, '#090d16');
      faceGrad.addColorStop(1, '#04060b');
      dctx.fillStyle = faceGrad;
      dctx.beginPath();
      dctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
      dctx.fill();

      if (isRpm) {
        // Green Economy Torque Band (1050 - 1700 RPM)
        dctx.strokeStyle = '#10b981';
        dctx.lineWidth = 13;
        dctx.beginPath();
        dctx.arc(
          cx,
          cy,
          r - 18,
          Math.PI * 0.75 + 0.42 * Math.PI * 1.5,
          Math.PI * 0.75 + 0.68 * Math.PI * 1.5
        );
        dctx.stroke();

        // Redline Band (2050 - 2500 RPM)
        dctx.strokeStyle = '#ef4444';
        dctx.beginPath();
        dctx.arc(
          cx,
          cy,
          r - 18,
          Math.PI * 0.75 + 0.82 * Math.PI * 1.5,
          Math.PI * 0.75 + 1.0 * Math.PI * 1.5
        );
        dctx.stroke();
      } else {
        // Speedometer posted limit warning arc above state.speedLimitKmh
        const limFrac = Math.min(1, (state.speedLimitKmh || 80) / maxVal);
        dctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
        dctx.lineWidth = 11;
        dctx.beginPath();
        dctx.arc(
          cx,
          cy,
          r - 18,
          Math.PI * 0.75 + limFrac * Math.PI * 1.5,
          Math.PI * 0.75 + Math.PI * 1.5
        );
        dctx.stroke();
      }

      dctx.textAlign = 'center';
      dctx.textBaseline = 'middle';
      for (let v = 0; v <= maxVal; v += step / 2) {
        const frac = v / maxVal;
        const ang = Math.PI * 0.75 + frac * Math.PI * 1.5;
        const isMajor = v % step === 0;
        const innerR = isMajor ? r - 30 : r - 20;
        dctx.strokeStyle = isMajor ? '#f8fafc' : '#64748b';
        dctx.lineWidth = isMajor ? 4.0 : 2.0;
        dctx.beginPath();
        dctx.moveTo(cx + Math.cos(ang) * innerR, cy + Math.sin(ang) * innerR);
        dctx.lineTo(cx + Math.cos(ang) * (r - 9), cy + Math.sin(ang) * (r - 9));
        dctx.stroke();

        if (isMajor) {
          dctx.fillStyle = '#f8fafc';
          dctx.font = '800 22px "JetBrains Mono", monospace';
          const tx = cx + Math.cos(ang) * (r - 52);
          const ty = cy + Math.sin(ang) * (r - 52);
          dctx.fillText(String(v), tx, ty);
        }
      }

      dctx.fillStyle = '#94a3b8';
      dctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
      dctx.fillText(title, cx, cy - 38);
      dctx.fillStyle = '#38bdf8';
      dctx.font = '700 14px "JetBrains Mono", monospace';
      dctx.fillText(unit, cx, cy - 18);

      // Sub-dial digital readout pill at bottom of analog face
      dctx.fillStyle = '#090e17';
      dctx.strokeStyle = '#334155';
      dctx.lineWidth = 2.5;
      dctx.fillRect(cx - 68, cy + 54, 136, 42);
      dctx.strokeRect(cx - 68, cy + 54, 136, 42);
      dctx.fillStyle = isRpm ? '#fbbf24' : '#38bdf8';
      dctx.font = '800 22px "JetBrains Mono", monospace';
      dctx.fillText(digitalReadout, cx, cy + 76);

      // High-visibility illuminated analog needle
      const clampedFrac = Math.max(0, Math.min(1, currentVal / maxVal));
      const needleAng = Math.PI * 0.75 + clampedFrac * Math.PI * 1.5;
      dctx.save();
      dctx.translate(cx, cy);
      dctx.rotate(needleAng);
      dctx.fillStyle = isRpm ? '#f59e0b' : '#38bdf8';
      dctx.beginPath();
      dctx.moveTo(-20, -5.5);
      dctx.lineTo(r - 18, -2.2);
      dctx.lineTo(r - 18, 2.2);
      dctx.lineTo(-20, 5.5);
      dctx.closePath();
      dctx.fill();
      dctx.restore();

      dctx.fillStyle = '#1e293b';
      dctx.strokeStyle = isRpm ? '#f59e0b' : '#38bdf8';
      dctx.lineWidth = 4;
      dctx.beginPath();
      dctx.arc(cx, cy, 18, 0, Math.PI * 2);
      dctx.fill();
      dctx.stroke();
    };

    drawGauge(
      202,
      256,
      172,
      'TACHOMETER',
      'RPM x100',
      25,
      5,
      state.rpm / 100,
      true,
      `${Math.round(state.rpm)} RPM`
    );
    drawGauge(
      822,
      256,
      172,
      'SPEEDOMETER',
      'KM/H',
      120,
      20,
      state.speedKmh,
      false,
      `${Math.round(state.speedKmh)} KMH`
    );

    // --- Center Full-Color Diegetic Driver Information Display (DID: x=402..622, y=24..488) ---
    dctx.fillStyle = '#09101d';
    dctx.fillRect(402, 24, 220, 464);
    dctx.strokeStyle = '#38bdf8';
    dctx.lineWidth = 3;
    dctx.strokeRect(402, 24, 220, 464);

    // 1. Top Turn-Signal & Beam Header Bar
    const leftOn =
      state.indicatorBlinkOn && (state.indicator === 'left' || state.indicator === 'hazard');
    const rightOn =
      state.indicatorBlinkOn && (state.indicator === 'right' || state.indicator === 'hazard');

    dctx.fillStyle = leftOn ? '#22c55e' : '#1e293b';
    dctx.fillRect(412, 34, 46, 36);
    dctx.fillStyle = leftOn ? '#052e16' : '#64748b';
    dctx.font = '800 26px "JetBrains Mono", monospace';
    dctx.textAlign = 'center';
    dctx.textBaseline = 'middle';
    dctx.fillText('◀', 435, 53);

    dctx.fillStyle = rightOn ? '#22c55e' : '#1e293b';
    dctx.fillRect(566, 34, 46, 36);
    dctx.fillStyle = rightOn ? '#052e16' : '#64748b';
    dctx.fillText('▶', 589, 53);

    // Center Beam & Speed Limit Roundel in Top Header
    dctx.fillStyle = state.highBeamOn ? '#38bdf8' : state.headlightsOn ? '#4ade80' : '#64748b';
    dctx.font = '800 13px "JetBrains Mono", monospace';
    dctx.fillText(
      state.highBeamOn ? 'HI-BEAM' : state.headlightsOn ? 'LO-BEAM' : 'BEAM OFF',
      512,
      44
    );
    dctx.fillStyle = '#facc15';
    dctx.font = '700 13px "JetBrains Mono", monospace';
    dctx.fillText(`LIM ${state.speedLimitKmh || 80} KM/H`, 512, 62);

    // 2. Hero 12-Speed Gear System Box (x=414..610, y=80..186)
    dctx.fillStyle = '#111c2d';
    dctx.fillRect(414, 80, 196, 106);
    dctx.strokeStyle = '#f59e0b';
    dctx.lineWidth = 2.5;
    dctx.strokeRect(414, 80, 196, 106);

    const gearLabels = [
      'R2',
      'R1',
      'N',
      '1L',
      '1H',
      '2L',
      '2H',
      '3L',
      '3H',
      '4L',
      '4H',
      '5L',
      '5H',
      '6L',
      '6H',
    ];
    const gearStr = state.gearLabel || gearLabels[state.gearIndex + 2] || 'N';
    dctx.fillStyle = '#fbbf24';
    dctx.font = '800 58px "Chakra Petch", sans-serif';
    dctx.fillText(gearStr, 480, 126);

    // Mode badge (AUTO / MAN)
    dctx.fillStyle = state.transmissionMode === 'auto' ? '#10b981' : '#f97316';
    dctx.fillRect(544, 92, 54, 26);
    dctx.fillStyle = '#05080f';
    dctx.font = '800 14px "JetBrains Mono", monospace';
    dctx.fillText(state.transmissionMode === 'auto' ? 'AUTO' : 'MAN', 571, 106);

    // Splitter / Range indicator bar (6 ranges)
    const activeRangeIdx = Math.max(0, Math.min(5, Math.floor((state.gearIndex - 1) / 2)));
    for (let g = 0; g < 6; g++) {
      const gx = 424 + g * 30;
      dctx.fillStyle =
        state.gearIndex > 0 && g <= activeRangeIdx ? '#f59e0b' : '#1e293b';
      dctx.fillRect(gx, 163, 25, 13);
    }

    // 3. Hero Digital Speedometer Box (y=196..278)
    dctx.fillStyle = '#060a12';
    dctx.fillRect(414, 196, 196, 82);
    dctx.fillStyle = '#f8fafc';
    dctx.font = '800 52px "Chakra Petch", sans-serif';
    dctx.fillText(`${Math.round(state.speedKmh)}`, 512, 232);
    dctx.fillStyle = '#38bdf8';
    dctx.font = '700 13px "JetBrains Mono", monospace';
    dctx.fillText('KM/H · CRUISE', 512, 265);

    // 4. Live Telemetry Bars: Air PSI, Turbo Boost, Fuel & Cargo Integrity
    const drawDidBar = (
      y: number,
      label: string,
      valText: string,
      frac: number,
      color: string
    ) => {
      dctx.textAlign = 'left';
      dctx.fillStyle = '#cbd5e1';
      dctx.font = '700 13.5px "JetBrains Mono", monospace';
      dctx.fillText(label, 418, y);
      dctx.textAlign = 'right';
      dctx.fillStyle = color;
      dctx.fillText(valText, 606, y);

      dctx.fillStyle = '#1e293b';
      dctx.fillRect(418, y + 10, 188, 10);
      dctx.fillStyle = color;
      dctx.fillRect(418, y + 10, Math.max(4, Math.min(188, 188 * frac)), 10);
    };

    const airFrac = Math.min(1, state.airPressurePsi / 120);
    drawDidBar(
      296,
      'AIR BRAKE',
      `${Math.round(state.airPressurePsi)} PSI`,
      airFrac,
      state.airPressurePsi < 75 ? '#ef4444' : '#38bdf8'
    );

    const turboBar = Math.max(0, Math.min(2.4, ((state.rpm - 750) / 1550) * 2.2));
    drawDidBar(
      336,
      'TURBO',
      `${turboBar.toFixed(1)} BAR`,
      turboBar / 2.4,
      '#10b981'
    );

    const fuelFrac = Math.min(1, state.fuelLiters / Math.max(1, state.fuelMaxLiters));
    drawDidBar(
      376,
      'DIESEL',
      `${Math.round(state.fuelLiters)}L`,
      fuelFrac,
      fuelFrac < 0.2 ? '#ef4444' : '#f59e0b'
    );

    const cargoFrac = Math.min(1, state.cargoIntegrityPct / 100);
    drawDidBar(
      416,
      'CARGO',
      `${Math.round(state.cargoIntegrityPct)}%`,
      cargoFrac,
      state.cargoIntegrityPct < 80 ? '#f59e0b' : '#4ade80'
    );

    // 5. Bottom Digital Odometer & Milestone Readout (y=464, cleanly inside y=488 border)
    dctx.textAlign = 'center';
    dctx.fillStyle = '#fde047';
    dctx.font = '700 14.5px "JetBrains Mono", monospace';
    dctx.fillText(
      `${state.landmarkKm || 'NH-44'} · ODO ${(state.distanceAlongHighwayM / 1000).toFixed(2)} KM`,
      512,
      464
    );

    dashboardClusterMap.needsUpdate = true;

    // --- B. Redraw Live Center-Console Highway Radar & Navigation Screen (512x384) ---
    gpsCtx.fillStyle = '#07111a';
    gpsCtx.fillRect(0, 0, 512, 384);

    // Subtle Doppler Radar Grid & Range Rings
    gpsCtx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    gpsCtx.lineWidth = 1;
    for (let x = 0; x < 512; x += 48) {
      gpsCtx.beginPath();
      gpsCtx.moveTo(x, 68);
      gpsCtx.lineTo(x, 336);
      gpsCtx.stroke();
    }
    for (let y = 68; y < 336; y += 48) {
      gpsCtx.beginPath();
      gpsCtx.moveTo(0, y);
      gpsCtx.lineTo(512, y);
      gpsCtx.stroke();
    }

    const curS = state.distanceAlongHighwayM;
    const curSample = getRoadPointAtDistance(curS);
    const mapCenterX = 256;
    const mapCenterY = 278;
    const scalePxPerM = 0.88;

    // Draw Curvilinear 4-Lane Highway Ribbon on Radar
    gpsCtx.strokeStyle = '#1e293b';
    gpsCtx.lineWidth = 42;
    gpsCtx.lineCap = 'round';
    gpsCtx.beginPath();
    for (let ds = -100; ds <= 260; ds += 16) {
      const sample = getRoadPointAtDistance(Math.max(0, Math.min(HIGHWAY_LENGTH_M, curS + ds)));
      const dx = (sample.x - curSample.x) * scalePxPerM;
      const dy = -ds * scalePxPerM;
      if (ds === -100) gpsCtx.moveTo(mapCenterX + dx, mapCenterY + dy);
      else gpsCtx.lineTo(mapCenterX + dx, mapCenterY + dy);
    }
    gpsCtx.stroke();

    // Center Median Emerald Line
    gpsCtx.strokeStyle = '#10b981';
    gpsCtx.lineWidth = 4;
    gpsCtx.stroke();

    // Draw Nearby AI Traffic Vehicles with Archetype Sizing & Color
    for (const tv of traffic) {
      const ds = tv.s - curS;
      if (ds > -95 && ds < 250) {
        const tx = mapCenterX + (tv.laneOffset - state.lateralOffsetM) * 2.2;
        const ty = mapCenterY - ds * scalePxPerM;
        gpsCtx.fillStyle =
          tv.archetype === 'bus'
            ? '#38bdf8'
            : tv.archetype === 'lorry'
              ? '#fbbf24'
              : '#a78bfa';
        const vw = tv.archetype === 'bus' || tv.archetype === 'lorry' ? 11 : 8;
        const vh = tv.archetype === 'bus' ? 20 : tv.archetype === 'lorry' ? 17 : 12;
        gpsCtx.fillRect(tx - vw / 2, ty - vh / 2, vw, vh);
      }
    }

    // Player Heavy Rig Chevron Icon
    gpsCtx.fillStyle = '#f97316';
    gpsCtx.beginPath();
    gpsCtx.moveTo(mapCenterX, mapCenterY - 16);
    gpsCtx.lineTo(mapCenterX + 12, mapCenterY + 11);
    gpsCtx.lineTo(mapCenterX, mapCenterY + 5);
    gpsCtx.lineTo(mapCenterX - 12, mapCenterY + 11);
    gpsCtx.closePath();
    gpsCtx.fill();

    // Top NHAI Green Corridor Header Bar (Dynamic across NH-44, NH-48 & NH-66!)
    gpsCtx.fillStyle = '#065f46';
    gpsCtx.fillRect(0, 0, 512, 68);
    gpsCtx.fillStyle = '#facc15';
    gpsCtx.fillRect(12, 10, 82, 48);
    gpsCtx.fillStyle = '#18181b';
    gpsCtx.textAlign = 'center';
    gpsCtx.textBaseline = 'middle';
    gpsCtx.font = '800 22px "Chakra Petch", sans-serif';
    const routeCode = (state.landmarkKm || 'NH-44').split(' ')[0] || 'NH-44';
    gpsCtx.fillText(routeCode, 53, 35);

    gpsCtx.textAlign = 'left';
    gpsCtx.fillStyle = '#ffffff';
    gpsCtx.font = '800 20px "Plus Jakarta Sans", sans-serif';
    const wpName = (state.nextWaypointName || 'HIGHWAY WAYPOINT').toUpperCase();
    gpsCtx.fillText(wpName.slice(0, 22), 108, 25);

    gpsCtx.fillStyle = '#a7f3d0';
    gpsCtx.font = '700 16px "JetBrains Mono", monospace';
    const wpDistKm = ((state.nextWaypointDistanceM || 500) / 1000).toFixed(2);
    const remKm = Math.max(0, (4350 - curS) / 1000).toFixed(2);
    gpsCtx.fillText(`NEXT: ${wpDistKm} KM · GOAL: ${remKm} KM`, 108, 49);

    // Circular Speed Limit Sign on Top-Right of Infotainment Screen
    gpsCtx.fillStyle = '#f8fafc';
    gpsCtx.beginPath();
    gpsCtx.arc(472, 34, 24, 0, Math.PI * 2);
    gpsCtx.fill();
    gpsCtx.strokeStyle = '#dc2626';
    gpsCtx.lineWidth = 6;
    gpsCtx.stroke();
    gpsCtx.fillStyle = '#090d16';
    gpsCtx.textAlign = 'center';
    gpsCtx.font = '800 20px "JetBrains Mono", monospace';
    gpsCtx.fillText(`${state.speedLimitKmh || 80}`, 472, 35);

    // Bottom Telemetry Footer Bar on Center Console Screen
    gpsCtx.fillStyle = '#0f172a';
    gpsCtx.fillRect(0, 336, 512, 48);
    gpsCtx.strokeStyle = '#334155';
    gpsCtx.lineWidth = 2;
    gpsCtx.beginPath();
    gpsCtx.moveTo(0, 336);
    gpsCtx.lineTo(512, 336);
    gpsCtx.stroke();

    gpsCtx.textAlign = 'left';
    gpsCtx.fillStyle = '#38bdf8';
    gpsCtx.font = '700 15px "JetBrains Mono", monospace';
    gpsCtx.fillText(
      `ZONE: ${(state.zoneName || 'HIGHWAY CORRIDOR').toUpperCase().slice(0, 24)}`,
      14,
      361
    );
    gpsCtx.textAlign = 'right';
    gpsCtx.fillStyle = '#fbbf24';
    gpsCtx.fillText(
      `GEAR ${gearStr} (${state.transmissionMode.toUpperCase()})`,
      498,
      361
    );

    gpsNavMap.needsUpdate = true;
  };

  updateCabinDisplays(createInitialTruckState(60), [], true);

  // ============================================================================
  // 11. NHAI Green Overhead Highway Gantry Signboard & Milestone Generators
  // ============================================================================
  const createGantrySignTexture = (
    titleEn: string,
    titleHi: string,
    subLeft: string,
    subRight: string,
    routeBadge: string
  ) => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext('2d')!;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, 256);
    bgGrad.addColorStop(0, '#047857');
    bgGrad.addColorStop(0.5, '#065f46');
    bgGrad.addColorStop(1, '#064e3b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 256);

    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, 1000, 232);

    ctx.fillStyle = '#facc15';
    ctx.fillRect(36, 36, 148, 184);
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 4;
    ctx.strokeRect(42, 42, 136, 172);
    ctx.fillStyle = '#18181b';
    ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NH', 110, 96);
    ctx.font = '700 56px "Chakra Petch", sans-serif';
    ctx.fillText(routeBadge, 110, 162);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 48px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(titleEn, 215, 94);

    ctx.fillStyle = '#fde047';
    ctx.font = '600 34px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(titleHi, 215, 148);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 30px "JetBrains Mono", monospace';
    ctx.fillText(`↓ ${subLeft}`, 215, 210);
    ctx.fillText(`↓ ${subRight}`, 620, 210);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    return tex;
  };

  const createMilestoneTexture = (cityName: string, kmLeft: number) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 384;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#f5f5f4';
    ctx.fillRect(0, 0, 256, 384);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#18181b';
    ctx.textAlign = 'center';
    ctx.font = '700 34px "Chakra Petch", sans-serif';
    ctx.fillText('NH-44', 128, 78);
    ctx.font = '700 32px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(cityName, 128, 195);
    ctx.font = '700 64px "JetBrains Mono", monospace';
    ctx.fillText(`${kmLeft}`, 128, 280);
    ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('KM', 128, 325);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    return tex;
  };

  const textureSet: HighwayTextureSet = {
    asphaltMap,
    asphaltNormalMap,
    asphaltRoughnessMap,
    concreteMap,
    concreteNormalMap,
    hazardConcreteMap,
    guardrailMap,
    guardrailNormalMap,
    terrainMap,
    terrainNormalMap,
    containerSideMap,
    containerRearMap,
    containerNormalMap,
    lorryTailgateMap,
    leatherNormalMap,
    tireTreadNormalMap,
    barkMap,
    cloudLayerMap,
    dashboardClusterMap,
    gpsNavMap,
    isUltra4KUpgraded: false,
    upgradeToUltra4K: (ultraAnisotropy: number) => {
      if (textureSet.isUltra4KUpgraded) return;
      textureSet.isUltra4KUpgraded = true;

      // Upgrade Highway Asphalt & Container Livery to UHD resolution with 65,000 micro-aggregate grains
      asphaltCanvas.width = 2048;
      asphaltCanvas.height = 2048;
      paintAsphaltCanvas(asphaltCanvas, 65000);
      asphaltMap.anisotropy = ultraAnisotropy;
      asphaltMap.needsUpdate = true;

      contCanvas.width = 2048;
      contCanvas.height = 1024;
      paintContainerSideCanvas(contCanvas);
      containerSideMap.anisotropy = ultraAnisotropy;
      containerSideMap.needsUpdate = true;

      concreteMap.anisotropy = ultraAnisotropy;
      terrainMap.anisotropy = ultraAnisotropy;
      guardrailMap.anisotropy = ultraAnisotropy;
    },
    updateCabinDisplays,
    createGantrySignTexture,
    createMilestoneTexture,
  };

  return textureSet;
}
