// Local preview only. Nothing is uploaded or written into the game/save data.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const root = path.resolve(__dirname, '../dist');
const original = path.resolve(__dirname, '../../miguelito-current-main/dist');
const port = Number(process.env.PORT || 4180);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ogg':'audio/ogg' };
const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch (_) { res.writeHead(400).end(); return; }
  const baseline = pathname.startsWith('/original/');
  const base = baseline ? original : root;
  let relative = baseline ? pathname.slice('/original/'.length) : pathname.slice(1);
  if (!relative) relative = 'index.html';
  const file = path.resolve(base, relative);
  if (!file.startsWith(base + path.sep) || relative.split(/[\\/]/).some(p => p.startsWith('.'))) {
    res.writeHead(403).end('Forbidden'); return;
  }
  fs.readFile(file, (err, data) => {
    res.writeHead(err ? 404 : 200, { 'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    res.end(err ? 'Arquivo indisponivel. Execute node scripts/build.cjs primeiro.' : data);
  });
});
server.on('error', err => { console.error(`Preview: ${err.message}. Feche outro preview nesta porta ou defina PORT.`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}/index.html?render=25d&painel=1`;
  console.log(`Ajustado: ${url}\nCtrl+C encerra. A main e a versao publicada nao sao alteradas.`);
  if (fs.existsSync(original)) console.log(`Main original: http://127.0.0.1:${port}/original/index.html?render=25d&painel=1`);
  if (process.argv.includes('--open') && process.platform === 'win32') execFile('rundll32.exe', ['url.dll,FileProtocolHandler', url]);
});
