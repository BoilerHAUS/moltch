function log(level, msg, extra = {}) {
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...extra
  };
  // structured logs
  console.log(JSON.stringify(line));
}

module.exports = { log };
