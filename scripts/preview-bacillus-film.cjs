const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = 4185;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
http.createServer((req, res) => {
  let relative;
  try { relative = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname).slice(1); }
  catch { res.writeHead(400).end(); return; }
  if (relative === 'favicon.ico') { res.writeHead(204).end(); return; }
  if (!relative || relative.endsWith('/')) relative += relative ? 'index.html' : 'experiments/bacillus-film/index.html';
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) || relative.split(/[\\/]/).some(part => part.startsWith('.'))) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    res.writeHead(error ? 404 : 200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(error ? 'Arquivo não encontrado. Execute npm run build.' : data);
  });
}).listen(port, '127.0.0.1', () => console.log(`Biofilme de Bacillus · fase 1: http://127.0.0.1:${port}/experiments/bacillus-film/`));
