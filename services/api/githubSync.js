const https = require('https');

function githubRequest(path, token) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.github.com',
        path,
        method: 'GET',
        headers: {
          'User-Agent': 'moltch-api',
          Accept: 'application/vnd.github+json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        timeout: 8000
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode || 0, body });
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => req.destroy(new Error('network_timeout')));
    req.end();
  });
}

function normalizeItem(item) {
  const isPr = Boolean(item.pull_request);
  return {
    id: item.number,
    type: isPr ? 'pr' : 'issue',
    title: item.title,
    state: item.state,
    url: item.html_url,
    updated_at: item.updated_at,
    assignee: item.assignee ? item.assignee.login : null
  };
}

async function fetchGithubSync(cfg) {
  const [owner, repo] = cfg.githubSyncRepo.split('/');
  const path = `/repos/${owner}/${repo}/issues?state=open&per_page=${cfg.githubSyncPerPage}`;

  try {
    const response = await githubRequest(path, cfg.githubToken);

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        error: {
          kind: response.status === 401 ? 'auth' : 'rate_limit',
          message: 'GitHub API authorization/rate limit failure',
          status: response.status
        }
      };
    }

    if (response.status >= 400) {
      return {
        ok: false,
        error: {
          kind: 'network',
          message: `GitHub API returned status ${response.status}`,
          status: response.status
        }
      };
    }

    const parsed = JSON.parse(response.body);
    return {
      ok: true,
      repo: cfg.githubSyncRepo,
      fetched_at: new Date().toISOString(),
      items: parsed.map(normalizeItem)
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: 'network',
        message: err.message,
        status: 0
      }
    };
  }
}

module.exports = { fetchGithubSync };
