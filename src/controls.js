// The touch controls laid over the game during a chase: the joystick and the
// buttons. They are part of the page, not of the game picture, so they keep
// their size on any screen. The sums behind them are in taps.js.

import { tuning } from '../tuning.js';
import { stickSteering } from './taps.js';

const box = /** @type {HTMLElement} */ (document.querySelector('.controls'));
const stick = /** @type {HTMLElement} */ (box.querySelector('.stick'));
const knob = /** @type {HTMLElement} */ (box.querySelector('.knob'));
const buttons = /** @type {HTMLButtonElement[]} */ ([...box.querySelectorAll('button')]);

box.style.setProperty('--stick', `${tuning.touch.stickPixels}px`);
box.style.setProperty('--button', `${tuning.touch.buttonPixels}px`);

// Which way the joystick is steering now, and the finger that is on it.
let steering = { x: 0, y: 0 };
/** @type {number | null} */
let thumb = null;

/**
 * Lets go of the joystick. A thumb still on it steers nowhere until it is
 * lifted and put down again.
 */
export function restStick() {
  thumb = null;
  steering = { x: 0, y: 0 };
  knob.style.transform = '';
}

/** @param {PointerEvent} event */
function push(event) {
  const edge = stick.getBoundingClientRect();
  const reach = edge.width / 2;
  const offset = { x: event.clientX - edge.left - reach, y: event.clientY - edge.top - reach };
  steering = stickSteering(offset, reach, tuning.touch.stickDeadShare);
  // The knob follows the thumb, and stops short of the joystick's edge.
  const pull = Math.min(1, (reach * 0.56) / Math.hypot(offset.x, offset.y));
  knob.style.transform = `translate(${offset.x * pull}px, ${offset.y * pull}px)`;
}

stick.addEventListener('pointerdown', (event) => {
  thumb = event.pointerId;
  // The thumb keeps steering when it slides off the joystick.
  stick.setPointerCapture(event.pointerId);
  push(event);
});
stick.addEventListener('pointermove', (event) => {
  if (event.pointerId === thumb) push(event);
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  stick.addEventListener(type, (event) => {
    if (/** @type {PointerEvent} */ (event).pointerId === thumb) restStick();
  });
}

/** Which way the joystick is steering now: see `Steering` in the rules. */
export const stickNow = () => steering;

/**
 * Has each button do what its key does, the moment a finger lands on it.
 * @param {(key: string) => void} press
 */
export function onButton(press) {
  for (const button of buttons) {
    button.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      press(button.dataset.key ?? '');
    });
  }
}

/**
 * Shows or hides the controls, and says what each button reads.
 * @param {boolean} shown
 * @param {Record<string, string>} words What each button says, by its key. A
 *   button with no words is hidden.
 */
export function showControls(shown, words) {
  if (box.hidden === shown) {
    box.hidden = !shown;
    if (!shown) restStick();
  }
  if (!shown) return;
  for (const button of buttons) {
    const says = words[button.dataset.key ?? ''] ?? '';
    button.hidden = !says;
    if (button.textContent !== says) button.textContent = says;
  }
}
