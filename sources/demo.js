// Source de démonstration : données synthétiques mais plausibles pour la côte belge.
// Sert d'exemple minimal d'adaptateur et permet de lancer l'interface sans identifiants.

const STATIONS = [
  { id: 'NPT', name: 'Nieuwpoort (démo)',   lat: 51.15, lon: 2.72, exposure: 1.0 },
  { id: 'OST', name: 'Oostende (démo)',     lat: 51.24, lon: 2.92, exposure: 0.95 },
  { id: 'WDL', name: 'Wandelaar (démo)',    lat: 51.39, lon: 3.05, exposure: 1.2 },
  { id: 'ZBR', name: 'Zeebrugge (démo)',    lat: 51.35, lon: 3.18, exposure: 0.9 },
  { id: 'WHI', name: 'Westhinder (démo)',   lat: 51.38, lon: 2.44, exposure: 1.35 },
];

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
      return STATIONS.map(({ id, name, lat, lon }) => ({ id, name, lat, lon }));
    },

    async latest() {
      const t = Math.floor(Date.now() / 600e3) * 600e3;
      return STATIONS.flatMap(st =>
        Object.entries(sample(st, t)).map(([quantity, value]) => ({ stationId: st.id, quantity, value, time: new Date(t).toISOString() })));
    },

    async history(from, to, quantities) {
      const out = [];
      const start = Math.ceil(from.getTime() / 600e3) * 600e3;
      for (const st of STATIONS) {
        for (const q of quantities) {
          const points = [];
          for (let t = start; t <= to.getTime(); t += 600e3) points.push([new Date(t).toISOString(), sample(st, t)[q]]);
          if (points[0]?.[1] != null) out.push({ stationId: st.id, quantity: q, points });
        }
      }
      return out;
    },
  };
}
