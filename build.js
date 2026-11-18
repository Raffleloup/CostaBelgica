// Construit dist/index.html (page complète) pour un hébergement statique + fonctions (Netlify).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { wrapPage } from './lib/overview.js';

await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', wrapPage(await readFile('public/index.html', 'utf8')));
console.log('dist/index.html prêt');
