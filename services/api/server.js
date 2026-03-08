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

const server = http.createServer((req, res) => {
  const start = Date.now();

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: cfg.appName }));
  } else if (req.url === '/ready') {
    const ready = Boolean(cfg.readyToken || cfg.nodeEnv !== 'production');
    res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: ready ? 'ready' : 'not_ready', requires: ready ? null : 'READY_TOKEN' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  }

  log('info', 'request', { method: req.method, path: req.url, status: res.statusCode, ms: Date.now() - start });
});

server.listen(cfg.port, () => {
  log('info', 'api_started', { port: cfg.port, env: cfg.nodeEnv });
});
