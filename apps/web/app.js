window.ENABLE_COMMERCIAL_ANALYTICS = window.ENABLE_COMMERCIAL_ANALYTICS === true;

const healthline = document.getElementById('healthline');
const treasuryState = document.getElementById('treasury-state');

const DECISIONS_FIXTURE = [
  {
    id: 'dec-2026-03-17-001',
    title: 'pilot launch gate · acme sandbox',
    status: 'pending',
    scenario: 'pilot_rollout',
    roleRequired: 'approver',
    correlationId: 'corr-4f9d6de5f7b9',
    evidence: [
      { label: 'evidence pack summary', url: '/docs/operations/evidence/assembler/2026-03-17/bundle_summary.md' },
      { label: 'bundle manifest', url: '/docs/operations/evidence/assembler/2026-03-17/bundle_manifest.json' },
      { label: 'policy migration report', url: '/docs/governance/evidence/policy_reason_code_migration_report_2026-03-17.json' }
    ],
    trace: [
      { label: 'decision trace · audit stream', url: 'https://github.com/BoilerHAUS/moltch/issues/168' }
    ]
  },
  {
    id: 'dec-2026-03-17-002',
    title: 'enterprise pilot · northwind intake',
    status: 'pending',
    scenario: 'enterprise_intake',
    roleRequired: 'reviewer',
    correlationId: 'corr-8a1f0f4af22c',
    evidence: [
      { label: 'launch readiness index', url: '/docs/operations/evidence/LAUNCH_EVIDENCE_INDEX_2026-03.md' },
      { label: 'validation report', url: '/docs/operations/evidence/assembler/2026-03-17/validation_report.json' }
    ],
    trace: [
      { label: 'thread history', url: 'https://github.com/BoilerHAUS/moltch/issues/100' }
    ]
  }
];

const decisionWorkflow = window.DecisionWorkflow || {
  getReasonCodeOptions: () => [],
  validateDecisionSubmission: () => ['decision workflow module unavailable']
};

const state = {
  threads: [],
  selectedThreadId: null,
  decisions: DECISIONS_FIXTURE,
  selectedDecisionId: DECISIONS_FIXTURE[0]?.id || null,
  decisionRole: 'reviewer',
  decisionForm: {
    verdict: '',
    reasonCode: '',
    notes: ''
  },
  decisionErrors: [],
  decisionSuccess: ''
};

const el = {
  threads: document.getElementById('threads-content'),
  tasks: document.getElementById('tasks-content'),
  analytics: document.getElementById('analytics-content'),
  decisions: document.getElementById('decisions-content')
};

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setState(node, mode, text) {
  node.className = `state ${mode}`;
  node.textContent = text;
}

function getSelectedDecision() {
  return state.decisions.find((entry) => entry.id === state.selectedDecisionId) || null;
}

function renderThreads() {
  if (!state.threads.length) {
    el.threads.innerHTML = '<div class="state empty">no threads loaded yet</div>';
    return;
  }

  const list = document.createElement('ul');
  list.className = 'list';

  for (const thread of state.threads) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = `row ${thread.thread_id === state.selectedThreadId ? 'active' : ''}`;
    btn.innerHTML = `
      <strong>${thread.title}</strong>
      <span>#${thread.thread_id}</span>
      <span>${thread.linked_items_count} linked</span>
      ${thread.stale ? '<em class="pill stale">stale</em>' : ''}
    `;
    btn.addEventListener('click', () => {
      state.selectedThreadId = thread.thread_id;
      renderThreads();
      loadTasks(thread.thread_id);
    });
    li.appendChild(btn);
    list.appendChild(li);
  }

  el.threads.innerHTML = '';
  el.threads.appendChild(list);
}

function renderTasksLoading() {
  el.tasks.innerHTML = '<div class="state loading">loading linked issue/pr status…</div>';
}

function renderTasksError(message) {
  el.tasks.innerHTML = `<div class="state error">${message}</div>`;
}

function renderTasks(data) {
  const items = data.items || [];
  if (!items.length) {
    el.tasks.innerHTML = '<div class="state empty">no linked issue/pr items for this thread</div>';
    return;
  }

  const staleBanner = data.thread?.stale
    ? '<div class="state stale">warning: linked data is stale, refresh adapter sync</div>'
    : '';

  const listItems = items
    .map(
      (item) => `
    <li class="row-item">
      <div>
        <strong>${item.type === 'pull_request' ? 'pr' : 'issue'} #${item.number}</strong>
        <p>${item.title}</p>
      </div>
      <div class="right">
        <span class="pill">${item.status}</span>
        <a href="${item.url}" target="_blank" rel="noreferrer">open ↗</a>
      </div>
    </li>
  `
    )
    .join('');

  el.tasks.innerHTML = `
    ${staleBanner}
    <ul class="list">${listItems}</ul>
  `;
}

function getReasonCodeOptions(verdict) {
  return decisionWorkflow.getReasonCodeOptions(verdict);
}

function renderDecisionWorkflow() {
  const selected = getSelectedDecision();

  if (!state.decisions.length) {
    el.decisions.innerHTML = '<div class="state empty">no pending decisions in queue</div>';
    return;
  }

  const decisionOptions = state.decisions
    .map(
      (decision) => `<option value="${decision.id}" ${decision.id === state.selectedDecisionId ? 'selected' : ''}>${escapeHtml(
        `${decision.title} (${decision.id})`
      )}</option>`
    )
    .join('');

  const reasonOptions = getReasonCodeOptions(state.decisionForm.verdict)
    .map((code) => `<option value="${code}" ${state.decisionForm.reasonCode === code ? 'selected' : ''}>${code}</option>`)
    .join('');

  const evidenceRows = (selected?.evidence || [])
    .map((item) => `<li><a href="${item.url}" target="_blank" rel="noreferrer">${escapeHtml(item.label)} ↗</a></li>`)
    .join('');

  const traceRows = (selected?.trace || [])
    .map((item) => `<li><a href="${item.url}" target="_blank" rel="noreferrer">${escapeHtml(item.label)} ↗</a></li>`)
    .join('');

  const roleHint = state.decisionRole === 'approver'
    ? '<div class="state ok">approver mode: final verdict actions enabled</div>'
    : '<div class="state stale">reviewer mode: you can review evidence but cannot submit final verdicts</div>';

  const errors = state.decisionErrors.length
    ? `<div class="state error">${state.decisionErrors.map((error) => `• ${escapeHtml(error)}`).join('<br/>')}</div>`
    : '';

  const success = state.decisionSuccess ? `<div class="state ok">${escapeHtml(state.decisionSuccess)}</div>` : '';

  el.decisions.innerHTML = `
    <div class="state loading">guided flow: 1) pick decision 2) choose verdict + reason 3) verify evidence + trace 4) submit</div>

    <label class="field-label" for="decision-role">operator role</label>
    <select id="decision-role" class="control">
      <option value="reviewer" ${state.decisionRole === 'reviewer' ? 'selected' : ''}>reviewer</option>
      <option value="approver" ${state.decisionRole === 'approver' ? 'selected' : ''}>approver</option>
    </select>

    ${roleHint}

    <label class="field-label" for="decision-select">pending decision</label>
    <select id="decision-select" class="control">${decisionOptions}</select>

    <div class="decision-meta">
      <span class="pill">status: ${selected?.status || 'n/a'}</span>
      <span class="pill">scenario: ${selected?.scenario || 'n/a'}</span>
      <span class="pill">correlation_id: ${selected?.correlationId || 'n/a'}</span>
    </div>

    <label class="field-label">verdict action</label>
    <div class="radio-row">
      ${['go', 'hold', 'no-go']
        .map(
          (value) => `<label><input type="radio" name="verdict" value="${value}" ${
            state.decisionForm.verdict === value ? 'checked' : ''
          }/> ${value}</label>`
        )
        .join('')}
    </div>

    <label class="field-label" for="decision-reason-code">reason code</label>
    <select id="decision-reason-code" class="control">
      <option value="">select reason code…</option>
      ${reasonOptions}
    </select>

    <label class="field-label" for="decision-notes">operator notes</label>
    <textarea id="decision-notes" class="control" rows="3" placeholder="optional notes for audit trail">${escapeHtml(
      state.decisionForm.notes
    )}</textarea>

    <div class="evidence-block">
      <h3>evidence links</h3>
      <ul>${evidenceRows || '<li>no evidence links available</li>'}</ul>
      <h3>trace links</h3>
      <ul>${traceRows || '<li>no trace links available</li>'}</ul>
    </div>

    ${errors}
    ${success}

    <button id="decision-submit" class="submit-btn" ${state.decisionRole !== 'approver' ? 'disabled' : ''}>submit verdict</button>
    <div class="state empty">target usability: complete decision in under 5 minutes on test scenario</div>
  `;

  const roleInput = document.getElementById('decision-role');
  const decisionInput = document.getElementById('decision-select');
  const reasonInput = document.getElementById('decision-reason-code');
  const notesInput = document.getElementById('decision-notes');
  const submitBtn = document.getElementById('decision-submit');

  roleInput.addEventListener('change', () => {
    state.decisionRole = roleInput.value;
    state.decisionErrors = [];
    state.decisionSuccess = '';
    renderDecisionWorkflow();
  });

  decisionInput.addEventListener('change', () => {
    state.selectedDecisionId = decisionInput.value;
    state.decisionErrors = [];
    state.decisionSuccess = '';
    renderDecisionWorkflow();
  });

  for (const verdictNode of document.querySelectorAll('input[name="verdict"]')) {
    verdictNode.addEventListener('change', () => {
      state.decisionForm.verdict = verdictNode.value;
      state.decisionForm.reasonCode = '';
      state.decisionErrors = [];
      state.decisionSuccess = '';
      renderDecisionWorkflow();
    });
  }

  reasonInput.addEventListener('change', () => {
    state.decisionForm.reasonCode = reasonInput.value;
  });

  notesInput.addEventListener('input', () => {
    state.decisionForm.notes = notesInput.value;
  });

  submitBtn.addEventListener('click', () => {
    const decision = getSelectedDecision();
    const errors = decisionWorkflow.validateDecisionSubmission({
      role: state.decisionRole,
      decision,
      form: state.decisionForm
    });

    state.decisionErrors = errors;
    state.decisionSuccess = '';

    if (errors.length) {
      renderDecisionWorkflow();
      return;
    }

    state.decisionSuccess = `verdict submitted: ${state.decisionForm.verdict} · ${state.decisionForm.reasonCode} · ${decision.correlationId}`;
    state.decisionForm = { verdict: '', reasonCode: '', notes: '' };
    renderDecisionWorkflow();
  });
}

async function loadThreads() {
  el.threads.innerHTML = '<div class="state loading">loading thread stream…</div>';
  try {
    const res = await fetch('/api/v1/threads', { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('failed to load thread stream');
    const data = await res.json();
    state.threads = data.threads || [];
    state.selectedThreadId = state.threads[0]?.thread_id || null;
    renderThreads();

    if (state.selectedThreadId) {
      await loadTasks(state.selectedThreadId);
    } else {
      renderTasks({ items: [] });
    }

    healthline.textContent = `source=api · sync=v1 thread links · fetched_at=${data.generated_at || 'n/a'}`;
    setState(treasuryState, 'empty', 'pending proposals: 0');
  } catch (err) {
    el.threads.innerHTML = `<div class="state error">${err.message}</div>`;
    renderTasksError('tasks unavailable while thread stream is down');
    healthline.textContent = `source=error · ${err.message}`;
    setState(treasuryState, 'error', `error: ${err.message}`);
  }
}

async function loadTasks(threadId) {
  renderTasksLoading();
  try {
    const res = await fetch(`/api/v1/threads/${threadId}/tasks`, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      if (res.status === 404) {
        renderTasks({ items: [] });
        return;
      }
      throw new Error(`failed to load task links (${res.status})`);
    }
    const data = await res.json();
    renderTasks(data);
  } catch (err) {
    renderTasksError(`${err.message} (explicit error state)`);
  }
}

function renderAnalyticsState(mode, text) {
  el.analytics.innerHTML = `<div class="state ${mode}">${text}</div>`;
}

function renderAnalytics(data) {
  const kpi = data?.kpi || {};
  const provenance = data?.provenance || {};

  const rows = [
    ['outreach_volume', kpi.outreach_volume ?? 'n/a'],
    ['positive_reply_rate', kpi.positive_reply_rate ?? 'n/a'],
    ['call_booking_rate', kpi.call_booking_rate ?? 'n/a'],
    ['pilot_offer_rate', kpi.pilot_offer_rate ?? 'n/a'],
    ['pilot_start_rate', kpi.pilot_start_rate ?? 'n/a']
  ];

  const items = rows
    .map(([name, value]) => `<li class="row-item"><div><strong>${name}</strong></div><div class="right"><span class="pill">${value}</span></div></li>`)
    .join('');

  el.analytics.innerHTML = `
    <div class="state ok">source=${provenance.source || 'n/a'} · refreshed_at=${provenance.refreshed_at || 'n/a'}</div>
    <ul class="list">${items}</ul>
  `;
}

async function loadAnalytics() {
  if (window.ENABLE_COMMERCIAL_ANALYTICS !== true) {
    renderAnalyticsState('empty', 'feature gated: available after v1 launch checkpoint');
    return;
  }

  renderAnalyticsState('loading', 'loading analytics snapshot…');
  try {
    const res = await fetch('/artifacts/commercial_analytics_snapshot_v1.json', { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      if (res.status === 404) {
        renderAnalyticsState('empty', 'no analytics snapshot artifact found');
        return;
      }
      throw new Error(`analytics unavailable (${res.status})`);
    }
    const data = await res.json();
    renderAnalytics(data);
  } catch (err) {
    renderAnalyticsState('error', `${err.message} (explicit error state)`);
  }
}

loadThreads();
loadAnalytics();
renderDecisionWorkflow();
