
(() => {
  'use strict';

  // ====== Utilities ======
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts || { passive: true });

  function injectCSS() {
    if ($('#ruleta-style')) return;
    const css = `
/* ======= RULETA (scoped) ======= */
#ruleta.tab { padding: 1rem 0; }
#ruleta .ruleta-grid { display:grid; grid-template-columns: 1fr 340px; gap: 1rem; align-items:start; }
@media (max-width: 980px){ #ruleta .ruleta-grid { grid-template-columns: 1fr; } }
#ruleta .card {
  background:#111;border:1px solid #222;border-radius:1rem;padding:1rem;position:relative;
}

/* Wheel canvas */
#ruleta-canvas {
  display:block;width:100%;max-width:520px;aspect-ratio:1/1;margin:0 auto;
  border-radius:999px;border:8px solid #0c0c0c;
  box-shadow: 0 10px 30px rgba(0,0,0,.45), inset 0 0 60px rgba(0,0,0,.35);
  background: radial-gradient(40% 40% at 50% 50%, #0f172a, #0b0b0b);
}

/* Pointer on TOP, pointing DOWN */
#ruleta .pointer {
  position:absolute; left:50%; top:10px; transform: translateX(-50%);
  width:0;height:0;
  border-left:14px solid transparent; border-right:14px solid transparent; border-top:none;
  border-bottom:22px solid #22c55e; /* green */
  filter: drop-shadow(0 2px 4px rgba(0,0,0,.6));
}

#ruleta .controls { margin-top:.8rem; display:flex; gap:.6rem; justify-content:center; flex-wrap:wrap; }
#ruleta .controls button {
  padding:.6rem .9rem;border:none;border-radius:.8rem;background:#3b82f6;color:#fff;cursor:pointer;font-weight:600;
}
#ruleta .controls .secondary{ background:#222; color:#eaeaea; }

#ruleta .result { margin-top:.5rem; text-align:center; font-weight:800; font-size:1.1rem; }

#ruleta .form { display:flex; gap:.5rem; }
#ruleta .form input {
  width:100%;padding:.6rem;border-radius:.6rem;border:1px solid #333;background:#111;color:#eee;
}
#ruleta .form button { padding:.6rem .9rem;border:none;border-radius:.8rem;background:#22c55e;color:#062b14; font-weight:800; }

#ruleta .list { list-style:none;margin:.6rem 0 0;padding:0; display:flex; flex-direction:column; gap:.4rem; max-height:360px; overflow:auto; }
#ruleta .item { display:flex; align-items:center; gap:.5rem; padding:.5rem .6rem; background:#0f0f0f; border:1px solid #242424; border-radius:.8rem; }
#ruleta .item .name { flex:1; border:none; background:transparent; color:#eaeaea; outline:none; }
#ruleta .item .btn { background:#222; color:#eaeaea; border:none; border-radius:.6rem; padding:.35rem .5rem; cursor:pointer; }
#ruleta .item .btn.del { background:#2a1114; color:#f7c0c6; }

#ruleta .subtle { opacity:.8; font-size:.9rem; text-align:center; }

/* Color tokens for slices */
:root{
  --c1:#60a5fa; --c2:#a78bfa; --c3:#34d399; --c4:#f472b6; --c5:#fbbf24;
  --c6:#93c5fd; --c7:#c084fc; --c8:#22d3ee; --c9:#fca5a5; --c10:#86efac;
}
    `.trim();
    const style = document.createElement('style');
    style.id = 'ruleta-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function createSection() {
    if ($('#ruleta')) return $('#ruleta');
    const sec = document.createElement('section');
    sec.id = 'ruleta';
    sec.className = 'tab hidden'; // respeta tu sistema de pestañas
    sec.setAttribute('aria-labelledby', 'ruleta-title');
    sec.innerHTML = `
      <div class="ruleta-grid">
        <div class="card">
          <h2 id="ruleta-title">Ruleta de participantes</h2>
          <div class="pointer" aria-hidden="true"></div>
          <canvas id="ruleta-canvas" width="420" height="420" aria-label="Ruleta aleatoria"></canvas>
          <div class="controls">
            <button id="ruleta-spin">🎯 Girar</button>
            <label class="subtle"><input type="checkbox" id="ruleta-remove" checked> Quitar ganador</label>
            <button id="ruleta-reset" class="secondary">Reiniciar</button>
          </div>
          <div id="ruleta-result" class="result" role="status" aria-live="polite"></div>
        </div>
        <div class="card">
          <h3>Participantes</h3>
          <form id="ruleta-form" class="form" autocomplete="off" novalidate>
            <input id="ruleta-name" type="text" placeholder="Añadir nickname…" required />
            <button type="submit">Añadir</button>
          </form>
          <ul id="ruleta-list" class="list" aria-label="Lista de participantes"></ul>
          <p class="subtle">Consejo: pulsa sobre un nombre para editarlo. Usa la papelera para eliminar.</p>
        </div>
      </div>
    `;
    // Inserta al final del <main>
    (document.querySelector('main') || document.body).appendChild(sec);
    return sec;
  }

  function addNavButton() {
    if ($('#btn-ruleta')) return $('#btn-ruleta');
    const nav = $('#nav');
    if (!nav) return null;
    const btn = document.createElement('button');
    btn.id = 'btn-ruleta';
    btn.textContent = 'Ruleta';
    btn.setAttribute('data-tab','ruleta');
    nav.insertBefore(btn, $('#btn-salir')); // antes de "Salir"
    // Integra con tu sistema de pestañas existente
    on(btn, 'click', () => {
      // Emula showTab(name) de tu app
      $$('.tab').forEach(t => t.classList.add('hidden'));
      $('#ruleta').classList.remove('hidden');
      // activa estado visual
      $$('nav button[data-tab]').forEach(b => b.classList.toggle('active', b === btn));
    }, { passive:false });
    return btn;
  }

  function initWheel() {
    const canvas = $('#ruleta-canvas');
    const ctx = canvas.getContext('2d');
    const listEl = $('#ruleta-list');
    const form = $('#ruleta-form');
    const input = $('#ruleta-name');
    const btnSpin = $('#ruleta-spin');
    const btnReset = $('#ruleta-reset');
    const chkRemove = $('#ruleta-remove');
    const resultEl = $('#ruleta-result');

    const STORAGE_KEY = 'ruleta_participantes_v2';
    const loadNames = () => { try { const a = JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); return Array.isArray(a)?a:[]; } catch { return []; } };
    const saveNames = (a) => localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
    let names = loadNames();

    function renderList(){
      listEl.innerHTML = '';
      names.forEach((n, i) => {
        const li = document.createElement('li');
        li.className = 'item';
        const inp = document.createElement('input');
        inp.className = 'name';
        inp.value = n;
        on(inp, 'change', () => { names[i] = inp.value.trim(); saveNames(names); drawWheel(); }, { passive:false });
        const up = document.createElement('button'); up.className='btn'; up.textContent='↑';
        on(up,'click', (e)=>{ e.preventDefault(); e.stopPropagation(); if(i>0){ [names[i-1],names[i]]=[names[i],names[i-1]]; saveNames(names); renderList(); drawWheel(); } }, { passive:false });
        const down = document.createElement('button'); down.className='btn'; down.textContent='↓';
        on(down,'click', (e)=>{ e.preventDefault(); e.stopPropagation(); if(i<names.length-1){ [names[i+1],names[i]]=[names[i],names[i+1]]; saveNames(names); renderList(); drawWheel(); } }, { passive:false });
        const del = document.createElement('button'); del.className='btn del'; del.textContent='🗑';
        on(del,'click', (e)=>{ e.preventDefault(); e.stopPropagation(); names.splice(i,1); saveNames(names); renderList(); drawWheel(); }, { passive:false });
        li.append(inp, up, down, del);
        listEl.appendChild(li);
      });
    }

    on(form,'submit',(e)=>{
      e.preventDefault(); e.stopPropagation();
      const v = input.value.trim(); if(!v) return;
      names.push(v); input.value=''; saveNames(names); renderList(); drawWheel();
      return false;
    }, { passive:false });

    on(btnReset,'click',(e)=>{ e.preventDefault(); resultEl.textContent=''; angle=0; angularVelocity=0; drawWheel(); }, { passive:false });

    // ===== Wheel drawing/physics =====
    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    function resizeCanvas(){
      const rect = canvas.getBoundingClientRect();
      const size = Math.min(rect.width || 420, 560);
      canvas.width = size * DPR;
      canvas.height = size * DPR;
    }
    window.addEventListener('resize', () => { resizeCanvas(); drawWheel(); });

    let angle = 0; // rad, rotation of wheel
    let angularVelocity = 0; // rad/s
    let rafId = 0;
    let lastTs = 0;

    // Pleasant palette
    const PALETTE = ['var(--c1)','var(--c2)','var(--c3)','var(--c4)','var(--c5)','var(--c6)','var(--c7)','var(--c8)','var(--c9)','var(--c10)'];

    function drawWheel(){
      resizeCanvas();
      const w = canvas.width, h = canvas.height;
      const r = Math.min(w, h)/2 - (18*DPR);
      ctx.clearRect(0,0,w,h);
      ctx.save();
      ctx.translate(w/2, h/2);
      ctx.rotate(angle);

      const N = Math.max(1, names.length);
      const slice = (Math.PI*2)/N;

      for(let i=0;i<N;i++){
        const start = i*slice;
        const end = start + slice;
        // wedge
        const grad = ctx.createRadialGradient(0,0, r*0.2, 0,0, r);
        const c = getComputedStyle(document.documentElement).getPropertyValue(PALETTE[i % PALETTE.length]).trim() || '#60a5fa';
        grad.addColorStop(0, c + 'ee');
        grad.addColorStop(1, c);
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.arc(0,0,r,start,end);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        // separators
        ctx.lineWidth = 2*DPR;
        ctx.strokeStyle = 'rgba(0,0,0,.35)';
        ctx.stroke();

        // label
        ctx.save();
        ctx.rotate(start + slice/2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#0b0b0b';
        ctx.font = `${Math.max(14*DPR, Math.min(22*DPR, r*0.10))}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
        const label = (names[i] || '—');
        ctx.fillText(label, r - 14*DPR, 6*DPR);
        ctx.restore();
      }

      // center disc and glow
      ctx.beginPath();
      ctx.fillStyle = '#0e1016';
      ctx.arc(0,0, 30*DPR, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,.08)';
      ctx.lineWidth = 8*DPR;
      ctx.arc(0,0, r, 0, Math.PI*2);
      ctx.stroke();

      ctx.restore();
    }

    // Pointer at TOP -> angle  -PI/2 in world coordinates.
    function indexAtPointer(){
      const N = names.length;
      if(N===0) return -1;
      const slice = (Math.PI*2)/N;
      // Effective angle of slice under the pointer (top)
      const a = ((-Math.PI/2) - angle) % (Math.PI*2);
      // Normalize to [0, 2PI)
      const norm = (a + Math.PI*2) % (Math.PI*2);
      let idx = Math.floor(norm / slice);
      if (idx < 0) idx += N;
      return idx % N;
    }

    function animate(ts){
      if(!lastTs) lastTs = ts;
      const dt = (ts - lastTs)/1000;
      lastTs = ts;

      angle += angularVelocity * dt;
      angularVelocity *= 0.985; // friction

      if (Math.abs(angularVelocity) < 0.02){
        angularVelocity = 0;
        cancelAnimationFrame(rafId);
        rafId = 0; lastTs = 0;
        drawWheel();
        const idx = indexAtPointer();
        if(idx >= 0 && names[idx]){
          const winner = names[idx];
          resultEl.textContent = `Ganador: ${winner}`;
          if (chkRemove.checked){
            names.splice(idx,1);
            saveNames(names); renderList(); drawWheel();
          }
        }
        return;
      }
      drawWheel();
      rafId = requestAnimationFrame(animate);
    }

    on(btnSpin,'click',(e)=>{
      e.preventDefault();
      if(names.length===0){ alert('Añade al menos un participante.'); return; }
      resultEl.textContent = '';
      // random spin and extra random offset so it doesn't feel deterministic
      angularVelocity = 6.5 + Math.random()*3.5; // rad/s
      if(!rafId) rafId = requestAnimationFrame(animate);
    }, { passive:false });

    renderList();
    drawWheel();
  }

  function mount() {
    injectCSS();
    const sec = createSection();
    addNavButton();
    initWheel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
