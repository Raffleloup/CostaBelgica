// Fonction Netlify : /api/debug/meetnet — liste les paramètres Meetnet reconnus, pour vérifier le classement.

import { loadSources } from '../../sources/index.js';

const sources = loadSources(process.env);

export default async (req, context) => {
  const src = sources.find(s => s.id === context.params.source);
  if (!src?.debug) return Response.json({ error: 'Source inconnue' }, { status: 404 });
  const out = await src.debug();
  return typeof out === 'string'
    ? new Response(out, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
    : Response.json(out, { headers: { 'Cache-Control': 'no-store' } });
};

export const config = { path: '/api/debug/:source' };
