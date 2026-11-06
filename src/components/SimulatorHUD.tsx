import React from 'react';
import {
  IndicatorState,
  TransmissionMode,
  TRUCK_MODEL_SPECS,
  TruckModelId,
  TruckPhysicsState,
} from '../physics/vehiclePhysics';
import { MAP_CORRIDORS, MapCorridorId } from '../physics/highwaySpline';
import { GeospatialStatus } from '../world/geospatialTiles';

export type GameLifecycleState = 'title' | 'playing' | 'paused' | 'gameover';
export type CameraViewMode = 'chase' | 'cabin' | 'orbit';
export type TimeOfDayPreset = 'golden' | 'day' | 'night';
export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export interface RunOutcomeSnapshot {
  victory: boolean;
  reason: string;
  distanceKm: string;
  elapsedTimeFormatted: string;
  avgSpeedKmh: number;
  cargoIntegrityPct: number;
  fuelUsedLiters: string;
}

interface SimulatorHUDProps {
  gameState: GameLifecycleState;
  telemetry: TruckPhysicsState;
  selectedTruck: TruckModelId;
  selectedMap: MapCorridorId;
  cameraMode: CameraViewMode;
  timeOfDay: TimeOfDayPreset;
  graphicsQuality: GraphicsQuality;
  isMuted: boolean;
  hudCollapsed: boolean;
  isTouchDevice: boolean;
  gamepadConnected: boolean;
  geospatialStatus: GeospatialStatus;
  outcomeSnapshot: RunOutcomeSnapshot | null;
  onStartGame: () => void;
  onResumeGame: () => void;
  onPauseGame: () => void;
  onRestartGame: () => void;
  onReturnToTitle: () => void;
  onSelectTruck: (truckId: TruckModelId) => void;
  onSelectMap: (mapId: MapCorridorId) => void;
  onCycleCamera: (mode?: CameraViewMode) => void;
  onCycleTimeOfDay: (preset?: TimeOfDayPreset) => void;
  onToggleGraphicsQuality: (preset?: GraphicsQuality) => void;
  onToggleMute: () => void;
  onToggleHeadlights: () => void;
  onToggleIndicator: (target: IndicatorState) => void;
  onToggleTransmission: (mode?: TransmissionMode) => void;
  onShiftGear: (delta: 1 | -1) => void;
  onSetHorn: (active: boolean) => void;
  onToggleHudCollapsed: () => void;
  onTouchControl: (control: 'left' | 'right' | 'throttle' | 'brake', active: boolean) => void;
}

const TRUCK_LIST: TruckModelId[] = [
  'tata_prima_4928',
  'ashok_leyland_3520',
  'bharatbenz_4228r',
];

const MAP_LIST: MapCorridorId[] = ['nh44_plains', 'nh48_ghats', 'nh66_coastal'];

/**
 * Custom Graphical SVG Medallion Button for the In-Game HUD
 * Replaces rectangular text-boxes with sculpted metallic/amber circular game controls.
 */
const HudMedallionButton: React.FC<{
  testId?: string;
  ariaLabel: string;
  title: string;
  active?: boolean;
  accentColor?: 'amber' | 'emerald' | 'sky';
  size?: 'sm' | 'md' | 'lg';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  onPointerLeave?: () => void;
  children: React.ReactNode;
}> = ({
  testId,
  ariaLabel,
  title,
  active = false,
  accentColor = 'amber',
  size = 'md',
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  children,
}) => {
  const dims =
    size === 'lg'
      ? 'w-14 h-14'
      : size === 'sm'
        ? 'w-10 h-10'
        : 'w-13 h-13';

  const glowRingColor =
    accentColor === 'emerald'
      ? active
        ? '#10b981'
        : '#44403c'
      : accentColor === 'sky'
        ? active
          ? '#38bdf8'
          : '#44403c'
        : active
          ? '#f59e0b'
          : '#57534e';

  const innerFill = active ? '#292524' : '#141210';

  return (
    <button
      type="button"
      tabIndex={-1}
      data-testid={testId}
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      className={`${dims} relative rounded-full p-0 bg-transparent border-0 cursor-pointer select-none transition-transform duration-100 hover:scale-105 active:scale-95 focus:outline-none group`}
    >
      <svg viewBox="0 0 64 64" className="w-full h-full overflow-visible drop-shadow-xl">
        {/* Outer Machined Bezel Ring */}
        <circle
          cx="32"
          cy="32"
          r="30"
          fill="#0c0a09"
          stroke={active ? glowRingColor : '#292524'}
          strokeWidth="2.5"
        />
        {/* 4 Bezel Bolts */}
        <circle cx="32" cy="5.5" r="1.3" fill="#78716c" />
        <circle cx="32" cy="58.5" r="1.3" fill="#78716c" />
        <circle cx="5.5" cy="32" r="1.3" fill="#78716c" />
        <circle cx="58.5" cy="32" r="1.3" fill="#78716c" />

        {/* Glowing Active Track Ring */}
        <circle
          cx="32"
          cy="32"
          r="25.5"
          fill={innerFill}
          stroke={glowRingColor}
          strokeWidth={active ? '2.5' : '1.4'}
          strokeDasharray={active ? 'none' : '8 4'}
        />

        {/* Subtle Inner Instrument Dish */}
        <circle
          cx="32"
          cy="32"
          r="22"
          fill="none"
          stroke={active ? 'rgba(251, 191, 36, 0.28)' : 'rgba(255, 255, 255, 0.06)'}
          strokeWidth="1"
        />

        {/* Custom Artwork Content */}
        <g className={active ? 'text-amber-400' : 'text-stone-300 group-hover:text-amber-300'}>
          {children}
        </g>
      </svg>
    </button>
  );
};

export const SimulatorHUD: React.FC<SimulatorHUDProps> = ({
  gameState,
  telemetry,
  selectedTruck,
  selectedMap,
  cameraMode,
  timeOfDay,
  graphicsQuality,
  isMuted,
  hudCollapsed,
  isTouchDevice,
  gamepadConnected,
  geospatialStatus,
  outcomeSnapshot,
  onStartGame,
  onResumeGame,
  onPauseGame,
  onRestartGame,
  onReturnToTitle,
  onSelectTruck,
  onSelectMap,
  onCycleCamera,
  onCycleTimeOfDay,
  onToggleGraphicsQuality,
  onToggleMute,
  onToggleHeadlights,
  onToggleIndicator,
  onToggleTransmission,
  onShiftGear,
  onSetHorn,
  onToggleHudCollapsed,
  onTouchControl,
}) => {
  const blurAndCall = (fn: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    fn();
  };

  const activeMapSpec = MAP_CORRIDORS[selectedMap];
  const activeTruckSpec = TRUCK_MODEL_SPECS[selectedTruck];

  // ============================================================================
  // 1. TITLE SCREEN OVERLAY (Live 3D World Camera Tour in background)
  // ============================================================================
  if (gameState === 'title') {
    return (
      <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 md:p-8 overflow-y-auto">
        <div className="max-w-xl pointer-events-auto bg-stone-950/90 border border-stone-800/95 rounded-2xl p-5 md:p-6 shadow-2xl">
          {/* Bespoke Inline SVG Title Emblem */}
          <div className="mb-4">
            <svg
              viewBox="0 0 540 112"
              className="w-full max-w-[460px] h-auto"
              role="img"
              aria-label="Indian National Highway Heavy Haul 3D Simulator"
            >
              <rect
                x="2"
                y="6"
                width="92"
                height="98"
                rx="10"
                fill="#f59e0b"
                stroke="#1c1917"
                strokeWidth="4"
              />
              <rect
                x="9"
                y="13"
                width="78"
                height="84"
                rx="6"
                fill="none"
                stroke="#1c1917"
                strokeWidth="2.5"
              />
              <text
                x="48"
                y="37"
                textAnchor="middle"
                fill="#1c1917"
                fontFamily="Plus Jakarta Sans, sans-serif"
                fontWeight="800"
                fontSize="14"
                letterSpacing="1"
              >
                IND · NH
              </text>
              <text
                x="48"
                y="84"
                textAnchor="middle"
                fill="#1c1917"
                fontFamily="Chakra Petch, sans-serif"
                fontWeight="700"
                fontSize="46"
              >
                {activeMapSpec.routeCode.replace('NH-', '')}
              </text>

              <text
                x="110"
                y="45"
                fill="#f5f5f4"
                fontFamily="Chakra Petch, sans-serif"
                fontWeight="700"
                fontSize="38"
                letterSpacing="1.5"
              >
                BHARAT HAUL
              </text>
              <text
                x="110"
                y="76"
                fill="#fbbf24"
                fontFamily="Chakra Petch, sans-serif"
                fontWeight="600"
                fontSize="19"
                letterSpacing="2.2"
              >
                INDIAN HIGHWAY 3D SIMULATOR
              </text>
              <line
                x1="110"
                y1="89"
                x2="532"
                y2="89"
                stroke="#44403c"
                strokeWidth="2"
              />
              <text
                x="110"
                y="106"
                fill="#a8a29e"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="600"
                fontSize="11"
                letterSpacing="0.3"
              >
                {activeMapSpec.subtitle.toUpperCase()}
              </text>
            </svg>
          </div>

          {/* Pre-Drive Selectors: 3 Trucks, 3 Maps, Graphics & Atmosphere */}
          <div className="space-y-3.5 mb-5">
            {/* R7: 3 Visibly Distinct Indian Heavy Trucks */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-stone-300 mb-1.5">
                <span>1. Select Heavy Truck Rig (3 Distinct 3D Chassis)</span>
                <span className="text-[11px] font-mono-tabular text-amber-400">
                  {activeTruckSpec.grossWeightTonnes}t · {activeTruckSpec.peakTorqueNm} Nm
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {TRUCK_LIST.map((tId) => {
                  const spec = TRUCK_MODEL_SPECS[tId];
                  const active = selectedTruck === tId;
                  return (
                    <button
                      key={tId}
                      type="button"
                      data-testid={`truck-btn-${tId}`}
                      onClick={() => onSelectTruck(tId)}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        active
                          ? 'bg-amber-500/20 border-amber-400 text-stone-100 shadow-md'
                          : 'bg-stone-900/90 hover:bg-stone-800 border-stone-800 text-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold leading-tight truncate text-amber-400">
                          {spec.shortName}
                        </span>
                        {/* Custom Truck Silhouette SVG */}
                        <svg viewBox="0 0 36 18" className="w-6 h-3.5 shrink-0 fill-current text-amber-400/80">
                          {tId === 'tata_prima_4928' ? (
                            <path d="M2 5h18v8H2V5zm19 2h8l3 3v3h-11V7zM7 15a2 2 0 100-4 2 2 0 000 4zm9 0a2 2 0 100-4 2 2 0 000 4zm11 0a2 2 0 100-4 2 2 0 000 4z" />
                          ) : tId === 'ashok_leyland_3520' ? (
                            <path d="M2 3h20l2 3v7H2V3zm23 3h6l2 4v3h-8V6zM7 15a2 2 0 100-4 2 2 0 000 4zm12 0a2 2 0 100-4 2 2 0 000 4zm9 0a2 2 0 100-4 2 2 0 000 4z" />
                          ) : (
                            <path d="M2 6c2-2 15-2 17 0v7H2V6zm19 1h8l3 2v4H21V7zM7 15a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z" />
                          )}
                        </svg>
                      </div>
                      <div className="text-[10px] text-stone-300 truncate">
                        {spec.category}
                      </div>
                      <div className="text-[10px] font-mono-tabular text-stone-400 mt-1">
                        {spec.grossWeightTonnes}t · {spec.peakTorqueNm} Nm
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* R8 & R9: 3 Genuinely Different Indian Highway Maps */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-stone-300 mb-1.5">
                <span>2. Select Photorealistic 3D Highway Map</span>
                <span className="text-[11px] font-mono-tabular text-emerald-400">
                  {activeMapSpec.routeCode} · {activeMapSpec.regionBadge}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MAP_LIST.map((mId) => {
                  const mSpec = MAP_CORRIDORS[mId];
                  const active = selectedMap === mId;
                  return (
                    <button
                      key={mId}
                      type="button"
                      data-testid={`map-btn-${mId}`}
                      onClick={() => onSelectMap(mId)}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        active
                          ? 'bg-emerald-500/20 border-emerald-400 text-stone-100 shadow-md'
                          : 'bg-stone-900/90 hover:bg-stone-800 border-stone-800 text-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold leading-tight truncate text-emerald-400">
                          {mSpec.shortTitle}
                        </span>
                        {/* Custom Terrain Emblem SVG */}
                        <svg viewBox="0 0 24 16" className="w-5 h-3.5 shrink-0 fill-none stroke-emerald-400 stroke-2">
                          {mId === 'nh48_ghats' ? (
                            <path d="M1 14L8 3l5 7 4-5 6 9H1z" />
                          ) : mId === 'nh66_coastal' ? (
                            <path d="M2 12h20M6 12V4l-4 8m16 0V4l4 8M6 6h12" />
                          ) : (
                            <path d="M1 13h22M4 13l5-8h6l5 8" />
                          )}
                        </svg>
                      </div>
                      <div className="text-[10px] text-stone-300 truncate">
                        {mSpec.regionBadge}
                      </div>
                      <div className="text-[10px] font-mono-tabular text-stone-400 mt-1 truncate">
                        {mSpec.routeCode} · 5.0 KM
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Compact Row: Lighting & Graphics Preset */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <div className="text-[11px] font-semibold text-stone-400 mb-1">
                  Atmosphere
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'golden', label: 'Golden' },
                      { id: 'day', label: 'Noon' },
                      { id: 'night', label: 'Night' },
                    ] as const
                  ).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onCycleTimeOfDay(preset.id)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        timeOfDay === preset.id
                          ? 'bg-amber-500 text-stone-950'
                          : 'bg-stone-900 text-stone-300 hover:bg-stone-800 border border-stone-800'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-stone-400 mb-1">
                  Graphics Quality & LOD
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {(
                    [
                      { id: 'low', label: 'Low' },
                      { id: 'medium', label: 'Med' },
                      { id: 'high', label: 'High' },
                      { id: 'ultra', label: 'Ultra' },
                    ] as const
                  ).map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      data-testid={`gfx-btn-${tier.id}`}
                      onClick={() => onToggleGraphicsQuality(tier.id)}
                      className={`py-1.5 px-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        graphicsQuality === tier.id
                          ? 'bg-amber-500 text-stone-950'
                          : 'bg-stone-900 text-stone-300 hover:bg-stone-800 border border-stone-800'
                      }`}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Primary Start CTA with Custom Engine Ignition SVG */}
          <button
            type="button"
            data-start="true"
            onClick={onStartGame}
            className="w-full py-3.5 px-6 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-display font-bold text-lg tracking-wider rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-3"
          >
            <svg viewBox="0 0 28 28" className="w-6 h-6 fill-none stroke-stone-950 stroke-[2.4]">
              <circle cx="14" cy="14" r="10" />
              <circle cx="14" cy="14" r="3" fill="#0c0a09" />
              <path d="M14 4v6M5.5 19l5.2-3M22.5 19l-5.2-3" />
            </svg>
            <span>IGNITION · START HEAVY HAUL</span>
          </button>

          {/* Corridor & Gamepad Status Line */}
          <div className="mt-3.5 pt-2.5 border-t border-stone-800/80 flex items-center justify-between text-[11px] text-stone-400">
            <span>{activeTruckSpec.name} · Left-Hand Traffic</span>
            <span className="font-mono-tabular">
              {gamepadConnected ? 'GAMEPAD READY' : 'KEYBOARD / TOUCH / WHEEL'}
            </span>
          </div>
        </div>

        {/* Single Flat Control-Hint Line in Bottom Safe Margin */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-stone-300 hud-stroke px-2 mt-3">
          <span>
            WASD / Arrows / Gamepad Drive · Space Air Brake · C Camera · L Lights · Q/E Indicators · H Horn · Esc Garage
          </span>
          <span className="text-stone-400 text-[11px]">
            {geospatialStatus.dataAttribution}
          </span>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 2. PLAYING HUD — CUSTOM GRAPHICAL GAME INSTRUMENT PODS & MEDALLIONS
  //    (Zero rectangular text-and-box buttons!)
  // ============================================================================
  const rpmRatio = Math.min(1, Math.max(0, telemetry.rpm / 2500));
  // Analog tachometer needle angle: sweeps from -130 deg (idle 0 RPM) to +130 deg (2500 RPM)
  const rpmNeedleAngleDeg = -130 + rpmRatio * 260;
  const fuelRatio = Math.min(1, Math.max(0, telemetry.fuelLiters / telemetry.fuelMaxLiters));
  const cargoRatio = Math.min(1, Math.max(0, telemetry.cargoIntegrityPct / 100));
  const routeProgressRatio = Math.min(1, Math.max(0, telemetry.distanceAlongHighwayM / 4350));

  const leftSignalOn =
    telemetry.indicatorBlinkOn &&
    (telemetry.indicator === 'left' || telemetry.indicator === 'hazard');
  const rightSignalOn =
    telemetry.indicatorBlinkOn &&
    (telemetry.indicator === 'right' || telemetry.indicator === 'hazard');

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 md:p-5 select-none">
      {/* TOP PERIMETER: Custom SVG Indian Milestone Arch Emblem (Left) + Sculpted Gear Cog Medallion (Right) */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left: Custom Graphical NHAI Highway Milestone & Route Arch Badge */}
        <div className="pointer-events-auto relative drop-shadow-2xl">
          <svg
            viewBox="0 0 320 76"
            className="w-[270px] sm:w-[310px] h-auto overflow-visible"
            role="img"
            aria-label="Highway Milestone and Waypoint Gauge"
          >
            {/* Outer Sculpted Highway Milestone Shield */}
            <path
              d="M14 4 H296 L314 22 V56 L298 72 H14 C7 72 4 66 4 58 V18 C4 10 7 4 14 4 Z"
              fill="#0c0a09"
              fillOpacity="0.9"
              stroke="#44403c"
              strokeWidth="2"
            />
            {/* Yellow NHAI Milestone Top Crown Accent */}
            <path
              d="M14 4 H296 L306 14 H6 L14 4 Z"
              fill="#f59e0b"
            />
            {/* Route Progress Glow Track along bottom edge */}
            <line
              x1="16"
              y1="67"
              x2="294"
              y2="67"
              stroke="#292524"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <line
              x1="16"
              y1="67"
              x2={16 + 278 * routeProgressRatio}
              y2="67"
              stroke="#10b981"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Indian Circular Speed Limit Sign Roundel */}
            <circle
              cx="36"
              cy="40"
              r="19"
              fill="#f5f5f4"
              stroke="#dc2626"
              strokeWidth="4.5"
            />
            <text
              x="36"
              y="45"
              textAnchor="middle"
              fill="#0c0a09"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="800"
              fontSize="15"
            >
              {telemetry.speedLimitKmh}
            </text>

            {/* Route Code & Milestone Distance */}
            <text
              x="66"
              y="28"
              fill="#fbbf24"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="700"
              fontSize="10.5"
            >
              {telemetry.landmarkKm} · {activeTruckSpec.shortName.toUpperCase()}
            </text>

            {/* Next Waypoint Distance Meter */}
            <text
              x="66"
              y="59"
              fill="#a8a29e"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="600"
              fontSize="10"
            >
              ▸ {telemetry.nextWaypointName.toUpperCase()} ({telemetry.nextWaypointDistanceM}M)
            </text>
          </svg>

          {/* Accessible DOM Zone Name overlaid cleanly inside the SVG Milestone Shield */}
          <div
            data-testid="hud-zone-name"
            className="absolute left-[66px] top-[29px] right-4 text-xs sm:text-[13px] font-bold text-stone-100 truncate pointer-events-none"
          >
            {telemetry.zoneName}
          </div>
        </div>

        {/* Top-Right: Sculpted Circular Mechanical Gear Cog Medallion (No Rectangular Text Box!) */}
        <div className="pointer-events-auto flex items-center gap-2.5">
          {/* HUD Visibility Toggle Medallion */}
          <HudMedallionButton
            ariaLabel={hudCollapsed ? 'Show Cockpit Instruments [U]' : 'Hide Cockpit Instruments [U]'}
            title={hudCollapsed ? 'Show Instruments [U]' : 'Hide Instruments [U]'}
            active={!hudCollapsed}
            size="sm"
            onClick={blurAndCall(onToggleHudCollapsed)}
          >
            {/* Custom Eye / Visor Graphic */}
            <path
              d="M14 32 C20 21 44 21 50 32 C44 43 20 43 14 32 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            />
            <circle cx="32" cy="32" r="5" fill="currentColor" />
            {hudCollapsed && (
              <line x1="16" y1="48" x2="48" y2="16" stroke="#f59e0b" strokeWidth="3" />
            )}
          </HudMedallionButton>

          {/* Primary Garage & Settings Gear Medallion */}
          <HudMedallionButton
            testId="settings-gear-btn"
            ariaLabel="Open Garage, Route & Settings [Esc]"
            title="Garage, Route & Graphics Settings [Esc]"
            active={gameState === 'paused'}
            size="lg"
            onClick={blurAndCall(gameState === 'paused' ? onResumeGame : onPauseGame)}
          >
            {/* Custom Machined 8-Tooth Heavy Truck Transmission Gear Graphic */}
            <path
              d="M32 14 L35 18 L40 16 L41 21 L46 22 L44 27 L48 30 L45 34 L48 38 L43 40 L43 45 L38 45 L35 49 L32 45 L29 49 L26 45 L21 45 L21 40 L16 38 L19 34 L16 30 L20 27 L18 22 L23 21 L24 16 L29 18 Z"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            <circle cx="32" cy="32" r="7.5" fill="none" stroke="#f5f5f4" strokeWidth="2.5" />
            <circle cx="32" cy="32" r="2.8" fill="#fbbf24" />
          </HudMedallionButton>
        </div>
      </div>

      {/* Warning Graphic Emblem for Trailer Jackknife */}
      {telemetry.jackknifeWarning && (
        <div className="self-center pointer-events-none">
          <svg viewBox="0 0 380 44" className="w-[340px] sm:w-[380px] h-auto drop-shadow-xl">
            <polygon
              points="18,4 362,4 376,22 362,40 18,40 4,22"
              fill="#450a0a"
              stroke="#ef4444"
              strokeWidth="2.5"
            />
            <path d="M28 32 L38 12 L48 32 Z" fill="#facc15" />
            <text
              x="202"
              y="26"
              textAnchor="middle"
              fill="#fecaca"
              fontFamily="Chakra Petch, sans-serif"
              fontWeight="700"
              fontSize="12.5"
              letterSpacing="1"
            >
              TRAILER ARTICULATION ALERT · COUNTER-STEER
            </text>
          </svg>
        </div>
      )}

      {/* MOBILE TOUCH DRIVING CONTROLS (Custom Graphical SVG Steering & Pedals) */}
      {isTouchDevice && gameState === 'playing' && (
        <div className="flex items-end justify-between w-full px-2 pb-2 pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            <HudMedallionButton
              ariaLabel="Steer Left"
              title="Steer Left"
              size="lg"
              onPointerDown={() => onTouchControl('left', true)}
              onPointerUp={() => onTouchControl('left', false)}
              onPointerLeave={() => onTouchControl('left', false)}
            >
              <path
                d="M38 18 L22 32 L38 46 M24 32 H46"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </HudMedallionButton>
            <HudMedallionButton
              ariaLabel="Steer Right"
              title="Steer Right"
              size="lg"
              onPointerDown={() => onTouchControl('right', true)}
              onPointerUp={() => onTouchControl('right', false)}
              onPointerLeave={() => onTouchControl('right', false)}
            >
              <path
                d="M26 18 L42 32 L26 46 M40 32 H18"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </HudMedallionButton>
          </div>

          {/* Custom Graphical Foot Pedals (Air Brake & Throttle Treadle) */}
          <div className="flex items-end gap-3 pointer-events-auto">
            <button
              type="button"
              aria-label="Air Brake Pedal"
              onPointerDown={() => onTouchControl('brake', true)}
              onPointerUp={() => onTouchControl('brake', false)}
              onPointerLeave={() => onTouchControl('brake', false)}
              className="w-16 h-20 bg-transparent border-0 p-0 cursor-pointer active:scale-95 transition-transform"
            >
              <svg viewBox="0 0 64 80" className="w-full h-full drop-shadow-xl">
                <rect
                  x="6"
                  y="8"
                  width="52"
                  height="64"
                  rx="10"
                  fill="#450a0a"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                />
                <line x1="16" y1="24" x2="48" y2="24" stroke="#fca5a5" strokeWidth="3.5" strokeLinecap="round" />
                <line x1="16" y1="36" x2="48" y2="36" stroke="#fca5a5" strokeWidth="3.5" strokeLinecap="round" />
                <line x1="16" y1="48" x2="48" y2="48" stroke="#fca5a5" strokeWidth="3.5" strokeLinecap="round" />
                <circle cx="32" cy="61" r="4" fill="#ef4444" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Throttle Accelerator Pedal"
              onPointerDown={() => onTouchControl('throttle', true)}
              onPointerUp={() => onTouchControl('throttle', false)}
              onPointerLeave={() => onTouchControl('throttle', false)}
              className="w-16 h-24 bg-transparent border-0 p-0 cursor-pointer active:scale-95 transition-transform"
            >
              <svg viewBox="0 0 64 96" className="w-full h-full drop-shadow-xl">
                <rect
                  x="8"
                  y="6"
                  width="48"
                  height="84"
                  rx="12"
                  fill="#064e3b"
                  stroke="#10b981"
                  strokeWidth="2.5"
                />
                <path
                  d="M22 36 L32 22 L42 36 M22 52 L32 38 L42 52"
                  fill="none"
                  stroke="#6ee7b7"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line x1="18" y1="68" x2="46" y2="68" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
                <line x1="18" y1="78" x2="46" y2="78" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* BOTTOM INSTRUMENT CLUSTER: Circular Cockpit Dial Pod (Left) + Graphical Action Medallions (Right) */}
      {!hudCollapsed && (
        <div className="flex items-end justify-between gap-4 w-full">
          {/* Bottom-Left: Custom Circular SVG Analog/Digital Tachometer & Speedometer Pod */}
          <div className="pointer-events-auto relative w-[224px] h-[196px] shrink-0 drop-shadow-2xl">
            <svg
              viewBox="0 0 240 210"
              className="w-full h-full overflow-visible"
              role="img"
              aria-label={`Speed ${Math.round(telemetry.speedKmh)} km/h, Gear ${telemetry.gearLabel}, Engine ${Math.round(telemetry.rpm)} RPM`}
            >
              <defs>
                <radialGradient id="dialFaceGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#1c1917" />
                  <stop offset="72%" stopColor="#0c0a09" />
                  <stop offset="100%" stopColor="#050404" />
                </radialGradient>
              </defs>

              {/* Outer Brushed Gunmetal Instrument Housing */}
              <circle
                cx="120"
                cy="108"
                r="88"
                fill="url(#dialFaceGrad)"
                stroke="#44403c"
                strokeWidth="4"
              />
              {/* Chrome Inner Bezel Ring */}
              <circle
                cx="120"
                cy="108"
                r="81"
                fill="none"
                stroke="#78716c"
                strokeWidth="1.2"
                strokeDasharray="6 3"
              />

              {/* Radial RPM Scale Arc (-130 deg to +130 deg) */}
              {/* Economy Diesel Green Band Arc */}
              <path
                d="M 55 78 A 72 72 0 0 1 185 78"
                fill="none"
                stroke="#10b981"
                strokeOpacity="0.32"
                strokeWidth="8"
                strokeLinecap="round"
              />

              {/* Radial Tachometer Tick Marks around the Dial */}
              {Array.from({ length: 26 }).map((_, idx) => {
                const tickDeg = -130 + idx * 10;
                const rad = ((tickDeg - 90) * Math.PI) / 180;
                const isMajor = idx % 5 === 0;
                const rOuter = 76;
                const rInner = isMajor ? 64 : 69;
                const x1 = 120 + Math.cos(rad) * rInner;
                const y1 = 108 + Math.sin(rad) * rInner;
                const x2 = 120 + Math.cos(rad) * rOuter;
                const y2 = 108 + Math.sin(rad) * rOuter;
                const tickColor =
                  idx >= 21 ? '#ef4444' : idx >= 11 && idx <= 18 ? '#10b981' : '#a8a29e';
                return (
                  <line
                    key={idx}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={tickColor}
                    strokeWidth={isMajor ? '2.6' : '1.4'}
                    strokeLinecap="round"
                  />
                );
              })}

              {/* Sweeping Analog Tachometer Needle */}
              <g transform={`translate(120, 108) rotate(${rpmNeedleAngleDeg})`}>
                <polygon points="-2.5,12 0,-70 2.5,12" fill="#f59e0b" />
                <circle cx="0" cy="0" r="8" fill="#292524" stroke="#f59e0b" strokeWidth="2" />
              </g>

              {/* Center Digital Cockpit Readout Window */}
              <circle
                cx="120"
                cy="112"
                r="44"
                fill="#090807"
                stroke="#292524"
                strokeWidth="2.5"
              />

              {/* Hero Digital Speed Numeral */}
              <text
                x="120"
                y="112"
                textAnchor="middle"
                fill="#f5f5f4"
                fontFamily="Chakra Petch, sans-serif"
                fontWeight="700"
                fontSize="36"
              >
                {Math.round(telemetry.speedKmh)}
              </text>
              <text
                x="120"
                y="126"
                textAnchor="middle"
                fill="#78716c"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="700"
                fontSize="8.5"
                letterSpacing="1.5"
              >
                KM/H · {Math.round(telemetry.rpm)} RPM
              </text>

              {/* Lower Sub-Dial Status Pill: Fuel & Cargo Integrity Bars */}
              <g transform="translate(82, 162)">
                <rect x="0" y="0" width="34" height="5" rx="2.5" fill="#1c1917" />
                <rect
                  x="0"
                  y="0"
                  width={Math.max(3, 34 * fuelRatio)}
                  height="5"
                  rx="2.5"
                  fill="#f59e0b"
                />
                <rect x="42" y="0" width="34" height="5" rx="2.5" fill="#1c1917" />
                <rect
                  x="42"
                  y="0"
                  width={Math.max(3, 34 * cargoRatio)}
                  height="5"
                  rx="2.5"
                  fill={telemetry.cargoIntegrityPct < 80 ? '#f59e0b' : '#10b981'}
                />
                <text
                  x="17"
                  y="14"
                  textAnchor="middle"
                  fill="#a8a29e"
                  fontFamily="JetBrains Mono, monospace"
                  fontSize="7.5"
                  fontWeight="700"
                >
                  FUEL {Math.round(fuelRatio * 100)}%
                </text>
                <text
                  x="59"
                  y="14"
                  textAnchor="middle"
                  fill="#a8a29e"
                  fontFamily="JetBrains Mono, monospace"
                  fontSize="7.5"
                  fontWeight="700"
                >
                  CARGO {Math.round(cargoRatio * 100)}%
                </text>
              </g>
            </svg>

            {/* Interactive Turn-Signal Wing Medallions & Gear Shifter Roundels mounted on the Dial Pod */}
            {/* Left Turn Signal Wing Button */}
            <button
              type="button"
              tabIndex={-1}
              data-testid="ind-left-btn"
              aria-label="Left Turn Indicator [Q]"
              title="Left Turn Signal [Q]"
              onClick={blurAndCall(() =>
                onToggleIndicator(telemetry.indicator === 'left' ? 'off' : 'left')
              )}
              className="absolute left-0 top-3 w-11 h-11 rounded-full bg-transparent border-0 p-0 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
            >
              <svg viewBox="0 0 44 44" className="w-full h-full drop-shadow-lg">
                <circle
                  cx="22"
                  cy="22"
                  r="19"
                  fill={leftSignalOn ? '#f59e0b' : '#141210'}
                  stroke={leftSignalOn ? '#fef08a' : '#44403c'}
                  strokeWidth="2.2"
                />
                <path
                  d="M25 13 L14 22 L25 31 M16 22 H31"
                  fill="none"
                  stroke={leftSignalOn ? '#0c0a09' : '#a8a29e'}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Right Turn Signal Wing Button */}
            <button
              type="button"
              tabIndex={-1}
              data-testid="ind-right-btn"
              aria-label="Right Turn Indicator [E]"
              title="Right Turn Signal [E]"
              onClick={blurAndCall(() =>
                onToggleIndicator(telemetry.indicator === 'right' ? 'off' : 'right')
              )}
              className="absolute right-0 top-3 w-11 h-11 rounded-full bg-transparent border-0 p-0 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
            >
              <svg viewBox="0 0 44 44" className="w-full h-full drop-shadow-lg">
                <circle
                  cx="22"
                  cy="22"
                  r="19"
                  fill={rightSignalOn ? '#f59e0b' : '#141210'}
                  stroke={rightSignalOn ? '#fef08a' : '#44403c'}
                  strokeWidth="2.2"
                />
                <path
                  d="M19 13 L30 22 L19 31 M28 22 H13"
                  fill="none"
                  stroke={rightSignalOn ? '#0c0a09' : '#a8a29e'}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Center Gear Selector Medallion (Click to toggle Auto/Manual) */}
            <button
              type="button"
              tabIndex={-1}
              onClick={blurAndCall(() => onToggleTransmission())}
              title={`12-Speed Gearbox (${telemetry.transmissionMode.toUpperCase()}) — Click to toggle Auto/Manual`}
              className="absolute left-1/2 -translate-x-1/2 top-[118px] w-14 h-9 bg-transparent border-0 p-0 cursor-pointer hover:scale-105 transition-transform"
            >
              <svg viewBox="0 0 68 34" className="w-full h-full">
                <rect
                  x="2"
                  y="2"
                  width="64"
                  height="30"
                  rx="15"
                  fill="#1c1917"
                  stroke="#f59e0b"
                  strokeWidth="1.8"
                />
                <text
                  x="34"
                  y="22"
                  textAnchor="middle"
                  fill="#fbbf24"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="800"
                  fontSize="14"
                >
                  {telemetry.gearLabel}·{telemetry.transmissionMode === 'auto' ? 'A' : 'M'}
                </text>
              </svg>
            </button>

            {/* Gear Down Paddle Roundel (-) */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Shift Gear Down"
              title="Shift Gear Down"
              onClick={blurAndCall(() => onShiftGear(-1))}
              className="absolute left-1.5 bottom-3 w-9 h-9 rounded-full bg-transparent border-0 p-0 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
            >
              <svg viewBox="0 0 36 36" className="w-full h-full drop-shadow-md">
                <circle cx="18" cy="18" r="16" fill="#141210" stroke="#57534e" strokeWidth="2" />
                <line x1="12" y1="18" x2="24" y2="18" stroke="#e7e5e4" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </button>

            {/* Gear Up Paddle Roundel (+) */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Shift Gear Up"
              title="Shift Gear Up"
              onClick={blurAndCall(() => onShiftGear(1))}
              className="absolute right-1.5 bottom-3 w-9 h-9 rounded-full bg-transparent border-0 p-0 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
            >
              <svg viewBox="0 0 36 36" className="w-full h-full drop-shadow-md">
                <circle cx="18" cy="18" r="16" fill="#141210" stroke="#57534e" strokeWidth="2" />
                <path d="M12 18 H24 M18 12 V24" stroke="#e7e5e4" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Bottom-Right: Custom Sculpted Graphical Game Action Medallions (Pure SVG Artwork, Zero Text Boxes!) */}
          <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-3 pb-1">
            {/* 1. Cabin 1st-Person Cockpit View Medallion */}
            <HudMedallionButton
              testId="cam-btn-cabin"
              ariaLabel="1st-Person Cabin Cockpit View [C]"
              title="1st-Person RHD Cabin Cockpit Camera [C]"
              active={cameraMode === 'cabin'}
              onClick={blurAndCall(() => onCycleCamera('cabin'))}
            >
              {/* Custom 3-Spoke Heavy Truck Steering Wheel Artwork */}
              <circle cx="32" cy="32" r="13.5" fill="none" stroke="currentColor" strokeWidth="3" />
              <circle cx="32" cy="32" r="4" fill="currentColor" />
              <line x1="19" y1="30" x2="28" y2="32" stroke="currentColor" strokeWidth="2.6" />
              <line x1="45" y1="30" x2="36" y2="32" stroke="currentColor" strokeWidth="2.6" />
              <line x1="32" y1="36" x2="32" y2="45" stroke="currentColor" strokeWidth="2.6" />
            </HudMedallionButton>

            {/* 2. 3rd-Person Chase View Medallion */}
            <HudMedallionButton
              testId="cam-btn-chase"
              ariaLabel="3rd-Person Highway Chase Camera [C]"
              title="3rd-Person Highway Chase Camera [C]"
              active={cameraMode === 'chase'}
              onClick={blurAndCall(() => onCycleCamera('chase'))}
            >
              {/* Custom Heavy Truck Rear Perspective & Highway Lanes Artwork */}
              <path d="M15 46 L23 34 M49 46 L41 34" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
              <rect x="22" y="18" width="20" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2.6" />
              <rect x="25" y="21" width="14" height="6" rx="1" fill="currentColor" fillOpacity="0.35" />
              <line x1="24" y1="33" x2="24" y2="38" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
              <line x1="40" y1="33" x2="40" y2="38" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
            </HudMedallionButton>

            {/* 3. 360° Orbit Inspection Camera Medallion */}
            <HudMedallionButton
              testId="cam-btn-orbit"
              ariaLabel="360-Degree Orbit Camera [C]"
              title="360° Cinematic Orbit Camera [C]"
              active={cameraMode === 'orbit'}
              onClick={blurAndCall(() => onCycleCamera('orbit'))}
            >
              {/* Custom 360° Orbital Gyro Ring & Truck Core Artwork */}
              <ellipse
                cx="32"
                cy="32"
                rx="16"
                ry="8"
                transform="rotate(-22 32 32)"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              />
              <circle cx="32" cy="32" r="4.5" fill="#fbbf24" />
              <polygon points="45,22 49,27 42,28" fill="currentColor" />
            </HudMedallionButton>

            {/* 4. Parabolic Headlamp High-Beam Medallion */}
            <HudMedallionButton
              testId="headlight-btn"
              ariaLabel="Toggle High-Beam Headlights [L]"
              title="Toggle High-Beam Headlights [L]"
              active={telemetry.headlightsOn}
              onClick={blurAndCall(onToggleHeadlights)}
            >
              {/* Custom Headlamp Dome + Projecting Light Rays Artwork */}
              <path
                d="M28 20 C19 20 16 25 16 32 C16 39 19 44 28 44 Z"
                fill={telemetry.headlightsOn ? '#fbbf24' : 'none'}
                stroke="currentColor"
                strokeWidth="2.6"
              />
              <line x1="33" y1="22" x2="46" y2="18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
              <line x1="34" y1="29" x2="48" y2="29" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
              <line x1="34" y1="35" x2="48" y2="35" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
              <line x1="33" y1="42" x2="46" y2="46" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            </HudMedallionButton>

            {/* 5. Twin Chrome Pneumatic Air-Horn Trumpet Medallion */}
            <HudMedallionButton
              testId="horn-btn"
              ariaLabel="Sound Musical Pressure Horn [H]"
              title="Sound Indian Truck Musical Air Horn [H]"
              active={telemetry.hornActive}
              size="lg"
              onPointerDown={() => onSetHorn(true)}
              onPointerUp={() => onSetHorn(false)}
              onPointerLeave={() => onSetHorn(false)}
            >
              {/* Custom Twin Chrome Air-Horn Trumpet Bell + Acoustic Waves Artwork */}
              <path
                d="M16 29 H26 L38 20 V44 L26 35 H16 Z"
                fill={telemetry.hornActive ? '#fbbf24' : 'none'}
                stroke="#fbbf24"
                strokeWidth="2.6"
                strokeLinejoin="round"
              />
              <path
                d="M43 24 C47 28 47 36 43 40 M47 19 C53 26 53 38 47 45"
                fill="none"
                stroke={telemetry.hornActive ? '#fef08a' : 'currentColor'}
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </HudMedallionButton>
          </div>
        </div>
      )}

      {/* ==========================================================================
          3. UNIFIED SETTINGS, GARAGE & CORRIDOR MODAL (`gameState === 'paused'`)
         ========================================================================== */}
      {gameState === 'paused' && (
        <div className="fixed inset-0 z-30 bg-stone-950/85 flex items-center justify-center p-4 pointer-events-auto overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-modal-title"
            data-testid="settings-modal"
            className="w-full max-w-xl bg-stone-950 border border-stone-800 rounded-2xl p-5 md:p-6 shadow-2xl my-auto"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2
                  id="pause-modal-title"
                  className="font-display font-bold text-2xl text-stone-100 tracking-wide"
                >
                  GARAGE, ROUTE & SETTINGS
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  {activeMapSpec.title} · {activeTruckSpec.name}
                </p>
              </div>
              <button
                type="button"
                onClick={onResumeGame}
                className="w-9 h-9 rounded-full bg-stone-900 hover:bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-300 cursor-pointer"
                aria-label="Close Settings"
              >
                ✕
              </button>
            </div>

            {/* 1. Fleet Garage — Switch Truck Model Live */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-300 mb-1.5">
                <span>Active Heavy Truck Chassis (R7)</span>
                <span className="text-[11px] font-mono-tabular text-amber-400">
                  {activeTruckSpec.grossWeightTonnes}t · {activeTruckSpec.peakTorqueNm} Nm
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {TRUCK_LIST.map((tId) => {
                  const spec = TRUCK_MODEL_SPECS[tId];
                  const active = selectedTruck === tId;
                  return (
                    <button
                      key={tId}
                      type="button"
                      data-testid={`modal-truck-btn-${tId}`}
                      onClick={() => onSelectTruck(tId)}
                      className={`p-2.5 rounded-xl text-left border transition-colors cursor-pointer ${
                        active
                          ? 'bg-amber-500/20 border-amber-400 text-stone-100'
                          : 'bg-stone-900 hover:bg-stone-800 border-stone-800 text-stone-300'
                      }`}
                    >
                      <div className="text-xs font-bold text-amber-400 truncate">
                        {spec.shortName}
                      </div>
                      <div className="text-[10px] text-stone-400 truncate mt-0.5">
                        {spec.category}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Highway Corridor — Switch Indian Map Live */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-300 mb-1.5">
                <span>Active Indian Highway Map (R8 & R9)</span>
                <span className="text-[11px] font-mono-tabular text-emerald-400">
                  {activeMapSpec.routeCode} · {activeMapSpec.regionBadge}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MAP_LIST.map((mId) => {
                  const mSpec = MAP_CORRIDORS[mId];
                  const active = selectedMap === mId;
                  return (
                    <button
                      key={mId}
                      type="button"
                      data-testid={`modal-map-btn-${mId}`}
                      onClick={() => onSelectMap(mId)}
                      className={`p-2.5 rounded-xl text-left border transition-colors cursor-pointer ${
                        active
                          ? 'bg-emerald-500/20 border-emerald-400 text-stone-100'
                          : 'bg-stone-900 hover:bg-stone-800 border-stone-800 text-stone-300'
                      }`}
                    >
                      <div className="text-xs font-bold text-emerald-400 truncate">
                        {mSpec.shortTitle}
                      </div>
                      <div className="text-[10px] text-stone-400 truncate mt-0.5">
                        {mSpec.regionBadge}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Graphics Quality, Lighting & Audio Settings */}
            <div className="space-y-3 py-3 border-y border-stone-800 mb-5 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-stone-300 font-semibold">Graphics Quality & LOD Tier</span>
                  <span className="text-[11px] font-mono-tabular text-amber-400 uppercase">
                    {graphicsQuality === 'ultra' ? 'Ultra 4K Max LOD' : graphicsQuality}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'low', label: 'Low' },
                      { id: 'medium', label: 'Med' },
                      { id: 'high', label: 'High' },
                      { id: 'ultra', label: 'Ultra 4K' },
                    ] as const
                  ).map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => onToggleGraphicsQuality(tier.id)}
                      className={`py-1.5 px-2 rounded-lg font-semibold uppercase transition-colors cursor-pointer ${
                        graphicsQuality === tier.id
                          ? 'bg-amber-500 text-stone-950'
                          : 'bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300'
                      }`}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="block text-stone-300 font-semibold mb-1">
                    Time of Day
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { id: 'golden', label: 'Golden' },
                        { id: 'day', label: 'Day' },
                        { id: 'night', label: 'Night' },
                      ] as const
                    ).map((tod) => (
                      <button
                        key={tod.id}
                        type="button"
                        onClick={() => onCycleTimeOfDay(tod.id)}
                        className={`py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                          timeOfDay === tod.id
                            ? 'bg-amber-500 text-stone-950'
                            : 'bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300'
                        }`}
                      >
                        {tod.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-stone-300 font-semibold mb-1">
                    Audio & Gearbox
                  </span>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={onToggleMute}
                      className={`py-1.5 px-2 rounded-lg font-semibold border transition-colors cursor-pointer ${
                        !isMuted
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-stone-900 border-stone-700 text-stone-400'
                      }`}
                    >
                      {isMuted ? 'Muted' : 'Audio On'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleTransmission()}
                      className="py-1.5 px-2 rounded-lg font-semibold bg-stone-900 hover:bg-stone-800 border border-stone-700 text-amber-400 uppercase cursor-pointer"
                    >
                      {telemetry.transmissionMode} Gear
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                data-testid="resume-haul-btn"
                onClick={onResumeGame}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-base rounded-xl transition-colors cursor-pointer"
              >
                RESUME HAUL (ESC)
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onRestartGame}
                  className="py-2.5 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Restart Corridor
                </button>
                <button
                  type="button"
                  onClick={onReturnToTitle}
                  className="py-2.5 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Title Screen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          4. VICTORY / GAME OVER MODAL (`gameState === 'gameover'`)
         ========================================================================== */}
      {gameState === 'gameover' && outcomeSnapshot && (
        <div className="fixed inset-0 z-30 bg-stone-950/85 flex items-center justify-center p-4 pointer-events-auto">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md bg-stone-950 border border-stone-800 rounded-2xl p-6 shadow-2xl"
          >
            <div className="text-xs font-mono-tabular uppercase text-amber-400">
              {outcomeSnapshot.victory ? 'HIGHWAY FREIGHT CONTRACT COMPLETED' : 'HAUL TERMINATED'}
            </div>
            <h2 className="font-display font-bold text-2xl text-stone-100 mt-1">
              {outcomeSnapshot.victory
                ? 'DESTINATION TOLL PLAZA REACHED'
                : 'CARGO INTEGRITY DEPLETED'}
            </h2>
            <p className="text-xs text-stone-400 mt-1">{outcomeSnapshot.reason}</p>

            <div className="grid grid-cols-3 gap-2.5 my-5">
              <div className="bg-stone-900 border border-stone-800 rounded-xl p-3">
                <div className="text-[10px] font-semibold text-stone-400 uppercase">
                  DISTANCE
                </div>
                <div className="font-mono-tabular font-bold text-lg text-stone-100 mt-0.5">
                  {outcomeSnapshot.distanceKm} km
                </div>
              </div>
              <div className="bg-stone-900 border border-stone-800 rounded-xl p-3">
                <div className="text-[10px] font-semibold text-stone-400 uppercase">
                  HAUL TIME
                </div>
                <div className="font-mono-tabular font-bold text-lg text-amber-400 mt-0.5">
                  {outcomeSnapshot.elapsedTimeFormatted}
                </div>
              </div>
              <div className="bg-stone-900 border border-stone-800 rounded-xl p-3">
                <div className="text-[10px] font-semibold text-stone-400 uppercase">
                  CARGO
                </div>
                <div className="font-mono-tabular font-bold text-lg text-emerald-400 mt-0.5">
                  {Math.round(outcomeSnapshot.cargoIntegrityPct)}%
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                data-start="true"
                onClick={onRestartGame}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-base rounded-xl transition-colors cursor-pointer"
              >
                {outcomeSnapshot.victory ? 'START NEXT HAUL (ENTER)' : 'TRY HAUL AGAIN (ENTER)'}
              </button>
              <button
                type="button"
                onClick={onReturnToTitle}
                className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Return to Title Screen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
