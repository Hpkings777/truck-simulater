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
  TruckModelId,
  TruckPhysicsState,
} from './physics/vehiclePhysics';
import {
  MAP_CORRIDORS,
  MapCorridorId,
  setActiveMapId,
  splineToWorld,
} from './physics/highwaySpline';
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
import { GeospatialStatus, getBakedGeospatialStatus } from './world/geospatialTiles';
import { TruckAudioEngine } from './audio/truckAudio';

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
  const [selectedTruck, setSelectedTruck] = useState<TruckModelId>('tata_prima_4928');
  const [selectedMap, setSelectedMap] = useState<MapCorridorId>('nh44_plains');
  const [telemetry, setTelemetry] = useState<TruckPhysicsState>(() =>
    createInitialTruckState(60, 'tata_prima_4928')
  );
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('chase');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDayPreset>('golden');
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>('low');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [hudCollapsed, setHudCollapsed] = useState<boolean>(false);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState<boolean>(false);
  const [gamepadConnected, setGamepadConnected] = useState<boolean>(false);
  const [geospatialStatus, setGeospatialStatus] = useState<GeospatialStatus>(() =>
    getBakedGeospatialStatus()
  );
  const [outcomeSnapshot, setOutcomeSnapshot] = useState<RunOutcomeSnapshot | null>(null);

  // Mutable simulation refs so 60Hz loop never tears down or depends on React re-renders
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const gameStateRef = useRef<GameLifecycleState>(initialAutostart ? 'playing' : 'title');
  const selectedTruckRef = useRef<TruckModelId>('tata_prima_4928');
  const selectedMapRef = useRef<MapCorridorId>('nh44_plains');
  const cameraModeRef = useRef<CameraViewMode>('chase');
  const timeOfDayRef = useRef<TimeOfDayPreset>('golden');
  const graphicsQualityRef = useRef<GraphicsQuality>('low');
  const physicsRef = useRef<TruckPhysicsState>(createInitialTruckState(60, 'tata_prima_4928'));
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
  const prevGamepadButtonsRef = useRef<boolean[]>([]);

  // Orbit camera spherical coordinates & 1st-person Cabin Freelook offsets
  const orbitAnglesRef = useRef<{ yaw: number; pitch: number; distance: number }>({
    yaw: 0.55,
    pitch: 0.28,
    distance: 13.5,
  });
  const cabinLookRef = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });
  const isDraggingOrbitRef = useRef<boolean>(false);
  const dragPointerIdRef = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const snapCameraRef = useRef<boolean>(true);

  const resetPointerDrag = useCallback(() => {
    isDraggingOrbitRef.current = false;
    dragPointerIdRef.current = null;
  }, []);

  // Helper to request Fullscreen & Lock Landscape Orientation on mobile/tablets
  const requestFullscreenAndLandscape = useCallback(async (forceOnDesktop = false) => {
    const isMobileOrTablet =
      (window.matchMedia?.('(pointer: coarse)').matches ?? false) ||
      'ontouchstart' in window ||
      window.innerWidth < 1024;

    if (!forceOnDesktop && !isMobileOrTablet) return;

    try {
      const docEl = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (!document.fullscreenElement) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        }
      }
    } catch {
      // Ignore if browser blocks fullscreen in iframe or non-gesture context
    }

    try {
      const scrOrientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      if (scrOrientation && typeof scrOrientation.lock === 'function') {
        await scrOrientation.lock('landscape');
      }
    } catch {
      // Orientation lock is optional on desktop/iOS Safari
    }
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    resetPointerDrag();
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await requestFullscreenAndLandscape(true);
      }
    } catch {
      // Ignore fullscreen permission errors
    }
  }, [requestFullscreenAndLandscape, resetPointerDrag]);

  // Sync document.body.dataset.state with game lifecycle state
  useEffect(() => {
    document.body.dataset.state = gameState;
    gameStateRef.current = gameState;
  }, [gameState]);

  // Listen for Gamepad connect/disconnect
  useEffect(() => {
    const onGamepadConnect = () => setGamepadConnected(true);
    const onGamepadDisconnect = () => {
      const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
      setGamepadConnected(pads.length > 0);
    };
    window.addEventListener('gamepadconnected', onGamepadConnect);
    window.addEventListener('gamepaddisconnected', onGamepadDisconnect);

    return () => {
      window.removeEventListener('gamepadconnected', onGamepadConnect);
      window.removeEventListener('gamepaddisconnected', onGamepadDisconnect);
    };
  }, []);

  // Detect touch device, portrait orientation & fullscreen state
  useEffect(() => {
    const checkViewportAndTouch = () => {
      const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      const touchCapable = coarse || ('ontouchstart' in window && window.innerWidth < 1024);
      setIsTouchDevice(touchCapable);
      setIsPortraitMobile(
        window.innerHeight > window.innerWidth && (touchCapable || window.innerWidth < 920)
      );
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    checkViewportAndTouch();
    window.addEventListener('resize', checkViewportAndTouch);
    window.addEventListener('orientationchange', checkViewportAndTouch);
    document.addEventListener('fullscreenchange', checkViewportAndTouch);
    return () => {
      window.removeEventListener('resize', checkViewportAndTouch);
      window.removeEventListener('orientationchange', checkViewportAndTouch);
      document.removeEventListener('fullscreenchange', checkViewportAndTouch);
    };
  }, []);

  // Select Truck Model (R7)
  const handleSelectTruck = useCallback(
    (truckId: TruckModelId) => {
      resetPointerDrag();
      selectedTruckRef.current = truckId;
      physicsRef.current.truckModelId = truckId;
      setSelectedTruck(truckId);
      setTelemetry({ ...physicsRef.current });
    },
    [resetPointerDrag]
  );

  // Select Indian Highway Corridor Map (R8 & R9)
  const handleSelectMap = useCallback(
    (mapId: MapCorridorId) => {
      resetPointerDrag();
      setActiveMapId(mapId);
      selectedMapRef.current = mapId;
      setSelectedMap(mapId);

      // Reposition truck & traffic smoothly onto the new map's spline alignment
      const currentS = physicsRef.current.distanceAlongHighwayM;
      const freshTruck = createInitialTruckState(currentS, selectedTruckRef.current);
      freshTruck.transmissionMode = physicsRef.current.transmissionMode;
      freshTruck.headlightsOn = physicsRef.current.headlightsOn;
      physicsRef.current = freshTruck;
      trafficRef.current = createInitialTrafficFleet(currentS);
      snapCameraRef.current = true;
      setTelemetry({ ...freshTruck });

      const corridorSpec = MAP_CORRIDORS[mapId];
      setGeospatialStatus((prev) => ({
        ...prev,
        corridorName: `${corridorSpec.title} (${corridorSpec.subtitle})`,
        originCoords: corridorSpec.originCoords,
        destinationCoords: corridorSpec.destinationCoords,
      }));
    },
    [resetPointerDrag]
  );

  // State transition handlers
  const handleStartGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    resetPointerDrag();
    cabinLookRef.current = { yaw: 0, pitch: 0 };
    snapCameraRef.current = true;
    keysHeldRef.current.clear();
    audioRef.current?.init();
    void requestFullscreenAndLandscape(false);
    runStartTimeRef.current = performance.now();
    document.body.dataset.state = 'playing';
    gameStateRef.current = 'playing';
    setOutcomeSnapshot(null);
    setGameState('playing');
  }, [requestFullscreenAndLandscape, resetPointerDrag]);

  const handleResumeGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    resetPointerDrag();
    keysHeldRef.current.clear();
    audioRef.current?.init();
    void requestFullscreenAndLandscape(false);
    document.body.dataset.state = 'playing';
    gameStateRef.current = 'playing';
    setGameState('playing');
  }, [requestFullscreenAndLandscape, resetPointerDrag]);

  const handlePauseGame = useCallback(() => {
    resetPointerDrag();
    keysHeldRef.current.clear();
    audioRef.current?.pause();
    document.body.dataset.state = 'paused';
    gameStateRef.current = 'paused';
    setGameState('paused');
  }, [resetPointerDrag]);

  const handleRestartGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    resetPointerDrag();
    cabinLookRef.current = { yaw: 0, pitch: 0 };
    snapCameraRef.current = true;
    keysHeldRef.current.clear();
    const freshTruck = createInitialTruckState(60, selectedTruckRef.current);
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
  }, [resetPointerDrag]);

  const handleReturnToTitle = useCallback(() => {
    resetPointerDrag();
    cabinLookRef.current = { yaw: 0, pitch: 0 };
    snapCameraRef.current = true;
    keysHeldRef.current.clear();
    audioRef.current?.pause();
    const freshTruck = createInitialTruckState(60, selectedTruckRef.current);
    physicsRef.current = freshTruck;
    trafficRef.current = createInitialTrafficFleet(60);
    setTelemetry({ ...freshTruck });
    setOutcomeSnapshot(null);
    document.body.dataset.state = 'title';
    gameStateRef.current = 'title';
    setGameState('title');
  }, [resetPointerDrag]);

  const handleCycleCamera = useCallback(
    (explicitMode?: CameraViewMode) => {
      resetPointerDrag();
      cabinLookRef.current = { yaw: 0, pitch: 0 };
      snapCameraRef.current = true;
      const order: CameraViewMode[] = ['chase', 'cabin', 'orbit'];
      const next =
        explicitMode ?? order[(order.indexOf(cameraModeRef.current) + 1) % order.length];
      cameraModeRef.current = next;
      setCameraMode(next);
    },
    [resetPointerDrag]
  );

  const handleCycleTimeOfDay = useCallback(
    (explicitPreset?: TimeOfDayPreset) => {
      resetPointerDrag();
      const order: TimeOfDayPreset[] = ['golden', 'day', 'night'];
      const next =
        explicitPreset ?? order[(order.indexOf(timeOfDayRef.current) + 1) % order.length];
      timeOfDayRef.current = next;
      if (next === 'night') {
        physicsRef.current.headlightsOn = true;
      }
      setTimeOfDay(next);
      setTelemetry({ ...physicsRef.current });
    },
    [resetPointerDrag]
  );

  const handleToggleGraphicsQuality = useCallback(
    (explicitPreset?: GraphicsQuality) => {
      resetPointerDrag();
      const order: GraphicsQuality[] = ['low', 'medium', 'high', 'ultra'];
      const next =
        explicitPreset ??
        order[(order.indexOf(graphicsQualityRef.current) + 1) % order.length];
      graphicsQualityRef.current = next;
      setGraphicsQuality(next);
    },
    [resetPointerDrag]
  );

  const handleToggleMute = useCallback(() => {
    resetPointerDrag();
    setIsMuted((prev) => {
      const next = !prev;
      audioRef.current?.setMuted(next);
      return next;
    });
  }, [resetPointerDrag]);

  const handleToggleHeadlights = useCallback(() => {
    resetPointerDrag();
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
  }, [resetPointerDrag]);

  const handleToggleIndicator = useCallback(
    (target: IndicatorState) => {
      resetPointerDrag();
      const p = physicsRef.current;
      p.indicator = p.indicator === target ? 'off' : target;
      setTelemetry({ ...p });
    },
    [resetPointerDrag]
  );

  const handleToggleTransmission = useCallback(
    (explicitMode?: TransmissionMode) => {
      resetPointerDrag();
      const p = physicsRef.current;
      p.transmissionMode =
        explicitMode ?? (p.transmissionMode === 'auto' ? 'manual' : 'auto');
      setTelemetry({ ...p });
    },
    [resetPointerDrag]
  );

  const handleShiftGear = useCallback(
    (delta: 1 | -1) => {
      resetPointerDrag();
      if (delta > 0) shiftUpQueuedRef.current = true;
      else shiftDownQueuedRef.current = true;
    },
    [resetPointerDrag]
  );

  const handleSetHorn = useCallback(
    (active: boolean) => {
      resetPointerDrag();
      physicsRef.current.hornActive = active;
      setTelemetry({ ...physicsRef.current });
    },
    [resetPointerDrag]
  );

  const handleTouchControl = useCallback(
    (control: 'left' | 'right' | 'throttle' | 'brake', active: boolean) => {
      resetPointerDrag();
      touchHeldRef.current[control] = active;
    },
    [resetPointerDrag]
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
    renderer.setPixelRatio(1);
    renderer.setSize(initW, initH);
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(62, initW / initH, 0.16, 1150);

    let composer: EffectComposer | null = null;
    if (!isSoftwareGl) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(Math.round(initW * 0.5), Math.round(initH * 0.5)),
        0.12,
        0.25,
        1.55
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
      sunLight.castShadow = false;
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

    const fogColor = new THREE.Color(0xd5a782);
    scene.background = fogColor;
    const linearFog = new THREE.Fog(fogColor.getHex(), 340, 1180);
    scene.fog = linearFog;

    // 5. Build Procedural PBR Textures, Active Highway Environment, Active Player Rig & AI Traffic
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const textures = createHighwayTextureSet(Math.min(4, maxAnisotropy));

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

    let activeBuiltMapId: MapCorridorId = selectedMapRef.current;
    let envHandles: HighwayEnvironmentHandles = buildHighwayEnvironment(
      textures,
      isSoftwareGl,
      activeBuiltMapId
    );
    scene.add(envHandles.root);

    let activeBuiltTruckId: TruckModelId = selectedTruckRef.current;
    let playerRig: PlayerRigMeshes = buildPlayerTruckAndTrailer(
      textures,
      isSoftwareGl,
      activeBuiltTruckId
    );
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

    // Build high-detail 3D meshes for the 24 AI Traffic Vehicles
    const trafficMeshes: { root: THREE.Group; brakeMat: THREE.MeshBasicMaterial }[] = [];
    for (const tv of trafficRef.current) {
      const tm = buildTrafficVehicleMesh(tv.archetype, tv.colorHex, textures);
      scene.add(tm.root);
      trafficMeshes.push(tm);
    }

    // Atmospheric Highway Dust & Airflow Motes for tactile speed immersion
    const dustCount = 220;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 44;
      dustPositions[i * 3 + 1] = 0.3 + Math.random() * 7.5;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xfef3c7,
      size: 0.14,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const dustParticles = new THREE.Points(dustGeo, dustMat);
    scene.add(dustParticles);

    // Dynamic 4-Tier Graphics Quality Configurator ('low' | 'medium' | 'high' | 'ultra')
    let lastAppliedTier: GraphicsQuality | null = null;
    let activeTrafficCullDist = 380;
    let activeMirrorInterval = 4;

    const syncGraphicsTier = (tier: GraphicsQuality) => {
      envHandles.ultraDetailGroup.visible = tier === 'high' || tier === 'ultra';
      dustParticles.visible = tier !== 'low';
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
        camera.far = 1080;
        camera.updateProjectionMatrix();
        mirrorCamera.far = 165;
        mirrorCamera.updateProjectionMatrix();
        activeTrafficCullDist = 460;
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
        camera.far = 1450;
        camera.updateProjectionMatrix();
        mirrorCamera.far = 220;
        mirrorCamera.updateProjectionMatrix();
        activeTrafficCullDist = 640;
        activeMirrorInterval = 2;
      } else {
        textures.upgradeToUltra4K(maxAnisotropy);
        renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(dpr, 2.0));
        renderer.setSize(w, h);
        composer?.setSize(w, h);
        renderer.shadowMap.enabled = !isSoftwareGl;
        sunLight.castShadow = !isSoftwareGl;
        if (!isSoftwareGl && sunLight.shadow.mapSize.width !== 4096) {
          sunLight.shadow.mapSize.set(4096, 4096);
          sunLight.shadow.map?.dispose();
          sunLight.shadow.map = null;
        }
        camera.far = 2200;
        camera.updateProjectionMatrix();
        mirrorCamera.far = 320;
        mirrorCamera.updateProjectionMatrix();
        activeTrafficCullDist = 960;
        activeMirrorInterval = 1;
      }
      lastAppliedPresetKey = ''; // Force fog range re-sync with new tier
    };

    // Apply Time-of-Day & Map-Specific Atmospheric Palette
    let lastAppliedPresetKey = '';
    const applyLightingPreset = (
      preset: TimeOfDayPreset,
      mapId: MapCorridorId,
      truckZ: number
    ) => {
      sky.position.set(0, 0, truckZ);
      cloudPlane.position.z = truckZ - 180;

      const isUltra = graphicsQualityRef.current === 'ultra';
      const presetKey = `${preset}:${mapId}:${isUltra ? 'u' : 's'}`;
      if (preset === 'golden') {
        if (lastAppliedPresetKey !== presetKey) {
          skyUniforms['turbidity'].value =
            mapId === 'nh48_ghats' ? 3.8 : mapId === 'nh66_coastal' ? 3.2 : 4.6;
          skyUniforms['rayleigh'].value = mapId === 'nh66_coastal' ? 2.1 : 1.85;
          skyUniforms['mieCoefficient'].value = 0.0045;
          skyUniforms['mieDirectionalG'].value = 0.78;
          const phi = THREE.MathUtils.degToRad(90 - 14.5);
          const theta = THREE.MathUtils.degToRad(205);
          _sunDir.setFromSphericalCoords(1, phi, theta);
          skyUniforms['sunPosition'].value.copy(_sunDir);

          fogColor.setHex(
            mapId === 'nh48_ghats'
              ? 0xb5c9b8
              : mapId === 'nh66_coastal'
                ? 0xcbd5e1
                : 0xd5a782
          );
          hemiLight.color.setHex(0xfde68a);
          hemiLight.groundColor.setHex(0x44403c);
          hemiLight.intensity = 0.88;
          sunLight.color.setHex(0xffbe78);
          sunLight.intensity = 2.2;
          renderer.toneMappingExposure = 0.88;
          envHandles.streetLightHeadsMat.color.setHex(0xfef08a);
          cloudPlane.visible = true;
          sky.visible = true;
          linearFog.near = isUltra ? 480 : 350;
          linearFog.far = isUltra ? 1750 : 1180;
          lastAppliedPresetKey = presetKey;
        }
        sunLight.position.set(-110, 56, truckZ - 140);
      } else if (preset === 'day') {
        if (lastAppliedPresetKey !== presetKey) {
          skyUniforms['turbidity'].value = 2.6;
          skyUniforms['rayleigh'].value = 1.25;
          skyUniforms['mieCoefficient'].value = 0.003;
          skyUniforms['mieDirectionalG'].value = 0.75;
          const phi = THREE.MathUtils.degToRad(90 - 44);
          const theta = THREE.MathUtils.degToRad(160);
          _sunDir.setFromSphericalCoords(1, phi, theta);
          skyUniforms['sunPosition'].value.copy(_sunDir);

          fogColor.setHex(
            mapId === 'nh48_ghats'
              ? 0xa7f3d0
              : mapId === 'nh66_coastal'
                ? 0xbae6fd
                : 0x9bd2fc
          );
          hemiLight.color.setHex(0xe0f2fe);
          hemiLight.groundColor.setHex(0x57534e);
          hemiLight.intensity = 0.96;
          sunLight.color.setHex(0xffffff);
          sunLight.intensity = 2.25;
          renderer.toneMappingExposure = 0.9;
          envHandles.streetLightHeadsMat.color.setHex(0x94a3b8);
          cloudPlane.visible = true;
          sky.visible = true;
          linearFog.near = isUltra ? 520 : 380;
          linearFog.far = isUltra ? 1850 : 1220;
          lastAppliedPresetKey = presetKey;
        }
        sunLight.position.set(65, 140, truckZ - 60);
      } else {
        if (lastAppliedPresetKey !== presetKey) {
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
          linearFog.near = isUltra ? 320 : 240;
          linearFog.far = isUltra ? 1150 : 860;
          lastAppliedPresetKey = presetKey;
        }
        sunLight.position.set(-60, 80, truckZ - 80);
      }
      scene.background = fogColor;
      linearFog.color.copy(fogColor);
    };

    syncGraphicsTier(graphicsQualityRef.current);
    const initP = physicsRef.current;
    applyLightingPreset(timeOfDayRef.current, activeBuiltMapId, initP.z);
    syncPlayerRigMeshes(playerRig, initP, false, isSoftwareGl);
    camera.position.set(initP.x + 7.5, initP.y + 3.1, initP.z - 8.2);
    camera.lookAt(initP.x - 0.5, initP.y + 2.0, initP.z + 2.5);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    renderer.render(scene, camera);

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
      dragPointerIdRef.current = null;
    };

    const canvasEl = renderer.domElement;

    const onPointerDown = (e: PointerEvent) => {
      // Only initiate camera drag when pressing directly on the 3D WebGL canvas (never on HUD buttons)
      if (e.target !== canvasEl) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (cameraModeRef.current === 'orbit' || cameraModeRef.current === 'cabin') {
        isDraggingOrbitRef.current = true;
        dragPointerIdRef.current = e.pointerId;
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingOrbitRef.current || e.pointerId !== dragPointerIdRef.current) return;
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      if (cameraModeRef.current === 'orbit') {
        orbitAnglesRef.current.yaw -= dx * 0.007;
        orbitAnglesRef.current.pitch = Math.max(
          0.08,
          Math.min(1.15, orbitAnglesRef.current.pitch + dy * 0.006)
        );
      } else if (cameraModeRef.current === 'cabin') {
        cabinLookRef.current.yaw = Math.max(
          -0.85,
          Math.min(0.85, cabinLookRef.current.yaw + dx * 0.004)
        );
        cabinLookRef.current.pitch = Math.max(
          -0.38,
          Math.min(0.32, cabinLookRef.current.pitch - dy * 0.004)
        );
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (dragPointerIdRef.current === null || e.pointerId === dragPointerIdRef.current) {
        isDraggingOrbitRef.current = false;
        dragPointerIdRef.current = null;
      }
    };

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer?.setSize(w, h);
      if (composer && graphicsQualityRef.current === 'ultra') {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearAllInputs);
    canvasEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('resize', onResize);

    // 7. Paced Render & Simulation Loop (with software-WebGL fenceSync guard)
    let frameId = 0;
    let isDisposed = false;
    let frameCounter = 0;
    let lastMirrorCamMode: CameraViewMode | null = null;
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

      syncGraphicsTier(graphicsQualityRef.current);

      // Dynamic 3D Map Rebuild when user switches between NH-44 Plains, NH-48 Ghats, or NH-66 Coastal (R8 & R9)
      if (selectedMapRef.current !== activeBuiltMapId) {
        activeBuiltMapId = selectedMapRef.current;
        scene.remove(envHandles.root);
        envHandles = buildHighwayEnvironment(textures, isSoftwareGl, activeBuiltMapId);
        envHandles.ultraDetailGroup.visible =
          graphicsQualityRef.current === 'high' || graphicsQualityRef.current === 'ultra';
        scene.add(envHandles.root);
        lastAppliedPresetKey = ''; // Force sky & fog re-sync for the new map
      }

      // Dynamic 3D Truck Rig Rebuild when user switches between Tata Prima, Ashok Leyland, or BharatBenz (R7)
      if (selectedTruckRef.current !== activeBuiltTruckId) {
        activeBuiltTruckId = selectedTruckRef.current;
        scene.remove(playerRig.tractorRoot);
        scene.remove(playerRig.trailerRoot);
        playerRig = buildPlayerTruckAndTrailer(textures, isSoftwareGl, activeBuiltTruckId);
        playerRig.rightMirrorMesh.material = mirrorMat;
        playerRig.leftMirrorMesh.material = mirrorMat;
        scene.add(playerRig.tractorRoot);
        scene.add(playerRig.trailerRoot);
      }

      // R1: Poll Client-Side Web Gamepad API (`navigator.getGamepads()`) for Standard Controller / Wheel input
      let gpThrottle = 0;
      let gpBrake = 0;
      let gpSteer = 0;
      let gpAirBrake = false;
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const activePad = pads
        ? Array.from(pads).find((p) => p && p.connected && p.mapping === 'standard') ?? null
        : null;
      if (activePad) {
        const rawAxisX = activePad.axes[0] ?? 0;
        if (Math.abs(rawAxisX) > 0.15) {
          gpSteer = -rawAxisX; // Left stick / wheel left (<0) -> positive steer input
        }
        if (activePad.buttons[7]) gpThrottle = activePad.buttons[7].value;
        if (activePad.buttons[6]) gpBrake = activePad.buttons[6].value;
        if (activePad.buttons[1]?.pressed) gpAirBrake = true;
        if (activePad.buttons[0]?.pressed) physicsRef.current.hornActive = true;

        const prevBtns = prevGamepadButtonsRef.current;
        const r1Pressed = Boolean(activePad.buttons[5]?.pressed);
        const l1Pressed = Boolean(activePad.buttons[4]?.pressed);
        const yPressed = Boolean(activePad.buttons[3]?.pressed);
        if (r1Pressed && !prevBtns[5]) shiftUpQueuedRef.current = true;
        if (l1Pressed && !prevBtns[4]) shiftDownQueuedRef.current = true;
        if (yPressed && !prevBtns[3]) handleCycleCamera();
        prevGamepadButtonsRef.current = activePad.buttons.map((b) => b.pressed);
      }

      const keys = keysHeldRef.current;
      const touch = touchHeldRef.current;

      const throttle = Math.max(
        gpThrottle,
        keys.has('KeyW') || keys.has('ArrowUp') || touch.throttle ? 1.0 : 0.0
      );
      const brake = Math.max(
        gpBrake,
        keys.has('KeyS') || keys.has('ArrowDown') || touch.brake ? 1.0 : 0.0
      );
      const serviceAirBrake = keys.has('Space') || gpAirBrake;
      const steerLeft = keys.has('KeyA') || keys.has('ArrowLeft') || touch.left ? 1.0 : 0.0;
      const steerRight =
        keys.has('KeyD') || keys.has('ArrowRight') || touch.right ? 1.0 : 0.0;
      const keySteer = steerLeft - steerRight;
      const steer = Math.abs(gpSteer) > Math.abs(keySteer) ? gpSteer : keySteer;

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
          const mSpec = MAP_CORRIDORS[activeBuiltMapId];
          const snapshot: RunOutcomeSnapshot = {
            victory: isVictory,
            reason: isVictory
              ? `Cleared ${mSpec.title} destination FASTag Toll Plaza with heavy freight intact.`
              : 'Excessive highway barrier or traffic impacts compromised the freight cargo.',
            distanceKm: (pState.distanceAlongHighwayM / 1000).toFixed(2),
            elapsedTimeFormatted: `${mins}:${secs.toString().padStart(2, '0')}`,
            avgSpeedKmh: Math.round((pState.totalDistanceDrivenM / elapsedSec) * 3.6),
            cargoIntegrityPct: pState.cargoIntegrityPct,
            fuelUsedLiters: (pState.fuelMaxLiters - pState.fuelLiters).toFixed(1),
          };
          audio.pause();
          document.body.dataset.state = 'gameover';
          gameStateRef.current = 'gameover';
          setOutcomeSnapshot(snapshot);
          setGameState('gameover');
        }
      } else if (gameStateRef.current === 'title') {
        elapsedSimTime += stepDt;
        // Keep player rig positioned properly on the selected map spline during Title Tour
        const titlePt = splineToWorld(pState.distanceAlongHighwayM, pState.lateralOffsetM, 0);
        pState.x = titlePt.x;
        pState.y = titlePt.y;
        pState.z = titlePt.z;
        pState.heading = titlePt.sample.heading;
        pState.pitch = titlePt.sample.grade;
        pState.trailerX = titlePt.x - Math.sin(titlePt.sample.heading) * 6.0;
        pState.trailerY = titlePt.y;
        pState.trailerZ = titlePt.z + Math.cos(titlePt.sample.heading) * 6.0;
        pState.trailerHeading = titlePt.sample.heading;
        stepTrafficSimulation(trafficRef.current, pState, stepDt);
      }

      // Sync 3D Player Tractor, Cabin Suspension, Shifter, Stalk, Needles, Fan, Exhaust & Trailer Meshes
      syncPlayerRigMeshes(
        playerRig,
        pState,
        brake > 0.1 || serviceAirBrake,
        isSoftwareGl
      );

      // Update Atmospheric Speed Dust & Airflow Motes around the Truck
      if (dustParticles.visible) {
        dustParticles.position.set(pState.x, pState.y, pState.z - 18);
        const dPos = dustGeo.attributes.position as THREE.BufferAttribute;
        const flowSpeed = Math.max(2.5, pState.speedMs * 1.35) * rawDt;
        for (let i = 0; i < dustCount; i++) {
          let pz = dPos.getZ(i) + flowSpeed;
          if (pz > 45) pz -= 90;
          dPos.setZ(i, pz);
        }
        dPos.needsUpdate = true;
      }

      // Update Live 1st-Person Instrument Cluster & Center-Console GPS Navigation Screen
      textures.updateCabinDisplays(
        pState,
        trafficRef.current,
        cameraModeRef.current === 'cabin'
      );

      // Sync 3D AI Traffic Meshes with Distance Culling
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

      // Update Sun, Physical Sky & Directional Shadow Frustum
      applyLightingPreset(timeOfDayRef.current, activeBuiltMapId, pState.z);
      sunLight.target.position.set(pState.x, pState.y, pState.z - 15);

      // Render Live Rear-View Wing Mirror when in 1st-Person Cabin View (including immediately on first Cabin frame)
      const mirrorPeriod = isSoftwareGl ? 3 : activeMirrorInterval;
      const enteredCabinJustNow =
        cameraModeRef.current === 'cabin' && lastMirrorCamMode !== 'cabin';
      lastMirrorCamMode = cameraModeRef.current;

      if (
        cameraModeRef.current === 'cabin' &&
        (enteredCabinJustNow || frameCounter % mirrorPeriod === 1)
      ) {
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

      // R4: State-Driven Camera Shake (scales with speed, road surface roughness & impact trauma; 0 when stopped!)
      const camDamp = 1 - Math.exp(-8.5 * Math.max(0.016, rawDt));
      const speedFactor = Math.min(1.0, pState.speedKmh / 85);
      const surfaceFactor =
        pState.currentSurface === 'offroad'
          ? 2.8
          : pState.currentSurface === 'shoulder'
            ? 1.9
            : pState.currentSurface === 'median'
              ? 2.3
              : 0.35;
      const continuousRoadVib =
        pState.speedKmh > 0.4 ? speedFactor * surfaceFactor * 0.018 : 0.0;
      const impactShake = pState.cameraTrauma * pState.cameraTrauma * 0.22;
      const totalShakeMag = continuousRoadVib + impactShake;
      const shakeX = Math.sin(elapsedSimTime * 34) * totalShakeMag;
      const shakeY = Math.cos(elapsedSimTime * 41) * totalShakeMag;

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
        // Smoothly auto-center manual freelook when actively driving without dragging
        if (!isDraggingOrbitRef.current && pState.speedKmh > 2 && throttle > 0.1) {
          cabinLookRef.current.yaw *= 0.94;
          cabinLookRef.current.pitch *= 0.94;
        }
        const fwdX = Math.sin(pState.heading);
        const fwdZ = -Math.cos(pState.heading);
        // Pure heading + optional canvas drag freelook (never shifts automatically on button presses!)
        const lookTurnYaw = pState.heading + cabinLookRef.current.yaw;
        const lookFwdX = Math.sin(lookTurnYaw);
        const lookFwdZ = -Math.cos(lookTurnYaw);

        camera.position.set(
          _cabinWorldPos.x + shakeX * 0.45,
          _cabinWorldPos.y + shakeY * 0.45 + Math.sin(elapsedSimTime * 5.2) * speedFactor * 0.006,
          _cabinWorldPos.z
        );
        _cabinLookPos.set(
          _cabinWorldPos.x + lookFwdX * 26 + fwdX * 2,
          _cabinWorldPos.y -
            2.38 +
            Math.sin(pState.pitch + cabinLookRef.current.pitch) * 18,
          _cabinWorldPos.z + lookFwdZ * 26 + fwdZ * 2
        );
        camera.lookAt(_cabinLookPos);
        camera.rotation.z += -pState.roll * 0.38;
        const baseCabinFov =
          camera.aspect < 1 ? Math.min(98, 72 / Math.max(0.62, camera.aspect)) : 75;
        if (Math.abs(camera.fov - baseCabinFov) > 0.25) {
          camera.fov = baseCabinFov;
          camera.updateProjectionMatrix();
        }
        snapCameraRef.current = false;
      } else if (cameraModeRef.current === 'orbit') {
        const { yaw, pitch, distance } = orbitAnglesRef.current;
        const worldYaw = -pState.heading + yaw;
        _camTargetPos.set(
          pState.x + Math.sin(worldYaw) * Math.cos(pitch) * distance,
          pState.y + Math.sin(pitch) * distance + 1.5,
          pState.z + Math.cos(worldYaw) * Math.cos(pitch) * distance + 2.0
        );
        if (snapCameraRef.current) {
          camera.position.copy(_camTargetPos);
          snapCameraRef.current = false;
        } else {
          camera.position.lerp(_camTargetPos, camDamp);
        }
        _camLookTarget.set(pState.x, pState.y + 1.9, pState.z + 1.5);
        camera.lookAt(_camLookTarget);
      } else {
        const fwdX = Math.sin(pState.heading);
        const fwdZ = -Math.cos(pState.heading);
        const chaseDist = 17.2 + Math.min(2.8, pState.speedKmh * 0.028);
        const chaseHeight = 5.35;

        // Centered behind the heavy rig with zero automatic lateral drift on button presses
        _camTargetPos.set(
          pState.x - fwdX * chaseDist + shakeX,
          pState.y + chaseHeight + shakeY,
          pState.z - fwdZ * chaseDist
        );
        if (snapCameraRef.current) {
          camera.position.copy(_camTargetPos);
          snapCameraRef.current = false;
        } else {
          camera.position.lerp(_camTargetPos, camDamp);
        }

        _camLookTarget.set(
          pState.x + fwdX * 16,
          pState.y + 2.1,
          pState.z + fwdZ * 16
        );
        camera.lookAt(_camLookTarget);

        const baseChaseFov =
          camera.aspect < 1 ? Math.min(86, 60 / Math.max(0.65, camera.aspect)) : 60;
        const targetFov = baseChaseFov + Math.min(9.5, pState.speedKmh * 0.085);
        if (Math.abs(camera.fov - targetFov) > 0.2) {
          camera.fov += (targetFov - camera.fov) * 0.1;
          camera.updateProjectionMatrix();
        }
      }

      audio.update(pState, gameStateRef.current === 'playing');

      const nowMs = performance.now();
      if (nowMs - lastHudSyncTime > 95) {
        lastHudSyncTime = nowMs;
        setTelemetry({ ...pState });
      }

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
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('resize', onResize);
      dustGeo.dispose();
      dustMat.dispose();
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
        selectedTruck={selectedTruck}
        selectedMap={selectedMap}
        cameraMode={cameraMode}
        timeOfDay={timeOfDay}
        graphicsQuality={graphicsQuality}
        isMuted={isMuted}
        hudCollapsed={hudCollapsed}
        isTouchDevice={isTouchDevice}
        isFullscreen={isFullscreen}
        isPortraitMobile={isPortraitMobile}
        gamepadConnected={gamepadConnected}
        geospatialStatus={geospatialStatus}
        outcomeSnapshot={outcomeSnapshot}
        onStartGame={handleStartGame}
        onResumeGame={handleResumeGame}
        onPauseGame={handlePauseGame}
        onRestartGame={handleRestartGame}
        onReturnToTitle={handleReturnToTitle}
        onSelectTruck={handleSelectTruck}
        onSelectMap={handleSelectMap}
        onCycleCamera={handleCycleCamera}
        onCycleTimeOfDay={handleCycleTimeOfDay}
        onToggleGraphicsQuality={handleToggleGraphicsQuality}
        onToggleMute={handleToggleMute}
        onToggleFullscreen={handleToggleFullscreen}
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
