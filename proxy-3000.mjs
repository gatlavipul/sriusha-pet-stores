import http from 'http';

const server = http.createServer((req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: 4000,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: 'localhost:4000',
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Gateway Error: ' + err.message);
  });

  req.pipe(proxyReq, { end: true });
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Proxy bridge active on http://localhost:3000 -> http://localhost:4000');
});

