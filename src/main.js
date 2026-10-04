// Starts the game.

import { tuning } from '../tuning.js';
import { draw } from './draw.js';

const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('canvas'));

document.title = tuning.title;
draw(/** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')));
