import { createDisposer } from './disposables.js';
const loaders = {
  'role-play':               () => import('../modes/rolePlay.js'),
  'sales-coach':             () => import('../modes/salesCoach.js'),
  'emotional-intelligence':  () => import('../modes/emotionalIntelligence.js'),
  'product-knowledge':       () => import('../modes/productKnowledge.js'),
};
export function createModeSwitcher({bus, store}){
  let active=null;
  let dispose=createDisposer();
  async function switchMode(nextMode){
    if(active?.teardown){ try{active.teardown()}catch(_){} }
    dispose.flush();
    const mod = await loaders[nextMode]();
    active = mod.createModule({ bus, store, register: dispose });
    active?.init?.();
    store.set({ mode: nextMode, threadId: crypto.randomUUID() });
  }
  bus.on('mode:didChange', ({mode}) => { switchMode(mode); });
  return { switchMode };
}
