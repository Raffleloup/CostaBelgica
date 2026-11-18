// Source de démonstration : données synthétiques mais plausibles pour la côte belge.
// Sert d'exemple minimal d'adaptateur et permet de lancer l'interface sans identifiants.

// Liste illustrative de stations de la côte belge : vent (w), houle (v) ou les deux.
const STATIONS = [
  ['NPT', 'Nieuwpoort', 51.15, 2.72, 1.0, 'w'], ['OST', 'Oostende', 51.24, 2.92, 0.95, 'w'],
  ['ZBR', 'Zeebrugge', 51.35, 3.18, 0.9, 'w'], ['BLB', 'Blankenberge', 51.32, 3.13, 0.92, 'w'],
  ['WHI', 'Westhinder', 51.38, 2.44, 1.35, 'wv'], ['WDL', 'Wandelaar', 51.39, 3.05, 1.2, 'wv'], ['AKK', 'Akkaert', 51.42, 2.77, 1.25, 'wv'],
  ['BVH', 'Bol van Heist', 51.39, 3.20, 1.05, 'v'], ['SWI', 'Scheur Wielingen', 51.40, 3.30, 1.0, 'v'], ['TRG', 'Trapegeer', 51.14, 2.58, 1.1, 'v'],
  ['KWI', 'Kwintebank', 51.33, 2.66, 1.15, 'v'], ['ODY', 'Oostdyck', 51.27, 2.45, 1.3, 'v'], ['RAV', 'Raversijde', 51.21, 2.85, 0.95, 'v'],
  ['WEN', 'Wenduine', 51.30, 3.07, 0.95, 'v'],
].map(([id, name, lat, lon, exposure, m]) => ({ id, name: name + ' (démo)', lat, lon, exposure, wind: m.includes('w'), wave: m.includes('v') }));
const WIND_Q = ['wind_speed', 'wind_gust', 'wind_dir', 'air_temp'];
const keeps = (st, q) => (WIND_Q.includes(q) ? st.wind : st.wave);

function noise(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function sample(st, t) {
  const h = t / 3600e3;
  const k = st.id.charCodeAt(0) + st.id.charCodeAt(2);
  const base = 7 + 3.5 * Math.sin(h / 7 + 0.3) + 1.5 * Math.sin(h / 2.3 + k);
  const speed = Math.max(0.5, base * st.exposure + (noise(Math.floor(h * 6) + k) - 0.5) * 1.6);
  const gust = speed * (1.25 + 0.2 * noise(Math.floor(h * 6) + k + 7));
  const dir = (250 + 50 * Math.sin(h / 11) + 10 * noise(Math.floor(h * 6) + k + 3) + 360) % 360;
  const wave = Math.max(0.15, 0.08 * speed * st.exposure + 0.15 * Math.sin(h / 5));
  return {
    wind_speed: speed, wind_gust: gust, wind_dir: dir,
    wave_height: wave, wave_h10: wave * 1.27, wave_period: 3.5 + wave * 2.2, wave_dir: (290 + 25 * Math.sin(h / 13) + 360) % 360,
    water_temp: 10.8 + 0.3 * Math.sin(h / 12), air_temp: 9 + 2 * Math.sin((h - 9) / 3.8),
  };
}

export default function createDemoSource(env) {
  return {
    id: 'demo',
    name: 'Démonstration',
    url: null,
    attribution: 'Données synthétiques, pas des mesures réelles',
    isConfigured: () => env.DEMO !== '0',

    async listStations() {
      const Q = ['wind_speed', 'wind_gust', 'wind_dir', 'air_temp', 'wave_height', 'wave_h10', 'wave_period', 'wave_dir', 'water_temp'];
      return STATIONS.map(({ id, name, lat, lon, ...st }) => ({ id, name, lat, lon, measures: Q.filter(q => keeps(st, q)) }));
    },

    async latest() {
      const t = Math.floor(Date.now() / 600e3) * 600e3;
      return STATIONS.flatMap(st =>
        Object.entries(sample(st, t)).filter(([q]) => keeps(st, q)).map(([quantity, value]) => ({ stationId: st.id, quantity, value, time: new Date(t).toISOString() })));
    },

    async history(from, to, quantities) {
      const out = [];
      const start = Math.ceil(from.getTime() / 600e3) * 600e3;
      for (const st of STATIONS) {
        for (const q of quantities.filter(q => keeps(st, q))) {
          const points = [];
          for (let t = start; t <= to.getTime(); t += 600e3) points.push([new Date(t).toISOString(), sample(st, t)[q]]);
          if (points[0]?.[1] != null) out.push({ stationId: st.id, quantity: q, points });
        }
      }
      return out;
    },
  };
}
