const state = {
  threads: [],
  selectedThreadId: null
};

const el = {
  threads: document.getElementById('threads-content'),
  tasks: document.getElementById('tasks-content')
};

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

  const listItems = items.map((item) => `
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
  `).join('');

  el.tasks.innerHTML = `
    ${staleBanner}
    <ul class="list">${listItems}</ul>
  `;
}

async function loadThreads() {
  el.threads.innerHTML = '<div class="state loading">loading thread stream…</div>';
  try {
    const res = await fetch('/api/v1/threads');
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
  } catch (err) {
    el.threads.innerHTML = `<div class="state error">${err.message}</div>`;
    renderTasksError('tasks unavailable while thread stream is down');
  }
}

async function loadTasks(threadId) {
  renderTasksLoading();
  try {
    const res = await fetch(`/api/v1/threads/${threadId}/tasks`);
    if (!res.ok) {
      if (res.status === 404) {
        renderTasks({ items: [] });
        return;
      }
      throw new Error('failed to load task links');
    }
    const data = await res.json();
    renderTasks(data);
  } catch (err) {
    renderTasksError(`${err.message} (explicit error state)`);
  }
}

loadThreads();
