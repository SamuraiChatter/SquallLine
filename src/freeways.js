// Freeways as the car drives them. The map stores a freeway as two lines side
// by side, one for each direction, with short ramps to the roads it meets.
// That is how it is drawn, but it is too fine to drive with four arrow keys.
// So for driving, each freeway becomes one line, and each interchange becomes
// one junction where the cross road meets that line. Nothing in here touches
// the canvas or the page, so it runs under Node for the tests.

/** @typedef {import('./rules.js').Point} Point */

/**
 * A road from the map, in miles.
 * @typedef {object} Road
 * @property {string} class What kind of road it is. A freeway is a
 *   "motorway" and its ramps are "motorway_link".
 * @property {Point[]} points
 */

/**
 * One straight step of a road.
 * @typedef {object} Step
 * @property {Point[]} line The road it is a step of.
 * @property {number} i Which step: from point i to point i + 1.
 * @property {Point} a
 * @property {Point} b
 * @property {number} miles How long it is.
 * @property {number} x Its direction east, one mile long.
 * @property {number} y Its direction north.
 */

// Two lines of freeway that run opposite ways within this many miles of each
// other are the two sides of one freeway.
const sideMiles = 0.25;
// How squarely against each other the two sides have to run: -0.7 is within
// 45 degrees of dead against.
const against = -0.7;
// A ramp serves the nearest place a road crosses the freeway, if the foot of
// the ramp is within this many miles of it along the roads. A diamond's ramps
// come down a tenth of a mile from the bridge; a ramp onto a service road can
// come down half a mile from it.
const rampReachMiles = 0.6;
// A second crossing no more than this many miles further along the roads
// than the nearest one is served by the same ramp.
const besideMiles = 0.1;
// A road or freeway that ends at ramps is joined straight to the freeway, if
// the freeway is within this many miles.
const straightMiles = 1;
// Two freeways that cross are joined if a ramp comes this close to the place.
const rampNearMiles = 0.3;
// Junctions closer together than this many miles count as one interchange.
const sameInterchangeMiles = 0.05;
// How many miles across each square of the index below is.
const squareMiles = 0.25;

/**
 * A number that two points share only if they are the same place. Map points
 * are yards apart at the least, so the nearest inch tells them apart, and a
 * number is much quicker to make than words are.
 * @param {Point} p
 */
const keyOf = (p) => Math.round(p.x * 1e5) * 2 ** 26 + Math.round(p.y * 1e5);

/**
 * The steps of some roads, sorted into squares so the ones near a place can
 * be found without looking at them all.
 * @param {Point[][]} lines
 */
function indexOf(lines) {
  /** @type {Map<string, Step[]>} */
  const squares = new Map();
  /** @type {Step[]} */
  const all = [];
  for (const line of lines) {
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i];
      const b = line[i + 1];
      const miles = Math.hypot(b.x - a.x, b.y - a.y);
      if (!miles) continue;
      const step = { line, i, a, b, miles, x: (b.x - a.x) / miles, y: (b.y - a.y) / miles };
      all.push(step);
      for (const key of squaresOver(a, b, 0)) {
        const steps = squares.get(key);
        if (steps) steps.push(step);
        else squares.set(key, [step]);
      }
    }
  }
  return {
    all,
    /**
     * Every step that comes within so many miles of the stretch from a to b,
     * and some that do not. A long step can turn up more than once.
     * @param {Point} a
     * @param {Point} b
     * @param {number} miles
     */
    near: (a, b, miles) => squaresOver(a, b, miles).flatMap((key) => squares.get(key) ?? []),
  };
}

/**
 * The squares within so many miles of the stretch from a to b.
 * @param {Point} a
 * @param {Point} b
 * @param {number} miles
 */
function squaresOver(a, b, miles) {
  const keys = [];
  const first = (/** @type {number} */ n) => Math.floor((n - miles) / squareMiles);
  const last = (/** @type {number} */ n) => Math.floor((n + miles) / squareMiles);
  for (let column = first(Math.min(a.x, b.x)); column <= last(Math.max(a.x, b.x)); column++) {
    for (let row = first(Math.min(a.y, b.y)); row <= last(Math.max(a.y, b.y)); row++) keys.push(`${column},${row}`);
  }
  return keys;
}

/**
 * The point on a step nearest a place, and how far along the step it is: 0
 * is the step's start and 1 its end.
 * @param {Step} step
 * @param {Point} p
 */
function nearestOn(step, p) {
  const along = Math.max(0, Math.min(1, ((p.x - step.a.x) * step.x + (p.y - step.a.y) * step.y) / step.miles));
  // The step's own end, exactly, so that a road joined there shares the point.
  const x = along === 1 ? step.b.x : step.a.x + step.x * step.miles * along;
  const y = along === 1 ? step.b.y : step.a.y + step.y * step.miles * along;
  return { along, x, y, miles: Math.hypot(x - p.x, y - p.y) };
}

/**
 * Where two steps cross, as how far along the first one, or -1 if they do
 * not. Steps that share an end are joined there already, and do not cross.
 * @param {Step} s
 * @param {Step} t
 */
function crossingOf(s, t) {
  const d = s.x * t.y - s.y * t.x;
  if (!d || [s.a, s.b].some((end) => keyOf(end) === keyOf(t.a) || keyOf(end) === keyOf(t.b))) return -1;
  const alongS = ((t.a.x - s.a.x) * t.y - (t.a.y - s.a.y) * t.x) / d / s.miles;
  const alongT = ((t.a.x - s.a.x) * s.y - (t.a.y - s.a.y) * s.x) / d / t.miles;
  return alongS >= 0 && alongS <= 1 && alongT >= 0 && alongT <= 1 ? alongS : -1;
}

/**
 * Of the freeways' lines, the ones for one direction of travel: one side of
 * each freeway.
 * @param {Point[][]} freeways
 * @returns {Point[][]}
 */
function oneSideOf(freeways) {
  const index = indexOf(freeways);
  const numberOf = new Map(freeways.map((line, n) => [line, n]));

  // Each line is on the same side as the line it is told about, or on the
  // other side: `flipped` says which. Following `told` from line to line
  // ends at one line that all of them are sorted against.
  const told = freeways.map((_, n) => n);
  const flipped = freeways.map(() => false);
  /**
   * @param {number} n
   * @returns {number} The line that line n is sorted against.
   */
  const head = (n) => {
    if (told[n] === n) return n;
    const parent = told[n];
    told[n] = head(parent);
    flipped[n] = flipped[n] !== flipped[parent];
    return told[n];
  };
  /**
   * Notes that two lines are on the same side, or on opposite sides. Where
   * that disagrees with what is already known, what is known stands.
   * @param {number} m
   * @param {number} n
   * @param {boolean} opposite
   */
  const sort = (m, n, opposite) => {
    const headM = head(m);
    const headN = head(n);
    if (headM === headN) return;
    told[headM] = headN;
    flipped[headM] = (flipped[m] !== flipped[n]) !== opposite;
  };

  // First, each line against the line across the freeway from it: the one
  // that runs the other way alongside most of its length.
  freeways.forEach((line, n) => {
    /** @type {Map<number, number>} */
    const alongside = new Map();
    for (let i = 0; i + 1 < line.length; i++) {
      const middle = { x: (line[i].x + line[i + 1].x) / 2, y: (line[i].y + line[i + 1].y) / 2 };
      const miles = Math.hypot(line[i + 1].x - line[i].x, line[i + 1].y - line[i].y);
      if (!miles) continue;
      const x = (line[i + 1].x - line[i].x) / miles;
      const y = (line[i + 1].y - line[i].y) / miles;
      let across = -1;
      let least = sideMiles;
      for (const step of index.near(middle, middle, sideMiles)) {
        if (step.x * x + step.y * y > against) continue;
        const gap = nearestOn(step, middle).miles;
        if (gap < least) {
          least = gap;
          across = /** @type {number} */ (numberOf.get(step.line));
        }
      }
      if (across >= 0) alongside.set(across, (alongside.get(across) ?? 0) + miles);
    }
    let across = -1;
    for (const [other, miles] of alongside) if (across < 0 || miles > /** @type {number} */ (alongside.get(across))) across = other;
    if (across >= 0) sort(n, across, true);
  });

  // Then each line with the lines it shares a point with: they carry on
  // from one another, so they are on the same side. A few short lines in the
  // middle of a big interchange join both sides; they fall where they fall.
  /** @type {Map<number, number>} */
  const seen = new Map();
  freeways.forEach((line, n) => {
    for (const point of line) {
      const key = keyOf(point);
      const before = seen.get(key);
      if (before === undefined) seen.set(key, n);
      else sort(n, before, false);
    }
  });

  return freeways.filter((_, n) => {
    head(n);
    return !flipped[n];
  });
}

/**
 * The roads as the car drives them: every road that is not a freeway as it
 * is, one line for each freeway, no ramps, and a junction wherever a ramp
 * joined a freeway to another road.
 * @param {Road[]} roads
 * @returns {{ lines: Point[][], interchanges: Point[] }} Each road as a list
 *   of points: roads that share a point are joined there. And the places
 *   where the car can get on or off a freeway.
 */
export function drivingLines(roads) {
  const freeways = roads.filter((road) => road.class === 'motorway').map((road) => road.points);
  if (!freeways.length) return { lines: roads.map((road) => road.points), interchanges: [] };
  const onFreeway = new Set(freeways.flatMap((line) => line.map(keyOf)));
  const others = roads.filter((road) => road.class !== 'motorway' && road.class !== 'motorway_link').map((road) => road.points);
  // Ramps come in sets that hang together. A set that reaches no freeway
  // only joins ordinary roads, so it stays, as one more ordinary road.
  /** @type {Point[][]} */
  const ramps = [];
  for (const set of joinedSets(roads.filter((road) => road.class === 'motorway_link').map((road) => road.points))) {
    (set.some((line) => line.some((point) => onFreeway.has(keyOf(point)))) ? ramps : others).push(...set);
  }
  const kept = oneSideOf(freeways);
  const keptIndex = indexOf(kept);

  // New points to put into a line: which step each goes in, and how far
  // along it.
  /** @type {Map<Point[], { i: number, along: number, point: Point }[]>} */
  const cuts = new Map();
  /**
   * @param {Step} step
   * @param {number} along
   * @param {Point} point
   */
  const cut = (step, along, point) => {
    const list = cuts.get(step.line);
    if (list) list.push({ i: step.i, along, point });
    else cuts.set(step.line, [{ i: step.i, along, point }]);
  };
  // Every junction made between a freeway and another road or freeway.
  /** @type {Point[]} */
  const junctions = [];
  // Short new roads that join a point straight to a freeway.
  /** @type {Point[][]} */
  const joins = [];
  /**
   * Joins a point straight to the nearest point of a kept freeway line.
   * @param {Point} from
   * @param {(step: Step, spot: Point) => boolean} allowed Which points of
   *   which steps will do.
   */
  const joinStraight = (from, allowed) => {
    let onto = null;
    for (const step of keptIndex.all) {
      const spot = nearestOn(step, from);
      if (spot.miles < (onto ? onto.spot.miles : straightMiles) && allowed(step, spot)) onto = { step, spot };
    }
    if (!onto) return;
    const point = { x: onto.spot.x, y: onto.spot.y };
    cut(onto.step, onto.spot.along, point);
    joins.push([from, point]);
    junctions.push(point);
  };

  // Most roads are miles from any freeway. Looking only at the ones with a
  // point in the same square mile as a freeway or ramp, or the next square
  // over, keeps the map quick to load.
  /** @param {Point} p */
  const mileOf = (p) => Math.floor(p.x) * 1000 + Math.floor(p.y);
  const freewayMiles = new Set();
  for (const line of [...freeways, ...ramps]) {
    for (const { x, y } of line) {
      for (const east of [-1, 0, 1]) for (const north of [-1, 0, 1]) freewayMiles.add(mileOf({ x: x + east, y: y + north }));
    }
  }
  // The other roads as points and the steps between them, to follow a road
  // away from the foot of a ramp.
  /** @type {Map<number, { to: Point, step: Step }[]>} */
  const ways = new Map();
  const otherIndex = indexOf(others.filter((line) => line.some((point) => freewayMiles.has(mileOf(point)))));
  for (const step of otherIndex.all) {
    for (const [from, to] of [[step.a, step.b], [step.b, step.a]]) {
      const list = ways.get(keyOf(from));
      if (list) list.push({ to, step });
      else ways.set(keyOf(from), [{ to, step }]);
    }
  }

  // Every place another road crosses a kept freeway line: a bridge, unless a
  // ramp turns out to serve it.
  /** @type {Map<Step, { along: number, over: Step, point: Point, joined: boolean }[]>} */
  const bridges = new Map();
  for (const over of keptIndex.all) {
    for (const step of new Set(otherIndex.near(over.a, over.b, 0))) {
      const along = crossingOf(step, over);
      if (along < 0) continue;
      const point = { x: step.a.x + step.x * step.miles * along, y: step.a.y + step.y * step.miles * along };
      const bridge = { along, over, point, joined: false };
      const list = bridges.get(step);
      if (list) list.push(bridge);
      else bridges.set(step, [bridge]);
    }
  }

  // The points where something that is left out meets a road that stays.
  const onKept = new Set(kept.flatMap((line) => line.map(keyOf)));
  /**
   * @param {Point[][]} lines
   * @returns {Point[]}
   */
  const feetOf = (lines) => {
    /** @type {Map<number, Point>} */
    const feet = new Map();
    for (const line of lines) {
      for (const point of line) if (ways.has(keyOf(point)) && !onKept.has(keyOf(point))) feet.set(keyOf(point), point);
    }
    return [...feet.values()];
  };

  // The foot of each ramp, where it comes down to another road.
  for (const foot of feetOf(ramps)) {
    // Follow the roads out from the foot to every place one crosses the
    // freeway within reach, and how far along the roads each is.
    /** @type {Map<number, number>} */
    const reached = new Map([[keyOf(foot), 0]]);
    /** @type {Map<{ joined: boolean }, number>} */
    const found = new Map();
    const queue = [{ point: foot, miles: 0 }];
    while (queue.length) {
      const { point, miles } = /** @type {{ point: Point, miles: number }} */ (queue.pop());
      if (miles > /** @type {number} */ (reached.get(keyOf(point)))) continue;
      for (const { to, step } of ways.get(keyOf(point)) ?? []) {
        for (const bridge of bridges.get(step) ?? []) {
          const there = miles + Math.hypot(bridge.point.x - point.x, bridge.point.y - point.y);
          if (there < (found.get(bridge) ?? rampReachMiles)) found.set(bridge, there);
        }
        const there = miles + step.miles;
        if (there < (reached.get(keyOf(to)) ?? rampReachMiles)) {
          reached.set(keyOf(to), there);
          queue.push({ point: to, miles: there });
        }
      }
    }
    // The ramp serves the nearest crossing, and any others right beside it:
    // in a big interchange two lines of freeway can run side by side.
    const least = Math.min(...found.values());
    for (const [bridge, miles] of found) if (miles <= least + besideMiles) bridge.joined = true;
    // No road crosses near here: the road ends at the freeway, or runs
    // beside it. Join the foot straight to the nearest point of the freeway.
    if (!found.size) joinStraight(foot, () => true);
  }

  // Where a freeway ends and carries on as an ordinary road, the side that
  // is not kept leaves that road's other side loose. Join it straight on.
  const keptLines = new Set(kept);
  const dropped = freeways.filter((line) => !keptLines.has(line));
  for (const foot of feetOf(dropped)) joinStraight(foot, () => true);

  // Where one freeway ends at another, its line stops where its ramps began,
  // short of the other freeway. Carry it on to the nearest point ahead.
  /** @type {Map<number, number>} */
  const keptAt = new Map();
  for (const line of kept) for (const point of line) keptAt.set(keyOf(point), (keptAt.get(keyOf(point)) ?? 0) + 1);
  // An end that met nothing on the map either is the edge of the territory.
  const cutLoose = new Set([...ramps, ...dropped].flatMap((line) => line.map(keyOf)));
  for (const line of kept) {
    for (const [end, before] of [[line[0], line[1]], [line[line.length - 1], line[line.length - 2]]]) {
      const key = keyOf(end);
      if (/** @type {number} */ (keptAt.get(key)) > 1 || ways.has(key) || !cutLoose.has(key)) continue;
      joinStraight(end, (step, spot) => step.line !== line && (spot.x - end.x) * (end.x - before.x) + (spot.y - end.y) * (end.y - before.y) > 0);
    }
  }

  for (const [step, list] of bridges) {
    for (const bridge of list) {
      if (!bridge.joined) continue;
      cut(step, bridge.along, bridge.point);
      cut(bridge.over, nearestOn(bridge.over, bridge.point).along, bridge.point);
      junctions.push(bridge.point);
    }
  }

  // Where two freeways cross, with ramps close by, they make one junction.
  const rampIndex = indexOf(ramps);
  const numberOf = new Map(kept.map((line, n) => [line, n]));
  for (const step of keptIndex.all) {
    for (const over of new Set(keptIndex.near(step.a, step.b, 0))) {
      // Each pair once, and never a line with itself.
      if (/** @type {number} */ (numberOf.get(over.line)) <= /** @type {number} */ (numberOf.get(step.line))) continue;
      const along = crossingOf(step, over);
      if (along < 0) continue;
      const point = { x: step.a.x + step.x * step.miles * along, y: step.a.y + step.y * step.miles * along };
      if (!rampIndex.near(point, point, rampNearMiles).some((ramp) => nearestOn(ramp, point).miles < rampNearMiles)) continue;
      cut(step, along, point);
      cut(over, nearestOn(over, point).along, point);
      junctions.push(point);
    }
  }

  const withCuts = [...others, ...kept].map((line) => {
    const list = cuts.get(line);
    if (!list) return line;
    list.sort((a, b) => a.i - b.i || a.along - b.along);
    /** @type {Point[]} */
    const points = [];
    let next = 0;
    line.forEach((point, i) => {
      points.push(point);
      for (; next < list.length && list[next].i === i; next++) points.push(list[next].point);
    });
    return points;
  });
  const lines = [...withCuts, ...joins];

  // How many ways lead out of each junction. One with only two is where a
  // freeway's end was carried on to the end of another: nowhere to turn.
  /** @type {Map<number, Set<number>>} */
  const waysOut = new Map(junctions.map((junction) => [keyOf(junction), new Set()]));
  for (const line of lines) {
    line.forEach((point, i) => {
      const ways = waysOut.get(keyOf(point));
      if (!ways) return;
      for (const next of [line[i - 1], line[i + 1]]) if (next && keyOf(next) !== keyOf(point)) ways.add(keyOf(next));
    });
  }
  // Junctions a few yards apart, such as the two a divided cross road makes,
  // are one interchange.
  /** @type {Point[]} */
  const interchanges = [];
  for (const junction of junctions) {
    if (/** @type {Set<number>} */ (waysOut.get(keyOf(junction))).size < 3) continue;
    if (!interchanges.some((other) => Math.hypot(other.x - junction.x, other.y - junction.y) < sameInterchangeMiles)) interchanges.push(junction);
  }
  return { lines, interchanges };
}

/**
 * Sorts lines into sets that hang together: two lines are in the same set if
 * they share a point, or if a chain of lines that do joins them.
 * @param {Point[][]} lines
 * @returns {Point[][][]}
 */
function joinedSets(lines) {
  /** @type {Map<number, Point[][]>} */
  const setAt = new Map();
  /** @type {Set<Point[][]>} */
  const sets = new Set();
  for (const line of lines) {
    let set = [line];
    sets.add(set);
    for (const point of line) {
      const key = keyOf(point);
      const other = setAt.get(key);
      if (!other) setAt.set(key, set);
      else if (other !== set) {
        // Pour the smaller set into the bigger one.
        const [big, small] = other.length >= set.length ? [other, set] : [set, other];
        for (const moved of small) {
          big.push(moved);
          for (const p of moved) if (setAt.get(keyOf(p)) === small) setAt.set(keyOf(p), big);
        }
        sets.delete(small);
        set = big;
        setAt.set(key, big);
      }
    }
  }
  return [...sets];
}
