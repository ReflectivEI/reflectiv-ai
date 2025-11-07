/**
 * Emotional Intelligence Mode Controller
 * Backend mode: "emotional-assessment"
 * Workflow: EI profile + feature selection → contextualized coaching
 * Handles per-mode history and EI-specific payload building
 */
import { chat } from '../core/api.js';

const MODE = 'emotional-assessment';
const history = [];

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
    
    // Build context from dropdown selections
    const state = store.get();
    const eiProfile = state.eiProfile || '';
    const eiFeature = state.eiFeature || '';
    const context = [eiProfile, eiFeature].filter(Boolean).join(' + ');
    const fullMessage = context ? `[${context}] ${msg}` : msg;
    
    // Add to per-mode history
    const userMsg = {role: 'user', content: fullMessage, timestamp: Date.now()};
    history.push(userMsg);
    limitHistory();
    
    appendMessage('user', msg);
    
    const {signal} = register.abortable();
    try{
      // Send with mode-specific history
      const payload = {
        mode: MODE,
        messages: [...history],
        signal
      };
      const data = await chat(payload);
      
      // Add assistant response to history
      const assistantMsg = {role: 'assistant', content: data.reply, timestamp: Date.now()};
      history.push(assistantMsg);
      limitHistory();
      
      appendMessage('assistant', data.reply);
      
      // Handle _coach data if present
      if(data._coach?.ei){
        renderEiData(data._coach.ei);
      }
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
  
  function renderEiData(ei){
    // Render EI scores if present
    if(ei.scores){
      bus.emit('ei:updated', ei.scores);
    }
  }
  
  function limitHistory(){
    // Keep only last 10 turns (20 messages: 10 user + 10 assistant)
    while(history.length > 20){
      history.shift();
    }
  }
  
  function teardown(){
    // Keep history on teardown for mode switching
    // disposer.flush() called by switcher
  }
  
  return { init, teardown, MODE, history };
}
