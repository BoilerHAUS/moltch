const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const root = __dirname;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8'
};

http.createServer((req, res) => {
  const reqPath = req.url === '/' ? '/index.html' : req.url;
  const file = path.join(root, reqPath);
  if (!file.startsWith(root)) {
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
