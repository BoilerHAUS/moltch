const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const root = __dirname;
const resolvedRoot = path.resolve(root);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8'
};

http.createServer((req, res) => {
  const host = req.headers.host || 'localhost';
  const pathname = new URL(req.url, `http://${host}`).pathname;
  const reqPath = pathname === '/' ? '/index.html' : pathname;
  const file = path.resolve(root, `.${reqPath}`);

  if (!(file === resolvedRoot || file.startsWith(`${resolvedRoot}${path.sep}`))) {
    res.writeHead(403); return res.end('forbidden');
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404); return res.end('not found');
    }
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'text/plain'});
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`moltch web shell listening on :${PORT}`);
});
