// The garage: the screen between one day and the next, where the money buys
// parts for the vehicle.
//
// The vehicle and its parts are placeholders drawn in code, each named after
// the picture file that will replace it.

import { tuning } from '../tuning.js';
import { drawChoice } from './hud.js';
import { whyNotBuy } from './rules.js';
import { input, targets } from './taps.js';

/** @param {number} amount */
const dollars = (amount) => `$${Math.round(amount).toLocaleString('en-US')}`;

// Where the vehicle's picture goes on the screen, in pixels.
const vehicle = { left: 90, top: 330, wide: 800, tall: 420 };
// Where the list of parts goes, and how tall each part's row is. Twelve rows
// fit.
const list = { left: 960, top: 140, wide: 880, rowTall: 71 };
// Where the middle of the buy button goes, under the vehicle, and how far
// below it the button for moving on sits.
const buttons = { top: 830, apart: 110 };

/**
 * Paints the garage.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 * @param {typeof tuning} run The numbers the run plays by.
 * @param {number} chosen Which part is picked out, counting from 0.
 */
export function drawGarage(ctx, state, run, chosen) {
  const { width, height } = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b1118';
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'top';

  ctx.textAlign = 'left';
  ctx.fillStyle = '#dce6ee';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.fillText(`${run.team} garage`, vehicle.left, 50, vehicle.wide);
  ctx.font = '40px system-ui, sans-serif';
  ctx.fillText(run.vehicle, vehicle.left, 150, vehicle.wide);
  ctx.fillStyle = '#9be28c';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.fillText(`Balance: ${dollars(state.balance)}`, vehicle.left, 220, vehicle.wide);

  // art/vehicle.png, with each owned part's picture on it.
  ctx.fillStyle = '#27313b';
  ctx.fillRect(vehicle.left, vehicle.top, vehicle.wide, vehicle.tall);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('art/vehicle.png', vehicle.left + 12, vehicle.top + vehicle.tall - 34);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const part of run.parts) {
    if (!state.parts.includes(part.id)) continue;
    const x = vehicle.left + part.at.x * vehicle.wide;
    const y = vehicle.top + part.at.y * vehicle.tall;
    ctx.fillStyle = '#4b6278';
    ctx.fillRect(x - 120, y - 32, 240, 64);
    ctx.fillStyle = '#dce6ee';
    ctx.fillText(part.picture, x, y, 228);
  }

  // On a small screen the small print is painted bigger (see main.js), and a
  // row has no room for its second line. There each row is one line, and
  // what the part picked out does is written along the bottom instead.
  ctx.font = '22px system-ui, sans-serif';
  const roomy = parseFloat(ctx.font) <= 22;

  /**
   * Why a part cannot be bought, in words, or '' when it can or is owned.
   * @param {(typeof run.parts)[number]} part
   */
  const whyWords = (part) => {
    const why = whyNotBuy(state, part);
    if (why === 'money') return 'Not enough money';
    if (why === 'needs') return `Needs ${run.parts.find((other) => other.id === part.needs)?.name ?? part.needs} first`;
    return '';
  };

  // The list of parts. Each row has the part's name and price, what it
  // does, and whether it can be bought.
  ctx.textBaseline = 'top';
  run.parts.forEach((part, i) => {
    const top = list.top + i * list.rowTall;
    const right = list.left + list.wide - 16;
    if (i === chosen) {
      ctx.fillStyle = '#1c2a38';
      ctx.fillRect(list.left, top, list.wide, list.rowTall - 8);
      ctx.strokeStyle = '#dce6ee';
      ctx.lineWidth = 3;
      ctx.strokeRect(list.left, top, list.wide, list.rowTall - 8);
    }
    const owned = whyNotBuy(state, part) === 'owned';
    const why = whyWords(part);
    // With one line to a row, it sits in the middle of the row.
    const line = roomy ? top + 4 : top + 14;

    ctx.textAlign = 'left';
    ctx.fillStyle = owned ? '#9be28c' : '#dce6ee';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.fillText(part.name, list.left + 16, line, 560);
    if (roomy) {
      ctx.fillStyle = '#a9b8c4';
      ctx.font = '22px system-ui, sans-serif';
      ctx.fillText(part.does, list.left + 16, top + 38, 560);
    }

    ctx.textAlign = 'right';
    // With no room to say why not, the price of a part that cannot be bought
    // is red.
    ctx.fillStyle = owned ? '#9be28c' : why && !roomy ? '#ff4d4d' : '#dce6ee';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.fillText(owned ? 'OWNED' : dollars(part.price), right, line);
    if (roomy && why) {
      ctx.font = '22px system-ui, sans-serif';
      ctx.fillStyle = '#ff4d4d';
      ctx.fillText(why, right, top + 38, 280);
    }
    // Tapping a row picks the part out. It never buys it.
    targets.push({ action: `part:${i}`, left: list.left, top, wide: list.wide, tall: list.rowTall });
  });

  // Under the vehicle: buy the part picked out, and move on.
  const picked = run.parts[chosen];
  const middle = vehicle.left + vehicle.wide / 2;
  drawChoice(ctx, { key: 'b', words: `buy ${picked.name}` }, middle, buttons.top, whyNotBuy(state, picked) === '', vehicle.wide);
  drawChoice(ctx, { key: 'enter', words: `on to day ${state.day + 1}` }, middle, buttons.top + buttons.apart, true, vehicle.wide);

  // Along the bottom: how to choose a part with the keys. On a small screen,
  // what the part picked out does, and why it cannot be bought if it cannot.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = '36px system-ui, sans-serif';
  if (!roomy) {
    const why = whyWords(picked);
    ctx.fillStyle = why ? '#ff4d4d' : '#dce6ee';
    ctx.fillText(`${why ? `${why}. ` : ''}${picked.does}`, width / 2, height - 70, width * 0.9);
  } else if (!input.touch) {
    ctx.fillStyle = '#dce6ee';
    ctx.fillText('Up and Down: choose a part', width / 2, height - 70, width * 0.9);
  }
}
