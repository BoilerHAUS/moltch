const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./config');
const { log } = require('./logger');

let cfg;
try {
  cfg = loadConfig();
} catch (err) {
  console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'fatal', msg: err.message }));
  process.exit(1);
}

const fixturePath = path.join(__dirname, 'fixtures', 'issue-pr-links.v1.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function sendJson(req, res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  const start = Date.now();
  const host = req.headers.host || 'localhost';
  const url = new URL(req.url, `http://${host}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    sendJson(req, res, 204, {});
    log('info', 'request', { method: req.method, path: pathname, status: res.statusCode, ms: Date.now() - start });
    return;
  }

  if (!['GET', 'HEAD'].includes(req.method)) {
    sendJson(req, res, 405, { error: 'method_not_allowed' });
    log('info', 'request', { method: req.method, path: pathname, status: res.statusCode, ms: Date.now() - start });
    return;
  }

  if (pathname === '/health') {
    sendJson(req, res, 200, { status: 'ok', service: cfg.appName });
  } else if (pathname === '/ready') {
    const ready = Boolean(cfg.readyToken || cfg.nodeEnv !== 'production');
    sendJson(req, res, ready ? 200 : 503, { status: ready ? 'ready' : 'not_ready', requires: ready ? null : 'READY_TOKEN' });
  } else if (pathname === '/v1/threads') {
    sendJson(req, res, 200, {
      version: fixture.version,
      generated_at: fixture.generated_at,
      threads: fixture.threads.map((thread) => ({
        thread_id: thread.thread_id,
        title: thread.title,
        source: thread.source,
        linked_items_count: thread.items.length,
        stale: thread.stale,
        updated_at: thread.updated_at
      }))
    });
  } else if (pathname.startsWith('/v1/threads/') && pathname.endsWith('/tasks')) {
    const threadId = pathname.replace('/v1/threads/', '').replace('/tasks', '');
    const thread = fixture.threads.find((entry) => entry.thread_id === threadId);

    if (!thread) {
      sendJson(req, res, 404, {
        version: fixture.version,
        error: 'thread_not_found',
        thread_id: threadId
      });
    } else {
      sendJson(req, res, 200, {
        version: fixture.version,
        generated_at: fixture.generated_at,
        thread: {
          thread_id: thread.thread_id,
          title: thread.title,
          stale: thread.stale,
          updated_at: thread.updated_at
        },
        items: thread.items
      });
    }
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
