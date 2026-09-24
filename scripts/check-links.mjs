// Checks the built site in dist/ without a server or network:
//  1. every internal link, image, script and stylesheet points at a file that exists,
//  2. every #fragment on an internal link matches an id on the target page,
//  3. every URL the old Jekyll site published (tests/fixtures/legacy-urls.txt) still resolves.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parse } from 'node-html-parser';

const DIST = resolve('dist');
const SITE_HOST = 'tjklug.com';

if (!existsSync(DIST)) {
  console.error('dist/ is missing. Run `npm run build` first.');
  process.exit(1);
}

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

/** Maps a site path to the file GitHub Pages would serve for it, or null. */
function resolvePath(pathname) {
  const clean = decodeURIComponent(pathname);
  const candidates = clean.endsWith('/')
    ? [join(DIST, clean, 'index.html')]
    : [join(DIST, clean), join(DIST, clean, 'index.html'), join(DIST, `${clean}.html`)];
  return candidates.find((file) => existsSync(file) && statSync(file).isFile()) ?? null;
}

const idCache = new Map();
function idsIn(file) {
  if (!idCache.has(file)) {
    const root = parse(readFileSync(file, 'utf8'));
    idCache.set(file, new Set(root.querySelectorAll('[id]').map((el) => el.getAttribute('id'))));
  }
  return idCache.get(file);
}

const failures = [];
const pages = htmlFiles(DIST);
let checked = 0;

for (const file of pages) {
  const pagePath = `/${relative(DIST, file).split('\\').join('/')}`.replace(/index\.html$/, '');
  const root = parse(readFileSync(file, 'utf8'));
  // Redirect stubs for old URLs only point onward; their targets are checked as pages.
  const isRedirect = root.querySelector('meta[http-equiv="refresh"]') !== null;

  const refs = [
    ...root.querySelectorAll('a[href]').map((el) => el.getAttribute('href')),
    ...root.querySelectorAll('link[href]').map((el) => el.getAttribute('href')),
    ...root.querySelectorAll('img[src], script[src], source[src]').map((el) => el.getAttribute('src')),
    ...root.querySelectorAll('img[srcset], source[srcset]').flatMap((el) =>
      el
        .getAttribute('srcset')
        .split(',')
        .map((part) => part.trim().split(/\s+/)[0]),
    ),
  ];

  for (const ref of refs) {
    if (!ref || /^(mailto:|tel:|data:|javascript:)/.test(ref)) continue;
    const url = new URL(ref, `https://${SITE_HOST}${pagePath}`);
    if (url.hostname !== SITE_HOST) continue;
    checked += 1;

    const target = resolvePath(url.pathname);
    if (!target) {
      failures.push(`${pagePath} → ${ref} (no such file)`);
      continue;
    }
    if (url.hash && !isRedirect && target.endsWith('.html')) {
      const id = decodeURIComponent(url.hash.slice(1));
      if (!idsIn(target).has(id)) failures.push(`${pagePath} → ${ref} (no element with id "${id}")`);
    }
  }
}

const legacy = readFileSync('tests/fixtures/legacy-urls.txt', 'utf8').split('\n').filter(Boolean);
for (const path of legacy) {
  if (!resolvePath(path)) failures.push(`old URL ${path} no longer resolves`);
}

if (failures.length > 0) {
  console.error(`✗ ${failures.length} broken link(s):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ ${checked} internal links across ${pages.length} pages, and all ${legacy.length} old URLs, resolve.`);
