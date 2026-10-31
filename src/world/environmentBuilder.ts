import * as THREE from 'three';
import {
  getRoadPointAtDistance,
  HIGHWAY_LENGTH_M,
  splineToWorld,
} from '../physics/highwaySpline';
import { applyUltraMicroShaderToAsphalt, HighwayTextureSet } from './materialsAndTextures';
import { buildTrafficVehicleMesh } from './truckBuilder';

export interface HighwayEnvironmentHandles {
  root: THREE.Group;
  roadMat: THREE.MeshStandardMaterial;
  streetLightHeadsMat: THREE.MeshBasicMaterial;
  dhabaLightsMat: THREE.MeshBasicMaterial;
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
 * Generates the continuous 5.0 km NH-44 Grand Trunk Road 3D environment:
 * - Continuous 4-lane divided asphalt with tangent-space normal map & specular tire-track roughness map
 * - Sloped gravel highway embankments & continuous galvanized W-beam steel guardrails with posts
 * - 3D contoured North Indian alluvial terrain mesh + 360° distant Shivalik mountain range
 * - Multi-bough organic Eucalyptus, Neem & Banyan trees + roadside scrub & median oleander shrubs
 * - High-voltage transmission towers with catenary powerlines
 * - Handcrafted North Indian landmarks (Truss Sign Gantries, Flyovers, Sher-e-Punjab Dhaba & Fuel Station with parked trucks, Karnal 6-Lane FASTag Toll Plaza)
 */
export function buildHighwayEnvironment(
  textures: HighwayTextureSet,
  isSoftwareGl: boolean
): HighwayEnvironmentHandles {
  const root = new THREE.Group();

  const segments = 1000; // 1 segment every 5 meters across 5,000 meters
  const stepS = HIGHWAY_LENGTH_M / segments;

  // ============================================================================
  // 1. Continuous 4-Lane Highway Asphalt Ribbon, Shoulders, Embankment & Median Barrier
  // ============================================================================
  const roadHalfWidth = 12.4;
  const embankmentExtraWidth = 4.2;

  // 4 vertices per cross-section: 0=far-left embankment, 1=left shoulder edge, 2=right shoulder edge, 3=far-right embankment
  const roadPositions = new Float32Array((segments + 1) * 4 * 3);
  const roadUvs = new Float32Array((segments + 1) * 4 * 2);
  const roadIndices = new Uint32Array(segments * 18);

  // Central Median Concrete Jersey Barrier Ribbon
  const barrierHalfWidth = 0.65;
  const barrierHeight = 0.96;
  const barrierPositions = new Float32Array((segments + 1) * 4 * 3);
  const barrierUvs = new Float32Array((segments + 1) * 4 * 2);
  const barrierIndices = new Uint32Array(segments * 18);

  // Outer Galvanized W-Beam Steel Guardrail Ribbons (Left & Right shoulders)
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
          // Left embankment skirt
          r0 + 0, r0 + 1, r1 + 0,
          r0 + 1, r1 + 1, r1 + 0,
          // Main 4-lane highway deck
          r0 + 1, r0 + 2, r1 + 1,
          r0 + 2, r1 + 2, r1 + 1,
          // Right embankment skirt
          r0 + 2, r0 + 3, r1 + 2,
          r0 + 3, r1 + 3, r1 + 2,
        ],
        idx
      );
    }

    // Central Jersey barrier vertices
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

    // Outer W-Beam Steel Guardrail Ribbons (dipping underground across the Dhaba entrance lay-by)
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
          // Left guardrail ribbon
          r0 + 0, r0 + 1, r1 + 0,
          r0 + 1, r1 + 1, r1 + 0,
          // Right guardrail ribbon
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

  const roadMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.asphaltMap,
    normalMap: textures.asphaltNormalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: textures.asphaltRoughnessMap,
    roughness: 1.0,
    metalness: 0.1,
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
    color: 0xffffff,
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
  // 2. Sculpted 3D North Indian Terrain Mesh & 360° Horizon Shivalik Mountain Range
  // ============================================================================
  const terrainCols = 64;
  const terrainRows = 140;
  const terrainWidth = 2200;
  const terrainLength = HIGHWAY_LENGTH_M + 1400;
  const groundPlaneGeo = new THREE.PlaneGeometry(
    terrainWidth,
    terrainLength,
    terrainCols,
    terrainRows
  );
  groundPlaneGeo.rotateX(-Math.PI / 2);

  const gPos = groundPlaneGeo.attributes.position;
  for (let idx = 0; idx < gPos.count; idx++) {
    const vx = gPos.getX(idx);
    const vz = gPos.getZ(idx) - HIGHWAY_LENGTH_M * 0.5;
    gPos.setZ(idx, vz);

    const sApprox = Math.max(0, Math.min(HIGHWAY_LENGTH_M, -vz));
    const roadSample = getRoadPointAtDistance(sApprox);
    const distFromRoadCenter = Math.abs(vx - roadSample.x);

    if (distFromRoadCenter < 22) {
      // Flat drainage ditch / berm immediately beside highway embankment
      gPos.setY(idx, -0.38);
    } else {
      // Rolling agricultural terrain, earthen bunds, and foothills further out
      const t = Math.min(1, (distFromRoadCenter - 22) / 140);
      const undulation =
        Math.sin(vx * 0.014 + vz * 0.008) * 3.8 +
        Math.cos(vx * 0.032 - vz * 0.019) * 1.9 +
        (distFromRoadCenter > 260
          ? Math.pow((distFromRoadCenter - 260) / 180, 1.45) *
            (12 + Math.sin(vz * 0.011 + vx * 0.007) * 6.5)
          : 0);
      gPos.setY(idx, -0.35 + t * Math.max(-0.2, undulation));
    }
  }
  groundPlaneGeo.computeVertexNormals();

  const groundPlaneMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.terrainMap,
    normalMap: textures.terrainNormalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.92,
    metalness: 0.02,
  });
  const groundPlane = new THREE.Mesh(groundPlaneGeo, groundPlaneMat);
  groundPlane.receiveShadow = !isSoftwareGl;
  root.add(groundPlane);

  // 360° Distant Shivalik & Himalayan Foothills Mountain Range Ring on True Horizon
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
    const peakHeight =
      22 +
      Math.abs(Math.sin(ang * 7.0)) * 38 +
      Math.abs(Math.cos(ang * 13.0 + 1.2)) * 22 +
      Math.sin(ang * 3.0) * 12;

    const vIdx = m * 6;
    mountainPositions[vIdx] = mx;
    mountainPositions[vIdx + 1] = -4;
    mountainPositions[vIdx + 2] = mz;
    mountainPositions[vIdx + 3] = mx * 1.03;
    mountainPositions[vIdx + 4] = peakHeight;
    mountainPositions[vIdx + 5] = mz * 1.02;

    // Atmospheric slate-olive foothills blending into horizon mist
    mountainColors.set([0.24, 0.27, 0.25, 0.38, 0.42, 0.46], vIdx);

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
  // 3. Multi-Bough Organic Trees (Branched Trunks + 4-Lobe Sculpted Canopies) & Scrub
  // ============================================================================
  const treeCount = 720;

  // Build composite branched trunk (main trunk + 3 diverging upper limbs)
  const mainTrunk = new THREE.CylinderGeometry(0.18, 0.38, 3.6, 8);
  mainTrunk.translate(0, 1.8, 0);
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

  // Build composite 4-cluster organic foliage canopy (displaced icosahedra so it looks like real leafy boughs)
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

  const compositeCanopyGeo = mergeBufferGeometriesSimple([
    makeLeafCluster(1.25, 0.92, 1.2, 0, 6.2, 0),
    makeLeafCluster(1.05, 0.82, 1.05, -1.25, 4.9, 0.35),
    makeLeafCluster(1.08, 0.85, 1.02, 1.18, 5.1, -0.42),
    makeLeafCluster(0.95, 0.78, 1.1, 0.15, 5.2, 1.15),
  ]);
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
    // Leave open space in front of Sher-e-Punjab Dhaba plaza
    const isDhabaZone = side === -1 && s > 2360 && s < 2530;
    const rowDepth = (isDhabaZone ? 44 : 16.8) + ((i * 19) % 52);
    const pos = splineToWorld(s, side * rowDepth, 0);

    const scale = 0.78 + ((i * 13) % 44) * 0.014;
    dummy.position.set(pos.x, -0.25, pos.z);
    dummy.rotation.set(0, (i * 1.9) % (Math.PI * 2), 0);
    dummy.scale.set(scale, scale * (0.88 + (i % 5) * 0.09), scale);
    dummy.updateMatrix();

    trunkInst.setMatrixAt(i, dummy.matrix);
    canopyInst.setMatrixAt(i, dummy.matrix);

    const hue = 0.24 + ((i * 7) % 12) * 0.008;
    const sat = 0.44 + ((i * 11) % 9) * 0.022;
    const lum = 0.13 + ((i * 5) % 10) * 0.012;
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

  // Roadside Wild Scrub & Tall Kana Grass Clusters along Embankment
  const scrubCount = 800;
  const scrubGeo = makeLeafCluster(0.75, 0.52, 0.75, 0, 0.35, 0);
  const scrubMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const scrubInst = new THREE.InstancedMesh(scrubGeo, scrubMat, scrubCount);
  for (let i = 0; i < scrubCount; i++) {
    const s = ((i * 23.1) % (HIGHWAY_LENGTH_M - 40)) + 20;
    const side = i % 2 === 0 ? -1 : 1;
    const lat = 13.6 + ((i * 7) % 14) * 0.85;
    const pos = splineToWorld(s, side * lat, -0.25);
    const sc = 0.55 + (i % 5) * 0.16;
    dummy.position.set(pos.x, pos.y, pos.z);
    dummy.rotation.set(0, i * 1.1, 0);
    dummy.scale.set(sc, sc * 0.85, sc);
    dummy.updateMatrix();
    scrubInst.setMatrixAt(i, dummy.matrix);
    color.setHSL(0.21 + (i % 6) * 0.012, 0.42, 0.16 + (i % 4) * 0.02);
    scrubInst.setColorAt(i, color);
  }
  scrubInst.instanceMatrix.needsUpdate = true;
  if (scrubInst.instanceColor) scrubInst.instanceColor.needsUpdate = true;
  scrubInst.computeBoundingSphere();
  root.add(scrubInst);

  // Median Oleander Shrubs along the central concrete divider
  const shrubCount = 350;
  const shrubGeo = makeLeafCluster(0.45, 0.58, 0.68, 0, 1.32, 0);
  const shrubMat = new THREE.MeshStandardMaterial({ color: 0x29491e, roughness: 0.86 });
  const shrubInst = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubCount);

  for (let i = 0; i < shrubCount; i++) {
    const s = i * 14.0 + 18;
    const pos = splineToWorld(s, 0, 0);
    if (pos.sample.isTollPlaza) {
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
    dummy.position.set(pos.x, pos.y, pos.z);
    dummy.rotation.set(0, -pos.sample.heading, 0);
    dummy.scale.set(1, 1, 1);
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
  // 5. High-Voltage Transmission Towers (Lattice Pylons) & Catenary Powerlines
  // ============================================================================
  const pylonLinePointsLeft: THREE.Vector3[] = [];
  const pylonLinePointsRight: THREE.Vector3[] = [];
  const pylonMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.65,
    roughness: 0.4,
    wireframe: false,
  });

  for (let s = 180; s < HIGHWAY_LENGTH_M - 150; s += 260) {
    const pPos = splineToWorld(s, 46, 0);
    const pylonGroup = new THREE.Group();
    pylonGroup.position.set(pPos.x, 0, pPos.z);
    pylonGroup.rotation.y = -pPos.sample.heading;

    // Tapered 4-leg lattice tower body + 2 cross-arms
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

    // Add catenary cable sag points between previous pylon and this pylon
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

  // ============================================================================
  // 6. Flyover Concrete Hammerhead Piers, Box-Girder Deck & Hazard Parapet Walls
  // ============================================================================
  const hazardMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.hazardConcreteMap,
    normalMap: textures.concreteNormalMap,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.68,
  });

  const buildBridgeStructure = (startS: number, endS: number) => {
    for (let s = startS; s <= endS; s += 35) {
      const center = splineToWorld(s, 0, 0);
      if (center.y > 0.5) {
        const pierHeight = center.y + 0.4;
        const pierGroup = new THREE.Group();
        pierGroup.position.set(center.x, 0, center.z);
        pierGroup.rotation.y = -center.sample.heading;

        // Twin cylindrical concrete pier columns
        for (const px of [-5.8, 5.8]) {
          const col = new THREE.Mesh(
            new THREE.CylinderGeometry(0.95, 1.12, pierHeight, 16),
            barrierMat
          );
          col.position.set(px, pierHeight * 0.5 - 0.3, 0);
          pierGroup.add(col);
        }
        // Flared hammerhead pier cap beam under box girder
        const capBeam = new THREE.Mesh(new THREE.BoxGeometry(22.5, 1.35, 2.4), barrierMat);
        capBeam.position.set(0, pierHeight - 0.65, 0);
        pierGroup.add(capBeam);

        root.add(pierGroup);
      }

      // Left & Right hazard-striped concrete crash parapets with upper steel handrail
      for (const side of [-1, 1]) {
        const pPos = splineToWorld(s, side * 12.15, 0.52);
        const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.52, 1.08, 34.8), hazardMat);
        parapet.position.set(pPos.x, pPos.y, pPos.z);
        parapet.rotation.set(-pPos.sample.grade, -pPos.sample.heading, 0, 'YXZ');
        root.add(parapet);
      }
    }
  };
  buildBridgeStructure(980, 1820); // Shahbad Markanda Flyover
  buildBridgeStructure(3180, 3720); // Pipli Kurukshetra Overpass

  // ============================================================================
  // 7. Overhead Space-Frame Truss NHAI Highway Sign Gantries & Milestones
  // ============================================================================
  const gantrySpecs = [
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
      // Concrete pedestal base + flanged steel column
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

    // Dual-chord tubular steel space-frame truss spanning carriageway
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
  for (let s = 500; s < HIGHWAY_LENGTH_M; s += 500) {
    const kmLeft = Math.max(1, Math.round(((HIGHWAY_LENGTH_M - s) / 1000) * 10));
    const msPos = splineToWorld(s, -11.6, 0);
    const msTex = textures.createMilestoneTexture('KARNAL', kmLeft);
    const msMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 1.08, 0.22),
      new THREE.MeshStandardMaterial({ map: msTex, roughness: 0.7 })
    );
    msMesh.position.set(msPos.x, msPos.y + 0.54, msPos.z);
    msMesh.rotation.y = -msPos.sample.heading;
    root.add(msMesh);
  }

  // ============================================================================
  // 8. Sher-e-Punjab Roadside Highway Dhaba, Fuel Plaza & Parked Lorries (KM 2.45)
  // ============================================================================
  const dhabaLightsMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
  const dhabaCenter = splineToWorld(2450, -25, 0);
  const dhabaGroup = new THREE.Group();
  dhabaGroup.position.set(dhabaCenter.x, 0, dhabaCenter.z);
  dhabaGroup.rotation.y = -dhabaCenter.sample.heading;

  // Gravel & compacted dirt truck lay-by parking apron connecting smoothly to highway shoulder
  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(26, 0.12, 108),
    new THREE.MeshStandardMaterial({
      color: 0x44403c,
      normalMap: textures.asphaltNormalMap,
      roughness: 0.92,
    })
  );
  apron.position.set(4.5, 0.02, 0);
  dhabaGroup.add(apron);

  // Main Dhaba Brick Hall with Arched Veranda Pillars, Tandoor Shed & Glowing Signboard
  const dhabaHall = new THREE.Mesh(
    new THREE.BoxGeometry(11, 5.2, 36),
    new THREE.MeshStandardMaterial({
      color: 0x9a3412,
      normalMap: textures.concreteNormalMap,
      roughness: 0.78,
    })
  );
  dhabaHall.position.set(-7.5, 2.6, -14);
  dhabaGroup.add(dhabaHall);

  // Veranda Roof & Pillars
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

  // Outdoor Charpai Rope Beds under Veranda
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

  // IndianOil-Style Blue & Saffron Highway Fuel Station Canopy & Pump Islands
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

    // Fuel dispenser cabinet on island
    const pump = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 2.1, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 })
    );
    pump.position.set(-1.5, 1.15, pz + 3.2);
    dhabaGroup.add(pump);
  }

  // 2 Resting Heavy Goods Lorries Parked in the Dhaba Lay-By
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
  // 9. Karnal 6-Lane FASTag Highway Toll Plaza (KM 4.35)
  // ============================================================================
  const tollCenter = splineToWorld(4350, 0, 0);
  const tollGroup = new THREE.Group();
  tollGroup.position.set(tollCenter.x, tollCenter.y, tollCenter.z);
  tollGroup.rotation.y = -tollCenter.sample.heading;

  // Massive Architectural Toll Canopy with Space-Frame Fascia & Lane Status Signals
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

  // Overhead Green FASTag Lane Arrow Signals centered over each open driving lane
  for (const laneX of [-8.6, -3.1, 3.1, 8.6]) {
    const signalBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.95, 0.25),
      new THREE.MeshBasicMaterial({ color: 0x22c55e })
    );
    signalBox.position.set(laneX, 6.45, 5.3);
    tollGroup.add(signalBox);
  }

  // Toll Booth Islands between lanes (leaving driving lanes at -7.6m, -3.85m, +3.85m, +7.6m completely clear!)
  const islandOffsets = [-11.6, -5.75, 0, 5.75, 11.6];
  for (const ix of islandOffsets) {
    const islandCurb = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.34, 15.5), hazardMat);
    islandCurb.position.set(ix, 0.17, 0);
    tollGroup.add(islandCurb);

    // Yellow crash attenuator drum at front of toll island
    const crashDrum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.45, 1.15, 14),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 })
    );
    crashDrum.position.set(ix, 0.65, 7.2);
    tollGroup.add(crashDrum);

    // Glazed Toll Collector Kiosk Booth
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
  // 10. Roadside Industrial Brick Kilns (Bhattas), Cellular Towers & Agro Godowns
  // ============================================================================
  for (let i = 0; i < 42; i++) {
    const s = i * 118 + 90;
    const side = i % 2 === 0 ? -1 : 1;
    const dist = 58 + ((i * 29) % 95);
    const pos = splineToWorld(s, side * dist, 0);

    const bldgGroup = new THREE.Group();
    bldgGroup.position.set(pos.x, -0.2, pos.z);
    bldgGroup.rotation.y = -pos.sample.heading + (i % 3) * 0.2;

    if (i % 4 === 0) {
      // North Indian Brick Kiln (Bhatta) Tall Tapered Red-Brick Chimney + Kiln Mound
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
    } else if (i % 5 === 0) {
      // Red & White Telecom Microwave Cellular Tower with Aviation Beacon
      const cellTower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 1.85, 32, 4),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 })
      );
      cellTower.position.y = 16;
      bldgGroup.add(cellTower);

      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      beacon.position.y = 32.4;
      bldgGroup.add(beacon);
    } else {
      // Multi-Bay Agro Storage Godown / Highway Warehouse with Pitched Roof & Water Tank
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

      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.8, 0.45, d + 0.8),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.5 })
      );
      roof.position.set(0, h + 0.22, 0);
      bldgGroup.add(roof);
    }
    root.add(bldgGroup);
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

  return {
    root,
    roadMat,
    streetLightHeadsMat,
    dhabaLightsMat,
  };
}
