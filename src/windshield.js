// The windshield view: what the player sees while pulled over to film.
//
// The view is flat layers, painted back to front. Each layer is a placeholder
// drawn in code, named after the picture file that will replace it. The name
// is written on the placeholder so it is easy to see which drawing goes where.

import { tuning } from '../tuning.js';
import { drawDashRadar } from './draw.js';
import { anchorWait, cameraOffFunnel, inDebrisZone, inHailCore, insideTornado, milesToFunnel, payPerSecond, tornadoInFrame } from './rules.js';

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

// The tornado's shape, weakest first: a rope for EF0 and EF1, a cone for EF2
// and EF3, a wedge for EF4 and EF5. Each has its own picture file, and is so
// wide at the cloud and at the ground, as a share of how tall it is.
const shapes = [
  { fileName: 'art/tornado-rope.png', top: 0.09, foot: 0.03 },
  { fileName: 'art/tornado-cone.png', top: 0.3, foot: 0.05 },
  { fileName: 'art/tornado-wedge.png', top: 0.55, foot: 0.3 },
];

/**
 * Paints the windshield view.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 * @param {import('./rules.js').Tuning} day The numbers today plays by.
 */
export function drawWindshield(ctx, state, day) {
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

  // The tornado. How far left or right it sits follows its direction from
  // the car, its size follows how near it is, and its shape its strength.
  const { storm } = state;
  if (storm.tornado > 0) {
    const x = width / 2 + (cameraOffFunnel(state) / tuning.camera.viewDegrees) * width;
    const miles = milesToFunnel(state);
    // Twice as near looks twice as tall, up to filling the sky.
    const tall = Math.min(horizon * 1.1, (horizon * 1.6) / Math.max(miles, 0.5)) * (0.4 + 0.6 * storm.tornado);
    const top = horizon - tall;
    const shape = shapes[Math.min(shapes.length - 1, Math.floor(storm.strength / 2))];
    ctx.beginPath();
    ctx.moveTo(x - tall * shape.top, top);
    ctx.lineTo(x + tall * shape.top, top);
    ctx.lineTo(x + tall * shape.foot, horizon);
    ctx.lineTo(x - tall * shape.foot, horizon);
    ctx.closePath();
    ctx.fillStyle = '#1b2026';
    ctx.fill();
    label(ctx, shape.fileName, x + tall * (shape.top + 0.02), top);
  }

  // The weather between the car and the tornado. Each bit of debris or hail
  // keeps its own track, worked out from its number and the clock.
  const seconds = performance.now() / 1000;

  // art/inside-tornado.png: the direct hit. The tornado is all around, so
  // its wall fills the view and whirls past.
  const direct = insideTornado(state, day);
  if (direct) {
    ctx.fillStyle = '#14181d';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#262d35';
    for (let i = 0; i < 9; i++) {
      const across = (seconds * 0.9 + i / 9) % 1;
      ctx.fillRect(across * width * 1.2 - width * 0.2, 0, width * 0.06, height);
    }
    label(ctx, 'art/inside-tornado.png', width * 0.05, height * 0.13);
  }

  // art/debris.png: debris flies across the scene while it is hitting the car.
  if (inDebrisZone(state, day)) {
    ctx.fillStyle = '#6b4a2b';
    for (let i = 0; i < 24; i++) {
      const across = (seconds * (0.9 + (i % 5) * 0.25) + i * 0.137) % 1;
      const y = horizon * (0.15 + ((i * 0.61) % 1) * 0.95) + Math.sin(seconds * 6 + i) * 20;
      const size = 14 + (i % 4) * 9;
      ctx.fillRect(across * width, y, size * 1.6, size);
    }
    label(ctx, 'art/debris.png', width * 0.05, height * 0.2);
  }

  // art/hail.png: hail falls, and bounces off the ground, inside the core.
  if (inHailCore(state.car, storm, day)) {
    ctx.fillStyle = '#eef4f8';
    for (let i = 0; i < 60; i++) {
      const fall = (seconds * (1.6 + (i % 3) * 0.4) + i * 0.071) % 1.25;
      const x = ((i * 0.618) % 1) * width;
      // Past the ground, the stone hops back up a little before it is gone.
      const y = fall <= 1 ? fall * horizon * 1.25 : horizon * 1.25 - Math.sin((fall - 1) * 4 * Math.PI) * 40;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    label(ctx, 'art/hail.png', width * 0.05, height * 0.27);
  }

  // art/skirts.png: the skirts come down over the bottom of the windows as
  // the vehicle anchors.
  if (state.anchor > 0) {
    ctx.fillStyle = '#39424c';
    ctx.fillRect(0, height * (0.86 - 0.08 * state.anchor), width, height * 0.08 * state.anchor);
    label(ctx, 'art/skirts.png', width * 0.8, height * (0.86 - 0.08 * state.anchor) + 6);
  }

  // art/dashboard.png: the dashboard along the bottom and a pillar each side.
  ctx.fillStyle = '#0d0f12';
  ctx.fillRect(0, height * 0.86, width, height * 0.14);
  ctx.fillRect(0, 0, width * 0.035, height);
  ctx.fillRect(width * 0.965, 0, width * 0.035, height);
  label(ctx, 'art/dashboard.png', width * 0.05, height * 0.9);

  // art/dash-radar.png: the dash radar stands on the dashboard, to the right.
  if (day.dashRadar) {
    const box = { left: width * 0.72, top: height * 0.6, wide: width * 0.22, tall: height * 0.25 };
    drawDashRadar(ctx, state, box);
    label(ctx, 'art/dash-radar.png', box.left + 10, box.top + 8);
  }

  // The viewfinder box: red while the tornado is inside it and being filmed.
  // Inside the tornado there is nothing to aim at, and no box.
  const filming = direct || tornadoInFrame(state, day);
  if (!direct) {
    const boxWide = (day.camera.viewfinderDegrees / tuning.camera.viewDegrees) * width;
    ctx.lineWidth = 5;
    ctx.strokeStyle = filming ? '#ff4d4d' : '#dce6ee';
    ctx.strokeRect((width - boxWide) / 2, height * 0.12, boxWide, height * 0.62);
  }

  // The counter of seconds filmed.
  ctx.fillStyle = filming ? '#ff4d4d' : '#dce6ee';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(`${filming ? '● REC' : 'REC'}  ${state.footage.toFixed(1)} s`, width * 0.95, height * 0.035);

  ctx.font = '40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  if (direct) {
    ctx.fillText('DIRECT HIT! Filming from inside the tornado.', width / 2, height * 0.5);
  } else if (filming && payPerSecond(milesToFunnel(state), day) === 0) {
    // In the box but outside the footage ring: say why it is not paying.
    const words = day.footage.ringMiles > 0 ? 'Too far away to sell. Get inside the footage ring.' : 'Too far away to sell. Only a direct hit pays today.';
    ctx.fillText(words, width / 2, height * 0.76);
  }

  // What the skirts and spikes are doing, for a vehicle that has them.
  if (day.anchor.ringTimes !== undefined) {
    const wait = anchorWait(state, day).toFixed(1);
    let words = 'A: anchor';
    if (state.anchoring) words = state.anchor < 1 ? `Anchoring… ${wait} s` : 'ANCHORED.  A: pull up';
    else if (state.anchor > 0) words = `Pulling up… ${wait} s`;
    ctx.fillStyle = state.anchor >= 1 ? '#9be28c' : '#dce6ee';
    ctx.textBaseline = 'middle';
    ctx.fillText(words, width / 2, height * 0.93);
  }
}
