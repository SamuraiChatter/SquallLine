// The windshield view: what the player sees while pulled over to film.
//
// The view is flat layers, painted back to front. Each layer is a placeholder
// drawn in code, named after the picture file that will replace it. The name
// is written on the placeholder so it is easy to see which drawing goes where.

import { tuning } from '../tuning.js';
import { cameraOffFunnel, milesToFunnel, payPerSecond, tornadoInFrame } from './rules.js';

/**
 * Writes a placeholder's file name on it.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} fileName
 * @param {number} x
 * @param {number} y
 */
function label(ctx, fileName, x, y) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = '22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(fileName, x, y);
}

/**
 * Paints the windshield view.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 */
export function drawWindshield(ctx, state) {
  const { width, height } = ctx.canvas;
  const horizon = height * 0.62;
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // art/sky.png
  ctx.fillStyle = '#3d4a57';
  ctx.fillRect(0, 0, width, horizon);
  label(ctx, 'art/sky.png', width * 0.05, height * 0.13);

  // art/ground.png
  ctx.fillStyle = '#2f3b2a';
  ctx.fillRect(0, horizon, width, height - horizon);
  label(ctx, 'art/ground.png', width * 0.05, horizon + 12);

  // art/tornado.png. How far left or right it sits follows its direction
  // from the car, and its size follows how near it is.
  const { storm } = state;
  if (storm.tornado > 0) {
    const x = width / 2 + (cameraOffFunnel(state) / tuning.camera.viewDegrees) * width;
    const miles = milesToFunnel(state);
    // Twice as near looks twice as tall, up to filling the sky.
    const tall = Math.min(horizon * 1.1, (horizon * 1.6) / Math.max(miles, 0.5)) * (0.4 + 0.6 * storm.tornado);
    const top = horizon - tall;
    ctx.beginPath();
    ctx.moveTo(x - tall * 0.3, top);
    ctx.lineTo(x + tall * 0.3, top);
    ctx.lineTo(x + tall * 0.05, horizon);
    ctx.lineTo(x - tall * 0.05, horizon);
    ctx.closePath();
    ctx.fillStyle = '#1b2026';
    ctx.fill();
    label(ctx, 'art/tornado.png', x + tall * 0.32, top);
  }

  // art/dashboard.png: the dashboard along the bottom and a pillar each side.
  ctx.fillStyle = '#0d0f12';
  ctx.fillRect(0, height * 0.86, width, height * 0.14);
  ctx.fillRect(0, 0, width * 0.035, height);
  ctx.fillRect(width * 0.965, 0, width * 0.035, height);
  label(ctx, 'art/dashboard.png', width * 0.05, height * 0.9);

  // The viewfinder box: red while the tornado is inside it and being filmed.
  const filming = tornadoInFrame(state, tuning);
  const boxWide = (tuning.camera.viewfinderDegrees / tuning.camera.viewDegrees) * width;
  ctx.lineWidth = 5;
  ctx.strokeStyle = filming ? '#ff4d4d' : '#dce6ee';
  ctx.strokeRect((width - boxWide) / 2, height * 0.12, boxWide, height * 0.62);

  // The counter of seconds filmed.
  ctx.fillStyle = filming ? '#ff4d4d' : '#dce6ee';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(`${filming ? '● REC' : 'REC'}  ${state.footage.toFixed(1)} s`, width * 0.95, height * 0.035);

  // In the box but outside the footage ring: say why it is not paying.
  if (filming && payPerSecond(milesToFunnel(state), tuning) === 0) {
    ctx.font = '40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Too far away to sell. Get inside the footage ring.', width / 2, height * 0.76);
  }
}
