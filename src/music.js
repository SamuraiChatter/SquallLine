// The driving music: a night drive in the rain, made in the browser with no
// music files. A drone and crackle always play; a shuffling beat, busier
// hats and a heartbeat thump join as the music builds. How far it has built
// is worked out in mix.js. Everything is in D minor.
//
// The music plays through the sound in sound.js, so it starts when that
// does, and M mutes it too. Until then `setMusic` does nothing.

import { tuning } from '../tuning.js';
import { musicLayers, noMusic } from './mix.js';
import { soundOut } from './sound.js';

// The beat is two bars of sixteen steps. Every other step lands a little
// late, which gives it its shuffle.
const STEP_SECONDS = 60 / 132 / 4;
const SHUFFLE = 0.3;
const STEPS = 32;
// Which steps each drum lands on.
const KICKS = [0, 10, 16, 23, 26];
const SNARES = [4, 12, 20, 28];
const HATS = [2, 6, 8, 14, 18, 22, 24, 30];
// The extra hats that make the beat busier.
const BUSY_HATS = [3, 7, 11, 15, 19, 27, 31];
// The bass: the step each note starts on, and the note in semitones above D2.
const BASS = new Map([[0, 0], [10, 0], [16, -4], [26, -2]]);
// The heartbeat: lub on the first step of a bar, dub three steps on.
const THUMPS = new Map([[0, 1], [3, 0.6], [16, 1], [19, 0.6]]);
// The distant voices: when one sings, and the notes it picks from, in
// semitones above D2: A3, C4, D4 and F4.
const VOICE_STEPS = [6, 22];
const VOICE_NOTES = [19, 22, 24, 27];

/** @param {number} semitonesAboveD2 */
const hz = (semitonesAboveD2) => 73.42 * 2 ** (semitonesAboveD2 / 12);

/** @typedef {ReturnType<typeof build>} Rig */
/** @type {Rig | null} */
let rig = null;
// What `setMusic` was last told, and the parts of the music it asks for.
let now = noMusic;
let layers = musicLayers(0);
// The next step of the beat, and when on the sound's clock it is due.
let step = 0;
let dueAt = 0;

/**
 * A few seconds of crackle, like a worn record: sparse, tiny clicks.
 * @param {AudioContext} ctx
 */
function crackle(ctx) {
  const seconds = 4;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let click = 0; click < seconds * 22; click++) {
    const start = Math.floor(Math.random() * (data.length - 40));
    const hard = Math.random() ** 3;
    for (let i = 0; i < 40; i++) data[start + i] += hard * (Math.random() * 2 - 1) * (1 - i / 40);
  }
  return buffer;
}

/**
 * A few seconds of fading hiss: played through a convolver, it puts a sound
 * far off in a big, empty space.
 * @param {AudioContext} ctx
 */
function hallEcho(ctx) {
  const buffer = ctx.createBuffer(2, ctx.sampleRate * 3, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  }
  return buffer;
}

/**
 * Wires up the music, silent to begin with, and starts the parts that
 * always play.
 * @param {NonNullable<ReturnType<typeof soundOut>>} out
 */
function build({ ctx, master, noise }) {
  // Everything goes through `bus`, which fades the music in and out.
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.connect(master);
  // The beat is muffled, and opens up as the music builds.
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 500;
  tone.connect(bus);
  const hall = ctx.createConvolver();
  hall.buffer = hallEcho(ctx);
  const hallLevel = ctx.createGain();
  hallLevel.gain.value = 0.4;
  hall.connect(hallLevel).connect(bus);

  // The drone: detuned saws on a low D and its fifth, behind a filter that
  // slowly opens and closes.
  const droneTone = ctx.createBiquadFilter();
  droneTone.type = 'lowpass';
  droneTone.frequency.value = 230;
  const droneLevel = ctx.createGain();
  droneLevel.gain.value = 0.2;
  droneTone.connect(droneLevel);
  droneLevel.connect(bus);
  droneLevel.connect(hall);
  const sway = ctx.createOscillator();
  sway.frequency.value = 0.11;
  const swayDepth = ctx.createGain();
  swayDepth.gain.value = 80;
  sway.connect(swayDepth).connect(droneTone.frequency);
  sway.start();
  for (const [semitones, detune] of [[0, 0], [0, 11], [7, -7]]) {
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = hz(semitones);
    saw.detune.value = detune;
    saw.connect(droneTone);
    saw.start();
  }

  // The crackle, and the rain on the roof: a soft, steady hiss.
  const crackleTone = ctx.createBiquadFilter();
  crackleTone.type = 'highpass';
  crackleTone.frequency.value = 1800;
  const crackleLevel = ctx.createGain();
  crackleLevel.gain.value = 0.35;
  crackleTone.connect(crackleLevel).connect(bus);
  const record = ctx.createBufferSource();
  record.buffer = crackle(ctx);
  record.loop = true;
  record.connect(crackleTone);
  record.start();
  const rainTone = ctx.createBiquadFilter();
  rainTone.type = 'bandpass';
  rainTone.frequency.value = 4500;
  rainTone.Q.value = 0.4;
  const rainLevel = ctx.createGain();
  rainLevel.gain.value = 0.035;
  rainTone.connect(rainLevel).connect(bus);
  const rain = ctx.createBufferSource();
  rain.buffer = noise;
  rain.loop = true;
  rain.connect(rainTone);
  rain.start();

  return { ctx, bus, tone, hall, noise };
}

/**
 * Plays a source once: in over `attack`, then fading out over `decay`.
 * @param {AudioScheduledSourceNode} source
 * @param {AudioNode} from The end of the source's own chain.
 * @param {AudioNode[]} into
 * @param {{ at: number, level: number, attack?: number, decay: number }} shape
 */
function hit(source, from, into, { at, level, attack = 0.004, decay }) {
  const amp = from.context.createGain();
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(level, at + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  from.connect(amp);
  for (const node of into) amp.connect(node);
  source.start(at);
  source.stop(at + attack + decay + 0.05);
}

/**
 * One note.
 * @param {Rig} rig
 * @param {AudioNode[]} into
 * @param {{ type?: OscillatorType, from: number, to?: number, detune?: number, at: number, level: number, attack?: number, decay: number }} note
 *   `from` is its pitch; `to` slides it there over the note's length.
 */
function pitched({ ctx }, into, { type = 'sine', from, to, detune = 0, ...shape }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(from, shape.at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, shape.at + (shape.attack ?? 0) + shape.decay);
  hit(osc, osc, into, shape);
}

/**
 * A burst of hiss through a filter.
 * @param {Rig} rig
 * @param {AudioNode[]} into
 * @param {{ kind: BiquadFilterType, pitch: number, at: number, level: number, decay: number }} burst
 */
function burst({ ctx, noise }, into, { kind, pitch, ...shape }) {
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = kind;
  filter.frequency.value = pitch;
  source.connect(filter);
  hit(source, filter, into, shape);
}

/**
 * Plays whatever lands on one step of the beat.
 * @param {Rig} rig
 * @param {number} step
 * @param {number} at
 */
function playStep(rig, step, at) {
  const { beat, busy, thump } = layers;
  const drums = [rig.tone];
  if (beat > 0.01) {
    if (KICKS.includes(step)) pitched(rig, drums, { from: 115, to: 44, at, level: 0.8 * beat, decay: 0.22 });
    if (SNARES.includes(step)) {
      burst(rig, [rig.tone, rig.hall], { kind: 'bandpass', pitch: 1900, at, level: 0.32 * beat, decay: 0.13 });
      pitched(rig, drums, { type: 'triangle', from: 330, at, level: 0.16 * beat, decay: 0.04 });
    }
    if (HATS.includes(step)) burst(rig, drums, { kind: 'highpass', pitch: 7000, at, level: (0.07 + 0.06 * Math.random()) * beat, decay: 0.035 });
    const bass = BASS.get(step);
    if (bass !== undefined) pitched(rig, drums, { from: hz(bass), at, level: 0.45 * beat, attack: 0.02, decay: STEP_SECONDS * 6 });
    // A distant voice: a soft, sliding note, mostly echo.
    if (VOICE_STEPS.includes(step)) {
      const note = VOICE_NOTES[Math.floor(Math.random() * VOICE_NOTES.length)];
      for (const detune of [-6, 6]) {
        pitched(rig, [rig.hall], { type: 'triangle', from: hz(note), to: hz(note - 1), detune, at, level: 0.07 * beat, attack: 0.35, decay: 2.2 });
      }
    }
  }
  if (busy > 0.01 && BUSY_HATS.includes(step)) burst(rig, drums, { kind: 'highpass', pitch: 8500, at, level: (0.02 + 0.07 * Math.random()) * busy, decay: 0.03 });
  const beatOfHeart = THUMPS.get(step);
  // The thump goes round the muffling, so it is felt under everything.
  if (thump > 0.01 && beatOfHeart) pitched(rig, [rig.bus], { from: 78, to: 36, at, level: 0.9 * beatOfHeart * thump, decay: 0.3 });
}

/** Lines up the steps of the beat that fall in the next moment. */
function schedule() {
  if (!rig) return;
  const { currentTime } = rig.ctx;
  // With no music playing, nothing is lined up. The beat picks up where it
  // left off.
  if (!now.playing) {
    dueAt = 0;
    return;
  }
  if (dueAt < currentTime) dueAt = currentTime + 0.05;
  while (dueAt < currentTime + 0.25) {
    playStep(rig, step, dueAt + (step % 2 ? SHUFFLE * STEP_SECONDS : 0));
    step = (step + 1) % STEPS;
    dueAt += STEP_SECONDS;
  }
}

/**
 * Says what the music should be doing, a frame at a time. It fades in and
 * out, and builds and calms, smoothly.
 * @param {import('./mix.js').Music} music
 */
export function setMusic(music) {
  if (!rig) {
    // Nothing is made until there is music to play: the first drive.
    const out = music.playing && soundOut();
    if (!out) return;
    rig = build(out);
    setInterval(schedule, 80);
  }
  const changed = music.playing !== now.playing || Math.abs(music.intensity - now.intensity) > 0.005;
  if (!changed) return;
  const { currentTime } = rig.ctx;
  // Out quickly, for a pause or stepping out to film; back in more slowly.
  if (music.playing !== now.playing) rig.bus.gain.setTargetAtTime(music.playing ? tuning.music.loudness : 0, currentTime, music.playing ? 0.7 : 0.25);
  rig.tone.frequency.setTargetAtTime(500 + 3500 * music.intensity, currentTime, 0.5);
  now = music;
  layers = musicLayers(music.intensity);
}
