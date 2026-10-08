// What can be tapped or clicked on the screens: where each choice sits in the
// game picture, and what it says. Like the rules, nothing in here touches the
// canvas or the page, so it runs under Node for the tests.

/**
 * A choice on a screen: the key that makes it, and what it does in words,
 * starting with a small letter.
 * @typedef {{ key: string, words: string }} Choice
 */

/**
 * Somewhere in the game picture that can be tapped or clicked, in the
 * picture's own pixels, and what a tap there does: the key it stands for, or
 * `part:` and a number for a part in the garage.
 * @typedef {{ action: string, left: number, top: number, wide: number, tall: number }} Target
 */

/**
 * The targets painted in the newest frame. Painting a choice adds it here,
 * and each frame starts by emptying the list.
 * @type {Target[]}
 */
export const targets = [];

// How the player last played. A finger sets touch, a key clears it, and a
// mouse leaves it alone.
export const input = { touch: false };

/**
 * Where a spot on the page falls in the game picture. The picture keeps its
 * shape inside its box. It sits in the middle of the box, or against the top
 * of it while the touch controls need the room underneath.
 * @param {{ x: number, y: number }} point A spot on the page.
 * @param {{ left: number, top: number, width: number, height: number }} box
 *   The canvas's box on the page.
 * @param {{ width: number, height: number }} picture The picture's own size.
 * @param {boolean} [atTop] True when the picture sits against the top.
 * @returns {{ x: number, y: number }}
 */
export function pictureSpot(point, box, picture, atTop = false) {
  const scale = Math.min(box.width / picture.width, box.height / picture.height);
  const above = atTop ? 0 : (box.height - picture.height * scale) / 2;
  return {
    x: (point.x - box.left - (box.width - picture.width * scale) / 2) / scale,
    y: (point.y - box.top - above) / scale,
  };
}

/**
 * Which way the joystick is steering: see `Steering` in the rules. A thumb
 * resting near the middle steers nowhere.
 * @param {{ x: number, y: number }} offset How far the thumb is from the
 *   joystick's middle, in pixels: x to the right and y down the screen.
 * @param {number} reach How far the joystick's edge is from its middle.
 * @param {number} deadShare How far out the thumb must be before it counts,
 *   as a share of the reach.
 * @returns {{ x: number, y: number }} At most one long. Up the screen is
 *   north.
 */
export function stickSteering(offset, reach, deadShare) {
  const far = Math.hypot(offset.x, offset.y);
  if (!far || far < reach * deadShare) return { x: 0, y: 0 };
  const size = Math.min(1, far / reach) / far;
  // Adding 0 turns a -0 into a plain 0.
  return { x: offset.x * size + 0, y: -offset.y * size + 0 };
}

/**
 * What each chase button says right now, by the key it stands for. A button
 * that cannot be used has no words, and is not shown.
 * @param {{ filming: boolean, anchoring: boolean }} state
 * @param {boolean} canAnchor True when the vehicle can anchor now.
 * @param {{ film: string, driveOn: string, anchor: string, pullUp: string, radar: string, map: string, pause: string }} names
 * @returns {Record<string, string>}
 */
export function chaseButtons(state, canAnchor, names) {
  return {
    ' ': state.filming ? names.driveOn : names.film,
    a: canAnchor ? (state.anchoring ? names.pullUp : names.anchor) : '',
    v: names.radar,
    // The whole territory is a view of the map, not of the windshield.
    z: state.filming ? '' : names.map,
    p: names.pause,
  };
}

/**
 * What a tap at a spot in the picture does, or '' for a tap on nothing. Where
 * two targets overlap, the one painted last is on top.
 * @param {Target[]} painted
 * @param {{ x: number, y: number }} spot
 * @returns {string}
 */
export function targetAt(painted, spot) {
  const hit = painted.findLast((t) => spot.x >= t.left && spot.x < t.left + t.wide && spot.y >= t.top && spot.y < t.top + t.tall);
  return hit ? hit.action : '';
}

/**
 * What a choice reads as. A keyboard player is told the key ("N: new game");
 * a touch player has no keys, so is told only what it does ("New game").
 * @param {Choice} choice
 * @param {boolean} touch
 * @returns {string}
 */
export function choiceWords(choice, touch) {
  const capital = (/** @type {string} */ text) => text[0].toUpperCase() + text.slice(1);
  return touch ? capital(choice.words) : `${capital(choice.key)}: ${choice.words}`;
}
