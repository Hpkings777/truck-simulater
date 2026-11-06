import * as THREE from 'three';
import {
  getRoadPointAtDistance,
  HIGHWAY_LENGTH_M,
  MapCorridorId,
  setActiveMapId,
  splineToWorld,
} from '../physics/highwaySpline';
import { applyUltraMicroShaderToAsphalt, HighwayTextureSet } from './materialsAndTextures';
import { buildTrafficVehicleMesh } from './truckBuilder';

export interface HighwayEnvironmentHandles {
  root: THREE.Group;
  roadMat: THREE.MeshStandardMaterial;
  streetLightHeadsMat: THREE.MeshBasicMaterial;
  dhabaLightsMat: THREE.MeshBasicMaterial;
  ultraDetailGroup: THREE.Group;
  mapId: MapCorridorId;
}

/**
 * Computes the exact vertical terrain offset (relative to the road surface `roadY`)
 * at longitudinal distance `s` and signed lateral offset `signedLat` from the highway centerline.
 * Guarantees that within the highway deck & shoulder zone (`|signedLat| <= 17.2m`),
 * the terrain is strictly recessed below the asphalt and gravel embankment (`-0.55m`),
 * so grass/soil can NEVER poke through or phase onto the road surface on any curve or elevation.
 */
function getTerrainHeightOffsetAt(
  s: number,
  signedLat: number,
  roadY: number,
  mapId: MapCorridorId
): number {
  const absLat = Math.abs(signedLat);
  const safeClearanceLat = s > 2360 && s < 2540 && signedLat < 0 ? 44.0 : 17.2;

  if (absLat <= safeClearanceLat) {
    if (mapId === 'nh66_coastal' && roadY > 3.5) {
      return -roadY - 3.8; // Deep seabed under elevated sea-link bridge spans
    }
    return -0.58; // Strictly recessed 0.58m underneath the rigid road & shoulder deck
  }

  const extraDist = absLat - safeClearanceLat;

  if (mapId === 'nh48_ghats') {
    // WESTERN GHATS MOUNTAIN PASS:
    // Right side (signedLat > 0) rises steeply into a towering basalt cliff face (+38m above road)
    // Left side (signedLat < 0) drops into a misty mountain valley gorge (-16m) with distant mountain ridges
    if (signedLat > 0) {
      const cliffT = Math.min(1, extraDist / 58);
      const crag =
        Math.sin(s * 0.035 + signedLat * 0.04) * 3.8 +
        Math.cos(s * 0.08 - signedLat * 0.05) * 1.9;
      return -0.45 + cliffT * 38.0 + crag * Math.min(1, extraDist / 18);
    } else {
      const valleyT = Math.min(1, extraDist / 85);
      const ridgeRestore =
        extraDist > 135
          ? Math.pow((extraDist - 135) / 150, 1.32) * (28 + Math.sin(s * 0.018) * 12)
          : 0;
      return -0.55 - valleyT * 16.5 + ridgeRestore + Math.cos(signedLat * 0.025 + s * 0.02) * 1.8 * valleyT;
    }
  } else if (mapId === 'nh66_coastal') {
    // COASTAL ARABIAN SEA-LINK:
    const islandWave =
      Math.sin(s * 0.0045 + signedLat * 0.008) * 4.6 +
      Math.cos(s * 0.009 - signedLat * 0.012) * 2.8;
    const eastShoreRise =
      signedLat > 150 ? Math.min(34, (signedLat - 150) * 0.14) : 0;
    const targetWorldY = -3.6 + Math.max(0, islandWave - 2.3) + eastShoreRise;
    return targetWorldY - roadY;
  } else {
    // NH-44 GRAND TRUNK PLAINS:
    // Smooth embankment transition into flat alluvial farmland with distant Shivalik foothills
    const blendT = Math.min(1, extraDist / 95);
    const undulation =
      Math.sin(signedLat * 0.014 + s * 0.008) * 2.2 +
      Math.cos(signedLat * 0.028 - s * 0.016) * 1.1 +
      (extraDist > 240
        ? Math.pow((extraDist - 240) / 180, 1.4) *
          (14 + Math.sin(s * 0.011 + signedLat * 0.007) * 6.5)
        : 0);
    const targetWorldY = -0.48 + blendT * Math.max(0, undulation);
    return Math.min(-0.45, targetWorldY - roadY);
  }
}

/**
 * Merges an array of non-indexed or indexed BufferGeometries into a single BufferGeometry
 * so InstancedMesh can render complex multi-bough organic trees or multi-part structures in 1 draw call.
 */
function mergeBufferGeometriesSimple(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  const nonIndexed = geos.map((g) => {
    const ni = g.index ? g.toNonIndexed() : g.clone();
    totalVerts += ni.attributes.position.count;
    return ni;
  });

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  let offset = 0;

  for (const g of nonIndexed) {
    const pos = g.attributes.position.array as Float32Array;
    const norm = g.attributes.normal.array as Float32Array;
    positions.set(pos, offset);
    normals.set(norm, offset);
    offset += pos.length;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return merged;
}

/**
 * Generates a genuinely distinct 5.0 km 3D Indian highway environment based on `mapId` (R8 & R9):
 * - `nh44_plains`: NH-44 Grand Trunk Plains (Ambala -> Karnal, Haryana) — Alluvial farmland, brick kilns, Eucalyptus trees, flyovers.
 * - `nh48_ghats`: NH-48 Western Ghats Mountain Pass (Khandala -> Lonavala Bhor Ghat, Maharashtra) — Winding S-curves, towering dark-basalt cliff walls, 2 rock-cut mountain tunnels with interior lighting, cliffside waterfalls, and dense tropical Ghat jungle.
 * - `nh66_coastal`: NH-66 Coastal Arabian Sea-Link (Worli -> Bandra / Konkan Causeway, Mumbai) — Shimmering Arabian Sea water expanse, monumental twin-tower cable-stayed suspension bridge pylons with fan stay cables, coastal tetrapod seawall, and coconut palms.
 */
export function buildHighwayEnvironment(
  textures: HighwayTextureSet,
  isSoftwareGl: boolean,
  mapId: MapCorridorId = 'nh44_plains'
): HighwayEnvironmentHandles {
  setActiveMapId(mapId);
  const root = new THREE.Group();
  const ultraDetailGroup = new THREE.Group();
  root.add(ultraDetailGroup);

  const segments = 1000; // 1 segment every 5 meters across 5,000 meters
  const stepS = HIGHWAY_LENGTH_M / segments;

  // ============================================================================
  // 1. Continuous 4-Lane Highway Asphalt Ribbon, Shoulders, Embankment & Median Barrier
  // ============================================================================
  const roadHalfWidth = 12.4;
  const embankmentExtraWidth = 4.2;

  const roadPositions = new Float32Array((segments + 1) * 4 * 3);
  const roadUvs = new Float32Array((segments + 1) * 4 * 2);
  const roadIndices = new Uint32Array(segments * 18);

  const barrierHalfWidth = 0.65;
  const barrierHeight = 0.96;
  const barrierPositions = new Float32Array((segments + 1) * 4 * 3);
  const barrierUvs = new Float32Array((segments + 1) * 4 * 2);
  const barrierIndices = new Uint32Array(segments * 18);

  const grPositions = new Float32Array((segments + 1) * 4 * 3);
  const grUvs = new Float32Array((segments + 1) * 4 * 2);
  const grIndices = new Uint32Array(segments * 12);

  for (let i = 0; i <= segments; i++) {
    const s = i * stepS;
    const sample = getRoadPointAtDistance(s);
    const widthScale = sample.isTollPlaza ? 1.28 : 1.0;
    const hw = roadHalfWidth * widthScale;

    const farLeftPt = splineToWorld(s, -(hw + embankmentExtraWidth), -0.42);
    const leftPt = splineToWorld(s, -hw, 0.02);
    const rightPt = splineToWorld(s, hw, 0.02);
    const farRightPt = splineToWorld(s, hw + embankmentExtraWidth, -0.42);

    const vBase = i * 12;
    roadPositions.set(
      [
        farLeftPt.x, farLeftPt.y, farLeftPt.z,
        leftPt.x, leftPt.y, leftPt.z,
        rightPt.x, rightPt.y, rightPt.z,
        farRightPt.x, farRightPt.y, farRightPt.z,
      ],
      vBase
    );

    const uvBase = i * 8;
    const vCoord = s / 18;
    roadUvs.set([0.0, vCoord, 0.0, vCoord, 1.0, vCoord, 1.0, vCoord], uvBase);

    if (i < segments) {
      const idx = i * 18;
      const r0 = i * 4;
      const r1 = (i + 1) * 4;
      roadIndices.set(
        [
          r0 + 0, r0 + 1, r1 + 0,
          r0 + 1, r1 + 1, r1 + 0,
          r0 + 1, r0 + 2, r1 + 1,
          r0 + 2, r1 + 2, r1 + 1,
          r0 + 2, r0 + 3, r1 + 2,
          r0 + 3, r1 + 3, r1 + 2,
        ],
        idx
      );
    }

    const bLowL = splineToWorld(s, -barrierHalfWidth, 0.02);
    const bTopL = splineToWorld(s, -barrierHalfWidth * 0.42, barrierHeight);
    const bTopR = splineToWorld(s, barrierHalfWidth * 0.42, barrierHeight);
    const bLowR = splineToWorld(s, barrierHalfWidth, 0.02);

    barrierPositions.set(
      [
        bLowL.x, bLowL.y, bLowL.z,
        bTopL.x, bTopL.y, bTopL.z,
        bTopR.x, bTopR.y, bTopR.z,
        bLowR.x, bLowR.y, bLowR.z,
      ],
      vBase
    );

    const bv = s / 4;
    barrierUvs.set([0, bv, 0.35, bv, 0.65, bv, 1, bv], uvBase);

    if (i < segments) {
      const bi = i * 18;
      const r0 = i * 4;
      const r1 = (i + 1) * 4;
      barrierIndices.set(
        [
          r0 + 0, r0 + 1, r1 + 0,
          r0 + 1, r1 + 1, r1 + 0,
          r0 + 1, r0 + 2, r1 + 1,
          r0 + 2, r1 + 2, r1 + 1,
          r0 + 2, r0 + 3, r1 + 2,
          r0 + 3, r1 + 3, r1 + 2,
        ],
        bi
      );
    }

    const isDhabaEntrance = s > 2385 && s < 2515;
    const grLowY = isDhabaEntrance ? -1.5 : 0.48;
    const grHighY = isDhabaEntrance ? -1.2 : 0.82;
    const gLLow = splineToWorld(s, -hw + 0.18, grLowY);
    const gLHigh = splineToWorld(s, -hw + 0.18, grHighY);
    const gRHigh = splineToWorld(s, hw - 0.18, grHighY);
    const gRLow = splineToWorld(s, hw - 0.18, grLowY);

    grPositions.set(
      [
        gLLow.x, gLLow.y, gLLow.z,
        gLHigh.x, gLHigh.y, gLHigh.z,
        gRHigh.x, gRHigh.y, gRHigh.z,
        gRLow.x, gRLow.y, gRLow.z,
      ],
      vBase
    );
    const gv = s / 4;
    grUvs.set([gv, 0, gv, 1, gv, 1, gv, 0], uvBase);

    if (i < segments) {
      const gi = i * 12;
      const r0 = i * 4;
      const r1 = (i + 1) * 4;
      grIndices.set(
        [
          r0 + 0, r0 + 1, r1 + 0,
          r0 + 1, r1 + 1, r1 + 0,
          r0 + 2, r0 + 3, r1 + 2,
          r0 + 3, r1 + 3, r1 + 2,
        ],
        gi
      );
    }
  }

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.BufferAttribute(roadPositions, 3));
  roadGeo.setAttribute('uv', new THREE.BufferAttribute(roadUvs, 2));
  roadGeo.setIndex(new THREE.BufferAttribute(roadIndices, 1));
  roadGeo.computeVertexNormals();

  // Map-specific asphalt tint so road surface character shifts noticeably per region
  const roadColorHex =
    mapId === 'nh48_ghats'
      ? 0xd6d3d1 // Wet dark basalt-aggregate Ghat asphalt
      : mapId === 'nh66_coastal'
        ? 0xe2e8f0 // Sun-bleached coastal concrete-asphalt causeway deck
        : 0xffffff; // Classic North Indian NH-44 highway bitumen

  const roadMat = new THREE.MeshStandardMaterial({
    color: roadColorHex,
    map: textures.asphaltMap,
    normalMap: textures.asphaltNormalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: textures.asphaltRoughnessMap,
    roughness: mapId === 'nh48_ghats' ? 0.78 : 1.0,
    metalness: mapId === 'nh48_ghats' ? 0.18 : 0.1,
  });
  if (!isSoftwareGl) {
    applyUltraMicroShaderToAsphalt(roadMat);
  }
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = !isSoftwareGl;
  root.add(roadMesh);

  const barrierGeo = new THREE.BufferGeometry();
  barrierGeo.setAttribute('position', new THREE.BufferAttribute(barrierPositions, 3));
  barrierGeo.setAttribute('uv', new THREE.BufferAttribute(barrierUvs, 2));
  barrierGeo.setIndex(new THREE.BufferAttribute(barrierIndices, 1));
  barrierGeo.computeVertexNormals();

  const barrierMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.concreteMap,
    normalMap: textures.concreteNormalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 0.82,
    metalness: 0.06,
  });
  const barrierMesh = new THREE.Mesh(barrierGeo, barrierMat);
  barrierMesh.castShadow = !isSoftwareGl;
  barrierMesh.receiveShadow = !isSoftwareGl;
  root.add(barrierMesh);

  const grGeo = new THREE.BufferGeometry();
  grGeo.setAttribute('position', new THREE.BufferAttribute(grPositions, 3));
  grGeo.setAttribute('uv', new THREE.BufferAttribute(grUvs, 2));
  grGeo.setIndex(new THREE.BufferAttribute(grIndices, 1));
  grGeo.computeVertexNormals();

  const grMat = new THREE.MeshStandardMaterial({
    color: mapId === 'nh48_ghats' ? 0xfacc15 : 0xffffff, // High-visibility yellow safety barriers on Western Ghats!
    map: textures.guardrailMap,
    normalMap: textures.guardrailNormalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    metalness: 0.72,
    roughness: 0.34,
    side: THREE.DoubleSide,
  });
  const grMesh = new THREE.Mesh(grGeo, grMat);
  root.add(grMesh);

  // Instanced Steel Guardrail Posts along both shoulders
  const grPostCount = 1000;
  const grPostGeo = new THREE.BoxGeometry(0.1, 0.85, 0.14);
  grPostGeo.translate(0, 0.42, 0);
  const galvSteelMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.72,
    roughness: 0.32,
  });
  const grPostInst = new THREE.InstancedMesh(grPostGeo, galvSteelMat, grPostCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < grPostCount; i++) {
    const s = Math.floor(i / 2) * 10 + 5;
    const side = i % 2 === 0 ? -1 : 1;
    const sample = getRoadPointAtDistance(s);
    const hw = roadHalfWidth * (sample.isTollPlaza ? 1.28 : 1.0);
    if (side === -1 && s > 2385 && s < 2515) {
      dummy.scale.set(0, 0, 0);
    } else {
      const pPos = splineToWorld(s, side * (hw - 0.12), 0);
      dummy.position.set(pPos.x, pPos.y, pPos.z);
      dummy.rotation.set(0, -pPos.sample.heading, 0);
      dummy.scale.set(1, 1, 1);
    }
    dummy.updateMatrix();
    grPostInst.setMatrixAt(i, dummy.matrix);
  }
  grPostInst.instanceMatrix.needsUpdate = true;
  grPostInst.computeBoundingSphere();
  root.add(grPostInst);

  // ============================================================================
  // 2. Spline-Locked Curvilinear 3D Terrain Ribbon Mesh & Horizon Ring
  //    (Guaranteed 0% grass/soil road intrusion on any curve or elevation)
  // ============================================================================
  const lateralProfile = [
    -950, -520, -260, -110, -68, -50, -38, -29, -22, -17.2, -12.6,
    12.6, 17.2, 22, 29, 38, 50, 68, 110, 260, 520, 950,
  ];
  const numLatCols = lateralProfile.length;
  const numLongRows = 540; // Every ~10m from s = -160m to HIGHWAY_LENGTH_M + 200m
  const terrainStartS = -160;
  const terrainEndS = HIGHWAY_LENGTH_M + 200;
  const terrainSpanS = terrainEndS - terrainStartS;
  const terrainVertCount = (numLongRows + 1) * numLatCols;
  const terrainPositions = new Float32Array(terrainVertCount * 3);
  const terrainUvs = new Float32Array(terrainVertCount * 2);
  const terrainIndices = new Uint32Array(numLongRows * (numLatCols - 1) * 6);

  for (let r = 0; r <= numLongRows; r++) {
    const rawS = terrainStartS + (r / numLongRows) * terrainSpanS;
    const clampedS = Math.max(0, Math.min(HIGHWAY_LENGTH_M, rawS));
    const extraS = rawS - clampedS;
    const sample = getRoadPointAtDistance(clampedS);
    const widthScale = sample.isTollPlaza ? 1.28 : 1.0;
    const fwdX = Math.sin(sample.heading);
    const fwdZ = -Math.cos(sample.heading);

    for (let c = 0; c < numLatCols; c++) {
      const baseLat = lateralProfile[c];
      const effectiveLat =
        Math.abs(baseLat) < 30 ? baseLat * widthScale : baseLat;
      const dy = getTerrainHeightOffsetAt(clampedS, effectiveLat, sample.y, mapId);
      const wp = splineToWorld(clampedS, effectiveLat, dy);

      const vIdx = (r * numLatCols + c) * 3;
      terrainPositions[vIdx] = wp.x + fwdX * extraS;
      terrainPositions[vIdx + 1] = wp.y;
      terrainPositions[vIdx + 2] = wp.z + fwdZ * extraS;

      const uvIdx = (r * numLatCols + c) * 2;
      terrainUvs[uvIdx] = (effectiveLat + 950) / 1900;
      terrainUvs[uvIdx + 1] = (rawS - terrainStartS) / terrainSpanS;
    }

    if (r < numLongRows) {
      for (let c = 0; c < numLatCols - 1; c++) {
        const iBase = (r * (numLatCols - 1) + c) * 6;
        const a = r * numLatCols + c;
        const b = a + 1;
        const d = (r + 1) * numLatCols + c;
        const e = d + 1;
        // (b - a) is +X, (d - a) is -Z -> (b - a) x (d - a) = +Y upward normal!
        terrainIndices[iBase] = a;
        terrainIndices[iBase + 1] = b;
        terrainIndices[iBase + 2] = d;
        terrainIndices[iBase + 3] = b;
        terrainIndices[iBase + 4] = e;
        terrainIndices[iBase + 5] = d;
      }
    }
  }

  const groundPlaneGeo = new THREE.BufferGeometry();
  groundPlaneGeo.setAttribute('position', new THREE.BufferAttribute(terrainPositions, 3));
  groundPlaneGeo.setAttribute('uv', new THREE.BufferAttribute(terrainUvs, 2));
  groundPlaneGeo.setIndex(new THREE.BufferAttribute(terrainIndices, 1));
  groundPlaneGeo.computeVertexNormals();

  const terrainTintHex =
    mapId === 'nh48_ghats'
      ? 0x4d7c5d // Deep emerald Deccan basalt & moss-covered Ghat slopes
      : mapId === 'nh66_coastal'
        ? 0xd6c79c // Golden Konkan coastal sandbars & laterite shore
        : 0xffffff; // Alluvial North Indian plains

  const groundPlaneMat = new THREE.MeshStandardMaterial({
    color: terrainTintHex,
    map: textures.terrainMap,
    normalMap: textures.terrainNormalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.9,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const groundPlane = new THREE.Mesh(groundPlaneGeo, groundPlaneMat);
  groundPlane.receiveShadow = !isSoftwareGl;
  root.add(groundPlane);

  // Shimmering Arabian Sea Water Expanse for `nh66_coastal`
  if (mapId === 'nh66_coastal') {
    const seaGeo = new THREE.PlaneGeometry(2600, HIGHWAY_LENGTH_M + 1600, 32, 64);
    seaGeo.rotateX(-Math.PI / 2);
    const seaMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      normalMap: textures.asphaltNormalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.16,
      metalness: 0.68,
    });
    const seaMesh = new THREE.Mesh(seaGeo, seaMat);
    seaMesh.position.set(0, -1.35, -HIGHWAY_LENGTH_M * 0.5);
    root.add(seaMesh);

    // Coastal Concrete Tetrapod Seawall Armor along both sides of the causeway
    const podCount = 460;
    const podArm1 = new THREE.CylinderGeometry(0.22, 0.35, 1.6, 6);
    const podArm2 = new THREE.CylinderGeometry(0.22, 0.35, 1.6, 6);
    podArm2.rotateZ(1.9);
    const podArm3 = new THREE.CylinderGeometry(0.22, 0.35, 1.6, 6);
    podArm3.rotateX(1.9);
    const tetrapodGeo = mergeBufferGeometriesSimple([podArm1, podArm2, podArm3]);
    const tetrapodInst = new THREE.InstancedMesh(tetrapodGeo, barrierMat, podCount);
    for (let i = 0; i < podCount; i++) {
      const s = (i * 10.8) % HIGHWAY_LENGTH_M;
      const side = i % 2 === 0 ? -1 : 1;
      const pPos = splineToWorld(s, side * (15.4 + (i % 3) * 1.1), -0.85);
      dummy.position.set(pPos.x, Math.min(0.2, pPos.y), pPos.z);
      dummy.rotation.set(i * 0.7, i * 1.3, i * 0.5);
      dummy.scale.setScalar(0.95 + (i % 3) * 0.18);
      dummy.updateMatrix();
      tetrapodInst.setMatrixAt(i, dummy.matrix);
    }
    tetrapodInst.instanceMatrix.needsUpdate = true;
    tetrapodInst.computeBoundingSphere();
    root.add(tetrapodInst);
  }

  // 360° Distant Horizon Mountain Range Ring (Tailored height & palette per map)
  const mountainSegs = 96;
  const mountainRadiusX = 1650;
  const mountainRadiusZ = 3400;
  const mountainPositions = new Float32Array((mountainSegs + 1) * 2 * 3);
  const mountainColors = new Float32Array((mountainSegs + 1) * 2 * 3);
  const mountainIndices = new Uint32Array(mountainSegs * 6);

  for (let m = 0; m <= mountainSegs; m++) {
    const ang = (m / mountainSegs) * Math.PI * 2;
    const mx = Math.cos(ang) * mountainRadiusX;
    const mz = -HIGHWAY_LENGTH_M * 0.5 + Math.sin(ang) * mountainRadiusZ;
    const heightMult = mapId === 'nh48_ghats' ? 2.4 : mapId === 'nh66_coastal' ? 0.55 : 1.0;
    const peakHeight =
      (22 +
        Math.abs(Math.sin(ang * 7.0)) * 38 +
        Math.abs(Math.cos(ang * 13.0 + 1.2)) * 22 +
        Math.sin(ang * 3.0) * 12) *
      heightMult;

    const vIdx = m * 6;
    mountainPositions[vIdx] = mx;
    mountainPositions[vIdx + 1] = -4;
    mountainPositions[vIdx + 2] = mz;
    mountainPositions[vIdx + 3] = mx * 1.03;
    mountainPositions[vIdx + 4] = peakHeight;
    mountainPositions[vIdx + 5] = mz * 1.02;

    if (mapId === 'nh48_ghats') {
      mountainColors.set([0.12, 0.24, 0.16, 0.25, 0.38, 0.31], vIdx);
    } else if (mapId === 'nh66_coastal') {
      mountainColors.set([0.14, 0.32, 0.44, 0.38, 0.52, 0.62], vIdx);
    } else {
      mountainColors.set([0.24, 0.27, 0.25, 0.38, 0.42, 0.46], vIdx);
    }

    if (m < mountainSegs) {
      const ii = m * 6;
      const a = m * 2;
      mountainIndices.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], ii);
    }
  }
  const mountainGeo = new THREE.BufferGeometry();
  mountainGeo.setAttribute('position', new THREE.BufferAttribute(mountainPositions, 3));
  mountainGeo.setAttribute('color', new THREE.BufferAttribute(mountainColors, 3));
  mountainGeo.setIndex(new THREE.BufferAttribute(mountainIndices, 1));
  mountainGeo.computeVertexNormals();

  const mountainMesh = new THREE.Mesh(
    mountainGeo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })
  );
  root.add(mountainMesh);

  // ============================================================================
  // 3. Multi-Bough Organic Trees / Tropical Ghat Jungle / Coastal Coconut Palms
  // ============================================================================
  const treeCount = mapId === 'nh48_ghats' ? 920 : mapId === 'nh66_coastal' ? 460 : 780;

  const mainTrunk = new THREE.CylinderGeometry(
    mapId === 'nh66_coastal' ? 0.14 : 0.18,
    mapId === 'nh66_coastal' ? 0.28 : 0.38,
    mapId === 'nh66_coastal' ? 5.6 : 3.6,
    8
  );
  mainTrunk.translate(0, mapId === 'nh66_coastal' ? 2.8 : 1.8, 0);
  const limb1 = new THREE.CylinderGeometry(0.1, 0.18, 2.4, 6);
  limb1.rotateZ(0.42);
  limb1.translate(-0.55, 3.9, 0.15);
  const limb2 = new THREE.CylinderGeometry(0.1, 0.17, 2.3, 6);
  limb2.rotateZ(-0.38);
  limb2.rotateX(0.25);
  limb2.translate(0.52, 3.8, -0.25);
  const limb3 = new THREE.CylinderGeometry(0.09, 0.15, 2.1, 6);
  limb3.rotateX(-0.44);
  limb3.translate(0.05, 4.0, 0.55);

  const compositeTrunkGeo = mergeBufferGeometriesSimple([mainTrunk, limb1, limb2, limb3]);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x6b533e,
    map: textures.barkMap,
    roughness: 0.92,
  });
  const trunkInst = new THREE.InstancedMesh(compositeTrunkGeo, trunkMat, treeCount);

  const makeLeafCluster = (rx: number, ry: number, rz: number, tx: number, ty: number, tz: number) => {
    const g = new THREE.IcosahedronGeometry(1.75, 2);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k);
      const y = p.getY(k);
      const z = p.getZ(k);
      const n = 1 + Math.sin(x * 3.1 + y * 2.7) * 0.16 + Math.cos(z * 3.5 - x * 2.1) * 0.14;
      p.setXYZ(k, x * rx * n, y * ry * n, z * rz * n);
    }
    g.computeVertexNormals();
    g.translate(tx, ty, tz);
    return g;
  };

  const compositeCanopyGeo = mergeBufferGeometriesSimple(
    mapId === 'nh66_coastal'
      ? [
          // Wide coastal coconut palm frond crown clusters
          makeLeafCluster(1.65, 0.42, 0.65, 0, 5.7, 0),
          makeLeafCluster(0.65, 0.42, 1.65, 0, 5.7, 0),
          makeLeafCluster(1.35, 0.38, 1.35, 0, 5.95, 0),
        ]
      : [
          makeLeafCluster(1.25, 0.92, 1.2, 0, 6.2, 0),
          makeLeafCluster(1.05, 0.82, 1.05, -1.25, 4.9, 0.35),
          makeLeafCluster(1.08, 0.85, 1.02, 1.18, 5.1, -0.42),
          makeLeafCluster(0.95, 0.78, 1.1, 0.15, 5.2, 1.15),
        ]
  );
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.84,
    metalness: 0.02,
  });
  const canopyInst = new THREE.InstancedMesh(compositeCanopyGeo, canopyMat, treeCount);
  canopyInst.castShadow = !isSoftwareGl;

  const color = new THREE.Color();
  for (let i = 0; i < treeCount; i++) {
    const s = ((i * 33.7) % (HIGHWAY_LENGTH_M - 80)) + 30;
    const side = i % 2 === 0 ? -1 : 1;
    const isDhabaZone = side === -1 && s > 2350 && s < 2540;
    const isTollZone = s > 4250 && s < 4450;
    // Keep all trees strictly outside the embankment & guardrail (at least 19.5m from centerline)
    const minRowDepth = isDhabaZone ? 46 : isTollZone ? 24 : 19.5;
    const rowDepth = minRowDepth + ((i * 19) % 54);
    const signedLat = side * rowDepth;
    const sample = getRoadPointAtDistance(s);
    const dy = getTerrainHeightOffsetAt(s, signedLat, sample.y, mapId);
    const pos = splineToWorld(s, signedLat, dy);

    // On coastal map, place coconut palms only along the eastern causeway berm (never in open ocean water)
    if (mapId === 'nh66_coastal' && (side === -1 || rowDepth > 28 || pos.sample.y > 4.2)) {
      dummy.scale.set(0, 0, 0);
    } else {
      const scale = 0.78 + ((i * 13) % 44) * 0.014;
      dummy.position.set(pos.x, pos.y - 0.15, pos.z);
      dummy.rotation.set(
        mapId === 'nh66_coastal' ? 0.14 : 0,
        (i * 1.9) % (Math.PI * 2),
        mapId === 'nh66_coastal' ? side * 0.12 : 0
      );
      dummy.scale.set(scale, scale * (0.88 + (i % 5) * 0.09), scale);
    }
    dummy.updateMatrix();

    trunkInst.setMatrixAt(i, dummy.matrix);
    canopyInst.setMatrixAt(i, dummy.matrix);

    const hue =
      mapId === 'nh48_ghats'
        ? 0.31 + ((i * 7) % 10) * 0.008 // Deep lush tropical Western Ghats jungle green
        : mapId === 'nh66_coastal'
          ? 0.28 + ((i * 5) % 8) * 0.009 // Tropical palm frond green
          : 0.24 + ((i * 7) % 12) * 0.008;
    const sat = mapId === 'nh48_ghats' ? 0.58 : 0.44 + ((i * 11) % 9) * 0.022;
    const lum = 0.14 + ((i * 5) % 10) * 0.012;
    color.setHSL(hue, sat, lum);
    canopyInst.setColorAt(i, color);
  }
  trunkInst.instanceMatrix.needsUpdate = true;
  canopyInst.instanceMatrix.needsUpdate = true;
  if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  canopyInst.computeBoundingSphere();
  root.add(trunkInst);
  root.add(canopyInst);

  // Median Oleander Shrubs along the central concrete divider
  const shrubCount = 350;
  const shrubGeo = makeLeafCluster(0.45, 0.58, 0.68, 0, 1.32, 0);
  const shrubMat = new THREE.MeshStandardMaterial({
    color: mapId === 'nh48_ghats' ? 0x15803d : 0x29491e,
    roughness: 0.86,
  });
  const shrubInst = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubCount);

  for (let i = 0; i < shrubCount; i++) {
    const s = i * 14.0 + 18;
    const pos = splineToWorld(s, 0, 0);
    if (pos.sample.isTollPlaza || pos.sample.isTunnel) {
      dummy.scale.set(0, 0, 0);
    } else {
      const sc = 0.82 + (i % 4) * 0.12;
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, -pos.sample.heading + (i % 3) * 0.3, 0);
      dummy.scale.set(sc, sc, sc);
    }
    dummy.updateMatrix();
    shrubInst.setMatrixAt(i, dummy.matrix);
  }
  shrubInst.instanceMatrix.needsUpdate = true;
  shrubInst.computeBoundingSphere();
  root.add(shrubInst);

  // ============================================================================
  // 4. Instanced Dual-Arm Highway Cobra LED Streetlights & Reflective Cat's-Eyes
  // ============================================================================
  const poleCount = 112;
  const poleShaft = new THREE.CylinderGeometry(0.1, 0.17, 9.4, 8);
  poleShaft.translate(0, 4.7, 0);
  const leftArm = new THREE.CylinderGeometry(0.045, 0.06, 2.2, 6);
  leftArm.rotateZ(Math.PI / 2 - 0.22);
  leftArm.translate(-1.02, 9.25, 0);
  const rightArm = new THREE.CylinderGeometry(0.045, 0.06, 2.2, 6);
  rightArm.rotateZ(-(Math.PI / 2 - 0.22));
  rightArm.translate(1.02, 9.25, 0);

  const compositePoleGeo = mergeBufferGeometriesSimple([poleShaft, leftArm, rightArm]);
  const poleInst = new THREE.InstancedMesh(compositePoleGeo, galvSteelMat, poleCount);

  const streetLightHeadsMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const headGeo = new THREE.BoxGeometry(4.4, 0.09, 0.36);
  headGeo.translate(0, 9.42, 0);
  const headInst = new THREE.InstancedMesh(headGeo, streetLightHeadsMat, poleCount);

  for (let i = 0; i < poleCount; i++) {
    const s = i * 44 + 28;
    const pos = splineToWorld(s, 0, 0);
    if (pos.sample.isTunnel) {
      dummy.scale.set(0, 0, 0);
    } else {
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, -pos.sample.heading, 0);
      dummy.scale.set(1, 1, 1);
    }
    dummy.updateMatrix();
    poleInst.setMatrixAt(i, dummy.matrix);
    headInst.setMatrixAt(i, dummy.matrix);
  }
  poleInst.instanceMatrix.needsUpdate = true;
  headInst.instanceMatrix.needsUpdate = true;
  poleInst.computeBoundingSphere();
  headInst.computeBoundingSphere();
  root.add(poleInst);
  root.add(headInst);

  // Reflective Road Studs (Cat's Eyes) along lane dividers & shoulder edges
  const studCount = 600;
  const studGeo = new THREE.BoxGeometry(0.14, 0.045, 0.18);
  const studMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
  const studInst = new THREE.InstancedMesh(studGeo, studMat, studCount);
  for (let i = 0; i < studCount; i++) {
    const s = Math.floor(i / 2) * 16 + 6;
    const lat = i % 2 === 0 ? -5.75 : -1.85;
    const pos = splineToWorld(s, lat, 0.04);
    dummy.position.set(pos.x, pos.y, pos.z);
    dummy.rotation.set(0, -pos.sample.heading, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    studInst.setMatrixAt(i, dummy.matrix);
  }
  studInst.instanceMatrix.needsUpdate = true;
  studInst.computeBoundingSphere();
  root.add(studInst);

  // ============================================================================
  // 5. MAP-SPECIFIC SIGNATURE MEGA-LANDMARKS (R8 & R9)
  // ============================================================================
  const hazardMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.hazardConcreteMap,
    normalMap: textures.concreteNormalMap,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.68,
  });

  if (mapId === 'nh48_ghats') {
    // --------------------------------------------------------------------------
    // NH-48 WESTERN GHATS: Rock-Cut Highway Tunnels, Basalt Cliff Walls & Waterfalls
    // --------------------------------------------------------------------------
    const basaltRockMat = new THREE.MeshStandardMaterial({
      color: 0x292524,
      map: textures.concreteMap,
      normalMap: textures.concreteNormalMap,
      roughness: 0.92,
      metalness: 0.08,
    });
    const tunnelSodiumMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

    const buildMountainTunnel = (startS: number, endS: number) => {
      for (let s = startS; s <= endS; s += 15) {
        const center = splineToWorld(s, 0, 0);
        const tunnelSegGroup = new THREE.Group();
        tunnelSegGroup.position.set(center.x, center.y, center.z);
        tunnelSegGroup.rotation.set(-center.sample.grade, -center.sample.heading, 0, 'YXZ');

        // Left & Right concrete-lined basalt tunnel walls
        for (const side of [-1, 1]) {
          const wall = new THREE.Mesh(new THREE.BoxGeometry(2.8, 8.6, 15.6), basaltRockMat);
          wall.position.set(side * 13.8, 4.3, 0);
          tunnelSegGroup.add(wall);
        }
        // Vaulted rock-cut over-arch roof slab with overburden mountain crest
        const roofArch = new THREE.Mesh(new THREE.BoxGeometry(30.4, 6.5, 15.6), basaltRockMat);
        roofArch.position.set(0, 10.6, 0);
        tunnelSegGroup.add(roofArch);

        // Portal Concrete Collar & Hazard Stripes at entry/exit
        if (s === startS || s + 15 > endS) {
          const portalCollar = new THREE.Mesh(new THREE.BoxGeometry(31.2, 1.4, 2.2), hazardMat);
          portalCollar.position.set(0, 8.1, 0);
          tunnelSegGroup.add(portalCollar);
        }

        // Twin ceiling amber Sodium-Vapor tunnel luminaires
        for (const lx of [-5.5, 5.5]) {
          const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.18, 3.2), tunnelSodiumMat);
          lamp.position.set(lx, 7.25, 0);
          tunnelSegGroup.add(lamp);
        }

        root.add(tunnelSegGroup);
      }
    };
    buildMountainTunnel(320, 520); // Khopoli Approach Rock Gallery Tunnel 1
    buildMountainTunnel(1150, 1450); // Bhatan / Khandala Tunnel 2
    buildMountainTunnel(2850, 3150); // Monkey Hill Rock Gallery Tunnel 3

    // Towering Roadside Basalt Outcrops & Cascading White-Water Ghat Waterfalls
    const waterfallFoamMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.85,
    });
    for (let s = 180; s < HIGHWAY_LENGTH_M - 200; s += 220) {
      const cliffPos = splineToWorld(s, 22.5, 0);
      const outcropGroup = new THREE.Group();
      outcropGroup.position.set(cliffPos.x, cliffPos.y, cliffPos.z);
      outcropGroup.rotation.y = -cliffPos.sample.heading;

      const cragTower = new THREE.Mesh(
        new THREE.DodecahedronGeometry(9.5, 1),
        basaltRockMat
      );
      cragTower.scale.set(1.1, 2.6, 1.3);
      cragTower.position.set(6, 14, 0);
      outcropGroup.add(cragTower);

      // Every 2nd outcrop features a cascading monsoon waterfall down the basalt face
      if (Math.round(s / 220) % 2 === 0) {
        const cascade = new THREE.Mesh(
          new THREE.PlaneGeometry(3.4, 26.0),
          waterfallFoamMat
        );
        cascade.position.set(-1.2, 13.0, 0);
        cascade.rotation.y = -Math.PI / 2;
        cascade.rotation.z = -0.18;
        outcropGroup.add(cascade);

        const mistPool = new THREE.Mesh(
          new THREE.CylinderGeometry(3.2, 3.6, 0.35, 12),
          waterfallFoamMat
        );
        mistPool.position.set(-3.2, 0.15, 0);
        outcropGroup.add(mistPool);
      }
      root.add(outcropGroup);
    }
  } else if (mapId === 'nh66_coastal') {
    // --------------------------------------------------------------------------
    // NH-66 COASTAL ARABIAN SEA-LINK: Monumental Cable-Stayed Bridge Pylons & Fan Stay Cables
    // --------------------------------------------------------------------------
    const pylonConcreteMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      map: textures.concreteMap,
      roughness: 0.55,
      metalness: 0.15,
    });
    const stayCableMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.65,
      roughness: 0.3,
    });

    const buildCableStayedSpan = (pylonS: number) => {
      const center = splineToWorld(pylonS, 0, 0);
      const pylonGroup = new THREE.Group();
      pylonGroup.position.set(center.x, 0, center.z);
      pylonGroup.rotation.y = -center.sample.heading;

      // Twin inclined diamond-frame concrete legs straddling the 4-lane deck + central pylon spire up to y=56m
      const towerHeight = 56;
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(1.15, 1.85, towerHeight, 12),
          pylonConcreteMat
        );
        leg.position.set(side * 13.8, towerHeight * 0.5 - 2.0, 0);
        leg.rotation.z = side * 0.08;
        pylonGroup.add(leg);
      }

      // Upper and middle horizontal portal strut beams linking the twin towers
      for (const beamY of [28, 46, 53]) {
        const crossStrut = new THREE.Mesh(
          new THREE.BoxGeometry(27.5, 2.2, 2.6),
          pylonConcreteMat
        );
        crossStrut.position.set(0, beamY, 0);
        pylonGroup.add(crossStrut);
      }

      // Aviation warning red beacons atop both pylon heads
      for (const side of [-1, 1]) {
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.55, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xef4444 })
        );
        beacon.position.set(side * 11.5, towerHeight - 1.2, 0);
        pylonGroup.add(beacon);
      }

      // Fan Array of 32 Tension Stay Cables radiating forward & backward from both pylon heads to the deck edge
      const cableOffsetsZ = [-145, -115, -88, -62, -38, 38, 62, 88, 115, 145];
      for (const side of [-1, 1]) {
        const anchorTop = new THREE.Vector3(side * 12.2, 50.5, 0);
        for (const dz of cableOffsetsZ) {
          const anchorDeck = new THREE.Vector3(side * 12.5, center.y + 1.2, dz);
          const cableVec = new THREE.Vector3().subVectors(anchorDeck, anchorTop);
          const cableLen = cableVec.length();
          const cableMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.065, 0.065, cableLen, 6),
            stayCableMat
          );
          cableMesh.position.copy(anchorTop).addScaledVector(cableVec, 0.5);
          cableMesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            cableVec.clone().normalize()
          );
          pylonGroup.add(cableMesh);
        }
      }

      root.add(pylonGroup);
    };

    buildCableStayedSpan(360); // Worli South Approach Cable-Stayed Pylon Tower
    buildCableStayedSpan(1350); // Main Worli Sea-Link Cable-Stayed Pylon
    buildCableStayedSpan(3400); // North Bandra Channel Cable-Stayed Pylon
  } else {
    // --------------------------------------------------------------------------
    // NH-44 GRAND TRUNK PLAINS: High-Voltage Lattice Pylons & Catenary Powerlines
    // --------------------------------------------------------------------------
    const pylonLinePointsLeft: THREE.Vector3[] = [];
    const pylonLinePointsRight: THREE.Vector3[] = [];
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.65,
      roughness: 0.4,
    });

    for (let s = 180; s < HIGHWAY_LENGTH_M - 150; s += 260) {
      const pPos = splineToWorld(s, 46, 0);
      const pylonGroup = new THREE.Group();
      pylonGroup.position.set(pPos.x, 0, pPos.z);
      pylonGroup.rotation.y = -pPos.sample.heading;

      const towerBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 2.4, 26, 4, 4, false),
        pylonMat
      );
      towerBody.position.y = 13;
      towerBody.rotation.y = Math.PI / 4;
      pylonGroup.add(towerBody);

      const lowerCrossArm = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.45, 0.55), pylonMat);
      lowerCrossArm.position.y = 19.5;
      pylonGroup.add(lowerCrossArm);

      const upperCrossArm = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.4, 0.45), pylonMat);
      upperCrossArm.position.y = 23.8;
      pylonGroup.add(upperCrossArm);

      root.add(pylonGroup);

      const curL = new THREE.Vector3(pPos.x - 4.1, 19.3, pPos.z);
      const curR = new THREE.Vector3(pPos.x + 4.1, 19.3, pPos.z);
      if (pylonLinePointsLeft.length > 0) {
        const prevL = pylonLinePointsLeft[pylonLinePointsLeft.length - 1];
        const prevR = pylonLinePointsRight[pylonLinePointsRight.length - 1];
        for (let sub = 1; sub <= 6; sub++) {
          const t = sub / 6;
          const sag = Math.sin(t * Math.PI) * 3.4;
          pylonLinePointsLeft.push(
            new THREE.Vector3().lerpVectors(prevL, curL, t).add(new THREE.Vector3(0, -sag, 0))
          );
          pylonLinePointsRight.push(
            new THREE.Vector3().lerpVectors(prevR, curR, t).add(new THREE.Vector3(0, -sag, 0))
          );
        }
      } else {
        pylonLinePointsLeft.push(curL);
        pylonLinePointsRight.push(curR);
      }
    }

    const cableMat = new THREE.LineBasicMaterial({ color: 0x1e293b });
    root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pylonLinePointsLeft), cableMat));
    root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pylonLinePointsRight), cableMat));
  }

  // ============================================================================
  // 6. Viaduct / Flyover / Sea-Bridge Concrete Piers & Parapet Walls
  // ============================================================================
  const buildBridgeStructure = (startS: number, endS: number) => {
    for (let s = startS; s <= endS; s += 35) {
      const center = splineToWorld(s, 0, 0);
      if (center.y > 0.5) {
        const pierHeight = center.y + (mapId === 'nh66_coastal' ? 2.4 : 0.4);
        const pierGroup = new THREE.Group();
        pierGroup.position.set(center.x, mapId === 'nh66_coastal' ? -2.0 : 0, center.z);
        pierGroup.rotation.y = -center.sample.heading;

        for (const px of [-5.8, 5.8]) {
          const col = new THREE.Mesh(
            new THREE.CylinderGeometry(0.95, 1.12, pierHeight, 16),
            barrierMat
          );
          col.position.set(px, pierHeight * 0.5 - 0.3, 0);
          pierGroup.add(col);
        }
        const capBeam = new THREE.Mesh(new THREE.BoxGeometry(22.5, 1.35, 2.4), barrierMat);
        capBeam.position.set(0, pierHeight - 0.65, 0);
        pierGroup.add(capBeam);

        root.add(pierGroup);
      }

      for (const side of [-1, 1]) {
        const pPos = splineToWorld(s, side * 12.15, 0.52);
        const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.52, 1.08, 34.8), hazardMat);
        parapet.position.set(pPos.x, pPos.y, pPos.z);
        parapet.rotation.set(-pPos.sample.grade, -pPos.sample.heading, 0, 'YXZ');
        root.add(parapet);
      }
    }
  };
  buildBridgeStructure(920, 1850);
  buildBridgeStructure(3120, 3780);

  // ============================================================================
  // 7. Overhead Space-Frame Truss NHAI Highway Sign Gantries & Milestones (Per Map)
  // ============================================================================
  const gantrySpecs =
    mapId === 'nh48_ghats'
      ? [
          {
            s: 260,
            en: 'KHANDALA GHAT 1.0 KM · LONAVALA 4.1 KM',
            hi: 'खंडाला घाट १ किमी · लोनावला ४.१ किमी',
            left: 'STEEP CLIMB ENGAGE LOW GEAR',
            right: 'GHAT SPEED LIMIT 60 KM/H',
            badge: '48',
          },
          {
            s: 1020,
            en: 'BHATAN ROCK TUNNEL AHEAD · HEADLIGHTS ON',
            hi: 'भातन सुरंग आगे · हेडलाइट चालू रखें',
            left: 'HEAVY VEHICLES KEEP LEFT',
            right: 'NO OVERTAKING IN TUNNEL',
            badge: '48',
          },
          {
            s: 2320,
            en: 'LONAVALA CHIKKI PLAZA & TRUCK STOP',
            hi: 'लोनावला विश्राम केंद्र एवं ढाबा',
            left: 'BRAKE COOLING LAY-BY LEFT',
            right: 'PUNE CORRIDOR NH-48',
            badge: '48',
          },
          {
            s: 4120,
            en: 'KHALAPUR GHAT TOLL PLAZA 250M · FASTAG',
            hi: 'खालापुर टोल प्लाज़ा २५० मीटर · फास्टैग',
            left: 'HEAVY AXLE LANES 1-2',
            right: 'REDUCE SPEED 40 KM/H',
            badge: '48',
          },
        ]
      : mapId === 'nh66_coastal'
        ? [
            {
              s: 260,
              en: 'WORLI SEA FACE 1.0 KM · BANDRA 4.1 KM',
              hi: 'वरली सी फेस १ किमी · बांद्रा ४.१ किमी',
              left: 'HEAVY FREIGHT KEEP LEFT',
              right: 'COASTAL CROSSWIND ZONE',
              badge: '66',
            },
            {
              s: 980,
              en: 'BANDRA-WORLI CABLE-STAYED BRIDGE',
              hi: 'बांद्रा-वरली केबल-स्टेड समुद्री सेतु',
              left: 'NO STOPPING ON SEA-LINK',
              right: 'SPEED LIMIT 80 KM/H',
              badge: '66',
            },
            {
              s: 2320,
              en: 'KONKAN COASTAL TRUCK LAY-BY & FUEL',
              hi: 'कोंकण तटीय विश्राम केंद्र एवं ईंधन',
              left: 'TRUCK LAY-BY LEFT',
              right: 'THROUGH TRAFFIC NH-66',
              badge: '66',
            },
            {
              s: 4120,
              en: 'BANDRA SEA-LINK TOLL PLAZA 250M',
              hi: 'बांद्रा सी-लिंक टोल प्लाज़ा २५० मीटर',
              left: 'FASTAG HEAVY LANES 1-2',
              right: 'REDUCE SPEED 40 KM/H',
              badge: '66',
            },
          ]
        : [
            {
              s: 260,
              en: 'SHAHBAD 1.0 KM · KARNAL 4.1 KM',
              hi: 'शाहबाद १ किमी · करनाल ४.१ किमी',
              left: 'HEAVY VEHICLES KEEP LEFT',
              right: 'FAST LANE 80 KM/H',
              badge: '44',
            },
            {
              s: 1050,
              en: 'SHAHBAD FLYOVER AHEAD · KEEP LANE',
              hi: 'शाहबाद फ्लाईओवर · अपनी लेन में चलें',
              left: 'GOODS CARRIERS 70 KM/H',
              right: 'OVERTAKING LANE',
              badge: '44',
            },
            {
              s: 2320,
              en: 'SHER-E-PUNJAB DHABA & FUEL PLAZA',
              hi: 'शेर-ए-पंजाब ढाबा एवं विश्राम केंद्र',
              left: 'TRUCK LAY-BY LEFT',
              right: 'THROUGH TRAFFIC NH-44',
              badge: '44',
            },
            {
              s: 3320,
              en: 'PIPLI KURUKSHETRA INTERCHANGE',
              hi: 'पिपली कुरुक्षेत्र एक्सप्रेस चौराहा',
              left: 'KARNAL / PANIPAT / DELHI',
              right: 'EXPRESS CORRIDOR',
              badge: '44',
            },
            {
              s: 4120,
              en: 'KARNAL TOLL PLAZA 250M · FASTAG',
              hi: 'करनाल टोल प्लाज़ा २५० मीटर · फास्टैग',
              left: 'HEAVY AXLE LANES 1-2',
              right: 'REDUCE SPEED 40 KM/H',
              badge: '44',
            },
          ];

  for (const g of gantrySpecs) {
    const center = splineToWorld(g.s, 0, 0);
    const gantryGroup = new THREE.Group();
    gantryGroup.position.set(center.x, center.y, center.z);
    gantryGroup.rotation.y = -center.sample.heading;

    for (const lx of [-12.3, 0]) {
      const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.2, 0.95), barrierMat);
      pedestal.position.set(lx, 0.6, 0);
      gantryGroup.add(pedestal);

      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.28, 7.8, 12),
        galvSteelMat
      );
      leg.position.set(lx, 4.1, 0);
      gantryGroup.add(leg);
    }

    for (const ty of [6.65, 7.75]) {
      const chord = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 13.4, 10).rotateZ(Math.PI / 2),
        galvSteelMat
      );
      chord.position.set(-6.15, ty, 0);
      gantryGroup.add(chord);
    }
    for (let tx = -12.0; tx <= -0.5; tx += 1.4) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.15, 0.35), galvSteelMat);
      strut.position.set(tx, 7.2, 0);
      gantryGroup.add(strut);
    }

    const signTex = textures.createGantrySignTexture(g.en, g.hi, g.left, g.right, g.badge);
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(10.8, 2.62, 0.16),
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.32, metalness: 0.15 })
    );
    signBoard.position.set(-6.15, 7.2, 0.28);
    gantryGroup.add(signBoard);

    root.add(gantryGroup);
  }

  // Yellow-Top Kilometre Milestones every 500m on left shoulder
  const milestoneCity =
    mapId === 'nh48_ghats' ? 'LONAVALA' : mapId === 'nh66_coastal' ? 'BANDRA' : 'KARNAL';
  for (let s = 500; s < HIGHWAY_LENGTH_M; s += 500) {
    const kmLeft = Math.max(1, Math.round(((HIGHWAY_LENGTH_M - s) / 1000) * 10));
    const msPos = splineToWorld(s, -11.6, 0);
    const msTex = textures.createMilestoneTexture(milestoneCity, kmLeft);
    const msMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 1.08, 0.22),
      new THREE.MeshStandardMaterial({ map: msTex, roughness: 0.7 })
    );
    msMesh.position.set(msPos.x, msPos.y + 0.54, msPos.z);
    msMesh.rotation.y = -msPos.sample.heading;
    root.add(msMesh);
  }

  // ============================================================================
  // 8. Roadside Highway Dhaba / Rest Plaza, Fuel Station & Parked Lorries (KM 2.45)
  // ============================================================================
  const dhabaLightsMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
  const dhabaCenter = splineToWorld(2450, -25, 0);
  const dhabaGroup = new THREE.Group();
  dhabaGroup.position.set(dhabaCenter.x, dhabaCenter.y, dhabaCenter.z);
  dhabaGroup.rotation.y = -dhabaCenter.sample.heading;

  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(26, 0.25, 108),
    new THREE.MeshStandardMaterial({
      color: 0x44403c,
      normalMap: textures.asphaltNormalMap,
      roughness: 0.92,
    })
  );
  apron.position.set(4.5, 0.02, 0);
  dhabaGroup.add(apron);

  const dhabaHall = new THREE.Mesh(
    new THREE.BoxGeometry(11, 5.2, 36),
    new THREE.MeshStandardMaterial({
      color: mapId === 'nh66_coastal' ? 0x0f766e : 0x9a3412,
      normalMap: textures.concreteNormalMap,
      roughness: 0.78,
    })
  );
  dhabaHall.position.set(-7.5, 2.6, -14);
  dhabaGroup.add(dhabaHall);

  const verandaRoof = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 0.35, 36.8),
    new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.7 })
  );
  verandaRoof.position.set(-0.2, 3.8, -14);
  dhabaGroup.add(verandaRoof);

  for (let vz = -30; vz <= 2; vz += 6.4) {
    const vCol = new THREE.Mesh(new THREE.BoxGeometry(0.45, 3.8, 0.45), barrierMat);
    vCol.position.set(1.8, 1.9, vz);
    dhabaGroup.add(vCol);
  }

  for (let cz = -26; cz <= -2; cz += 6) {
    const charpai = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.48, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 })
    );
    charpai.position.set(0.2, 0.28, cz);
    dhabaGroup.add(charpai);
  }

  const dhabaSignStrip = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.35, 32), dhabaLightsMat);
  dhabaSignStrip.position.set(-1.8, 4.9, -14);
  dhabaGroup.add(dhabaSignStrip);

  const fuelCanopy = new THREE.Mesh(
    new THREE.BoxGeometry(10.5, 0.92, 22),
    new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.35, metalness: 0.25 })
  );
  fuelCanopy.position.set(-1.5, 5.8, 26);
  dhabaGroup.add(fuelCanopy);

  const fuelTrim = new THREE.Mesh(
    new THREE.BoxGeometry(10.8, 0.42, 22.3),
    new THREE.MeshBasicMaterial({ color: 0xf97316 })
  );
  fuelTrim.position.set(-1.5, 5.8, 26);
  dhabaGroup.add(fuelTrim);

  for (const pz of [18, 34]) {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.34, 5.8, 14),
      barrierMat
    );
    pillar.position.set(-1.5, 2.9, pz);
    dhabaGroup.add(pillar);

    const pump = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 2.1, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 })
    );
    pump.position.set(-1.5, 1.15, pz + 3.2);
    dhabaGroup.add(pump);
  }

  const parkedLorry1 = buildTrafficVehicleMesh('lorry', 0xd97706, textures);
  parkedLorry1.root.position.set(6.5, 0.05, -18);
  parkedLorry1.root.rotation.y = 0.28;
  dhabaGroup.add(parkedLorry1.root);

  const parkedLorry2 = buildTrafficVehicleMesh('lorry', 0x059669, textures);
  parkedLorry2.root.position.set(5.8, 0.05, 12);
  parkedLorry2.root.rotation.y = -0.15;
  dhabaGroup.add(parkedLorry2.root);

  root.add(dhabaGroup);

  // ============================================================================
  // 9. 6-Lane FASTag Highway Toll Plaza (KM 4.35)
  // ============================================================================
  const tollCenter = splineToWorld(4350, 0, 0);
  const tollGroup = new THREE.Group();
  tollGroup.position.set(tollCenter.x, tollCenter.y, tollCenter.z);
  tollGroup.rotation.y = -tollCenter.sample.heading;

  const tollRoof = new THREE.Mesh(
    new THREE.BoxGeometry(35.2, 1.45, 10.5),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.45, roughness: 0.4 })
  );
  tollRoof.position.set(0, 7.6, 0);
  tollGroup.add(tollRoof);

  const tollFascia = new THREE.Mesh(
    new THREE.BoxGeometry(35.5, 0.48, 10.8),
    new THREE.MeshBasicMaterial({ color: 0x10b981 })
  );
  tollFascia.position.set(0, 7.8, 0);
  tollGroup.add(tollFascia);

  for (const laneX of [-8.6, -3.1, 3.1, 8.6]) {
    const signalBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.95, 0.25),
      new THREE.MeshBasicMaterial({ color: 0x22c55e })
    );
    signalBox.position.set(laneX, 6.45, 5.3);
    tollGroup.add(signalBox);
  }

  const islandOffsets = [-11.6, -5.75, 0, 5.75, 11.6];
  for (const ix of islandOffsets) {
    const islandCurb = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.34, 15.5), hazardMat);
    islandCurb.position.set(ix, 0.17, 0);
    tollGroup.add(islandCurb);

    const crashDrum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.45, 1.15, 14),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 })
    );
    crashDrum.position.set(ix, 0.65, 7.2);
    tollGroup.add(crashDrum);

    const booth = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 2.85, 3.4),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45 })
    );
    booth.position.set(ix, 1.6, 0);
    tollGroup.add(booth);

    const boothGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 1.15, 2.8),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.15 })
    );
    boothGlass.position.set(ix, 1.95, 0);
    tollGroup.add(boothGlass);

    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.34, 7.6, 14),
      barrierMat
    );
    column.position.set(ix, 3.8, 0);
    tollGroup.add(column);
  }

  root.add(tollGroup);

  // ============================================================================
  // 10. Roadside Regional Structures (Brick Kilns on Plains, Ghat Resorts, or Coastal Lighthouses)
  // ============================================================================
  for (let i = 0; i < 36; i++) {
    const s = i * 135 + 90;
    const side = i % 2 === 0 ? -1 : 1;
    const dist = 58 + ((i * 29) % 85);
    const signedLat = side * dist;
    const sample = getRoadPointAtDistance(s);
    const dy = getTerrainHeightOffsetAt(s, signedLat, sample.y, mapId);
    const pos = splineToWorld(s, signedLat, dy);

    const bldgGroup = new THREE.Group();
    bldgGroup.position.set(pos.x, pos.y - 0.15, pos.z);
    bldgGroup.rotation.y = -pos.sample.heading + (i % 3) * 0.2;

    if (mapId === 'nh66_coastal') {
      // Coastal Red-and-White Striped Lighthouses & Port Cranes on eastern shore
      if (side === 1 && i % 3 === 0) {
        const lhBase = new THREE.Mesh(
          new THREE.CylinderGeometry(1.4, 2.6, 22, 12),
          new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.65 })
        );
        lhBase.position.y = 11;
        bldgGroup.add(lhBase);

        const lantern = new THREE.Mesh(
          new THREE.CylinderGeometry(1.6, 1.6, 2.4, 12),
          new THREE.MeshBasicMaterial({ color: 0xfef08a })
        );
        lantern.position.y = 23.2;
        bldgGroup.add(lantern);
        root.add(bldgGroup);
      }
    } else if (mapId === 'nh44_plains') {
      if (i % 4 === 0) {
        const kilnBase = new THREE.Mesh(
          new THREE.CylinderGeometry(5.5, 7.2, 2.6, 12),
          new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.92 })
        );
        kilnBase.position.y = 1.3;
        bldgGroup.add(kilnBase);

        const chimney = new THREE.Mesh(
          new THREE.CylinderGeometry(0.82, 2.25, 26, 14),
          new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.88 })
        );
        chimney.position.y = 13;
        bldgGroup.add(chimney);
      } else {
        const w = 9 + (i % 4) * 3.5;
        const h = 4.8 + (i % 3) * 2.2;
        const d = 14 + (i % 5) * 4.5;
        const bldg = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          new THREE.MeshStandardMaterial({
            color: i % 3 === 0 ? 0xd6d3d1 : i % 3 === 1 ? 0xfef3c7 : 0xe0f2fe,
            normalMap: textures.concreteNormalMap,
            roughness: 0.85,
          })
        );
        bldg.position.set(0, h * 0.5, 0);
        bldgGroup.add(bldg);
      }
      root.add(bldgGroup);
    }
  }

  // Instanced Red/Amber Retro-Reflective Highway Guide Delineators along Guardrail Tops
  const delinCount = 240;
  const delinGeo = new THREE.BoxGeometry(0.08, 0.24, 0.04);
  delinGeo.translate(0, 0.94, 0);
  const delinMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const delinInst = new THREE.InstancedMesh(delinGeo, delinMat, delinCount);
  for (let i = 0; i < delinCount; i++) {
    const s = Math.floor(i / 2) * 40 + 15;
    const side = i % 2 === 0 ? -1 : 1;
    const pPos = splineToWorld(s, side * 12.18, 0);
    dummy.position.set(pPos.x, pPos.y, pPos.z);
    dummy.rotation.set(0, -pPos.sample.heading, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    delinInst.setMatrixAt(i, dummy.matrix);
  }
  delinInst.instanceMatrix.needsUpdate = true;
  delinInst.computeBoundingSphere();
  root.add(delinInst);

  // ============================================================================
  // 11. ULTRA GRAPHICS HIGH-DENSITY LOD LAYER (`ultraDetailGroup`)
  //     Sculpted Roadside Boulders, Dense Verge Foliage, Curve Chevron Signs & Retaining Walls
  // ============================================================================
  const boulderCount = mapId === 'nh48_ghats' ? 780 : mapId === 'nh66_coastal' ? 520 : 440;
  const boulderGeo = new THREE.DodecahedronGeometry(1.35, 1);
  const bPosAttr = boulderGeo.attributes.position;
  for (let k = 0; k < bPosAttr.count; k++) {
    const bx = bPosAttr.getX(k);
    const by = bPosAttr.getY(k);
    const bz = bPosAttr.getZ(k);
    const cragFactor = 1 + Math.sin(bx * 2.9 + by * 3.3) * 0.22 + Math.cos(bz * 2.7 - bx * 1.9) * 0.16;
    bPosAttr.setXYZ(k, bx * cragFactor, Math.max(-0.4, by * cragFactor * 0.85), bz * cragFactor);
  }
  boulderGeo.computeVertexNormals();

  const boulderMat = new THREE.MeshStandardMaterial({
    color: mapId === 'nh48_ghats' ? 0x3f3f46 : mapId === 'nh66_coastal' ? 0x78716c : 0x857f72,
    map: textures.concreteMap,
    normalMap: textures.concreteNormalMap,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughness: 0.92,
    metalness: 0.06,
  });
  const boulderInst = new THREE.InstancedMesh(boulderGeo, boulderMat, boulderCount);
  boulderInst.castShadow = !isSoftwareGl;
  boulderInst.receiveShadow = !isSoftwareGl;

  for (let i = 0; i < boulderCount; i++) {
    const s = ((i * 23.3) % (HIGHWAY_LENGTH_M - 60)) + 25;
    const side = i % 2 === 0 ? 1 : -1;
    const isDhabaZone = side === -1 && s > 2350 && s < 2540;
    const isTollZone = s > 4250 && s < 4450;
    const minLat = isDhabaZone ? 47 : isTollZone ? 25 : 19.2;
    const latDist = minLat + ((i * 17) % 48);
    const signedLat = side * latDist;
    const sample = getRoadPointAtDistance(s);
    const dy = getTerrainHeightOffsetAt(s, signedLat, sample.y, mapId);
    const wp = splineToWorld(s, signedLat, dy);

    if (mapId === 'nh66_coastal' && (wp.y < -1.1 || sample.y > 4.2)) {
      dummy.scale.set(0, 0, 0);
    } else {
      const sx = 0.75 + ((i * 7) % 19) * 0.09;
      const sy = 0.65 + ((i * 11) % 17) * 0.08;
      const sz = 0.75 + ((i * 13) % 21) * 0.09;
      dummy.position.set(wp.x, wp.y + sy * 0.25, wp.z);
      dummy.rotation.set((i * 0.4) % 1.2, (i * 1.7) % (Math.PI * 2), (i * 0.3) % 1.2);
      dummy.scale.set(sx, sy, sz);
    }
    dummy.updateMatrix();
    boulderInst.setMatrixAt(i, dummy.matrix);
  }
  boulderInst.instanceMatrix.needsUpdate = true;
  boulderInst.computeBoundingSphere();
  ultraDetailGroup.add(boulderInst);

  // High-Density Verge Scrub Bushes & Monsoon Ferns (Strictly outside embankment >= 18.8m)
  const vergeScrubCount = 1100;
  const vergeScrubGeo = makeLeafCluster(0.75, 0.55, 0.75, 0, 0.45, 0);
  const vergeScrubMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.02,
  });
  const vergeScrubInst = new THREE.InstancedMesh(vergeScrubGeo, vergeScrubMat, vergeScrubCount);

  for (let i = 0; i < vergeScrubCount; i++) {
    const s = ((i * 17.9) % (HIGHWAY_LENGTH_M - 40)) + 20;
    const side = i % 2 === 0 ? -1 : 1;
    const isDhabaZone = side === -1 && s > 2350 && s < 2540;
    const isTollZone = s > 4250 && s < 4450;
    const minLat = isDhabaZone ? 45.5 : isTollZone ? 23.5 : 18.8;
    const latDist = minLat + ((i * 13) % 36);
    const signedLat = side * latDist;
    const sample = getRoadPointAtDistance(s);
    const dy = getTerrainHeightOffsetAt(s, signedLat, sample.y, mapId);
    const wp = splineToWorld(s, signedLat, dy);

    if (mapId === 'nh66_coastal' && (side === -1 || latDist > 26 || sample.y > 3.8)) {
      dummy.scale.set(0, 0, 0);
    } else {
      const sc = 0.65 + ((i * 9) % 15) * 0.065;
      dummy.position.set(wp.x, wp.y - 0.1, wp.z);
      dummy.rotation.set(0, (i * 2.3) % (Math.PI * 2), 0);
      dummy.scale.set(sc * 1.15, sc * 0.85, sc * 1.15);
    }
    dummy.updateMatrix();
    vergeScrubInst.setMatrixAt(i, dummy.matrix);

    const sHue = mapId === 'nh48_ghats' ? 0.30 : 0.25 + (i % 7) * 0.01;
    color.setHSL(sHue, 0.52, 0.16 + (i % 6) * 0.015);
    vergeScrubInst.setColorAt(i, color);
  }
  vergeScrubInst.instanceMatrix.needsUpdate = true;
  if (vergeScrubInst.instanceColor) vergeScrubInst.instanceColor.needsUpdate = true;
  vergeScrubInst.computeBoundingSphere();
  ultraDetailGroup.add(vergeScrubInst);

  // High-Visibility NHAI Yellow/Black Curve Chevron Warning Boards along highway bends
  const chevronBoardMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    map: textures.hazardConcreteMap,
    roughness: 0.4,
    metalness: 0.2,
  });
  for (let s = 120; s < HIGHWAY_LENGTH_M - 120; s += 45) {
    const sample = getRoadPointAtDistance(s);
    if (Math.abs(sample.curvature) > 0.00042 && !sample.isTunnel && !sample.isTollPlaza) {
      const outerSide = sample.curvature > 0 ? -1 : 1;
      const cPos = splineToWorld(s, outerSide * 13.1, 0);
      const chevGroup = new THREE.Group();
      chevGroup.position.set(cPos.x, cPos.y, cPos.z);
      chevGroup.rotation.y = -cPos.sample.heading + outerSide * 0.18;

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.85, 8), galvSteelMat);
      post.position.y = 0.92;
      chevGroup.add(post);

      const board = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.72, 0.06), chevronBoardMat);
      board.position.y = 1.65;
      chevGroup.add(board);

      ultraDetailGroup.add(chevGroup);
    }
  }

  return {
    root,
    roadMat,
    streetLightHeadsMat,
    dhabaLightsMat,
    ultraDetailGroup,
    mapId,
  };
}

