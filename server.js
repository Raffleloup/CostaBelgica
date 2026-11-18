// Petit serveur sans dépendance (Node 18+) :
//  - garde les identifiants des sources côté serveur
//  - agrège toutes les sources en un format commun
//  - sert l'interface (public/index.html)
//
// Lancement : node server.js   puis http://localhost:8080

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadSources } from './sources/index.js';
import { buildOverview, wrapPage } from './lib/overview.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const CACHE_MS = Number(process.env.CACHE_SECONDS || 300) * 1000;

// Charge un éventuel fichier .env (format CLE=valeur) sans dépendance.
try {
  const txt = await readFile(join(ROOT, '.env'), 'utf8');
  for (const line of txt.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* pas de .env */ }

const sources = loadSources(process.env);
const cache = new Map();

async function overview(hours) {
  const hit = cache.get(hours);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const data = await buildOverview(sources, hours);
  cache.set(hours, { at: Date.now(), data });
  return data;
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/overview') {
      const hours = Math.min(168, Math.max(1, Number(url.searchParams.get('hours')) || 24));
      return send(res, 200, await overview(hours));
    }
    if (url.pathname.startsWith('/api/debug/')) {
      const src = sources.find(s => s.id === url.pathname.split('/')[3]);
      if (!src?.debug) return send(res, 404, { error: 'Source inconnue' });
      return send(res, 200, await src.debug());
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      // index.html est un fragment (même fichier que l'aperçu publié) : on l'enveloppe ici.
      const body = await readFile(join(ROOT, 'public', 'index.html'), 'utf8');
      return send(res, 200, wrapPage(body), 'text/html; charset=utf-8');
    }
    send(res, 404, { error: 'Introuvable' });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: err.message });
  }
}).listen(PORT, () => {
  console.log(`Météo mer : http://localhost:${PORT}`);
  for (const s of sources) console.log(`  source ${s.id.padEnd(8)} ${s.isConfigured() ? 'active' : 'non configurée'}`);
});
