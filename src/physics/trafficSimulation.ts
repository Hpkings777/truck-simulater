import { LANE_CENTERS, splineToWorld } from './highwaySpline';
import { TruckPhysicsState } from './vehiclePhysics';

export type TrafficArchetype = 'lorry' | 'bus' | 'sedan' | 'pickup';

export interface TrafficVehicle {
  id: number;
  archetype: TrafficArchetype;
  direction: 1 | -1; // 1 = forward (Northbound, left side), -1 = oncoming (Southbound, right side)
  s: number; // Longitudinal distance along highway (meters)
  laneOffset: number; // Current lateral offset from centerline (meters)
  targetLaneOffset: number;
  speedMs: number;
  desiredSpeedMs: number;
  lengthM: number;
  widthM: number;
  colorHex: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  wheelRotationRad: number;
  indicator: 'off' | 'left' | 'right';
  laneChangeCooldownS: number;
  braking: boolean;
}

const ARCHETYPE_SPECS: Record<
  TrafficArchetype,
  {
    minSpeedKmh: number;
    maxSpeedKmh: number;
    lengthM: number;
    widthM: number;
    colors: number[];
  }
> = {
  lorry: {
    minSpeedKmh: 48,
    maxSpeedKmh: 64,
    lengthM: 9.6,
    widthM: 2.5,
    colors: [0xd97706, 0xb45309, 0x15803d, 0xb91c1c, 0x1d4ed8],
  },
  bus: {
    minSpeedKmh: 64,
    maxSpeedKmh: 78,
    lengthM: 11.4,
    widthM: 2.55,
    colors: [0x0284c7, 0xdc2626, 0x059669, 0xeab308],
  },
  sedan: {
    minSpeedKmh: 72,
    maxSpeedKmh: 92,
    lengthM: 4.5,
    widthM: 1.85,
    colors: [0xf8fafc, 0x94a3b8, 0x334155, 0xdc2626, 0x2563eb, 0xd97706],
  },
  pickup: {
    minSpeedKmh: 52,
    maxSpeedKmh: 68,
    lengthM: 5.1,
    widthM: 1.92,
    colors: [0xf1f5f9, 0xeab308, 0x0f766e, 0x78716c],
  },
};

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Creates a deterministic, well-spaced initial fleet of 24 AI vehicles
 * traveling in Left-Hand Traffic formation (forward vehicles on the left side,
 * oncoming vehicles on the right side of the divided highway).
 */
export function createInitialTrafficFleet(playerS = 60): TrafficVehicle[] {
  const archetypes: TrafficArchetype[] = ['lorry', 'bus', 'sedan', 'pickup'];
  const fleet: TrafficVehicle[] = [];

  for (let i = 0; i < 24; i++) {
    const isForward = i < 14; // 14 forward vehicles, 10 oncoming vehicles
    const direction: 1 | -1 = isForward ? 1 : -1;
    const archetype = archetypes[i % archetypes.length];
    const spec = ARCHETYPE_SPECS[archetype];
    const r1 = seededRandom(i * 17 + 3);
    const r2 = seededRandom(i * 31 + 11);

    // Prefer slow outer lanes for lorries/pickups, allow inner lane for sedans/buses
    const useInnerFastLane =
      archetype === 'sedan' || (archetype === 'bus' && r1 > 0.45);

    const laneOffset = isForward
      ? useInnerFastLane
        ? LANE_CENTERS.FORWARD_INNER
        : LANE_CENTERS.FORWARD_OUTER
      : useInnerFastLane
      ? LANE_CENTERS.ONCOMING_INNER
      : LANE_CENTERS.ONCOMING_OUTER;

    // Space vehicles cleanly ahead and behind player without overlapping player spawn (s = 60m)
    let sOffset = 0;
    if (isForward) {
      sOffset = 55 + i * 38;
    } else {
      sOffset = 90 + (i - 14) * 58;
    }
    const s = playerS + sOffset;

    const desiredSpeedKmh =
      spec.minSpeedKmh + r2 * (spec.maxSpeedKmh - spec.minSpeedKmh);
    const desiredSpeedMs = desiredSpeedKmh / 3.6;

    const worldPos = splineToWorld(s, laneOffset, 0);
    const heading =
      direction === 1
        ? worldPos.sample.heading
        : worldPos.sample.heading + Math.PI;

    fleet.push({
      id: i + 1,
      archetype,
      direction,
      s,
      laneOffset,
      targetLaneOffset: laneOffset,
      speedMs: desiredSpeedMs * 0.9,
      desiredSpeedMs,
      lengthM: spec.lengthM,
      widthM: spec.widthM,
      colorHex: spec.colors[i % spec.colors.length],
      x: worldPos.x,
      y: worldPos.y,
      z: worldPos.z,
      heading,
      pitch: -worldPos.sample.grade * direction,
      roll: worldPos.sample.bankAngle * direction,
      wheelRotationRad: 0,
      indicator: 'off',
      laneChangeCooldownS: 3 + (i % 5),
      braking: false,
    });
  }

  return fleet;
}

/**
 * Updates AI traffic using an Intelligent Driver Model (IDM) longitudinal controller,
 * polite overtaking lane-change rules, and collision detection against the player's truck.
 */
export function stepTrafficSimulation(
  fleet: TrafficVehicle[],
  player: TruckPhysicsState,
  rawDt: number
): void {
  const dt = Math.max(0.0001, Math.min(rawDt, 0.05));

  for (let i = 0; i < fleet.length; i++) {
    const v = fleet[i];
    v.laneChangeCooldownS = Math.max(0, v.laneChangeCooldownS - dt);

    // 1. Find closest lead obstacle in the same lane (another AI vehicle or the player)
    let minGapM = 999;
    let leadSpeedMs = v.desiredSpeedMs;

    for (let j = 0; j < fleet.length; j++) {
      if (i === j) continue;
      const other = fleet[j];
      if (other.direction !== v.direction) continue;
      if (Math.abs(other.laneOffset - v.laneOffset) > 2.1) continue;

      const deltaS = (other.s - v.s) * v.direction;
      const netGap = deltaS - (v.lengthM * 0.5 + other.lengthM * 0.5);
      if (deltaS > 0 && netGap < minGapM) {
        minGapM = netGap;
        leadSpeedMs = other.speedMs;
      }
    }

    // Also check player truck + trailer as a lead obstacle for forward traffic
    if (v.direction === 1) {
      const playerLateralDiff = Math.abs(player.lateralOffsetM - v.laneOffset);
      if (playerLateralDiff < 2.4) {
        const deltaS = player.distanceAlongHighwayM - v.s;
        const netGap = deltaS - (v.lengthM * 0.5 + 11.5); // 11.5m accounts for player trailer rear
        if (deltaS > -4 && netGap < minGapM) {
          minGapM = netGap;
          leadSpeedMs = Math.max(0, player.speedMs);
        }
      }
    }

    // 2. Overtaking / Lane Change Evaluation for Forward Traffic
    if (
      v.direction === 1 &&
      v.laneChangeCooldownS <= 0 &&
      Math.abs(v.laneOffset - v.targetLaneOffset) < 0.15 &&
      minGapM < 28 &&
      leadSpeedMs < v.desiredSpeedMs * 0.85
    ) {
      const altLane =
        Math.abs(v.laneOffset - LANE_CENTERS.FORWARD_OUTER) < 1.0
          ? LANE_CENTERS.FORWARD_INNER
          : LANE_CENTERS.FORWARD_OUTER;

      // Verify alternate lane is clear ahead and behind (including player truck)
      let altClear = true;
      if (
        Math.abs(player.lateralOffsetM - altLane) < 2.5 &&
        Math.abs(player.distanceAlongHighwayM - v.s) < 28
      ) {
        altClear = false;
      }
      if (altClear) {
        for (let j = 0; j < fleet.length; j++) {
          if (i === j) continue;
          const other = fleet[j];
          if (other.direction !== 1) continue;
          if (Math.abs(other.laneOffset - altLane) < 2.2 && Math.abs(other.s - v.s) < 26) {
            altClear = false;
            break;
          }
        }
      }

      if (altClear) {
        v.targetLaneOffset = altLane;
        v.laneChangeCooldownS = 7.5;
      }
    }

    // 3. IDM Longitudinal Acceleration & Smooth Braking
    const safeTimeHeadway = 1.6;
    const minStandstillGap = 6.5;
    const approachVel = v.speedMs - leadSpeedMs;
    const desiredDynamicGap =
      minStandstillGap +
      Math.max(0, v.speedMs * safeTimeHeadway + (v.speedMs * approachVel) / (2 * Math.sqrt(1.8 * 3.2)));

    const freeRoadTerm = 1 - Math.pow(v.speedMs / Math.max(1, v.desiredSpeedMs), 4);
    const interactionTerm =
      minGapM < 120 ? Math.pow(desiredDynamicGap / Math.max(1.5, minGapM), 2) : 0;
    const accelMs2 = Math.max(-6.5, Math.min(2.0, 1.8 * (freeRoadTerm - interactionTerm)));

    v.braking = accelMs2 < -0.65 || minGapM < 12;
    v.speedMs = Math.max(0, Math.min(v.desiredSpeedMs * 1.05, v.speedMs + accelMs2 * dt));

    // Advance longitudinal distance s
    v.s += v.speedMs * v.direction * dt;

    // Smooth lateral lane transition
    const latDiff = v.targetLaneOffset - v.laneOffset;
    if (Math.abs(latDiff) > 0.05) {
      const latStep = Math.sign(latDiff) * Math.min(Math.abs(latDiff), 1.85 * dt);
      v.laneOffset += latStep;
      v.indicator = latDiff > 0 ? 'right' : 'left';
    } else {
      v.laneOffset = v.targetLaneOffset;
      v.indicator = 'off';
    }

    // 4. Recycle AI vehicles outside active window around player [-140m .. +480m]
    const relS = v.s - player.distanceAlongHighwayM;
    if (v.direction === 1) {
      if (relS < -140) {
        v.s = player.distanceAlongHighwayM + 380 + (v.id % 7) * 18;
      } else if (relS > 520) {
        v.s = player.distanceAlongHighwayM - 95 - (v.id % 5) * 14;
      }
    } else {
      // Oncoming vehicles move toward -s; recycle behind player back to far ahead
      if (relS < -140) {
        v.s = player.distanceAlongHighwayM + 440 + (v.id % 8) * 22;
      } else if (relS > 560) {
        v.s = player.distanceAlongHighwayM + 420;
      }
    }

    // 5. Compute 3D World Transform from Highway Spline
    const worldPos = splineToWorld(v.s, v.laneOffset, 0);
    v.x = worldPos.x;
    v.y = worldPos.y;
    v.z = worldPos.z;
    const laneSteerHeadingOffset = Math.atan2(v.targetLaneOffset - v.laneOffset, 12) * 0.35;
    v.heading =
      (v.direction === 1 ? worldPos.sample.heading : worldPos.sample.heading + Math.PI) +
      laneSteerHeadingOffset;
    v.pitch = -worldPos.sample.grade * v.direction;
    v.roll = worldPos.sample.bankAngle * v.direction;
    v.wheelRotationRad = (v.wheelRotationRad + (v.speedMs / 0.45) * dt) % (Math.PI * 1000);

    // 6. Check Physical Bounding-Box Proximity / Collision with Player Tractor
    const longDist = Math.abs(v.s - player.distanceAlongHighwayM);
    const latDist = Math.abs(v.laneOffset - player.lateralOffsetM);
    const minSafeLong = v.lengthM * 0.5 + 3.8;
    const minSafeLat = v.widthM * 0.5 + 1.25;

    if (longDist < minSafeLong && latDist < minSafeLat) {
      // Separate vehicles cleanly along lateral or longitudinal axis
      if (latDist > longDist * 0.28) {
        const pushDir = player.lateralOffsetM >= v.laneOffset ? 1 : -1;
        player.lateralOffsetM += pushDir * (minSafeLat - latDist + 0.25);
        const pushedWorld = splineToWorld(player.distanceAlongHighwayM, player.lateralOffsetM, 0);
        player.x = pushedWorld.x;
        player.z = pushedWorld.z;
      } else {
        if (player.distanceAlongHighwayM < v.s) {
          player.speedMs = Math.min(player.speedMs, v.speedMs * v.direction * 0.75);
          v.s += 1.5;
        } else {
          v.speedMs *= 0.6;
          v.s -= 1.5;
        }
      }

      // Apply weight-scaled impact feedback (hitstop + camera shake + cargo damage)
      const relSpeed = Math.abs(player.speedMs - v.speedMs * v.direction);
      if (relSpeed > 2.5) {
        player.hitstopTimerS = Math.min(0.06, 0.025 + relSpeed * 0.002);
        player.cameraTrauma = Math.min(1.0, player.cameraTrauma + 0.35 + relSpeed * 0.03);
        player.cargoIntegrityPct = Math.max(
          0,
          Math.round((player.cargoIntegrityPct - Math.min(12, 2 + relSpeed * 0.45)) * 10) / 10
        );
        player.lastImpactSeverity = Math.min(1, relSpeed / 15);
      }
    }
  }
}
