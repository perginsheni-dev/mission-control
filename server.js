import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const port = process.env.PORT || 3000;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/nasa-catalog.json') {
      const response = await fetch('https://data.nasa.gov/data.json', { signal: AbortSignal.timeout(300000) });
      if (!response.ok || !response.body) throw new Error(`NASA catalog returned ${response.status}`);
      res.writeHead(200, { 'content-type': 'application/json' });
      await pipeline(Readable.fromWeb(response.body), res);
      return;
    }

    const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = path.resolve(root, name);
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const content = await readFile(file);
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(content);
  } catch (error) {
    console.error('Request failed:', error);
    if (res.headersSent) {
      res.destroy();
    } else {
      res.writeHead(error.code === 'ENOENT' ? 404 : 502, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(error.code === 'ENOENT' ? 'Not found' : 'The requested resource is unavailable.');
    }
  }
}).listen(port, () => console.log(`Mission Control running at http://localhost:${port}`));
