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

  // Impact & Juice Feedback
  hitstopTimerS: number;
  cameraTrauma: number; // 0..1 decaying trauma
  lastImpactSeverity: number;
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

  // Decay camera trauma & hitstop in real time
  state.cameraTrauma = Math.max(0, state.cameraTrauma - dt * 1.45);
  if (state.hitstopTimerS > 0) {
    state.hitstopTimerS = Math.max(0, state.hitstopTimerS - dt);
    return state;
  }

  // 1. Speed-Sensitive Heavy Steering Dynamics
  const absSpeedKmh = Math.abs(state.speedMs) * 3.6;
  const speedSteerFactor = 1 / (1 + Math.pow(absSpeedKmh / 42, 1.45));
  const maxAllowedSteer = MAX_STEER_ANGLE_RAD * Math.max(0.22, speedSteerFactor);
  const targetSteerRad = -input.steer * maxAllowedSteer;
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

  const clutchLaunchRpm = IDLE_RPM + effectiveThrottle * 720;
  const targetRpm =
    currentGear.ratio === 0 || state.shiftCooldownS > 0
      ? IDLE_RPM + effectiveThrottle * 1150
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
    const engineTorque = computeEngineTorqueNm(state.rpm, truckSpec.peakTorqueNm);
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

  // 5. Kinematic Bicycle + Lateral Slip Model for Heavy Tractor
  const curvatureFromSteer = Math.tan(state.steerAngleRad) / wheelbaseM;
  const trailerDamping = 1 / (1 + Math.abs(state.articulationAngleRad) * 0.35);
  state.yawRateRadS = state.speedMs * curvatureFromSteer * trailerDamping;
  state.heading = normalizeAngleRad(state.heading + state.yawRateRadS * dt);

  const forwardX = Math.sin(state.heading);
  const forwardZ = -Math.cos(state.heading);
  state.x += forwardX * state.speedMs * dt;
  state.z += forwardZ * state.speedMs * dt;

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
  // Guardrail sits at ±12.2m; truck half-width is ~1.25m, so rigid center limit is ±10.85m
  // (Widens to -22.5m on the left along the Dhaba parking apron at s=2385..2515, and ±14.8m at Toll Plaza)
  const isDhabaLayby = proj.s > 2385 && proj.s < 2515 && proj.lateralOffset < 0;
  const outerGuardrailLimit = proj.sample.isTollPlaza
    ? 14.8
    : isDhabaLayby
      ? 22.5
      : 10.85;
  if (Math.abs(proj.lateralOffset) > outerGuardrailLimit) {
    const clampedLat = Math.sign(proj.lateralOffset) * outerGuardrailLimit;
    const corrected = splineToWorld(proj.s, clampedLat, 0);
    state.x = corrected.x;
    state.z = corrected.z;
    state.lateralOffsetM = clampedLat;
    const headingError = normalizeAngleRad(proj.sample.heading - state.heading);
    state.heading = normalizeAngleRad(state.heading + headingError * 0.55);
    if (state.speedKmh > 25) {
      state.speedMs *= 0.88;
      state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.35);
      state.cargoIntegrityPct = Math.max(0, state.cargoIntegrityPct - 1.5);
    }
  }

  if (!proj.sample.isTollPlaza && Math.abs(proj.lateralOffset) < 1.85) {
    const pushSide = proj.lateralOffset <= 0 ? -1.9 : 1.9;
    const corrected = splineToWorld(proj.s, pushSide, 0);
    state.x = corrected.x;
    state.z = corrected.z;
    state.lateralOffsetM = pushSide;
    const headingError = normalizeAngleRad(proj.sample.heading - state.heading);
    state.heading = normalizeAngleRad(state.heading + headingError * 0.55);
    if (state.speedKmh > 20) {
      state.speedMs *= 0.82;
      state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.45);
      state.cargoIntegrityPct = Math.max(0, state.cargoIntegrityPct - 2.5);
      state.lastImpactSeverity = 0.5;
    }
  }

  // 7. 6-Wheel Suspension & Cabin Pitch/Roll Dynamics (R4 & R5)
  state.y = proj.groundY;

  const targetPitch =
    -proj.grade + Math.max(-0.075, Math.min(0.06, state.accelerationMs2 * 0.012));
  const lateralAccelMs2 = state.speedMs * state.yawRateRadS;
  const targetRoll =
    proj.bankAngle + Math.max(-0.11, Math.min(0.11, -lateralAccelMs2 * 0.022));

  state.pitch += (targetPitch - state.pitch) * (1 - Math.exp(-10 * dt));
  state.roll += (targetRoll - state.roll) * (1 - Math.exp(-10 * dt));

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
