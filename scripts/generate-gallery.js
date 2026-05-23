// Escanea public/src/gallery/ y genera gallery-manifest.ts automáticamente.
// Se ejecuta antes de cada build via "prebuild" en package.json.

const fs   = require('fs');
const path = require('path');

const GALLERY_DIR  = path.join(__dirname, '../public/src/gallery');
const OUTPUT_FILE  = path.join(__dirname, '../src/app/gallery/gallery-manifest.ts');
const IMAGE_EXTS   = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

if (!fs.existsSync(GALLERY_DIR)) {
  fs.mkdirSync(GALLERY_DIR, { recursive: true });
}

const files = fs.readdirSync(GALLERY_DIR)
  .filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
  .sort()
  .map(f => `src/gallery/${f.replace(/ /g, '%20')}`);

const content =
`// ⚠️  Auto-generado por scripts/generate-gallery.js — no editar a mano.
// Agrega imágenes a public/src/gallery/ y ejecuta npm run build para actualizar.
export const GALLERY_FILES: string[] = ${JSON.stringify(files, null, 2)};
`;

fs.writeFileSync(OUTPUT_FILE, content, 'utf8');
console.log(`[gallery] ${files.length} imagen(es) encontrada(s) en public/src/gallery/`);
