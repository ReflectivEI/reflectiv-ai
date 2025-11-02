/**
 * Cloudflare Worker — ReflectivAI Gateway (r10.2)
 * TypeScript refactor with EI emission support
 * 
 * Endpoints: POST /facts, POST /plan, POST /chat, GET /health, GET /version, GET /metrics
 */

import { Env } from './types';
import { cors, json } from './utils/helpers';
import { postFacts, postPlan } from './routes/facts-plan';
import { postChat } from './routes/chat';
import { getMetrics } from './metrics';

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(req.url);

      // CORS preflight
      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: cors(env, req) });
      }

      // Health check
      if (url.pathname === '/health' && req.method === 'GET') {
        return new Response('ok', { status: 200, headers: cors(env, req) });
      }

      // Version endpoint
      if (url.pathname === '/version' && req.method === 'GET') {
        return json({ version: 'r10.2' }, 200, env, req);
      }

      // Metrics endpoint
      if (url.pathname === '/metrics' && req.method === 'GET') {
        const metrics = getMetrics();
        return json(metrics, 200, env, req);
      }

      // Route to handlers
      if (url.pathname === '/facts' && req.method === 'POST') {
        return postFacts(req, env);
      }
      if (url.pathname === '/plan' && req.method === 'POST') {
        return postPlan(req, env);
      }
      if (url.pathname === '/chat' && req.method === 'POST') {
        return postChat(req, env);
      }

      return json({ error: 'not_found' }, 404, env, req);
    } catch (e: any) {
      return json({ error: 'server_error', detail: String(e?.message || e) }, 500, env, req);
    }
  }
};
