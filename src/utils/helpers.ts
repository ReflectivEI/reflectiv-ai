import { Env } from '../types';

/**
 * CORS headers for responses
 */
export function cors(env: Env, req: Request): Record<string, string> {
  const reqOrigin = req.headers.get('Origin') || '';
  const allowed = String(env.CORS_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const isAllowed = allowed.length === 0 || allowed.includes(reqOrigin);
  const allowOrigin = isAllowed ? (reqOrigin || '*') : 'null';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type,authorization,x-req-id,x-ei-emit',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

/**
 * JSON response helper
 */
export function json(body: any, status: number, env: Env, req: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors(env, req) }
  });
}

/**
 * Read and parse JSON from request body
 */
export async function readJson(req: Request): Promise<any> {
  const txt = await req.text();
  if (!txt) return {};
  try {
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

/**
 * Cap text to n sentences
 */
export function capSentences(text: string, n: number): string {
  const parts = String(text || '').replace(/\s+/g, ' ').match(/[^.!?]+[.!?]?/g) || [];
  return parts.slice(0, n).join(' ').trim();
}

/**
 * Sanitize LLM output
 */
export function sanitizeLLM(s: string): string {
  return String(s || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<pre[\s\S]*?<\/pre>/gi, '')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract coach JSON from text
 */
export function extractCoach(raw: string): { coach: any; clean: string } {
  const s = String(raw || '');
  const open = s.indexOf('<coach>');
  if (open < 0) return { coach: null, clean: sanitizeLLM(s) };
  
  const head = s.slice(0, open);
  const tail = s.slice(open + 7);
  const close = tail.indexOf('</coach>');
  const body = close >= 0 ? tail.slice(0, close) : tail;
  const start = body.indexOf('{');
  
  if (start < 0) return { coach: null, clean: sanitizeLLM(head) };
  
  let depth = 0, end = -1;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }
  
  if (end < 0) return { coach: null, clean: sanitizeLLM(head) };
  
  let coach = null;
  try {
    coach = JSON.parse(body.slice(start, end + 1));
  } catch {}
  
  const after = close >= 0 ? tail.slice(close + 8) : '';
  return { coach, clean: sanitizeLLM((head + ' ' + after).trim()) };
}

/**
 * Generate a random ID
 */
export function cryptoRandomId(): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return [...a].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Normalize text for comparison
 */
export const norm = (s: string): string =>
  String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
