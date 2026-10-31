/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
  CameraViewMode,
  GameLifecycleState,
  GraphicsQuality,
  RunOutcomeSnapshot,
  SimulatorHUD,
  TimeOfDayPreset,
} from './components/SimulatorHUD';
import {
  createInitialTruckState,
  IndicatorState,
  stepTruckPhysics,
  TransmissionMode,
  TruckControlInput,
  TruckPhysicsState,
} from './physics/vehiclePhysics';
import {
  createInitialTrafficFleet,
  stepTrafficSimulation,
  TrafficVehicle,
} from './physics/trafficSimulation';
import { createHighwayTextureSet } from './world/materialsAndTextures';
import {
  buildPlayerTruckAndTrailer,
  buildTrafficVehicleMesh,
  PlayerRigMeshes,
  syncPlayerRigMeshes,
} from './world/truckBuilder';
import { buildHighwayEnvironment, HighwayEnvironmentHandles } from './world/environmentBuilder';
import { GeospatialStatus, probeGoogle3DTilesAvailability } from './world/geospatialTiles';
import { TruckAudioEngine } from './audio/truckAudio';

const INITIAL_GEOSPATIAL_STATUS: GeospatialStatus = {
  mode: 'osm_nh44_corridor',
  googleTilesConnected: false,
  statusSummary:
    'OpenStreetMap (ODbL) NH-44 Grand Trunk Road Alignment + Procedural PBR Environment active',
  dataAttribution:
    'Road Alignment & Waypoints © OpenStreetMap contributors (ODbL) · NH-44 Ambala–Karnal Corridor',
  corridorName: 'NH-44 Grand Trunk Road (Ambala Cantt → Karnal Toll Plaza)',
  originCoords: { lat: 30.3398, lng: 76.8367 },
  destinationCoords: { lat: 29.7429, lng: 76.9684 },
  loadedTilesCount: 0,
};

// Pre-allocated scratch vectors outside the animation loop (Zero GC)
const _camTargetPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _cabinWorldPos = new THREE.Vector3();
const _cabinLookPos = new THREE.Vector3();
const _mirrorWorldPos = new THREE.Vector3();
const _mirrorLookPos = new THREE.Vector3();
const _sunDir = new THREE.Vector3();

export default function App() {
  const initialAutostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [gameState, setGameState] = useState<GameLifecycleState>(
    initialAutostart ? 'playing' : 'title'
  );
  const [telemetry, setTelemetry] = useState<TruckPhysicsState>(() => createInitialTruckState(60));
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('chase');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDayPreset>('golden');
  // Default graphics tier is 'low' — pixel-perfect 3D geometry & textures with 60 FPS low-end optimizations
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>('low');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [hudCollapsed, setHudCollapsed] = useState<boolean>(false);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);
  const [geospatialStatus, setGeospatialStatus] =
    useState<GeospatialStatus>(INITIAL_GEOSPATIAL_STATUS);
  const [outcomeSnapshot, setOutcomeSnapshot] = useState<RunOutcomeSnapshot | null>(null);

  // Mutable simulation refs so 60Hz loop never tears down or depends on React re-renders
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const gameStateRef = useRef<GameLifecycleState>(initialAutostart ? 'playing' : 'title');
  const cameraModeRef = useRef<CameraViewMode>('chase');
  const timeOfDayRef = useRef<TimeOfDayPreset>('golden');
  const graphicsQualityRef = useRef<GraphicsQuality>('low');
  const physicsRef = useRef<TruckPhysicsState>(createInitialTruckState(60));
  const trafficRef = useRef<TrafficVehicle[]>(createInitialTrafficFleet(60));
  const audioRef = useRef<TruckAudioEngine | null>(null);
  const runStartTimeRef = useRef<number>(performance.now());

  // Unified Input State (continuous held + edge-triggered one-shots)
  const keysHeldRef = useRef<Set<string>>(new Set());
  const touchHeldRef = useRef<{
    left: boolean;
    right: boolean;
    throttle: boolean;
    brake: boolean;
  }>({ left: false, right: false, throttle: false, brake: false });
  const shiftUpQueuedRef = useRef<boolean>(false);
  const shiftDownQueuedRef = useRef<boolean>(false);

  // Orbit camera spherical coordinates for 'orbit' inspection mode
  const orbitAnglesRef = useRef<{ yaw: number; pitch: number; distance: number }>({
    yaw: 0.55,
    pitch: 0.28,
    distance: 13.5,
  });
  const isDraggingOrbitRef = useRef<boolean>(false);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Sync document.body.dataset.state with game lifecycle state
  useEffect(() => {
    document.body.dataset.state = gameState;
    gameStateRef.current = gameState;
  }, [gameState]);

  // Detect touch device & probe Google 3D Tiles availability once
  useEffect(() => {
    const checkTouch = () => {
      const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      setIsTouchDevice(coarse || ('ontouchstart' in window && window.innerWidth < 1024));
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);

    probeGoogle3DTilesAvailability().then((status) => {
      setGeospatialStatus(status);
    });

    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  // State transition handlers
  const handleStartGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    keysHeldRef.current.clear();
    audioRef.current?.init();
    runStartTimeRef.current = performance.now();
    document.body.dataset.state = 'playing';
    gameStateRef.current = 'playing';
    setOutcomeSnapshot(null);
    setGameState('playing');
  }, []);

  const handleResumeGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    keysHeldRef.current.clear();
    audioRef.current?.init();
    document.body.dataset.state = 'playing';
    gameStateRef.current = 'playing';
    setGameState('playing');
  }, []);

  const handlePauseGame = useCallback(() => {
    keysHeldRef.current.clear();
    audioRef.current?.pause();
    document.body.dataset.state = 'paused';
    gameStateRef.current = 'paused';
    setGameState('paused');
  }, []);

  const handleRestartGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    keysHeldRef.current.clear();
    const freshTruck = createInitialTruckState(60);
    freshTruck.transmissionMode = physicsRef.current.transmissionMode;
    freshTruck.headlightsOn = physicsRef.current.headlightsOn;
    physicsRef.current = freshTruck;
    trafficRef.current = createInitialTrafficFleet(60);
    setTelemetry({ ...freshTruck });
    setOutcomeSnapshot(null);
    runStartTimeRef.current = performance.now();
    audioRef.current?.init();
    document.body.dataset.state = 'playing';
    gameStateRef.current = 'playing';
    setGameState('playing');
  }, []);

  const handleReturnToTitle = useCallback(() => {
    keysHeldRef.current.clear();
    audioRef.current?.pause();
    const freshTruck = createInitialTruckState(60);
    physicsRef.current = freshTruck;
    trafficRef.current = createInitialTrafficFleet(60);
    setTelemetry({ ...freshTruck });
    setOutcomeSnapshot(null);
    document.body.dataset.state = 'title';
    gameStateRef.current = 'title';
    setGameState('title');
  }, []);

  const handleCycleCamera = useCallback((explicitMode?: CameraViewMode) => {
    const order: CameraViewMode[] = ['chase', 'cabin', 'orbit'];
    const next =
      explicitMode ?? order[(order.indexOf(cameraModeRef.current) + 1) % order.length];
    cameraModeRef.current = next;
    setCameraMode(next);
  }, []);

  const handleCycleTimeOfDay = useCallback((explicitPreset?: TimeOfDayPreset) => {
    const order: TimeOfDayPreset[] = ['golden', 'day', 'night'];
    const next =
      explicitPreset ?? order[(order.indexOf(timeOfDayRef.current) + 1) % order.length];
    timeOfDayRef.current = next;
    if (next === 'night') {
      physicsRef.current.headlightsOn = true;
    }
    setTimeOfDay(next);
    setTelemetry({ ...physicsRef.current });
  }, []);

  const handleToggleGraphicsQuality = useCallback((explicitPreset?: GraphicsQuality) => {
    const order: GraphicsQuality[] = ['low', 'medium', 'high', 'ultra'];
    const next =
      explicitPreset ??
      order[(order.indexOf(graphicsQualityRef.current) + 1) % order.length];
    graphicsQualityRef.current = next;
    setGraphicsQuality(next);
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      audioRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const handleToggleHeadlights = useCallback(() => {
    const p = physicsRef.current;
    if (!p.headlightsOn) {
      p.headlightsOn = true;
      p.highBeamOn = false;
    } else if (!p.highBeamOn) {
      p.highBeamOn = true;
    } else {
      p.headlightsOn = false;
      p.highBeamOn = false;
    }
    setTelemetry({ ...p });
  }, []);

  const handleToggleIndicator = useCallback((target: IndicatorState) => {
    const p = physicsRef.current;
    p.indicator = p.indicator === target ? 'off' : target;
    setTelemetry({ ...p });
  }, []);

  const handleToggleTransmission = useCallback((explicitMode?: TransmissionMode) => {
    const p = physicsRef.current;
    p.transmissionMode =
      explicitMode ?? (p.transmissionMode === 'auto' ? 'manual' : 'auto');
    setTelemetry({ ...p });
  }, []);

  const handleShiftGear = useCallback((delta: 1 | -1) => {
    if (delta > 0) shiftUpQueuedRef.current = true;
    else shiftDownQueuedRef.current = true;
  }, []);

  const handleSetHorn = useCallback((active: boolean) => {
    physicsRef.current.hornActive = active;
    setTelemetry({ ...physicsRef.current });
  }, []);

  const handleTouchControl = useCallback(
    (control: 'left' | 'right' | 'throttle' | 'brake', active: boolean) => {
      touchHeldRef.current[control] = active;
    },
    []
  );

  // ============================================================================
  // MAIN THREE.JS SCENE, PHYSICAL SKY, LIGHTING, PHYSICS & RENDER LOOP
  // ============================================================================
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software-WebGL Detection (per threejs/SKILL.md)
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const initW = container.clientWidth || window.innerWidth;
    const initH = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.88;
    renderer.setPixelRatio(1); // Default 'low' starts at crisp 1.0 pixel ratio for zero lag
    renderer.setSize(initW, initH);
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(62, initW / initH, 0.16, 1150);

    // Optional Post-Processing Pipeline (Active ONLY in 'ultra' mode on hardware GPUs, with high threshold 1.55 so sky never blooms!)
    let composer: EffectComposer | null = null;
    if (!isSoftwareGl) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(Math.round(initW * 0.5), Math.round(initH * 0.5)),
        0.12, // Subtle optical bloom restricted strictly to HDR emissive vehicle lamps
        0.25,
        1.55 // Above Sky shader luminance (~1.1) so sky/horizon/road never wash out!
      );
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    }

    // 2. Studio PBR Environment Reflections via RoomEnvironment + PMREMGenerator
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Physical Rayleigh & Mie Atmospheric Scattering Sky (`Sky` shader dome)
    const sky = new Sky();
    sky.scale.setScalar(2400);
    scene.add(sky);
    const skyUniforms = sky.material.uniforms;

    // 4. Warm/Cool 3-Point Outdoor Highway Lighting Rig & Crystal-Clear Distance Fog
    const hemiLight = new THREE.HemisphereLight(0xfde68a, 0x44403c, 0.88);
    hemiLight.position.set(0, 120, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffedd5, 2.25);
    sunLight.position.set(-85, 68, -60);
    if (!isSoftwareGl) {
      sunLight.castShadow = false; // Enabled dynamically on Medium/High/Ultra
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.camera.near = 5;
      sunLight.shadow.camera.far = 240;
      const d = 48;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    scene.add(sunLight);
    scene.add(sunLight.target);

    // Linear distance fog starting at 340m so 0m..340m ahead of the truck is 100% crystal-clear!
    const fogColor = new THREE.Color(0xd5a782);
    scene.background = fogColor;
    const linearFog = new THREE.Fog(fogColor.getHex(), 340, 1180);
    scene.fog = linearFog;

    // 5. Build Procedural PBR Textures, NH-44 Highway Environment, Player Rig & AI Traffic
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const textures = createHighwayTextureSet(Math.min(4, maxAnisotropy));

    // High-altitude atmospheric cirrus cloud canopy plane (with fog: false so it never turns into a fog ceiling!)
    const cloudPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2200, 2200),
      new THREE.MeshBasicMaterial({
        map: textures.cloudLayerMap,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide,
      })
    );
    cloudPlane.rotation.x = Math.PI / 2;
    cloudPlane.position.y = 240;
    scene.add(cloudPlane);

    const envHandles: HighwayEnvironmentHandles = buildHighwayEnvironment(textures, isSoftwareGl);
    scene.add(envHandles.root);

    const playerRig: PlayerRigMeshes = buildPlayerTruckAndTrailer(textures, isSoftwareGl);
    scene.add(playerRig.tractorRoot);
    scene.add(playerRig.trailerRoot);

    // Live Rear-View Wing Mirror RenderTarget & Rear-Facing Camera
    const mirrorRenderTarget = new THREE.WebGLRenderTarget(256, 512, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    const mirrorCamera = new THREE.PerspectiveCamera(44, 0.5, 0.4, 180);
    const mirrorMat = new THREE.MeshBasicMaterial({ map: mirrorRenderTarget.texture });
    playerRig.rightMirrorMesh.material = mirrorMat;
    playerRig.leftMirrorMesh.material = mirrorMat;

    // Build high-detail 3D meshes for the 24 AI Traffic Vehicles (using cached geometries)
    const trafficMeshes: { root: THREE.Group; brakeMat: THREE.MeshBasicMaterial }[] = [];
    for (const tv of trafficRef.current) {
      const tm = buildTrafficVehicleMesh(tv.archetype, tv.colorHex, textures);
      scene.add(tm.root);
      trafficMeshes.push(tm);
    }

    // Dynamic 4-Tier Graphics Quality Configurator ('low' | 'medium' | 'high' | 'ultra')
    let lastAppliedTier: GraphicsQuality | null = null;
    let activeTrafficCullDist = 380;
    let activeMirrorInterval = 4;

    const syncGraphicsTier = (tier: GraphicsQuality) => {
      if (lastAppliedTier === tier) return;
      lastAppliedTier = tier;

      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const dpr = window.devicePixelRatio || 1;

      if (tier === 'low') {
        renderer.setPixelRatio(1);
        renderer.setSize(w, h);
        renderer.shadowMap.enabled = false;
        sunLight.castShadow = false;
        camera.far = 920;
        camera.updateProjectionMatrix();
        mirrorCamera.far = 115;
        mirrorCamera.updateProjectionMatrix();
        activeTrafficCullDist = 360;
        activeMirrorInterval = 4;
      } else if (tier === 'medium') {
        renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(dpr, 1.25));
        renderer.setSize(w, h);
        renderer.shadowMap.enabled = !isSoftwareGl;
        sunLight.castShadow = !isSoftwareGl;
        if (!isSoftwareGl && sunLight.shadow.mapSize.width !== 1024) {
          sunLight.shadow.mapSize.set(1024, 1024);
          sunLight.shadow.map?.dispose();
          sunLight.shadow.map = null;
        }
        camera.far = 1020;
        camera.updateProjectionMatrix();
        mirrorCamera.far = 155;
        mirrorCamera.updateProjectionMatrix();
        activeTrafficCullDist = 440;
        activeMirrorInterval = 3;
      } else if (tier === 'high') {
        renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(dpr, 1.65));
        renderer.setSize(w, h);
        renderer.shadowMap.enabled = !isSoftwareGl;
        sunLight.castShadow = !isSoftwareGl;
        if (!isSoftwareGl && sunLight.shadow.mapSize.width !== 2048) {
          sunLight.shadow.mapSize.set(2048, 2048);
          sunLight.shadow.map?.dispose();
          sunLight.shadow.map = null;
        }
        camera.far = 1120;
        camera.updateProjectionMatrix();
        mirrorCamera.far = 200;
        mirrorCamera.updateProjectionMatrix();
        activeTrafficCullDist = 520;
        activeMirrorInterval = 2;
      } else {
        // ULTRA 4K UHD Tier
        textures.upgradeToUltra4K(maxAnisotropy);
        renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(dpr, 2.0));
        renderer.setSize(w, h);
        composer?.setSize(w, h);
        renderer.shadowMap.enabled = !isSoftwareGl;
        sunLight.castShadow = !isSoftwareGl;
        if (!isSoftwareGl && sunLight.shadow.mapSize.width !== 2048) {
          sunLight.shadow.mapSize.set(2048, 2048);
          sunLight.shadow.map?.dispose();
          sunLight.shadow.map = null;
        }
        camera.far = 1250;
        camera.updateProjectionMatrix();
        mirrorCamera.far = 250;
        mirrorCamera.updateProjectionMatrix();
        activeTrafficCullDist = 680;
        activeMirrorInterval = 1;
      }
    };

    // Apply Time-of-Day Physical Sky & Crystal-Clear Linear Fog Preset
    let lastAppliedPreset: TimeOfDayPreset | null = null;
    const applyLightingPreset = (preset: TimeOfDayPreset, truckZ: number) => {
      sky.position.set(0, 0, truckZ);
      cloudPlane.position.z = truckZ - 180;

      if (preset === 'golden') {
        if (lastAppliedPreset !== preset) {
          skyUniforms['turbidity'].value = 4.6;
          skyUniforms['rayleigh'].value = 1.85;
          skyUniforms['mieCoefficient'].value = 0.0045;
          skyUniforms['mieDirectionalG'].value = 0.78;
          const phi = THREE.MathUtils.degToRad(90 - 14.5);
          const theta = THREE.MathUtils.degToRad(205);
          _sunDir.setFromSphericalCoords(1, phi, theta);
          skyUniforms['sunPosition'].value.copy(_sunDir);

          fogColor.setHex(0xd5a782);
          hemiLight.color.setHex(0xfde68a);
          hemiLight.groundColor.setHex(0x44403c);
          hemiLight.intensity = 0.88;
          sunLight.color.setHex(0xffbe78);
          sunLight.intensity = 2.2;
          renderer.toneMappingExposure = 0.88;
          envHandles.streetLightHeadsMat.color.setHex(0xfef08a);
          cloudPlane.visible = true;
          sky.visible = true;
          linearFog.near = 350;
          linearFog.far = 1180;
          lastAppliedPreset = preset;
        }
        sunLight.position.set(-110, 56, truckZ - 140);
      } else if (preset === 'day') {
        if (lastAppliedPreset !== preset) {
          skyUniforms['turbidity'].value = 2.6;
          skyUniforms['rayleigh'].value = 1.25;
          skyUniforms['mieCoefficient'].value = 0.003;
          skyUniforms['mieDirectionalG'].value = 0.75;
          const phi = THREE.MathUtils.degToRad(90 - 44);
          const theta = THREE.MathUtils.degToRad(160);
          _sunDir.setFromSphericalCoords(1, phi, theta);
          skyUniforms['sunPosition'].value.copy(_sunDir);

          fogColor.setHex(0x9bd2fc);
          hemiLight.color.setHex(0xe0f2fe);
          hemiLight.groundColor.setHex(0x57534e);
          hemiLight.intensity = 0.96;
          sunLight.color.setHex(0xffffff);
          sunLight.intensity = 2.25;
          renderer.toneMappingExposure = 0.9;
          envHandles.streetLightHeadsMat.color.setHex(0x94a3b8);
          cloudPlane.visible = true;
          sky.visible = true;
          linearFog.near = 380;
          linearFog.far = 1220;
          lastAppliedPreset = preset;
        }
        sunLight.position.set(65, 140, truckZ - 60);
      } else {
        // Dusk / Night Highway Mode
        if (lastAppliedPreset !== preset) {
          fogColor.setHex(0x060a14);
          hemiLight.color.setHex(0x1e293b);
          hemiLight.groundColor.setHex(0x090d16);
          hemiLight.intensity = 0.25;
          sunLight.color.setHex(0x38bdf8);
          sunLight.intensity = 0.28;
          renderer.toneMappingExposure = 0.92;
          envHandles.streetLightHeadsMat.color.setHex(0xfef08a);
          cloudPlane.visible = false;
          sky.visible = false;
          linearFog.near = 240;
          linearFog.far = 860;
          lastAppliedPreset = preset;
        }
        sunLight.position.set(-60, 80, truckZ - 80);
      }
      scene.background = fogColor;
      linearFog.color.copy(fogColor);
    };

    // Initialize camera and default graphics tier ('low') immediately
    syncGraphicsTier(graphicsQualityRef.current);
    const initP = physicsRef.current;
    camera.position.set(initP.x + 7.5, initP.y + 3.1, initP.z - 8.2);
    camera.lookAt(initP.x - 0.5, initP.y + 2.0, initP.z + 2.5);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const audio = new TruckAudioEngine();
    audioRef.current = audio;

    // 6. Window Keyboard & Pointer Event Listeners
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;

      if (
        (gameStateRef.current === 'title' || gameStateRef.current === 'gameover') &&
        (code === 'Enter' || code === 'Space')
      ) {
        e.preventDefault();
        if (gameStateRef.current === 'title') handleStartGame();
        else handleRestartGame();
        return;
      }

      if (code === 'Escape' || code === 'KeyP') {
        e.preventDefault();
        if (gameStateRef.current === 'playing') handlePauseGame();
        else if (gameStateRef.current === 'paused') handleResumeGame();
        return;
      }

      if (gameStateRef.current !== 'playing') return;

      if (!e.repeat) {
        if (code === 'KeyC') handleCycleCamera();
        else if (code === 'KeyL') handleToggleHeadlights();
        else if (code === 'KeyT') handleCycleTimeOfDay();
        else if (code === 'KeyF') handleToggleGraphicsQuality();
        else if (code === 'KeyM') handleToggleMute();
        else if (code === 'KeyR') handleRestartGame();
        else if (code === 'KeyU') setHudCollapsed((c) => !c);
        else if (code === 'KeyG') handleToggleTransmission();
        else if (code === 'KeyQ') {
          handleToggleIndicator(physicsRef.current.indicator === 'left' ? 'off' : 'left');
        } else if (code === 'KeyE') {
          handleToggleIndicator(physicsRef.current.indicator === 'right' ? 'off' : 'right');
        } else if (code === 'KeyX') {
          handleToggleIndicator(physicsRef.current.indicator === 'hazard' ? 'off' : 'hazard');
        } else if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'BracketRight') {
          shiftUpQueuedRef.current = true;
        } else if (code === 'ControlLeft' || code === 'ControlRight' || code === 'BracketLeft') {
          shiftDownQueuedRef.current = true;
        } else if (code === 'KeyH') {
          physicsRef.current.hornActive = true;
        }
      }

      keysHeldRef.current.add(code);
      audio.init();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
      if (e.code === 'KeyH') {
        physicsRef.current.hornActive = false;
      }
    };

    const clearAllInputs = () => {
      keysHeldRef.current.clear();
      touchHeldRef.current = { left: false, right: false, throttle: false, brake: false };
      physicsRef.current.hornActive = false;
      isDraggingOrbitRef.current = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (cameraModeRef.current === 'orbit') {
        isDraggingOrbitRef.current = true;
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingOrbitRef.current || cameraModeRef.current !== 'orbit') return;
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      orbitAnglesRef.current.yaw -= dx * 0.007;
      orbitAnglesRef.current.pitch = Math.max(
        0.08,
        Math.min(1.15, orbitAnglesRef.current.pitch + dy * 0.006)
      );
    };
    const onPointerUp = () => {
      isDraggingOrbitRef.current = false;
    };

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer?.setSize(w, h);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearAllInputs);
    const canvasEl = renderer.domElement;
    canvasEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onResize);

    // 7. Paced Render & Simulation Loop (with software-WebGL fenceSync guard)
    let frameId = 0;
    let isDisposed = false;
    let frameCounter = 0;
    const clock = new THREE.Clock();
    let elapsedSimTime = 0;
    let lastHudSyncTime = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (isDisposed) return;
      frameCounter++;
      const rawDt = clock.getDelta();
      const subSteps = isSoftwareGl && rawDt > 0.045 ? 2 : 1;
      const stepDt = Math.min(rawDt / subSteps, 0.045);

      // Apply any Graphics Tier change immediately
      syncGraphicsTier(graphicsQualityRef.current);

      const keys = keysHeldRef.current;
      const touch = touchHeldRef.current;

      const throttle =
        keys.has('KeyW') || keys.has('ArrowUp') || touch.throttle ? 1.0 : 0.0;
      const brake =
        keys.has('KeyS') || keys.has('ArrowDown') || touch.brake ? 1.0 : 0.0;
      const serviceAirBrake = keys.has('Space');
      const steerLeft = keys.has('KeyA') || keys.has('ArrowLeft') || touch.left ? 1.0 : 0.0;
      const steerRight =
        keys.has('KeyD') || keys.has('ArrowRight') || touch.right ? 1.0 : 0.0;
      const steer = steerLeft - steerRight;

      const pState = physicsRef.current;

      if (gameStateRef.current === 'playing') {
        for (let s = 0; s < subSteps; s++) {
          elapsedSimTime += stepDt;
          const controlInput: TruckControlInput = {
            throttle,
            brake,
            serviceAirBrake,
            steer,
            shiftUpJustPressed: s === 0 ? shiftUpQueuedRef.current : false,
            shiftDownJustPressed: s === 0 ? shiftDownQueuedRef.current : false,
            engineBrakeActive: keys.has('KeyB'),
          };
          stepTruckPhysics(pState, controlInput, stepDt, elapsedSimTime);
          stepTrafficSimulation(trafficRef.current, pState, stepDt);
        }
        shiftUpQueuedRef.current = false;
        shiftDownQueuedRef.current = false;

        if (pState.distanceAlongHighwayM >= 4350 || pState.cargoIntegrityPct <= 0) {
          const isVictory = pState.cargoIntegrityPct > 0;
          const elapsedSec = Math.max(1, (performance.now() - runStartTimeRef.current) / 1000);
          const mins = Math.floor(elapsedSec / 60);
          const secs = Math.floor(elapsedSec % 60);
          const snapshot: RunOutcomeSnapshot = {
            victory: isVictory,
            reason: isVictory
              ? 'Cleared Karnal FASTag Toll Plaza on NH-44 Grand Trunk Corridor with heavy container freight intact.'
              : 'Excessive highway barrier or traffic impacts compromised the container cargo.',
            distanceKm: (pState.distanceAlongHighwayM / 1000).toFixed(2),
            elapsedTimeFormatted: `${mins}:${secs.toString().padStart(2, '0')}`,
            avgSpeedKmh: Math.round((pState.totalDistanceDrivenM / elapsedSec) * 3.6),
            cargoIntegrityPct: pState.cargoIntegrityPct,
            fuelUsedLiters: (385 - pState.fuelLiters).toFixed(1),
          };
          audio.pause();
          document.body.dataset.state = 'gameover';
          gameStateRef.current = 'gameover';
          setOutcomeSnapshot(snapshot);
          setGameState('gameover');
        }
      } else if (gameStateRef.current === 'title') {
        elapsedSimTime += stepDt;
        stepTrafficSimulation(trafficRef.current, pState, stepDt);
      }

      // Sync 3D Player Tractor, Cabin Suspension, Needles, Fan, Exhaust & Trailer Meshes
      syncPlayerRigMeshes(
        playerRig,
        pState,
        brake > 0.1 || serviceAirBrake,
        isSoftwareGl
      );

      // Update Live 1st-Person Instrument Cluster & Center-Console GPS Navigation Screen
      textures.updateCabinDisplays(
        pState,
        trafficRef.current,
        cameraModeRef.current === 'cabin'
      );

      // Sync 3D AI Traffic Meshes with Distance Culling for Zero-Lag Low-End Performance
      for (let i = 0; i < trafficRef.current.length; i++) {
        const tv = trafficRef.current[i];
        const tm = trafficMeshes[i];
        const ds = tv.s - pState.distanceAlongHighwayM;
        if (ds < -110 || ds > activeTrafficCullDist) {
          tm.root.visible = false;
        } else {
          tm.root.visible = true;
          tm.root.position.set(tv.x, tv.y, tv.z);
          tm.root.rotation.set(tv.pitch, -tv.heading, -tv.roll, 'YXZ');
          tm.brakeMat.color.setHex(tv.braking ? 0xff2222 : 0x7f1d1d);
        }
      }

      // Update Sun, Physical Sky & Directional Shadow Frustum to follow Player Rig
      applyLightingPreset(timeOfDayRef.current, pState.z);
      sunLight.target.position.set(pState.x, pState.y, pState.z - 15);

      // Render Live Rear-View Wing Mirror when in 1st-Person Cabin View
      const mirrorPeriod = isSoftwareGl ? 3 : activeMirrorInterval;
      if (cameraModeRef.current === 'cabin' && frameCounter % mirrorPeriod === 1) {
        playerRig.mirrorCameraAnchor.getWorldPosition(_mirrorWorldPos);
        const backX = -Math.sin(pState.heading);
        const backZ = Math.cos(pState.heading);
        mirrorCamera.position.copy(_mirrorWorldPos);
        _mirrorLookPos.set(
          _mirrorWorldPos.x + backX * 35 - 0.8,
          _mirrorWorldPos.y - 0.55,
          _mirrorWorldPos.z + backZ * 35
        );
        mirrorCamera.lookAt(_mirrorLookPos);
        playerRig.rightMirrorMesh.visible = false;
        playerRig.leftMirrorMesh.visible = false;
        renderer.setRenderTarget(mirrorRenderTarget);
        renderer.render(scene, mirrorCamera);
        renderer.setRenderTarget(null);
        playerRig.rightMirrorMesh.visible = true;
        playerRig.leftMirrorMesh.visible = true;
      }

      // Camera Choreography (Title Pan / 3rd-Person Chase / 1st-Person RHD Cabin / Free Orbit)
      const camDamp = 1 - Math.exp(-8.5 * Math.max(0.016, rawDt));
      const shakeMag = pState.cameraTrauma * pState.cameraTrauma * 0.22;
      const shakeX = Math.sin(elapsedSimTime * 37) * shakeMag;
      const shakeY = Math.cos(elapsedSimTime * 43) * shakeMag;

      if (gameStateRef.current === 'title') {
        const panAngle = -0.75 + Math.sin(elapsedSimTime * 0.25) * 0.35;
        const radius = 11.2;
        _camTargetPos.set(
          pState.x + Math.cos(panAngle) * radius,
          pState.y + 3.1 + Math.sin(elapsedSimTime * 0.4) * 0.35,
          pState.z + Math.sin(panAngle) * radius + 1.5
        );
        _camLookTarget.set(pState.x - 0.8, pState.y + 1.95, pState.z + 2.2);
        camera.position.copy(_camTargetPos);
        camera.lookAt(_camLookTarget);
      } else if (cameraModeRef.current === 'cabin') {
        playerRig.cabinCameraAnchor.getWorldPosition(_cabinWorldPos);
        const fwdX = Math.sin(pState.heading);
        const fwdZ = -Math.cos(pState.heading);
        const lookTurnYaw = pState.heading + pState.steerAngleRad * 0.45;
        const lookFwdX = Math.sin(lookTurnYaw);
        const lookFwdZ = -Math.cos(lookTurnYaw);

        camera.position.set(
          _cabinWorldPos.x + shakeX * 0.35,
          _cabinWorldPos.y + shakeY * 0.35,
          _cabinWorldPos.z
        );
        _cabinLookPos.set(
          _cabinWorldPos.x + lookFwdX * 26 + fwdX * 2,
          _cabinWorldPos.y - 2.15 + Math.sin(pState.pitch) * 18,
          _cabinWorldPos.z + lookFwdZ * 26 + fwdZ * 2
        );
        camera.lookAt(_cabinLookPos);
        if (camera.fov !== 74) {
          camera.fov = 74;
          camera.updateProjectionMatrix();
        }
      } else if (cameraModeRef.current === 'orbit') {
        const { yaw, pitch, distance } = orbitAnglesRef.current;
        const worldYaw = -pState.heading + yaw;
        _camTargetPos.set(
          pState.x + Math.sin(worldYaw) * Math.cos(pitch) * distance,
          pState.y + Math.sin(pitch) * distance + 1.5,
          pState.z + Math.cos(worldYaw) * Math.cos(pitch) * distance + 2.0
        );
        camera.position.lerp(_camTargetPos, camDamp);
        _camLookTarget.set(pState.x, pState.y + 1.9, pState.z + 1.5);
        camera.lookAt(_camLookTarget);
      } else {
        const fwdX = Math.sin(pState.heading);
        const fwdZ = -Math.cos(pState.heading);
        const rightX = Math.cos(pState.heading);
        const rightZ = Math.sin(pState.heading);
        const chaseDist = 17.2 + Math.min(2.6, pState.speedKmh * 0.025);
        const chaseHeight = 5.35;
        const driverSideOffset = 1.35 - pState.steerAngleRad * 2.2;

        _camTargetPos.set(
          pState.x - fwdX * chaseDist + rightX * driverSideOffset + shakeX,
          pState.y + chaseHeight + shakeY,
          pState.z - fwdZ * chaseDist + rightZ * driverSideOffset
        );
        camera.position.lerp(_camTargetPos, camDamp);

        _camLookTarget.set(
          pState.x + fwdX * 16,
          pState.y + 2.1,
          pState.z + fwdZ * 16
        );
        camera.lookAt(_camLookTarget);

        const targetFov = 60 + Math.min(8, pState.speedKmh * 0.075);
        if (Math.abs(camera.fov - targetFov) > 0.2) {
          camera.fov += (targetFov - camera.fov) * 0.1;
          camera.updateProjectionMatrix();
        }
      }

      // Update Procedural Diesel & Highway Audio
      audio.update(pState, gameStateRef.current === 'playing');

      // Throttle React HUD Telemetry updates to ~10Hz
      const nowMs = performance.now();
      if (nowMs - lastHudSyncTime > 95) {
        lastHudSyncTime = nowMs;
        setTelemetry({ ...pState });
      }

      // Render: Direct MSAA forward pass on Low/Med/High for zero post-processing lag,
      // or high-threshold lamp-only bloom pass on Ultra!
      if (composer && graphicsQualityRef.current === 'ultra') {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearAllInputs);
      canvasEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      mirrorRenderTarget.dispose();
      composer?.dispose();
      audio.dispose();
      renderer.dispose();
    };
  }, [
    handleCycleCamera,
    handleCycleTimeOfDay,
    handlePauseGame,
    handleRestartGame,
    handleResumeGame,
    handleStartGame,
    handleToggleGraphicsQuality,
    handleToggleHeadlights,
    handleToggleIndicator,
    handleToggleMute,
    handleToggleTransmission,
  ]);

  return (
    <main className="relative w-full h-full overflow-hidden bg-stone-950 select-none">
      {/* Dedicated Isolated WebGL Canvas Mount Container */}
      <div
        ref={canvasMountRef}
        data-testid="simulator-canvas-container"
        className="w-full h-full"
      />

      {/* World-Matched Low-Occlusion Simulator HUD & Game Shell Modals */}
      <SimulatorHUD
        gameState={gameState}
        telemetry={telemetry}
        cameraMode={cameraMode}
        timeOfDay={timeOfDay}
        graphicsQuality={graphicsQuality}
        isMuted={isMuted}
        hudCollapsed={hudCollapsed}
        isTouchDevice={isTouchDevice}
        geospatialStatus={geospatialStatus}
        outcomeSnapshot={outcomeSnapshot}
        onStartGame={handleStartGame}
        onResumeGame={handleResumeGame}
        onPauseGame={handlePauseGame}
        onRestartGame={handleRestartGame}
        onReturnToTitle={handleReturnToTitle}
        onCycleCamera={handleCycleCamera}
        onCycleTimeOfDay={handleCycleTimeOfDay}
        onToggleGraphicsQuality={handleToggleGraphicsQuality}
        onToggleMute={handleToggleMute}
        onToggleHeadlights={handleToggleHeadlights}
        onToggleIndicator={handleToggleIndicator}
        onToggleTransmission={handleToggleTransmission}
        onShiftGear={handleShiftGear}
        onSetHorn={handleSetHorn}
        onToggleHudCollapsed={() => setHudCollapsed((c) => !c)}
        onTouchControl={handleTouchControl}
      />
    </main>
  );
}
