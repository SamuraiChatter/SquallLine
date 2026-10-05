// The rules of the game. Each rule takes the game as it is now and gives back
// the game as it is next. Nothing in here touches the canvas or the page, so
// the rules also run under Node, which is where the tests check them.

import { drive, nearestSpot, placeOf } from './roads.js';

/**
 * A place on the map, in miles east and north of the middle of the territory.
 * @typedef {{ x: number, y: number }} Point
 */

/**
 * The storm at one moment.
 * @typedef {object} Storm
 * @property {number} miles How far along its path the storm has travelled.
 * @property {number} x
 * @property {number} y
 * @property {number} hook How far the hook has grown and tightened: 0 is no
 *   hook, 1 is a full hook with a tornado due or on the ground.
 * @property {number} tornado How big the tornado is: 0 is no tornado, 1 is
 *   full size. There is only ever one.
 * @property {Point} funnel Where the hook curls and the tornado touches
 *   down, on the storm's south-west side.
 * @property {boolean} spent True once the storm's last tornado has died.
 */

/**
 * The whole game at one moment.
 * @typedef {object} GameState
 * @property {Point} car
 * @property {import('./roads.js').RoadSpot} road Where the car is on the
 *   roads. The car never leaves them.
 * @property {Storm} storm
 * @property {boolean} filming True while the car is pulled over to film.
 * @property {number} camera Which way the camera points, in degrees round
 *   from north: 0 is north, 90 is east.
 * @property {number} footage How many seconds of tornado have been filmed.
 * @property {number} money What today's footage has earned so far.
 * @property {number} balance The money in the bank. Today's earnings join it
 *   when the day ends.
 * @property {boolean} dayOver True once the day has ended.
 * @property {number} damage The damage meter: 0 is unharmed, 1 is wrecked.
 * @property {number} debrisClock Seconds in the debris zone since the last
 *   strike.
 * @property {number} debrisStrikes How many times debris has hit the car.
 * @property {boolean} wrecked True once the car is wrecked. Nobody is hurt.
 * @property {number} repairBill What the day's damage cost to repair. Worked
 *   out when the day ends.
 */

/**
 * Which way the player is steering: x is 1 for east and -1 for west, y is 1
 * for north and -1 for south, and 0 means not that way at all.
 * @typedef {{ x: number, y: number }} Steering
 */

/** @typedef {Pick<typeof import('../tuning.js').tuning, 'carMilesPerSecond' | 'carStart' | 'storm' | 'footage' | 'danger' | 'debris' | 'hail'> & { camera: Pick<typeof import('../tuning.js').tuning.camera, 'viewfinderDegrees' | 'panDegreesPerSecond'> }} Tuning */

/** @typedef {import('./roads.js').RoadNetwork} RoadNetwork */

/**
 * @param {Tuning} tuning
 * @param {RoadNetwork} roads
 * @returns {GameState}
 */
export function newGame(tuning, roads) {
  const road = nearestSpot(roads, tuning.carStart);
  return {
    car: placeOf(roads, road),
    road,
    storm: stormAt(0, tuning.storm),
    filming: false,
    camera: 0,
    footage: 0,
    money: 0,
    balance: 0,
    dayOver: false,
    damage: 0,
    debrisClock: 0,
    debrisStrikes: 0,
    wrecked: false,
    repairBill: 0,
  };
}

/** Ends the day early: the pause screen's "Head home". */
export const headHome = endDay;

/**
 * Ends the day. The TV station buys the footage, the repair bill comes out,
 * and what is left joins the balance, which never goes below zero.
 * @param {GameState} state
 * @param {Tuning} tuning
 * @returns {GameState}
 */
function endDay(state, tuning) {
  if (state.dayOver) return state;
  const repairBill = Math.round(state.damage * tuning.danger.fullRepairCost);
  return {
    ...state,
    dayOver: true,
    repairBill,
    balance: Math.max(0, state.balance + state.money - repairBill),
  };
}

/**
 * What one second of footage pays, filmed from this many miles away. Nothing
 * from outside the footage ring; inside it, more the closer the car is.
 * @param {number} miles
 * @param {Tuning} tuning
 */
export function payPerSecond(miles, tuning) {
  const { ringMiles, payAtEdge, payAtTornado } = tuning.footage;
  if (miles > ringMiles) return 0;
  return payAtEdge + (payAtTornado - payAtEdge) * (1 - miles / ringMiles);
}

/**
 * How many miles the car is from where the tornado touches down.
 * @param {GameState} state
 */
export function milesToFunnel(state) {
  return Math.hypot(state.storm.funnel.x - state.car.x, state.storm.funnel.y - state.car.y);
}

/**
 * Pulls the car over to film, or goes back to driving. The camera starts out
 * pointed at the tornado.
 * @param {GameState} state
 * @returns {GameState}
 */
export function toggleFilming(state) {
  return { ...state, filming: !state.filming, camera: bearingToFunnel(state), road: { ...state.road, moving: false } };
}

/**
 * Whether the tornado is inside the viewfinder box right now.
 * @param {GameState} state
 * @param {Tuning} tuning
 */
export function tornadoInFrame(state, tuning) {
  if (state.storm.tornado === 0) return false;
  return Math.abs(cameraOffFunnel(state)) <= tuning.camera.viewfinderDegrees / 2;
}

/**
 * How far the tornado is to the right of where the camera points, in
 * degrees from -180 to 180. Less than zero means it is to the left.
 * @param {GameState} state
 */
export function cameraOffFunnel(state) {
  return ((bearingToFunnel(state) - state.camera + 540) % 360) - 180;
}

/**
 * The direction from the car to where the tornado touches down, in degrees
 * round from north.
 * @param {GameState} state
 */
function bearingToFunnel(state) {
  const { funnel } = state.storm;
  const degrees = (Math.atan2(funnel.x - state.car.x, funnel.y - state.car.y) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

/**
 * Moves the game on by a moment.
 * @param {GameState} state
 * @param {Steering} steering
 * @param {number} dt Seconds since the last step.
 * @param {Tuning} tuning
 * @param {RoadNetwork} roads
 * @returns {GameState}
 */
export function step(state, steering, dt, tuning, roads) {
  if (state.dayOver) return state;

  const storm = stormAt(state.storm.miles + tuning.storm.milesPerSecond * dt, tuning.storm);
  // The storm has nothing left to film, so the day is done.
  if (storm.spent) return endDay({ ...state, storm }, tuning);

  return battered(driveOrFilm({ ...state, storm }, steering, dt, tuning, roads), dt, tuning);
}

/**
 * What the wind does to the car over a moment. Close enough to the tornado it
 * flips the car; a flip or a full damage meter wrecks it and ends the day.
 * @param {GameState} state
 * @param {number} dt
 * @param {Tuning} tuning
 * @returns {GameState}
 */
function battered(state, dt, tuning) {
  let { damage, debrisClock, debrisStrikes } = state;
  let flipped = false;

  // Hail falls from the storm's purple core, tornado or not.
  if (inHailCore(state.car, state.storm, tuning)) damage += tuning.hail.damagePerSecond * dt;

  if (state.storm.tornado > 0) {
    const miles = milesToFunnel(state);
    damage += windDamagePerSecond(miles, tuning) * dt;
    flipped = miles <= tuning.danger.flipMiles;

  }

  // Debris hits in bursts: one strike each time the clock comes round, for as
  // long as the car stays in the debris zone. Leaving the zone, or the
  // tornado dying, starts the clock again.
  if (inDebrisZone(state, tuning)) {
    // Never quicker than twenty a second, whatever the tuning file says.
    const every = Math.max(0.05, tuning.debris.strikeEverySeconds);
    debrisClock += dt;
    while (debrisClock >= every) {
      debrisClock -= every;
      debrisStrikes += 1;
      damage += tuning.debris.damagePerStrike;
    }
  } else {
    debrisClock = 0;
  }

  if (flipped || damage >= 1) {
    return endDay({ ...state, damage: 1, debrisClock, debrisStrikes, wrecked: true }, tuning);
  }
  return { ...state, damage, debrisClock, debrisStrikes };
}

/**
 * Whether the car is close enough to a tornado on the ground for debris to
 * hit it.
 * @param {GameState} state
 * @param {Tuning} tuning
 */
export function inDebrisZone(state, tuning) {
  return state.storm.tornado > 0 && milesToFunnel(state) <= tuning.debris.zoneMiles;
}

/**
 * The storm's hail core: the long purple shape in the radar picture. It lies
 * south-west to north-east.
 * @param {Storm} storm
 * @param {Tuning} tuning
 * @returns {{ x: number, y: number, long: number, wide: number }} Its middle,
 *   and how far it reaches along its length and across it, in miles.
 */
export function hailCore(storm, tuning) {
  return { x: storm.x + 0.3, y: storm.y + 0.3, long: tuning.hail.coreMilesLong, wide: tuning.hail.coreMilesWide };
}

/**
 * Whether a place is inside the hail core.
 * @param {Point} point
 * @param {Storm} storm
 * @param {Tuning} tuning
 */
export function inHailCore(point, storm, tuning) {
  const core = hailCore(storm, tuning);
  const dx = point.x - core.x;
  const dy = point.y - core.y;
  // How far the place is along the core's length, and across it.
  const along = (dx + dy) / Math.SQRT2;
  const across = (dy - dx) / Math.SQRT2;
  return (along / core.long) ** 2 + (across / core.wide) ** 2 <= 1;
}

/**
 * How much of the damage meter the wind fills each second at this many miles
 * from the tornado. Nothing outside the danger ring; inside it the damage
 * climbs steeply, so half way in does a quarter of the damage at the tornado.
 * @param {number} miles
 * @param {Tuning} tuning
 */
export function windDamagePerSecond(miles, tuning) {
  const { ringMiles, windDamageAtTornado } = tuning.danger;
  if (miles >= ringMiles) return 0;
  return windDamageAtTornado * (1 - miles / ringMiles) ** 2;
}

/**
 * The player's part of a moment: driving, or filming when pulled over.
 * @param {GameState} state
 * @param {Steering} steering
 * @param {number} dt
 * @param {Tuning} tuning
 * @param {RoadNetwork} roads
 * @returns {GameState}
 */
function driveOrFilm(state, steering, dt, tuning, roads) {
  const { storm } = state;
  if (state.filming) {
    // Pulled over: the car stays put, left and right pan the camera, and the
    // seconds count, and pay, while the tornado is in the viewfinder box.
    const camera = (state.camera + steering.x * tuning.camera.panDegreesPerSecond * dt + 360) % 360;
    const next = { ...state, storm, camera };
    const filmed = tornadoInFrame(next, tuning) ? dt : 0;
    return {
      ...next,
      footage: state.footage + filmed,
      money: state.money + filmed * payPerSecond(milesToFunnel(next), tuning),
    };
  }

  const road = drive(roads, state.road, steering, tuning.carMilesPerSecond * dt);
  // A car that has not been driven stays exactly where it was.
  return road === state.road ? state : { ...state, road, car: placeOf(roads, road) };
}

/**
 * The storm once it has travelled this many miles along its path.
 * @param {number} miles
 * @param {Tuning['storm']} tuning
 * @returns {Storm}
 */
function stormAt(miles, tuning) {
  const { path } = tuning;
  const legs = path.slice(1).map((to, i) => Math.hypot(to.x - path[i].x, to.y - path[i].y));
  const length = legs.reduce((sum, leg) => sum + leg, 0);
  miles = Math.min(miles, length);

  // Walk the legs of the path until the miles run out.
  let left = miles;
  let i = 0;
  while (i < legs.length - 1 && left > legs[i]) left -= legs[i++];
  const share = legs[i] ? left / legs[i] : 0;
  const x = path[i].x + (path[i + 1].x - path[i].x) * share;
  const y = path[i].y + (path[i + 1].y - path[i].y) * share;

  // Where the storm is as a share of the whole path: 0 at the start, 1 at
  // the end. The tornadoes are set out in these shares.
  const along = length ? miles / length : 1;
  const onGround = tuning.tornadoes.find((t) => along >= t.start && along < t.end);
  const next = tuning.tornadoes.find((t) => t.start > along);

  let hook = 0;
  let tornado = 0;
  if (onGround) {
    hook = 1;
    // Full size at first, shrinking to nothing over its last third.
    tornado = Math.min(1, (3 * (onGround.end - along)) / (onGround.end - onGround.start));
  } else if (next) {
    hook = Math.max(0, 1 - (next.start - along) / tuning.hookLead);
  }
  const last = tuning.tornadoes.at(-1);
  const spent = last !== undefined && along >= last.end;
  return { miles, x, y, hook, tornado, funnel: { x: x - 2.6, y: y - 2.6 }, spent };
}
