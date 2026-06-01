import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// Icône standard : fond gold plein + R sombre (icon.svg).
const standard = readFileSync(join(root, 'icon.svg'));

// Icône maskable : même visuel avec marge de sécurité (~20%) car les launchers
// Android rognent les bords. R réduit sur fond gold plein.
const maskable = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
     <rect width="512" height="512" fill="#D4AF37"/>
     <text x="50%" y="50%" dy="0.06em" text-anchor="middle" dominant-baseline="central"
           font-family="Georgia, 'Times New Roman', serif" font-size="230" font-weight="700"
           fill="#171717">R</text>
   </svg>`
);

await sharp(standard).resize(192, 192).png().toFile(join(root, 'icon-192.png'));
await sharp(standard).resize(512, 512).png().toFile(join(root, 'icon-512.png'));
await sharp(maskable).resize(512, 512).png().toFile(join(root, 'icon-maskable-512.png'));

console.log('Icônes générées : icon-192.png, icon-512.png, icon-maskable-512.png');
