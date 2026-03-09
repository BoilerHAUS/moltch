function loadConfig() {
  const cfg = {
    port: Number(process.env.PORT || 8080),
    nodeEnv: process.env.NODE_ENV || 'development',
    appName: process.env.APP_NAME || 'moltch-api',
    readyToken: process.env.READY_TOKEN || '',
    githubSyncRepo: process.env.GITHUB_SYNC_REPO || 'BoilerHAUS/moltch',
    githubSyncPerPage: Number(process.env.GITHUB_SYNC_PER_PAGE || 25),
    githubToken: process.env.GITHUB_TOKEN || ''
  };

  if (!Number.isInteger(cfg.port) || cfg.port < 1 || cfg.port > 65535) {
    throw new Error('Invalid PORT; must be integer in range 1..65535');
  }

  if (!Number.isInteger(cfg.githubSyncPerPage) || cfg.githubSyncPerPage < 1 || cfg.githubSyncPerPage > 100) {
    throw new Error('Invalid GITHUB_SYNC_PER_PAGE; must be integer in range 1..100');
  }

  if (!/^[^/]+\/[^/]+$/.test(cfg.githubSyncRepo)) {
    throw new Error('Invalid GITHUB_SYNC_REPO; must be owner/repo');
  }

  return cfg;
}

module.exports = { loadConfig };
