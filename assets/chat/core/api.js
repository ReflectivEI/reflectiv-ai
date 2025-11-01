const WORKER = (globalThis.COACH_ENDPOINT || globalThis.WORKER_URL || '').trim();
export async function chat({mode, messages, signal}){
  const res = await fetch(`${WORKER}/chat`, {
    method:'POST',
    headers:{'content-type':'application/json'},
    body: JSON.stringify({mode, messages}),
    signal
  });
  if(!res.ok) throw new Error(`chat:${res.status}`);
  const data = await res.json();
  if(!data || typeof data.reply!=='string') throw new Error('bad_contract');
  return data;
}
