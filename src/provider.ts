/**
 * LLM Provider integration (Groq, OpenAI, etc.)
 */

import type { Env } from './types';
import { trackProviderCall } from './metrics';

interface ProviderOptions {
  maxTokens?: number;
  temperature?: number;
}

export async function providerChat(
  env: Env, 
  messages: Array<{ role: string; content: string }>, 
  options: ProviderOptions = {}
): Promise<string> {
  const { maxTokens = 1400, temperature = 0.2 } = options;
  
  const cap = Number(env.MAX_OUTPUT_TOKENS || 0);
  const finalMax = cap > 0 ? Math.min(maxTokens, cap) : maxTokens;
  
  const startTime = Date.now();
  let success = false;
  
  try {
    const r = await fetch(env.PROVIDER_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${env.PROVIDER_KEY}`
      },
      body: JSON.stringify({
        model: env.PROVIDER_MODEL,
        temperature,
        max_output_tokens: finalMax,
        messages
      })
    });
    
    if (!r.ok) {
      throw new Error(`provider_http_${r.status}`);
    }
    
    const j = await r.json().catch(() => ({}));
    const content = j?.choices?.[0]?.message?.content || j?.content || "";
    
    success = true;
    trackProviderCall(success, Date.now() - startTime, content.length);
    
    return content;
  } catch (error) {
    trackProviderCall(success, Date.now() - startTime);
    throw error;
  }
}

export function deterministicScore(context: { reply: string; usedFactIds: string[] }): number {
  const { reply, usedFactIds = [] } = context;
  const len = (reply || "").split(/\s+/).filter(Boolean).length;
  const base = Math.max(40, Math.min(92, 100 - Math.abs(len - 110) * 0.35));
  const factBonus = Math.min(8, usedFactIds.length * 3);
  return Math.round(base + factBonus);
}
