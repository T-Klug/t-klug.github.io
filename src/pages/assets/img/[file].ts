// Keeps the old Jekyll image URLs (/assets/img/<name>) working. Search engines have them
// indexed and earlier social shares point at them. Pages on the new site use the optimized
// copies in /_astro/; these are resized stand-ins in each file's original format.
import { readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { APIContext } from 'astro';
import sharp from 'sharp';

const SOURCE = join(process.cwd(), 'src/assets/img');
const MAX_WIDTH = 1600;
const TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

export function getStaticPaths() {
  return readdirSync(SOURCE)
    .filter((file) => extname(file).toLowerCase() in TYPES)
    .map((file) => ({ params: { file } }));
}

export async function GET({ params }: APIContext) {
  const file = params.file as string;
  const ext = extname(file).toLowerCase();
  const image = sharp(join(SOURCE, file)).resize({ width: MAX_WIDTH, withoutEnlargement: true });
  const body = ext === '.png' ? image.png({ palette: true, compressionLevel: 9 }) : image.jpeg({ quality: 80 });
  return new Response(new Uint8Array(await body.toBuffer()), { headers: { 'Content-Type': TYPES[ext] } });
}
