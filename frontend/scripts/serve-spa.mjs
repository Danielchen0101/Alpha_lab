import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const buildPath = process.env.BUILD_PATH || 'build';
const buildRoot = resolve(process.cwd(), buildPath);
const indexFile = join(buildRoot, 'index.html');

if (!existsSync(indexFile)) {
  throw new Error(`Production build not found at ${buildRoot}. Run \`npm run build\` before starting the smoke-test server.`);
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', `http://${host}:${port}`).pathname);
  const requested = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '').replace(/^[/\\]+/, '');
  let file = resolve(buildRoot, requested);

  if (!file.startsWith(buildRoot) || !existsSync(file) || statSync(file).isDirectory()) {
    file = indexFile;
  }

  const extension = extname(file).toLowerCase();
  response.writeHead(200, {
    'Content-Type': contentTypes[extension] || 'application/octet-stream',
    'Cache-Control': file === indexFile ? 'no-store' : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  });
  createReadStream(file).pipe(response);
});

server.listen(port, host, () => {
  console.log(`AlphaLab smoke-test server listening on http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
