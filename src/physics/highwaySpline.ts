export interface RoadSample {
  s: number; // Longitudinal distance along highway (meters)
  x: number; // World X (meters, East-West deviation)
  y: number; // World Y (meters, elevation)
  z: number; // World Z (meters, Northbound = negative Z)
  tangentX: number;
  tangentY: number;
  tangentZ: number;
  normalX: number; // Points to RIGHT side of highway (+lateralOffset)
  normalZ: number;
  heading: number; // Radians, 0 = -Z (North), positive = East (+X)
  curvature: number; // 1/R (m^-1)
  bankAngle: number; // Superelevation roll angle (radians)
  grade: number; // Longitudinal slope dy/ds
  zoneName: string;
  landmarkKm: string;
  speedLimitKmh: number;
  isBridge: boolean;
  isTollPlaza: boolean;
}

export interface HighwayWaypoint {
  s: number;
  name: string;
  hindiSub: string;
  code: string;
  speedLimit: number;
  elevationM: number;
  lat: number;
  lng: number;
}

export const HIGHWAY_LENGTH_M = 5000;

// Left-hand traffic (India) 4-lane divided highway cross-section (in meters from centerline):
// Left outer shoulder: -12.2 to -9.5
// Forward Lane 1 (Heavy/Slow Lane, Left): center at -7.6m (width 3.75m: -9.5 to -5.75)
// Forward Lane 2 (Overtaking/Fast Lane, Inner Left): center at -3.85m (width 3.75m: -5.75 to -2.0)
// Central Median + Concrete Jersey Barrier: -2.0m to +2.0m
// Oncoming Lane 2 (Inner Right): center at +3.85m (+2.0 to +5.75)
// Oncoming Lane 1 (Outer Right): center at +7.6m (+5.75 to +9.5)
// Right outer shoulder: +9.5 to +12.2
export const LANE_CENTERS = {
  FORWARD_OUTER: -7.6, // Leftmost slow/heavy truck lane
  FORWARD_INNER: -3.85, // Inner fast/overtaking lane
  ONCOMING_INNER: 3.85, // Oncoming fast lane
  ONCOMING_OUTER: 7.6, // Oncoming slow lane
} as const;

export const HIGHWAY_WAYPOINTS: HighwayWaypoint[] = [
  {
    s: 0,
    name: 'Ambala Cantt Freight Corridor',
    hindiSub: 'अंबाला छावनी राष्ट्रीय राजमार्ग ४४',
    code: 'NH-44 · KM 202.0',
    speedLimit: 80,
    elevationM: 274,
    lat: 30.3398,
    lng: 76.8367,
  },
  {
    s: 1150,
    name: 'Shahbad Markanda Flyover (ROB)',
    hindiSub: 'शाहबाद मारकंडा रेल ओवरब्रिज',
    code: 'NH-44 · KM 203.2',
    speedLimit: 70,
    elevationM: 282,
    lat: 30.1672,
    lng: 76.8712,
  },
  {
    s: 2450,
    name: 'Sher-e-Punjab Highway Dhaba & Fuel Plaza',
    hindiSub: 'शेर-ए-पंजाब ढाबा एवं विश्राम केंद्र',
    code: 'NH-44 · KM 204.5',
    speedLimit: 80,
    elevationM: 275,
    lat: 30.0418,
    lng: 76.8965,
  },
  {
    s: 3450,
    name: 'Pipli Kurukshetra Express Interchange',
    hindiSub: 'पिपली कुरुक्षेत्र एक्सप्रेस चौराहा',
    code: 'NH-44 · KM 205.5',
    speedLimit: 80,
    elevationM: 278,
    lat: 29.9781,
    lng: 76.8902,
  },
  {
    s: 4350,
    name: 'Karnal 6-Lane FASTag Toll Plaza',
    hindiSub: 'करनाल टोल प्लाज़ा · फास्टैग लेन',
    code: 'NH-44 · KM 206.4',
    speedLimit: 50,
    elevationM: 274,
    lat: 29.7429,
    lng: 76.9684,
  },
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Deterministic parametric horizontal curve X(s) and elevation Y(s)
 * designed to feel like a genuine North Indian national highway with gentle sweeping curves,
 * straight high-speed stretches, a railway overbridge flyover, and a widened toll approach.
 */
function rawXAtS(s: number): number {
  // Periodic over 5000m so it can loop seamlessly if the driver continues past 5km
  const u = (s / HIGHWAY_LENGTH_M) * Math.PI * 2;
  return (
    Math.sin(u) * 145 +
    Math.sin(u * 2 - 0.6) * 68 +
    Math.cos(u * 3 + 0.4) * 28 -
    Math.cos(0.4) * 28 -
    Math.sin(-0.6) * 68
  );
}

function rawYAtS(s: number): number {
  const wrappedS = ((s % HIGHWAY_LENGTH_M) + HIGHWAY_LENGTH_M) % HIGHWAY_LENGTH_M;

  // 1. Shahbad Markanda Flyover (s = 980m to 1820m, crest at 1400m, height +7.8m)
  let flyover1 = 0;
  if (wrappedS >= 950 && wrappedS <= 1850) {
    const up = smoothstep(950, 1280, wrappedS);
    const down = 1 - smoothstep(1520, 1850, wrappedS);
    flyover1 = 7.8 * up * down;
  }

  // 2. Pipli Interchange gentle overpass rise (s = 3150m to 3750m, height +4.2m)
  let flyover2 = 0;
  if (wrappedS >= 3150 && wrappedS <= 3750) {
    const up = smoothstep(3150, 3380, wrappedS);
    const down = 1 - smoothstep(3520, 3750, wrappedS);
    flyover2 = 4.2 * up * down;
  }

  // Subtle natural terrain undulation outside the toll plaza
  const tollFlat =
    wrappedS >= 4100 && wrappedS <= 4650
      ? 1 - smoothstep(4100, 4200, wrappedS) * (1 - smoothstep(4550, 4650, wrappedS))
      : 1;
  const undulation =
    (Math.sin((wrappedS / HIGHWAY_LENGTH_M) * Math.PI * 4) * 0.9 +
      Math.cos((wrappedS / HIGHWAY_LENGTH_M) * Math.PI * 8) * 0.35 -
      0.35) *
    tollFlat;

  return Math.max(0, flyover1 + flyover2 + undulation);
}

export function getZoneMetadata(s: number): {
  zoneName: string;
  landmarkKm: string;
  speedLimitKmh: number;
  isBridge: boolean;
  isTollPlaza: boolean;
} {
  const wrappedS = ((s % HIGHWAY_LENGTH_M) + HIGHWAY_LENGTH_M) % HIGHWAY_LENGTH_M;
  const kmNum = (202 + wrappedS / 1000).toFixed(1);
  const isBridge =
    (wrappedS >= 1020 && wrappedS <= 1780) || (wrappedS >= 3220 && wrappedS <= 3680);
  const isTollPlaza = wrappedS >= 4220 && wrappedS <= 4520;

  if (wrappedS < 950) {
    return {
      zoneName: 'Ambala Cantt Express Corridor',
      landmarkKm: `NH-44 · KM ${kmNum}`,
      speedLimitKmh: 80,
      isBridge,
      isTollPlaza,
    };
  }
  if (wrappedS < 1900) {
    return {
      zoneName: 'Shahbad Markanda Flyover (ROB)',
      landmarkKm: `NH-44 · KM ${kmNum}`,
      speedLimitKmh: 70,
      isBridge,
      isTollPlaza,
    };
  }
  if (wrappedS < 3050) {
    return {
      zoneName: 'Sher-e-Punjab Dhaba & Agro Belt',
      landmarkKm: `NH-44 · KM ${kmNum}`,
      speedLimitKmh: 80,
      isBridge,
      isTollPlaza,
    };
  }
  if (wrappedS < 4050) {
    return {
      zoneName: 'Pipli Kurukshetra Interchange',
      landmarkKm: `NH-44 · KM ${kmNum}`,
      speedLimitKmh: 80,
      isBridge,
      isTollPlaza,
    };
  }
  return {
    zoneName: 'Karnal FASTag Toll Plaza Approach',
    landmarkKm: `NH-44 · KM ${kmNum}`,
    speedLimitKmh: isTollPlaza ? 40 : 60,
    isBridge,
    isTollPlaza,
  };
}

/**
 * Computes full geometric and road metadata at longitudinal distance `s` (meters).
 * Note: Forward travel increases `s` (moving toward -Z in world space).
 */
export function getRoadPointAtDistance(s: number): RoadSample {
  const ds = 1.0;
  const x0 = rawXAtS(s - ds);
  const x1 = rawXAtS(s);
  const x2 = rawXAtS(s + ds);

  const y0 = rawYAtS(s - ds);
  const y1 = rawYAtS(s);
  const y2 = rawYAtS(s + ds);

  // World Z progresses negatively as s increases (Northbound = -Z)
  const z1 = -s;

  const dx = (x2 - x0) / (2 * ds);
  const dy = (y2 - y0) / (2 * ds);
  const dz = -1.0;

  const len = Math.hypot(dx, dy, dz) || 1;
  const tangentX = dx / len;
  const tangentY = dy / len;
  const tangentZ = dz / len;

  // Horizontal normal pointing to the RIGHT of forward travel (+lateralOffset)
  const horizLen = Math.hypot(dx, dz) || 1;
  const normalX = -dz / horizLen; // +1 when dx=0, dz=-1
  const normalZ = dx / horizLen;

  // Heading: 0 when pointing straight along -Z, positive when turning right (+X)
  const heading = Math.atan2(dx, -dz);

  // Second derivative for horizontal curvature & banking
  const d2x = (x2 - 2 * x1 + x0) / (ds * ds);
  const curvature = d2x / Math.pow(1 + dx * dx, 1.5);

  // Superelevation banking: bank into the turn, clamped to ±4.5 degrees (0.078 rad)
  const bankAngle = Math.max(-0.078, Math.min(0.078, -curvature * 14.0));
  const grade = dy;

  const meta = getZoneMetadata(s);

  return {
    s,
    x: x1,
    y: y1,
    z: z1,
    tangentX,
    tangentY,
    tangentZ,
    normalX,
    normalZ,
    heading,
    curvature,
    bankAngle,
    grade,
    ...meta,
  };
}

/**
 * Converts spline coordinates (longitudinal distance `s` and signed `lateralOffset`)
 * into 3D world coordinates (x, y, z) accounting for road elevation and banking.
 */
export function splineToWorld(
  s: number,
  lateralOffset: number,
  verticalOffset = 0
): { x: number; y: number; z: number; sample: RoadSample } {
  const sample = getRoadPointAtDistance(s);
  const x = sample.x + sample.normalX * lateralOffset;
  const z = sample.z + sample.normalZ * lateralOffset;
  const bankDrop = Math.sin(sample.bankAngle) * lateralOffset;
  const y = sample.y + bankDrop + verticalOffset;
  return { x, y, z, sample };
}

export type RoadSurfaceType = 'asphalt' | 'shoulder' | 'median' | 'offroad';

export interface SplineProjection {
  s: number;
  lateralOffset: number;
  groundY: number;
  heading: number;
  bankAngle: number;
  grade: number;
  surfaceType: RoadSurfaceType;
  sample: RoadSample;
}

/**
 * Projects an arbitrary world (x, z) position onto the highway spline,
 * returning longitudinal distance `s`, signed `lateralOffset` from centerline,
 * exact surface elevation `groundY`, and surface classification.
 */
export function projectWorldToSpline(
  worldX: number,
  worldZ: number,
  hintS?: number
): SplineProjection {
  let s = typeof hintS === 'number' && Math.abs(-worldZ - hintS) < 40 ? hintS : -worldZ;

  // 2-step orthogonal Newton refinement along horizontal tangent
  for (let iter = 0; iter < 2; iter++) {
    const pt = getRoadPointAtDistance(s);
    const errX = worldX - pt.x;
    const errZ = worldZ - pt.z;
    const horizLen = Math.hypot(pt.tangentX, pt.tangentZ) || 1;
    const tx = pt.tangentX / horizLen;
    const tz = pt.tangentZ / horizLen;
    s += errX * tx + errZ * tz;
  }

  const sample = getRoadPointAtDistance(s);
  const relX = worldX - sample.x;
  const relZ = worldZ - sample.z;

  // Signed lateral offset from road centerline
  const lateralOffset = relX * sample.normalX + relZ * sample.normalZ;
  const absLat = Math.abs(lateralOffset);

  // Widened plaza around s = 4220..4520 has wider asphalt (up to 15.5m)
  const asphaltOuterLimit = sample.isTollPlaza ? 15.2 : 9.6;
  const shoulderOuterLimit = sample.isTollPlaza ? 17.5 : 12.4;
  const medianHalfWidth = sample.isTollPlaza ? 0.8 : 1.75;

  let surfaceType: RoadSurfaceType = 'asphalt';
  let surfaceBump = 0;

  if (absLat < medianHalfWidth) {
    surfaceType = 'median';
    surfaceBump = 0.18; // Raised median curb
  } else if (absLat <= asphaltOuterLimit) {
    surfaceType = 'asphalt';
  } else if (absLat <= shoulderOuterLimit) {
    surfaceType = 'shoulder';
    // Subtle shoulder rumble strip oscillation
    surfaceBump = Math.sin(s * 3.5) * 0.012 - 0.03;
  } else {
    surfaceType = 'offroad';
    // Embankment slope down to surrounding agricultural plain
    const dropDist = Math.min(10, absLat - shoulderOuterLimit);
    surfaceBump = -dropDist * 0.18 + Math.sin(worldX * 0.4 + s * 0.3) * 0.04;
  }

  // Bridge expansion joint subtle micro-bump every 40m on bridges
  if (sample.isBridge && surfaceType === 'asphalt') {
    const modBridge = ((s % 40) + 40) % 40;
    if (modBridge < 0.45) {
      surfaceBump += 0.018 * Math.sin((modBridge / 0.45) * Math.PI);
    }
  }

  const bankDrop = Math.sin(sample.bankAngle) * lateralOffset;
  const groundY = sample.y + bankDrop + surfaceBump;

  return {
    s,
    lateralOffset,
    groundY,
    heading: sample.heading,
    bankAngle: sample.bankAngle,
    grade: sample.grade,
    surfaceType,
    sample,
  };
}
