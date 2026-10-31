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
  updateCabinDisplays: (state: TruckPhysicsState, traffic: TrafficVehicle[]) => void;
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

export function createHighwayTextureSet(maxAnisotropy = 8): HighwayTextureSet {
  // ============================================================================
  // 1. 4-Lane Divided Highway Asphalt Albedo + Normal Map + Specular Roughness Map
  // ============================================================================
  const asphaltCanvas = document.createElement('canvas');
  asphaltCanvas.width = 1024;
  asphaltCanvas.height = 1024;
  const actx = asphaltCanvas.getContext('2d')!;

  const asphaltHeightCanvas = document.createElement('canvas');
  asphaltHeightCanvas.width = 512;
  asphaltHeightCanvas.height = 512;
  const ahctx = asphaltHeightCanvas.getContext('2d')!;

  const asphaltRoughCanvas = document.createElement('canvas');
  asphaltRoughCanvas.width = 512;
  asphaltRoughCanvas.height = 512;
  const arctx = asphaltRoughCanvas.getContext('2d')!;

  // Base basalt highway asphalt
  actx.fillStyle = '#1f2226';
  actx.fillRect(0, 0, 1024, 1024);

  // Base roughness (0.82 = 210)
  arctx.fillStyle = 'rgb(212, 212, 212)';
  arctx.fillRect(0, 0, 512, 512);

  // Shoulders dusty brown-grey aggregate + higher roughness
  const leftShoulderGrad = actx.createLinearGradient(0, 0, 118, 0);
  leftShoulderGrad.addColorStop(0, '#443c32');
  leftShoulderGrad.addColorStop(0.75, '#332f2a');
  leftShoulderGrad.addColorStop(1, '#222428');
  actx.fillStyle = leftShoulderGrad;
  actx.fillRect(0, 0, 118, 1024);

  const rightShoulderGrad = actx.createLinearGradient(906, 0, 1024, 0);
  rightShoulderGrad.addColorStop(0, '#222428');
  rightShoulderGrad.addColorStop(0.25, '#332f2a');
  rightShoulderGrad.addColorStop(1, '#443c32');
  actx.fillStyle = rightShoulderGrad;
  actx.fillRect(906, 0, 118, 1024);

  arctx.fillStyle = 'rgb(242, 242, 242)';
  arctx.fillRect(0, 0, 58, 512);
  arctx.fillRect(454, 0, 58, 512);

  // Central median edge dust & ambient occlusion strips
  const medGrad = actx.createLinearGradient(418, 0, 606, 0);
  medGrad.addColorStop(0, 'rgba(28, 25, 22, 0)');
  medGrad.addColorStop(0.12, 'rgba(68, 58, 45, 0.55)');
  medGrad.addColorStop(0.5, 'rgba(18, 16, 15, 0.85)');
  medGrad.addColorStop(0.88, 'rgba(68, 58, 45, 0.55)');
  medGrad.addColorStop(1, 'rgba(28, 25, 22, 0)');
  actx.fillStyle = medGrad;
  actx.fillRect(418, 0, 188, 1024);

  // Polished wheel wear tracks in all 4 lanes (darker oil-stained centers + low roughness for sun sheen)
  const laneCentersU = [0.188, 0.342, 0.658, 0.812];
  for (const u of laneCentersU) {
    const cx = u * 1024;
    const grad = actx.createLinearGradient(cx - 64, 0, cx + 64, 0);
    grad.addColorStop(0, 'rgba(12, 14, 17, 0)');
    grad.addColorStop(0.24, 'rgba(10, 12, 15, 0.52)');
    grad.addColorStop(0.5, 'rgba(28, 31, 36, 0.16)');
    grad.addColorStop(0.76, 'rgba(10, 12, 15, 0.52)');
    grad.addColorStop(1, 'rgba(12, 14, 17, 0)');
    actx.fillStyle = grad;
    actx.fillRect(cx - 64, 0, 128, 1024);

    // Specular wheel-track polish on roughness map
    const rcx = u * 512;
    const rGrad = arctx.createLinearGradient(rcx - 32, 0, rcx + 32, 0);
    rGrad.addColorStop(0, 'rgba(210, 210, 210, 0)');
    rGrad.addColorStop(0.25, 'rgba(92, 92, 92, 0.85)');
    rGrad.addColorStop(0.5, 'rgba(175, 175, 175, 0.4)');
    rGrad.addColorStop(0.75, 'rgba(92, 92, 92, 0.85)');
    rGrad.addColorStop(1, 'rgba(210, 210, 210, 0)');
    arctx.fillStyle = rGrad;
    arctx.fillRect(rcx - 32, 0, 64, 512);
  }

  // Dense multi-scale stone aggregate & weathered bitumen patches
  for (let i = 0; i < 24000; i++) {
    const rx = (i * 7919) % 1024;
    const ry = (i * 6271) % 1024;
    const shade = 24 + ((i * 37) % 34);
    actx.fillStyle = `rgb(${shade}, ${shade + 1}, ${shade + 3})`;
    actx.fillRect(rx, ry, i % 3 === 0 ? 3 : 2, 2);
  }

  // Bitumen overband crack sealing snakes & repair patches
  actx.fillStyle = 'rgba(14, 16, 19, 0.68)';
  actx.fillRect(158, 180, 54, 195);
  actx.fillRect(318, 640, 66, 145);
  actx.fillRect(675, 380, 56, 165);
  arctx.fillStyle = 'rgb(75, 75, 75)'; // Tar patches are glossy
  arctx.fillRect(79, 90, 27, 97);
  arctx.fillRect(159, 320, 33, 72);

  // Longitudinal tar crack lines
  actx.strokeStyle = 'rgba(10, 11, 13, 0.78)';
  actx.lineWidth = 2.5;
  for (const crackX of [212, 365, 695, 835]) {
    actx.beginPath();
    actx.moveTo(crackX, 0);
    for (let y = 64; y <= 1024; y += 64) {
      actx.lineTo(crackX + Math.sin(y * 0.04 + crackX) * 8, y);
    }
    actx.stroke();
  }

  // Height map for normal map generation
  ahctx.fillStyle = '#808080';
  ahctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 22000; i++) {
    const rx = (i * 4999) % 512;
    const ry = (i * 3571) % 512;
    const v = 76 + ((i * 53) % 104);
    ahctx.fillStyle = `rgb(${v},${v},${v})`;
    ahctx.fillRect(rx, ry, 2, 2);
  }
  // Rumble strip grooves in height map
  ahctx.fillStyle = '#252525';
  for (let y = 0; y < 512; y += 12) {
    ahctx.fillRect(44, y, 8, 5);
    ahctx.fillRect(460, y, 8, 5);
  }

  // Thermoplastic road markings (with subtle wear & high visibility)
  // Outer solid white shoulder edge markings
  actx.fillStyle = '#f1f5f9';
  actx.fillRect(110, 0, 10, 1024);
  actx.fillRect(904, 0, 10, 1024);

  // Inner yellow median edge markings
  actx.fillStyle = '#facc15';
  actx.fillRect(422, 0, 10, 1024);
  actx.fillRect(592, 0, 10, 1024);

  // Dashed white lane dividers (between L1 & L2 on both carriageways)
  actx.fillStyle = '#f8fafc';
  const leftDividerX = Math.round(0.265 * 1024) - 5;
  const rightDividerX = Math.round(0.735 * 1024) - 5;
  for (let y = 20; y < 1024; y += 128) {
    actx.fillRect(leftDividerX, y, 10, 62);
    actx.fillRect(rightDividerX, y, 10, 62);
  }

  // Rumble strips on outer shoulders
  actx.fillStyle = 'rgba(226, 232, 240, 0.42)';
  for (let y = 0; y < 1024; y += 24) {
    actx.fillRect(86, y, 18, 10);
    actx.fillRect(920, y, 18, 10);
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

  // Weathering & base dirt gradient
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
  // Precast panel seams & formwork tie-rod holes
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
  // Subtle road grime along lower edge
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

  // Splice bolts & red/white reflector tabs
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

      // Ploughed furrow lines & irrigation bunds
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
      // Earth bund border around field plot
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
  const kctx = contCanvas.getContext('2d')!;
  kctx.fillStyle = '#173152';
  kctx.fillRect(0, 0, 1024, 512);

  // Corrugated steel vertical shading ribs
  for (let x = 0; x < 1024; x += 16) {
    kctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    kctx.fillRect(x, 26, 6, 460);
    kctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    kctx.fillRect(x + 6, 26, 4, 460);
  }
  // Top & bottom structural Corten steel rails + corner castings
  kctx.fillStyle = '#0c1d33';
  kctx.fillRect(0, 0, 1024, 32);
  kctx.fillRect(0, 480, 1024, 32);
  kctx.fillRect(0, 0, 28, 512);
  kctx.fillRect(996, 0, 28, 512);

  // Saffron-gold & white logistics branding stripe
  kctx.fillStyle = '#f59e0b';
  kctx.fillRect(60, 148, 904, 14);
  kctx.fillRect(60, 346, 904, 8);

  kctx.fillStyle = '#f8fafc';
  kctx.font = '700 54px "Chakra Petch", sans-serif';
  kctx.fillText('BHARAT FREIGHT CORRIDOR', 84, 232);
  kctx.fillStyle = '#fbbf24';
  kctx.font = '600 28px "Plus Jakarta Sans", sans-serif';
  kctx.fillText('NH-44 GRAND TRUNK EXPRESS · HEAVY HAUL LOGISTICS · IN-HR-44', 88, 284);

  // ISO container code block
  kctx.fillStyle = '#e2e8f0';
  kctx.font = '600 22px "JetBrains Mono", monospace';
  kctx.fillText('BFCL 449280-7', 775, 92);
  kctx.fillText('45G1 · MAX GROSS 32,500 KG', 682, 122);

  // Reflective conspicuity tape along bottom rail
  for (let x = 32; x < 992; x += 48) {
    kctx.fillStyle = x % 96 === 32 ? '#ef4444' : '#f8fafc';
    kctx.fillRect(x, 488, 36, 12);
  }

  const containerSideMap = new THREE.CanvasTexture(contCanvas);
  containerSideMap.colorSpace = THREE.SRGBColorSpace;
  containerSideMap.anisotropy = maxAnisotropy;

  // Container Rear Double Doors Texture
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
  // Center door rubber gasket seam & hinges
  crctx.fillStyle = '#090d14';
  crctx.fillRect(252, 20, 8, 472);
  crctx.strokeStyle = '#090d14';
  crctx.lineWidth = 10;
  crctx.strokeRect(18, 20, 476, 472);
  // Yellow/Red Chevron High-Visibility Heavy Vehicle Rear Warning Plates
  crctx.fillStyle = '#facc15';
  crctx.fillRect(42, 390, 160, 54);
  crctx.fillRect(310, 390, 160, 54);
  crctx.fillStyle = '#dc2626';
  crctx.fillRect(48, 396, 70, 42);
  crctx.fillRect(384, 396, 70, 42);
  crctx.fillStyle = '#f8fafc';
  crctx.font = '700 22px "JetBrains Mono", monospace';
  crctx.fillText('BFCL 449280-7', 280, 95);
  crctx.fillStyle = '#fbbf24';
  crctx.font = '700 24px "Chakra Petch", sans-serif';
  crctx.fillText('SPEED LIMIT 60 KM/H', 44, 95);
  crctx.fillText('KEEP 15M DISTANCE', 44, 130);

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
    // Lugged heavy commercial truck tread blocks
    thctx.fillRect(14, y, 48, 16);
    thctx.fillRect(72, y + 6, 48, 16);
    thctx.fillRect(136, y, 48, 16);
    thctx.fillRect(194, y + 6, 48, 16);
  }
  const tireTreadNormalMap = createNormalMapFromHeightCanvas(tireHeight, 3.6, maxAnisotropy);
  tireTreadNormalMap.repeat.set(1, 6);

  // ============================================================================
  // 9. Tree Bark Albedo & High-Altitude Atmospheric Cloud Layer Texture
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

  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 512;
  cloudCanvas.height = 512;
  const clctx = cloudCanvas.getContext('2d')!;
  clctx.clearRect(0, 0, 512, 512);
  for (let i = 0; i < 160; i++) {
    const cx = (i * 197) % 512;
    const cy = (i * 263) % 512;
    const r = 36 + ((i * 41) % 72);
    const g = clctx.createRadialGradient(cx, cy, 4, cx, cy, r);
    g.addColorStop(0, 'rgba(255, 252, 245, 0.22)');
    g.addColorStop(0.55, 'rgba(255, 248, 235, 0.09)');
    g.addColorStop(1, 'rgba(255, 248, 235, 0)');
    clctx.fillStyle = g;
    clctx.beginPath();
    clctx.arc(cx, cy, r, 0, Math.PI * 2);
    clctx.fill();
  }
  const cloudLayerMap = new THREE.CanvasTexture(cloudCanvas);
  cloudLayerMap.colorSpace = THREE.SRGBColorSpace;
  cloudLayerMap.wrapS = THREE.RepeatWrapping;
  cloudLayerMap.wrapT = THREE.RepeatWrapping;
  cloudLayerMap.repeat.set(3, 3);

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

  const updateCabinDisplays = (state: TruckPhysicsState, traffic: TrafficVehicle[]) => {
    const now = performance.now();
    if (now - lastCabinRedrawMs < 75) return;
    lastCabinRedrawMs = now;

    // --- A. Redraw High-Res 1st-Person Instrument Cluster (1024x512) ---
    dctx.fillStyle = '#070a10';
    dctx.fillRect(0, 0, 1024, 512);

    // Subtle carbon bezel frame
    dctx.strokeStyle = '#1e293b';
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
      isRpm: boolean
    ) => {
      // Outer metallic ring
      const ringGrad = dctx.createRadialGradient(cx, cy, r - 12, cx, cy, r + 8);
      ringGrad.addColorStop(0, '#0f172a');
      ringGrad.addColorStop(0.7, '#475569');
      ringGrad.addColorStop(1, '#1e293b');
      dctx.strokeStyle = ringGrad;
      dctx.lineWidth = 10;
      dctx.beginPath();
      dctx.arc(cx, cy, r, 0, Math.PI * 2);
      dctx.stroke();

      // Dial face
      dctx.fillStyle = '#0b111e';
      dctx.beginPath();
      dctx.arc(cx, cy, r - 6, 0, Math.PI * 2);
      dctx.fill();

      // Economy / Redline zones for Tachometer
      if (isRpm) {
        dctx.strokeStyle = '#10b981';
        dctx.lineWidth = 14;
        dctx.beginPath();
        dctx.arc(cx, cy, r - 18, Math.PI * 0.75 + 0.42 * Math.PI * 1.5, Math.PI * 0.75 + 0.68 * Math.PI * 1.5);
        dctx.stroke();

        dctx.strokeStyle = '#ef4444';
        dctx.beginPath();
        dctx.arc(cx, cy, r - 18, Math.PI * 0.75 + 0.84 * Math.PI * 1.5, Math.PI * 0.75 + 1.0 * Math.PI * 1.5);
        dctx.stroke();
      }

      // Tick marks & numbers
      dctx.textAlign = 'center';
      dctx.textBaseline = 'middle';
      for (let v = 0; v <= maxVal; v += step / 2) {
        const frac = v / maxVal;
        const ang = Math.PI * 0.75 + frac * Math.PI * 1.5;
        const isMajor = v % step === 0;
        const innerR = isMajor ? r - 30 : r - 20;
        dctx.strokeStyle = isMajor ? '#f8fafc' : '#64748b';
        dctx.lineWidth = isMajor ? 4 : 2;
        dctx.beginPath();
        dctx.moveTo(cx + Math.cos(ang) * innerR, cy + Math.sin(ang) * innerR);
        dctx.lineTo(cx + Math.cos(ang) * (r - 10), cy + Math.sin(ang) * (r - 10));
        dctx.stroke();

        if (isMajor) {
          dctx.fillStyle = '#e2e8f0';
          dctx.font = '700 24px "JetBrains Mono", monospace';
          const tx = cx + Math.cos(ang) * (r - 54);
          const ty = cy + Math.sin(ang) * (r - 54);
          dctx.fillText(String(v), tx, ty);
        }
      }

      // Labels
      dctx.fillStyle = '#94a3b8';
      dctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
      dctx.fillText(title, cx, cy + 56);
      dctx.fillStyle = '#38bdf8';
      dctx.font = '700 18px "JetBrains Mono", monospace';
      dctx.fillText(unit, cx, cy + 84);

      // Glowing Swept Needle on Canvas
      const clampedFrac = Math.max(0, Math.min(1, currentVal / maxVal));
      const needleAng = Math.PI * 0.75 + clampedFrac * Math.PI * 1.5;
      dctx.save();
      dctx.translate(cx, cy);
      dctx.rotate(needleAng);
      dctx.fillStyle = '#f97316';
      dctx.beginPath();
      dctx.moveTo(-18, -5);
      dctx.lineTo(r - 22, -2);
      dctx.lineTo(r - 22, 2);
      dctx.lineTo(-18, 5);
      dctx.closePath();
      dctx.fill();
      dctx.restore();

      // Center needle cap
      dctx.fillStyle = '#334155';
      dctx.beginPath();
      dctx.arc(cx, cy, 18, 0, Math.PI * 2);
      dctx.fill();
    };

    drawGauge(230, 260, 182, 'TACHOMETER', 'RPM x100', 25, 5, state.rpm / 100, true);
    drawGauge(794, 260, 182, 'SPEEDOMETER', 'KM/H', 120, 20, state.speedKmh, false);

    // Center Multi-Function Driver Information Display (MID)
    dctx.fillStyle = '#0f172a';
    dctx.fillRect(434, 48, 156, 416);
    dctx.strokeStyle = '#334155';
    dctx.lineWidth = 3;
    dctx.strokeRect(434, 48, 156, 416);

    // Top Turn Indicator & High Beam Telltales
    const leftOn = state.indicatorBlinkOn && (state.indicator === 'left' || state.indicator === 'hazard');
    const rightOn = state.indicatorBlinkOn && (state.indicator === 'right' || state.indicator === 'hazard');
    dctx.fillStyle = leftOn ? '#22c55e' : '#1e293b';
    dctx.font = '700 34px "JetBrains Mono", monospace';
    dctx.textAlign = 'center';
    dctx.fillText('◀', 462, 82);
    dctx.fillStyle = rightOn ? '#22c55e' : '#1e293b';
    dctx.fillText('▶', 562, 82);

    dctx.fillStyle = state.highBeamOn ? '#38bdf8' : state.headlightsOn ? '#4ade80' : '#334155';
    dctx.font = '700 18px "JetBrains Mono", monospace';
    dctx.fillText(state.highBeamOn ? 'HIGH BEAM' : state.headlightsOn ? 'LOW BEAM' : 'LIGHTS OFF', 512, 82);

    // Current Gear Readout Box
    dctx.fillStyle = '#1e293b';
    dctx.fillRect(450, 108, 124, 96);
    dctx.fillStyle = '#f59e0b';
    dctx.font = '700 54px "Chakra Petch", sans-serif';
    const gearLabels = ['R2', 'R1', 'N', '1L', '1H', '2L', '2H', '3L', '3H', '4L', '4H', '5L', '5H', '6L', '6H'];
    const gearStr = gearLabels[state.gearIndex + 2] || 'N';
    dctx.fillText(gearStr, 512, 160);
    dctx.fillStyle = '#94a3b8';
    dctx.font = '700 15px "JetBrains Mono", monospace';
    dctx.fillText(state.transmissionMode === 'auto' ? 'OPTICRUISE AUTO' : 'MANUAL SPLIT', 512, 192);

    // Digital Speed & Air Brake PSI
    dctx.fillStyle = '#f8fafc';
    dctx.font = '700 36px "JetBrains Mono", monospace';
    dctx.fillText(`${Math.round(state.speedKmh)}`, 512, 248);
    dctx.fillStyle = '#64748b';
    dctx.font = '600 14px "Plus Jakarta Sans", sans-serif';
    dctx.fillText('KM/H DIGITAL', 512, 274);

    // Air Pressure Bar
    dctx.fillStyle = state.airPressurePsi < 75 ? '#ef4444' : '#38bdf8';
    dctx.font = '700 20px "JetBrains Mono", monospace';
    dctx.fillText(`AIR ${Math.round(state.airPressurePsi)} PSI`, 512, 318);
    dctx.fillStyle = '#1e293b';
    dctx.fillRect(452, 334, 120, 12);
    dctx.fillStyle = state.airPressurePsi < 75 ? '#ef4444' : '#38bdf8';
    dctx.fillRect(452, 334, Math.min(120, (state.airPressurePsi / 120) * 120), 12);

    // Fuel & Odometer
    dctx.fillStyle = '#fbbf24';
    dctx.font = '700 18px "JetBrains Mono", monospace';
    dctx.fillText(`FUEL ${Math.round(state.fuelLiters)}L`, 512, 378);
    dctx.fillStyle = '#4ade80';
    dctx.fillText(`ODO ${(state.distanceAlongHighwayM / 1000).toFixed(2)} KM`, 512, 418);

    dashboardClusterMap.needsUpdate = true;

    // --- B. Redraw Live Center-Console GPS Navigation Display (512x384) ---
    gpsCtx.fillStyle = '#0b1520';
    gpsCtx.fillRect(0, 0, 512, 384);

    // Map grid lines
    gpsCtx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    gpsCtx.lineWidth = 1;
    for (let x = 0; x < 512; x += 48) {
      gpsCtx.beginPath();
      gpsCtx.moveTo(x, 0);
      gpsCtx.lineTo(x, 384);
      gpsCtx.stroke();
    }
    for (let y = 0; y < 384; y += 48) {
      gpsCtx.beginPath();
      gpsCtx.moveTo(0, y);
      gpsCtx.lineTo(512, y);
      gpsCtx.stroke();
    }

    // Draw NH-44 Highway Corridor Ribbon ahead & behind player
    const curS = state.distanceAlongHighwayM;
    const curSample = getRoadPointAtDistance(curS);
    const mapCenterX = 256;
    const mapCenterY = 275;
    const scalePxPerM = 0.85;

    gpsCtx.strokeStyle = '#334155';
    gpsCtx.lineWidth = 26;
    gpsCtx.lineCap = 'round';
    gpsCtx.beginPath();
    for (let ds = -120; ds <= 320; ds += 20) {
      const sample = getRoadPointAtDistance(Math.max(0, Math.min(HIGHWAY_LENGTH_M, curS + ds)));
      const dx = (sample.x - curSample.x) * scalePxPerM;
      const dy = -ds * scalePxPerM;
      if (ds === -120) gpsCtx.moveTo(mapCenterX + dx, mapCenterY + dy);
      else gpsCtx.lineTo(mapCenterX + dx, mapCenterY + dy);
    }
    gpsCtx.stroke();

    // Highlight active route spline in cyan/emerald
    gpsCtx.strokeStyle = '#10b981';
    gpsCtx.lineWidth = 6;
    gpsCtx.stroke();

    // Draw nearby AI traffic vehicles on GPS radar
    for (const tv of traffic) {
      const ds = tv.s - curS;
      if (ds > -110 && ds < 300) {
        const tx = mapCenterX + (tv.laneOffset - state.lateralOffsetM) * 1.8;
        const ty = mapCenterY - ds * scalePxPerM;
        gpsCtx.fillStyle = tv.direction === 1 ? '#38bdf8' : '#f59e0b';
        gpsCtx.fillRect(tx - 4, ty - 6, 8, 12);
      }
    }

    // Player Truck Chevron at mapCenter
    gpsCtx.fillStyle = '#f97316';
    gpsCtx.beginPath();
    gpsCtx.moveTo(mapCenterX, mapCenterY - 14);
    gpsCtx.lineTo(mapCenterX + 11, mapCenterY + 10);
    gpsCtx.lineTo(mapCenterX, mapCenterY + 4);
    gpsCtx.lineTo(mapCenterX - 11, mapCenterY + 10);
    gpsCtx.closePath();
    gpsCtx.fill();

    // Top Navigation Banner
    gpsCtx.fillStyle = '#065f46';
    gpsCtx.fillRect(0, 0, 512, 68);
    gpsCtx.fillStyle = '#facc15';
    gpsCtx.fillRect(14, 12, 68, 44);
    gpsCtx.fillStyle = '#18181b';
    gpsCtx.textAlign = 'center';
    gpsCtx.font = '700 22px "Chakra Petch", sans-serif';
    gpsCtx.fillText('NH-44', 48, 42);

    const nextStop =
      curS < 1350
        ? { name: 'SHAHBAD FLYOVER', distM: 1350 - curS }
        : curS < 2450
          ? { name: 'SHER-E-PUNJAB DHABA', distM: 2450 - curS }
          : curS < 3450
            ? { name: 'PIPLI INTERCHANGE', distM: 3450 - curS }
            : { name: 'KARNAL FASTAG TOLL', distM: Math.max(0, 4350 - curS) };

    gpsCtx.textAlign = 'left';
    gpsCtx.fillStyle = '#ffffff';
    gpsCtx.font = '700 22px "Plus Jakarta Sans", sans-serif';
    gpsCtx.fillText(nextStop.name, 98, 32);
    gpsCtx.fillStyle = '#a7f3d0';
    gpsCtx.font = '700 18px "JetBrains Mono", monospace';
    gpsCtx.fillText(
      `IN ${(nextStop.distM / 1000).toFixed(2)} KM  ·  REMAINING ${Math.max(0, (4350 - curS) / 1000).toFixed(2)} KM`,
      98,
      56
    );

    gpsNavMap.needsUpdate = true;
  };

  // Run initial draw so Frame 1 cabin gauges & GPS are populated immediately
  updateCabinDisplays(createInitialTruckState(60), []);

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

    // Authentic reflective NHAI highway emerald green with micro-grid retro-reflective sheen
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 256);
    bgGrad.addColorStop(0, '#047857');
    bgGrad.addColorStop(0.5, '#065f46');
    bgGrad.addColorStop(1, '#064e3b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 256);

    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, 1000, 232);

    // Yellow NH-44 Highway Shield Badge on Left
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

    // Primary Destination Headline
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 48px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(titleEn, 215, 94);

    // Hindi Devanagari Sub-line
    ctx.fillStyle = '#fde047';
    ctx.font = '600 34px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(titleHi, 215, 148);

    // Lane Guidance Arrows & Distances
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

  return {
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
    updateCabinDisplays,
    createGantrySignTexture,
    createMilestoneTexture,
  };
}
