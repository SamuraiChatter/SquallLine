// The garage: the screen between one day and the next, where the money buys
// parts for the vehicle.
//
// The vehicle and its parts are placeholders drawn in code, each named after
// the picture file that will replace it.

import { tuning } from '../tuning.js';
import { whyNotBuy } from './rules.js';

/** @param {number} amount */
const dollars = (amount) => `$${Math.round(amount).toLocaleString('en-US')}`;

// Where the vehicle's picture goes on the screen, in pixels.
const vehicle = { left: 90, top: 330, wide: 800, tall: 420 };
// Where the list of parts goes, and how tall each part's row is. Twelve rows
// fit.
const list = { left: 960, top: 140, wide: 880, rowTall: 71 };

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
    const why = whyNotBuy(state, part);
    const needed = run.parts.find((other) => other.id === part.needs);

    ctx.textAlign = 'left';
    ctx.fillStyle = why === 'owned' ? '#9be28c' : '#dce6ee';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.fillText(part.name, list.left + 16, top + 4, 560);
    ctx.fillStyle = '#a9b8c4';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText(part.does, list.left + 16, top + 38, 560);

    ctx.textAlign = 'right';
    ctx.fillStyle = why === 'owned' ? '#9be28c' : '#dce6ee';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.fillText(why === 'owned' ? 'OWNED' : dollars(part.price), right, top + 4);
    ctx.font = '22px system-ui, sans-serif';
    if (why === 'money') {
      ctx.fillStyle = '#ff4d4d';
      ctx.fillText('Not enough money', right, top + 38);
    } else if (why === 'needs') {
      ctx.fillStyle = '#ff4d4d';
      ctx.fillText(`Needs ${needed?.name ?? part.needs} first`, right, top + 38, 280);
    } else if (why === '' && i === chosen) {
      ctx.fillStyle = '#ffd24a';
      ctx.fillText('B: buy', right, top + 38);
    }
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#dce6ee';
  ctx.font = '36px system-ui, sans-serif';
  ctx.fillText(`Up and Down: choose a part     B: buy it     Enter: on to day ${state.day + 1}`, width / 2, height - 70, width * 0.9);
}
