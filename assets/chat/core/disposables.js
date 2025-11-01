export function createDisposer() {
  const bag = new Set();
  return {
    add(fn){ if(typeof fn==='function') bag.add(fn); return fn; }, // Returns fn for chaining
    wrap(target,type,listener,opts){ target.addEventListener(type,listener,opts); return this.add(()=>target.removeEventListener(type,listener,opts)); },
    interval(ms,fn){ const id=setInterval(fn,ms); return this.add(()=>clearInterval(id)); },
    timeout(ms,fn){ const id=setTimeout(fn,ms); return this.add(()=>clearTimeout(id)); },
    observe(target,cb,opts={childList:true,subtree:true}){ const o=new MutationObserver(cb); o.observe(target,opts); return this.add(()=>o.disconnect()); },
    abortable(){ const c=new AbortController(); return {signal:c.signal, abort:this.add(()=>c.abort())}; },
    flush(){ for(const fn of [...bag]) try{fn()}catch(_){} bag.clear(); }
  };
}
