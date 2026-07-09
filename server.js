// Custom Next.js server with built-in keep-alive
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Self-ping to prevent sandbox from killing idle process
setInterval(() => {
  createServer((_, res) => {
    res.writeHead(200);
    res.end('pong');
  }).listen(0, '127.0.0.1', () => {}).close();
}, 5000);

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error:', err);
      res.writeHead(500);
      res.end('Internal error');
    }
  }).listen(port, hostname, () => {
    console.log(`> RepoLens AI ready on http://${hostname}:${port}`);
  });
});