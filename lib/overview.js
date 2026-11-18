// Agrégation commune : utilisée par server.js (en local ou sur un serveur)
// et par la fonction Netlify (netlify/functions/overview.mjs).

import { QUANTITIES } from './quantities.js';

const SERIES = ['wind_speed', 'wind_gust', 'wind_dir', 'wave_height', 'wave_h10'];

export const clampHours = h => Math.min(168, Math.max(1, Number(h) || 24));

export async function buildOverview(sources, hours) {
  const to = new Date();
  const from = new Date(to.getTime() - hours * 3600e3);
  const result = { generatedAt: to.toISOString(), hours, quantities: QUANTITIES, sources: [], stations: [] };

  await Promise.all(sources.map(async src => {
    const meta = { id: src.id, name: src.name, url: src.url, attribution: src.attribution };
    if (!src.isConfigured()) { result.sources.push({ ...meta, status: 'unconfigured' }); return; }
    try {
      const [stations, latest, history] = await Promise.all([
        src.listStations(), src.latest(), src.history(from, to, SERIES),
      ]);
      const byId = new Map(stations.map(s => [s.id, {
        key: `${src.id}:${s.id}`, source: src.id, id: s.id, name: s.name, lat: s.lat, lon: s.lon, latest: {}, series: {},
      }]));
      for (const r of latest) {
        const st = byId.get(r.stationId);
        if (st && r.value != null) st.latest[r.quantity] = { value: r.value, time: r.time };
      }
      for (const h of history) {
        const st = byId.get(h.stationId);
        if (st) st.series[h.quantity] = h.points.filter(p => p[1] != null);
      }
      result.stations.push(...[...byId.values()].filter(s => Object.keys(s.latest).length));
      result.sources.push({ ...meta, status: 'ok' });
    } catch (err) {
      console.error(`[${src.id}]`, err);
      result.sources.push({ ...meta, status: 'error', message: err.message });
    }
  }));
  return result;
}


// public/index.html est un fragment (le même fichier sert d'aperçu publié) : on l'enveloppe en page complète.
export function wrapPage(body) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#0b6e8a"><meta name="apple-mobile-web-app-capable" content="yes"></head><body>${body}</body></html>`;
}
