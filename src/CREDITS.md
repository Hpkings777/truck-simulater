# Credits, Geospatial Data & Asset Licensing

## 1. Geospatial & Highway Alignment Data
- **North Indian National Highway Corridor (NH-44 Grand Trunk Road: Ambala Cantt → Shahbad Markanda → Pipli Kurukshetra → Karnal Toll Plaza)**:
  - Waypoint coordinates, corridor topology, elevation profile, and regional signage nomenclature derived from **OpenStreetMap** data, licensed under the **Open Data Commons Open Database License (ODbL)** (`© OpenStreetMap contributors`).
- **Google Maps Platform Photorealistic 3D Tiles Support (`src/world/geospatialTiles.ts`)**:
  - Supports optional connection to Google Maps Platform Map Tiles API (`https://tile.googleapis.com/v1/3dtiles/root.json`) when a billing-enabled `VITE_GOOGLE_MAPS_API_KEY` is configured.
  - In full compliance with Google Maps Platform Terms of Service, the playable highway mesh, lane markings, barriers, and collision geometry are constructed 100% independently from the NH-44 spline rather than extracted or traced from Google 3D Tiles.

## 2. 3D Models, PBR Materials & Procedural Textures
- All 3D vehicle models (6x4 heavy tractor unit, RHD driver cabin interior, 40ft corrugated shipping container trailer, and AI traffic fleet), highway infrastructure (gantry signs, milestones, flyovers, toll plaza), and PBR textures (`CanvasTexture` albedo, bump, and roughness maps) are procedurally authored in code using **Three.js** (`MIT License`).

## 3. Audio Synthesis
- All engine, turbocharger, pneumatic air-brake, gear-shift, dual-tone pressure horn, turn-indicator relay, and road/wind sounds are synthesized in real time using the browser's native **Web Audio API** (`src/audio/truckAudio.ts`).
