import { createServer } from 'http';
import { spawn } from 'child_process';
import http from 'http';

const PORT = 3000;
const TARGET = 'http://127.0.0.1:3001';
let nextProcess = null;
let nextReady = false;

function startNext() {
  if (nextProcess) return;
  console.log('[proxy] Spawning Next.js on port 3001...');
  nextProcess = spawn('npx', ['next', 'start', '--port', '3001'], {
    cwd: '/home/z/my-project',
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=384' }
  });
  nextProcess.stdout.on('data', d => {
    const s = d.toString();
    process.stdout.write(s);
    if (s.includes('Ready')) nextReady = true;
  });
  nextProcess.stderr.on('data', d => process.stderr.write(d.toString()));
  nextProcess.on('exit', () => {
    console.log('[proxy] Next.js exited, will restart on next request');
    nextProcess = null;
    nextReady = false;
  });
  setTimeout(() => { nextReady = true; }, 5000);
}

const server = createServer((req, res) => {
  if (!nextProcess) startNext();

  const timer = setTimeout(() => {
    res.writeHead(504, { 'Content-Type': 'text/plain' });
    res.end('Starting up, please retry...');
  }, 10000);

  const proxy = http.request(TARGET + req.url, {
    method: req.method,
    headers: req.headers,
  }, (proxyRes) => {
    clearTimeout(timer);
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxy.on('error', () => {
    clearTimeout(timer);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Not ready, please retry...');
  });
  req.pipe(proxy);
});

server.listen(PORT, () => {
  console.log('[proxy] Proxy on port ' + PORT);
  startNext();
});

setInterval(() => {
  if (!nextProcess) startNext();
  http.get(TARGET + '/', () => {}).on('error', () => {
    if (!nextProcess) startNext();
  });
}, 10000);