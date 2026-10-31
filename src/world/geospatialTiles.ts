/**
 * Geospatial Data & Google Maps Platform Photorealistic 3D Tiles Manager
 *
 * Implements the architecture required by Section 2 of the specification:
 * 1. Investigates whether a valid Google Maps Platform Map Tiles API key (`VITE_GOOGLE_MAPS_API_KEY`)
 *    is configured and authorized for Photorealistic 3D Tiles (`tile.googleapis.com/v1/3dtiles/root.json`).
 * 2. Never pretends that Google Maps 3D Tiles are connected when they are not.
 * 3. Preserves Google Maps copyright attribution and data-provider credits whenever connected.
 * 4. Keeps the drivable highway geometry 100% independent of 3D Tiles using legally usable
 *    OpenStreetMap (ODbL) NH-44 Grand Trunk Road corridor data (Ambala -> Shahbad -> Pipli -> Karnal).
 */

export interface GeospatialStatus {
  mode: 'google_3d_tiles' | 'osm_nh44_corridor';
  googleTilesConnected: boolean;
  statusSummary: string;
  dataAttribution: string;
  corridorName: string;
  originCoords: { lat: number; lng: number };
  destinationCoords: { lat: number; lng: number };
  loadedTilesCount: number;
}

export async function probeGoogle3DTilesAvailability(
  customApiKey?: string
): Promise<GeospatialStatus> {
  const envKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '';
  const apiKey = (customApiKey || envKey).trim();

  const defaultOsmFallback: GeospatialStatus = {
    mode: 'osm_nh44_corridor',
    googleTilesConnected: false,
    statusSummary: apiKey
      ? 'Google Map Tiles API key lacks 3D Tiles session authorization — active fallback: OSM NH-44 Grand Trunk Corridor + Procedural PBR Terrain'
      : 'No Map Tiles API key configured — active: OpenStreetMap (ODbL) NH-44 Grand Trunk Road Alignment + Procedural PBR Environment',
    dataAttribution:
      'Road Alignment & Waypoints © OpenStreetMap contributors (ODbL) · NH-44 Ambala–Karnal Corridor',
    corridorName: 'NH-44 Grand Trunk Road (Ambala Cantt → Karnal Toll Plaza)',
    originCoords: { lat: 30.3398, lng: 76.8367 },
    destinationCoords: { lat: 29.7429, lng: 76.9684 },
    loadedTilesCount: 0,
  };

  if (!apiKey || apiKey === 'MY_GOOGLE_MAPS_API_KEY') {
    return defaultOsmFallback;
  }

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3500);
    const endpoint = `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(
      apiKey
    )}`;
    const response = await fetch(endpoint, { signal: controller.signal });
    window.clearTimeout(timeout);

    if (!response.ok) {
      return defaultOsmFallback;
    }

    const rootJson = await response.json();
    if (rootJson && rootJson.root) {
      return {
        mode: 'google_3d_tiles',
        googleTilesConnected: true,
        statusSummary:
          'Google Maps Platform Photorealistic 3D Tiles root tileset verified (independent OSM NH-44 drivable road surface active)',
        dataAttribution:
          'Map Tiles © Google · Road Corridor © OpenStreetMap contributors (ODbL)',
        corridorName: 'NH-44 Grand Trunk Road (Ambala Cantt → Karnal Toll Plaza)',
        originCoords: { lat: 30.3398, lng: 76.8367 },
        destinationCoords: { lat: 29.7429, lng: 76.9684 },
        loadedTilesCount: 1,
      };
    }
    return defaultOsmFallback;
  } catch {
    return defaultOsmFallback;
  }
}
