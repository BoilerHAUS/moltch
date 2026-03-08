function loadConfig() {
  const cfg = {
    port: Number(process.env.PORT || 8080),
    nodeEnv: process.env.NODE_ENV || 'development',
    appName: process.env.APP_NAME || 'moltch-api',
    readyToken: process.env.READY_TOKEN || ''
  };

  if (!Number.isInteger(cfg.port) || cfg.port <= 0) {
    throw new Error('Invalid PORT; must be positive integer');
  }

  return cfg;
}

module.exports = { loadConfig };
