import React from 'react';
import { IndicatorState, TransmissionMode, TruckPhysicsState } from '../physics/vehiclePhysics';
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
  cameraMode: CameraViewMode;
  timeOfDay: TimeOfDayPreset;
  graphicsQuality: GraphicsQuality;
  isMuted: boolean;
  hudCollapsed: boolean;
  isTouchDevice: boolean;
  geospatialStatus: GeospatialStatus;
  outcomeSnapshot: RunOutcomeSnapshot | null;
  onStartGame: () => void;
  onResumeGame: () => void;
  onPauseGame: () => void;
  onRestartGame: () => void;
  onReturnToTitle: () => void;
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

export const SimulatorHUD: React.FC<SimulatorHUDProps> = ({
  gameState,
  telemetry,
  cameraMode,
  timeOfDay,
  graphicsQuality,
  isMuted,
  hudCollapsed,
  isTouchDevice,
  geospatialStatus,
  outcomeSnapshot,
  onStartGame,
  onResumeGame,
  onPauseGame,
  onRestartGame,
  onReturnToTitle,
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

  // ============================================================================
  // 1. TITLE SCREEN OVERLAY (Live 3D World Camera Tour in background)
  // ============================================================================
  if (gameState === 'title') {
    return (
      <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 md:p-12">
        {/* Asymmetric Left-Third Hero Lockup over calm negative space */}
        <div className="max-w-xl pointer-events-auto bg-stone-950/88 border border-stone-800/90 rounded-xl p-6 md:p-8 shadow-2xl">
          {/* Bespoke Inline SVG Title Emblem */}
          <div className="mb-5">
            <svg
              viewBox="0 0 540 118"
              className="w-full max-w-[480px] h-auto"
              role="img"
              aria-label="Grand Trunk NH-44 Heavy Haul 3D Simulator"
            >
              {/* Highway Shield Plaque */}
              <rect
                x="2"
                y="6"
                width="96"
                height="104"
                rx="10"
                fill="#f59e0b"
                stroke="#1c1917"
                strokeWidth="4"
              />
              <rect
                x="9"
                y="13"
                width="82"
                height="90"
                rx="6"
                fill="none"
                stroke="#1c1917"
                strokeWidth="2.5"
              />
              <text
                x="50"
                y="39"
                textAnchor="middle"
                fill="#1c1917"
                fontFamily="Plus Jakarta Sans, sans-serif"
                fontWeight="800"
                fontSize="14.5"
                letterSpacing="1"
              >
                IND · NH
              </text>
              <text
                x="50"
                y="88"
                textAnchor="middle"
                fill="#1c1917"
                fontFamily="Chakra Petch, sans-serif"
                fontWeight="700"
                fontSize="50"
              >
                44
              </text>

              {/* Main Display Lockup */}
              <text
                x="114"
                y="48"
                fill="#f5f5f4"
                fontFamily="Chakra Petch, sans-serif"
                fontWeight="700"
                fontSize="42"
                letterSpacing="1.5"
              >
                GRAND TRUNK
              </text>
              <text
                x="114"
                y="81"
                fill="#fbbf24"
                fontFamily="Chakra Petch, sans-serif"
                fontWeight="600"
                fontSize="21"
                letterSpacing="2.5"
              >
                HEAVY HAUL 3D SIMULATOR
              </text>
              <line
                x1="114"
                y1="95"
                x2="532"
                y2="95"
                stroke="#44403c"
                strokeWidth="2"
              />
              <text
                x="114"
                y="112"
                fill="#a8a29e"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="600"
                fontSize="11"
                letterSpacing="0.4"
              >
                AMBALA CANTT → SHAHBAD ROB → PIPLI → KARNAL TOLL (5.0 KM)
              </text>
            </svg>
          </div>

          {/* Pre-Drive Configuration Selectors */}
          <div className="space-y-4 mb-6">
            <div>
              <div className="text-xs font-semibold text-stone-400 mb-1.5">
                Lighting & Atmosphere
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'golden', label: 'Golden Hour' },
                    { id: 'day', label: 'High Noon' },
                    { id: 'night', label: 'Dusk / Night' },
                  ] as const
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onCycleTimeOfDay(preset.id)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      timeOfDay === preset.id
                        ? 'bg-amber-500 text-stone-950 shadow-sm'
                        : 'bg-stone-900 text-stone-300 hover:bg-stone-800 border border-stone-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-stone-400 mb-1.5">
                Graphics Quality Preset (Pixel-Perfect 3D · 60 FPS Optimised)
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    { id: 'low', label: 'Low (Default)' },
                    { id: 'medium', label: 'Medium' },
                    { id: 'high', label: 'High' },
                    { id: 'ultra', label: 'Ultra 4K' },
                  ] as const
                ).map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    data-testid={`gfx-btn-${tier.id}`}
                    onClick={() => onToggleGraphicsQuality(tier.id)}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      graphicsQuality === tier.id
                        ? 'bg-amber-500 text-stone-950 shadow-sm'
                        : 'bg-stone-900 text-stone-300 hover:bg-stone-800 border border-stone-800'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-stone-400 mb-1.5">
                12-Speed Gearbox Mode
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onToggleTransmission('auto')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    telemetry.transmissionMode === 'auto'
                      ? 'bg-amber-500 text-stone-950 shadow-sm'
                      : 'bg-stone-900 text-stone-300 hover:bg-stone-800 border border-stone-800'
                  }`}
                >
                  OptiCruise Automatic
                </button>
                <button
                  type="button"
                  onClick={() => onToggleTransmission('manual')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    telemetry.transmissionMode === 'manual'
                      ? 'bg-amber-500 text-stone-950 shadow-sm'
                      : 'bg-stone-900 text-stone-300 hover:bg-stone-800 border border-stone-800'
                  }`}
                >
                  12-Speed Sequential Manual
                </button>
              </div>
            </div>
          </div>

          {/* Primary Start CTA */}
          <button
            type="button"
            data-start="true"
            onClick={onStartGame}
            className="w-full py-3.5 px-6 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-display font-bold text-lg tracking-wider rounded-lg shadow-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            START HEAVY HAUL (ENTER)
          </button>

          {/* Corridor & Geospatial Attribution line */}
          <div className="mt-4 pt-3 border-t border-stone-800/80 flex items-center justify-between text-[11px] text-stone-400">
            <span>32t 6x4 Articulated Container Rig · Left-Hand Traffic</span>
            <span>RHD Cabin + Chase Cam</span>
          </div>
        </div>

        {/* Single Flat Control-Hint Line in Bottom Safe Margin */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-stone-300 hud-stroke px-2">
          <span>
            WASD / Arrows Drive · Space Air Brake · C Camera · L Headlights · Q/E Indicators · H Horn · Esc Pause
          </span>
          <span className="text-stone-400 text-[11px]">
            {geospatialStatus.dataAttribution}
          </span>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 2. PLAYING HUD + PAUSE / OUTCOME MODALS
  // ============================================================================
  const rpmPct = Math.min(100, Math.max(0, (telemetry.rpm / 2500) * 100));
  const fuelPct = Math.round((telemetry.fuelLiters / telemetry.fuelMaxLiters) * 100);
  const progressPct = Math.min(
    100,
    Math.max(0, Math.round((telemetry.distanceAlongHighwayM / 4350) * 100))
  );

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 md:p-5">
      {/* TOP PERIMETER BAR: Top-Left NH-44 Route Cluster + Top-Right Utility Controls */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: NHAI Route & Waypoint Cluster */}
        <div className="pointer-events-auto bg-stone-950/88 border border-stone-800 rounded-lg px-3.5 py-2.5 shadow-lg max-w-xs sm:max-w-md">
          <div className="flex items-center gap-2.5">
            {/* Speed Limit Roundel */}
            <div
              className="w-9 h-9 rounded-full bg-stone-100 border-[3px] border-red-600 flex items-center justify-center shrink-0"
              title="Posted Highway Speed Limit"
            >
              <span className="font-mono-tabular font-bold text-xs text-stone-950">
                {telemetry.speedLimitKmh}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-mono-tabular text-amber-400">
                <span>{telemetry.landmarkKm}</span>
                <span aria-hidden="true">·</span>
                <span>LHT KEEP LEFT</span>
              </div>
              <div className="text-sm font-semibold text-stone-100 truncate">
                {telemetry.zoneName}
              </div>
              <div className="text-xs text-stone-400 font-mono-tabular truncate">
                Next: {telemetry.nextWaypointName} ({telemetry.nextWaypointDistanceM} m)
              </div>
            </div>
          </div>

          {/* Route Progress Bar toward Karnal Toll Plaza */}
          <div className="mt-2 w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-transform duration-150 origin-left"
              style={{ transform: `scaleX(${progressPct / 100})` }}
            />
          </div>
        </div>

        {/* Top-Right: Compact Square SVG Utility Buttons */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            tabIndex={-1}
            data-testid="hud-gfx-cycle-btn"
            aria-label={`Cycle Graphics Quality (Current: ${graphicsQuality})`}
            onClick={blurAndCall(() => onToggleGraphicsQuality())}
            className="h-10 px-2.5 bg-stone-950/88 hover:bg-stone-900 border border-stone-800 rounded-lg flex items-center gap-1.5 text-xs font-semibold text-stone-200 transition-colors cursor-pointer whitespace-nowrap"
            title="Cycle Graphics Quality Preset [F] (Low / Med / High / Ultra 4K)"
          >
            <span className="text-[10px] text-stone-400 font-mono-tabular">GFX</span>
            <span className="uppercase text-amber-400 font-mono-tabular">
              {graphicsQuality === 'medium'
                ? 'MED'
                : graphicsQuality === 'ultra'
                  ? 'ULTRA 4K'
                  : graphicsQuality}
            </span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label={`Switch Camera View (Current: ${cameraMode})`}
            onClick={blurAndCall(() => onCycleCamera())}
            className="h-10 px-3 bg-stone-950/88 hover:bg-stone-900 border border-stone-800 rounded-lg flex items-center gap-1.5 text-xs font-semibold text-stone-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-amber-400 stroke-2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span className="hidden sm:inline uppercase">{cameraMode}</span>
            <span className="text-[10px] text-stone-400 font-mono-tabular">[C]</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label={`Toggle Headlights (Current: ${telemetry.headlightsOn ? 'On' : 'Off'})`}
            onClick={blurAndCall(onToggleHeadlights)}
            className={`w-10 h-10 border rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              telemetry.headlightsOn
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-stone-950/88 hover:bg-stone-900 border-stone-800 text-stone-300'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
              <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
              <path d="M9 21h6" />
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label={`Cycle Time of Day (Current: ${timeOfDay})`}
            onClick={blurAndCall(() => onCycleTimeOfDay())}
            className="w-10 h-10 bg-stone-950/88 hover:bg-stone-900 border border-stone-800 rounded-lg flex items-center justify-center text-stone-200 transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-amber-400 stroke-2">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2" />
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label={isMuted ? 'Unmute Audio [M]' : 'Mute Audio [M]'}
            onClick={blurAndCall(onToggleMute)}
            className="w-10 h-10 bg-stone-950/88 hover:bg-stone-900 border border-stone-800 rounded-lg flex items-center justify-center text-stone-200 transition-colors cursor-pointer"
          >
            {isMuted ? (
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-red-400 stroke-2">
                <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-emerald-400 stroke-2">
                <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Restart Haul [R]"
            onClick={blurAndCall(onRestartGame)}
            className="w-10 h-10 bg-stone-950/88 hover:bg-stone-900 border border-stone-800 rounded-lg flex items-center justify-center text-stone-200 transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Pause Simulator [P]"
            onClick={blurAndCall(onPauseGame)}
            className="w-10 h-10 bg-stone-950/88 hover:bg-stone-900 border border-stone-800 rounded-lg flex items-center justify-center text-stone-200 transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Warning Banner for Trailer Jackknife or Off-Road Shoulder */}
      {telemetry.jackknifeWarning && (
        <div className="self-center bg-red-950/90 border border-red-500 text-red-200 px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide">
          WARNING: HIGH TRAILER ARTICULATION ANGLE — COUNTER-STEER SMOOTHLY
        </div>
      )}

      {/* MOBILE TOUCH DRIVING CONTROLS (Visible only on touch devices during gameplay) */}
      {isTouchDevice && gameState === 'playing' && (
        <div className="flex items-end justify-between w-full px-2 pb-20 pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            <button
              type="button"
              aria-label="Steer Left"
              onPointerDown={() => onTouchControl('left', true)}
              onPointerUp={() => onTouchControl('left', false)}
              onPointerLeave={() => onTouchControl('left', false)}
              className="w-16 h-16 bg-stone-950/85 border border-stone-700 rounded-xl flex items-center justify-center text-stone-100 active:bg-amber-500 active:text-stone-950"
            >
              ◀
            </button>
            <button
              type="button"
              aria-label="Steer Right"
              onPointerDown={() => onTouchControl('right', true)}
              onPointerUp={() => onTouchControl('right', false)}
              onPointerLeave={() => onTouchControl('right', false)}
              className="w-16 h-16 bg-stone-950/85 border border-stone-700 rounded-xl flex items-center justify-center text-stone-100 active:bg-amber-500 active:text-stone-950"
            >
              ▶
            </button>
          </div>

          <div className="flex items-center gap-3 pointer-events-auto">
            <button
              type="button"
              aria-label="Air Brake Pedal"
              onPointerDown={() => onTouchControl('brake', true)}
              onPointerUp={() => onTouchControl('brake', false)}
              onPointerLeave={() => onTouchControl('brake', false)}
              className="w-16 h-20 bg-red-950/85 border border-red-700 rounded-xl flex items-center justify-center text-xs font-bold text-red-200 active:bg-red-600"
            >
              BRAKE
            </button>
            <button
              type="button"
              aria-label="Throttle Accelerator Pedal"
              onPointerDown={() => onTouchControl('throttle', true)}
              onPointerUp={() => onTouchControl('throttle', false)}
              onPointerLeave={() => onTouchControl('throttle', false)}
              className="w-16 h-24 bg-emerald-950/85 border border-emerald-700 rounded-xl flex items-center justify-center text-xs font-bold text-emerald-200 active:bg-emerald-500 active:text-stone-950"
            >
              DRIVE
            </button>
          </div>
        </div>
      )}

      {/* UNIFIED COLLAPSIBLE BOTTOM CONTROL & TELEMETRY DOCK */}
      <div className="self-center w-full max-w-[920px] flex flex-col items-center">
        {/* Collapse / Expand Cinema Mode Toggle */}
        <button
          type="button"
          tabIndex={-1}
          onClick={blurAndCall(onToggleHudCollapsed)}
          className="pointer-events-auto mb-1 px-3 py-1 bg-stone-950/90 hover:bg-stone-900 border border-stone-800 rounded-t-lg text-[11px] font-medium text-stone-300 transition-colors cursor-pointer whitespace-nowrap"
        >
          {hudCollapsed ? '▴ Show Telemetry Dock [U]' : '▾ Hide Controls [U]'}
        </button>

        {!hudCollapsed && (
          <div className="pointer-events-auto w-full bg-stone-950/92 border border-stone-800 rounded-xl px-4 py-3 shadow-2xl flex flex-wrap md:flex-nowrap items-center justify-between gap-4">
            {/* Left Cluster: Turn Indicators + Hero Speed Readout + 12-Speed Gear */}
            <div className="flex items-center gap-3.5 shrink-0">
              {/* Left Indicator Button */}
              <button
                type="button"
                tabIndex={-1}
                aria-label="Left Turn Indicator [Q]"
                onClick={blurAndCall(() =>
                  onToggleIndicator(telemetry.indicator === 'left' ? 'off' : 'left')
                )}
                className={`w-9 h-9 rounded-lg border flex items-center justify-center font-bold transition-colors cursor-pointer ${
                  telemetry.indicatorBlinkOn &&
                  (telemetry.indicator === 'left' || telemetry.indicator === 'hazard')
                    ? 'bg-amber-500 border-amber-400 text-stone-950'
                    : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                ←
              </button>

              {/* Speedometer Hero Numeral (~3:1 scale vs Kicker) */}
              <div className="text-right min-w-[78px]">
                <div className="font-display font-bold text-3xl md:text-4xl leading-none text-stone-100 font-mono-tabular">
                  {Math.round(telemetry.speedKmh)}
                </div>
                <div className="text-[10px] font-semibold tracking-wider text-stone-400 uppercase mt-0.5">
                  SPEED KM/H
                </div>
              </div>

              {/* 12-Speed Gear Indicator + Manual Shift Controls */}
              <div className="flex items-center gap-1.5 bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1.5">
                <div>
                  <div className="font-mono-tabular font-bold text-xl leading-none text-amber-400">
                    {telemetry.gearLabel}
                  </div>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={blurAndCall(() => onToggleTransmission())}
                    className="text-[10px] font-semibold text-stone-400 hover:text-stone-200 uppercase cursor-pointer"
                    title="Click to toggle Auto / Manual transmission"
                  >
                    {telemetry.transmissionMode}
                  </button>
                </div>
                <div className="flex flex-col gap-0.5 ml-1">
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Shift Gear Up"
                    onClick={blurAndCall(() => onShiftGear(1))}
                    className="px-1.5 py-0.5 bg-stone-800 hover:bg-stone-700 rounded text-[10px] font-mono-tabular text-stone-200 cursor-pointer"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Shift Gear Down"
                    onClick={blurAndCall(() => onShiftGear(-1))}
                    className="px-1.5 py-0.5 bg-stone-800 hover:bg-stone-700 rounded text-[10px] font-mono-tabular text-stone-200 cursor-pointer"
                  >
                    −
                  </button>
                </div>
              </div>

              {/* Right Indicator Button */}
              <button
                type="button"
                tabIndex={-1}
                aria-label="Right Turn Indicator [E]"
                onClick={blurAndCall(() =>
                  onToggleIndicator(telemetry.indicator === 'right' ? 'off' : 'right')
                )}
                className={`w-9 h-9 rounded-lg border flex items-center justify-center font-bold transition-colors cursor-pointer ${
                  telemetry.indicatorBlinkOn &&
                  (telemetry.indicator === 'right' || telemetry.indicator === 'hazard')
                    ? 'bg-amber-500 border-amber-400 text-stone-950'
                    : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                →
              </button>
            </div>

            {/* Center Cluster: Engine RPM Bar, Air PSI, Turbo Boost, Fuel & Cargo */}
            <div className="flex-1 min-w-[210px] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono-tabular">
                <span className="text-stone-300 font-semibold">
                  ENGINE {Math.round(telemetry.rpm)} RPM
                </span>
                <span className="text-stone-400">
                  BOOST {telemetry.turboBoostBar.toFixed(1)} BAR · AIR{' '}
                  {Math.round(telemetry.airPressurePsi)} PSI
                </span>
              </div>

              {/* Tachometer Bar with Green Diesel Economy Band */}
              <div className="w-full h-2.5 bg-stone-900 border border-stone-800 rounded-full overflow-hidden relative">
                {/* Green optimal torque band indicator (42% to 70% of 2500 RPM) */}
                <div
                  className="absolute top-0 bottom-0 bg-emerald-500/20 border-x border-emerald-500/40"
                  style={{ left: '42%', width: '28%' }}
                />
                <div
                  className={`h-full transition-transform duration-75 origin-left ${
                    telemetry.rpm > 2050
                      ? 'bg-red-500'
                      : telemetry.rpm >= 1050 && telemetry.rpm <= 1780
                      ? 'bg-emerald-400'
                      : 'bg-amber-400'
                  }`}
                  style={{ transform: `scaleX(${rpmPct / 100})` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono-tabular text-stone-400">
                <span>
                  ODOMETER {(telemetry.distanceAlongHighwayM / 1000).toFixed(2)} / 4.35 KM
                </span>
                <span>FUEL {fuelPct}%</span>
                <span
                  className={
                    telemetry.cargoIntegrityPct < 80 ? 'text-amber-400' : 'text-emerald-400'
                  }
                >
                  CARGO {Math.round(telemetry.cargoIntegrityPct)}%
                </span>
              </div>
            </div>

            {/* Right Cluster: Camera View Switcher & Pressure Horn */}
            <div className="flex items-center gap-1.5 shrink-0">
              {(
                [
                  { id: 'cabin', label: 'Cabin' },
                  { id: 'chase', label: 'Chase' },
                  { id: 'orbit', label: 'Orbit' },
                ] as const
              ).map((cam) => (
                <button
                  key={cam.id}
                  type="button"
                  tabIndex={-1}
                  onClick={blurAndCall(() => onCycleCamera(cam.id))}
                  className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    cameraMode === cam.id
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800'
                  }`}
                >
                  {cam.label}
                </button>
              ))}

              <button
                type="button"
                tabIndex={-1}
                aria-label="Sound Pressure Horn [H]"
                onPointerDown={() => onSetHorn(true)}
                onPointerUp={() => onSetHorn(false)}
                onPointerLeave={() => onSetHorn(false)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  telemetry.hornActive
                    ? 'bg-amber-500 border-amber-400 text-stone-950'
                    : 'bg-stone-900 hover:bg-stone-800 border-stone-800 text-amber-400'
                }`}
              >
                HORN [H]
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==========================================================================
          3. PAUSE MODAL (`gameState === 'paused'`)
         ========================================================================== */}
      {gameState === 'paused' && (
        <div className="fixed inset-0 z-30 bg-stone-950/80 flex items-center justify-center p-4 pointer-events-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-modal-title"
            className="w-full max-w-md bg-stone-950 border border-stone-800 rounded-xl p-6 shadow-2xl"
          >
            <h2
              id="pause-modal-title"
              className="font-display font-bold text-2xl text-stone-100 tracking-wide"
            >
              SIMULATION PAUSED
            </h2>
            <p className="text-xs text-stone-400 mt-1">
              {geospatialStatus.corridorName}
            </p>

            {/* 3 Tabular Stat Tiles */}
            <div className="grid grid-cols-3 gap-2.5 my-5">
              <div className="bg-stone-900 border border-stone-800 rounded-lg p-3">
                <div className="text-[10px] font-semibold text-stone-400 uppercase">
                  DISTANCE
                </div>
                <div className="font-mono-tabular font-bold text-lg text-stone-100 mt-0.5">
                  {(telemetry.distanceAlongHighwayM / 1000).toFixed(2)} km
                </div>
              </div>
              <div className="bg-stone-900 border border-stone-800 rounded-lg p-3">
                <div className="text-[10px] font-semibold text-stone-400 uppercase">
                  CARGO
                </div>
                <div className="font-mono-tabular font-bold text-lg text-emerald-400 mt-0.5">
                  {Math.round(telemetry.cargoIntegrityPct)}%
                </div>
              </div>
              <div className="bg-stone-900 border border-stone-800 rounded-lg p-3">
                <div className="text-[10px] font-semibold text-stone-400 uppercase">
                  AIR PSI
                </div>
                <div className="font-mono-tabular font-bold text-lg text-amber-400 mt-0.5">
                  {Math.round(telemetry.airPressurePsi)}
                </div>
              </div>
            </div>

            {/* Settings & Geospatial Status Inspector */}
            <div className="space-y-3 mb-6 text-xs">
              <div className="py-2.5 border-y border-stone-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-stone-300 font-semibold">Graphics Quality Tier</span>
                  <span className="text-[11px] font-mono-tabular text-amber-400 uppercase">
                    {graphicsQuality === 'ultra' ? 'Ultra 4K UHD' : graphicsQuality}
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
                      className={`py-1.5 px-2 rounded font-semibold uppercase transition-colors cursor-pointer ${
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
              <div className="p-2.5 bg-stone-900/80 border border-stone-800 rounded-lg text-[11px] text-stone-400 leading-relaxed">
                <div className="font-semibold text-stone-300 mb-0.5">
                  Geospatial & Road Architecture
                </div>
                {geospatialStatus.statusSummary}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onResumeGame}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-base rounded-lg transition-colors cursor-pointer"
              >
                RESUME HAUL (ESC)
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onRestartGame}
                  className="py-2.5 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-200 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Restart Corridor
                </button>
                <button
                  type="button"
                  onClick={onReturnToTitle}
                  className="py-2.5 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
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
            className="w-full max-w-md bg-stone-950 border border-stone-800 rounded-xl p-6 shadow-2xl"
          >
            <div className="text-xs font-mono-tabular uppercase text-amber-400">
              {outcomeSnapshot.victory ? 'NH-44 FREIGHT CONTRACT COMPLETED' : 'HAUL TERMINATED'}
            </div>
            <h2 className="font-display font-bold text-2xl text-stone-100 mt-1">
              {outcomeSnapshot.victory
                ? 'KARNAL TOLL PLAZA REACHED'
                : 'CARGO INTEGRITY DEPLETED'}
            </h2>
            <p className="text-xs text-stone-400 mt-1">{outcomeSnapshot.reason}</p>

            <div className="grid grid-cols-3 gap-2.5 my-5">
              <div className="bg-stone-900 border border-stone-800 rounded-lg p-3">
                <div className="text-[10px] font-semibold text-stone-400 uppercase">
                  DISTANCE
                </div>
                <div className="font-mono-tabular font-bold text-lg text-stone-100 mt-0.5">
                  {outcomeSnapshot.distanceKm} km
                </div>
              </div>
              <div className="bg-stone-900 border border-stone-800 rounded-lg p-3">
                <div className="text-[10px] font-semibold text-stone-400 uppercase">
                  HAUL TIME
                </div>
                <div className="font-mono-tabular font-bold text-lg text-amber-400 mt-0.5">
                  {outcomeSnapshot.elapsedTimeFormatted}
                </div>
              </div>
              <div className="bg-stone-900 border border-stone-800 rounded-lg p-3">
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
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-base rounded-lg transition-colors cursor-pointer"
              >
                {outcomeSnapshot.victory ? 'START NEXT HAUL (ENTER)' : 'TRY HAUL AGAIN (ENTER)'}
              </button>
              <button
                type="button"
                onClick={onReturnToTitle}
                className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
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
