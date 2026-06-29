const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { createProxyMiddleware } = require('http-proxy-middleware');

const port = process.env.PORT || 5173;
const distPath = path.join(__dirname, 'dist');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

// ── Backend API proxy
const backendProxy = createProxyMiddleware({
  target: process.env.BACKEND_URL || 'http://localhost:8000',
  changeOrigin: true,
});

// ── MinerU REST API proxy  (/mineru/* → https://mineru.net/*)
// Only carries small JSON payloads: get pre-signed URL, poll status.
const mineruProxy = createProxyMiddleware({
  target: 'https://mineru.net',
  changeOrigin: true,
  secure: true,
  pathRewrite: { '^/mineru': '' },
  on: {
    proxyReq: (proxyReq) => {
      proxyReq.setHeader('Origin', 'https://mineru.net');
      proxyReq.setHeader('Referer', 'https://mineru.net/');
    },
    error: (err, req, res) => {
      console.error('MinerU proxy error:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'MinerU proxy error', detail: err.message }));
    },
  },
});

// ── Alibaba OSS upload proxy  (/oss-upload/<oss-path>?<oss-query-params>)
//
// MinerU returns a pre-signed URL like:
//   https://mineru.oss-cn-shanghai.aliyuncs.com/api-upload/.../file.pdf?Expires=...&Signature=...
//
// The browser can't PUT to it directly — the OSS bucket has no CORS header.
// The frontend rewrites that URL to:
//   /oss-upload/api-upload/.../file.pdf?Expires=...&Signature=...
// and we proxy it server-side (no CORS restriction).
const ossProxy = createProxyMiddleware({
  target: 'https://mineru.oss-cn-shanghai.aliyuncs.com',
  changeOrigin: true,
  secure: true,
  pathRewrite: { '^/oss-upload': '' },
  on: {
    proxyReq: (proxyReq) => {
      // OSS pre-signed URLs are signed for this exact hostname.
      // If Host is wrong, OSS returns SignatureDoesNotMatch (403).
      proxyReq.setHeader('Host', 'mineru.oss-cn-shanghai.aliyuncs.com');
      // Auth is entirely in the query string (Signature, Expires, OSSAccessKeyId)
      proxyReq.removeHeader('Authorization');
      // OSS pre-signed PUTs are signed WITHOUT Content-Type.
      // Forwarding any Content-Type header also breaks the signature.
      proxyReq.removeHeader('Content-Type');
      proxyReq.removeHeader('content-type');
    },
    error: (err, req, res) => {
      console.error('OSS proxy error:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'OSS proxy error', detail: err.message }));
    },
  },
});


// ── MinerU CDN result download proxy  (/cdn-mineru/* → https://cdn-mineru.openxlab.org.cn/*)
// The result zip lives on this CDN which also lacks CORS headers.
const cdnProxy = createProxyMiddleware({
  target: 'https://cdn-mineru.openxlab.org.cn',
  changeOrigin: true,
  secure: true,
  pathRewrite: { '^/cdn-mineru': '' },
  on: {
    proxyReq: (proxyReq) => {
      proxyReq.setHeader('Host', 'cdn-mineru.openxlab.org.cn');
      proxyReq.removeHeader('Authorization');
    },
    error: (err, req, res) => {
      console.error('CDN proxy error:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'CDN proxy error', detail: err.message }));
    },
  },
});
const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // MinerU JSON API (tiny requests — get upload URL, poll status)
  if (req.url.startsWith('/mineru')) {
    return mineruProxy(req, res, (err) => {
      console.error('MinerU proxy error:', err);
      res.writeHead(502);
      res.end('MinerU proxy error');
    });
  }

  // Alibaba OSS upload (file bytes go through here — CORS workaround)
  if (req.url.startsWith('/oss-upload')) {
    return ossProxy(req, res, (err) => {
      console.error('OSS proxy error:', err);
      res.writeHead(502);
      res.end('OSS proxy error');
    });
  }

  // MinerU CDN result zip download
  if (req.url.startsWith('/cdn-mineru')) {
    return cdnProxy(req, res, (err) => {
      console.error('CDN proxy error:', err);
      res.writeHead(502);
      res.end('CDN proxy error');
    });
  }

  // Backend API
  if (req.url.startsWith('/api')) {
    return backendProxy(req, res, (err) => {
      console.error('Backend proxy error:', err);
      res.writeHead(500);
      res.end('Proxy error');
    });
  }

  // Static files / SPA fallback
  const parsedUrl = url.parse(req.url);
  const filePath = path.join(
    distPath,
    parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname
  );
  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        fs.readFile(path.join(distPath, 'index.html'), (indexError, indexContent) => {
          if (indexError) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 Not Found</h1>', 'utf-8');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(indexContent, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`, 'utf-8');
      }
    } else {
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(port, () => {
  console.log(`Frontend server running at http://localhost:${port}`);
});
