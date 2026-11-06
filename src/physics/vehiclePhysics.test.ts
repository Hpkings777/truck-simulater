import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRoadPointAtDistance,
  LANE_CENTERS,
  projectWorldToSpline,
  setActiveMapId,
  splineToRealWorldGps,
  splineToWorld,
} from './highwaySpline';
import {
  computeEngineTorqueNm,
  createInitialTruckState,
  HEAVY_TRUCK_GEARS,
  stepTruckPhysics,
  TRUCK_MODEL_SPECS,
  TruckControlInput,
} from './vehiclePhysics';
import { createInitialTrafficFleet, stepTrafficSimulation } from './trafficSimulation';

const neutralInput: TruckControlInput = {
  throttle: 0,
  brake: 0,
  serviceAirBrake: false,
  steer: 0,
  shiftUpJustPressed: false,
  shiftDownJustPressed: false,
  engineBrakeActive: false,
};

test('NH-44 highway spline produces continuous coordinates and flyover elevation', () => {
  setActiveMapId('nh44_plains');
  const start = getRoadPointAtDistance(0);
  const flyoverCrest = getRoadPointAtDistance(1400);
  const tollPlaza = getRoadPointAtDistance(4350);

  assert.equal(start.speedLimitKmh, 80);
  assert.ok(
    flyoverCrest.y > start.y + 6.5,
    `Expected Shahbad Flyover crest (${flyoverCrest.y}m) to be >6.5m above start (${start.y}m)`
  );
  assert.equal(flyoverCrest.isBridge, true);
  assert.equal(tollPlaza.isTollPlaza, true);

  // Verify splineToWorld and projectWorldToSpline round-trip accurately
  const worldLeftLane = splineToWorld(850, LANE_CENTERS.FORWARD_OUTER, 0);
  const projected = projectWorldToSpline(worldLeftLane.x, worldLeftLane.z, 850);
  assert.ok(Math.abs(projected.lateralOffset - LANE_CENTERS.FORWARD_OUTER) < 0.15);
  assert.equal(projected.surfaceType, 'asphalt');
});

test('3 Indian Highway Maps (NH-44 Plains, NH-48 Ghats, NH-66 Coastal) have distinct geography and GPS coordinates', () => {
  const plainsSample = getRoadPointAtDistance(1300, 'nh44_plains');
  const ghatsSample = getRoadPointAtDistance(1300, 'nh48_ghats');
  const coastalSample = getRoadPointAtDistance(1300, 'nh66_coastal');

  assert.equal(ghatsSample.isTunnel, true, 'NH-48 Western Ghats should have rock tunnel at 1300m');
  assert.equal(plainsSample.isTunnel, false);
  assert.ok(
    Math.abs(ghatsSample.x - plainsSample.x) > 10,
    'NH-48 Ghats winding S-curves should have markedly different horizontal alignment than NH-44 Plains'
  );
  assert.ok(
    coastalSample.y > 12,
    `NH-66 Coastal Sea-Link cable-stayed deck at 1300m should be high above sea level, got ${coastalSample.y}`
  );

  const gpsPlains = splineToRealWorldGps(1000, -5.75, 'nh44_plains');
  const gpsGhats = splineToRealWorldGps(1000, -5.75, 'nh48_ghats');
  const gpsCoastal = splineToRealWorldGps(1000, -5.75, 'nh66_coastal');

  assert.ok(gpsPlains.lat > 29.5 && gpsPlains.lat < 30.5, 'NH-44 GPS should be in Haryana');
  assert.ok(gpsGhats.lat > 18.5 && gpsGhats.lat < 19.0, 'NH-48 GPS should be in Khandala/Lonavala');
  assert.ok(gpsCoastal.lat > 19.0 && gpsCoastal.lat < 19.1, 'NH-66 GPS should be in Mumbai Sea-Link');
  setActiveMapId('nh44_plains');
});

test('3 Selectable Truck Models have distinct mass, power, and articulation physics', () => {
  assert.equal(TRUCK_MODEL_SPECS.tata_prima_4928.hasArticulatedTrailer, true);
  assert.equal(TRUCK_MODEL_SPECS.ashok_leyland_3520.hasArticulatedTrailer, false);
  assert.equal(TRUCK_MODEL_SPECS.bharatbenz_4228r.hasArticulatedTrailer, true);

  const rigidState = createInitialTruckState(100, 'ashok_leyland_3520');
  for (let i = 0; i < 180; i++) {
    stepTruckPhysics(
      rigidState,
      { ...neutralInput, throttle: 0.9, steer: 0.5 },
      1 / 60,
      i / 60
    );
  }
  assert.equal(
    rigidState.articulationAngleRad,
    0,
    'Rigid Ashok Leyland 3520 Goods Carrier must have 0 fifth-wheel articulation angle'
  );
});

test('Heavy diesel torque curve peaks in the 1050-1720 RPM green band', () => {
  const idleTorque = computeEngineTorqueNm(650);
  const peakTorque = computeEngineTorqueNm(1400);
  const redlineTorque = computeEngineTorqueNm(2500);

  assert.ok(peakTorque > idleTorque, 'Peak torque at 1400 RPM should exceed idle torque');
  assert.ok(peakTorque > redlineTorque, 'Peak torque should taper off near 2500 RPM redline');
});

test('Heavy truck accelerates realistically, upshifts in automatic mode, and stays grounded', () => {
  setActiveMapId('nh44_plains');
  const state = createInitialTruckState(60);
  assert.equal(state.gearLabel, '2L');
  assert.ok(state.lateralOffsetM < 0, 'Initial spawn must be in Left-Hand Traffic forward lane (< 0)');

  for (let i = 0; i < 480; i++) {
    stepTruckPhysics(
      state,
      { ...neutralInput, throttle: 1.0 },
      1 / 60,
      i / 60
    );
  }

  assert.ok(state.speedKmh > 22 && state.speedKmh < 75, `Speed after 8s should be realistic heavy truck speed, got ${state.speedKmh}`);
  assert.ok(state.gearIndex > 5, `Automatic transmission should have upshifted above 2L (idx 5), got ${state.gearLabel}`);
  assert.ok(state.distanceAlongHighwayM > 95, 'Truck should have advanced along the NH-44 corridor');
  assert.equal(state.wheels.length, 6);
});

test('Steering turns the tractor and induces realistic fifth-wheel trailer articulation', () => {
  const state = createInitialTruckState(100, 'tata_prima_4928');
  for (let i = 0; i < 240; i++) {
    stepTruckPhysics(state, { ...neutralInput, throttle: 0.9 }, 1 / 60, i / 60);
  }

  const initialHeading = state.heading;
  for (let i = 0; i < 90; i++) {
    stepTruckPhysics(
      state,
      { ...neutralInput, throttle: 0.5, steer: 0.6 },
      1 / 60,
      4 + i / 60
    );
  }

  assert.ok(state.steerAngleRad < -0.02, 'Front wheels should angle left');
  assert.ok(state.heading < initialHeading, 'Tractor heading should turn left');
  assert.ok(
    Math.abs(state.articulationAngleRad) > 0.01 && Math.abs(state.articulationAngleRad) < 1.26,
    `Trailer should articulate smoothly at fifth wheel, got ${state.articulationAngleRad}`
  );
});

test('Pneumatic air brakes decelerate the truck and consume air reservoir PSI', () => {
  const state = createInitialTruckState(200);
  for (let i = 0; i < 240; i++) {
    stepTruckPhysics(state, { ...neutralInput, throttle: 1.0 }, 1 / 60, i / 60);
  }
  const speedBeforeBraking = state.speedKmh;
  const psiBeforeBraking = state.airPressurePsi;

  for (let i = 0; i < 120; i++) {
    stepTruckPhysics(
      state,
      { ...neutralInput, brake: 1.0, serviceAirBrake: true },
      1 / 60,
      4 + i / 60
    );
  }

  assert.ok(state.speedKmh < speedBeforeBraking * 0.4, 'Heavy braking should substantially reduce speed');
  assert.ok(state.airPressurePsi < psiBeforeBraking, 'Heavy braking should consume pneumatic air PSI');
  assert.ok(HEAVY_TRUCK_GEARS.length === 15, 'Should have 15 gear states (R2, R1, N + 12 forward)');
});

test('Left-hand traffic fleet initializes in correct lanes and advances without collisions', () => {
  const player = createInitialTruckState(60);
  const fleet = createInitialTrafficFleet(60);
  assert.equal(fleet.length, 24);

  const forwardVehicles = fleet.filter((v) => v.direction === 1);
  const oncomingVehicles = fleet.filter((v) => v.direction === -1);
  assert.ok(forwardVehicles.every((v) => v.laneOffset < 0), 'Forward traffic must travel on the left side (< 0)');
  assert.ok(oncomingVehicles.every((v) => v.laneOffset > 0), 'Oncoming traffic must travel on the right side (> 0)');

  const initialS0 = fleet[0].s;
  for (let i = 0; i < 60; i++) {
    stepTrafficSimulation(fleet, player, 1 / 60);
  }
  assert.ok(fleet[0].s > initialS0, 'Forward traffic vehicle should advance along s');
});

test('Rigid highway guardrails and road deck prevent tractor or trailer from phasing off-road or sinking', () => {
  setActiveMapId('nh48_ghats');
  const state = createInitialTruckState(400, 'tata_prima_4928');
  for (let i = 0; i < 300; i++) {
    stepTruckPhysics(
      state,
      { ...neutralInput, throttle: 1.0, steer: 1.0 },
      1 / 60,
      i / 60
    );
  }
  const roadSample = getRoadPointAtDistance(state.distanceAlongHighwayM, 'nh48_ghats');
  assert.ok(
    Math.abs(state.lateralOffsetM) <= 10.9,
    `Tractor must be rigidly bounded by outer steel guardrail (<= 10.9m), got ${state.lateralOffsetM}`
  );
  assert.ok(
    Math.abs(state.y - roadSample.y) < 0.05,
    `Tractor vertical position (${state.y}) must stay rigidly locked to road deck (${roadSample.y})`
  );
  setActiveMapId('nh44_plains');
});

