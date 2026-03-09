const http = require('http');
const { loadConfig } = require('./config');
const { log } = require('./logger');
const { fetchGithubSync } = require('./githubSync');

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

const server = http.createServer(async (req, res) => {
  const start = Date.now();
  const host = req.headers.host || 'localhost';
  const pathname = new URL(req.url, `http://${host}`).pathname;

  if (pathname === '/health' || pathname === '/ready' || pathname === '/sync/github' || pathname === '/cockpit/summary') {
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
  } else if (pathname === '/sync/github') {
    const sync = await fetchGithubSync(cfg);
    if (!sync.ok) {
      sendJson(req, res, 502, {
        ok: false,
        repo: cfg.githubSyncRepo,
        fetched_at: new Date().toISOString(),
        items: [],
        error: sync.error
      });
    } else {
      sendJson(req, res, 200, sync);
    }
  } else if (pathname === '/cockpit/summary') {
    const sync = await fetchGithubSync(cfg);

    if (!sync.ok) {
      sendJson(req, res, 200, {
        fetched_at: new Date().toISOString(),
        health: { api: 'ok', github_sync: 'error' },
        panes: {
          threads: { count: 0 },
          tasks: { count: 0 },
          treasury: { count: 0 }
        },
        source: { repo: cfg.githubSyncRepo, mode: 'api', sync_ok: false, error: sync.error }
      });
    } else {
      const prCount = sync.items.filter((it) => it.type === 'pr').length;
      const issueCount = sync.items.filter((it) => it.type === 'issue').length;

      sendJson(req, res, 200, {
        fetched_at: sync.fetched_at,
        health: { api: 'ok', github_sync: 'ok' },
        panes: {
          threads: { count: prCount },
          tasks: { count: issueCount },
          treasury: { count: 0 }
        },
        source: { repo: sync.repo, mode: 'api', sync_ok: true }
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
