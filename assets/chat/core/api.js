const WORKER = (globalThis.COACH_ENDPOINT || globalThis.WORKER_URL || '').trim();

// Map frontend UI modes to backend worker modes
const MODE_MAPPING = {
  'role-play': 'role-play',
  'sales-coach': 'sales-simulation',
  'emotional-intelligence': 'emotional-assessment',
  'product-knowledge': 'product-knowledge'
};

export async function chat({mode, messages, eiContext, signal}){
  const workerMode = MODE_MAPPING[mode] || mode; // fallback to original if not mapped
  const payload = {mode: workerMode, messages};
  if(eiContext) payload.eiContext = eiContext;
  const res = await fetch(`${WORKER}/chat`, {
    method:'POST',
    headers:{'content-type':'application/json'},
    body: JSON.stringify(payload),
    signal
  });
  if(!res.ok) throw new Error(`chat:${res.status}`);
  const data = await res.json();
  if(!data || (typeof data.reply!=='string' && !data.error)) throw new Error('bad_contract');
  return data; // Now returns { reply, coach, plan } or { error }
}
