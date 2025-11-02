/**
 * /plan endpoint - Generate conversation plan
 */

import type { Env, Plan } from '../types';
import { json, readJson, cryptoRandomId } from '../helpers';
import { FACTS_DB, FSM } from '../data';

export async function postPlan(req: Request, env: Env): Promise<Response> {
  const body = await readJson(req);
  const { mode = "sales-simulation", disease = "", persona = "", goal = "", topic = "" } = body || {};

  const factsRes = FACTS_DB.filter(f => {
    const dOk = !disease || f.ta?.toLowerCase() === String(disease).toLowerCase();
    const tOk = !topic || f.topic?.toLowerCase().includes(String(topic).toLowerCase());
    return dOk && tOk;
  });
  
  const facts = factsRes.slice(0, 8);
  if (env.REQUIRE_FACTS === "true" && facts.length === 0) {
    return json({ error: "no_facts_for_request" }, 422, env, req);
  }

  const plan: Plan = {
    planId: cryptoRandomId(),
    mode, 
    disease, 
    persona, 
    goal,
    facts: facts.map(f => ({ id: f.id, text: f.text, cites: f.cites || [] })),
    fsm: FSM[mode] || FSM["sales-simulation"]
  };

  const valid = Array.isArray(plan.facts) && plan.facts.length > 0 && typeof plan.mode === "string";
  if (!valid) {
    return json({ error: "invalid_plan" }, 422, env, req);
  }

  return json(plan, 200, env, req);
}
