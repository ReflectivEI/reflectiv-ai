/**
 * Cloudflare Worker — ReflectivAI Gateway (r10.2)
 * TypeScript implementation with EI support
 * 
 * Endpoints: POST /facts, POST /plan, POST /chat, GET /health, GET /version, GET /metrics
 */

import type { Env } from './types';
import { cors, json } from './helpers';
import { postFacts } from './routes/facts';
import { postPlan } from './routes/plan';
import { postChat } from './routes/chat';
import { getMetrics } from './metrics';

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(req.url);

      // CORS preflight
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors(env, req) });
      }

      // Health check
      if (url.pathname === "/health" && req.method === "GET") {
        return new Response("ok", { status: 200, headers: cors(env, req) });
      }

      // Version
      if (url.pathname === "/version" && req.method === "GET") {
        return json({ version: "r10.2", features: ["ei", "sse"] }, 200, env, req);
      }

      // Metrics endpoint (for monitoring)
      if (url.pathname === "/metrics" && req.method === "GET") {
        return json(getMetrics(), 200, env, req);
      }

      // API endpoints
      if (url.pathname === "/facts" && req.method === "POST") {
        return postFacts(req, env);
      }
      
      if (url.pathname === "/plan" && req.method === "POST") {
        return postPlan(req, env);
      }
      
      if (url.pathname === "/chat" && req.method === "POST") {
        return postChat(req, env);
      }

      return json({ error: "not_found" }, 404, env, req);
    } catch (e: any) {
      // Don't expose internal error details in production
      const isDev = env.ENVIRONMENT === 'development';
      return json({ 
        error: "server_error", 
        detail: isDev ? String(e?.message || e) : "An internal error occurred"
      }, 500, env, req);
    }
  }
};
