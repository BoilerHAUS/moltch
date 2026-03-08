function loadConfig() {
  const cfg = {
    port: Number(process.env.PORT || 8080),
    nodeEnv: process.env.NODE_ENV || 'development',
    appName: process.env.APP_NAME || 'moltch-api',
    readyToken: process.env.READY_TOKEN || ''
  };

  if (!Number.isInteger(cfg.port) || cfg.port < 1 || cfg.port > 65535) {
    throw new Error('Invalid PORT; must be integer in range 1..65535');
  }

  return cfg;
}

module.exports = { loadConfig };
