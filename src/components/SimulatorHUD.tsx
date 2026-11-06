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
  isFullscreen: boolean;
  isPortraitMobile: boolean;
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
  onToggleFullscreen: () => void;
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
  keyHint?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}> = ({
  testId,
  ariaLabel,
  title,
  active = false,
  accentColor = 'amber',
  size = 'md',
  keyHint,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  children,
}) => {
  const dims =
    size === 'lg'
      ? 'w-13 h-13 sm:w-14 sm:h-14'
      : size === 'sm'
        ? 'w-10 h-10 sm:w-10.5 sm:h-10.5'
        : 'w-11 h-11 sm:w-12 sm:h-12';

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
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown?.(e);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        onPointerUp?.(e);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        onPointerLeave?.(e);
      }}
      className={`${dims} relative rounded-full p-0 bg-transparent border-0 cursor-pointer select-none transition-transform duration-100 hover:scale-105 active:scale-95 focus:outline-none group shrink-0`}
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

        {/* Optional Engraved Keycap Micro-Badge at bottom of bezel */}
        {keyHint && (
          <g transform="translate(32, 56)">
            <rect
              x="-8"
              y="-5.5"
              width="16"
              height="10"
              rx="3"
              fill="#0c0a09"
              stroke={active ? '#f59e0b' : '#44403c'}
              strokeWidth="1.2"
            />
            <text
              x="0"
              y="1.8"
              textAnchor="middle"
              fill={active ? '#fbbf24' : '#a8a29e'}
              fontFamily="JetBrains Mono, monospace"
              fontWeight="700"
              fontSize="7"
            >
              {keyHint}
            </text>
          </g>
        )}
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
  isFullscreen,
  isPortraitMobile,
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
  onToggleFullscreen,
  onToggleHeadlights,
  onToggleIndicator,
  onToggleTransmission,
  onShiftGear,
  onSetHorn,
  onToggleHudCollapsed,
  onTouchControl,
}) => {
  const blurAndCall = (fn: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
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
      <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-6 md:p-8 overflow-y-auto">
        {/* Portrait Mobile/Tablet Landscape Prompt */}
        {isPortraitMobile && (
          <button
            type="button"
            onClick={blurAndCall(onToggleFullscreen)}
            className="pointer-events-auto self-center mb-2 px-4 py-2 rounded-full bg-amber-500 text-stone-950 font-display font-bold text-xs tracking-wider shadow-xl flex items-center gap-2 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-stone-950 stroke-2">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M7 9l-2 3 2 3M17 9l2 3-2 3" />
            </svg>
            <span>TAP FOR FULLSCREEN LANDSCAPE MODE</span>
          </button>
        )}

        <div className="w-full max-w-[600px] pointer-events-auto bg-stone-950/92 border border-stone-800/95 rounded-2xl p-4 sm:p-6 shadow-2xl">
          {/* Header Row: Bespoke Inline SVG Title Emblem + Fullscreen/Landscape Quick Action */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <svg
              viewBox="0 0 640 112"
              className="w-full max-w-[505px] h-auto"
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
                y="75"
                fill="#fbbf24"
                fontFamily="Chakra Petch, sans-serif"
                fontWeight="600"
                fontSize="18.5"
                letterSpacing="2"
              >
                INDIAN HIGHWAY 3D SIMULATOR
              </text>
              <line
                x1="110"
                y1="88"
                x2="632"
                y2="88"
                stroke="#44403c"
                strokeWidth="2"
              />
              <text
                x="110"
                y="105"
                fill="#d6d3d1"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="600"
                fontSize="11.5"
                letterSpacing="0.4"
              >
                {activeMapSpec.subtitle.toUpperCase()}
              </text>
            </svg>

            <HudMedallionButton
              testId="title-fullscreen-btn"
              ariaLabel={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen & Landscape'}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen & Landscape Mode'}
              active={isFullscreen}
              size="sm"
              onClick={blurAndCall(onToggleFullscreen)}
            >
              {isFullscreen ? (
                <path
                  d="M24 16v8h-8M40 16v8h8M24 48v-8h-8M40 48v-8h8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M18 26v-8h8M46 26v-8h-8M18 38v8h8M46 38v8h-8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </HudMedallionButton>
          </div>

          {/* Pre-Drive Selectors: 3 Trucks, 3 Maps, Graphics & Atmosphere */}
          <div className="space-y-3.5 mb-5">
            {/* R7: 3 Visibly Distinct Indian Heavy Trucks */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-stone-300 mb-1.5">
                <span>1. Heavy Truck Chassis (3 Distinct 3D Rigs)</span>
                <span className="text-[11px] font-mono-tabular text-amber-400">
                  {activeTruckSpec.name} · {activeTruckSpec.grossWeightTonnes}t
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
                      onClick={blurAndCall(() => onSelectTruck(tId))}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        active
                          ? 'bg-amber-500/20 border-amber-400 text-stone-100 shadow-md'
                          : 'bg-stone-900/90 hover:bg-stone-800 border-stone-800 text-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[11.5px] font-bold leading-tight text-amber-400">
                          {spec.shortName}
                        </span>
                        {/* Custom Truck Silhouette SVG */}
                        <svg viewBox="0 0 36 18" className="w-6 h-3.5 shrink-0 fill-current text-amber-400/85">
                          {tId === 'tata_prima_4928' ? (
                            <path d="M2 5h18v8H2V5zm19 2h8l3 3v3h-11V7zM7 15a2 2 0 100-4 2 2 0 000 4zm9 0a2 2 0 100-4 2 2 0 000 4zm11 0a2 2 0 100-4 2 2 0 000 4z" />
                          ) : tId === 'ashok_leyland_3520' ? (
                            <path d="M2 3h20l2 3v7H2V3zm23 3h6l2 4v3h-8V6zM7 15a2 2 0 100-4 2 2 0 000 4zm12 0a2 2 0 100-4 2 2 0 000 4zm9 0a2 2 0 100-4 2 2 0 000 4z" />
                          ) : (
                            <path d="M2 6c2-2 15-2 17 0v7H2V6zm19 1h8l3 2v4H21V7zM7 15a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z" />
                          )}
                        </svg>
                      </div>
                      <div className="text-[10px] text-stone-300 leading-snug">
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
                <span>2. Photorealistic 3D Highway Corridor</span>
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
                      onClick={blurAndCall(() => onSelectMap(mId))}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        active
                          ? 'bg-emerald-500/20 border-emerald-400 text-stone-100 shadow-md'
                          : 'bg-stone-900/90 hover:bg-stone-800 border-stone-800 text-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[11.5px] font-bold leading-tight text-emerald-400">
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
                      <div className="text-[10px] text-stone-300 leading-snug">
                        {mSpec.regionBadge}
                      </div>
                      <div className="text-[10px] font-mono-tabular text-stone-400 mt-1">
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
                  Atmosphere & Sun Angle
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
                      onClick={blurAndCall(() => onCycleTimeOfDay(preset.id))}
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
                      onClick={blurAndCall(() => onToggleGraphicsQuality(tier.id))}
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
            onClick={blurAndCall(onStartGame)}
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
            WASD / Arrows Drive · Space Air Brake · C Camera · L Lights · Q/E Turn Signals · G Auto/Man · H Horn · Esc Garage
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
  // ============================================================================
  const rpmRatio = Math.min(1, Math.max(0, telemetry.rpm / 2500));
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
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 md:p-5 select-none">
      {/* TOP PERIMETER WRAPPER (keeps portrait banner + top bar pinned at the top edge) */}
      <div className="flex flex-col gap-1.5 w-full">
        {/* Portrait Mobile/Tablet One-Tap Landscape Fullscreen Banner */}
        {isPortraitMobile && gameState === 'playing' && (
          <button
            type="button"
            onClick={blurAndCall(onToggleFullscreen)}
            className="pointer-events-auto self-center px-3.5 py-1.5 rounded-full bg-amber-500 text-stone-950 font-display font-bold text-[11px] tracking-wider shadow-xl flex items-center gap-2 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-stone-950 stroke-2">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M7 9l-2 3 2 3M17 9l2 3-2 3" />
            </svg>
            <span>TAP FOR LANDSCAPE FULLSCREEN</span>
          </button>
        )}

        {/* TOP PERIMETER: Custom SVG Indian Milestone Arch Emblem (Left) + Utility & Settings Medallions (Right) */}
        <div className="flex items-start justify-between gap-2 w-full">
          {/* Top-Left: Sleek Cockpit Visor Strip in 1st-Person Cabin View OR Full NHAI Milestone Shield in Exterior Views */}
          {cameraMode === 'cabin' ? (
            <div className="pointer-events-auto relative drop-shadow-xl min-w-0">
              <svg
                viewBox="0 0 336 46"
                className="w-[216px] sm:w-[324px] h-auto overflow-visible"
                role="img"
                aria-label="Cockpit Visor Telemetry Strip"
              >
              <path
                d="M12 3 H320 L332 23 L320 43 H12 C6 43 3 38 3 31 V15 C3 8 6 3 12 3 Z"
                fill="#0c0a09"
                fillOpacity="0.88"
                stroke="#f59e0b"
                strokeWidth="1.6"
              />
              {/* Route Progress Micro-Track along lower visor edge */}
              <line
                x1="14"
                y1="40"
                x2="316"
                y2="40"
                stroke="#292524"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <line
                x1="14"
                y1="40"
                x2={14 + 302 * routeProgressRatio}
                y2="40"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="24" cy="22" r="12" fill="#f5f5f4" stroke="#dc2626" strokeWidth="3.2" />
              <text
                x="24"
                y="26"
                textAnchor="middle"
                fill="#0c0a09"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="800"
                fontSize="11"
              >
                {telemetry.speedLimitKmh}
              </text>
              <text
                x="46"
                y="17"
                fill="#fbbf24"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="700"
                fontSize="9"
              >
                RHD COCKPIT · {telemetry.landmarkKm} · DRAG VIEW
              </text>
            </svg>
            <div
              data-testid="hud-zone-name"
              className="absolute left-[46px] top-[18px] right-4 text-[11px] sm:text-xs font-bold text-stone-100 truncate pointer-events-none"
            >
              {telemetry.zoneName}
            </div>
          </div>
        ) : (
          <div className="pointer-events-auto relative drop-shadow-2xl min-w-0">
            <svg
              viewBox="0 0 356 78"
              className="w-[220px] sm:w-[346px] h-auto overflow-visible"
              role="img"
              aria-label="Highway Milestone and Waypoint Gauge"
            >
              {/* Outer Sculpted Highway Milestone Shield */}
              <path
                d="M14 4 H332 L350 22 V58 L334 74 H14 C7 74 4 68 4 60 V18 C4 10 7 4 14 4 Z"
                fill="#0c0a09"
                fillOpacity="0.92"
                stroke="#44403c"
                strokeWidth="2"
              />
              {/* Yellow NHAI Milestone Top Crown Accent */}
              <path d="M14 4 H332 L342 14 H6 L14 4 Z" fill="#f59e0b" />
              {/* Route Progress Glow Track along bottom edge */}
              <line
                x1="16"
                y1="69"
                x2="330"
                y2="69"
                stroke="#292524"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <line
                x1="16"
                y1="69"
                x2={16 + 314 * routeProgressRatio}
                y2="69"
                stroke="#10b981"
                strokeWidth="4"
                strokeLinecap="round"
              />

              {/* Indian Circular Speed Limit Sign Roundel */}
              <circle
                cx="36"
                cy="41"
                r="19"
                fill="#f5f5f4"
                stroke="#dc2626"
                strokeWidth="4.5"
              />
              <text
                x="36"
                y="46"
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
                y="60"
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
              className="absolute left-[46px] sm:left-[66px] top-[20px] sm:top-[30px] right-3 text-[11px] sm:text-[13px] font-bold text-stone-100 truncate pointer-events-none"
            >
              {telemetry.zoneName}
            </div>
          </div>
        )}

        {/* Top-Right: Fullscreen/Landscape Medallion + HUD Toggle Medallion + Settings Gear Medallion */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Fullscreen & Landscape Lock Medallion */}
          <HudMedallionButton
            testId="fullscreen-btn"
            ariaLabel={
              isFullscreen
                ? 'Exit Fullscreen Mode'
                : 'Enter Fullscreen & Lock Landscape Orientation'
            }
            title={
              isFullscreen
                ? 'Exit Fullscreen'
                : 'Fullscreen & Landscape Mode (Tablets / Mobile)'
            }
            active={isFullscreen}
            size="sm"
            onClick={blurAndCall(onToggleFullscreen)}
          >
            {isFullscreen ? (
              <path
                d="M24 16v8h-8M40 16v8h8M24 48v-8h-8M40 48v-8h8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <path
                d="M18 26v-8h8M46 26v-8h-8M18 38v8h8M46 38v8h-8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </HudMedallionButton>

          {/* HUD Visibility Toggle Medallion */}
          <HudMedallionButton
            ariaLabel={
              hudCollapsed ? 'Show Cockpit Instruments [U]' : 'Hide Cockpit Instruments [U]'
            }
            title={hudCollapsed ? 'Show Instruments [U]' : 'Hide Instruments [U]'}
            active={!hudCollapsed}
            size="sm"
            keyHint="U"
            onClick={blurAndCall(onToggleHudCollapsed)}
          >
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
            keyHint="ESC"
            onClick={blurAndCall(gameState === 'paused' ? onResumeGame : onPauseGame)}
          >
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
              onPointerDown={(e) => {
                e.stopPropagation();
                onTouchControl('brake', true);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                onTouchControl('brake', false);
              }}
              onPointerLeave={(e) => {
                e.stopPropagation();
                onTouchControl('brake', false);
              }}
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
              onPointerDown={(e) => {
                e.stopPropagation();
                onTouchControl('throttle', true);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                onTouchControl('throttle', false);
              }}
              onPointerLeave={(e) => {
                e.stopPropagation();
                onTouchControl('throttle', false);
              }}
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

      {/* BOTTOM INSTRUMENT CLUSTER:
          - In 1st-Person Cabin View: Speedometer, Tachometer, Digital DID & Radar live directly on the 3D Dashboard!
            Bottom-left stays 100% open so the 3D Radar & Cockpit Console are unobstructed, while all tactile medallions
            sit cleanly docked in a unified bottom-right control bar.
          - In Chase / Orbit Views: Bottom-left displays the circular SVG Tachometer/Speedometer Pod with outer satellite medallions,
            and Bottom-right displays Camera & Auxiliary medallions. */}
      {!hudCollapsed && (
        <div
          className={`flex items-end ${
            cameraMode === 'cabin' ? 'justify-end' : 'justify-between'
          } gap-4 w-full`}
        >
          {cameraMode !== 'cabin' && (
            /* Bottom-Left (Exterior Chase / Orbit Views): Custom Circular SVG Analog/Digital Tachometer & Speedometer Pod */
            <div className="pointer-events-auto relative w-[244px] h-[212px] shrink-0 drop-shadow-2xl">
              <svg
                viewBox="0 0 256 220"
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
                  cx="128"
                  cy="112"
                  r="88"
                  fill="url(#dialFaceGrad)"
                  stroke="#44403c"
                  strokeWidth="4"
                />
                {/* Chrome Inner Bezel Ring */}
                <circle
                  cx="128"
                  cy="112"
                  r="81"
                  fill="none"
                  stroke="#78716c"
                  strokeWidth="1.2"
                  strokeDasharray="6 3"
                />

                {/* Economy Diesel Green Band Arc */}
                <path
                  d="M 63 82 A 72 72 0 0 1 193 82"
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
                  const x1 = 128 + Math.cos(rad) * rInner;
                  const y1 = 112 + Math.sin(rad) * rInner;
                  const x2 = 128 + Math.cos(rad) * rOuter;
                  const y2 = 112 + Math.sin(rad) * rOuter;
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
                <g transform={`translate(128, 112) rotate(${rpmNeedleAngleDeg})`}>
                  <polygon points="-2.5,12 0,-70 2.5,12" fill="#f59e0b" />
                  <circle cx="0" cy="0" r="8" fill="#292524" stroke="#f59e0b" strokeWidth="2" />
                </g>

                {/* Center Digital Cockpit Readout Window */}
                <circle
                  cx="128"
                  cy="115"
                  r="44"
                  fill="#090807"
                  stroke="#292524"
                  strokeWidth="2.5"
                />

                {/* Hero Digital Speed Numeral */}
                <text
                  x="128"
                  y="114"
                  textAnchor="middle"
                  fill="#f5f5f4"
                  fontFamily="Chakra Petch, sans-serif"
                  fontWeight="700"
                  fontSize="36"
                >
                  {Math.round(telemetry.speedKmh)}
                </text>
                <text
                  x="128"
                  y="128"
                  textAnchor="middle"
                  fill="#a8a29e"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="700"
                  fontSize="8.5"
                  letterSpacing="1.2"
                >
                  KM/H · {Math.round(telemetry.rpm)} RPM
                </text>

                {/* Lower Sub-Dial Status Pill: Fuel & Cargo Integrity Bars */}
                <g transform="translate(90, 168)">
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

              {/* Satellite Turn-Signal Wing Medallions & Gear Shifter Roundels mounted cleanly on outer bezel */}
              <button
                type="button"
                tabIndex={-1}
                data-testid="ind-left-btn"
                aria-label="Left Turn Indicator [Q]"
                title="Left Turn Signal [Q]"
                onClick={blurAndCall(() =>
                  onToggleIndicator(telemetry.indicator === 'left' ? 'off' : 'left')
                )}
                className="absolute left-0.5 top-2 w-10.5 h-10.5 rounded-full bg-transparent border-0 p-0 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
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

              <button
                type="button"
                tabIndex={-1}
                data-testid="ind-right-btn"
                aria-label="Right Turn Indicator [E]"
                title="Right Turn Signal [E]"
                onClick={blurAndCall(() =>
                  onToggleIndicator(telemetry.indicator === 'right' ? 'off' : 'right')
                )}
                className="absolute right-0.5 top-2 w-10.5 h-10.5 rounded-full bg-transparent border-0 p-0 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
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
                title={`12-Speed Gearbox (${telemetry.transmissionMode.toUpperCase()}) — Click to toggle Auto/Manual [G]`}
                className="absolute left-1/2 -translate-x-1/2 top-[124px] w-14 h-8.5 bg-transparent border-0 p-0 cursor-pointer hover:scale-105 transition-transform"
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
                title="Shift Gear Down [Ctrl]"
                onClick={blurAndCall(() => onShiftGear(-1))}
                className="absolute left-2 bottom-2.5 w-9 h-9 rounded-full bg-transparent border-0 p-0 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
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
                title="Shift Gear Up [Shift]"
                onClick={blurAndCall(() => onShiftGear(1))}
                className="absolute right-2 bottom-2.5 w-9 h-9 rounded-full bg-transparent border-0 p-0 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
              >
                <svg viewBox="0 0 36 36" className="w-full h-full drop-shadow-md">
                  <circle cx="18" cy="18" r="16" fill="#141210" stroke="#57534e" strokeWidth="2" />
                  <path d="M12 18 H24 M18 12 V24" stroke="#e7e5e4" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}

          {/* Bottom-Right: Unified Tactile Medallion Control Dock */}
          <div
            className="pointer-events-auto flex flex-wrap items-center justify-end gap-2 sm:gap-2.5 pb-0.5"
            role="group"
            aria-label={`Cockpit Controls — Speed ${Math.round(telemetry.speedKmh)} km/h, Gear ${telemetry.gearLabel}`}
          >
            {/* In 1st-Person Cabin View, include Turn Signals & Gearbox Shifter right alongside Camera/Horn medallions */}
            {cameraMode === 'cabin' && (
              <>
                <HudMedallionButton
                  testId="ind-left-btn"
                  ariaLabel="Left Turn Indicator [Q]"
                  title="Left Turn Signal [Q]"
                  active={leftSignalOn}
                  size="sm"
                  keyHint="Q"
                  onClick={blurAndCall(() =>
                    onToggleIndicator(telemetry.indicator === 'left' ? 'off' : 'left')
                  )}
                >
                  <path
                    d="M36 18 L20 32 L36 46 M22 32 H46"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </HudMedallionButton>

                <HudMedallionButton
                  ariaLabel="Shift Gear Down"
                  title="Shift Gear Down [Ctrl]"
                  size="sm"
                  keyHint="-"
                  onClick={blurAndCall(() => onShiftGear(-1))}
                >
                  <line
                    x1="20"
                    y1="32"
                    x2="44"
                    y2="32"
                    stroke="currentColor"
                    strokeWidth="4.2"
                    strokeLinecap="round"
                  />
                </HudMedallionButton>

                <HudMedallionButton
                  ariaLabel={`Gear ${telemetry.gearLabel} (${telemetry.transmissionMode}) — Toggle Auto/Manual [G]`}
                  title="Toggle Auto / Manual 12-Speed Splitter Gearbox [G]"
                  active={telemetry.transmissionMode === 'manual'}
                  size="md"
                  keyHint="G"
                  onClick={blurAndCall(() => onToggleTransmission())}
                >
                  <text
                    x="32"
                    y="30"
                    textAnchor="middle"
                    fill="#fbbf24"
                    fontFamily="Chakra Petch, sans-serif"
                    fontWeight="800"
                    fontSize="15.5"
                  >
                    {telemetry.gearLabel}
                  </text>
                  <text
                    x="32"
                    y="43"
                    textAnchor="middle"
                    fill="#a8a29e"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="700"
                    fontSize="8"
                  >
                    {telemetry.transmissionMode === 'auto' ? 'AUTO' : 'MAN'}
                  </text>
                </HudMedallionButton>

                <HudMedallionButton
                  ariaLabel="Shift Gear Up"
                  title="Shift Gear Up [Shift]"
                  size="sm"
                  keyHint="+"
                  onClick={blurAndCall(() => onShiftGear(1))}
                >
                  <path
                    d="M20 32 H44 M32 20 V44"
                    stroke="currentColor"
                    strokeWidth="4.2"
                    strokeLinecap="round"
                  />
                </HudMedallionButton>

                <HudMedallionButton
                  testId="ind-right-btn"
                  ariaLabel="Right Turn Indicator [E]"
                  title="Right Turn Signal [E]"
                  active={rightSignalOn}
                  size="sm"
                  keyHint="E"
                  onClick={blurAndCall(() =>
                    onToggleIndicator(telemetry.indicator === 'right' ? 'off' : 'right')
                  )}
                >
                  <path
                    d="M28 18 L44 32 L28 46 M42 32 H18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </HudMedallionButton>

                {/* Sculpted Vertical Divider */}
                <svg viewBox="0 0 6 36" className="w-1.5 h-8 hidden sm:block">
                  <line x1="3" y1="4" x2="3" y2="32" stroke="#44403c" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </>
            )}

            {/* 1. Cabin 1st-Person Cockpit View Medallion */}
            <HudMedallionButton
              testId="cam-btn-cabin"
              ariaLabel="1st-Person Cabin Cockpit View [C]"
              title="1st-Person RHD Cabin Cockpit Camera [C]"
              active={cameraMode === 'cabin'}
              keyHint="C"
              onClick={blurAndCall(() => onCycleCamera('cabin'))}
            >
              <circle cx="32" cy="31" r="13" fill="none" stroke="currentColor" strokeWidth="3" />
              <circle cx="32" cy="31" r="4" fill="currentColor" />
              <line x1="19" y1="29" x2="28" y2="31" stroke="currentColor" strokeWidth="2.6" />
              <line x1="45" y1="29" x2="36" y2="31" stroke="currentColor" strokeWidth="2.6" />
              <line x1="32" y1="35" x2="32" y2="44" stroke="currentColor" strokeWidth="2.6" />
            </HudMedallionButton>

            {/* 2. 3rd-Person Chase View Medallion */}
            <HudMedallionButton
              testId="cam-btn-chase"
              ariaLabel="3rd-Person Highway Chase Camera [C]"
              title="3rd-Person Highway Chase Camera [C]"
              active={cameraMode === 'chase'}
              onClick={blurAndCall(() => onCycleCamera('chase'))}
            >
              <path d="M15 45 L23 33 M49 45 L41 33" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
              <rect x="22" y="17" width="20" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2.6" />
              <rect x="25" y="20" width="14" height="6" rx="1" fill="currentColor" fillOpacity="0.35" />
              <line x1="24" y1="32" x2="24" y2="37" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
              <line x1="40" y1="32" x2="40" y2="37" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
            </HudMedallionButton>

            {/* 3. 360° Orbit Inspection Camera Medallion */}
            <HudMedallionButton
              testId="cam-btn-orbit"
              ariaLabel="360-Degree Orbit Camera [C]"
              title="360° Cinematic Orbit Camera [C]"
              active={cameraMode === 'orbit'}
              onClick={blurAndCall(() => onCycleCamera('orbit'))}
            >
              <ellipse
                cx="32"
                cy="31"
                rx="16"
                ry="8"
                transform="rotate(-22 32 31)"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              />
              <circle cx="32" cy="31" r="4.5" fill="#fbbf24" />
              <polygon points="45,21 49,26 42,27" fill="currentColor" />
            </HudMedallionButton>

            {/* 4. Parabolic Headlamp High-Beam Medallion */}
            <HudMedallionButton
              testId="headlight-btn"
              ariaLabel="Toggle High-Beam Headlights [L]"
              title="Toggle High-Beam Headlights [L]"
              active={telemetry.headlightsOn}
              keyHint="L"
              onClick={blurAndCall(onToggleHeadlights)}
            >
              <path
                d="M28 19 C19 19 16 24 16 31 C16 38 19 43 28 43 Z"
                fill={telemetry.headlightsOn ? '#fbbf24' : 'none'}
                stroke="currentColor"
                strokeWidth="2.6"
              />
              <line x1="33" y1="21" x2="46" y2="17" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
              <line x1="34" y1="28" x2="48" y2="28" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
              <line x1="34" y1="34" x2="48" y2="34" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
              <line x1="33" y1="41" x2="46" y2="45" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            </HudMedallionButton>

            {/* 5. Twin Chrome Pneumatic Air-Horn Trumpet Medallion */}
            <HudMedallionButton
              testId="horn-btn"
              ariaLabel="Sound Musical Pressure Horn [H]"
              title="Sound Indian Truck Musical Air Horn [H]"
              active={telemetry.hornActive}
              size="lg"
              keyHint="H"
              onPointerDown={() => onSetHorn(true)}
              onPointerUp={() => onSetHorn(false)}
              onPointerLeave={() => onSetHorn(false)}
            >
              <path
                d="M16 28 H26 L38 19 V43 L26 34 H16 Z"
                fill={telemetry.hornActive ? '#fbbf24' : 'none'}
                stroke="#fbbf24"
                strokeWidth="2.6"
                strokeLinejoin="round"
              />
              <path
                d="M43 23 C47 27 47 35 43 39 M47 18 C53 25 53 37 47 44"
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
                onClick={blurAndCall(onResumeGame)}
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
                      onClick={blurAndCall(() => onSelectTruck(tId))}
                      className={`p-2.5 rounded-xl text-left border transition-colors cursor-pointer ${
                        active
                          ? 'bg-amber-500/20 border-amber-400 text-stone-100'
                          : 'bg-stone-900 hover:bg-stone-800 border-stone-800 text-stone-300'
                      }`}
                    >
                      <div className="text-xs font-bold text-amber-400">
                        {spec.shortName}
                      </div>
                      <div className="text-[10px] text-stone-400 mt-0.5">
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
                      onClick={blurAndCall(() => onSelectMap(mId))}
                      className={`p-2.5 rounded-xl text-left border transition-colors cursor-pointer ${
                        active
                          ? 'bg-emerald-500/20 border-emerald-400 text-stone-100'
                          : 'bg-stone-900 hover:bg-stone-800 border-stone-800 text-stone-300'
                      }`}
                    >
                      <div className="text-xs font-bold text-emerald-400">
                        {mSpec.shortTitle}
                      </div>
                      <div className="text-[10px] text-stone-400 mt-0.5">
                        {mSpec.regionBadge}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Graphics Quality, Lighting, Fullscreen & Audio Settings */}
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
                      onClick={blurAndCall(() => onToggleGraphicsQuality(tier.id))}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                        onClick={blurAndCall(() => onCycleTimeOfDay(tod.id))}
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
                    Display, Audio & Gearbox
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={blurAndCall(onToggleFullscreen)}
                      className={`py-1.5 px-1.5 rounded-lg font-semibold border transition-colors cursor-pointer ${
                        isFullscreen
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-stone-900 border-stone-700 text-stone-300'
                      }`}
                    >
                      {isFullscreen ? 'Windowed' : 'Fullscreen'}
                    </button>
                    <button
                      type="button"
                      onClick={blurAndCall(onToggleMute)}
                      className={`py-1.5 px-1.5 rounded-lg font-semibold border transition-colors cursor-pointer ${
                        !isMuted
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-stone-900 border-stone-700 text-stone-400'
                      }`}
                    >
                      {isMuted ? 'Muted' : 'Audio On'}
                    </button>
                    <button
                      type="button"
                      onClick={blurAndCall(() => onToggleTransmission())}
                      className="py-1.5 px-1.5 rounded-lg font-semibold bg-stone-900 hover:bg-stone-800 border border-stone-700 text-amber-400 uppercase cursor-pointer"
                    >
                      {telemetry.transmissionMode}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                data-testid="resume-haul-btn"
                onClick={blurAndCall(onResumeGame)}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-base rounded-xl transition-colors cursor-pointer"
              >
                RESUME HAUL (ESC)
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={blurAndCall(onRestartGame)}
                  className="py-2.5 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Restart Corridor
                </button>
                <button
                  type="button"
                  onClick={blurAndCall(onReturnToTitle)}
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
                onClick={blurAndCall(onRestartGame)}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-base rounded-xl transition-colors cursor-pointer"
              >
                {outcomeSnapshot.victory ? 'START NEXT HAUL (ENTER)' : 'TRY HAUL AGAIN (ENTER)'}
              </button>
              <button
                type="button"
                onClick={blurAndCall(onReturnToTitle)}
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
