const MODES = ['role-play','sales-coach','emotional-assessment','product-knowledge','general-knowledge'];
export function createModeStore(bus){
  let state = { mode:'sales-coach', threadId:null };
  return {
    get(){ return state; },
    set(next){
      if (next.mode && !MODES.includes(next.mode)) return;
      const prev = state;
      state = {...state, ...next};
      if (prev.mode !== state.mode) {
        bus.emit('mode:willChange', {prev, next:state});
        bus.emit('mode:didChange', state);
      }
    },
    MODES
  };
}
