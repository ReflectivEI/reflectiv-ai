import { chat } from '../core/api.js';
export function createModule({ bus, store, register }){
  let root, input, sendBtn, out;
  function bind(){
    root = document.querySelector('#coach-modal');
    input = root?.querySelector('textarea[data-coach-input]');
    sendBtn = root?.querySelector('[data-coach-send]');
    out = root?.querySelector('[data-coach-output]');
  }
  function init(){
    bind();
    if(!root) return;
    register.wrap(sendBtn, 'click', handleSend);
    register.wrap(input, 'keydown', handleKey);
  }
  async function handleSend(){
    if(!input?.value.trim()) return;
    const msg = input.value.trim();
    input.value = '';
    appendMessage('user', msg);
    const {mode} = store.get();
    const {signal, abort} = register.abortable();
    try{
      const data = await chat({mode, messages:[{role:'user',content:msg}], signal});
      appendMessage('assistant', data.reply);
    }catch(e){
      appendMessage('system', 'Error: '+e.message);
    }
  }
  function handleKey(e){
    if(e.key==='Enter' && !e.shiftKey){
      e.preventDefault();
      handleSend();
    }
  }
  function appendMessage(role, text){
    if(!out) return;
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.textContent = text;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  }
  function teardown(){
    // disposer.flush() called by switcher
  }
  return { init, teardown };
}
