export type MapCorridorId = 'nh44_plains' | 'nh48_ghats' | 'nh66_coastal';

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
  isTunnel: boolean;
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

export interface MapCorridorSpec {
  id: MapCorridorId;
  title: string;
  shortTitle: string;
  regionBadge: string;
  routeCode: string;
  subtitle: string;
  terrainSummary: string;
  originCoords: { lat: number; lng: number };
  destinationCoords: { lat: number; lng: number };
  defaultZoom: number;
  waypoints: HighwayWaypoint[];
}

export const HIGHWAY_LENGTH_M = 5000;

export const LANE_CENTERS = {
  FORWARD_OUTER: -7.6, // Leftmost slow/heavy truck lane
  FORWARD_INNER: -3.85, // Inner fast/overtaking lane
  ONCOMING_INNER: 3.85, // Oncoming fast lane
  ONCOMING_OUTER: 7.6, // Oncoming slow lane
} as const;

export const MAP_CORRIDORS: Record<MapCorridorId, MapCorridorSpec> = {
  nh44_plains: {
    id: 'nh44_plains',
    title: 'NH-44 Grand Trunk Plains (Ambala → Karnal)',
    shortTitle: 'NH-44 Punjab–Haryana Plains',
    regionBadge: 'HARYANA · PUNJAB',
    routeCode: 'NH-44',
    subtitle: 'Alluvial Indo-Gangetic Plains · Wheat Fields · Dhaba · Flyover ROB',
    terrainSummary: '6-Lane Divided Expressway · Gentle Curves · 274m ASL',
    originCoords: { lat: 30.3398, lng: 76.8367 },
    destinationCoords: { lat: 29.7429, lng: 76.9684 },
    defaultZoom: 15,
    waypoints: [
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
    ],
  },
  nh48_ghats: {
    id: 'nh48_ghats',
    title: 'NH-48 Bhor Ghat Mountain Pass (Khandala → Lonavala)',
    shortTitle: 'NH-48 Western Ghats Pass',
    regionBadge: 'MAHARASHTRA · SAHYADRI',
    routeCode: 'NH-48',
    subtitle: 'Steep Basalt Cliffs · Rock-Cut Tunnels · Waterfalls · Winding S-Curves',
    terrainSummary: 'Heavy Mountain Gradient (+6%) · Viaducts & Tunnels · 625m ASL',
    originCoords: { lat: 18.7645, lng: 73.3732 },
    destinationCoords: { lat: 18.7557, lng: 73.4091 },
    defaultZoom: 15,
    waypoints: [
      {
        s: 0,
        name: 'Khopoli Foot-Hills Climb Base',
        hindiSub: 'खोपोली घाट चढ़ाई प्रारंभ · एनएच ४८',
        code: 'NH-48 · KM 72.0',
        speedLimit: 60,
        elevationM: 480,
        lat: 18.7645,
        lng: 73.3732,
      },
      {
        s: 1200,
        name: 'Bhor Ghat Twin Rock-Cut Tunnel',
        hindiSub: 'भोर घाट सुरंग क्रमांक १',
        code: 'NH-48 · KM 73.2',
        speedLimit: 50,
        elevationM: 545,
        lat: 18.7618,
        lng: 73.3814,
      },
      {
        s: 2450,
        name: 'Amrutanjan Valley Viaduct & Truck Lay-By',
        hindiSub: 'अमृतांजन घाटी पुल एवं विश्राम स्थल',
        code: 'NH-48 · KM 74.5',
        speedLimit: 60,
        elevationM: 590,
        lat: 18.7592,
        lng: 73.3905,
      },
      {
        s: 3250,
        name: 'Khandala Cliffside Gallery & Waterfall',
        hindiSub: 'खंडाला प्रपात एवं क्लिफ कॉरिडोर',
        code: 'NH-48 · KM 75.3',
        speedLimit: 50,
        elevationM: 618,
        lat: 18.7574,
        lng: 73.3998,
      },
      {
        s: 4350,
        name: 'Lonavala Crest FASTag Checkpost Plaza',
        hindiSub: 'लोनावला शिखर टोल नाका',
        code: 'NH-48 · KM 76.4',
        speedLimit: 40,
        elevationM: 625,
        lat: 18.7557,
        lng: 73.4091,
      },
    ],
  },
  nh66_coastal: {
    id: 'nh66_coastal',
    title: 'NH-66 Konkan & Mumbai Coastal Sea-Link',
    shortTitle: 'NH-66 Coastal Sea-Link',
    regionBadge: 'KONKAN · ARABIAN SEA',
    routeCode: 'NH-66',
    subtitle: 'Cable-Stayed Ocean Pylons · Arabian Sea Causeway · Palm Islands',
    terrainSummary: 'Over-Water Suspension Span · Ocean Crosswinds · 18m ASL',
    originCoords: { lat: 19.0176, lng: 72.8152 },
    destinationCoords: { lat: 19.0468, lng: 72.8205 },
    defaultZoom: 15,
    waypoints: [
      {
        s: 0,
        name: 'Worli Seaface Coastal Approach',
        hindiSub: 'वरली समुद्री तटीय मार्ग · एनएच ६६',
        code: 'NH-66 · KM 14.0',
        speedLimit: 80,
        elevationM: 12,
        lat: 19.0176,
        lng: 72.8152,
      },
      {
        s: 1350,
        name: 'South Cable-Stayed Pylon Tower Span',
        hindiSub: 'दक्षिण केबल-स्टेड समुद्री सेतु',
        code: 'NH-66 · KM 15.4',
        speedLimit: 70,
        elevationM: 28,
        lat: 19.0265,
        lng: 72.8168,
      },
      {
        s: 2450,
        name: 'Konkan Coastal Causeway & Marine Rest Deck',
        hindiSub: 'कोंकण तटीय विश्राम डेक',
        code: 'NH-66 · KM 16.5',
        speedLimit: 80,
        elevationM: 14,
        lat: 19.0338,
        lng: 72.8181,
      },
      {
        s: 3400,
        name: 'North Navigation Channel Pylon Span',
        hindiSub: 'उत्तर नौवहन चैनल सेतु',
        code: 'NH-66 · KM 17.4',
        speedLimit: 70,
        elevationM: 24,
        lat: 19.0402,
        lng: 72.8194,
      },
      {
        s: 4350,
        name: 'Bandra Reclamation Coastal Toll Plaza',
        hindiSub: 'बांद्रा तटीय फास्टैग टोल प्लाज़ा',
        code: 'NH-66 · KM 18.4',
        speedLimit: 50,
        elevationM: 12,
        lat: 19.0468,
        lng: 72.8205,
      },
    ],
  },
};

let _activeMapId: MapCorridorId = 'nh44_plains';

export function getActiveMapId(): MapCorridorId {
  return _activeMapId;
}

export function setActiveMapId(mapId: MapCorridorId): void {
  _activeMapId = mapId;
}

export function getActiveMapSpec(mapId: MapCorridorId = _activeMapId): MapCorridorSpec {
  return MAP_CORRIDORS[mapId] ?? MAP_CORRIDORS.nh44_plains;
}

export const HIGHWAY_WAYPOINTS: HighwayWaypoint[] = MAP_CORRIDORS.nh44_plains.waypoints;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Deterministic horizontal curve X(s) per map corridor so each map has a genuinely different
 * driving geometry (sweeping plains expressway vs. winding mountain ghat S-curves vs. coastal sea-link).
 */
function rawXAtS(s: number, mapId: MapCorridorId = _activeMapId): number {
  const u = (s / HIGHWAY_LENGTH_M) * Math.PI * 2;
  if (mapId === 'nh48_ghats') {
    // Winding Western Ghats mountain pass with pronounced S-bends
    return (
      Math.sin(u) * 210 +
      Math.sin(u * 3 - 0.5) * 115 +
      Math.cos(u * 5 + 0.3) * 48 -
      Math.cos(0.3) * 48 -
      Math.sin(-0.5) * 115
    );
  }
  if (mapId === 'nh66_coastal') {
    // Broad sweeping coastal arc over the Arabian Sea bay
    return (
      Math.sin(u * 0.85) * 195 +
      Math.cos(u * 2 + 0.2) * 52 -
      Math.cos(0.2) * 52
    );
  }
  // Default nh44_plains
  return (
    Math.sin(u) * 145 +
    Math.sin(u * 2 - 0.6) * 68 +
    Math.cos(u * 3 + 0.4) * 28 -
    Math.cos(0.4) * 28 -
    Math.sin(-0.6) * 68
  );
}

/**
 * Vertical elevation profile Y(s) per map corridor.
 */
function rawYAtS(s: number, mapId: MapCorridorId = _activeMapId): number {
  const wrappedS = ((s % HIGHWAY_LENGTH_M) + HIGHWAY_LENGTH_M) % HIGHWAY_LENGTH_M;

  if (mapId === 'nh48_ghats') {
    // Dramatic mountain climb up to Khandala crest, leveling at the toll checkpost
    const climb1 = smoothstep(120, 1950, wrappedS) * 19.5;
    const valleyDip = smoothstep(2100, 2550, wrappedS) * (1 - smoothstep(2650, 3100, wrappedS)) * -4.2;
    const climb2 = smoothstep(2800, 3950, wrappedS) * 11.5;
    const descentToToll = smoothstep(4050, 4450, wrappedS) * -8.5;
    return Math.max(0, climb1 + valleyDip + climb2 + descentToToll);
  }

  if (mapId === 'nh66_coastal') {
    // Elevated suspension bridge spans at s=950..1850 (+14.2m) and s=3050..3850 (+11.8m)
    let span1 = 0;
    if (wrappedS >= 850 && wrappedS <= 1950) {
      const up = smoothstep(850, 1280, wrappedS);
      const down = 1 - smoothstep(1520, 1950, wrappedS);
      span1 = 14.2 * up * down;
    }
    let span2 = 0;
    if (wrappedS >= 2950 && wrappedS <= 3900) {
      const up = smoothstep(2950, 3300, wrappedS);
      const down = 1 - smoothstep(3550, 3900, wrappedS);
      span2 = 11.8 * up * down;
    }
    return Math.max(0, 2.2 + span1 + span2);
  }

  // Default nh44_plains
  let flyover1 = 0;
  if (wrappedS >= 950 && wrappedS <= 1850) {
    const up = smoothstep(950, 1280, wrappedS);
    const down = 1 - smoothstep(1520, 1850, wrappedS);
    flyover1 = 7.8 * up * down;
  }

  let flyover2 = 0;
  if (wrappedS >= 3150 && wrappedS <= 3750) {
    const up = smoothstep(3150, 3380, wrappedS);
    const down = 1 - smoothstep(3520, 3750, wrappedS);
    flyover2 = 4.2 * up * down;
  }

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

export function getZoneMetadata(
  s: number,
  mapId: MapCorridorId = _activeMapId
): {
  zoneName: string;
  landmarkKm: string;
  speedLimitKmh: number;
  isBridge: boolean;
  isTunnel: boolean;
  isTollPlaza: boolean;
} {
  const wrappedS = ((s % HIGHWAY_LENGTH_M) + HIGHWAY_LENGTH_M) % HIGHWAY_LENGTH_M;
  const spec = getActiveMapSpec(mapId);
  const baseKm = mapId === 'nh44_plains' ? 202 : mapId === 'nh48_ghats' ? 72 : 14;
  const kmNum = (baseKm + wrappedS / 1000).toFixed(1);

  const isBridge =
    mapId === 'nh66_coastal'
      ? (wrappedS >= 850 && wrappedS <= 1950) || (wrappedS >= 2950 && wrappedS <= 3900)
      : (wrappedS >= 1020 && wrappedS <= 1780) || (wrappedS >= 3220 && wrappedS <= 3680);

  const isTunnel =
    mapId === 'nh48_ghats' &&
    ((wrappedS >= 1150 && wrappedS <= 1550) || (wrappedS >= 3180 && wrappedS <= 3540));

  const isTollPlaza = wrappedS >= 4220 && wrappedS <= 4520;

  const wps = spec.waypoints;
  let activeWp = wps[0];
  for (const wp of wps) {
    if (wrappedS >= wp.s - 150) {
      activeWp = wp;
    }
  }

  return {
    zoneName: activeWp.name,
    landmarkKm: `${spec.routeCode} · KM ${kmNum}`,
    speedLimitKmh: isTollPlaza ? 40 : activeWp.speedLimit,
    isBridge,
    isTunnel,
    isTollPlaza,
  };
}

export function getRoadPointAtDistance(
  s: number,
  mapId: MapCorridorId = _activeMapId
): RoadSample {
  const ds = 1.0;
  const x0 = rawXAtS(s - ds, mapId);
  const x1 = rawXAtS(s, mapId);
  const x2 = rawXAtS(s + ds, mapId);

  const y0 = rawYAtS(s - ds, mapId);
  const y1 = rawYAtS(s, mapId);
  const y2 = rawYAtS(s + ds, mapId);

  const z1 = -s;

  const dx = (x2 - x0) / (2 * ds);
  const dy = (y2 - y0) / (2 * ds);
  const dz = -1.0;

  const len = Math.hypot(dx, dy, dz) || 1;
  const tangentX = dx / len;
  const tangentY = dy / len;
  const tangentZ = dz / len;

  const horizLen = Math.hypot(dx, dz) || 1;
  const normalX = -dz / horizLen;
  const normalZ = dx / horizLen;

  const heading = Math.atan2(dx, -dz);

  const d2x = (x2 - 2 * x1 + x0) / (ds * ds);
  const curvature = d2x / Math.pow(1 + dx * dx, 1.5);

  const bankAngle = Math.max(-0.085, Math.min(0.085, -curvature * 14.0));
  const grade = dy;

  const meta = getZoneMetadata(s, mapId);

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

export function splineToWorld(
  s: number,
  lateralOffset: number,
  verticalOffset = 0,
  mapId: MapCorridorId = _activeMapId
): { x: number; y: number; z: number; sample: RoadSample } {
  const sample = getRoadPointAtDistance(s, mapId);
  const x = sample.x + sample.normalX * lateralOffset;
  const z = sample.z + sample.normalZ * lateralOffset;
  const bankDrop = Math.sin(sample.bankAngle) * lateralOffset;
  const y = sample.y + bankDrop + verticalOffset;
  return { x, y, z, sample };
}

/**
 * Converts simulator highway longitudinal distance `s` and lateral offset into
 * real-world GPS `{ lat, lng, altitude }` along the active corridor's waypoints.
 */
export function splineToRealWorldGps(
  s: number,
  lateralOffset = 0,
  mapId: MapCorridorId = _activeMapId
): { lat: number; lng: number; altitude: number } {
  const spec = getActiveMapSpec(mapId);
  const wps = spec.waypoints;
  const clampedS = Math.max(0, Math.min(HIGHWAY_LENGTH_M, s));

  let i0 = 0;
  for (let i = 0; i < wps.length - 1; i++) {
    if (clampedS >= wps[i].s) {
      i0 = i;
    }
  }
  const w0 = wps[i0];
  const w1 = wps[Math.min(wps.length - 1, i0 + 1)];
  const span = Math.max(1, w1.s - w0.s);
  const t = Math.max(0, Math.min(1, (clampedS - w0.s) / span));

  const baseLat = w0.lat + (w1.lat - w0.lat) * t;
  const baseLng = w0.lng + (w1.lng - w0.lng) * t;
  const baseAlt = w0.elevationM + (w1.elevationM - w0.elevationM) * t;

  // Apply minor lateral offset in degrees (~1.11e-5 deg per meter)
  const lat = baseLat;
  const lng = baseLng + lateralOffset * 0.00001;
  return { lat, lng, altitude: Math.round(baseAlt) };
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

export function projectWorldToSpline(
  worldX: number,
  worldZ: number,
  hintS?: number,
  mapId: MapCorridorId = _activeMapId
): SplineProjection {
  let s = typeof hintS === 'number' && Math.abs(-worldZ - hintS) < 40 ? hintS : -worldZ;

  for (let iter = 0; iter < 2; iter++) {
    const pt = getRoadPointAtDistance(s, mapId);
    const errX = worldX - pt.x;
    const errZ = worldZ - pt.z;
    const horizLen = Math.hypot(pt.tangentX, pt.tangentZ) || 1;
    const tx = pt.tangentX / horizLen;
    const tz = pt.tangentZ / horizLen;
    s += errX * tx + errZ * tz;
  }

  const sample = getRoadPointAtDistance(s, mapId);
  const relX = worldX - sample.x;
  const relZ = worldZ - sample.z;

  const lateralOffset = relX * sample.normalX + relZ * sample.normalZ;
  const absLat = Math.abs(lateralOffset);

  const asphaltOuterLimit = sample.isTollPlaza ? 15.2 : 9.6;
  const shoulderOuterLimit = sample.isTollPlaza ? 17.5 : 12.2;
  const medianHalfWidth = sample.isTollPlaza ? 0.8 : 1.65;

  let surfaceType: RoadSurfaceType = 'asphalt';
  let surfaceBump = 0;

  if (absLat < medianHalfWidth) {
    surfaceType = 'median';
    surfaceBump = 0.04;
  } else if (absLat <= asphaltOuterLimit) {
    surfaceType = 'asphalt';
    if (mapId === 'nh48_ghats') {
      surfaceBump = Math.sin(s * 1.8) * 0.004;
    }
  } else if (absLat <= shoulderOuterLimit) {
    surfaceType = 'shoulder';
    // Rigid compacted gravel shoulder with subtle rumble strip vibration, never dropping below road deck
    surfaceBump = Math.sin(s * 4.2) * 0.008;
  } else {
    surfaceType = 'offroad';
    surfaceBump = Math.sin(s * 3.0) * 0.012;
  }

  if (sample.isBridge && surfaceType === 'asphalt') {
    const modBridge = ((s % 40) + 40) % 40;
    if (modBridge < 0.45) {
      surfaceBump += 0.012 * Math.sin((modBridge / 0.45) * Math.PI);
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
