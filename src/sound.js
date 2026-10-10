// The sound itself: wind, hail, debris and the camera's beep, made in the
// browser with no sound files. A sound the creative lead has recorded plays in
// place of the game's own when tuning.js names its file. How loud each sound
// should be is worked out in mix.js.
//
// Before `beginSound` has run, or in a browser with no sound, every function
// here does nothing.

import { tuning } from '../tuning.js';
import { silence } from './mix.js';

const mutedKey = 'squallline-muted';
let muted = false;
try {
  muted = localStorage.getItem(mutedKey) === '1';
} catch {
  // A browser that blocks storage starts with the sound on.
}

/** @type {ReturnType<typeof build> | null} */
let rig = null;
// The mix last sent to `setSound`: the same one again changes nothing.
/** @type {import('./mix.js').Mix | null} */
let heard = null;

/**
 * A stretch of hiss: every sound here is cut or filtered from one.
 * @param {AudioContext} ctx
 * @param {number} seconds
 */
function hiss(ctx, seconds) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/**
 * A few seconds of hailstones landing: short clicks, some harder than others.
 * @param {AudioContext} ctx
 */
function clatter(ctx) {
  const seconds = 3;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const stoneSamples = Math.floor(ctx.sampleRate * 0.03);
  for (let stone = 0; stone < seconds * 16; stone++) {
    const start = Math.floor(Math.random() * (data.length - stoneSamples));
    const hard = 0.2 + 0.8 * Math.random() ** 2;
    for (let i = 0; i < stoneSamples; i++) data[start + i] += hard * (Math.random() * 2 - 1) * Math.exp((-i / ctx.sampleRate) * 220);
  }
  return buffer;
}

/**
 * Wires up everything that can be heard, silent to begin with.
 * @param {AudioContext} ctx
 */
function build(ctx) {
  const master = ctx.createGain();
  master.gain.value = muted ? 0 : tuning.sound.loudness;
  master.connect(ctx.destination);

  // The wind and hail pass through the car's shell: quiet and muffled from
  // inside it, loud and clear once the player is out filming.
  const shell = ctx.createBiquadFilter();
  shell.type = 'lowpass';
  const through = ctx.createGain();
  through.gain.value = 0;
  shell.connect(through).connect(master);

  // The wind is hiss with the top taken off. Lowering `windTone` deepens it.
  const windTone = ctx.createBiquadFilter();
  windTone.type = 'lowpass';
  windTone.frequency.value = 1400;
  const wind = ctx.createGain();
  wind.gain.value = 0;
  windTone.connect(wind).connect(shell);
  // Gusts: the wind's tone slowly rises and falls.
  const gust = ctx.createOscillator();
  gust.frequency.value = 0.17;
  const gustDepth = ctx.createGain();
  gustDepth.gain.value = 160;
  gust.connect(gustDepth).connect(windTone.frequency);
  gust.start();
  // The roar under it, heard only close to the tornado.
  const roarTone = ctx.createBiquadFilter();
  roarTone.type = 'lowpass';
  roarTone.frequency.value = 110;
  const roar = ctx.createGain();
  roar.gain.value = 0;
  roarTone.connect(roar).connect(shell);

  const hailTone = ctx.createBiquadFilter();
  hailTone.type = 'highpass';
  hailTone.frequency.value = 1500;
  const hail = ctx.createGain();
  hail.gain.value = 0;
  hailTone.connect(hail).connect(shell);

  return {
    ctx,
    master,
    shell,
    through,
    windTone,
    wind,
    roarTone,
    roar,
    hailTone,
    hail,
    noise: hiss(ctx, 2),
    /** @type {{ thud?: AudioBuffer, beep?: AudioBuffer }} */
    recorded: {},
  };
}

/**
 * A recorded sound named in tuning.js, or nothing if none is named or it
 * does not load: the game's own sound plays then.
 * @param {AudioContext} ctx
 * @param {keyof typeof tuning.sound.files} name
 */
async function recording(ctx, name) {
  const file = tuning.sound.files[name];
  if (!file) return undefined;
  try {
    const response = await fetch(`sounds/${file}`);
    if (!response.ok) throw new Error(`sounds/${file} answered ${response.status}`);
    return await ctx.decodeAudioData(await response.arrayBuffer());
  } catch (error) {
    // Name the file, so the creative lead knows which one to check.
    console.warn(`The sound sounds/${file} did not load, so the game's own plays instead.`, error);
    return undefined;
  }
}

/**
 * Plays a sound round and round, for good.
 * @param {AudioBuffer} buffer
 * @param {AudioNode[]} into
 */
function loop(buffer, into) {
  const source = into[0].context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  for (const node of into) source.connect(node);
  source.start();
}

/**
 * Starts the sound. Call it from a key press or a tap: browsers let sound
 * start only from one. Safe to call on every one.
 */
export function beginSound() {
  if (rig) {
    // A phone puts the sound to sleep when the game is left for a while.
    if (rig.ctx.state !== 'running' && !document.hidden) rig.ctx.resume().catch(() => {});
    return;
  }
  if (!window.AudioContext) return;
  try {
    rig = build(new AudioContext());
  } catch {
    // No sound on this computer: the game plays on in silence.
    return;
  }
  const made = rig;
  const { ctx, windTone, roarTone, hailTone, noise, recorded } = made;
  Promise.all([recording(ctx, 'wind'), recording(ctx, 'hail'), recording(ctx, 'thud'), recording(ctx, 'beep')]).then(([wind, hail, thud, beep]) => {
    // A recording plays as it was recorded: only the game's own hiss is
    // shaped into wind and hail.
    if (wind) loop(wind, [made.wind]);
    else loop(noise, [windTone, roarTone]);
    if (hail) loop(hail, [made.hail]);
    else loop(clatter(ctx), [hailTone]);
    recorded.thud = thud;
    recorded.beep = beep;
  });
}

// Nothing moves while the game's tab is hidden, so nothing sounds either.
document.addEventListener('visibilitychange', () => {
  if (!rig) return;
  if (document.hidden) rig.ctx.suspend().catch(() => {});
  else rig.ctx.resume().catch(() => {});
});

/**
 * Sets how loud the wind and hail are, a frame at a time. Every change is
 * eased in, so nothing clicks or jumps.
 * @param {import('./mix.js').Mix} mix
 */
export function setSound(mix) {
  if (!rig || mix === heard) return;
  heard = mix;
  const now = rig.ctx.currentTime;
  rig.wind.gain.setTargetAtTime(0.5 * mix.wind, now, 0.3);
  rig.windTone.frequency.setTargetAtTime(1400 - 1000 * mix.near, now, 0.3);
  rig.roar.gain.setTargetAtTime(1.6 * mix.near ** 2, now, 0.3);
  rig.hail.gain.setTargetAtTime(mix.hail ? 0.7 : 0, now, 0.12);
  // With nothing to hear the car's shell is left as it was, so the blow that
  // ends the day is still heard.
  if (mix === silence) return;
  rig.through.gain.setTargetAtTime(mix.loud, now, 0.2);
  rig.shell.frequency.setTargetAtTime(mix.outside ? 16000 : 650, now, 0.2);
}

/**
 * Plays a source once: fast in, then fading out.
 * @param {AudioScheduledSourceNode} source
 * @param {AudioNode} into
 * @param {number} level
 * @param {number} seconds
 */
function once(source, into, level, seconds) {
  const { ctx } = /** @type {NonNullable<typeof rig>} */ (rig);
  const now = ctx.currentTime;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(level, now + 0.005);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  source.connect(amp).connect(into);
  source.start(now);
  source.stop(now + seconds + 0.05);
}

/**
 * Plays a recorded sound once, as it is.
 * @param {AudioBuffer} buffer
 * @param {AudioNode} into
 */
function play(buffer, into) {
  const source = into.context.createBufferSource();
  source.buffer = buffer;
  source.connect(into);
  source.start();
}

/** Debris hits the car. */
export function thud() {
  if (!rig) return;
  const { ctx, shell, noise, recorded } = rig;
  if (recorded.thud) return play(recorded.thud, shell);
  // A low knock that drops in pitch, and a crack of hiss on top of it.
  const knock = ctx.createOscillator();
  knock.frequency.setValueAtTime(130, ctx.currentTime);
  knock.frequency.exponentialRampToValueAtTime(42, ctx.currentTime + 0.25);
  once(knock, shell, 1.2, 0.3);
  const crack = ctx.createBufferSource();
  crack.buffer = noise;
  const crackTone = ctx.createBiquadFilter();
  crackTone.type = 'lowpass';
  crackTone.frequency.value = 900;
  crackTone.connect(shell);
  once(crack, crackTone, 0.8, 0.12);
}

/**
 * The camera's beep: high as footage starts to count, lower as it stops. The
 * camera is in the player's hands, so the car never muffles it.
 * @param {boolean} counting
 */
export function beep(counting) {
  if (!rig) return;
  const { ctx, master, recorded } = rig;
  if (recorded.beep) return play(recorded.beep, master);
  const tone = ctx.createOscillator();
  tone.frequency.value = counting ? 1320 : 880;
  once(tone, master, 0.12, 0.09);
}

/** True while the sound is switched off. */
export const isMuted = () => muted;

/** Switches all the sound off, or back on, and remembers the choice. */
export function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem(mutedKey, muted ? '1' : '0');
  } catch {
    // A browser that blocks storage forgets the choice at the next visit.
  }
  rig?.master.gain.setTargetAtTime(muted ? 0 : tuning.sound.loudness, rig.ctx.currentTime, 0.02);
}
