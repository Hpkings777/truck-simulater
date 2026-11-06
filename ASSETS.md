# ASSETS & LICENSES MANIFEST (`ASSETS.md`)

All 3D truck models, environment meshes, PBR surface materials, and geospatial datasets used in **Grand Trunk NH-44: Heavy Haul 3D Simulator** are documented below with their sources and licenses.

## 1. 3D Vehicle Models (`/public/models/*.glb` & `src/world/truckBuilder.ts`)

| Asset ID | Model File / Asset | Description | Source & License |
| :--- | :--- | :--- | :--- |
| `tata_prima_4928` | `/public/models/tata_prima_4928.glb` + Articulated Sub-Rig | **Tata Prima 4928.S 6×4 Heavy Container Tractor-Trailer** (Crimson metallic aero sleeper cab, roof wind deflector, 40ft corrugated ISO container semi-trailer) | Original Khronos glTF 2.0 binary `.glb` + Three.js articulated vehicle assembly (`CC0 1.0 Universal` / `Apache-2.0`) |
| `ashok_leyland_3520` | `/public/models/ashok_leyland_3520.glb` + Articulated Sub-Rig | **Ashok Leyland 3520 "Goods Carrier" 10-Wheeler** (Traditional Indian saffron/emerald painted wooden cab, ornate "Taj" luton crown peak, slatted teakwood cargo body with tarpaulin dome) | Original Khronos glTF 2.0 binary `.glb` + Three.js articulated vehicle assembly (`CC0 1.0 Universal` / `Apache-2.0`) |
| `bharatbenz_4228r` | `/public/models/bharatbenz_4228r.glb` + Articulated Sub-Rig | **BharatBenz 4228R Heavy Fuel Tanker Rig** (Cobalt-blue & silver cab-over tractor pulling a tri-axle polished stainless-steel cylindrical petroleum tanker trailer with catwalk & hazmat placards) | Original Khronos glTF 2.0 binary `.glb` + Three.js articulated vehicle assembly (`CC0 1.0 Universal` / `Apache-2.0`) |

## 2. Real Geospatial Corridors & Maps (`@vis.gl/react-google-maps` & `src/physics/highwaySpline.ts`)

| Map ID | Highway Corridor | Real GPS Coordinates | Geospatial Data Sources & Licenses |
| :--- | :--- | :--- | :--- |
| `nh44_plains` | **NH-44 Grand Trunk Plains (Ambala Cantt → Karnal Toll, Haryana)** | `30.3398° N, 76.8367° E` → `29.7429° N, 76.9684° E` | Google Maps Platform (`@vis.gl/react-google-maps` Satellite / 3D View, Google Maps Platform Terms of Service) + OpenStreetMap Road Alignment (`ODbL 1.0`) |
| `nh48_ghats` | **NH-48 Western Ghats Mountain Pass (Khandala → Lonavala Bhor Ghat, Maharashtra)** | `18.7645° N, 73.3732° E` → `18.7557° N, 73.4091° E` | Google Maps Platform (`@vis.gl/react-google-maps` Satellite / Terrain View, Google Maps Platform Terms of Service) + OpenStreetMap Ghat Alignment (`ODbL 1.0`) |
| `nh66_coastal` | **NH-66 Coastal Arabian Sea-Link (Worli–Bandra / Konkan Coastal Causeway, Mumbai)** | `19.0176° N, 72.8152° E` → `19.0468° N, 72.8205° E` | Google Maps Platform (`@vis.gl/react-google-maps` Satellite / 3D View, Google Maps Platform Terms of Service) + OpenStreetMap Coastal Bridge Alignment (`ODbL 1.0`) |

## 3. PBR Textures, Environment Lighting & Audio (`src/world/materialsAndTextures.ts`)

- **Studio Image-Based Lighting (IBL)**: `RoomEnvironment` via Three.js `PMREMGenerator` (`MIT License`, Three.js authors).
- **Atmospheric Scattering Sky**: Preetham/Hosek-Wilkie physical `Sky` shader (`MIT License`, Three.js examples).
- **Surface Normal, Roughness & Albedo Maps**: Deterministic tangent-space normal maps and UHD `2048×2048` micro-aggregate asphalt, corrugated steel, concrete Jersey barrier, Indian highway gantry signage, and quilted cabin leather textures (`Apache-2.0`).
- **Custom Game Iconography**: Hand-crafted inline vector SVG automotive & highway iconography in `src/components/GameIcons.tsx` (`Apache-2.0`).
