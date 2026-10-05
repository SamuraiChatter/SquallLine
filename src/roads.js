// The road network, and how the car drives along it. Like the rules, nothing
// in here touches the canvas or the page, so it runs under Node for the tests.

/** @typedef {import('./rules.js').Point} Point */

/**
 * Every road, as points joined to their neighbours. A point is a junction, a
 * bend or a road's end. Two roads are joined only where they share a point,
 * so a bridge over a road does not join it.
 * @typedef {object} RoadNetwork
 * @property {number[]} xs How many miles east of the middle each point is.
 * @property {number[]} ys How many miles north.
 * @property {number[][]} ways For each point, the points one step along a
 *   road from it.
 */

/**
 * Where the car is on the network: on the stretch between two neighbouring
 * points.
 * @typedef {object} RoadSpot
 * @property {number} from The point behind the car.
 * @property {number} to The point ahead of it. The same as `from` when the
 *   car has only just been put down on a point.
 * @property {number} miles How far the car is past `from`.
 * @property {boolean} moving False when the car has stopped.
 */

// How squarely an arrow has to point back down the road before the car turns
// round: 0.5 is within 60 degrees. Less than that and the car carries on.
const turnBack = 0.5;
// With no road the way the arrow points, the car follows the road it is on
// for as long as the road bends no more sharply than 60 degrees at once and
// does not swing more than 120 degrees away from the arrow.
const followBend = 0.5;
const followAgainst = -0.5;

/**
 * Builds the network from the roads' lines. Every road can be driven both
 * ways.
 * @param {Point[][]} lines Each road as a list of points, in miles.
 * @returns {RoadNetwork}
 */
export function buildNetwork(lines) {
  /** @type {RoadNetwork} */
  const network = { xs: [], ys: [], ways: [] };
  /** @type {Map<string, number>} */
  const seen = new Map();
  for (const line of lines) {
    let before = -1;
    for (const { x, y } of line) {
      const key = `${x},${y}`;
      let point = seen.get(key);
      if (point === undefined) {
        point = network.xs.length;
        seen.set(key, point);
        network.xs.push(x);
        network.ys.push(y);
        network.ways.push([]);
      }
      if (before >= 0 && before !== point && !network.ways[before].includes(point)) {
        network.ways[before].push(point);
        network.ways[point].push(before);
      }
      before = point;
    }
  }
  return network;
}

/**
 * The car put down on the point of the network nearest a place.
 * @param {RoadNetwork} network
 * @param {Point} place
 * @returns {RoadSpot}
 */
export function nearestSpot(network, place) {
  let nearest = 0;
  let least = Infinity;
  for (let point = 0; point < network.xs.length; point++) {
    const miles = Math.hypot(network.xs[point] - place.x, network.ys[point] - place.y);
    if (miles < least) {
      least = miles;
      nearest = point;
    }
  }
  return { from: nearest, to: nearest, miles: 0, moving: false };
}

/**
 * Where on the map a spot on the network is.
 * @param {RoadNetwork} network
 * @param {RoadSpot} spot
 * @returns {Point}
 */
export function placeOf(network, spot) {
  const { xs, ys } = network;
  const share = spot.miles / (gap(network, spot.from, spot.to) || 1);
  return {
    x: xs[spot.from] + (xs[spot.to] - xs[spot.from]) * share,
    y: ys[spot.from] + (ys[spot.to] - ys[spot.from]) * share,
  };
}

/**
 * How many miles apart two points are.
 * @param {RoadNetwork} network
 * @param {number} a
 * @param {number} b
 */
function gap(network, a, b) {
  return Math.hypot(network.xs[b] - network.xs[a], network.ys[b] - network.ys[a]);
}

/**
 * The direction from one point to another, one mile long.
 * @param {RoadNetwork} network
 * @param {number} a
 * @param {number} b
 * @returns {Point}
 */
function toward(network, a, b) {
  const miles = gap(network, a, b);
  return { x: (network.xs[b] - network.xs[a]) / miles, y: (network.ys[b] - network.ys[a]) / miles };
}

/**
 * Drives the car along the roads for so many miles. It goes the way along the
 * road that is closest to the arrow, and at a junction takes the road closest
 * to the arrow. With no arrow held it stops.
 * @param {RoadNetwork} network
 * @param {RoadSpot} spot
 * @param {import('./rules.js').Steering} steering
 * @param {number} miles
 * @returns {RoadSpot}
 */
export function drive(network, spot, steering, miles) {
  const size = Math.hypot(steering.x, steering.y);
  if (!size) return spot.moving ? { ...spot, moving: false } : spot;
  const arrow = { x: steering.x / size, y: steering.y / size };

  let { from, to, miles: along, moving } = spot;
  // Each turn of the loop picks a way to go and drives to the next point, or
  // until the miles run out. The count is a backstop: a frame covers a few
  // points at most.
  for (let turns = 0; miles > 0 && turns < 10000; turns++) {
    const atPoint = along >= gap(network, from, to);
    const ahead = from === to ? null : toward(network, from, to);
    // At a point, every road out of it is a way to go. Between two points
    // there are only two: on, and back.
    const ways =
      atPoint || !ahead
        ? network.ways[to].map((point) => ({ to: point, ...toward(network, to, point) }))
        : [{ to, ...ahead }, { to: from, x: -ahead.x, y: -ahead.y }];
    const next = choose(ways, arrow, moving ? ahead : null, moving ? from : -1);
    if (next < 0) {
      moving = false;
      break;
    }
    if (atPoint) {
      from = to;
      to = next;
      along = 0;
    } else if (next === from) {
      along = gap(network, from, to) - along;
      [from, to] = [to, from];
    }
    moving = true;

    const rest = gap(network, from, to) - along;
    // Land exactly on the point, so the next turn sees every road out of it.
    along = miles >= rest ? gap(network, from, to) : along + miles;
    miles -= rest;
  }
  return { from, to, miles: along, moving };
}

/**
 * Picks which way the car goes next.
 * @param {(Point & { to: number })[]} ways Each way out of where the car is:
 *   the point it leads to, and its direction.
 * @param {Point} arrow The way the player is steering, one mile long.
 * @param {Point | null} heading The way the car is moving, or null when it
 *   has stopped.
 * @param {number} back The point behind a moving car, or -1.
 * @returns {number} The point to drive toward, or -1 to stop.
 */
function choose(ways, arrow, heading, back) {
  // Two roads this close to the arrow count as equally close.
  const tie = 1e-9;
  // The way on that is closest to the arrow, the way on that is straightest,
  // and the way back. Each remembers how well it lines up: 1 is exactly along
  // the arrow (or the heading), 0 is square to it, -1 is dead against it.
  let on = null;
  let straight = null;
  let behind = null;
  for (const way of ways) {
    const scored = {
      to: way.to,
      arrow: way.x * arrow.x + way.y * arrow.y,
      heading: heading ? way.x * heading.x + way.y * heading.y : 0,
    };
    if (way.to === back) {
      behind = scored;
      continue;
    }
    // Two roads equally close to the arrow: take the straighter one.
    if (!on || scored.arrow > on.arrow + tie || (scored.arrow > on.arrow - tie && scored.heading > on.heading)) on = scored;
    if (!straight || scored.heading > straight.heading) straight = scored;
  }

  if (behind && behind.arrow > turnBack && (!on || behind.arrow > on.arrow)) return behind.to;
  if (on && on.arrow > tie) return on.to;
  // No road goes the arrow's way. A moving car follows its road round the
  // bend, so an arrow held early turns at the next junction.
  if (heading && straight && straight.heading > followBend && straight.arrow > followAgainst) return straight.to;
  return -1;
}
