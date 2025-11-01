export function createBus() {
  const m = new Map();
  return {
    on(evt, fn) { if (!m.has(evt)) m.set(evt, new Set()); m.get(evt).add(fn); return () => this.off(evt, fn); },
    off(evt, fn) { const s = m.get(evt); if (s) s.delete(fn); },
    emit(evt, payload) { const s = m.get(evt); if (!s) return; for (const fn of s) try { fn(payload); } catch(_){} }
  };
}
