/**
 * Cloudflare Worker — ReflectivAI Gateway (r10.2)
 * TypeScript implementation with EI support
 *
 * Endpoints: POST /facts, POST /plan, POST /chat, GET /health, GET /version, GET /metrics
 */
import { cors, json } from './helpers';
import { postFacts } from './routes/facts';
import { postPlan } from './routes/plan';
import { postChat } from './routes/chat';
import { getMetrics } from './metrics';
export default {
    async fetch(req, env, ctx) {
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
        }
        catch (e) {
            return json({
                error: "server_error",
                detail: String(e?.message || e)
            }, 500, env, req);
        }
    }
};
