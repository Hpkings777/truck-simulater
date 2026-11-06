import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyUltraFlakeShaderToPaint, HighwayTextureSet } from './materialsAndTextures';
import { TruckModelId, TruckPhysicsState } from '../physics/vehiclePhysics';
import { TrafficArchetype } from '../physics/trafficSimulation';

export interface PlayerRigMeshes {
  truckModelId: TruckModelId;
  tractorRoot: THREE.Group;
  cabinSuspensionGroup: THREE.Group;
  trailerRoot: THREE.Group;
  steeringWheelGroup: THREE.Group;
  shifterPivotGroup: THREE.Group;
  indicatorStalkPivot: THREE.Group;
  garlandGroup: THREE.Group;
  rpmNeedle: THREE.Mesh;
  speedNeedle: THREE.Mesh;
  frontLeftSteerPivot: THREE.Group;
  frontRightSteerPivot: THREE.Group;
  tractorWheelMeshes: THREE.Group[];
  trailerWheelMeshes: THREE.Group[];
  headlightLeftSpot: THREE.SpotLight;
  headlightRightSpot: THREE.SpotLight;
  headlightLensMat: THREE.MeshStandardMaterial;
  brakeLightMat: THREE.MeshStandardMaterial;
  indicatorLeftMat: THREE.MeshStandardMaterial;
  indicatorRightMat: THREE.MeshStandardMaterial;
  cabinCameraAnchor: THREE.Object3D;
  mirrorCameraAnchor: THREE.Object3D;
  rightMirrorMesh: THREE.Mesh;
  leftMirrorMesh: THREE.Mesh;
  coolingFanGroup: THREE.Group;
  exhaustPuffs: THREE.Mesh[];
  cabPaintMat: THREE.MeshPhysicalMaterial;
}

/**
 * Creates a beveled 3D box geometry with smooth rounded edges instead of sharp primitive corners.
 */
function createRoundedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  bevelRadius = 0.06,
  bevelSegments = 3
): THREE.ExtrudeGeometry {
  const r = Math.min(bevelRadius, width * 0.25, height * 0.25, depth * 0.25);
  const w = Math.max(0.02, width - r * 2);
  const h = Math.max(0.02, height - r * 2);
  const d = Math.max(0.02, depth - r * 2);

  const shape = new THREE.Shape();
  const hw = w * 0.5;
  const hh = h * 0.5;
  shape.moveTo(-hw, -hh + r);
  shape.lineTo(-hw, hh - r);
  shape.quadraticCurveTo(-hw, hh, -hw + r, hh);
  shape.lineTo(hw - r, hh);
  shape.quadraticCurveTo(hw, hh, hw, hh - r);
  shape.lineTo(hw, -hh + r);
  shape.quadraticCurveTo(hw, -hh, hw - r, -hh);
  shape.lineTo(-hw + r, -hh);
  shape.quadraticCurveTo(-hw, -hh, -hw, -hh + r);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: true,
    bevelSegments,
    steps: 1,
    bevelSize: r,
    bevelThickness: r,
  });
  geo.center();
  return geo;
}

/**
 * Extrudes a 2D longitudinal side profile (defined in [z, y] coordinates) across the vehicle width (X axis)
 * with smooth multi-segment automotive bevels.
 */
function createSideProfileGeometry(
  profileZY: [number, number][],
  totalWidth: number,
  bevelRadius = 0.08,
  bevelSegments = 3
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(profileZY[0][0], profileZY[0][1]);
  for (let i = 1; i < profileZY.length; i++) {
    shape.lineTo(profileZY[i][0], profileZY[i][1]);
  }
  shape.closePath();

  const innerDepth = Math.max(0.05, totalWidth - bevelRadius * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerDepth,
    bevelEnabled: true,
    bevelSegments,
    steps: 1,
    bevelSize: bevelRadius,
    bevelThickness: bevelRadius,
  });
  // ExtrudeGeometry extrudes along +Z; rotateY(-PI/2) maps shape X -> +Z, shape Y -> +Y, extrude Z -> -X
  geo.rotateY(-Math.PI / 2);
  geo.computeBoundingBox();
  if (geo.boundingBox) {
    const centerX = (geo.boundingBox.min.x + geo.boundingBox.max.x) * 0.5;
    geo.translate(-centerX, 0, 0);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a high-detail commercial truck wheel using bulged radial sidewalls,
 * deep-dish ventilated steel rim, planetary axle hub reduction cap, and chrome lug bolts.
 */
function createHeavyWheelGroup(
  tireMat: THREE.Material,
  rimMat: THREE.Material,
  chromeMat: THREE.Material,
  hubMat: THREE.Material,
  isDualRear = false
): THREE.Group {
  const wheelGroup = new THREE.Group();
  const outerRadius = 0.54;
  const rimRadius = 0.31;

  const buildSingleTireAndRim = (offsetX: number) => {
    const unit = new THREE.Group();
    unit.position.x = offsetX;

    const tireGeo = new THREE.CylinderGeometry(outerRadius, outerRadius, 0.29, 28, 1);
    tireGeo.rotateZ(Math.PI / 2);
    const tireMesh = new THREE.Mesh(tireGeo, tireMat);
    unit.add(tireMesh);

    const bulgeGeo = new THREE.TorusGeometry(0.42, 0.115, 12, 28);
    bulgeGeo.rotateY(Math.PI / 2);
    const leftBulge = new THREE.Mesh(bulgeGeo, tireMat);
    leftBulge.position.x = -0.055;
    unit.add(leftBulge);
    const rightBulge = new THREE.Mesh(bulgeGeo, tireMat);
    rightBulge.position.x = 0.055;
    unit.add(rightBulge);

    const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius * 0.88, 0.31, 24);
    rimGeo.rotateZ(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    unit.add(rimMesh);

    return unit;
  };

  if (isDualRear) {
    wheelGroup.add(buildSingleTireAndRim(-0.165));
    wheelGroup.add(buildSingleTireAndRim(0.165));
  } else {
    wheelGroup.add(buildSingleTireAndRim(0));
  }

  const hubWidth = isDualRear ? 0.68 : 0.36;
  const hubGeo = new THREE.CylinderGeometry(0.15, 0.17, hubWidth, 16);
  hubGeo.rotateZ(Math.PI / 2);
  const hubMesh = new THREE.Mesh(hubGeo, hubMat);
  wheelGroup.add(hubMesh);

  const lugRingRadius = 0.22;
  const lugX = isDualRear ? 0.33 : 0.17;
  const lugGeo = new THREE.CylinderGeometry(0.016, 0.016, lugX * 2.04, 8);
  lugGeo.rotateZ(Math.PI / 2);
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const lug = new THREE.Mesh(lugGeo, chromeMat);
    lug.position.set(0, Math.cos(ang) * lugRingRadius, Math.sin(ang) * lugRingRadius);
    wheelGroup.add(lug);
  }

  return wheelGroup;
}

/**
 * Builds a coiled pneumatic air/electrical hose (suzie line) between tractor and trailer.
 */
function createCoiledSuzieHose(
  start: THREE.Vector3,
  end: THREE.Vector3,
  colorHex: number
): THREE.Mesh {
  const pts: THREE.Vector3[] = [];
  const coils = 9;
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const base = new THREE.Vector3().lerpVectors(start, end, t);
    const sag = Math.sin(t * Math.PI) * 0.26;
    const coilRadius = Math.sin(t * Math.PI) * 0.065;
    const angle = t * coils * Math.PI * 2;
    pts.push(
      new THREE.Vector3(
        base.x + Math.cos(angle) * coilRadius,
        base.y - sag + Math.sin(angle) * coilRadius,
        base.z
      )
    );
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tubeGeo = new THREE.TubeGeometry(curve, 44, 0.016, 8, false);
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.35,
    metalness: 0.15,
  });
  return new THREE.Mesh(tubeGeo, mat);
}

let _sharedContactShadowMat: THREE.MeshBasicMaterial | null = null;
function getSharedContactShadowMaterial(): THREE.MeshBasicMaterial {
  if (_sharedContactShadowMat) return _sharedContactShadowMat;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 128, 10, 64, 128, 64);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
  grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.52)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);

  const tex = new THREE.CanvasTexture(c);
  _sharedContactShadowMat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  return _sharedContactShadowMat;
}

/**
 * Constructs the complete 6x4 Indian Heavy Commercial Tractor (Tata Prima / BharatBenz 4928TT inspired),
 * AAA Right-Hand-Drive (RHD) first-person cabin interior, and 40ft Tri-Axle Container Semi-Trailer.
 * Note: Forward direction in local vehicle space is -Z (with +X = Right, -X = Left, +Y = Up).
 */
export function buildPlayerTruckAndTrailer(
  textures: HighwayTextureSet,
  isSoftwareGl: boolean,
  truckModelId: TruckModelId = 'tata_prima_4928'
): PlayerRigMeshes {
  const tractorRoot = new THREE.Group();
  const cabinSuspensionGroup = new THREE.Group();
  tractorRoot.add(cabinSuspensionGroup);

  // Load verified GLB badge/chassis auxiliary mesh from /models/<truckModelId>.glb
  const gltfLoader = new GLTFLoader();
  gltfLoader.load(
    `/models/${truckModelId}.glb`,
    (gltf) => {
      gltf.scene.name = `glb_${truckModelId}`;
      tractorRoot.add(gltf.scene);
    },
    undefined,
    () => {
      // Graceful fallback if offline
    }
  );

  // Distinct Primary & Secondary Paint Palette per Truck Model (R7)
  const primaryColorHex =
    truckModelId === 'ashok_leyland_3520'
      ? 0xeab308 // Traditional Indian Highway Saffron-Gold Cab
      : truckModelId === 'bharatbenz_4228r'
      ? 0x1d4ed8 // BharatBenz Cobalt-Blue Metallic Cab
      : 0xb9380b; // Tata Prima Crimson Metallic Cab

  const secondaryColorHex =
    truckModelId === 'ashok_leyland_3520'
      ? 0x14532d // Traditional Deep Forest Green Cladding
      : truckModelId === 'bharatbenz_4228r'
      ? 0x334155 // Industrial Slate Metallic Cladding
      : 0x18181b; // Satin Obsidian Cladding

  const trimAccentHex =
    truckModelId === 'ashok_leyland_3520'
      ? 0xdc2626 // Traditional Vermilion Red Trim
      : truckModelId === 'bharatbenz_4228r'
      ? 0x38bdf8 // Cyan-Silver Accent Stripe
      : 0xf59e0b; // Gold Trim

  // Calibrated PBR Materials with Custom GLSL Metallic Flake Clearcoat Shader
  const cabPaintMat = new THREE.MeshPhysicalMaterial({
    color: primaryColorHex,
    metalness: truckModelId === 'ashok_leyland_3520' ? 0.35 : 0.68,
    roughness: truckModelId === 'ashok_leyland_3520' ? 0.32 : 0.2,
    clearcoat: isSoftwareGl ? 0 : 1.0,
    clearcoatRoughness: 0.1,
  });
  if (!isSoftwareGl) {
    applyUltraFlakeShaderToPaint(cabPaintMat);
  }

  const cabSecondaryPaintMat = new THREE.MeshPhysicalMaterial({
    color: secondaryColorHex,
    metalness: 0.35,
    roughness: 0.42,
    clearcoat: isSoftwareGl ? 0 : 0.4,
  });
  const cabTrimGoldMat = new THREE.MeshStandardMaterial({
    color: trimAccentHex,
    metalness: 0.65,
    roughness: 0.28,
  });
  const chassisSteelMat = new THREE.MeshStandardMaterial({
    color: 0x1c1917,
    metalness: 0.55,
    roughness: 0.68,
  });
  const matteBumperMat = new THREE.MeshStandardMaterial({
    color: 0x22252a,
    metalness: 0.28,
    roughness: 0.78,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.94,
    roughness: 0.12,
  });
  const brushedAlumMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.82,
    roughness: 0.28,
  });
  const tireRubberMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    normalMap: textures.tireTreadNormalMap,
    normalScale: new THREE.Vector2(1.4, 1.4),
    metalness: 0.06,
    roughness: 0.86,
  });
  const steelRimMat = new THREE.MeshStandardMaterial({
    color: 0xd6d3d1,
    metalness: 0.82,
    roughness: 0.26,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    metalness: 0.12,
    roughness: 0.06,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  const leatherDashMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    normalMap: textures.leatherNormalMap,
    normalScale: new THREE.Vector2(0.65, 0.65),
    metalness: 0.14,
    roughness: 0.62,
  });
  const cabinUpholsteryMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    normalMap: textures.leatherNormalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    metalness: 0.08,
    roughness: 0.78,
  });

  // Emissive Lamp Materials (calibrated so only active lamps exceed the Ultra HDR bloom threshold of 1.55)
  const headlightLensMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfffbeb,
    emissiveIntensity: 0.6,
    roughness: 0.1,
  });
  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 0.45,
    roughness: 0.25,
  });
  const indicatorLeftMat = new THREE.MeshStandardMaterial({
    color: 0x92400e,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.0,
    roughness: 0.25,
  });
  const indicatorRightMat = new THREE.MeshStandardMaterial({
    color: 0x92400e,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.0,
    roughness: 0.25,
  });

  // Contact shadow beneath Tractor
  const contactShadowMat = getSharedContactShadowMaterial();
  const tractorShadow = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 7.8), contactShadowMat);
  tractorShadow.rotation.x = -Math.PI / 2;
  tractorShadow.position.set(0, 0.02, 0.2);
  tractorRoot.add(tractorShadow);

  // ============================================================================
  // 1. Heavy Ladder-Frame Chassis, Axles, Driveshaft, Tanks & Fifth-Wheel
  // ============================================================================
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      createRoundedBoxGeometry(0.16, 0.3, 6.9, 0.03, 2),
      chassisSteelMat
    );
    rail.position.set(side * 0.52, 0.72, 0.2);
    tractorRoot.add(rail);
  }

  for (const cz of [-1.85, -0.4, 1.15, 2.48, 3.35]) {
    const cross = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.22, 0.18), chassisSteelMat);
    cross.position.set(0, 0.72, cz);
    tractorRoot.add(cross);
  }
  for (const az of [-1.85, 1.15, 2.48]) {
    const axleTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 2.08, 12).rotateZ(Math.PI / 2),
      chassisSteelMat
    );
    axleTube.position.set(0, 0.54, az);
    tractorRoot.add(axleTube);

    if (az > 0) {
      const diff = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), chassisSteelMat);
      diff.position.set(0, 0.54, az);
      tractorRoot.add(diff);

      // Pneumatic spring-brake chambers mounted on rear drive axles
      for (const side of [-1, 1]) {
        const brakeChamber = new THREE.Mesh(
          new THREE.CylinderGeometry(0.085, 0.085, 0.18, 10).rotateX(Math.PI / 2),
          matteBumperMat
        );
        brakeChamber.position.set(side * 0.42, 0.65, az - 0.18);
        tractorRoot.add(brakeChamber);
      }
    }
  }

  const catwalk = new THREE.Mesh(
    createRoundedBoxGeometry(1.26, 0.06, 2.55, 0.02, 2),
    brushedAlumMat
  );
  catwalk.position.set(0, 0.89, 0.75);
  tractorRoot.add(catwalk);

  const fuelTankGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.72, 24);
  fuelTankGeo.rotateX(Math.PI / 2);
  const fuelTank = new THREE.Mesh(fuelTankGeo, brushedAlumMat);
  fuelTank.position.set(-0.92, 0.68, -0.12);
  tractorRoot.add(fuelTank);

  for (const sz of [-0.68, 0.44]) {
    const strap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.362, 0.362, 0.06, 24).rotateX(Math.PI / 2),
      chromeMat
    );
    strap.position.set(-0.92, 0.68, sz);
    tractorRoot.add(strap);
  }

  const batteryBox = new THREE.Mesh(
    createRoundedBoxGeometry(0.62, 0.54, 0.95, 0.05, 3),
    matteBumperMat
  );
  batteryBox.position.set(0.92, 0.7, -0.48);
  tractorRoot.add(batteryBox);

  const adBlueTank = new THREE.Mesh(
    createRoundedBoxGeometry(0.56, 0.52, 0.58, 0.05, 3),
    new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.45 })
  );
  adBlueTank.position.set(0.9, 0.68, 0.36);
  tractorRoot.add(adBlueTank);

  const fifthWheelBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.12, 0.95),
    chassisSteelMat
  );
  fifthWheelBase.position.set(0, 0.92, 1.9);
  tractorRoot.add(fifthWheelBase);

  const fifthWheelPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.64, 0.1, 24),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.75, roughness: 0.35 })
  );
  fifthWheelPlate.position.set(0, 1.01, 1.9);
  tractorRoot.add(fifthWheelPlate);

  // Fifth-wheel kingpin release pull-handle
  const releaseRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.55, 8).rotateZ(Math.PI / 2),
    chromeMat
  );
  releaseRod.position.set(-0.56, 0.98, 1.9);
  tractorRoot.add(releaseRod);

  for (const side of [-1, 1]) {
    const fenderArch = new THREE.Mesh(
      createRoundedBoxGeometry(0.68, 0.14, 2.85, 0.05, 3),
      cabSecondaryPaintMat
    );
    fenderArch.position.set(side * 1.04, 1.12, 1.82);
    tractorRoot.add(fenderArch);

    const mudflap = new THREE.Mesh(
      new THREE.BoxGeometry(0.64, 0.65, 0.04),
      matteBumperMat
    );
    mudflap.position.set(side * 1.04, 0.62, 3.22);
    tractorRoot.add(mudflap);

    const reflectorStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.08, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    reflectorStrip.position.set(side * 1.04, 0.34, 3.23);
    tractorRoot.add(reflectorStrip);
  }

  const redSuzie = createCoiledSuzieHose(
    new THREE.Vector3(-0.22, 1.55, -0.35),
    new THREE.Vector3(-0.18, 1.42, 1.25),
    0xdc2626
  );
  tractorRoot.add(redSuzie);
  const yellowSuzie = createCoiledSuzieHose(
    new THREE.Vector3(0.22, 1.55, -0.35),
    new THREE.Vector3(0.18, 1.42, 1.25),
    0xeab308
  );
  tractorRoot.add(yellowSuzie);

  // ============================================================================
  // 2. Sculpted Aerodynamic Sleeper Cabin Exterior (`cabinSuspensionGroup`)
  // ============================================================================
  const lowerCabProfile: [number, number][] = [
    [-2.7, 0.88],
    [-2.74, 1.38],
    [-2.68, 1.88],
    [-2.42, 1.88],
    [-2.38, 1.56],
    [-0.42, 1.56],
    [-0.42, 0.88],
  ];
  const lowerCabGeo = createSideProfileGeometry(lowerCabProfile, 2.48, 0.08, 4);
  const lowerCab = new THREE.Mesh(lowerCabGeo, cabPaintMat);
  lowerCab.castShadow = !isSoftwareGl;
  lowerCab.receiveShadow = !isSoftwareGl;
  cabinSuspensionGroup.add(lowerCab);

  for (const side of [-1, 1]) {
    const doorPanel = new THREE.Mesh(
      createRoundedBoxGeometry(0.11, 0.42, 1.98, 0.03, 3),
      cabPaintMat
    );
    doorPanel.position.set(side * 1.19, 1.69, -1.42);
    cabinSuspensionGroup.add(doorPanel);
  }

  for (const side of [-1, 1]) {
    const wheelArch = new THREE.Mesh(
      createRoundedBoxGeometry(0.14, 0.24, 1.24, 0.04, 3),
      cabSecondaryPaintMat
    );
    wheelArch.position.set(side * 1.22, 0.82, -1.85);
    cabinSuspensionGroup.add(wheelArch);

    const doorHeader = new THREE.Mesh(
      createRoundedBoxGeometry(0.12, 0.16, 1.48, 0.03, 2),
      cabPaintMat
    );
    doorHeader.position.set(side * 1.17, 2.98, -1.85);
    cabinSuspensionGroup.add(doorHeader);

    for (let st = 0; st < 3; st++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.04, 0.56),
        brushedAlumMat
      );
      step.position.set(side * 1.24, 0.56 + st * 0.24, -2.35);
      cabinSuspensionGroup.add(step);
    }

    const handle = new THREE.Mesh(
      createRoundedBoxGeometry(0.06, 0.05, 0.22, 0.015, 2),
      chromeMat
    );
    handle.position.set(side * 1.25, 1.62, -1.45);
    cabinSuspensionGroup.add(handle);
  }

  const waistStripeGold = new THREE.Mesh(
    createRoundedBoxGeometry(2.51, 0.11, 2.28, 0.03, 2),
    cabTrimGoldMat
  );
  waistStripeGold.position.set(0, 1.36, -1.56);
  cabinSuspensionGroup.add(waistStripeGold);

  const waistStripeChrome = new THREE.Mesh(
    createRoundedBoxGeometry(2.52, 0.04, 2.28, 0.01, 2),
    chromeMat
  );
  waistStripeChrome.position.set(0, 1.28, -1.56);
  cabinSuspensionGroup.add(waistStripeChrome);

  const sleeperProfile: [number, number][] = [
    [-1.12, 1.85],
    [-1.12, 3.08],
    [-0.42, 3.08],
    [-0.42, 1.85],
  ];
  const rearSleeperMesh = new THREE.Mesh(
    createSideProfileGeometry(sleeperProfile, 2.46, 0.08, 4),
    cabPaintMat
  );
  rearSleeperMesh.castShadow = !isSoftwareGl;
  cabinSuspensionGroup.add(rearSleeperMesh);

  // Rear cab window & protective steel bars on back of sleeper cab
  const rearCabWindow = new THREE.Mesh(
    createRoundedBoxGeometry(1.15, 0.45, 0.06, 0.02, 2),
    cabSecondaryPaintMat
  );
  rearCabWindow.position.set(0, 2.48, -0.4);
  cabinSuspensionGroup.add(rearCabWindow);

  // Truck-Specific Roof & Upper Cab Silhouette (R7: 3 Visibly Different Truck Architectures)
  if (truckModelId === 'tata_prima_4928') {
    // 1. Tata Prima 4928.S: High Swept Aerodynamic Wind Deflector Fairing
    const roofProfile: [number, number][] = [
      [-2.58, 2.98],
      [-2.25, 3.36],
      [-1.35, 3.74],
      [-0.44, 3.82],
      [-0.44, 3.04],
      [-2.58, 3.04],
    ];
    const roofFairingMesh = new THREE.Mesh(
      createSideProfileGeometry(roofProfile, 2.42, 0.1, 4),
      cabPaintMat
    );
    roofFairingMesh.castShadow = !isSoftwareGl;
    cabinSuspensionGroup.add(roofFairingMesh);

    const roofStripe = new THREE.Mesh(
      createRoundedBoxGeometry(2.44, 0.12, 1.45, 0.03, 2),
      cabTrimGoldMat
    );
    roofStripe.position.set(0, 3.42, -1.25);
    roofStripe.rotation.x = 0.22;
    cabinSuspensionGroup.add(roofStripe);
  } else if (truckModelId === 'ashok_leyland_3520') {
    // 2. Ashok Leyland 3520 "Goods Carrier": Iconic Forward-Cantilevered Indian Wooden "Taj" Luton Crown Peak + Rigid High-Side Wooden Cargo Box
    const tajCrownProfile: [number, number][] = [
      [-3.12, 3.02],
      [-3.28, 3.55],
      [-2.85, 3.92],
      [-1.05, 3.92],
      [-0.42, 3.45],
      [-0.42, 2.98],
    ];
    const tajCrownMesh = new THREE.Mesh(
      createSideProfileGeometry(tajCrownProfile, 2.52, 0.08, 3),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.38, metalness: 0.2 })
    );
    tajCrownMesh.castShadow = !isSoftwareGl;
    cabinSuspensionGroup.add(tajCrownMesh);

    // Ornate Saffron & Vermilion Goods Carrier Front Plaque on the Taj Crown
    const goodsPlaque = new THREE.Mesh(
      createRoundedBoxGeometry(1.96, 0.42, 0.08, 0.02, 2),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    goodsPlaque.position.set(0, 3.48, -3.22);
    goodsPlaque.rotation.x = 0.18;
    cabinSuspensionGroup.add(goodsPlaque);

    const goodsPlaqueBorder = new THREE.Mesh(
      createRoundedBoxGeometry(2.12, 0.52, 0.06, 0.02, 2),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 })
    );
    goodsPlaqueBorder.position.set(0, 3.48, -3.2);
    goodsPlaqueBorder.rotation.x = 0.18;
    cabinSuspensionGroup.add(goodsPlaqueBorder);

    // Rigid 10-Wheeler High-Side Slatted Teakwood Cargo Body + Royal Blue Tarpaulin Dome mounted on tractorRoot
    const woodenCargoGroup = new THREE.Group();
    const woodPlankMat = new THREE.MeshStandardMaterial({
      color: 0x9a3412,
      normalMap: textures.containerNormalMap,
      roughness: 0.72,
    });
    const tarpDomeMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      roughness: 0.65,
    });
    const cargoBodyBox = new THREE.Mesh(
      createRoundedBoxGeometry(2.54, 2.25, 5.4, 0.05, 2),
      woodPlankMat
    );
    cargoBodyBox.position.set(0, 2.02, 2.35);
    cargoBodyBox.castShadow = !isSoftwareGl;
    woodenCargoGroup.add(cargoBodyBox);

    // Slatted horizontal emerald/yellow painted rib bands along wooden cargo sides
    for (let r = 0; r < 4; r++) {
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(2.58, 0.1, 5.42),
        r % 2 === 0 ? cabPaintMat : cabSecondaryPaintMat
      );
      rib.position.set(0, 1.18 + r * 0.52, 2.35);
      woodenCargoGroup.add(rib);
    }

    // Arched Royal-Blue Tarpaulin Roof Dome over Cargo Bed
    const tarpDome = new THREE.Mesh(
      new THREE.CylinderGeometry(1.26, 1.26, 5.38, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2),
      tarpDomeMat
    );
    tarpDome.scale.set(1, 0.42, 1);
    tarpDome.position.set(0, 3.12, 2.35);
    woodenCargoGroup.add(tarpDome);

    // Rear "HORN PLEASE" Tailgate on Rigid Cargo Body
    const rearTailgate = new THREE.Mesh(
      new THREE.PlaneGeometry(2.38, 2.15),
      new THREE.MeshStandardMaterial({ map: textures.lorryTailgateMap, roughness: 0.55 })
    );
    rearTailgate.position.set(0, 2.02, 5.06);
    woodenCargoGroup.add(rearTailgate);

    tractorRoot.add(woodenCargoGroup);
  } else {
    // 3. BharatBenz 4228R Tanker: Low-Profile Flat Industrial Cab Roof with Chrome Air-Conditioning Pod & Twin Hazard Lightbar
    const flatRoofCap = new THREE.Mesh(
      createRoundedBoxGeometry(2.38, 0.24, 2.08, 0.06, 3),
      cabPaintMat
    );
    flatRoofCap.position.set(0, 3.12, -1.48);
    cabinSuspensionGroup.add(flatRoofCap);

    const roofAcUnit = new THREE.Mesh(
      createRoundedBoxGeometry(1.15, 0.22, 0.88, 0.05, 3),
      chromeMat
    );
    roofAcUnit.position.set(0, 3.32, -1.35);
    cabinSuspensionGroup.add(roofAcUnit);

    const hazmatLightbar = new THREE.Mesh(
      createRoundedBoxGeometry(1.65, 0.12, 0.24, 0.03, 2),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    hazmatLightbar.position.set(0, 3.28, -2.22);
    cabinSuspensionGroup.add(hazmatLightbar);
  }

  // Twin Roof-Mounted Amber Heavy Haulage Beacon Strobe Domes
  for (const side of [-1, 1]) {
    const beaconBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.075, 0.05, 12),
      chromeMat
    );
    beaconBase.position.set(side * 0.95, 3.82, -0.58);
    cabinSuspensionGroup.add(beaconBase);

    const beaconDome = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.058, 0.11, 12),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    beaconDome.position.set(side * 0.95, 3.88, -0.58);
    cabinSuspensionGroup.add(beaconDome);
  }

  const pillarGeo = createRoundedBoxGeometry(0.12, 1.18, 0.14, 0.03, 2);
  for (const side of [-1, 1]) {
    const aPillar = new THREE.Mesh(pillarGeo, cabPaintMat);
    aPillar.position.set(side * 1.16, 2.45, -2.58);
    aPillar.rotation.x = -0.15;
    cabinSuspensionGroup.add(aPillar);

    const bPillar = new THREE.Mesh(pillarGeo, cabSecondaryPaintMat);
    bPillar.position.set(side * 1.18, 2.45, -1.16);
    cabinSuspensionGroup.add(bPillar);
  }

  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(2.26, 1.08), glassMat);
  windshield.position.set(0, 2.45, -2.66);
  windshield.rotation.x = Math.PI + 0.15;
  windshield.renderOrder = 5;
  cabinSuspensionGroup.add(windshield);

  for (const wx of [-0.52, 0.42]) {
    const wiperArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.03, 0.03),
      cabSecondaryPaintMat
    );
    wiperArm.position.set(wx, 1.94, -2.74);
    wiperArm.rotation.z = 0.12;
    cabinSuspensionGroup.add(wiperArm);
  }

  const sunVisor = new THREE.Mesh(
    createRoundedBoxGeometry(2.46, 0.22, 0.32, 0.04, 3),
    cabSecondaryPaintMat
  );
  sunVisor.position.set(0, 3.01, -2.68);
  cabinSuspensionGroup.add(sunVisor);

  const sunVisorChrome = new THREE.Mesh(
    new THREE.BoxGeometry(2.44, 0.04, 0.34),
    chromeMat
  );
  sunVisorChrome.position.set(0, 2.92, -2.69);
  cabinSuspensionGroup.add(sunVisorChrome);

  for (let m = -2; m <= 2; m++) {
    const markerLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.05, 0.04),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    markerLed.position.set(m * 0.46, 3.02, -2.85);
    cabinSuspensionGroup.add(markerLed);
  }

  const hornGeo = new THREE.CylinderGeometry(0.035, 0.085, 0.74, 16);
  hornGeo.rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(hornGeo, chromeMat);
    horn.position.set(side * 0.92, 3.45, -2.05);
    cabinSuspensionGroup.add(horn);

    const airCanister = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.95, 16),
      cabSecondaryPaintMat
    );
    airCanister.position.set(side * 0.86, 2.15, -0.32);
    cabinSuspensionGroup.add(airCanister);
  }

  const exhaustStack = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.105, 3.05, 18),
    chromeMat
  );
  exhaustStack.position.set(-1.14, 2.35, -0.28);
  cabinSuspensionGroup.add(exhaustStack);

  const exhaustTip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.09, 0.35, 16),
    chromeMat
  );
  exhaustTip.position.set(-1.14, 3.92, -0.22);
  exhaustTip.rotation.x = -0.38;
  cabinSuspensionGroup.add(exhaustTip);

  // Volumetric-Style Diesel Exhaust Heat/Smoke Plume Spheres above Chrome Stack
  const exhaustPuffs: THREE.Mesh[] = [];
  const puffGeo = new THREE.IcosahedronGeometry(0.14, 1);
  for (let p = 0; p < 5; p++) {
    const puffMat = new THREE.MeshBasicMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    const puff = new THREE.Mesh(puffGeo, puffMat);
    puff.position.set(-1.14, 4.15 + p * 0.28, -0.1 + p * 0.18);
    cabinSuspensionGroup.add(puff);
    exhaustPuffs.push(puff);
  }

  // Sculpted Heavy Front Bumper, Bullbar, Multi-Slat Chrome Grille & Spinning Radiator Fan
  const frontBumper = new THREE.Mesh(
    createRoundedBoxGeometry(2.54, 0.52, 0.42, 0.07, 4),
    matteBumperMat
  );
  frontBumper.position.set(0, 0.72, -2.68);
  cabinSuspensionGroup.add(frontBumper);

  const bullbarLower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 2.28, 14).rotateZ(Math.PI / 2),
    chromeMat
  );
  bullbarLower.position.set(0, 0.62, -2.92);
  cabinSuspensionGroup.add(bullbarLower);

  const bullbarUpper = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.038, 1.72, 14).rotateZ(Math.PI / 2),
    chromeMat
  );
  bullbarUpper.position.set(0, 1.08, -2.92);
  cabinSuspensionGroup.add(bullbarUpper);

  for (const bx of [-0.72, 0.72]) {
    const bullbarUpright = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.56, 12),
      chromeMat
    );
    bullbarUpright.position.set(bx, 0.85, -2.92);
    cabinSuspensionGroup.add(bullbarUpright);
  }

  const frontGrille = new THREE.Mesh(
    createRoundedBoxGeometry(1.74, 0.92, 0.12, 0.04, 3),
    cabSecondaryPaintMat
  );
  frontGrille.position.set(0, 1.42, -2.72);
  cabinSuspensionGroup.add(frontGrille);

  // Animated 9-Blade Radiator Cooling Fan behind Front Grille
  const coolingFanGroup = new THREE.Group();
  coolingFanGroup.position.set(0, 1.38, -2.69);
  const fanHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.05, 12).rotateX(Math.PI / 2),
    brushedAlumMat
  );
  coolingFanGroup.add(fanHub);
  const bladeGeo = new THREE.BoxGeometry(0.06, 0.34, 0.015);
  bladeGeo.translate(0, 0.18, 0);
  for (let b = 0; b < 9; b++) {
    const blade = new THREE.Mesh(bladeGeo, brushedAlumMat);
    blade.rotation.z = (b / 9) * Math.PI * 2;
    coolingFanGroup.add(blade);
  }
  cabinSuspensionGroup.add(coolingFanGroup);

  for (let s = 0; s < 6; s++) {
    const slat = new THREE.Mesh(
      createRoundedBoxGeometry(1.62, 0.048, 0.14, 0.015, 2),
      chromeMat
    );
    slat.position.set(0, 1.06 + s * 0.14, -2.74);
    cabinSuspensionGroup.add(slat);
  }

  const plateMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.12, 0.04),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  );
  plateMesh.position.set(0, 0.56, -2.9);
  cabinSuspensionGroup.add(plateMesh);

  for (const side of [-1, 1]) {
    const bezel = new THREE.Mesh(
      createRoundedBoxGeometry(0.44, 0.28, 0.1, 0.03, 2),
      cabSecondaryPaintMat
    );
    bezel.position.set(side * 0.98, 0.92, -2.72);
    cabinSuspensionGroup.add(bezel);

    const hlLens = new THREE.Mesh(
      createRoundedBoxGeometry(0.36, 0.2, 0.11, 0.02, 2),
      headlightLensMat
    );
    hlLens.position.set(side * 0.96, 0.92, -2.74);
    cabinSuspensionGroup.add(hlLens);

    const indMesh = new THREE.Mesh(
      createRoundedBoxGeometry(0.16, 0.2, 0.12, 0.02, 2),
      side === -1 ? indicatorLeftMat : indicatorRightMat
    );
    indMesh.position.set(side * 1.21, 0.92, -2.71);
    cabinSuspensionGroup.add(indMesh);
  }

  const headlightLeftSpot = new THREE.SpotLight(0xfffbeb, 0, 95, Math.PI / 5, 0.45, 1.35);
  headlightLeftSpot.position.set(-0.98, 0.95, -2.82);
  headlightLeftSpot.target.position.set(-1.2, 0.1, -42);
  cabinSuspensionGroup.add(headlightLeftSpot);
  cabinSuspensionGroup.add(headlightLeftSpot.target);

  const headlightRightSpot = new THREE.SpotLight(0xfffbeb, 0, 95, Math.PI / 5, 0.45, 1.35);
  headlightRightSpot.position.set(0.98, 0.95, -2.82);
  headlightRightSpot.target.position.set(1.2, 0.1, -42);
  cabinSuspensionGroup.add(headlightRightSpot);
  cabinSuspensionGroup.add(headlightRightSpot.target);

  const createWingMirrorAssembly = (side: -1 | 1): THREE.Mesh => {
    const mirrorGroup = new THREE.Group();
    for (const ay of [2.64, 2.12]) {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.36, 8).rotateZ(Math.PI / 2),
        cabSecondaryPaintMat
      );
      arm.position.set(side * 1.32, ay, -2.38);
      mirrorGroup.add(arm);
    }

    const headPivot = new THREE.Group();
    headPivot.position.set(side * 1.46, 2.38, -2.36);
    headPivot.rotation.y = side * -0.18;

    const housing = new THREE.Mesh(
      createRoundedBoxGeometry(0.2, 0.62, 0.12, 0.03, 3),
      cabSecondaryPaintMat
    );
    headPivot.add(housing);

    const mirrorFaceMat = new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
    });
    const mirrorFace = new THREE.Mesh(new THREE.PlaneGeometry(0.155, 0.54), mirrorFaceMat);
    mirrorFace.position.set(0, 0, 0.062);
    headPivot.add(mirrorFace);

    mirrorGroup.add(headPivot);
    cabinSuspensionGroup.add(mirrorGroup);
    return mirrorFace;
  };
  const leftMirrorMesh = createWingMirrorAssembly(-1);
  const rightMirrorMesh = createWingMirrorAssembly(1);

  const mirrorCameraAnchor = new THREE.Object3D();
  mirrorCameraAnchor.position.set(1.48, 2.38, -2.25);
  cabinSuspensionGroup.add(mirrorCameraAnchor);

  // ============================================================================
  // 3. AAA First-Person Right-Hand-Drive (RHD) Cockpit Interior
  // ============================================================================
  const cabinAmbientLight = new THREE.PointLight(0xffe4b5, 0.95, 3.8, 1.2);
  cabinAmbientLight.position.set(0.18, 2.68, -1.65);
  cabinSuspensionGroup.add(cabinAmbientLight);

  const cabinFloor = new THREE.Mesh(
    new THREE.BoxGeometry(2.36, 0.08, 2.15),
    matteBumperMat
  );
  cabinFloor.position.set(0, 1.32, -1.52);
  cabinSuspensionGroup.add(cabinFloor);

  for (const side of [-1, 1]) {
    const doorCard = new THREE.Mesh(
      createRoundedBoxGeometry(0.1, 0.72, 1.45, 0.03, 2),
      cabinUpholsteryMat
    );
    doorCard.position.set(side * 1.16, 1.58, -1.85);
    cabinSuspensionGroup.add(doorCard);

    const armrest = new THREE.Mesh(
      createRoundedBoxGeometry(0.14, 0.08, 0.62, 0.03, 2),
      leatherDashMat
    );
    armrest.position.set(side * 1.1, 1.76, -1.68);
    cabinSuspensionGroup.add(armrest);

    const grabBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.55, 8),
      brushedAlumMat
    );
    grabBar.position.set(side * 1.09, 2.38, -2.46);
    grabBar.rotation.x = -0.15;
    cabinSuspensionGroup.add(grabBar);
  }

  const dashDeck = new THREE.Mesh(
    createRoundedBoxGeometry(2.32, 0.42, 0.68, 0.06, 4),
    leatherDashMat
  );
  dashDeck.position.set(0, 1.68, -2.32);
  cabinSuspensionGroup.add(dashDeck);

  const dashTrimStrip = new THREE.Mesh(
    createRoundedBoxGeometry(2.26, 0.032, 0.68, 0.01, 2),
    brushedAlumMat
  );
  dashTrimStrip.position.set(0, 1.85, -2.31);
  cabinSuspensionGroup.add(dashTrimStrip);

  const binnacleHood = new THREE.Mesh(
    createRoundedBoxGeometry(0.68, 0.05, 0.28, 0.02, 3),
    leatherDashMat
  );
  binnacleHood.position.set(0.58, 2.1, -2.24);
  cabinSuspensionGroup.add(binnacleHood);

  const binnacleBack = new THREE.Mesh(
    createRoundedBoxGeometry(0.68, 0.3, 0.14, 0.02, 2),
    leatherDashMat
  );
  binnacleBack.position.set(0.58, 1.95, -2.29);
  cabinSuspensionGroup.add(binnacleBack);

  const clusterPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.28),
    new THREE.MeshBasicMaterial({ map: textures.dashboardClusterMap })
  );
  clusterPlane.position.set(0.58, 1.94, -2.21);
  clusterPlane.rotation.x = -0.16;
  cabinSuspensionGroup.add(clusterPlane);

  const needleMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
  const rpmNeedle = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.072, 0.004), needleMat);
  rpmNeedle.position.set(0.415, 1.935, -2.2);
  cabinSuspensionGroup.add(rpmNeedle);

  const speedNeedle = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.072, 0.004), needleMat);
  speedNeedle.position.set(0.745, 1.935, -2.2);
  cabinSuspensionGroup.add(speedNeedle);

  const centerConsolePod = new THREE.Group();
  centerConsolePod.position.set(0.02, 1.96, -2.18);
  centerConsolePod.rotation.y = 0.26;
  centerConsolePod.rotation.x = -0.14;

  const consoleBezel = new THREE.Mesh(
    createRoundedBoxGeometry(0.46, 0.34, 0.12, 0.025, 3),
    leatherDashMat
  );
  centerConsolePod.add(consoleBezel);

  const gpsScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.26),
    new THREE.MeshBasicMaterial({ map: textures.gpsNavMap })
  );
  gpsScreen.position.set(0, 0.02, 0.062);
  centerConsolePod.add(gpsScreen);

  for (let b = -3; b <= 3; b++) {
    const btnColor = b === 0 ? 0xef4444 : b === 3 ? 0xfacc15 : 0x38bdf8;
    const sw = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.028, 0.02),
      new THREE.MeshBasicMaterial({ color: btnColor })
    );
    sw.position.set(b * 0.052, -0.13, 0.062);
    centerConsolePod.add(sw);
  }
  cabinSuspensionGroup.add(centerConsolePod);

  const gearConsole = new THREE.Mesh(
    createRoundedBoxGeometry(0.36, 0.42, 0.62, 0.05, 3),
    leatherDashMat
  );
  gearConsole.position.set(0.12, 1.52, -1.62);
  cabinSuspensionGroup.add(gearConsole);

  const shifterBoot = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.16, 12),
    cabinUpholsteryMat
  );
  shifterBoot.position.set(0.18, 1.78, -1.58);
  cabinSuspensionGroup.add(shifterBoot);

  // Interactive 3D Gear Shift Lever Pivot Group (moves physically with gear changes — R6)
  const shifterPivotGroup = new THREE.Group();
  shifterPivotGroup.position.set(0.18, 1.78, -1.58);

  const shifterRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.016, 0.28, 10),
    chromeMat
  );
  shifterRod.position.set(0, 0.14, 0);
  shifterRod.rotation.z = -0.12;
  shifterPivotGroup.add(shifterRod);

  const shifterKnob = new THREE.Mesh(
    createRoundedBoxGeometry(0.055, 0.085, 0.065, 0.02, 3),
    leatherDashMat
  );
  shifterKnob.position.set(0.02, 0.28, 0);
  shifterPivotGroup.add(shifterKnob);
  cabinSuspensionGroup.add(shifterPivotGroup);

  const overheadConsole = new THREE.Mesh(
    createRoundedBoxGeometry(2.28, 0.22, 0.46, 0.04, 3),
    cabinUpholsteryMat
  );
  overheadConsole.position.set(0, 2.94, -2.38);
  cabinSuspensionGroup.add(overheadConsole);

  // Authentic Indian Truck Cabin Detailing (R6):
  // 1. Marigold ("Genda Phool") Garland & Red/Gold Fringed Valance ("Jhalar") along Top Windshield Header
  const garlandGroup = new THREE.Group();
  garlandGroup.position.set(0, 2.83, -2.56);

  const valanceStrip = new THREE.Mesh(
    new THREE.BoxGeometry(2.22, 0.065, 0.025),
    new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.7 })
  );
  garlandGroup.add(valanceStrip);

  const marigoldOrangeMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0x9a3412,
    emissiveIntensity: 0.22,
    roughness: 0.6,
  });
  const marigoldYellowMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0x854d0e,
    emissiveIntensity: 0.2,
    roughness: 0.6,
  });
  const flowerGeo = new THREE.IcosahedronGeometry(0.026, 1);

  for (let f = -16; f <= 16; f++) {
    const fx = f * 0.066;
    const catenarySag = Math.cos((f / 8) * Math.PI) * 0.032 - 0.042;
    const flower = new THREE.Mesh(
      flowerGeo,
      Math.abs(f) % 2 === 0 ? marigoldOrangeMat : marigoldYellowMat
    );
    flower.position.set(fx, catenarySag, 0.015);
    garlandGroup.add(flower);
  }
  // Hanging center marigold mala & brass bell ("Ghanti") below header
  for (let v = 1; v <= 5; v++) {
    const dropFlower = new THREE.Mesh(
      flowerGeo,
      v % 2 === 0 ? marigoldYellowMat : marigoldOrangeMat
    );
    dropFlower.position.set(0.02, -0.04 - v * 0.038, 0.02);
    garlandGroup.add(dropFlower);
  }
  const brassBell = new THREE.Mesh(
    new THREE.ConeGeometry(0.026, 0.048, 12),
    cabTrimGoldMat
  );
  brassBell.position.set(0.02, -0.26, 0.02);
  garlandGroup.add(brassBell);
  cabinSuspensionGroup.add(garlandGroup);

  // 2. Traditional Brass Dashboard Ornament & Teakwood Dash Inlay on Center Dash
  const teakInlay = new THREE.Mesh(
    createRoundedBoxGeometry(2.24, 0.042, 0.66, 0.01, 2),
    new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.45, metalness: 0.15 })
  );
  teakInlay.position.set(0, 1.86, -2.3);
  cabinSuspensionGroup.add(teakInlay);

  const dashOrnamentBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.058, 0.025, 16),
    cabTrimGoldMat
  );
  dashOrnamentBase.position.set(-0.26, 1.9, -2.24);
  cabinSuspensionGroup.add(dashOrnamentBase);

  const dashOrnamentArch = new THREE.Mesh(
    new THREE.TorusGeometry(0.046, 0.008, 10, 20, Math.PI),
    cabTrimGoldMat
  );
  dashOrnamentArch.position.set(-0.26, 1.95, -2.24);
  cabinSuspensionGroup.add(dashOrnamentArch);

  const tachographDisplay = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.06),
    new THREE.MeshBasicMaterial({ color: 0x10b981 })
  );
  tachographDisplay.position.set(0.58, 2.9, -2.14);
  tachographDisplay.rotation.x = 0.25;
  cabinSuspensionGroup.add(tachographDisplay);

  const steeringColumn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.065, 0.44, 14),
    leatherDashMat
  );
  steeringColumn.position.set(0.58, 1.75, -2.02);
  steeringColumn.rotation.x = Math.PI / 2 - 0.42;
  cabinSuspensionGroup.add(steeringColumn);

  const indicatorStalkPivot = new THREE.Group();
  indicatorStalkPivot.position.set(0.58, 1.8, -1.94);
  for (const side of [-1, 1]) {
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.014, 0.22, 8).rotateZ(Math.PI / 2),
      matteBumperMat
    );
    stalk.position.set(side * 0.12, 0, 0);
    indicatorStalkPivot.add(stalk);
  }
  cabinSuspensionGroup.add(indicatorStalkPivot);

  const steeringWheelGroup = new THREE.Group();
  steeringWheelGroup.position.set(0.58, 1.84, -1.86);
  steeringWheelGroup.rotation.x = -0.42;

  const wheelRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.235, 0.024, 16, 36),
    leatherDashMat
  );
  steeringWheelGroup.add(wheelRim);

  const topCenterRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.235, 0.025, 12, 12, 0.14),
    new THREE.MeshBasicMaterial({ color: 0xf97316 })
  );
  topCenterRing.rotation.z = Math.PI / 2 - 0.07;
  steeringWheelGroup.add(topCenterRing);

  const centerBoss = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.068, 0.045, 20).rotateX(Math.PI / 2),
    leatherDashMat
  );
  steeringWheelGroup.add(centerBoss);

  const hornEmblem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 0.048, 16).rotateX(Math.PI / 2),
    cabTrimGoldMat
  );
  steeringWheelGroup.add(hornEmblem);

  const spokeLeft = new THREE.Mesh(
    createRoundedBoxGeometry(0.21, 0.032, 0.022, 0.008, 2),
    brushedAlumMat
  );
  spokeLeft.position.set(-0.11, -0.035, 0);
  spokeLeft.rotation.z = 0.26;
  steeringWheelGroup.add(spokeLeft);

  const spokeRight = new THREE.Mesh(
    createRoundedBoxGeometry(0.21, 0.032, 0.022, 0.008, 2),
    brushedAlumMat
  );
  spokeRight.position.set(0.11, -0.035, 0);
  spokeRight.rotation.z = -0.26;
  steeringWheelGroup.add(spokeRight);

  const spokeBottom = new THREE.Mesh(
    createRoundedBoxGeometry(0.038, 0.2, 0.022, 0.008, 2),
    brushedAlumMat
  );
  spokeBottom.position.y = -0.115;
  steeringWheelGroup.add(spokeBottom);

  cabinSuspensionGroup.add(steeringWheelGroup);

  // Patterned Indian Bolster Seat Covers & Rear Sleeper Berth (R6)
  const bolsterCoverMat = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d,
    normalMap: textures.leatherNormalMap,
    roughness: 0.72,
  });
  for (const sx of [0.58, -0.58]) {
    const seatCushion = new THREE.Mesh(
      createRoundedBoxGeometry(0.56, 0.16, 0.56, 0.04, 3),
      bolsterCoverMat
    );
    seatCushion.position.set(sx, 1.46, -1.24);
    cabinSuspensionGroup.add(seatCushion);

    const seatBack = new THREE.Mesh(
      createRoundedBoxGeometry(0.54, 0.78, 0.16, 0.04, 3),
      bolsterCoverMat
    );
    seatBack.position.set(sx, 1.88, -1.02);
    seatBack.rotation.x = -0.08;
    cabinSuspensionGroup.add(seatBack);

    const headrest = new THREE.Mesh(
      createRoundedBoxGeometry(0.32, 0.24, 0.14, 0.04, 3),
      cabTrimGoldMat
    );
    headrest.position.set(sx, 2.34, -0.98);
    cabinSuspensionGroup.add(headrest);
  }

  // Rear Cabin Sleeper Berth & Bolster Pillow ("Gadda")
  const sleeperBerth = new THREE.Mesh(
    createRoundedBoxGeometry(2.22, 0.18, 0.54, 0.04, 3),
    bolsterCoverMat
  );
  sleeperBerth.position.set(0, 1.44, -0.68);
  cabinSuspensionGroup.add(sleeperBerth);

  const bolsterPillow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.58, 14).rotateX(Math.PI / 2),
    cabTrimGoldMat
  );
  bolsterPillow.position.set(-0.78, 1.58, -0.68);
  cabinSuspensionGroup.add(bolsterPillow);

  const cabinCameraAnchor = new THREE.Object3D();
  cabinCameraAnchor.position.set(0.58, 2.34, -1.32);
  cabinSuspensionGroup.add(cabinCameraAnchor);

  // ============================================================================
  // 4. 6 Tractor Wheels (Front Steerable Axle + Tandem Rear Drive Bogie)
  // ============================================================================
  const frontLeftSteerPivot = new THREE.Group();
  frontLeftSteerPivot.position.set(-1.08, 0.54, -1.85);
  const flWheel = createHeavyWheelGroup(tireRubberMat, steelRimMat, chromeMat, chassisSteelMat, false);
  frontLeftSteerPivot.add(flWheel);
  tractorRoot.add(frontLeftSteerPivot);

  const frontRightSteerPivot = new THREE.Group();
  frontRightSteerPivot.position.set(1.08, 0.54, -1.85);
  const frWheel = createHeavyWheelGroup(tireRubberMat, steelRimMat, chromeMat, chassisSteelMat, false);
  frontRightSteerPivot.add(frWheel);
  tractorRoot.add(frontRightSteerPivot);

  const tractorWheelMeshes: THREE.Group[] = [flWheel, frWheel];
  const rearAxleZs = [1.15, 2.48];
  for (const rz of rearAxleZs) {
    const rl = createHeavyWheelGroup(tireRubberMat, steelRimMat, chromeMat, chassisSteelMat, true);
    rl.position.set(-1.02, 0.54, rz);
    tractorRoot.add(rl);
    tractorWheelMeshes.push(rl);

    const rr = createHeavyWheelGroup(tireRubberMat, steelRimMat, chromeMat, chassisSteelMat, true);
    rr.position.set(1.02, 0.54, rz);
    tractorRoot.add(rr);
    tractorWheelMeshes.push(rr);
  }

  // ============================================================================
  // 5. Articulated 40ft Container Semi-Trailer (`trailerRoot`)
  // ============================================================================
  const trailerRoot = new THREE.Group();

  const trailerShadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 13.0), contactShadowMat);
  trailerShadow.rotation.x = -Math.PI / 2;
  trailerShadow.position.set(0, 0.02, 0);
  trailerRoot.add(trailerShadow);

  const containerEndMat = new THREE.MeshStandardMaterial({
    color: 0x173152,
    normalMap: textures.containerNormalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    metalness: 0.38,
    roughness: 0.58,
  });
  const containerRearDoorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.containerRearMap,
    normalMap: textures.containerNormalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    metalness: 0.35,
    roughness: 0.52,
  });
  const containerSideMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.containerSideMap,
    normalMap: textures.containerNormalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    metalness: 0.34,
    roughness: 0.52,
  });

  if (truckModelId === 'bharatbenz_4228r') {
    // 3. BharatBenz 4228R Tanker Variant: Polished Stainless-Steel Cylindrical Petroleum Tanker Barrel
    const tankBarrelGeo = new THREE.CylinderGeometry(1.18, 1.18, 11.4, 32).rotateX(Math.PI / 2);
    const tankBarrelMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      metalness: 0.92,
      roughness: 0.14,
      clearcoat: isSoftwareGl ? 0 : 0.85,
    });
    const tankBarrel = new THREE.Mesh(tankBarrelGeo, tankBarrelMat);
    tankBarrel.scale.set(1.06, 0.92, 1);
    tankBarrel.position.set(0, 2.38, 0);
    tankBarrel.castShadow = !isSoftwareGl;
    trailerRoot.add(tankBarrel);

    // Front & Rear Hemispherical Tank End Caps
    for (const endZ of [-5.7, 5.7]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.18, 24, 16), tankBarrelMat);
      cap.scale.set(1.06, 0.92, 0.35);
      cap.position.set(0, 2.38, endZ);
      trailerRoot.add(cap);
    }

    // 5 Structural Circumferential Reinforcing Rings + Top Inspection Manway Domes
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      metalness: 0.55,
      roughness: 0.3,
    });
    for (const rz of [-4.4, -2.2, 0, 2.2, 4.4]) {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(1.22, 1.22, 0.18, 28).rotateX(Math.PI / 2),
        ringMat
      );
      ring.scale.set(1.06, 0.92, 1);
      ring.position.set(0, 2.38, rz);
      trailerRoot.add(ring);

      const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.22, 16), chromeMat);
      dome.position.set(0, 3.52, rz);
      trailerRoot.add(dome);
    }

    // Hazmat Orange & Red Warning Stripe along Tanker Flanks
    const hazmatStripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.58, 0.24, 10.8),
      new THREE.MeshBasicMaterial({ color: 0xea580c })
    );
    hazmatStripe.position.set(0, 2.38, 0);
    trailerRoot.add(hazmatStripe);

    // Top Catwalk Walkway & Rear Access Ladder
    const topCatwalk = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.05, 10.6), brushedAlumMat);
    topCatwalk.position.set(0.45, 3.55, 0);
    trailerRoot.add(topCatwalk);
  } else {
    // 1. Default Tata Prima 4928.S Variant: 40ft Corrugated ISO Shipping Container
    const containerBox = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.72, 11.8), [
      containerSideMat,
      containerSideMat,
      containerEndMat,
      chassisSteelMat,
      containerRearDoorMat,
      containerEndMat,
    ]);
    containerBox.position.set(0, 2.58, 0);
    containerBox.castShadow = !isSoftwareGl;
    containerBox.receiveShadow = !isSoftwareGl;
    trailerRoot.add(containerBox);

    const cornerGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    for (const cx of [-1.2, 1.2]) {
      for (const cy of [1.28, 3.88]) {
        for (const cz of [-5.84, 5.84]) {
          const corner = new THREE.Mesh(cornerGeo, cabTrimGoldMat);
          corner.position.set(cx, cy, cz);
          trailerRoot.add(corner);
        }
      }
    }
  }

  // Hide articulated trailer on rigid 10-wheeler Ashok Leyland 3520 Goods Carrier
  if (truckModelId === 'ashok_leyland_3520') {
    trailerRoot.visible = false;
    redSuzie.visible = false;
    yellowSuzie.visible = false;
    fifthWheelBase.visible = false;
    fifthWheelPlate.visible = false;
  }

  const trailerChassis = new THREE.Mesh(
    createRoundedBoxGeometry(1.88, 0.34, 11.65, 0.04, 2),
    chassisSteelMat
  );
  trailerChassis.position.set(0, 1.06, 0.1);
  trailerRoot.add(trailerChassis);

  for (const lx of [-0.88, 0.88]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.18), matteBumperMat);
    leg.position.set(lx, 0.68, -2.85);
    trailerRoot.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.32), chassisSteelMat);
    foot.position.set(lx, 0.32, -2.85);
    trailerRoot.add(foot);
  }

  for (const side of [-1, 1]) {
    for (const ry of [0.62, 0.84]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 4.8), brushedAlumMat);
      bar.position.set(side * 1.18, ry, -0.15);
      trailerRoot.add(bar);
    }
    for (const mz of [-4.8, -1.6, 1.6, 4.8]) {
      const sideLed = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.06, 0.14),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b })
      );
      sideLed.position.set(side * 1.26, 1.15, mz);
      trailerRoot.add(sideLed);
    }
  }

  const spareTire = createHeavyWheelGroup(tireRubberMat, steelRimMat, chromeMat, chassisSteelMat, false);
  spareTire.rotation.z = Math.PI / 2;
  spareTire.position.set(0, 0.58, -0.65);
  trailerRoot.add(spareTire);

  for (const rx of [-0.68, -0.24, 0.24, 0.68]) {
    const lockRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 2.62, 10),
      chromeMat
    );
    lockRod.position.set(rx, 2.58, 5.93);
    trailerRoot.add(lockRod);
  }

  const trailerRearBumper = new THREE.Mesh(
    createRoundedBoxGeometry(2.48, 0.28, 0.22, 0.04, 2),
    matteBumperMat
  );
  trailerRearBumper.position.set(0, 0.66, 5.88);
  trailerRoot.add(trailerRearBumper);

  for (const side of [-1, 1]) {
    const brakeLamp = new THREE.Mesh(
      createRoundedBoxGeometry(0.42, 0.15, 0.06, 0.02, 2),
      brakeLightMat
    );
    brakeLamp.position.set(side * 0.76, 0.66, 5.99);
    trailerRoot.add(brakeLamp);

    const rearInd = new THREE.Mesh(
      createRoundedBoxGeometry(0.24, 0.15, 0.06, 0.02, 2),
      side === -1 ? indicatorLeftMat : indicatorRightMat
    );
    rearInd.position.set(side * 1.09, 0.66, 5.99);
    trailerRoot.add(rearInd);
  }

  const trailerWheelMeshes: THREE.Group[] = [];
  const trailerAxleZs = [2.2, 3.45, 4.7];
  for (const side of [-1, 1]) {
    const bogieFender = new THREE.Mesh(
      createRoundedBoxGeometry(0.66, 0.14, 3.85, 0.04, 2),
      cabSecondaryPaintMat
    );
    bogieFender.position.set(side * 1.06, 1.12, 3.45);
    trailerRoot.add(bogieFender);
  }
  for (const tz of trailerAxleZs) {
    const tl = createHeavyWheelGroup(tireRubberMat, steelRimMat, chromeMat, chassisSteelMat, true);
    tl.position.set(-1.04, 0.54, tz);
    trailerRoot.add(tl);
    trailerWheelMeshes.push(tl);

    const tr = createHeavyWheelGroup(tireRubberMat, steelRimMat, chromeMat, chassisSteelMat, true);
    tr.position.set(1.04, 0.54, tz);
    trailerRoot.add(tr);
    trailerWheelMeshes.push(tr);
  }

  return {
    truckModelId,
    tractorRoot,
    cabinSuspensionGroup,
    trailerRoot,
    steeringWheelGroup,
    shifterPivotGroup,
    indicatorStalkPivot,
    garlandGroup,
    rpmNeedle,
    speedNeedle,
    frontLeftSteerPivot,
    frontRightSteerPivot,
    tractorWheelMeshes,
    trailerWheelMeshes,
    headlightLeftSpot,
    headlightRightSpot,
    headlightLensMat,
    brakeLightMat,
    indicatorLeftMat,
    indicatorRightMat,
    cabinCameraAnchor,
    mirrorCameraAnchor,
    rightMirrorMesh,
    leftMirrorMesh,
    coolingFanGroup,
    exhaustPuffs,
    cabPaintMat,
  };
}

/**
 * Synchronizes the 3D Tractor, Cabin Suspension, Steering Wheel, Interactive Gear Lever & Indicator Stalk,
 * Instrument Dials, Lights, Spinning Cooling Fan, Exhaust Smoke Plume, and Articulated Trailer meshes.
 */
export function syncPlayerRigMeshes(
  meshes: PlayerRigMeshes,
  state: TruckPhysicsState,
  isBraking: boolean,
  isSoftwareGl: boolean
): void {
  meshes.tractorRoot.position.set(state.x, state.y, state.z);
  meshes.tractorRoot.rotation.set(0, -state.heading, 0, 'YXZ');

  // Visible Cab Suspension Pitch, Roll & Vertical Bounce (R4 & R5)
  const avgFrontCompression =
    ((state.wheels[0]?.compression ?? 0.4) + (state.wheels[1]?.compression ?? 0.4)) * 0.5;
  meshes.cabinSuspensionGroup.position.y = (avgFrontCompression - 0.4) * 0.16;
  meshes.cabinSuspensionGroup.rotation.set(state.pitch * 1.35, 0, -state.roll * 1.35, 'YXZ');

  // Front wheel steering + vertical suspension travel on all 6 tractor wheels (R5)
  meshes.frontLeftSteerPivot.rotation.y = -state.steerAngleRad * 1.15;
  meshes.frontRightSteerPivot.rotation.y = -state.steerAngleRad * 1.15;
  meshes.frontLeftSteerPivot.position.y =
    0.54 + ((state.wheels[0]?.compression ?? 0.4) - 0.4) * 0.18;
  meshes.frontRightSteerPivot.position.y =
    0.54 + ((state.wheels[1]?.compression ?? 0.4) - 0.4) * 0.18;

  for (let i = 0; i < meshes.tractorWheelMeshes.length; i++) {
    const w = meshes.tractorWheelMeshes[i];
    w.rotation.x = -state.wheelRotationRad;
    if (i >= 2 && state.wheels[i]) {
      w.position.y = 0.54 + (state.wheels[i].compression - 0.4) * 0.18;
    }
  }
  for (const w of meshes.trailerWheelMeshes) {
    w.rotation.x = -state.wheelRotationRad;
  }

  // Spin the 9-blade radiator cooling fan behind the front grille proportional to engine RPM
  meshes.coolingFanGroup.rotation.z -= (state.rpm / 600) * 0.18;

  // Animate diesel exhaust puffs rising from the chrome stack
  const loadFactor = Math.max(0.2, Math.min(1.0, (state.rpm - 600) / 1600));
  const phase = performance.now() * 0.0032;
  for (let i = 0; i < meshes.exhaustPuffs.length; i++) {
    const puff = meshes.exhaustPuffs[i];
    const t = (phase + i * 0.2) % 1.0;
    puff.position.set(
      -1.14 + Math.sin(t * 6.0 + i) * 0.06,
      4.02 + t * 1.45,
      -0.18 + t * (0.45 + state.speedMs * 0.04)
    );
    const s = (0.45 + t * 1.65) * (0.65 + loadFactor * 0.65);
    puff.scale.setScalar(s);
    (puff.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.24 * loadFactor;
  }

  // Interactive Cabin Detailing (R6):
  // 1. Steering Wheel turns with steering input
  meshes.steeringWheelGroup.rotation.z = state.steerAngleRad * 6.5;

  // 2. Gear Shifter Lever physically moves fore/aft and left/right with gear changes
  const gearGateCol = (state.gearIndex % 3) - 1; // -1, 0, +1
  const gearGateRow = state.gearIndex === 2 ? 0 : state.gearIndex % 2 === 1 ? -1 : 1;
  meshes.shifterPivotGroup.rotation.x +=
    (gearGateRow * 0.22 - meshes.shifterPivotGroup.rotation.x) * 0.25;
  meshes.shifterPivotGroup.rotation.z +=
    (-0.12 + gearGateCol * 0.14 - meshes.shifterPivotGroup.rotation.z) * 0.25;

  // 3. Indicator Stalk tilts with turn signal state
  const targetStalkAngle =
    state.indicator === 'left' ? 0.28 : state.indicator === 'right' ? -0.28 : 0;
  meshes.indicatorStalkPivot.rotation.z +=
    (targetStalkAngle - meshes.indicatorStalkPivot.rotation.z) * 0.3;

  // 4. Windshield marigold garland & brass bell sway gently with lateral roll and pitch
  meshes.garlandGroup.rotation.z = state.roll * 1.8;
  meshes.garlandGroup.rotation.x = -state.pitch * 1.4;

  const rpmFrac = Math.max(0, Math.min(1, state.rpm / 2500));
  meshes.rpmNeedle.rotation.z = (0.5 - rpmFrac) * Math.PI * 1.35;

  const speedFrac = Math.max(0, Math.min(1, state.speedKmh / 120));
  meshes.speedNeedle.rotation.z = (0.5 - speedFrac) * Math.PI * 1.35;

  const beamIntensity = state.headlightsOn ? (state.highBeamOn ? 115 : 58) : 0;
  if (!isSoftwareGl) {
    meshes.headlightLeftSpot.intensity = beamIntensity;
    meshes.headlightRightSpot.intensity = beamIntensity;
    meshes.headlightLeftSpot.distance = state.highBeamOn ? 135 : 85;
    meshes.headlightRightSpot.distance = state.highBeamOn ? 135 : 85;
  }
  meshes.headlightLensMat.emissiveIntensity = state.headlightsOn ? 2.4 : 0.4;
  meshes.brakeLightMat.emissiveIntensity = isBraking ? 2.8 : state.headlightsOn ? 0.85 : 0.25;

  const leftOn =
    state.indicatorBlinkOn && (state.indicator === 'left' || state.indicator === 'hazard');
  const rightOn =
    state.indicatorBlinkOn && (state.indicator === 'right' || state.indicator === 'hazard');
  meshes.indicatorLeftMat.emissiveIntensity = leftOn ? 2.6 : 0;
  meshes.indicatorRightMat.emissiveIntensity = rightOn ? 2.6 : 0;

  meshes.trailerRoot.visible = meshes.truckModelId !== 'ashok_leyland_3520';
  meshes.trailerRoot.position.set(state.trailerX, state.trailerY, state.trailerZ);
  meshes.trailerRoot.rotation.set(
    state.trailerPitch,
    -state.trailerHeading,
    -state.trailerRoll,
    'YXZ'
  );
}

// ============================================================================
// Shared Cached Traffic Geometries & Materials (Zero Redundant Buffer Allocations)
// ============================================================================
interface CachedTrafficGeometries {
  lorryCab: THREE.BufferGeometry;
  lorryCrown: THREE.BufferGeometry;
  lorryWs: THREE.BufferGeometry;
  lorryGrille: THREE.BufferGeometry;
  lorryCargo: THREE.BufferGeometry;
  busHull: THREE.BufferGeometry;
  busWindowBand: THREE.BufferGeometry;
  busFrontGlass: THREE.BufferGeometry;
  busAcPod: THREE.BufferGeometry;
  pickupCab: THREE.BufferGeometry;
  pickupGlass: THREE.BufferGeometry;
  pickupBed: THREE.BufferGeometry;
  pickupCage: THREE.BufferGeometry;
  sedanBody: THREE.BufferGeometry;
  sedanGreenhouse: THREE.BufferGeometry;
  sedanGrille: THREE.BufferGeometry;
  hlLamp: THREE.BufferGeometry;
  tlLamp: THREE.BufferGeometry;
  heavyTire: THREE.BufferGeometry;
  heavyRim: THREE.BufferGeometry;
  lightTire: THREE.BufferGeometry;
  lightRim: THREE.BufferGeometry;
  trimMat: THREE.MeshStandardMaterial;
  chromeMat: THREE.MeshStandardMaterial;
  glassMat: THREE.MeshStandardMaterial;
  headlightMat: THREE.MeshBasicMaterial;
  crownMat: THREE.MeshStandardMaterial;
  tarpMat: THREE.MeshStandardMaterial;
  cageMat: THREE.MeshStandardMaterial;
}

let _trafficCache: CachedTrafficGeometries | null = null;

function getTrafficCache(): CachedTrafficGeometries {
  if (_trafficCache) return _trafficCache;

  _trafficCache = {
    lorryCab: createSideProfileGeometry(
      [
        [-4.35, 0.68],
        [-4.38, 1.48],
        [-4.22, 2.48],
        [-2.15, 2.52],
        [-2.15, 0.68],
      ],
      2.38,
      0.08,
      3
    ),
    lorryCrown: createSideProfileGeometry(
      [
        [-4.15, 2.48],
        [-4.28, 3.18],
        [-3.15, 3.28],
        [-3.15, 2.48],
      ],
      2.24,
      0.06,
      3
    ),
    lorryWs: createRoundedBoxGeometry(2.12, 0.72, 0.1, 0.02, 2),
    lorryGrille: createRoundedBoxGeometry(1.64, 0.56, 0.1, 0.02, 2),
    lorryCargo: new THREE.BoxGeometry(2.46, 2.68, 6.55),

    busHull: createSideProfileGeometry(
      [
        [-5.58, 0.58],
        [-5.65, 1.45],
        [-5.38, 3.12],
        [5.48, 3.16],
        [5.58, 2.85],
        [5.58, 0.62],
      ],
      2.54,
      0.1,
      4
    ),
    busWindowBand: createRoundedBoxGeometry(2.57, 0.96, 10.4, 0.03, 2),
    busFrontGlass: createRoundedBoxGeometry(2.36, 1.18, 0.12, 0.03, 2),
    busAcPod: createRoundedBoxGeometry(1.78, 0.28, 2.45, 0.06, 3),

    pickupCab: createSideProfileGeometry(
      [
        [-2.35, 0.48],
        [-2.38, 1.05],
        [-1.42, 1.16],
        [-0.96, 1.88],
        [0.12, 1.88],
        [0.12, 0.48],
      ],
      1.88,
      0.07,
      3
    ),
    pickupGlass: createRoundedBoxGeometry(1.76, 0.62, 1.05, 0.04, 2),
    pickupBed: createRoundedBoxGeometry(1.94, 0.85, 2.38, 0.04, 2),
    pickupCage: createRoundedBoxGeometry(1.88, 0.68, 2.28, 0.03, 2),

    sedanBody: createSideProfileGeometry(
      [
        [-2.25, 0.38],
        [-2.28, 0.78],
        [-1.25, 0.96],
        [-0.52, 1.48],
        [0.88, 1.46],
        [1.72, 1.02],
        [2.22, 0.94],
        [2.25, 0.42],
      ],
      1.86,
      0.08,
      4
    ),
    sedanGreenhouse: createSideProfileGeometry(
      [
        [-1.18, 0.94],
        [-0.48, 1.45],
        [0.82, 1.43],
        [1.58, 0.98],
      ],
      1.62,
      0.05,
      3
    ),
    sedanGrille: createRoundedBoxGeometry(1.12, 0.28, 0.08, 0.02, 2),

    hlLamp: createRoundedBoxGeometry(0.36, 0.16, 0.08, 0.02, 2),
    tlLamp: createRoundedBoxGeometry(0.42, 0.16, 0.08, 0.02, 2),
    heavyTire: new THREE.CylinderGeometry(0.48, 0.48, 0.28, 16).rotateZ(Math.PI / 2),
    heavyRim: new THREE.CylinderGeometry(0.3, 0.3, 0.3, 12).rotateZ(Math.PI / 2),
    lightTire: new THREE.CylinderGeometry(0.38, 0.38, 0.26, 16).rotateZ(Math.PI / 2),
    lightRim: new THREE.CylinderGeometry(0.24, 0.24, 0.28, 12).rotateZ(Math.PI / 2),

    trimMat: new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.3, roughness: 0.72 }),
    chromeMat: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.18 }),
    glassMat: new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.12 }),
    headlightMat: new THREE.MeshBasicMaterial({ color: 0xfef9c3 }),
    crownMat: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.38 }),
    tarpMat: new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.8 }),
    cageMat: new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 }),
  };

  return _trafficCache;
}

/**
 * Builds a high-detail sculpted 3D AI Traffic Vehicle mesh (`lorry`, `bus`, `sedan`, `pickup`)
 * using shared cached beveled profile extrusions for zero lag across all hardware tiers.
 */
export function buildTrafficVehicleMesh(
  archetype: TrafficArchetype,
  colorHex: number,
  textures?: HighwayTextureSet
): { root: THREE.Group; brakeMat: THREE.MeshBasicMaterial } {
  const root = new THREE.Group();
  const c = getTrafficCache();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    metalness: 0.48,
    roughness: 0.3,
  });
  const brakeMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });

  const shadowLen = archetype === 'bus' ? 11.8 : archetype === 'lorry' ? 9.2 : 5.2;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, shadowLen),
    getSharedContactShadowMaterial()
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  if (archetype === 'lorry') {
    root.add(new THREE.Mesh(c.lorryCab, bodyMat));
    root.add(new THREE.Mesh(c.lorryCrown, c.crownMat));

    const ws = new THREE.Mesh(c.lorryWs, c.glassMat);
    ws.position.set(0, 1.96, -4.28);
    ws.rotation.x = -0.14;
    root.add(ws);

    const grille = new THREE.Mesh(c.lorryGrille, c.chromeMat);
    grille.position.set(0, 1.12, -4.36);
    root.add(grille);

    const cargoMat = new THREE.MeshStandardMaterial({
      color: 0x9a3412,
      normalMap: textures?.containerNormalMap,
      roughness: 0.68,
    });
    const tailgateMat = textures
      ? new THREE.MeshStandardMaterial({ map: textures.lorryTailgateMap, roughness: 0.6 })
      : cargoMat;

    const cargoBox = new THREE.Mesh(c.lorryCargo, [
      cargoMat,
      cargoMat,
      c.tarpMat,
      c.trimMat,
      tailgateMat,
      cargoMat,
    ]);
    cargoBox.position.set(0, 1.98, 1.25);
    root.add(cargoBox);
  } else if (archetype === 'bus') {
    root.add(new THREE.Mesh(c.busHull, bodyMat));

    const windowBand = new THREE.Mesh(c.busWindowBand, c.glassMat);
    windowBand.position.set(0, 2.28, -0.1);
    root.add(windowBand);

    const frontGlass = new THREE.Mesh(c.busFrontGlass, c.glassMat);
    frontGlass.position.set(0, 2.15, -5.48);
    frontGlass.rotation.x = -0.16;
    root.add(frontGlass);

    for (const az of [-1.8, 1.9]) {
      const acPod = new THREE.Mesh(c.busAcPod, c.trimMat);
      acPod.position.set(0, 3.26, az);
      root.add(acPod);
    }
  } else if (archetype === 'pickup') {
    root.add(new THREE.Mesh(c.pickupCab, bodyMat));

    const cabinGlass = new THREE.Mesh(c.pickupGlass, c.glassMat);
    cabinGlass.position.set(0, 1.54, -0.45);
    root.add(cabinGlass);

    const cargoBed = new THREE.Mesh(c.pickupBed, c.trimMat);
    cargoBed.position.set(0, 0.92, 1.32);
    root.add(cargoBed);

    const cageFrame = new THREE.Mesh(c.pickupCage, c.cageMat);
    cageFrame.position.set(0, 1.62, 1.32);
    root.add(cageFrame);
  } else {
    root.add(new THREE.Mesh(c.sedanBody, bodyMat));
    root.add(new THREE.Mesh(c.sedanGreenhouse, c.glassMat));

    const frontGrille = new THREE.Mesh(c.sedanGrille, c.trimMat);
    frontGrille.position.set(0, 0.62, -2.26);
    root.add(frontGrille);
  }

  const halfLen = archetype === 'bus' ? 5.6 : archetype === 'lorry' ? 4.36 : 2.25;
  const lampSpread = archetype === 'sedan' || archetype === 'pickup' ? 0.68 : 0.88;
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(c.hlLamp, c.headlightMat);
    hl.position.set(side * lampSpread, 0.76, -halfLen);
    root.add(hl);

    const tl = new THREE.Mesh(c.tlLamp, brakeMat);
    tl.position.set(side * lampSpread, 0.82, halfLen);
    root.add(tl);
  }

  const isLight = archetype === 'sedan' || archetype === 'pickup';
  const wheelRadius = isLight ? 0.38 : 0.48;
  const tireGeo = isLight ? c.lightTire : c.heavyTire;
  const rimGeo = isLight ? c.lightRim : c.heavyRim;
  const wheelZ = halfLen * 0.64;
  const wheelX = isLight ? 0.88 : 1.14;
  for (const wx of [-wheelX, wheelX]) {
    for (const wz of [-wheelZ, wheelZ]) {
      const tire = new THREE.Mesh(tireGeo, c.trimMat);
      tire.position.set(wx, wheelRadius, wz);
      root.add(tire);

      const rim = new THREE.Mesh(rimGeo, c.chromeMat);
      rim.position.set(wx, wheelRadius, wz);
      root.add(rim);
    }
  }

  return { root, brakeMat };
}
