// Local development server — run with: node server.js
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 5500;
const ROOT = __dirname;

const MIME = {
    html: 'text/html; charset=utf-8',
    css:  'text/css',
    js:   'application/javascript',
    json: 'application/json',
    png:  'image/png',
    jpg:  'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    svg:  'image/svg+xml',
    ico:  'image/x-icon',
    txt:  'text/plain',
};

const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';

    const filePath = path.join(ROOT, urlPath);

    // Security: prevent path traversal outside ROOT
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext  = path.extname(filePath).slice(1).toLowerCase();
        const mime = MIME[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(filePath).pipe(res);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found: ' + urlPath);
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log('');
    console.log('  Anabolik Kur Takip - Local Server');
    console.log('  ----------------------------------');
    console.log('  http://localhost:' + PORT);
    console.log('');
    console.log('  Durdurmak icin: Ctrl + C');
    console.log('');
});
