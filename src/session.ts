/**
 * Session state management with KV store
 */

import type { Env, SessionState } from './types';

export async function seqGet(env: Env, session: string): Promise<SessionState> {
  if (!env.SESS) return { lastNorm: "", fsm: {} };
  const k = `state:${session}`;
  const v = await env.SESS.get(k, "json") as SessionState | null;
  return v || { lastNorm: "", fsm: {} };
}

export async function seqPut(env: Env, session: string, state: SessionState): Promise<void> {
  if (!env.SESS) return;
  await env.SESS.put(`state:${session}`, JSON.stringify(state), { 
    expirationTtl: 60 * 60 * 12 
  });
}
