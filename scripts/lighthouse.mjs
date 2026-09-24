// Runs Lighthouse (mobile and desktop) against the built site in dist/ and fails on any budget miss.
// HTML reports are written to lighthouse-report/ for review.
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { createGzip } from 'node:zlib';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';

// Mobile uses Lighthouse's default: a mid-range phone on a throttled 4G connection.
const FORM_FACTORS = { mobile: undefined, desktop: desktopConfig };
const PAGES = ['/', '/about/', '/posts/typesafe-jev-slopcheck/', '/posts/components-storybook-mocks/'];
// Lighthouse scores swing between runs, and the first page loaded in a fresh Chrome is
// consistently slow. Run each page several times and judge the median run, as Lighthouse CI does.
const RUNS = 3;
const MIN_SCORES = { performance: 0.9, accessibility: 0.95, 'best-practices': 0.9, seo: 0.9 };
const MAX_BYTES = { total: 1_200_000, images: 600_000 };

const DIST = resolve('dist');
const REPORTS = resolve('lighthouse-report');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

if (!existsSync(DIST)) {
  console.error('dist/ is missing. Run `npm run build` first.');
  process.exit(1);
}

const COMPRESSIBLE = /^(text\/|application\/(json|xml|manifest)|image\/svg)/;

// A minimal static server that resolves URLs and gzips text the way GitHub Pages does.
function fileFor(pathname) {
  const path = join(DIST, decodeURIComponent(pathname));
  if (!path.startsWith(DIST)) return null;
  for (const candidate of [path, join(path, 'index.html'), `${path}.html`]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const server = createServer((req, res) => {
  const file = fileFor(new URL(req.url, 'http://localhost').pathname);
  const status = file ? 200 : 404;
  const body = file ?? join(DIST, '404.html');
  const type = TYPES[extname(body)] ?? 'application/octet-stream';
  const gzip = COMPRESSIBLE.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  res.writeHead(status, { 'Content-Type': type, ...(gzip && { 'Content-Encoding': 'gzip' }) });
  const stream = createReadStream(body);
  (gzip ? stream.pipe(createGzip()) : stream).pipe(res);
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;

const chrome = await chromeLauncher.launch({
  chromeFlags: ['--headless=new', ...(process.env.CI ? ['--no-sandbox'] : [])],
});
mkdirSync(REPORTS, { recursive: true });

const failures = [];
try {
  for (const [formFactor, config] of Object.entries(FORM_FACTORS)) {
    for (const page of PAGES) {
      const label = `${formFactor} ${page}`;
      const runs = [];
      for (let run = 0; run < RUNS; run += 1) {
        runs.push(
          await lighthouse(`${origin}${page}`, { port: chrome.port, output: 'html', logLevel: 'error' }, config),
        );
      }
      runs.sort((a, b) => a.lhr.categories.performance.score - b.lhr.categories.performance.score);
      const { lhr, report } = runs[Math.floor(RUNS / 2)];
      const spread = runs.map((run) => Math.round(run.lhr.categories.performance.score * 100)).join('/');
      const name = page === '/' ? 'home' : page.replace(/^\/|\/$/g, '').replaceAll('/', '-');
      writeFileSync(join(REPORTS, `${formFactor}-${name}.html`), report);

      const scores = Object.fromEntries(Object.keys(MIN_SCORES).map((id) => [id, lhr.categories[id].score]));
      const total = lhr.audits['total-byte-weight'].numericValue;
      const images =
        lhr.audits['resource-summary'].details.items.find((item) => item.resourceType === 'image')?.transferSize ?? 0;

      const line = Object.entries(scores).map(([id, score]) => `${id} ${Math.round(score * 100)}`);
      console.log(
        `${label} (performance runs ${spread})\n  ${line.join(' · ')} · ${Math.round(total / 1024)} KB total, ${Math.round(images / 1024)} KB images`,
      );

      for (const [id, min] of Object.entries(MIN_SCORES)) {
        if (scores[id] < min) failures.push(`${label}: ${id} ${Math.round(scores[id] * 100)} is below ${min * 100}`);
      }
      if (total > MAX_BYTES.total) failures.push(`${label}: ${total} bytes total exceeds ${MAX_BYTES.total}`);
      if (images > MAX_BYTES.images) failures.push(`${label}: ${images} bytes of images exceeds ${MAX_BYTES.images}`);
    }
  }
} finally {
  chrome.kill();
  server.close();
}

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} Lighthouse budget(s) missed:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`\n✓ ${PAGES.length} pages on mobile and desktop within Lighthouse budgets. Reports in lighthouse-report/`);
