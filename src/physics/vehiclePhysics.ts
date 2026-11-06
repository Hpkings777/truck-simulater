import {
  getActiveMapSpec,
  HIGHWAY_LENGTH_M,
  LANE_CENTERS,
  projectWorldToSpline,
  RoadSurfaceType,
  splineToWorld,
} from './highwaySpline';

export type TransmissionMode = 'auto' | 'manual';
export type IndicatorState = 'off' | 'left' | 'right' | 'hazard';

export type DamageZoneId =
  | 'front_left'
  | 'front_center'
  | 'front_right'
  | 'side_left'
  | 'side_right'
  | 'rear';

export interface WindshieldCrackNode {
  id: number;
  normX: number; // 0.08..0.92 across windshield/screen
  normY: number; // 0.14..0.78 vertically
  intensity: number; // 0.15..1.0 scaled by impact severity & nth collision
  nthCollision: number; // 1-based collision index when this crack formed
  zone: DamageZoneId;
  seed: number;
}

export interface TruckControlInput {
  throttle: number; // 0..1 (W / ArrowUp)
  brake: number; // 0..1 (S / ArrowDown)
  serviceAirBrake: boolean; // Spacebar (high-force pneumatic brake / handbrake)
  steer: number; // -1..1 (+1 = steer left, -1 = steer right)
  shiftUpJustPressed: boolean;
  shiftDownJustPressed: boolean;
  engineBrakeActive: boolean;
}

export interface WheelTelemetry {
  id: string;
  contactY: number;
  compression: number; // 0..1 suspension compression
  rotationRad: number;
  steerAngleRad: number;
  slipRatio: number;
}

export interface TruckPhysicsState {
  truckModelId: TruckModelId;
  // Spatial pose of Tractor Unit
  x: number;
  y: number;
  z: number;
  heading: number; // radians (0 = -Z Northbound, + = East/+X)
  pitch: number; // Cabin & chassis pitch (radians, + = nose up)
  roll: number; // Cabin & chassis roll (radians, + = roll right)

  // Kinematics
  speedMs: number; // Signed longitudinal speed (m/s)
  speedKmh: number; // Absolute speed in km/h
  lateralVelocityMs: number;
  yawRateRadS: number;
  accelerationMs2: number;

  // Steering & Wheel state
  steerAngleRad: number; // Current front wheel angle (radians, + = left, - = right)
  wheelRotationRad: number; // Cumulative wheel spin angle
  wheels: WheelTelemetry[];

  // Drivetrain & Engine
  rpm: number; // 650 (idle) .. 2500 (redline)
  gearIndex: number; // 0 = R2, 1 = R1, 2 = N, 3..14 = 1L..6H (12 forward gears)
  gearLabel: string;
  transmissionMode: TransmissionMode;
  shiftCooldownS: number; // Clutch engagement timer during gear shifts
  turboBoostBar: number; // 0.0 .. 1.8 Bar
  engineLoad: number; // 0.0 .. 1.0

  // Pneumatic Air & Fuel Systems
  airPressurePsi: number; // 60 .. 125 PSI
  fuelLiters: number; // Max 400 L
  fuelMaxLiters: number;
  fuelConsumptionL100Km: number;
  airBrakeReleaseTrigger: number; // Increments when air brake releases for hiss SFX
  gearShiftTrigger: number; // Increments when gear changes for shift SFX

  // Articulated 40ft Semi-Trailer
  trailerX: number;
  trailerY: number;
  trailerZ: number;
  trailerHeading: number;
  trailerPitch: number;
  trailerRoll: number;
  articulationAngleRad: number; // Angle between tractor and trailer (-pi..pi)
  jackknifeWarning: boolean;

  // Highway Navigation & Haul Telemetry
  distanceAlongHighwayM: number;
  totalDistanceDrivenM: number;
  lateralOffsetM: number;
  currentSurface: RoadSurfaceType;
  zoneName: string;
  landmarkKm: string;
  speedLimitKmh: number;
  nextWaypointName: string;
  nextWaypointDistanceM: number;
  cargoIntegrityPct: number; // 0..100%

  // Lighting & Cabin Switches
  headlightsOn: boolean;
  highBeamOn: boolean;
  indicator: IndicatorState;
  indicatorBlinkOn: boolean;
  hornActive: boolean;

  // Impact & Juice Feedback + Progressive Temporary & Permanent Per-Haul Damage
  hitstopTimerS: number;
  cameraTrauma: number; // 0..1 decaying trauma
  lastImpactSeverity: number;
  collisionCount: number; // Nth collision counter for the current haul/run
  collisionTrigger: number; // Increments on each discrete collision for SFX & burst triggers
  collisionCooldownS: number; // Prevents duplicate collision counting within the same impact frame
  lastCollisionZone: DamageZoneId;
  lastCollisionIntensity: number; // 0..1 intensity of most recent hit
  lastImpactLocalPos: { x: number; y: number; z: number };

  // Temporary post-collision visual effects (decay over time after each hit)
  impactFlashTimerS: number; // Directional screen-space shockwave & vignette (0..0.9s)
  lightFlickerTimerS: number; // Post-impact electrical headlight/cockpit flicker timer (0..6.5s)
  sparkBurstTimerS: number; // 3D metallic collision spark shower timer (0..0.8s)
  hudGlitchTimerS: number; // Momentary instrument cluster voltage sag/jitter (0..1.4s)
  lightFlickerFactor: number; // Instantaneous 0..1 multiplier for flickering lights (1 = normal, <1 = dim/off)

  // Rigid-body collision impulse & cabin spring-damper jolt dynamics
  impactYawImpulseRadS: number; // Transient angular yaw spin rate from off-center hits
  impactLateralVelMs: number; // Transient lateral slide velocity from side/corner hits
  cabinPitchOffset: number; // Dynamic spring-damper cabin pitch jolt (radians)
  cabinRollOffset: number; // Dynamic spring-damper cabin roll jolt (radians)
  cabinPitchVel: number; // Angular velocity of cabin pitch jolt (rad/s)
  cabinRollVel: number; // Angular velocity of cabin roll jolt (rad/s)

  // Permanent per-haul structural & mechanical damage (persists until haul restart)
  zoneDamage: Record<DamageZoneId, number>; // 0..1 cumulative deformation per body zone
  headlightLeftDamage: number; // 0..1 left headlamp housing/filament damage
  headlightRightDamage: number; // 0..1 right headlamp housing/filament damage
  mirrorLeftDamage: number; // 0..1 left 3D wing mirror glass crack & bracket dent
  mirrorRightDamage: number; // 0..1 right 3D wing mirror glass crack & bracket dent
  engineDamage: number; // 0..1 radiator/intercooler & engine damage
  alignmentPull: number; // -1..1 steering pull from asymmetrical front suspension damage
  windshieldCracks: WindshieldCrackNode[]; // Cumulative fractures on the 3D truck windshield mesh
}

export interface GearSpec {
  label: string;
  ratio: number; // Negative = reverse, 0 = neutral, positive = forward
}

// Authentic 12-speed Heavy Commercial Range-Splitter Transmission (Eaton / ZF style)
export const HEAVY_TRUCK_GEARS: GearSpec[] = [
  { label: 'R2', ratio: -8.2 },
  { label: 'R1', ratio: -11.4 },
  { label: 'N', ratio: 0 },
  { label: '1L', ratio: 11.73 },
  { label: '1H', ratio: 9.21 },
  { label: '2L', ratio: 7.09 },
  { label: '2H', ratio: 5.57 },
  { label: '3L', ratio: 4.35 },
  { label: '3H', ratio: 3.41 },
  { label: '4L', ratio: 2.69 },
  { label: '4H', ratio: 2.11 },
  { label: '5L', ratio: 1.63 },
  { label: '5H', ratio: 1.28 },
  { label: '6L', ratio: 1.0 },
  { label: '6H', ratio: 0.78 },
];

export type TruckModelId = 'tata_prima_4928' | 'ashok_leyland_3520' | 'bharatbenz_4228r';

export interface TruckModelSpec {
  id: TruckModelId;
  name: string;
  shortName: string;
  category: string;
  engineSpec: string;
  grossWeightTonnes: number;
  peakTorqueNm: number;
  wheelbaseM: number;
  hasArticulatedTrailer: boolean;
  glbModelPath: string;
}

export const TRUCK_MODEL_SPECS: Record<TruckModelId, TruckModelSpec> = {
  tata_prima_4928: {
    id: 'tata_prima_4928',
    name: 'Tata Prima 4928.S (40ft Container Rig)',
    shortName: 'Tata Prima 4928.S',
    category: '6×4 Articulated Container Tractor-Trailer',
    engineSpec: '6.7L Cummins ISBe 280 HP · 12-Spd',
    grossWeightTonnes: 32,
    peakTorqueNm: 2450,
    wheelbaseM: 5.2,
    hasArticulatedTrailer: true,
    glbModelPath: '/models/tata_prima_4928.glb',
  },
  ashok_leyland_3520: {
    id: 'ashok_leyland_3520',
    name: 'Ashok Leyland 3520 "Goods Carrier"',
    shortName: 'Ashok Leyland 3520',
    category: 'Traditional Indian Wooden-Cab 10-Wheeler Lorry',
    engineSpec: 'H-Series 6-Cyl CRS 200 HP · High-Torque Ghat Spec',
    grossWeightTonnes: 25,
    peakTorqueNm: 2150,
    wheelbaseM: 5.6,
    hasArticulatedTrailer: false,
    glbModelPath: '/models/ashok_leyland_3520.glb',
  },
  bharatbenz_4228r: {
    id: 'bharatbenz_4228r',
    name: 'BharatBenz 4228R Petroleum Tanker',
    shortName: 'BharatBenz 4228R Tanker',
    category: 'Tri-Axle Stainless Chromium Fuel Tanker Rig',
    engineSpec: 'OM 926 7.2L 280 HP · Hazmat Retarder Spec',
    grossWeightTonnes: 35,
    peakTorqueNm: 2650,
    wheelbaseM: 5.1,
    hasArticulatedTrailer: true,
    glbModelPath: '/models/bharatbenz_4228r.glb',
  },
};

// Physical Constants for Heavy Commercial Tractor-Trailer
const TRAILER_KINGPIN_TO_AXLE_M = 8.4; // 40ft container trailer effective wheelbase
const WHEEL_RADIUS_M = 0.54; // 295/80 R22.5 heavy truck tire
const FINAL_DRIVE_RATIO = 5.12; // Hub-reduction heavy tandem axle ratio
const DRIVETRAIN_EFFICIENCY = 0.91;

const IDLE_RPM = 650;
const REDLINE_RPM = 2500;
const PEAK_TORQUE_NM = 2450; // Default heavy-duty 6-cylinder turbodiesel torque

const MAX_STEER_ANGLE_RAD = 0.54; // ~31 degrees at low speed
const GRAVITY = 9.81;
const AIR_DENSITY = 1.2;
const FRONTAL_AREA_M2 = 9.4;
const DRAG_COEFF_CD = 0.62;
const ROLLING_RESISTANCE_CR = 0.0062;

/**
 * Evaluates heavy diesel engine torque (Nm) at a given RPM.
 * Broad flat torque plateau between 1,050 and 1,750 RPM, tapering gracefully to redline.
 */
export function computeEngineTorqueNm(rpm: number, peakTorque = PEAK_TORQUE_NM): number {
  const clamped = Math.max(IDLE_RPM, Math.min(REDLINE_RPM + 150, rpm));
  if (clamped < 1050) {
    const t = (clamped - IDLE_RPM) / (1050 - IDLE_RPM);
    return peakTorque * (0.68 + 0.32 * t);
  }
  if (clamped <= 1750) {
    return peakTorque;
  }
  const falloff = (clamped - 1750) / (REDLINE_RPM - 1750);
  return peakTorque * Math.max(0.2, 1 - 0.68 * falloff * falloff);
}

/**
 * Default local 3D anchor coordinates on the tractor/trailer for each collision zone.
 */
const ZONE_LOCAL_IMPACT_POS: Record<DamageZoneId, { x: number; y: number; z: number }> = {
  front_left: { x: -1.12, y: 0.92, z: -2.85 },
  front_center: { x: 0.0, y: 0.95, z: -2.92 },
  front_right: { x: 1.12, y: 0.92, z: -2.85 },
  side_left: { x: -1.26, y: 1.18, z: -1.65 },
  side_right: { x: 1.26, y: 1.18, z: -1.65 },
  rear: { x: 0.0, y: 1.25, z: 5.85 },
};

/**
 * Applies a localized, intensity-scaled collision to the truck, updating both:
 * 1) Temporary post-impact visual feedbacks (flickering lights, directional shockwave, 3D sparks, HUD voltage sag)
 * 2) Permanent per-haul structural damage (zone dents, crumpled metal, headlight housing damage, radiator/engine damage,
 *    and location-matched windshield spiderweb cracks that escalate with the N-th collision).
 */
export function applyTruckCollision(
  state: TruckPhysicsState,
  zone: DamageZoneId,
  rawSeverity: number,
  customLocalPos?: { x: number; y: number; z: number }
): void {
  const intensity = Math.max(0.12, Math.min(1.0, rawSeverity));

  // Always refresh immediate spark & trauma feedback on contact
  state.lastImpactLocalPos = customLocalPos
    ? { ...customLocalPos }
    : { ...ZONE_LOCAL_IMPACT_POS[zone] };
  state.sparkBurstTimerS = Math.max(state.sparkBurstTimerS, 0.45 + intensity * 0.45);
  state.cameraTrauma = Math.min(1.0, state.cameraTrauma + 0.28 + intensity * 0.52);
  state.lastImpactSeverity = intensity;
  state.lastCollisionZone = zone;
  state.lastCollisionIntensity = intensity;

  // Guard discrete N-th collision increments with a short cooldown so a continuous barrier scrape
  // counts as a distinct impact every ~0.38s rather than 60 times per second.
  if (state.collisionCooldownS > 0) {
    // Still accumulate subtle scrape denting during continuous contact
    state.zoneDamage[zone] = Math.min(1.0, state.zoneDamage[zone] + intensity * 0.035);
    return;
  }

  state.collisionCount += 1;
  state.collisionTrigger += 1;
  state.collisionCooldownS = 0.38;

  const nth = state.collisionCount;
  // N-th collision multiplier: repeat collisions compound structural fatigue & electrical faults
  const nthEscalation = 1 + Math.min(2.2, (nth - 1) * 0.28);

  // 1. Temporary Visual Feedbacks (scaled by intensity and N-th collision)
  state.hitstopTimerS = Math.min(0.065, 0.02 + intensity * 0.04);
  state.impactFlashTimerS = Math.min(0.95, 0.38 + intensity * 0.48);
  state.lightFlickerTimerS = Math.min(
    7.5,
    Math.max(state.lightFlickerTimerS, (1.6 + intensity * 2.8) * Math.min(1.8, nthEscalation))
  );
  state.hudGlitchTimerS = Math.min(1.6, (0.35 + intensity * 0.65) * Math.min(1.6, nthEscalation));

  // Turn on headlights automatically on first frontal/side impact if off so the player immediately sees
  // the damaged headlamp beam flickering & sputtering!
  if (!state.headlightsOn && (intensity > 0.22 || nth >= 1)) {
    state.headlightsOn = true;
  }

  // 2. Permanent Per-Haul Localized Body Dent & Deformation (`zoneDamage[zone]`)
  const dentDelta = intensity * (0.22 + Math.min(0.32, (nth - 1) * 0.055));
  state.zoneDamage[zone] = Math.min(1.0, state.zoneDamage[zone] + dentDelta);

  // Neighboring zone bleed for heavy collisions (intensity > 0.55)
  if (intensity > 0.55) {
    const bleed = (intensity - 0.55) * 0.35;
    if (zone === 'front_center') {
      state.zoneDamage.front_left = Math.min(1.0, state.zoneDamage.front_left + bleed);
      state.zoneDamage.front_right = Math.min(1.0, state.zoneDamage.front_right + bleed);
    } else if (zone === 'front_left') {
      state.zoneDamage.front_center = Math.min(1.0, state.zoneDamage.front_center + bleed);
      state.zoneDamage.side_left = Math.min(1.0, state.zoneDamage.side_left + bleed * 0.7);
    } else if (zone === 'front_right') {
      state.zoneDamage.front_center = Math.min(1.0, state.zoneDamage.front_center + bleed);
      state.zoneDamage.side_right = Math.min(1.0, state.zoneDamage.side_right + bleed * 0.7);
    }
  }

  // 3. Permanent Per-Haul Headlight, 3D Wing Mirror & Engine / Radiator Damage by Location
  if (zone === 'front_left' || zone === 'side_left') {
    const mult = zone === 'front_left' ? 0.36 : 0.18;
    state.headlightLeftDamage = Math.min(
      1.0,
      state.headlightLeftDamage + intensity * mult * nthEscalation
    );
    const mirrorMult = zone === 'side_left' ? 0.48 : 0.34;
    state.mirrorLeftDamage = Math.min(
      1.0,
      state.mirrorLeftDamage + intensity * mirrorMult * nthEscalation
    );
  }
  if (zone === 'front_right' || zone === 'side_right') {
    const mult = zone === 'front_right' ? 0.36 : 0.18;
    state.headlightRightDamage = Math.min(
      1.0,
      state.headlightRightDamage + intensity * mult * nthEscalation
    );
    const mirrorMult = zone === 'side_right' ? 0.48 : 0.34;
    state.mirrorRightDamage = Math.min(
      1.0,
      state.mirrorRightDamage + intensity * mirrorMult * nthEscalation
    );
  }
  if (zone === 'front_center') {
    state.headlightLeftDamage = Math.min(
      1.0,
      state.headlightLeftDamage + intensity * 0.22 * nthEscalation
    );
    state.headlightRightDamage = Math.min(
      1.0,
      state.headlightRightDamage + intensity * 0.22 * nthEscalation
    );
    if (intensity > 0.52) {
      state.mirrorLeftDamage = Math.min(1.0, state.mirrorLeftDamage + (intensity - 0.5) * 0.28);
      state.mirrorRightDamage = Math.min(1.0, state.mirrorRightDamage + (intensity - 0.5) * 0.28);
    }
  }

  if (zone === 'front_center' || zone === 'front_left' || zone === 'front_right') {
    const engMult = zone === 'front_center' ? 0.32 : 0.2;
    state.engineDamage = Math.min(
      1.0,
      state.engineDamage + intensity * engMult * Math.min(1.5, nthEscalation)
    );
  }

  // 3B. Rigid-Body Collision Impulse Physics: Angular Yaw Torque, Lateral Shove, Cabin Jolt & Trailer Whip
  if (zone === 'front_left') {
    // Left-front corner impact kicks nose to the right (+heading) and rolls cab right
    state.impactYawImpulseRadS += (0.28 + intensity * 0.62) * Math.min(1.5, nthEscalation);
    state.impactLateralVelMs += 1.2 + intensity * 3.4;
    state.cabinPitchVel -= 0.55 + intensity * 1.15;
    state.cabinRollVel += 0.65 + intensity * 1.25;
    state.speedMs *= Math.max(0.45, 1 - intensity * 0.32);
  } else if (zone === 'front_right') {
    // Right-front corner impact kicks nose to the left (-heading) and rolls cab left
    state.impactYawImpulseRadS -= (0.28 + intensity * 0.62) * Math.min(1.5, nthEscalation);
    state.impactLateralVelMs -= 1.2 + intensity * 3.4;
    state.cabinPitchVel -= 0.55 + intensity * 1.15;
    state.cabinRollVel -= 0.65 + intensity * 1.25;
    state.speedMs *= Math.max(0.45, 1 - intensity * 0.32);
  } else if (zone === 'front_center') {
    // Direct frontal impact induces heavy nose-dive pitch jolt and longitudinal energy loss
    state.cabinPitchVel -= 0.78 + intensity * 1.45;
    state.cabinRollVel += (nth % 2 === 0 ? 1 : -1) * (0.25 + intensity * 0.45);
    state.speedMs *= Math.max(0.35, 1 - intensity * 0.42);
  } else if (zone === 'side_left') {
    // Left side-swipe shoves truck rightward (+lateral) and rolls cab violently right
    state.impactLateralVelMs += 1.8 + intensity * 4.2;
    state.impactYawImpulseRadS += 0.18 + intensity * 0.42;
    state.cabinRollVel += 0.85 + intensity * 1.55;
  } else if (zone === 'side_right') {
    // Right side-swipe shoves truck leftward (-lateral) and rolls cab violently left
    state.impactLateralVelMs -= 1.8 + intensity * 4.2;
    state.impactYawImpulseRadS -= 0.18 + intensity * 0.42;
    state.cabinRollVel -= 0.85 + intensity * 1.55;
  } else if (zone === 'rear') {
    // Rear-end impact surges truck forward, pitches cab nose-up, and whips the trailer
    state.speedMs = Math.min(30.5, state.speedMs + 1.5 + intensity * 3.8);
    state.cabinPitchVel += 0.68 + intensity * 1.25;
    state.trailerHeading += (nth % 2 === 0 ? 1 : -1) * (0.08 + intensity * 0.18);
  }

  // Wheel alignment pull from asymmetrical front suspension damage
  state.alignmentPull = Math.max(
    -0.8,
    Math.min(0.8, (state.zoneDamage.front_left - state.zoneDamage.front_right) * 0.45)
  );

  // Cargo integrity loss scaled by intensity
  const cargoLoss = Math.min(14, (1.4 + intensity * 7.5) * Math.min(1.4, nthEscalation));
  state.cargoIntegrityPct = Math.max(
    0,
    Math.round((state.cargoIntegrityPct - cargoLoss) * 10) / 10
  );

  // 4. Permanent Per-Haul 3D Windshield Glass Spiderweb Cracks
  // Located on the actual 3D windshield mesh according to impact zone (front_left -> left pane,
  // front_center -> center pane, front_right -> RHD driver pane, side -> outer corner edge)
  const isFrontal =
    zone === 'front_left' || zone === 'front_center' || zone === 'front_right';
  if ((isFrontal && intensity >= 0.18) || intensity >= 0.38 || nth >= 2) {
    const seed = nth * 137 + Math.round(intensity * 100);
    const pseudoRand = (s: number) => {
      const v = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
      return v - Math.floor(v);
    };

    // Map impact zone to UV coordinates (0..1) on the 3D truck windshield mesh:
    // Note: in RHD cockpit view looking forward (-Z), X < 0 is Left (co-driver), X > 0 is Right (driver)
    let baseNormX = 0.5;
    let baseNormY = 0.48;
    if (zone === 'front_left' || zone === 'side_left') {
      baseNormX = 0.16 + pseudoRand(seed + 1) * 0.18;
      baseNormY = 0.32 + pseudoRand(seed + 2) * 0.36;
    } else if (zone === 'front_right' || zone === 'side_right') {
      baseNormX = 0.66 + pseudoRand(seed + 3) * 0.18;
      baseNormY = 0.32 + pseudoRand(seed + 4) * 0.36;
    } else if (zone === 'front_center') {
      baseNormX = 0.41 + pseudoRand(seed + 5) * 0.18;
      baseNormY = 0.28 + pseudoRand(seed + 6) * 0.36;
    } else {
      // Rear impact: corner stress fracture near A-pillar edge of 3D windshield
      baseNormX = pseudoRand(seed + 7) > 0.5 ? 0.86 : 0.14;
      baseNormY = 0.35 + pseudoRand(seed + 8) * 0.3;
    }

    const crackSeverity = Math.min(1.0, intensity * (0.65 + Math.min(0.6, nth * 0.12)));

    if (state.windshieldCracks.length < 10) {
      state.windshieldCracks.push({
        id: nth,
        normX: Math.max(0.08, Math.min(0.92, baseNormX)),
        normY: Math.max(0.16, Math.min(0.84, baseNormY)),
        intensity: crackSeverity,
        nthCollision: nth,
        zone,
        seed,
      });
    } else {
      const targetIdx = (nth - 1) % state.windshieldCracks.length;
      const existing = state.windshieldCracks[targetIdx];
      existing.intensity = Math.min(1.0, existing.intensity + crackSeverity * 0.35);
      existing.nthCollision = nth;
    }
  }
}

/**
 * Creates the initial grounded truck and articulated trailer state at the start of the active corridor.
 */
export function createInitialTruckState(
  startS = 60,
  truckModelId: TruckModelId = 'tata_prima_4928'
): TruckPhysicsState {
  const startLaneOffset = LANE_CENTERS.FORWARD_OUTER; // Left-hand traffic heavy lane (-7.6m)
  const worldPos = splineToWorld(startS, startLaneOffset, 0);
  const heading = worldPos.sample.heading;

  // Fifth-wheel kingpin is 1.9m behind tractor center along -forward vector
  const forwardX = Math.sin(heading);
  const forwardZ = -Math.cos(heading);
  const fifthWheelX = worldPos.x - forwardX * 1.9;
  const fifthWheelZ = worldPos.z - forwardZ * 1.9;

  // Trailer center is behind fifth wheel
  const trailerCenterOffset = 5.4;
  const trailerX = fifthWheelX - forwardX * trailerCenterOffset;
  const trailerZ = fifthWheelZ - forwardZ * trailerCenterOffset;
  const trailerProj = projectWorldToSpline(trailerX, trailerZ, startS - 7.3);

  const wheels: WheelTelemetry[] = [
    { id: 'FL', contactY: worldPos.y, compression: 0.35, rotationRad: 0, steerAngleRad: 0, slipRatio: 0 },
    { id: 'FR', contactY: worldPos.y, compression: 0.35, rotationRad: 0, steerAngleRad: 0, slipRatio: 0 },
    { id: 'ML', contactY: worldPos.y, compression: 0.4, rotationRad: 0, steerAngleRad: 0, slipRatio: 0 },
    { id: 'MR', contactY: worldPos.y, compression: 0.4, rotationRad: 0, steerAngleRad: 0, slipRatio: 0 },
    { id: 'RL', contactY: worldPos.y, compression: 0.4, rotationRad: 0, steerAngleRad: 0, slipRatio: 0 },
    { id: 'RR', contactY: worldPos.y, compression: 0.4, rotationRad: 0, steerAngleRad: 0, slipRatio: 0 },
  ];

  return {
    truckModelId,
    x: worldPos.x,
    y: worldPos.y,
    z: worldPos.z,
    heading,
    pitch: -worldPos.sample.grade,
    roll: worldPos.sample.bankAngle,

    speedMs: 0,
    speedKmh: 0,
    lateralVelocityMs: 0,
    yawRateRadS: 0,
    accelerationMs2: 0,

    steerAngleRad: 0,
    wheelRotationRad: 0,
    wheels,

    rpm: IDLE_RPM,
    gearIndex: 5, // Starts in 2L (suitable starting gear for heavy truck)
    gearLabel: HEAVY_TRUCK_GEARS[5].label,
    transmissionMode: 'auto',
    shiftCooldownS: 0,
    turboBoostBar: 0.05,
    engineLoad: 0.1,

    airPressurePsi: 118,
    fuelLiters: 385,
    fuelMaxLiters: 400,
    fuelConsumptionL100Km: 0,
    airBrakeReleaseTrigger: 0,
    gearShiftTrigger: 0,

    trailerX,
    trailerY: trailerProj.groundY,
    trailerZ,
    trailerHeading: heading,
    trailerPitch: -trailerProj.grade,
    trailerRoll: trailerProj.bankAngle,
    articulationAngleRad: 0,
    jackknifeWarning: false,

    distanceAlongHighwayM: startS,
    totalDistanceDrivenM: 0,
    lateralOffsetM: startLaneOffset,
    currentSurface: 'asphalt',
    zoneName: worldPos.sample.zoneName,
    landmarkKm: worldPos.sample.landmarkKm,
    speedLimitKmh: worldPos.sample.speedLimitKmh,
    nextWaypointName: getActiveMapSpec().waypoints[1].name,
    nextWaypointDistanceM: getActiveMapSpec().waypoints[1].s - startS,
    cargoIntegrityPct: 100,

    headlightsOn: false,
    highBeamOn: false,
    indicator: 'off',
    indicatorBlinkOn: false,
    hornActive: false,

    hitstopTimerS: 0,
    cameraTrauma: 0,
    lastImpactSeverity: 0,
    collisionCount: 0,
    collisionTrigger: 0,
    collisionCooldownS: 0,
    lastCollisionZone: 'front_center',
    lastCollisionIntensity: 0,
    lastImpactLocalPos: { x: 0, y: 0.95, z: -2.9 },

    impactFlashTimerS: 0,
    lightFlickerTimerS: 0,
    sparkBurstTimerS: 0,
    hudGlitchTimerS: 0,
    lightFlickerFactor: 1,

    impactYawImpulseRadS: 0,
    impactLateralVelMs: 0,
    cabinPitchOffset: 0,
    cabinRollOffset: 0,
    cabinPitchVel: 0,
    cabinRollVel: 0,

    zoneDamage: {
      front_left: 0,
      front_center: 0,
      front_right: 0,
      side_left: 0,
      side_right: 0,
      rear: 0,
    },
    headlightLeftDamage: 0,
    headlightRightDamage: 0,
    mirrorLeftDamage: 0,
    mirrorRightDamage: 0,
    engineDamage: 0,
    alignmentPull: 0,
    windshieldCracks: [],
  };
}

function normalizeAngleRad(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Advances the heavy truck and articulated trailer physics simulation by `rawDt` seconds.
 * Pure, deterministic step function suitable for 60Hz real-time gameplay and `node:test` verification.
 */
export function stepTruckPhysics(
  state: TruckPhysicsState,
  input: TruckControlInput,
  rawDt: number,
  elapsedTimeS = 0
): TruckPhysicsState {
  // Clamp delta time to prevent physics tunneling on tab switches
  const dt = Math.max(0.0001, Math.min(rawDt, 0.05));
  const truckSpec = TRUCK_MODEL_SPECS[state.truckModelId] ?? TRUCK_MODEL_SPECS.tata_prima_4928;
  const totalMassKg = truckSpec.grossWeightTonnes * 1000;
  const wheelbaseM = truckSpec.wheelbaseM;

  // Decay temporary post-collision timers in real time
  state.cameraTrauma = Math.max(0, state.cameraTrauma - dt * 1.45);
  state.collisionCooldownS = Math.max(0, state.collisionCooldownS - dt);
  state.impactFlashTimerS = Math.max(0, state.impactFlashTimerS - dt);
  state.lightFlickerTimerS = Math.max(0, state.lightFlickerTimerS - dt);
  state.sparkBurstTimerS = Math.max(0, state.sparkBurstTimerS - dt);
  state.hudGlitchTimerS = Math.max(0, state.hudGlitchTimerS - dt);

  // Compute instantaneous electrical light flicker factor (temporary post-impact sputter + permanent filament wear)
  const maxHeadlightDmg = Math.max(state.headlightLeftDamage, state.headlightRightDamage);
  if (state.lightFlickerTimerS > 0) {
    // High-frequency erratic relay chatter immediately after collision
    const wave =
      Math.sin(elapsedTimeS * 62) *
      Math.cos(elapsedTimeS * 97 + state.collisionCount * 1.7) *
      Math.sin(elapsedTimeS * 29);
    const flickerUrgency = Math.min(1, state.lightFlickerTimerS / 2.2);
    state.lightFlickerFactor = wave < -0.15 * flickerUrgency ? 0.08 : wave < 0.2 ? 0.45 : 1.0;
  } else if (maxHeadlightDmg > 0.38) {
    // Permanent intermittent filament drop-out on heavily damaged headlights for the rest of the haul
    const slowWave = Math.sin(elapsedTimeS * 19 + state.collisionCount) * Math.cos(elapsedTimeS * 43);
    state.lightFlickerFactor = slowWave < -0.68 ? 0.22 : 1.0 - maxHeadlightDmg * 0.25;
  } else {
    state.lightFlickerFactor = 1.0;
  }

  if (state.hitstopTimerS > 0) {
    state.hitstopTimerS = Math.max(0, state.hitstopTimerS - dt);
    return state;
  }

  // 1. Speed-Sensitive Heavy Steering Dynamics (with subtle alignment pull when front suspension is bent)
  const absSpeedKmh = Math.abs(state.speedMs) * 3.6;
  const speedSteerFactor = 1 / (1 + Math.pow(absSpeedKmh / 42, 1.45));
  const maxAllowedSteer = MAX_STEER_ANGLE_RAD * Math.max(0.22, speedSteerFactor);
  const alignmentBias = state.alignmentPull * 0.045 * Math.min(1, absSpeedKmh / 45);
  const targetSteerRad = -input.steer * maxAllowedSteer + alignmentBias;
  const steerRate = input.steer !== 0 ? 2.4 : 3.2;
  state.steerAngleRad += (targetSteerRad - state.steerAngleRad) * (1 - Math.exp(-steerRate * dt));

  state.indicatorBlinkOn =
    state.indicator !== 'off' && Math.floor(elapsedTimeS * 2.6) % 2 === 0;

  // 2. Transmission Shifting (Manual & Automatic OptiCruise)
  if (state.shiftCooldownS > 0) {
    state.shiftCooldownS = Math.max(0, state.shiftCooldownS - dt);
  }

  const triggerShift = (newIndex: number) => {
    const clampedIdx = Math.max(0, Math.min(HEAVY_TRUCK_GEARS.length - 1, newIndex));
    if (clampedIdx !== state.gearIndex) {
      state.gearIndex = clampedIdx;
      state.gearLabel = HEAVY_TRUCK_GEARS[clampedIdx].label;
      state.shiftCooldownS = 0.14;
      state.gearShiftTrigger += 1;
    }
  };

  const currentGearBefore = HEAVY_TRUCK_GEARS[state.gearIndex];
  const overallRatioBefore = currentGearBefore.ratio * FINAL_DRIVE_RATIO;
  const wheelAngularVelBefore = state.speedMs / WHEEL_RADIUS_M;
  const rawCoupledRpmBefore =
    Math.abs(overallRatioBefore) > 0.01
      ? Math.abs(wheelAngularVelBefore * overallRatioBefore * (60 / (Math.PI * 2)))
      : IDLE_RPM;

  if (input.shiftUpJustPressed) {
    triggerShift(state.gearIndex + 1);
  } else if (input.shiftDownJustPressed) {
    triggerShift(state.gearIndex - 1);
  } else if (state.transmissionMode === 'auto' && state.shiftCooldownS <= 0) {
    if (state.speedMs <= 0.4 && input.brake > 0.5 && input.throttle < 0.1 && state.gearIndex >= 2) {
      if (state.speedMs < 0.08 && state.gearIndex > 1) {
        triggerShift(1); // R1
      }
    } else if (state.gearIndex <= 2 && input.throttle > 0.1 && state.speedMs >= -0.4) {
      triggerShift(5); // 2L
    } else if (state.gearIndex >= 3) {
      const upshiftRpm = input.throttle > 0.75 ? 1780 : 1620;
      const downshiftRpm = 940;

      if (rawCoupledRpmBefore > upshiftRpm && state.gearIndex < HEAVY_TRUCK_GEARS.length - 1) {
        const step = state.gearIndex < 9 && rawCoupledRpmBefore > 1950 ? 2 : 1;
        triggerShift(Math.min(HEAVY_TRUCK_GEARS.length - 1, state.gearIndex + step));
      } else if (
        rawCoupledRpmBefore < downshiftRpm &&
        input.throttle < 0.3 &&
        state.gearIndex > 5 &&
        state.speedMs > 2.5
      ) {
        triggerShift(state.gearIndex - 1);
      }
    }
  }

  const currentGear = HEAVY_TRUCK_GEARS[state.gearIndex];
  const overallGearRatio = currentGear.ratio * FINAL_DRIVE_RATIO;

  // 3. Engine RPM, Torque & Braking Calculation
  let effectiveThrottle = input.throttle;
  let effectiveServiceBrake = input.brake;

  if (state.transmissionMode === 'auto' && state.gearIndex < 2) {
    if (input.brake > 0 && input.throttle === 0) {
      effectiveThrottle = input.brake;
      effectiveServiceBrake = 0;
    } else if (input.throttle > 0) {
      effectiveServiceBrake = input.throttle;
      effectiveThrottle = 0;
    }
  }

  if (input.serviceAirBrake) {
    effectiveServiceBrake = 1.0;
    effectiveThrottle = 0;
  }

  const wheelAngularVel = state.speedMs / WHEEL_RADIUS_M;
  const coupledEngineRpm =
    Math.abs(overallGearRatio) > 0.01
      ? Math.abs(wheelAngularVel * overallGearRatio * (60 / (Math.PI * 2)))
      : IDLE_RPM;

  // Slight idle roughness if engine has sustained heavy frontal damage
  const engineRoughJitter =
    state.engineDamage > 0.35 ? Math.sin(elapsedTimeS * 38) * state.engineDamage * 36 : 0;
  const clutchLaunchRpm = IDLE_RPM + effectiveThrottle * 720 + engineRoughJitter;
  const targetRpm =
    currentGear.ratio === 0 || state.shiftCooldownS > 0
      ? IDLE_RPM + effectiveThrottle * 1150 + engineRoughJitter
      : Math.max(clutchLaunchRpm, Math.min(REDLINE_RPM, coupledEngineRpm));

  state.rpm += (targetRpm - state.rpm) * (1 - Math.exp(-14 * dt));
  state.engineLoad =
    state.shiftCooldownS > 0
      ? 0.15
      : Math.min(1, effectiveThrottle * 0.88 + (state.rpm - IDLE_RPM) / 4000);

  const targetBoost =
    state.shiftCooldownS > 0
      ? 0.15
      : Math.max(
          0,
          Math.min(
            1.8,
            effectiveThrottle * 1.65 * Math.max(0, (state.rpm - 850) / 1100)
          )
        );
  state.turboBoostBar += (targetBoost - state.turboBoostBar) * (1 - Math.exp(-4.5 * dt));

  let driveForceN = 0;
  if (currentGear.ratio !== 0 && state.shiftCooldownS <= 0) {
    const engineHealthEfficiency = 1 - state.engineDamage * 0.18;
    const engineTorque =
      computeEngineTorqueNm(state.rpm, truckSpec.peakTorqueNm) * engineHealthEfficiency;
    const launchAssist = Math.abs(state.speedMs) < 5.0 ? 1.45 : 1.0;
    const revLimiter = state.rpm >= REDLINE_RPM - 40 ? Math.max(0, (REDLINE_RPM - state.rpm) / 40) : 1;
    const wheelTorque =
      engineTorque *
      effectiveThrottle *
      overallGearRatio *
      DRIVETRAIN_EFFICIENCY *
      launchAssist *
      revLimiter;
    driveForceN = wheelTorque / WHEEL_RADIUS_M;

    if (effectiveThrottle < 0.05 && Math.abs(state.speedMs) > 0.5) {
      const retarderMultiplier = input.engineBrakeActive ? 2.4 : 1.0;
      const engineBrakeForce =
        Math.abs(overallGearRatio) * 165 * (state.rpm / 1500) * retarderMultiplier;
      driveForceN -= Math.sign(state.speedMs) * engineBrakeForce;
    }
  }

  // 4. Resistive Forces: Aerodynamic Drag, Rolling Resistance, Highway Grade Gravity, and Air Brakes
  const projBefore = projectWorldToSpline(state.x, state.z, state.distanceAlongHighwayM);
  const surfaceRollingMultiplier =
    projBefore.surfaceType === 'asphalt'
      ? 1.0
      : projBefore.surfaceType === 'shoulder'
      ? 1.75
      : 3.2;

  const aeroDragN =
    0.5 * AIR_DENSITY * DRAG_COEFF_CD * FRONTAL_AREA_M2 * state.speedMs * Math.abs(state.speedMs);
  const rollingResN =
    (Math.abs(state.speedMs) > 0.05 ? Math.sign(state.speedMs) : 0) *
    totalMassKg *
    GRAVITY *
    ROLLING_RESISTANCE_CR *
    surfaceRollingMultiplier;

  const roadDirDot = Math.cos(state.heading - projBefore.heading);
  const effectiveGrade = projBefore.grade * roadDirDot;
  const gradeGravityN = totalMassKg * GRAVITY * Math.sin(Math.atan(effectiveGrade));

  // Pneumatic Air Brakes
  const airEfficiency = Math.min(1, Math.max(0.35, state.airPressurePsi / 100));
  const maxBrakeForceN = (input.serviceAirBrake ? 240000 : 195000) * airEfficiency;
  const brakeForceN =
    Math.abs(state.speedMs) > 0.02
      ? Math.sign(state.speedMs) * effectiveServiceBrake * maxBrakeForceN
      : 0;

  if (effectiveServiceBrake > 0.15) {
    state.airPressurePsi = Math.max(65, state.airPressurePsi - effectiveServiceBrake * 3.2 * dt);
  } else {
    state.airPressurePsi = Math.min(
      122,
      state.airPressurePsi + (1.2 + (state.rpm / 1500) * 1.8) * dt
    );
  }

  const netForceN = driveForceN - aeroDragN - rollingResN - gradeGravityN - brakeForceN;
  const prevSpeedMs = state.speedMs;
  const rawAccelMs2 = netForceN / totalMassKg;

  let nextSpeedMs = state.speedMs + rawAccelMs2 * dt;

  if (
    effectiveThrottle < 0.02 &&
    (effectiveServiceBrake > 0.05 || Math.abs(nextSpeedMs) < 0.08) &&
    Math.sign(nextSpeedMs) !== Math.sign(prevSpeedMs) &&
    Math.abs(prevSpeedMs) < 0.8
  ) {
    nextSpeedMs = 0;
    if (effectiveServiceBrake > 0.4) {
      state.airBrakeReleaseTrigger += 1;
    }
  }

  state.speedMs = Math.max(-6.5, Math.min(30.5, nextSpeedMs));
  state.speedKmh = Math.abs(state.speedMs) * 3.6;
  state.accelerationMs2 = (state.speedMs - prevSpeedMs) / dt;

  // 5. Kinematic Bicycle + Lateral Slip & Collision Impulse Model for Heavy Tractor
  const curvatureFromSteer = Math.tan(state.steerAngleRad) / wheelbaseM;
  const trailerDamping = 1 / (1 + Math.abs(state.articulationAngleRad) * 0.35);
  state.impactYawImpulseRadS *= Math.exp(-5.5 * dt);
  state.impactLateralVelMs *= Math.exp(-6.2 * dt);

  state.yawRateRadS =
    state.speedMs * curvatureFromSteer * trailerDamping + state.impactYawImpulseRadS;
  state.heading = normalizeAngleRad(state.heading + state.yawRateRadS * dt);

  const forwardX = Math.sin(state.heading);
  const forwardZ = -Math.cos(state.heading);
  const rightX = Math.cos(state.heading);
  const rightZ = Math.sin(state.heading);
  state.x += (forwardX * state.speedMs + rightX * state.impactLateralVelMs) * dt;
  state.z += (forwardZ * state.speedMs + rightZ * state.impactLateralVelMs) * dt;
  state.lateralVelocityMs = state.impactLateralVelMs;

  // 6. Highway Projection, Guardrail / Median Barrier Constraints & Grounding
  const proj = projectWorldToSpline(state.x, state.z, state.distanceAlongHighwayM);
  state.distanceAlongHighwayM = proj.s;
  state.lateralOffsetM = proj.lateralOffset;
  state.currentSurface = proj.surfaceType;
  state.zoneName = proj.sample.zoneName;
  state.landmarkKm = proj.sample.landmarkKm;
  state.speedLimitKmh = proj.sample.speedLimitKmh;
  state.totalDistanceDrivenM += Math.abs(state.speedMs) * dt;

  // Rigid outer highway guardrail & retaining wall constraint
  const isDhabaLayby = proj.s > 2385 && proj.s < 2515 && proj.lateralOffset < 0;
  const outerGuardrailLimit = proj.sample.isTollPlaza
    ? 14.8
    : isDhabaLayby
      ? 22.5
      : 10.85;
  if (Math.abs(proj.lateralOffset) > outerGuardrailLimit) {
    const isLeftBarrier = proj.lateralOffset < 0;
    const clampedLat = Math.sign(proj.lateralOffset) * outerGuardrailLimit;
    const corrected = splineToWorld(proj.s, clampedLat, 0);
    state.x = corrected.x;
    state.z = corrected.z;
    state.lateralOffsetM = clampedLat;
    const headingError = normalizeAngleRad(proj.sample.heading - state.heading);
    const approachAngle = Math.abs(headingError);
    state.heading = normalizeAngleRad(state.heading + headingError * 0.55);
    if (state.speedKmh > 14) {
      const impactZone: DamageZoneId = isLeftBarrier
        ? approachAngle > 0.14
          ? 'front_left'
          : 'side_left'
        : approachAngle > 0.14
          ? 'front_right'
          : 'side_right';
      const rawSev = Math.min(1.0, (state.speedKmh / 85) * (0.45 + approachAngle * 1.4));
      state.speedMs *= 0.88;
      applyTruckCollision(state, impactZone, rawSev);
    }
  }

  // Rigid Central Concrete Jersey Median Barrier Constraint
  if (!proj.sample.isTollPlaza && Math.abs(proj.lateralOffset) < 1.85) {
    const inLeftCarriageway = proj.lateralOffset <= 0;
    const pushSide = inLeftCarriageway ? -1.9 : 1.9;
    const corrected = splineToWorld(proj.s, pushSide, 0);
    state.x = corrected.x;
    state.z = corrected.z;
    state.lateralOffsetM = pushSide;
    const headingError = normalizeAngleRad(proj.sample.heading - state.heading);
    const approachAngle = Math.abs(headingError);
    state.heading = normalizeAngleRad(state.heading + headingError * 0.55);
    if (state.speedKmh > 12) {
      // In left-hand traffic (lateralOffset < 0), the median barrier is on the RIGHT side of the truck!
      const impactZone: DamageZoneId = inLeftCarriageway
        ? approachAngle > 0.12
          ? 'front_right'
          : 'side_right'
        : approachAngle > 0.12
          ? 'front_left'
          : 'side_left';
      const rawSev = Math.min(1.0, (state.speedKmh / 75) * (0.55 + approachAngle * 1.5));
      state.speedMs *= 0.82;
      applyTruckCollision(state, impactZone, rawSev);
    }
  }

  // 7. 6-Wheel Suspension & Underdamped Pneumatic Cabin Pitch/Roll Jolt Dynamics (R4 & R5)
  state.y = proj.groundY;

  // Step 2nd-order spring-damper ODE for collision & bump cab jolt
  const springK = 44.0;
  const damperC = 7.8;
  const pitchSpringAccel = -springK * state.cabinPitchOffset - damperC * state.cabinPitchVel;
  const rollSpringAccel = -springK * state.cabinRollOffset - damperC * state.cabinRollVel;
  state.cabinPitchVel += pitchSpringAccel * dt;
  state.cabinRollVel += rollSpringAccel * dt;
  state.cabinPitchOffset = Math.max(
    -0.18,
    Math.min(0.18, state.cabinPitchOffset + state.cabinPitchVel * dt)
  );
  state.cabinRollOffset = Math.max(
    -0.22,
    Math.min(0.22, state.cabinRollOffset + state.cabinRollVel * dt)
  );

  const targetPitch =
    -proj.grade +
    Math.max(-0.075, Math.min(0.06, state.accelerationMs2 * 0.012)) +
    state.cabinPitchOffset;
  const lateralAccelMs2 = state.speedMs * state.yawRateRadS;
  const targetRoll =
    proj.bankAngle +
    Math.max(-0.11, Math.min(0.11, -lateralAccelMs2 * 0.022)) +
    state.cabinRollOffset;

  state.pitch += (targetPitch - state.pitch) * (1 - Math.exp(-12 * dt));
  state.roll += (targetRoll - state.roll) * (1 - Math.exp(-12 * dt));

  state.wheelRotationRad =
    (state.wheelRotationRad + (state.speedMs / WHEEL_RADIUS_M) * dt) % (Math.PI * 2000);
  const bumpOsc =
    (state.currentSurface === 'shoulder'
      ? 0.055
      : state.currentSurface === 'offroad'
      ? 0.08
      : 0.018) * Math.sin(state.distanceAlongHighwayM * 2.4);

  for (let i = 0; i < state.wheels.length; i++) {
    const w = state.wheels[i];
    const isFront = i < 2;
    const isLeft = i % 2 === 0;
    w.rotationRad = state.wheelRotationRad;
    w.steerAngleRad = isFront ? state.steerAngleRad : 0;
    const pitchComp = (isFront ? -1 : 1) * state.pitch * 2.6;
    const rollComp = (isLeft ? -1 : 1) * state.roll * 2.4;
    w.compression = Math.max(
      0.05,
      Math.min(0.95, 0.4 + pitchComp + rollComp + (isLeft ? bumpOsc : -bumpOsc))
    );
    w.contactY = state.y;
  }

  // 8. Fifth-Wheel Articulated Trailer vs Rigid Lorry Kinematics
  if (!truckSpec.hasArticulatedTrailer) {
    state.trailerHeading = state.heading;
    state.articulationAngleRad = 0;
    state.jackknifeWarning = false;
    state.trailerX = state.x;
    state.trailerY = state.y;
    state.trailerZ = state.z;
    state.trailerPitch = state.pitch;
    state.trailerRoll = state.roll;
  } else {
    const kingpinX = state.x - forwardX * 1.9;
    const kingpinZ = state.z - forwardZ * 1.9;

    const hitchDiff = normalizeAngleRad(state.heading - state.trailerHeading);
    const trailerYawRate = (state.speedMs / TRAILER_KINGPIN_TO_AXLE_M) * Math.sin(hitchDiff);
    state.trailerHeading = normalizeAngleRad(state.trailerHeading + trailerYawRate * dt);

    let artAngle = normalizeAngleRad(state.heading - state.trailerHeading);
    const maxArticulationRad = 1.25;
    if (Math.abs(artAngle) > maxArticulationRad) {
      artAngle = Math.sign(artAngle) * maxArticulationRad;
      state.trailerHeading = normalizeAngleRad(state.heading - artAngle);
    }
    state.articulationAngleRad = artAngle;
    state.jackknifeWarning = Math.abs(artAngle) > 0.78;

    const trailerFwdX = Math.sin(state.trailerHeading);
    const trailerFwdZ = -Math.cos(state.trailerHeading);
    const trailerCenterOffset = 5.4;
    state.trailerX = kingpinX - trailerFwdX * trailerCenterOffset;
    state.trailerZ = kingpinZ - trailerFwdZ * trailerCenterOffset;

    const trailerProj = projectWorldToSpline(
      state.trailerX,
      state.trailerZ,
      state.distanceAlongHighwayM - 7.3
    );

    // Rigid guardrail clamping for the trailer so it never swings through outer guardrails or median barrier
    if (Math.abs(trailerProj.lateralOffset) > outerGuardrailLimit) {
      const clampedT = Math.sign(trailerProj.lateralOffset) * outerGuardrailLimit;
      const corrT = splineToWorld(trailerProj.s, clampedT, 0);
      state.trailerX = corrT.x;
      state.trailerZ = corrT.z;
      state.trailerHeading = state.heading;
      state.articulationAngleRad = 0;
    }

    state.trailerY = trailerProj.groundY;
    state.trailerPitch += (-trailerProj.grade - state.trailerPitch) * (1 - Math.exp(-12 * dt));
    state.trailerRoll +=
      (trailerProj.bankAngle + state.roll * 0.45 - state.trailerRoll) * (1 - Math.exp(-12 * dt));
  }

  // 9. Fuel Consumption & Next Waypoint Calculation
  const fuelRateLPerSec =
    0.0012 + (state.rpm / REDLINE_RPM) * effectiveThrottle * 0.016;
  state.fuelLiters = Math.max(0, state.fuelLiters - fuelRateLPerSec * dt);
  state.fuelConsumptionL100Km =
    state.speedKmh > 5
      ? Math.min(85, Math.round(((fuelRateLPerSec * 3600) / state.speedKmh) * 100 * 10) / 10)
      : 0;

  const wrappedS =
    ((state.distanceAlongHighwayM % HIGHWAY_LENGTH_M) + HIGHWAY_LENGTH_M) % HIGHWAY_LENGTH_M;
  const activeWaypoints = getActiveMapSpec().waypoints;
  let nextWp = activeWaypoints[0];
  let distToWp = HIGHWAY_LENGTH_M - wrappedS;
  for (const wp of activeWaypoints) {
    if (wp.s > wrappedS + 20) {
      nextWp = wp;
      distToWp = wp.s - wrappedS;
      break;
    }
  }
  state.nextWaypointName = nextWp.name;
  state.nextWaypointDistanceM = Math.max(0, Math.round(distToWp));

  return state;
}
