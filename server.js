import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markets, news, events } from './lib/market-data.js';

const __filename = fileURLToPath(import.meta.url);
const root = path.dirname(__filename);
const port = 4177;

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store, max-age=0' });
  res.end(body);
}

http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/markets')) return send(res, 200, JSON.stringify(await markets()));
    if (req.url.startsWith('/api/news')) return send(res, 200, JSON.stringify(await news('경제 금융 시장')));
    if (req.url.startsWith('/api/crypto-news')) return send(res, 200, JSON.stringify(await news('비트코인 이더리움 가상자산', true)));
    if (req.url.startsWith('/api/events')) return send(res, 200, JSON.stringify(await events()));
    if (req.url === '/' || req.url === '/economy-dashboard.html') return send(res, 200, fs.readFileSync(path.join(root, 'economy-dashboard.html')), 'text/html; charset=utf-8');
    send(res, 404, JSON.stringify({ error: 'Not found' }));
  } catch (error) {
    console.error(error.message);
    send(res, 502, JSON.stringify({ error: 'Data source unavailable' }));
  }
}).listen(port, () => console.log(`경제 브리핑: http://localhost:${port}`));

