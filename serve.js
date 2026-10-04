// The local server. `npm start` runs it.
// It serves this folder with caching off, so a saved edit shows up on refresh.

import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = 8000;
const hosts = [`localhost:${port}`, `127.0.0.1:${port}`];

// The kinds of file a browser refuses to use unless they are labelled.
/** @type {Record<string, string>} */
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    const file = resolve(root, '.' + path + (path.endsWith('/') ? 'index.html' : ''));

    // Only answer a browser on this computer, and only with files from this
    // folder. A part starting with a dot is either a step out of the folder
    // (`..`) or a hidden file such as `.git`.
    const hidden = relative(root, file).split(sep).some((part) => part.startsWith('.'));
    if (!hosts.includes(req.headers.host ?? '') || !file.startsWith(root) || hidden) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`SquallLine is running at http://localhost:${port}`);
});
