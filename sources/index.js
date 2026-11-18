// Registre des sources de données.
//
// Pour ajouter une source : créer sources/<nom>.js qui exporte par défaut
// une fonction (env) => adaptateur, puis l'ajouter à la liste ci-dessous.
//
// Contrat d'un adaptateur :
//   id, name, url, attribution          métadonnées affichées dans l'interface
//   isConfigured()                       false si des identifiants manquent
//   listStations()   -> [{ id, name, lat, lon }]
//   latest()         -> [{ stationId, quantity, value, time }]
//   history(from, to, quantities) -> [{ stationId, quantity, points: [[isoTime, value], ...] }]
// Les valeurs sont toujours renvoyées dans les unités de lib/quantities.js.

import createMeetnetSource from './meetnet.js';
import createDemoSource from './demo.js';

const FACTORIES = [createMeetnetSource, createDemoSource];

export function loadSources(env = process.env) {
  const all = FACTORIES.map(f => f(env));
  // Par défaut, la démo ne s'affiche que si aucune vraie source n'est configurée.
  const real = all.filter(s => s.id !== 'demo' && s.isConfigured());
  if (real.length && env.DEMO !== '1') return all.filter(s => s.id !== 'demo');
  return all;
}
