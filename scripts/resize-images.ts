import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const BILDER_DIR = path.join(process.cwd(), 'public', 'bilder');
const MAX_LONG = 1000;
const MAX_SHORT = 600;

async function getAllImages(dir: string): Promise<string[]> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getAllImages(full));
    } else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

async function resizeImage(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const outPath = filePath.replace(/\.(jpe?g|png|webp)$/i, '.webp');

  // Already converted — skip if output already exists and source is the same file
  if (ext === '.webp' && filePath === outPath) {
    console.log(`  skip (already webp)  ${path.relative(process.cwd(), filePath)}`);
    return;
  }

  const img = sharp(filePath);
  const meta = await img.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) return;

  const isLandscape = w >= h;
  const [maxW, maxH] = isLandscape ? [MAX_LONG, MAX_SHORT] : [MAX_SHORT, MAX_LONG];

  const needsResize = w > maxW || h > maxH;
  const scale = needsResize ? Math.min(maxW / w, maxH / h) : 1;
  const newW = Math.round(w * scale);
  const newH = Math.round(h * scale);
  const tmpPath = outPath + '.tmp';
  const oldKb = Math.round(fs.statSync(filePath).size / 1024);

  await img
    .resize(newW, newH, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(tmpPath);

  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  fs.renameSync(tmpPath, outPath);
  // Remove the original JPEG/PNG now that the WebP is written
  if (filePath !== outPath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  const newKb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`  ${w}×${h} → ${newW}×${newH}  ${oldKb}kB → ${newKb}kB  ${path.relative(process.cwd(), outPath)}`);
}

async function main() {
  const images = await getAllImages(BILDER_DIR);
  console.log(`Fant ${images.length} bilder\n`);
  let skipped = 0;
  for (const img of images) {
    try {
      await resizeImage(img);
    } catch (e: unknown) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === 'EBUSY' || code === 'EPERM') {
        console.log(`  HOPPER OVER (låst): ${path.relative(process.cwd(), img)}`);
        skipped++;
      } else {
        throw e;
      }
    }
  }
  if (skipped) console.log(`\n${skipped} fil(er) hoppet over (låst) — lukk dem og kjør på nytt.`);
  console.log('\nFerdig.');
}

main().catch(console.error);
