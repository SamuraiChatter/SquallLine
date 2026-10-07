// Designed storms: the sums the design mode needs, and reading and writing
// storm files. Like the rules, nothing in here touches the canvas or the
// page, so it runs under Node for the tests.

/** @typedef {import('./rules.js').Point} Point */

/**
 * One tornado of a designed storm.
 * @typedef {object} Tornado
 * @property {number} start Where along the storm's path it touches down: 0 is
 *   the start of the path, 1 is the end.
 * @property {number} end Where along the path it dies.
 * @property {number} strength Its strength, from 0 for EF0 to 5 for EF5.
 */

/**
 * A designed storm: what a storm file holds.
 * @typedef {object} DesignedStorm
 * @property {Point[]} path The corners of the storm's path, in miles east
 *   and north of the middle of the territory.
 * @property {Tornado[]} tornadoes In order along the path, never overlapping.
 * @property {FalseAlarm[]} falseAlarms In order along the path, never
 *   overlapping each other or a tornado.
 */

/**
 * One false alarm of a designed storm: a stretch of the path where a hook
 * grows, holds and fades with no tornado.
 * @typedef {object} FalseAlarm
 * @property {number} start Where along the storm's path the hook is fully
 *   grown: 0 is the start of the path, 1 is the end.
 * @property {number} end Where along the path it starts to fade.
 */

// Where the browser keeps the storm being designed, so that it is still
// there after trying it out in the game.
export const designKey = 'squallline-design';

// The shortest a tornado can be, and the smallest gap between one tornado and
// the next, as a share of the path. The storm needs the gap to tell them
// apart.
export const leastShare = 0.02;

// The most corners a path and the most tornadoes a storm file may hold.
const mostCorners = 200;
const mostTornadoes = 20;
// No corner may be further than this many miles from the middle.
const furthestMiles = 100;

/**
 * How long each leg of a path is, in miles.
 * @param {Point[]} path
 */
function legsOf(path) {
  return path.slice(1).map((to, i) => Math.hypot(to.x - path[i].x, to.y - path[i].y));
}

/**
 * How long a path is, in miles.
 * @param {Point[]} path
 */
export function pathMiles(path) {
  return legsOf(path).reduce((sum, leg) => sum + leg, 0);
}

/**
 * The place a share of the way along a path.
 * @param {Point[]} path At least one corner.
 * @param {number} share 0 is the start, 1 is the end.
 * @returns {Point}
 */
export function placeAlong(path, share) {
  const legs = legsOf(path);
  let left = Math.max(0, Math.min(1, share)) * pathMiles(path);
  let i = 0;
  while (i < legs.length - 1 && left > legs[i]) left -= legs[i++];
  const part = legs[i] ? left / legs[i] : 0;
  const from = path[i];
  const to = path[i + 1] ?? from;
  return { x: from.x + (to.x - from.x) * part, y: from.y + (to.y - from.y) * part };
}

/**
 * The spot on a path nearest to a place.
 * @param {Point[]} path At least two corners.
 * @param {Point} place
 * @returns {{ share: number, miles: number }} How far along the path the spot
 *   is, and how far it is from the place.
 */
export function shareNearest(path, place) {
  const legs = legsOf(path);
  const length = pathMiles(path);
  let best = { share: 0, miles: Infinity };
  let before = 0;
  legs.forEach((leg, i) => {
    const from = path[i];
    const to = path[i + 1];
    // How far along this leg the nearest spot is, from 0 to 1.
    const part = leg
      ? Math.max(0, Math.min(1, ((place.x - from.x) * (to.x - from.x) + (place.y - from.y) * (to.y - from.y)) / leg ** 2))
      : 0;
    const miles = Math.hypot(from.x + (to.x - from.x) * part - place.x, from.y + (to.y - from.y) * part - place.y);
    if (miles < best.miles) best = { share: length ? (before + leg * part) / length : 0, miles };
    before += leg;
  });
  return best;
}

/**
 * Adds a tornado between two spots on the path. It is cut short rather than
 * overlap another tornado, and is not added at all where there is no room.
 * @param {Tornado[]} tornadoes
 * @param {number} a One end, as a share of the path.
 * @param {number} b The other end.
 * @param {number} strength
 * @returns {Tornado[]} The tornadoes in order, with the new one if it fitted.
 */
export function addTornado(tornadoes, a, b, strength) {
  let start = Math.min(a, b);
  let end = Math.max(a, b);
  // The room there is: from the tornado before the start to the one after it.
  const before = tornadoes.filter((t) => t.start <= start).at(-1);
  const after = tornadoes.find((t) => t.start > start);
  start = Math.max(start, before ? before.end + leastShare : 0);
  end = Math.min(end, after ? after.start - leastShare : 1);
  if (end - start < leastShare) return tornadoes;
  return [...tornadoes, { start, end, strength }].sort((one, other) => one.start - other.start);
}

/**
 * Moves one end of a tornado along the path. It stops short of the tornado's
 * other end, and of the next tornado along.
 * @param {Tornado[]} tornadoes
 * @param {number} index Which tornado.
 * @param {'start' | 'end'} which Which end of it.
 * @param {number} share Where to move it to.
 * @returns {Tornado[]}
 */
export function moveTornadoEnd(tornadoes, index, which, share) {
  const tornado = tornadoes[index];
  const least = which === 'start' ? (tornadoes[index - 1]?.end ?? -leastShare) + leastShare : tornado.start + leastShare;
  const most = which === 'start' ? tornado.end - leastShare : (tornadoes[index + 1]?.start ?? 1 + leastShare) - leastShare;
  const moved = { ...tornado, [which]: Math.max(least, Math.min(most, share)) };
  return tornadoes.map((t, i) => (i === index ? moved : t));
}

/**
 * The towns a tornado's path enters.
 * @param {Point[]} track The line the tornadoes follow over the ground: the
 *   storm's path, moved to where its tornadoes touch down.
 * @param {{ start: number, end: number }} tornado
 * @param {{ kind: string, name: string, x: number, y: number }[]} places
 * @param {Record<string, number>} townMiles How far each kind of place
 *   reaches from its middle, in miles.
 * @returns {string[]} The names of the towns, each once.
 */
export function townsEntered(track, tornado, places, townMiles) {
  // Check the path every tenth of a mile or so.
  const steps = Math.max(1, Math.ceil(((tornado.end - tornado.start) * pathMiles(track)) / 0.1));
  /** @type {Set<string>} */
  const entered = new Set();
  for (let step = 0; step <= steps; step++) {
    const spot = placeAlong(track, tornado.start + ((tornado.end - tornado.start) * step) / steps);
    for (const place of places) {
      if (Math.hypot(place.x - spot.x, place.y - spot.y) < (townMiles[place.kind] ?? 0)) entered.add(place.name);
    }
  }
  return [...entered];
}

/**
 * The words of a storm file.
 * @param {DesignedStorm} storm
 */
export function writeStorm(storm) {
  /** @param {number} n */
  const round = (n) => Math.round(n * 1000) / 1000;
  return JSON.stringify(
    {
      path: storm.path.map(({ x, y }) => ({ x: round(x), y: round(y) })),
      tornadoes: storm.tornadoes.map(({ start, end, strength }) => ({ start: round(start), end: round(end), strength })),
      falseAlarms: storm.falseAlarms.map(({ start, end }) => ({ start: round(start), end: round(end) })),
    },
    null,
    2,
  );
}

/**
 * Reads a storm file. Anything that is not a storm the game can run is
 * turned away, so a damaged file cannot break the game.
 * @param {string} text
 * @returns {DesignedStorm}
 */
export function readStorm(text) {
  /** @type {unknown} */
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error('This is not a storm file.');
  }
  // A file saved before there were false alarms has none.
  const { path, tornadoes, falseAlarms = [] } = /** @type {{ path?: unknown, tornadoes?: unknown, falseAlarms?: unknown }} */ (file ?? {});
  if (!Array.isArray(path) || !Array.isArray(tornadoes)) throw new Error('This is not a storm file.');
  if (path.length < 2 || path.length > mostCorners) throw new Error('The storm path needs between 2 and 200 corners.');
  if (tornadoes.length > mostTornadoes) throw new Error('The storm has too many tornadoes.');
  if (!Array.isArray(falseAlarms)) throw new Error('The false alarms are not a list.');
  if (falseAlarms.length > mostTornadoes) throw new Error('The storm has too many false alarms.');

  /** @param {unknown} n */
  const isNumber = (n) => typeof n === 'number' && Number.isFinite(n);
  /** @type {DesignedStorm} */
  const storm = { path: [], tornadoes: [], falseAlarms: [] };
  for (const corner of path) {
    const { x, y } = corner ?? {};
    if (!isNumber(x) || !isNumber(y) || Math.abs(x) > furthestMiles || Math.abs(y) > furthestMiles) {
      throw new Error('A corner of the storm path is not on the map.');
    }
    storm.path.push({ x, y });
  }
  let last = -leastShare;
  for (const tornado of tornadoes) {
    const { start, end, strength = 0 } = tornado ?? {};
    const inOrder = isNumber(start) && isNumber(end) && start >= 0 && end <= 1 && end > start && start > last;
    if (!inOrder) throw new Error('The tornadoes are out of order or overlap.');
    if (!Number.isInteger(strength) || strength < 0 || strength > 5) throw new Error('A tornado has a strength that is not EF0 to EF5.');
    storm.tornadoes.push({ start, end, strength });
    last = end;
  }
  last = -leastShare;
  for (const falseAlarm of falseAlarms) {
    const { start, end } = falseAlarm ?? {};
    const inOrder = isNumber(start) && isNumber(end) && start >= 0 && end <= 1 && end > start && start > last;
    if (!inOrder) throw new Error('The false alarms are out of order or overlap.');
    // A hook cannot be both a false alarm and the real thing.
    if (storm.tornadoes.some((tornado) => start <= tornado.end && end >= tornado.start)) {
      throw new Error('A false alarm overlaps a tornado.');
    }
    storm.falseAlarms.push({ start, end });
    last = end;
  }
  return storm;
}
