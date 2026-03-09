const healthline = document.getElementById('healthline');
const threadsState = document.getElementById('threads-state');
const tasksState = document.getElementById('tasks-state');
const treasuryState = document.getElementById('treasury-state');

function setState(el, mode, text) {
  el.className = `state ${mode}`;
  el.textContent = text;
}

function renderSummary(payload, sourceLabel) {
  const threads = payload?.panes?.threads?.count ?? 0;
  const tasks = payload?.panes?.tasks?.count ?? 0;
  const treasury = payload?.panes?.treasury?.count ?? 0;

  setState(threadsState, threads > 0 ? 'ok' : 'empty', `open pull requests: ${threads}`);
  setState(tasksState, tasks > 0 ? 'ok' : 'empty', `open issues: ${tasks}`);
  setState(treasuryState, 'empty', `pending proposals: ${treasury}`);

  const sync = payload?.health?.github_sync || 'unknown';
  const fetchedAt = payload?.fetched_at ? new Date(payload.fetched_at).toISOString() : 'n/a';
  healthline.textContent = `source=${sourceLabel} · github_sync=${sync} · fetched_at=${fetchedAt}`;
}

function renderError(message) {
  setState(threadsState, 'error', `error: ${message}`);
  setState(tasksState, 'error', `error: ${message}`);
  setState(treasuryState, 'error', `error: ${message}`);
  healthline.textContent = `source=error · ${message}`;
}

function mockPayload() {
  return {
    fetched_at: new Date().toISOString(),
    health: { api: 'ok', github_sync: 'mock' },
    panes: {
      threads: { count: 2 },
      tasks: { count: 5 },
      treasury: { count: 0 }
    }
  };
}

async function boot() {
  const params = new URLSearchParams(window.location.search);
  const useMock = params.get('mock') === '1';

  if (useMock) {
    renderSummary(mockPayload(), 'mock');
    return;
  }

  try {
    const res = await fetch('/api/cockpit/summary', { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      renderError(`api_unavailable (${res.status})`);
      return;
    }

    const payload = await res.json();
    renderSummary(payload, 'api');
  } catch (err) {
    renderError('api_unreachable');
  }
}

boot();
