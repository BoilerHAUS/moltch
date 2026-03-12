const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const root = __dirname;
const resolvedRoot = path.resolve(root);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8'
};

function proxyApi(req, res, pathname) {
  const target = new URL(pathname, API_BASE_URL);

  const proxyReq = http.request(target, { method: req.method, headers: req.headers }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'api_unavailable' }));
  });

  req.pipe(proxyReq);
}

http.createServer((req, res) => {
  const host = req.headers.host || 'localhost';
  const pathname = new URL(req.url, `http://${host}`).pathname;

  if (pathname.startsWith('/api/')) {
    const apiPath = pathname.replace(/^\/api/, '');
    proxyApi(req, res, apiPath);
    return;
  }

  const reqPath = pathname === '/' ? '/index.html' : pathname;
  const file = path.resolve(root, `.${reqPath}`);

  if (!(file === resolvedRoot || file.startsWith(`${resolvedRoot}${path.sep}`))) {
    res.writeHead(403); return res.end('forbidden');
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404); return res.end('not found');
    }
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'text/plain'});
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`moltch web shell listening on :${PORT}`);
});
