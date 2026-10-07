// The radar picture: how hard it is raining at any spot near a storm, in dBZ,
// the unit a real radar reports, and the colour a radar gives it. Like the
// rules, nothing in here touches the canvas or the page, so it runs under
// Node for the tests.

import { hailCore, inHailCore } from './rules.js';

/** @typedef {import('./rules.js').Point} Point */
/** @typedef {import('./rules.js').Storm} Storm */

// The storm lies south-west to north-east. These turn miles east and north
// into miles along it and across it.
const along = (/** @type {number} */ x, /** @type {number} */ y) => (x + y) / Math.SQRT2;
const across = (/** @type {number} */ x, /** @type {number} */ y) => (y - x) / Math.SQRT2;

// The lightest rain the radar shows, and how hard it rains where hail falls.
const faintestDbz = 20;
export const hailDbz = 65;

// The hook winds round the middle of the storm's rotation and ends at the
// funnel when it is fully grown. This is where that middle is, in miles east
// and north of the funnel.
const hookEndDegrees = 290;
const hookEndMiles = 0.9;
const hookStartDegrees = 70;
const hookStartMiles = 2.1;
const rotation = {
  x: -hookEndMiles * Math.cos((hookEndDegrees * Math.PI) / 180),
  y: -hookEndMiles * Math.sin((hookEndDegrees * Math.PI) / 180),
};

// The hook is worked out as this many short steps.
const hookSteps = 60;
// Each step's spot, in miles east and north of the funnel.
const hookSpots = Array.from({ length: hookSteps + 1 }, (_, i) => {
  const t = i / hookSteps;
  const angle = ((hookStartDegrees + (hookEndDegrees - hookStartDegrees) * t) * Math.PI) / 180;
  const miles = hookStartMiles + (hookEndMiles - hookStartMiles) * t;
  return { x: rotation.x + miles * Math.cos(angle), y: rotation.y + miles * Math.sin(angle) };
});

/**
 * A spot on a storm's hook.
 * @param {Storm} storm
 * @param {number} t How far along the hook: 0 is where it leaves the storm, 1
 *   is the tip of a fully grown one.
 * @returns {Point}
 */
export function hookSpot(storm, t) {
  const spot = hookSpots[Math.round(Math.max(0, Math.min(1, t)) * hookSteps)];
  return { x: storm.funnel.x + spot.x, y: storm.funnel.y + spot.y };
}

/**
 * A steady random number from 0 to 1 for a whole-number spot.
 * @param {number} i
 * @param {number} j
 * @param {number} seed
 */
function random(i, j, seed) {
  let n = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

/**
 * Smooth noise from -1 to 1.
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 */
function noise(x, y, seed) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = random(i, j, seed) * (1 - sx) + random(i + 1, j, seed) * sx;
  const bottom = random(i, j + 1, seed) * (1 - sx) + random(i + 1, j + 1, seed) * sx;
  return (top * (1 - sy) + bottom * sy) * 2 - 1;
}

// The storm's body, as soft patches of rain. Each has its middle, in miles
// along and across the storm from the storm's own middle, its strength there
// in dBZ, and how fast it falls away on each of its four sides. The first is
// the forward flank, the big shield of rain ahead of the storm: its right
// side, where warm air flows in, ends sharply. The second is the tight core.
const body = [
  { a: 3.4, c: 0.5, peak: 48, front: 5, back: 3.6, left: 3.2, right: 1.6 },
  { a: 0.8, c: 0.15, peak: 62, front: 2.8, back: 2, left: 1.9, right: 1.15 },
  { a: -1.4, c: 1.2, peak: 48, front: 1.8, back: 1.2, left: 1.3, right: 1.2 },
];

// How far the rain reaches from the storm's middle, in miles: south and
// west, and north and east. Beyond this it is dry.
const rainReach = { back: 8, front: 13 };

/**
 * How hard it is raining at a place, in dBZ.
 * @param {Point} point
 * @param {Storm} storm
 * @param {import('./rules.js').Tuning} day The numbers today plays by: the
 *   hail core's size comes from them.
 * @param {number} hookDbz How strong the hook's echo is.
 * @param {number} [seed] A whole number that changes the storm's ragged
 *   edges.
 * @returns {number}
 */
export function dbzAt(point, storm, day, hookDbz, seed = 0) {
  // Miles east and north of the storm's middle.
  const x = point.x - storm.x;
  const y = point.y - storm.y;
  if (x < -rainReach.back || x > rainReach.front || y < -rainReach.back || y > rainReach.front) return 0;

  // The hail core is exactly where the rules say hail falls, and is heaviest
  // in its middle.
  if (inHailCore(point, storm, day)) {
    const core = hailCore(storm, day);
    const fromMiddle = Math.hypot(along(point.x - core.x, point.y - core.y) / core.long, across(point.x - core.x, point.y - core.y) / core.wide);
    return hailDbz + 9 * Math.max(0, 1 - fromMiddle);
  }

  const a = along(x, y);
  const c = across(x, y);
  // Echoes add up as power, not as dBZ.
  let power = 0;
  for (const patch of body) {
    const da = (a - patch.a) / (a > patch.a ? patch.front : patch.back);
    const dc = (c - patch.c) / (c > patch.c ? patch.left : patch.right);
    power += 10 ** ((patch.peak * Math.exp(-0.5 * (da * da + dc * dc))) / 10);
  }

  // Miles east and north of the funnel.
  const fx = point.x - storm.funnel.x;
  const fy = point.y - storm.funnel.y;

  // The hook: a thin ridge of lighter rain along its curve, thinner and
  // fainter toward its tip.
  if (storm.hook > 0 && Math.hypot(fx - rotation.x, fy - rotation.y) < 3) {
    const last = Math.round(Math.min(1, storm.hook) * hookSteps);
    let nearest = Infinity;
    let at = 0;
    for (let i = 0; i <= last; i++) {
      const d = (fx - hookSpots[i].x) ** 2 + (fy - hookSpots[i].y) ** 2;
      if (d < nearest) {
        nearest = d;
        at = i / hookSteps;
      }
    }
    const wide = 0.45 - 0.17 * at;
    power += 10 ** (((hookDbz - 8 * at) * Math.exp(-0.5 * (nearest / (wide * wide)))) / 10);
  }

  // The debris ball: what a tornado on the ground throws up, at the hook's
  // tip. A stronger tornado throws up a bigger, brighter one.
  if (storm.tornado > 0) {
    const reach = (0.2 + 0.035 * storm.strength) * (0.5 + 0.5 * storm.tornado);
    power += 10 ** (((50 + 2 * storm.strength) * Math.exp((-0.5 * (fx * fx + fy * fy)) / (reach * reach))) / 10);
  }

  let dbz = 10 * Math.log10(power);
  // Ragged edges: big slow lumps and small quick ones.
  dbz += 6 * noise(x * 0.35, y * 0.35, seed) + 4 * noise(x * 1.1 + 40, y * 1.1, seed + 1) + 2.5 * noise(x * 3.1, y * 3.1 + 70, seed + 2);
  // Everything outside the hail core stays below hail's colour.
  return Math.min(dbz, hailDbz - 2);
}

// The colours a weather service radar uses, one for every 5 dBZ from the
// faintest: its dBZ, then red, green and blue.
const scale = [
  [20, 0x02, 0xfd, 0x02],
  [25, 0x01, 0xc5, 0x01],
  [30, 0x00, 0x8e, 0x00],
  [35, 0xfd, 0xf8, 0x02],
  [40, 0xe5, 0xbc, 0x00],
  [45, 0xfd, 0x95, 0x00],
  [50, 0xfd, 0x00, 0x00],
  [55, 0xd4, 0x00, 0x00],
  [60, 0xbc, 0x00, 0x00],
  [65, 0xf8, 0x00, 0xfd],
  [70, 0x98, 0x54, 0xc6],
];

/**
 * The colour a radar gives this much rain.
 * @param {number} dbz
 * @returns {number[] | undefined} Its dBZ step, red, green and blue, or
 *   nothing when the rain is too light to show.
 */
export function colourOf(dbz) {
  if (dbz < faintestDbz) return undefined;
  return scale[Math.min(scale.length - 1, Math.floor((dbz - faintestDbz) / 5))];
}

/**
 * How much of the map this much rain hides, in percent.
 * @param {number} dbz Rain heavy enough to show.
 * @param {number} light What the lightest rain hides.
 * @param {number} heavy What hail hides.
 */
export function coverOf(dbz, light, heavy) {
  return light + (heavy - light) * Math.max(0, Math.min(1, (dbz - faintestDbz) / (hailDbz - faintestDbz)));
}

/**
 * Which way a place is from the radar, in turns clockwise from north: 0 is
 * north, 0.25 is east.
 * @param {Point} point
 * @param {Point} site Where the radar stands.
 */
export function bearingOf(point, site) {
  return (Math.atan2(point.x - site.x, point.y - site.y) / (Math.PI * 2) + 1) % 1;
}

/**
 * Whether the radar's beam has just passed over a bearing.
 * @param {number} bearing In turns clockwise from north, from 0 to 1.
 * @param {number} beam How far the beam has turned in all, in turns.
 * @param {number} turned How much of that it turned just now.
 */
export function beamPassed(bearing, beam, turned) {
  if (turned >= 1) return true;
  // How far the beam has gone on past the bearing.
  const past = (((beam - bearing) % 1) + 1) % 1;
  return past < turned;
}
