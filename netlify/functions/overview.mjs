// Fonction Netlify : /api/overview?hours=24
// Les identifiants (MEETNET_USER, MEETNET_PASSWORD) se règlent dans Netlify :
// Site configuration > Environment variables.

import { loadSources } from '../../sources/index.js';
import { buildOverview, clampHours } from '../../lib/overview.js';

const sources = loadSources(process.env);

export default async req => {
  const hours = clampHours(new URL(req.url).searchParams.get('hours'));
  const data = await buildOverview(sources, hours);
  return Response.json(data, {
    headers: {
      'Cache-Control': 'public, max-age=0, must-revalidate',
      // Le CDN de Netlify garde la réponse 5 minutes : Meetnet n'est interrogé qu'une fois par durée choisie.
      'Netlify-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=120',
    },
  });
};

export const config = { path: '/api/overview' };
