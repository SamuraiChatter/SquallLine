// The design mode, at design.html: draw a storm's path on the map by
// clicking, mark its tornadoes, save it as a storm file and try it in the
// game. Players are not shown this page.

import { tuning } from '../tuning.js';
import { drawMap } from './draw.js';
import { loadMap } from './map.js';
import { funnelOf } from './rules.js';
import { addTornado, designKey, moveTornadoEnd, placeAlong, readStorm, shareNearest, townsEntered, writeStorm } from './storms.js';

const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('canvas'));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
const { width, height } = canvas;

/**
 * @template {HTMLElement} T
 * @param {string} id
 * @returns {T}
 */
const element = (id) => /** @type {T} */ (document.getElementById(id));
const pathTool = element('path-tool');
const tornadoTool = element('tornado-tool');
const hint = element('hint');
const list = element('tornadoes');
const message = element('message');
/** @type {HTMLInputElement} */
const nameBox = element('name');
/** @type {HTMLInputElement} */
const fileBox = element('file');

const map = await loadMap();

// The whole territory fits on the screen, as in the game's whole-territory
// view. This is how many pixels a mile takes up.
const pixelsPerMile = Math.min(width / tuning.territoryMilesWide, height / tuning.territoryMilesTall) / 1.05;
// How close a click has to be to a corner or a tornado's end to grab it, in
// miles: 16 pixels on the game screen.
const reach = 16 / pixelsPerMile;

// The colour of each strength of tornado, from EF0 to EF5.
const strengthColours = ['#7fd4ff', '#7dff8a', '#ffe14a', '#ffa63a', '#ff5a3a', '#ff3ad0'];

/** @type {import('./storms.js').DesignedStorm} */
let storm = { path: [], tornadoes: [] };
// Carry on with the storm that was being designed, if there is one.
try {
  storm = readStorm(sessionStorage.getItem(designKey) ?? '');
} catch {
  // Nothing saved yet, or nothing that can be read: start with a clear map.
}

// Which tool is in use: drawing the path, or adding tornadoes.
/** @type {'path' | 'tornado'} */
let tool = 'path';
// Where the tornado being added touches down, once its first click is made.
/** @type {number | null} */
let touchdown = null;
// What is being dragged: a corner of the path, or one end of a tornado.
/** @type {{ corner: number } | { tornado: number, which: 'start' | 'end' } | null} */
let dragging = null;

/**
 * The line the tornadoes follow over the ground. A tornado touches down to
 * the south-west of the middle of its storm.
 */
const track = () => storm.path.map(funnelOf);

/**
 * Where on the map a click landed, in miles.
 * @param {MouseEvent} event
 * @returns {import('./rules.js').Point}
 */
function placeOf(event) {
  // The canvas keeps its shape inside the window, with bars at the sides or
  // at the top and bottom.
  const box = canvas.getBoundingClientRect();
  const scale = Math.min(box.width / width, box.height / height);
  const x = (event.clientX - box.left - (box.width - width * scale) / 2) / scale;
  const y = (event.clientY - box.top - (box.height - height * scale) / 2) / scale;
  const halfWide = tuning.territoryMilesWide / 2;
  const halfTall = tuning.territoryMilesTall / 2;
  return {
    x: Math.max(-halfWide, Math.min(halfWide, (x - width / 2) / pixelsPerMile)),
    y: Math.max(-halfTall, Math.min(halfTall, (height / 2 - y) / pixelsPerMile)),
  };
}

/**
 * @param {import('./rules.js').Point} a
 * @param {import('./rules.js').Point} b
 */
const milesBetween = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Which corner of the path is within reach of a place, or -1.
 * @param {import('./rules.js').Point} place
 */
const cornerAt = (place) => storm.path.findIndex((corner) => milesBetween(corner, place) <= reach);

/**
 * Which end of which tornado is within reach of a place, or null.
 * @param {import('./rules.js').Point} place
 * @returns {{ tornado: number, which: 'start' | 'end' } | null}
 */
function tornadoEndAt(place) {
  for (const [tornado, { start, end }] of storm.tornadoes.entries()) {
    if (milesBetween(placeAlong(track(), start), place) <= reach) return { tornado, which: 'start' };
    if (milesBetween(placeAlong(track(), end), place) <= reach) return { tornado, which: 'end' };
  }
  return null;
}

/** @param {string} words */
function say(words) {
  message.textContent = words;
}

/** Keeps the storm for later, redraws the map and lists the tornadoes. */
function changed() {
  // A path with fewer than two corners has nowhere to put a tornado.
  if (storm.path.length < 2) storm.tornadoes = [];
  try {
    if (storm.path.length < 2) sessionStorage.removeItem(designKey);
    else sessionStorage.setItem(designKey, writeStorm(storm));
  } catch {
    // The browser will not keep it. Saving to a file still works.
  }
  draw();
  listTornadoes();
}

/** @param {'path' | 'tornado'} next */
function pick(next) {
  tool = next;
  touchdown = null;
  pathTool.setAttribute('aria-pressed', String(tool === 'path'));
  tornadoTool.setAttribute('aria-pressed', String(tool === 'tornado'));
  hint.textContent =
    tool === 'path'
      ? 'Click on the map to add a corner to the storm’s path. Drag a corner to move it. Right-click a corner to take it away.'
      : 'Click on the red line where a tornado touches down, then where it dies. Drag either end to move it. Right-click an end to take the tornado away.';
  draw();
}

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  const place = placeOf(event);
  say('');
  if (tool === 'path') {
    let corner = cornerAt(place);
    if (corner < 0) {
      storm.path.push(place);
      corner = storm.path.length - 1;
    }
    dragging = { corner };
  } else if (storm.path.length < 2) {
    say('Draw the storm’s path first.');
  } else {
    dragging = tornadoEndAt(place);
    if (!dragging) markTornado(place);
  }
  if (dragging) canvas.setPointerCapture(event.pointerId);
  changed();
});

/**
 * A click with the tornado tool: the first marks where a tornado touches
 * down, the second where it dies.
 * @param {import('./rules.js').Point} place
 */
function markTornado(place) {
  const nearest = shareNearest(track(), place);
  if (nearest.miles > reach * 2) {
    say('Click on the red line. That is where the tornadoes go.');
  } else if (touchdown === null) {
    touchdown = nearest.share;
    say('Now click where the tornado dies.');
  } else {
    // A new tornado is as strong as the last one made.
    const strength = storm.tornadoes.at(-1)?.strength ?? 2;
    const tornadoes = addTornado(storm.tornadoes, touchdown, nearest.share, strength);
    if (tornadoes === storm.tornadoes) say('There is no room for a tornado there.');
    storm.tornadoes = tornadoes;
    touchdown = null;
  }
}

canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const place = placeOf(event);
  if ('corner' in dragging) {
    storm.path[dragging.corner] = place;
  } else {
    const { share } = shareNearest(track(), place);
    storm.tornadoes = moveTornadoEnd(storm.tornadoes, dragging.tornado, dragging.which, share);
  }
  changed();
});

addEventListener('pointerup', () => {
  dragging = null;
});

// Right-click takes away a corner, or a tornado.
canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  const place = placeOf(event);
  if (tool === 'path') {
    const corner = cornerAt(place);
    if (corner >= 0) storm.path.splice(corner, 1);
  } else {
    const end = tornadoEndAt(place);
    if (end) storm.tornadoes.splice(end.tornado, 1);
  }
  changed();
});

// Escape forgets a tornado that is only half marked.
addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  touchdown = null;
  say('');
  draw();
});

pathTool.addEventListener('click', () => pick('path'));
tornadoTool.addEventListener('click', () => pick('tornado'));

/** The name typed in the name box, made safe to use as a file name. */
const fileName = () => `${nameBox.value.replace(/[^a-zA-Z0-9_-]/g, '') || 'my-storm'}.json`;

element('save').addEventListener('click', () => {
  if (storm.path.length < 2) return say('Draw the storm’s path first.');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([writeStorm(storm)], { type: 'application/json' }));
  link.download = fileName();
  link.click();
  URL.revokeObjectURL(link.href);
  say(`Saved ${fileName()}. Put it in the storms folder, then set stormFile in tuning.js to '${fileName()}'.`);
});

element('load').addEventListener('click', () => fileBox.click());
fileBox.addEventListener('change', async () => {
  const file = fileBox.files?.[0];
  // Let the same file be picked again later.
  fileBox.value = '';
  if (!file) return;
  try {
    storm = readStorm(await file.text());
    nameBox.value = file.name.replace(/\.json$/i, '');
    say(`Loaded ${file.name}.`);
  } catch (error) {
    say(error instanceof Error ? error.message : 'That file did not load.');
  }
  touchdown = null;
  changed();
});

element('play').addEventListener('click', () => {
  if (storm.path.length < 2) return say('Draw the storm’s path first.');
  if (!storm.tornadoes.length) return say('Add a tornado first.');
  changed();
  location.href = 'index.html?trial';
});

element('clear').addEventListener('click', () => {
  if (!confirm('Clear the map and start a new storm?')) return;
  storm = { path: [], tornadoes: [] };
  touchdown = null;
  say('');
  changed();
});

/** Lists the tornadoes in the panel, each with its strength and warnings. */
function listTornadoes() {
  list.replaceChildren(
    ...storm.tornadoes.map((tornado, index) => {
      const item = document.createElement('li');
      const row = document.createElement('div');
      row.className = 'row';
      const name = document.createElement('span');
      name.textContent = `Tornado ${index + 1}`;
      name.style.color = strengthColours[tornado.strength];

      const strength = document.createElement('select');
      strength.setAttribute('aria-label', `Strength of tornado ${index + 1}`);
      for (let ef = 0; ef <= 5; ef++) strength.add(new Option(`EF${ef}`, String(ef), false, ef === tornado.strength));
      strength.addEventListener('change', () => {
        tornado.strength = Number(strength.value);
        changed();
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        storm.tornadoes.splice(index, 1);
        changed();
      });
      row.append(name, strength, remove);
      item.append(row);

      const towns = townsEntered(track(), tornado, map.places, tuning.design.townMiles);
      if (towns.length) {
        const warning = document.createElement('p');
        warning.className = 'warning';
        warning.textContent = `Warning: its path enters ${towns.join(', ')}. Tornado paths stay over open country.`;
        item.append(warning);
      }
      return item;
    }),
  );
}

/**
 * Traces a stretch of a line, from one share of the way along it to another.
 * @param {import('./rules.js').Point[]} line
 * @param {number} from
 * @param {number} to
 */
function trace(line, from, to) {
  ctx.beginPath();
  // Plenty of short steps, so the stretch bends round the line's corners.
  for (let step = 0; step <= 100; step++) {
    const { x, y } = placeAlong(line, from + ((to - from) * step) / 100);
    if (step === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
}

/**
 * Writes on the map, the right way up, beside a place.
 * @param {string} words
 * @param {import('./rules.js').Point} place
 * @param {string} colour
 */
function write(words, place, colour) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const x = width / 2 + place.x * pixelsPerMile + 18;
  const y = height / 2 - place.y * pixelsPerMile;
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#05080c';
  ctx.strokeText(words, x, y);
  ctx.fillStyle = colour;
  ctx.fillText(words, x, y);
  ctx.restore();
}

/** Paints the map with the storm being designed on top. */
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b1118';
  ctx.fillRect(0, 0, width, height);

  // From here on, draw in miles with north at the top.
  ctx.translate(width / 2, height / 2);
  ctx.scale(pixelsPerMile, -pixelsPerMile);
  const pixel = 1 / pixelsPerMile;

  // Every road, the rural grid too, and every place name.
  drawMap(ctx, map, false, { x: 0, y: 0 }, pixelsPerMile);
  ctx.lineWidth = 4 * pixel;
  ctx.strokeStyle = '#5b7488';
  ctx.strokeRect(-tuning.territoryMilesWide / 2, -tuning.territoryMilesTall / 2, tuning.territoryMilesWide, tuning.territoryMilesTall);

  // How far each town reaches: where tornado paths should not go.
  ctx.fillStyle = 'rgba(255, 143, 107, 0.12)';
  for (const place of map.places) {
    ctx.beginPath();
    ctx.arc(place.x, place.y, tuning.design.townMiles[/** @type {'city' | 'town' | 'village'} */ (place.kind)] ?? 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const { path, tornadoes } = storm;
  if (path.length >= 2) {
    // The storm's path, as a dashed line.
    trace(path, 0, 1);
    ctx.lineWidth = 3 * pixel;
    ctx.setLineDash([12 * pixel, 8 * pixel]);
    ctx.strokeStyle = '#dce6ee';
    ctx.stroke();
    ctx.setLineDash([]);

    // The red line the tornadoes follow, to the south-west of the path.
    trace(track(), 0, 1);
    ctx.lineWidth = 2 * pixel;
    ctx.strokeStyle = '#e02a1f';
    ctx.stroke();
  }

  // The corners of the path. The storm starts at the green one.
  path.forEach((corner, i) => {
    ctx.beginPath();
    ctx.arc(corner.x, corner.y, 9 * pixel, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? '#7dff8a' : '#dce6ee';
    ctx.fill();
  });
  if (path.length) write('Start', path[0], '#7dff8a');

  // Each tornado: a thick stretch of the red line in its strength's colour,
  // with a square at each end to drag.
  for (const tornado of tornadoes) {
    const colour = strengthColours[tornado.strength];
    trace(track(), tornado.start, tornado.end);
    ctx.lineWidth = 8 * pixel;
    ctx.strokeStyle = colour;
    ctx.stroke();
    ctx.fillStyle = colour;
    for (const share of [tornado.start, tornado.end]) {
      const { x, y } = placeAlong(track(), share);
      ctx.fillRect(x - 8 * pixel, y - 8 * pixel, 16 * pixel, 16 * pixel);
    }
    write(`EF${tornado.strength}`, placeAlong(track(), (tornado.start + tornado.end) / 2), colour);
  }

  // Where the tornado being added touches down.
  if (touchdown !== null && path.length >= 2) {
    const { x, y } = placeAlong(track(), touchdown);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3 * pixel;
    ctx.strokeRect(x - 8 * pixel, y - 8 * pixel, 16 * pixel, 16 * pixel);
  }
}

pick('path');
listTornadoes();
