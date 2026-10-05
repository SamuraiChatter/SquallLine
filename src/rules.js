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
 * @property {number} strength How strong the tornado on the ground is, or
 *   the next one due: from 0 for EF0 to 5 for EF5.
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
 * @property {number} day Which chase day this is, counting from 1.
 * @property {boolean} briefing True while the forecast briefing is up,
 *   before the chase starts.
 * @property {boolean} finished True once the last day is over and the final
 *   score is showing.
 * @property {number} best The best final balance of any finished run.
 * @property {boolean} freePlay True while replaying a day after a finished
 *   run. Free play never changes the balance, which is the recorded score.
 * @property {string[]} parts The ids of the parts bought for the vehicle.
 * @property {boolean} garage True while the garage is open, between a day's
 *   summary and the next day's briefing.
 * @property {boolean} flipped True while the car is lying where the tornado
 *   flipped it. Only a car with a roll cage is still in the day to do so.
 * @property {number} anchor How far down the skirts and spikes are: 0 is
 *   up, 1 is anchored.
 * @property {boolean} anchoring True while the skirts and spikes are going
 *   down or staying down, false while they are coming up or staying up.
 */

/**
 * Which way the player is steering: x is 1 for east and -1 for west, y is 1
 * for north and -1 for south, and 0 means not that way at all.
 * @typedef {{ x: number, y: number }} Steering
 */

/** @typedef {typeof import('../tuning.js').tuning} TuningFile */

/**
 * One chase day's own numbers.
 * @typedef {object} Day
 * @property {Point[]} path The corners of the storm's path.
 * @property {{ start: number, end: number, strength?: number }[]} tornadoes
 * @property {{ ringMiles: number, payAtEdge: number, payAtTornado: number }} footage
 */

/**
 * A part the garage sells. What it does is in its numbers, which are all set
 * out in the tuning file.
 * @typedef {object} Part
 * @property {string} id What saves remember the part by.
 * @property {number} price
 * @property {string} [needs] The id of a part that has to be bought first.
 * @property {number} [speedTimes]
 * @property {number} [payTimes]
 * @property {number} [hailDamageTimes]
 * @property {number} [debrisDamageTimes]
 * @property {number} [dangerRingTimes]
 * @property {number} [flipDamage]
 * @property {number} [anchoredRingTimes]
 * @property {boolean} [anchorHolds]
 */

/**
 * The numbers a whole run plays by: what the days share, each day's own, and
 * the parts the garage sells.
 * @typedef {Pick<TuningFile, 'carMilesPerSecond' | 'carStart' | 'startingBalance' | 'storm' | 'danger' | 'debris' | 'hail' | 'anchor'> & { camera: Pick<TuningFile['camera'], 'viewfinderDegrees' | 'panDegreesPerSecond'>, days: Day[], parts: Part[] }} RunTuning
 */

/**
 * The numbers one day plays by: the day's storm and footage numbers, set in
 * among what the days share, with the vehicle's parts counted in.
 * @typedef {object} DayNumbers
 * @property {RunTuning['storm'] & Pick<Day, 'path' | 'tornadoes'>} storm
 * @property {Day['footage']} footage
 * @property {RunTuning['danger'] & { flipDamage?: number }} danger With a
 *   roll cage, flipDamage is how much of the damage meter a flip fills
 *   instead of wrecking the car.
 * @property {RunTuning['anchor'] & { ringTimes?: number, holds?: boolean }} anchor
 *   With skirts, ringTimes is what anchoring multiplies the danger ring by;
 *   without it the vehicle cannot anchor. With spikes, holds is true: an
 *   anchored vehicle stays put when the tornado passes over.
 *
 * @typedef {Omit<RunTuning, 'storm' | 'danger' | 'anchor' | 'days' | 'parts' | 'startingBalance'> & DayNumbers} Tuning
 */

/** @typedef {import('./roads.js').RoadNetwork} RoadNetwork */

/**
 * The numbers one day plays by, with the vehicle's parts counted in.
 * @template {RunTuning} T
 * @param {T} tuning
 * @param {number} day Which day, counting from 1.
 * @param {string[]} [owned] The ids of the parts on the vehicle.
 * @returns {Omit<T, 'danger' | 'anchor'> & Tuning}
 */
export function dayTuning(tuning, day, owned = []) {
  const { path, tornadoes, footage } = tuning.days[day - 1];
  const parts = tuning.parts.filter((part) => owned.includes(part.id));
  /**
   * What the parts multiply one of the game's numbers by, between them.
   * @param {'speedTimes' | 'payTimes' | 'hailDamageTimes' | 'debrisDamageTimes' | 'dangerRingTimes'} effect
   */
  const times = (effect) => parts.reduce((all, part) => all * (part[effect] ?? 1), 1);
  return {
    ...tuning,
    carMilesPerSecond: tuning.carMilesPerSecond * times('speedTimes'),
    storm: { ...tuning.storm, path, tornadoes },
    footage: { ...footage, payAtEdge: footage.payAtEdge * times('payTimes'), payAtTornado: footage.payAtTornado * times('payTimes') },
    danger: {
      ...tuning.danger,
      ringMiles: tuning.danger.ringMiles * times('dangerRingTimes'),
      flipDamage: parts.find((part) => part.flipDamage !== undefined)?.flipDamage,
    },
    anchor: {
      ...tuning.anchor,
      ringTimes: parts.find((part) => part.anchoredRingTimes !== undefined)?.anchoredRingTimes,
      holds: parts.some((part) => part.anchorHolds),
    },
    debris: { ...tuning.debris, damagePerStrike: tuning.debris.damagePerStrike * times('debrisDamageTimes') },
    hail: { ...tuning.hail, damagePerSecond: tuning.hail.damagePerSecond * times('hailDamageTimes') },
  };
}

/**
 * Why a part cannot be bought right now: it is already owned, it needs
 * another part first, or it costs more than the balance. Empty if it can.
 * @param {GameState} state
 * @param {Part} part
 * @returns {'' | 'owned' | 'needs' | 'money'}
 */
export function whyNotBuy(state, part) {
  if (state.parts.includes(part.id)) return 'owned';
  if (part.needs && !state.parts.includes(part.needs)) return 'needs';
  if (part.price > state.balance) return 'money';
  return '';
}

/**
 * Buys a part in the garage: its price comes off the balance and it goes on
 * the vehicle. Nothing happens if it cannot be bought.
 * @param {GameState} state
 * @param {string} id
 * @param {RunTuning} tuning
 * @returns {GameState}
 */
export function buy(state, id, tuning) {
  const part = tuning.parts.find((one) => one.id === id);
  if (!state.garage || !part || whyNotBuy(state, part)) return state;
  return { ...state, balance: state.balance - part.price, parts: [...state.parts, id] };
}

/**
 * The strength of a day's strongest tornado, from 0 for EF0 to 5 for EF5.
 * @param {Day['tornadoes']} tornadoes
 */
export function strongest(tornadoes) {
  return Math.max(0, ...tornadoes.map((tornado) => tornado.strength ?? 0));
}

/**
 * What is kept between visits.
 * @typedef {object} Save
 * @property {number} day The next day to play, counting from 1. One more
 *   than the last day means the run is finished.
 * @property {number} balance The money in the bank. Once the run is
 *   finished, this is its final score.
 * @property {number} best The best final balance of any finished run.
 * @property {string[]} parts The ids of the parts bought for the vehicle.
 */

// Where the browser keeps the save.
export const saveKey = 'squallline-save';

/**
 * The save of a game not yet started. Starting a new game keeps the best
 * final balance.
 * @param {RunTuning} tuning
 * @param {number} [best]
 * @returns {Save}
 */
export function newSave(tuning, best = 0) {
  return { day: 1, balance: tuning.startingBalance, best, parts: [] };
}

/**
 * What to keep once a day is over: the next day, the balance, the parts, and
 * the best final balance, which the last day's balance may have beaten.
 * @param {GameState} state A day that has ended.
 * @param {RunTuning} tuning
 * @returns {Save}
 */
export function saveOf(state, tuning) {
  const finished = state.day >= tuning.days.length;
  return {
    day: state.day + 1,
    balance: state.balance,
    best: finished ? Math.max(state.best, state.balance) : state.best,
    parts: state.parts,
  };
}

/**
 * Whether a save is of a finished run.
 * @param {Save} save
 * @param {RunTuning} tuning
 */
export function runFinished(save, tuning) {
  return save.day > tuning.days.length;
}

/**
 * Reads a save. Anything that is not a save the game can carry on from is
 * turned away, so a damaged one cannot break the game.
 * @param {string | null} text
 * @param {RunTuning} tuning
 * @returns {Save | null}
 */
export function readSave(text, tuning) {
  /** @type {unknown} */
  let kept;
  try {
    kept = JSON.parse(text ?? '');
  } catch {
    return null;
  }
  const { day, balance, best, parts } = /** @type {Partial<Save>} */ (kept ?? {});
  /** @param {unknown} n */
  const isMoney = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || !isMoney(balance) || !isMoney(best)) return null;
  return {
    // The tuning file may have fewer days now than when the save was made.
    day: Math.min(day, tuning.days.length + 1),
    balance: /** @type {number} */ (balance),
    best: /** @type {number} */ (best),
    // Only parts the garage still sells, each once. A save from before the
    // garage has none.
    parts: tuning.parts.map((part) => part.id).filter((id) => Array.isArray(parts) && parts.includes(id)),
  };
}

/**
 * Starts a run of chase days, at day one's briefing.
 * @param {RunTuning} tuning
 * @param {RoadNetwork} roads
 * @param {number} [best] The best final balance so far.
 * @returns {GameState}
 */
export function newRun(tuning, roads, best = 0) {
  return resume(newSave(tuning, best), tuning, roads);
}

/**
 * Carries a run on from its save, at the next day's briefing.
 * @param {Save} save The save of a run that is not finished.
 * @param {RunTuning} tuning
 * @param {RoadNetwork} roads
 * @returns {GameState}
 */
export function resume(save, tuning, roads) {
  return { ...newGame(dayTuning(tuning, save.day), roads), ...save, briefing: true };
}

/**
 * Replays a day after a finished run, at its briefing.
 * @param {Save} save The save of the finished run.
 * @param {number} day Which day, counting from 1.
 * @param {RunTuning} tuning
 * @param {RoadNetwork} roads
 * @returns {GameState}
 */
export function freePlay(save, day, tuning, roads) {
  return { ...resume({ ...save, day }, tuning, roads), freePlay: true };
}

/**
 * Leaves the briefing and starts the chase.
 * @param {GameState} state
 * @returns {GameState}
 */
export function beginChase(state) {
  return { ...state, briefing: false };
}

/**
 * Moves on from the day summary: to the garage, and from the garage to the
 * next day's briefing. After the last day it is straight to the final score,
 * with no garage: there is nothing left to spend the score on. The player
 * always moves on, whatever the day earned.
 * @param {GameState} state
 * @param {RunTuning} tuning
 * @param {RoadNetwork} roads
 * @returns {GameState}
 */
export function nextDay(state, tuning, roads) {
  if (!state.dayOver || state.finished || state.freePlay) return state;
  // The final score is the balance once the last day's repairs are paid.
  if (state.day >= tuning.days.length) return { ...state, finished: true, best: Math.max(state.best, state.balance) };
  if (!state.garage) return { ...state, garage: true };
  return resume(saveOf(state, tuning), tuning, roads);
}

/**
 * One day, ready to chase: no briefing, and nothing in the bank.
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
    day: 1,
    briefing: false,
    finished: false,
    best: 0,
    freePlay: false,
    parts: [],
    garage: false,
    flipped: false,
    anchor: 0,
    anchoring: false,
  };
}

/** Ends the day early: the pause screen's "Head home". */
export const headHome = endDay;

/**
 * Ends the day. The TV station buys the footage, the repair bill comes out,
 * and what is left joins the balance, which never goes below zero. In free
 * play the balance is left alone.
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
    balance: state.freePlay ? state.balance : Math.max(0, state.balance + state.money - repairBill),
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
  // A ring of no miles is the tornado itself: nothing outside it pays.
  if (miles > ringMiles || ringMiles <= 0) return 0;
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
 * pointed at the tornado. The car cannot drive off until the skirts and
 * spikes are all the way up.
 * @param {GameState} state
 * @returns {GameState}
 */
export function toggleFilming(state) {
  if (state.anchoring || state.anchor > 0) return state;
  return { ...state, filming: !state.filming, camera: bearingToFunnel(state), road: { ...state.road, moving: false } };
}

/**
 * Starts dropping the skirts and driving in the spikes, or starts pulling
 * them up again. Only a parked vehicle with skirts can anchor.
 * @param {GameState} state
 * @param {Tuning} tuning
 * @returns {GameState}
 */
export function toggleAnchor(state, tuning) {
  if (!state.filming || state.dayOver || tuning.anchor.ringTimes === undefined) return state;
  return { ...state, anchoring: !state.anchoring };
}

/**
 * How many more seconds the skirts and spikes need to finish going down or
 * coming up. Nothing once they are there.
 * @param {GameState} state
 * @param {Tuning} tuning
 */
export function anchorWait(state, tuning) {
  return state.anchoring ? (1 - state.anchor) * tuning.anchor.downSeconds : state.anchor * tuning.anchor.upSeconds;
}

/**
 * How many miles out the danger ring reaches right now. Anchoring with the
 * skirts down pulls it in.
 * @param {GameState} state
 * @param {Tuning} tuning
 */
export function dangerRingMiles(state, tuning) {
  return tuning.danger.ringMiles * (state.anchor >= 1 ? (tuning.anchor.ringTimes ?? 1) : 1);
}

/**
 * Whether the tornado is right on top of the car: close enough to flip one
 * that is not held down.
 * @param {GameState} state
 * @param {Tuning} tuning
 */
function tornadoOverhead(state, tuning) {
  return state.storm.tornado > 0 && milesToFunnel(state) <= tuning.danger.flipMiles;
}

/**
 * Whether this is the direct hit: the tornado passing over a vehicle that is
 * anchored and spiked to the ground.
 * @param {GameState} state
 * @param {Tuning} tuning
 */
export function insideTornado(state, tuning) {
  return state.anchor >= 1 && tuning.anchor.holds === true && tornadoOverhead(state, tuning);
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
  if (state.briefing || state.dayOver) return state;

  const storm = stormAt(state.storm.miles + tuning.storm.milesPerSecond * dt, tuning.storm);
  // The storm has nothing left to film, so the day is done.
  if (storm.spent) return endDay({ ...state, storm }, tuning);

  return battered(driveOrFilm({ ...state, storm }, steering, dt, tuning, roads), dt, tuning);
}

/**
 * What the wind does to the car over a moment. Close enough to the tornado it
 * flips the car; a flip or a full damage meter wrecks it and ends the day.
 * With a roll cage a flip costs heavy damage instead, once each time the
 * tornado catches the car.
 * @param {GameState} state
 * @param {number} dt
 * @param {Tuning} tuning
 * @returns {GameState}
 */
function battered(state, dt, tuning) {
  let { damage, debrisClock, debrisStrikes } = state;
  let flipped = false;
  let wrecked = false;

  // Hail falls from the storm's purple core, tornado or not.
  if (inHailCore(state.car, state.storm, tuning)) damage += tuning.hail.damagePerSecond * dt;

  if (state.storm.tornado > 0) {
    const miles = milesToFunnel(state);
    damage += windDamagePerSecond(miles, tuning, dangerRingMiles(state, tuning)) * dt;
    // Spiked to the ground, the car stays put as the tornado passes over.
    flipped = tornadoOverhead(state, tuning) && !insideTornado(state, tuning);
    if (flipped && !state.flipped) {
      const { flipDamage } = tuning.danger;
      if (flipDamage === undefined) wrecked = true;
      else damage += flipDamage;
    }
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

  if (wrecked || damage >= 1) {
    return endDay({ ...state, damage: 1, debrisClock, debrisStrikes, flipped, wrecked: true }, tuning);
  }
  return { ...state, damage, debrisClock, debrisStrikes, flipped };
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
 * @param {number} [ringMiles] How far the danger ring reaches, if anchoring
 *   has pulled it in.
 */
export function windDamagePerSecond(miles, tuning, ringMiles = tuning.danger.ringMiles) {
  if (miles >= ringMiles) return 0;
  return tuning.danger.windDamageAtTornado * (1 - miles / ringMiles) ** 2;
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
    // The skirts and spikes take their time going down and coming up.
    const { downSeconds, upSeconds } = tuning.anchor;
    const moved = state.anchoring ? dt / Math.max(downSeconds, 0.001) : -dt / Math.max(upSeconds, 0.001);
    const anchor = Math.max(0, Math.min(1, state.anchor + moved));
    const next = { ...state, storm, camera, anchor };
    // Inside the tornado there is nothing to aim at: the footage counts by
    // itself, at the top rate.
    const direct = insideTornado(next, tuning);
    const filmed = direct || tornadoInFrame(next, tuning) ? dt : 0;
    const pay = direct ? tuning.footage.payAtTornado : payPerSecond(milesToFunnel(next), tuning);
    return { ...next, footage: state.footage + filmed, money: state.money + filmed * pay };
  }

  const road = drive(roads, state.road, steering, tuning.carMilesPerSecond * dt);
  // A car that has not been driven stays exactly where it was.
  return road === state.road ? state : { ...state, road, car: placeOf(roads, road) };
}

/**
 * Where a storm's hook curls and its tornado touches down: on the storm's
 * south-west side.
 * @param {Point} storm The middle of the storm.
 * @returns {Point}
 */
export function funnelOf(storm) {
  return { x: storm.x - 2.6, y: storm.y - 2.6 };
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
  const strength = (onGround ?? next)?.strength ?? 0;
  return { miles, x, y, hook, tornado, funnel: funnelOf({ x, y }), strength, spent };
}
