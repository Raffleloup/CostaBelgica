// Adaptateur Meetnet Vlaamse Banken (API V2).
// Doc : https://api.meetnetvlaamsebanken.be/V2-help/
// Compte gratuit à créer sur https://meetnetvlaamsebanken.be (bouton « Login »).
//
// Variables d'environnement : MEETNET_USER, MEETNET_PASSWORD

import { toStandard } from '../lib/quantities.js';

const BASE = 'https://api.meetnetvlaamsebanken.be';

// Codes Meetnet relevés dans le catalogue (novembre 2026). Ils priment sur le classement par nom ;
// null = paramètre volontairement ignoré (doublon moins utile pour le tableau).
const CODES = {
  WVC: 'wind_speed', WC3: 'wind_gust', WRS: 'wind_dir', WC1: null,
  GHA: 'wave_height', GH1: 'wave_h10', GTZ: 'wave_period', RHF: 'wave_dir', H01: null, HLF: null, RLF: null,
  TZW: 'water_temp', TLU: 'air_temp', LDR: 'air_pressure', WS5: 'water_level',
};

// Classement des paramètres Meetnet vers nos grandeurs, d'après leur nom anglais.
// L'ordre compte : la première règle qui correspond gagne.
const RULES = [
  [/gust/i,                                   'wind_gust'],
  [/wind.*direction|direction.*wind/i,        'wind_dir'],
  [/wind.*speed|wind.*velocity/i,             'wind_speed'],
  // H1/10 : hauteur moyenne des 10 % plus hautes vagues (nom contenant « height » et « 1/10 », « 10% » ou « tenth »).
  [/^(?=.*(height|hoogte))(?=.*(1\/10|10 ?%|tenth))|\bh1\/10\b|\bh10\b/i, 'wave_h10'],
  [/(significant )?wave height|hm0|h1\/3/i,   'wave_height'],
  [/wave.*direction|direction.*wave/i,        'wave_dir'],
  [/wave.*period|period/i,                    'wave_period'],
  [/(sea ?)?water temp|sea temp/i,            'water_temp'],
  [/air temp/i,                               'air_temp'],
  [/pressure/i,                               'air_pressure'],
  [/water level|tide|waterhoogte/i,           'water_level'],
];

// Premier texte disponible dans l'ordre des langues demandé.
function pick(list, cultures) {
  if (!Array.isArray(list)) return list ?? '';
  for (const c of cultures) {
    const hit = list.find(m => m.Culture?.toLowerCase().startsWith(c));
    if (hit?.Message) return hit.Message;
  }
  return list[0]?.Message ?? '';
}

function msg(list, culture = 'en') {
  if (!Array.isArray(list)) return list ?? '';
  const hit = list.find(m => m.Culture?.toLowerCase().startsWith(culture))
           ?? list.find(m => m.Culture?.toLowerCase().startsWith('nl'))
           ?? list[0];
  return hit?.Message ?? '';
}

function parsePoint(wkt) {
  const m = /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i.exec(wkt || '');
  if (!m) return { lat: null, lon: null };
  const x = Number(m[1]), y = Number(m[2]);
  // Si les coordonnées ne ressemblent pas à du WGS84, on ne les expose pas.
  if (Math.abs(x) > 180 || Math.abs(y) > 90) return { lat: null, lon: null };
  return { lon: x, lat: y };
}

export default function createMeetnetSource(env) {
  const user = env.MEETNET_USER, password = env.MEETNET_PASSWORD;
  let token = null, tokenExpires = 0;
  let catalog = null, catalogAt = 0;

  async function getToken() {
    if (token && Date.now() < tokenExpires) return token;
    const res = await fetch(`${BASE}/Token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'password', username: user, password }),
    });
    if (!res.ok) throw new Error(`Connexion Meetnet refusée (${res.status}). Vérifiez MEETNET_USER / MEETNET_PASSWORD.`);
    const json = await res.json();
    token = json.access_token;
    tokenExpires = Date.now() + Math.max(60, (json.expires_in ?? 3600) - 120) * 1000;
    return token;
  }

  async function api(path, init = {}) {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${await getToken()}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    if (res.status === 401) { token = null; }
    if (!res.ok) throw new Error(`Meetnet ${path} : HTTP ${res.status}`);
    return res.json();
  }

  // Catalogue : stations + paramètres, mis en cache 6 h.
  async function loadCatalog() {
    if (catalog && Date.now() - catalogAt < 6 * 3600e3) return catalog;
    const c = await api('/V2/catalog');
    const params = new Map();
    for (const p of c.Parameters ?? []) {
      const name = msg(p.Name, 'en');
      const rule = RULES.find(([re]) => re.test(name));
      params.set(p.ID, { name, unit: p.Unit, quantity: p.ID in CODES ? CODES[p.ID] : rule?.[1] ?? null });
    }
    const locations = new Map();
    for (const l of c.Locations ?? []) {
      locations.set(l.ID, { id: l.ID, name: pick(l.Name, ['fr', 'en', 'nl']) || l.ID, ...parsePoint(l.PositionWKT) });
    }
    // Un seul identifiant (couple station/paramètre) par grandeur et par station.
    const lp = new Map(); // lpId -> { stationId, quantity, unit }
    const taken = new Set();
    for (const a of c.AvailableData ?? []) {
      const p = params.get(a.Parameter);
      if (!p?.quantity || !locations.has(a.Location)) continue;
      const key = `${a.Location}:${p.quantity}`;
      if (taken.has(key)) continue;
      taken.add(key);
      lp.set(a.ID, { stationId: a.Location, quantity: p.quantity, unit: p.unit, paramName: p.name });
    }
    const stationIds = new Set([...lp.values()].map(v => v.stationId));
    const byLoc = new Map();
    for (const a of c.AvailableData ?? []) byLoc.set(a.Location, [...(byLoc.get(a.Location) ?? []), a.Parameter]);
    const raw = { params, byLoc };
    const measures = id => [...new Set([...lp.values()].filter(v => v.stationId === id).map(v => v.quantity))];
    catalog = { raw, locations, lp, stations: [...stationIds].map(id => ({ ...locations.get(id), measures: measures(id) })) };
    catalogAt = Date.now();
    return catalog;
  }

  return {
    id: 'meetnet',
    name: 'Meetnet Vlaamse Banken',
    url: 'https://meetnetvlaamsebanken.be',
    attribution: 'Données : Agentschap MDK – Meetnet Vlaamse Banken',
    isConfigured: () => Boolean(user && password),

    async listStations() {
      return (await loadCatalog()).stations;
    },

    async latest() {
      const cat = await loadCatalog();
      const rows = await api('/V2/currentData');
      return rows
        .filter(r => cat.lp.has(r.ID))
        .map(r => {
          const m = cat.lp.get(r.ID);
          return { stationId: m.stationId, quantity: m.quantity, time: r.Timestamp, value: toStandard(m.quantity, r.Value, m.unit) };
        });
    },

    async history(from, to, quantities) {
      const cat = await loadCatalog();
      const ids = [...cat.lp.entries()].filter(([, m]) => quantities.includes(m.quantity)).map(([id]) => id);
      if (!ids.length) return [];
      const out = [];
      // Requêtes par paquets pour rester raisonnable.
      for (let i = 0; i < ids.length; i += 40) {
        const res = await api('/V2/getData', {
          method: 'POST',
          body: JSON.stringify({ StartTime: from.toISOString(), EndTime: to.toISOString(), IDs: ids.slice(i, i + 40) }),
        });
        for (const v of res.Values ?? []) {
          const m = cat.lp.get(v.ID);
          if (!m) continue;
          out.push({
            stationId: m.stationId,
            quantity: m.quantity,
            points: (v.Values ?? []).map(p => [p.Timestamp, toStandard(m.quantity, p.Value, m.unit)]),
          });
        }
      }
      return out;
    },

    // Utile pour vérifier le classement des paramètres (GET /api/debug/meetnet).
    async debug() {
      const cat = await loadCatalog();
      // Texte compact : tous les paramètres du catalogue, puis chaque station avec ses codes de paramètres.
      const lines = ['# Paramètres (code | nom | unité | grandeur reconnue)'];
      for (const [id, p] of cat.raw.params) lines.push(`${id} | ${p.name} | ${p.unit ?? ''} | ${p.quantity ?? '-'}`);
      lines.push('', '# Stations (code | nom | paramètres disponibles)');
      for (const [id, codes] of cat.raw.byLoc) lines.push(`${id} | ${cat.locations.get(id)?.name ?? '?'} | ${codes.join(' ')}`);
      return lines.join('\n');
    },
  };
}
