/**
 * /facts endpoint - Retrieve facts from knowledge base
 */

import type { Env } from '../types';
import { json, readJson } from '../helpers';
import { FACTS_DB } from '../data';

export async function postFacts(req: Request, env: Env): Promise<Response> {
  const { disease, topic, limit = 6 } = await readJson(req);
  
  const out = FACTS_DB.filter(f => {
    const dOk = !disease || f.ta?.toLowerCase() === String(disease).toLowerCase();
    const tOk = !topic || f.topic?.toLowerCase().includes(String(topic).toLowerCase());
    return dOk && tOk;
  }).slice(0, limit);
  
  return json({ facts: out }, 200, env, req);
}
