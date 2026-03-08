const http = require('http');
const { loadConfig } = require('./config');
const { log } = require('./logger');

let cfg;
try {
  cfg = loadConfig();
} catch (err) {
  console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'fatal', msg: err.message }));
  process.exit(1);
}

function sendJson(req, res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  const start = Date.now();
  const host = req.headers.host || 'localhost';
  const pathname = new URL(req.url, `http://${host}`).pathname;

  if (pathname === '/health' || pathname === '/ready') {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(req, res, 405, { error: 'method_not_allowed' });
      log('info', 'request', { method: req.method, path: pathname, status: res.statusCode, ms: Date.now() - start });
      return;
    }
  }

  if (pathname === '/health') {
    sendJson(req, res, 200, { status: 'ok', service: cfg.appName });
  } else if (pathname === '/ready') {
    const ready = Boolean(cfg.readyToken || cfg.nodeEnv !== 'production');
    sendJson(req, res, ready ? 200 : 503, { status: ready ? 'ready' : 'not_ready', requires: ready ? null : 'READY_TOKEN' });
  } else {
    sendJson(req, res, 404, { error: 'not_found' });
  }

  log('info', 'request', { method: req.method, path: pathname, status: res.statusCode, ms: Date.now() - start });
});

server.listen(cfg.port, () => {
  log('info', 'api_started', { port: cfg.port, env: cfg.nodeEnv });
});

process.on('SIGTERM', () => {
  log('info', 'sigterm_received', { msg: 'graceful shutdown start' });
  server.close(() => {
    log('info', 'api_stopped', { msg: 'graceful shutdown complete' });
    process.exit(0);
  });
});
