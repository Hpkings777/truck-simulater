import { TruckPhysicsState } from '../physics/vehiclePhysics';

/**
 * Procedural Web Audio API Synthesizer for Heavy Commercial Diesel Truck & Highway Environment.
 * Zero external MP3 dependencies — responds continuously to engine RPM, throttle load,
 * turbocharger boost, gear shifts, pneumatic air brake release, horn, turn indicators, and road speed.
 */
export class TruckAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private isRunning = false;

  private masterGain: GainNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  private turboOsc: OscillatorNode | null = null;
  private turboGain: GainNode | null = null;

  private roadNoiseFilter: BiquadFilterNode | null = null;
  private roadNoiseGain: GainNode | null = null;

  private hornOsc1: OscillatorNode | null = null;
  private hornOsc2: OscillatorNode | null = null;
  private hornGain: GainNode | null = null;

  private lastShiftTrigger = 0;
  private lastAirBrakeTrigger = 0;
  private lastIndicatorBlink = false;

  public init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : 0.34;
      this.masterGain.connect(this.ctx.destination);

      // 1. 6-Cylinder Heavy Diesel Engine Oscillators
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 180;
      this.engineFilter.Q.value = 2.4;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.001;

      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.value = 32;

      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'triangle';
      this.engineOsc2.frequency.value = 64;

      this.engineSubOsc = this.ctx.createOscillator();
      this.engineSubOsc.type = 'sine';
      this.engineSubOsc.frequency.value = 16;

      this.engineOsc1.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineSubOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.engineOsc1.start();
      this.engineOsc2.start();
      this.engineSubOsc.start();

      // 2. Turbocharger Spool Whistle
      this.turboOsc = this.ctx.createOscillator();
      this.turboOsc.type = 'sine';
      this.turboOsc.frequency.value = 1600;
      this.turboGain = this.ctx.createGain();
      this.turboGain.gain.value = 0;
      this.turboOsc.connect(this.turboGain);
      this.turboGain.connect(this.masterGain);
      this.turboOsc.start();

      // 3. Continuous White-Noise Buffer for Tire Rolling & Wind Rush
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      this.roadNoiseFilter = this.ctx.createBiquadFilter();
      this.roadNoiseFilter.type = 'bandpass';
      this.roadNoiseFilter.frequency.value = 320;
      this.roadNoiseFilter.Q.value = 0.9;

      this.roadNoiseGain = this.ctx.createGain();
      this.roadNoiseGain.gain.value = 0;

      noiseSource.connect(this.roadNoiseFilter);
      this.roadNoiseFilter.connect(this.roadNoiseGain);
      this.roadNoiseGain.connect(this.masterGain);
      noiseSource.start();

      // 4. Dual-Tone Indian Highway Pressure Air Horn (F4 + A4 resonant fifth/third)
      this.hornOsc1 = this.ctx.createOscillator();
      this.hornOsc1.type = 'sawtooth';
      this.hornOsc1.frequency.value = 349.23; // F4
      this.hornOsc2 = this.ctx.createOscillator();
      this.hornOsc2.type = 'sawtooth';
      this.hornOsc2.frequency.value = 440.0; // A4

      const hornFilter = this.ctx.createBiquadFilter();
      hornFilter.type = 'lowpass';
      hornFilter.frequency.value = 1450;

      this.hornGain = this.ctx.createGain();
      this.hornGain.gain.value = 0;

      this.hornOsc1.connect(hornFilter);
      this.hornOsc2.connect(hornFilter);
      hornFilter.connect(this.hornGain);
      this.hornGain.connect(this.masterGain);

      this.hornOsc1.start();
      this.hornOsc2.start();

      this.isRunning = true;
    } catch {
      // Ignore AudioContext autoplay restrictions until next user gesture
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.34, this.ctx.currentTime, 0.04);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public pause(): void {
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
    }
    if (this.roadNoiseGain && this.ctx) {
      this.roadNoiseGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
    }
    if (this.turboGain && this.ctx) {
      this.turboGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
    }
    if (this.hornGain && this.ctx) {
      this.hornGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
    }
  }

  public update(state: TruckPhysicsState, isPlaying: boolean): void {
    if (!this.ctx || !this.isRunning) return;
    if (!isPlaying || this.isMuted) {
      this.pause();
      return;
    }

    const now = this.ctx.currentTime;

    // 6-cylinder 4-stroke diesel firing frequency = (RPM / 60) * 3
    const firingFreq = Math.max(28, (state.rpm / 60) * 3);
    this.engineOsc1?.frequency.setTargetAtTime(firingFreq, now, 0.04);
    this.engineOsc2?.frequency.setTargetAtTime(firingFreq * 1.5, now, 0.04);
    this.engineSubOsc?.frequency.setTargetAtTime(firingFreq * 0.5, now, 0.04);

    const filterCutoff = 135 + (state.rpm - 650) * 0.18 + state.engineLoad * 180;
    this.engineFilter?.frequency.setTargetAtTime(filterCutoff, now, 0.05);

    const engineVol = 0.18 + state.engineLoad * 0.16;
    this.engineGain?.gain.setTargetAtTime(engineVol, now, 0.05);

    // Turbocharger whistle pitch & volume
    const turboFreq = 1500 + state.turboBoostBar * 1100;
    const turboVol = Math.max(0, (state.turboBoostBar - 0.25) * 0.032);
    this.turboOsc?.frequency.setTargetAtTime(turboFreq, now, 0.06);
    this.turboGain?.gain.setTargetAtTime(turboVol, now, 0.06);

    // Tire & aerodynamic wind noise
    const speedRatio = Math.min(1, state.speedKmh / 95);
    const surfaceRough = state.currentSurface === 'asphalt' ? 1.0 : 2.1;
    const roadVol = speedRatio * 0.14 * surfaceRough;
    this.roadNoiseFilter?.frequency.setTargetAtTime(240 + state.speedKmh * 4.5, now, 0.08);
    this.roadNoiseGain?.gain.setTargetAtTime(roadVol, now, 0.08);

    // Dual-tone Highway Horn
    this.hornGain?.gain.setTargetAtTime(state.hornActive ? 0.24 : 0, now, 0.02);

    // Trigger pneumatic gear-shift hiss + mechanical clunk
    if (state.gearShiftTrigger !== this.lastShiftTrigger) {
      this.lastShiftTrigger = state.gearShiftTrigger;
      this.playPneumaticBurst(0.11, 950, 0.12);
    }

    // Trigger pneumatic air-brake chamber release hiss
    if (state.airBrakeReleaseTrigger !== this.lastAirBrakeTrigger) {
      this.lastAirBrakeTrigger = state.airBrakeReleaseTrigger;
      this.playPneumaticBurst(0.24, 1850, 0.16);
    }

    // Trigger turn indicator relay click-clack
    if (state.indicator !== 'off' && state.indicatorBlinkOn !== this.lastIndicatorBlink) {
      this.lastIndicatorBlink = state.indicatorBlinkOn;
      this.playIndicatorClick(state.indicatorBlinkOn ? 1150 : 840);
    }
  }

  private playPneumaticBurst(durationS: number, centerFreq: number, volume: number): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const bufLen = Math.floor(this.ctx.sampleRate * durationS);
      const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.4));
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = centerFreq;
      filter.Q.value = 1.8;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationS);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      src.start(now);
    } catch {
      // Ignore audio node errors
    }
  }

  private playIndicatorClick(freq: number): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.028);
    } catch {
      // Ignore
    }
  }

  public dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
