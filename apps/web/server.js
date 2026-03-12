const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';
const apiBase = new URL(API_BASE_URL);
const root = __dirname;
const resolvedRoot = path.resolve(root);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8'
};

function proxyApi(req, res, pathname) {
  const upstreamPath = pathname.replace(/^\/api/, '') || '/';
  const upstream = http.request(
    {
      protocol: apiBase.protocol,
      hostname: apiBase.hostname,
      port: apiBase.port || 80,
      path: upstreamPath,
      method: req.method,
      headers: {
        Accept: 'application/json'
      },
      timeout: 5000
    },
    (upstreamRes) => {
      let body = '';
      upstreamRes.on('data', (chunk) => {
        body += chunk;
      });
      upstreamRes.on('end', () => {
        res.writeHead(upstreamRes.statusCode || 502, { 'Content-Type': 'application/json' });
        res.end(body || JSON.stringify({ error: 'empty_upstream' }));
      });
    }
  );

  upstream.on('error', () => {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'api_unreachable' }));
  });

  upstream.on('timeout', () => {
    upstream.destroy();
    res.writeHead(504, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'api_timeout' }));
  });

  upstream.end();
}

http
  .createServer((req, res) => {
    const host = req.headers.host || 'localhost';
    const pathname = new URL(req.url, `http://${host}`).pathname;

    if (pathname.startsWith('/api/')) {
      proxyApi(req, res, pathname);
      return;
    }

    const reqPath = pathname === '/' ? '/index.html' : pathname;
    const file = path.resolve(root, `.${reqPath}`);

    if (!(file === resolvedRoot || file.startsWith(`${resolvedRoot}${path.sep}`))) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }

    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'text/plain' });
      res.end(data);
    });
  })
  .listen(PORT, () => {
    console.log(`moltch web shell listening on :${PORT}`);
  });
