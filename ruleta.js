
(() => {
  'use strict';

  // ====== Tiny DOM helpers ======
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts || {passive:false});

  // ====== Inject scoped CSS (no conflicts) ======
  function injectCSS() {
    if ($('#ruleta-style')) return;
    const css = `
/* ======= RULETA (scoped to #ruleta) ======= */
#ruleta.section { padding: 1rem 0; }
#ruleta .ruleta-grid { display:grid; grid-template-columns: 1fr 380px; gap: 1.25rem; align-items:start; }
@media (max-width: 1000px){ #ruleta .ruleta-grid { grid-template-columns: 1fr; } }
#ruleta .ruleta-card {
  position: relative;
  background: #111;
  border: 1px solid #222;
  border-radius: 1rem;
  padding: 1rem;
  box-shadow: 0 10px 30px rgba(0,0,0,.25);
}
#ruleta h2, #ruleta h3 { margin: 0 0 .75rem 0; }

/* Canvas look */
#ruleta-canvas {
  display:block;
  width: 100%;
  max-width: 520px;
  aspect-ratio: 1 / 1;
  margin: .25rem auto .75rem;
  background: radial-gradient(40% 40% at 50% 50%, #0d111a 0%, #0a0d14 60%, #070a12 100%);
  border-radius: 999px;
  border: 6px solid #0a0f19;
  box-shadow:
    0 20px 45px rgba(0,0,0,.45),
    inset 0 0 60px rgba(0,0,0,.35),
    inset 0 0 8px rgba(255,255,255,.05);
}

/* Fixed pointer at TOP (12 o'clock) pointing DOWN to the selected slice */
#ruleta .ruleta-pointer {
  position: absolute;
  left: 50%;
  top: 14px;
  transform: translateX(-50%);
  width: 0; height: 0;
  border-left: 14px solid transparent;
  border-right: 14px solid transparent;
  border-top: 0;
  border-bottom: 20px solid #22c55e; /* green */
  filter: drop-shadow(0 2px 4px rgba(0,0,0,.55));
}

/* Controls */
#ruleta .ruleta-controls { margin-top: .5rem; display:flex; gap: .5rem; flex-wrap: wrap; align-items:center; justify-content:center; }
#ruleta .ruleta-controls button {
  background: #3b82f6; color: white; border: 0; padding: .55rem .9rem; border-radius: .8rem; cursor: pointer; font-weight: 700;
}
#ruleta .ruleta-controls button.secondary { background: #222; color: #eaeaea; }

#ruleta .ruleta-checkbox { display:flex; align-items:center; gap:.5rem; opacity:.9; font-size:.92rem; }

#ruleta .ruleta-result { margin-top: .25rem; text-align: center; font-size: 1.1rem; font-weight: 800; min-height: 1.4rem; }

/* Right column */
#ruleta .ruleta-form { display:flex; gap:.5rem; }
#ruleta .ruleta-form input {
  flex:1; background:#0f1117; border:1px solid #222; color:#eaeaea; padding:.6rem .8rem; border-radius:.8rem;
}
#ruleta .ruleta-form button { background:#22c55e; color:#052b12; border:0; padding:.6rem .9rem; border-radius:.8rem; font-weight:800; cursor:pointer; }

#ruleta .ruleta-list { margin:.75rem 0 .5rem; padding:0; list-style:none; display:flex; flex-direction:column; gap:.5rem; max-height: 360px; overflow:auto; }
#ruleta .ruleta-item { display:flex; align-items:center; gap:.5rem; padding:.55rem .6rem; background:#0f1117; border:1px solid #222; border-radius:.8rem; }
#ruleta .ruleta-item .name { flex:1; outline:none; border:0; background:transparent; color:#eaeaea; font-size:.98rem; }
#ruleta .ruleta-item button { border:0; padding:.4rem .55rem; border-radius:.6rem; cursor:pointer; background:#1e2636; color:#eaeaea; }
#ruleta .ruleta-item button.delete { background:#3a1a1f; color:#ffc7ce; }
#ruleta .ruleta-hint { opacity:.85; font-size:.9rem; }

/* Small "tick" at the rim under the pointer for extra clarity */
#ruleta .ruleta-tick {
  position:absolute;
  left:50%;
  top: 44px;
  transform: translateX(-50%);
  width:10px; height:10px;
  background:#22c55e;
  border-radius:50%;
  box-shadow: 0 0 0 4px rgba(34,197,94,.22), 0 0 10px rgba(34,197,94,.6);
}
    `.trim();
    const style = document.createElement('style');
    style.id = 'ruleta-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ====== Create section (keeps your app intact) ======
  function createSection() {
    if ($('#ruleta')) return $('#ruleta');
    const sec = document.createElement('section');
    sec.id = 'ruleta';
    sec.className = 'section';
    sec.style.display = 'none'; // hidden until user clicks
    sec.setAttribute('aria-labelledby', 'ruleta-title');
    sec.innerHTML = `
      <div class="ruleta-grid">
        <div class="ruleta-card">
          <h2 id="ruleta-title">Ruleta de participantes</h2>
          <div style="position:relative">
            <canvas id="ruleta-canvas" width="420" height="420" aria-label="Ruleta aleatoria"></canvas>
            <div class="ruleta-pointer" aria-hidden="true"></div>
            <div class="ruleta-tick" aria-hidden="true"></div>
          </div>
          <div class="ruleta-controls">
            <button id="ruleta-spin">🎯 Girar</button>
            <label class="ruleta-checkbox">
              <input type="checkbox" id="ruleta-remove-winner" checked />
              Quitar ganador al salir
            </label>
            <button id="ruleta-reset" class="secondary">Reiniciar</button>
          </div>
          <div id="ruleta-result" class="ruleta-result" role="status" aria-live="polite"></div>
        </div>
        <div class="ruleta-card">
          <h3>Participantes</h3>
          <form id="ruleta-form" class="ruleta-form" autocomplete="off">
            <input id="ruleta-name" type="text" placeholder="Añadir nickname…" required />
            <button type="submit">Añadir</button>
          </form>
          <ul id="ruleta-list" class="ruleta-list" aria-label="Lista de participantes"></ul>
          <p class="ruleta-hint">Pulsa un nombre para editarlo. ↑/↓ reordenan. 🗑 elimina.</p>
        </div>
      </div>
    `;
    // insert after last known section
    const last = $('#resumen') || $('#gastos') || $('#tareas') || $('#menu');
    if (last && last.parentElement) last.parentElement.appendChild(sec);
    else (document.querySelector('main') || document.body).appendChild(sec);
    return sec;
  }

  // ====== Add nav button without breaking your nav ======
  function addNavButton() {
    if ($('#nav-ruleta')) return $('#nav-ruleta');
    // clone a nav button if possible
    const any = $('nav button[data-tab]') || $('nav button');
    if (!any) return null;
    const clone = any.cloneNode(true);
    clone.id = 'nav-ruleta';
    clone.textContent = 'Ruleta';
    clone.dataset.tab = 'ruleta';
    any.parentElement.appendChild(clone);
    return clone;
  }

  function setupNav(navBtn, section) {
    const otherIds = ['menu','tareas','gastos','resumen'];
    on(navBtn, 'click', (e) => {
      e.preventDefault();
      // hide others
      otherIds.forEach(id => { const s = document.getElementById(id); if (s) s.classList?.add('hidden') || (s.style.display='none'); });
      // show ruleta
      // prefer your app's "hidden" class if present
      section.classList?.remove('hidden');
      section.style.display = '';
      // mark active if your nav uses .active
      try {
        $$('#nav button[data-tab]').forEach(b => b.classList.toggle('active', b === navBtn));
      } catch {}
    });
  }

  // ====== HSL palette (distinct colors) ======
  function hsl(h, s, l){ return `hsl(${h} ${s}% ${l}%)`; }
  function palette(n){
    // Evenly spaced hues using golden angle for variety
    const out = [];
    const golden = 137.508;
    const start = Math.random()*360;
    for(let i=0;i<n;i++){
      const h = (start + i*golden) % 360;
      const s = 72;
      const l = i % 2 ? 55 : 62; // alternate lightness for contrast
      out.push(hsl(Math.round(h), s, l));
    }
    return out;
  }

  // ====== Main Roulette logic ======
  function initWheel() {
    const canvas = $('#ruleta-canvas');
    const ctx = canvas.getContext('2d');
    const listEl = $('#ruleta-list');
    const form = $('#ruleta-form');
    const input = $('#ruleta-name');
    const btnSpin = $('#ruleta-spin');
    const btnReset = $('#ruleta-reset');
    const chkRemoveWinner = $('#ruleta-remove-winner');
    const resultEl = $('#ruleta-result');

    const STORAGE_KEY = 'ruleta_participantes_v2';
    const loadNames = () => { try { const raw = localStorage.getItem(STORAGE_KEY); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; } catch { return []; } };
    const saveNames = (arr) => localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));

    let names = loadNames();
    let angle = 0;                 // current rotation (rad)
    let angularVelocity = 0;       // rad/s
    let animationId = 0;
    let lastTime = 0;
    let currentWinner = -1;        // index
    let colors = [];               // palette for current N
    let lastN = 0;

    // DPR & resize
    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    function resizeCanvas(){
      const rect = canvas.getBoundingClientRect();
      const size = Math.min(rect.width || 420, 560);
      canvas.width = size * DPR;
      canvas.height = size * DPR;
    }
    on(window, 'resize', () => { resizeCanvas(); drawWheel(); });

    // Render participants list
    function renderList(){
      listEl.innerHTML = '';
      names.forEach((n, i) => {
        const li = document.createElement('li');
        li.className = 'ruleta-item';

        const inputName = document.createElement('input');
        inputName.className = 'name';
        inputName.value = n;
        inputName.title = "Editar nombre";
        on(inputName, 'input', () => {
          names[i] = inputName.value.trim();
          saveNames(names);
          drawWheel();
        });

        const up = document.createElement('button'); up.textContent = '↑'; up.title='Subir';
        on(up, 'click', (e)=>{ e.preventDefault(); if(i>0){ [names[i-1], names[i]] = [names[i], names[i-1]]; saveNames(names); renderList(); drawWheel(); }});
        const down = document.createElement('button'); down.textContent = '↓'; down.title='Bajar';
        on(down, 'click', (e)=>{ e.preventDefault(); if(i<names.length-1){ [names[i+1], names[i]] = [names[i], names[i+1]]; saveNames(names); renderList(); drawWheel(); }});
        const del = document.createElement('button'); del.className='delete'; del.textContent='🗑'; del.title='Eliminar';
        on(del, 'click', (e)=>{ e.preventDefault(); names.splice(i,1); saveNames(names); renderList(); drawWheel(); });

        li.append(inputName, up, down, del);
        listEl.appendChild(li);
      });
    }

    // Add participant
    on(form, 'submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const value = input.value.trim();
      if(!value) return false;
      names.push(value);
      input.value = '';
      saveNames(names);
      renderList();
      drawWheel();
      return false;
    });

    // Physics
    function rand(min, max){ return Math.random() * (max - min) + min; }
    function norm(a){ const two = Math.PI*2; a = a % two; if (a < 0) a += two; return a; }

    function drawWheel(){
      resizeCanvas();
      const w = canvas.width, h = canvas.height;
      const r = Math.min(w, h)/2 - (18*DPR);
      ctx.clearRect(0,0,w,h);
      ctx.save();
      ctx.translate(w/2, h/2);
      ctx.rotate(angle);

      // recompute palette if N changes
      const N = Math.max(1, names.length);
      if (N !== lastN) { colors = palette(N); lastN = N; }

      const slice = (Math.PI*2)/N;

      // slices
      for(let i=0;i<N;i++){
        const start = i*slice;
        const end = start + slice;
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.arc(0,0,r,start,end);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        ctx.lineWidth = 2*DPR;
        ctx.strokeStyle = 'rgba(0,0,0,.30)';
        ctx.stroke();

        // Divider
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.lineTo(Math.cos(end)*r, Math.sin(end)*r);
        ctx.lineWidth = 1*DPR;
        ctx.strokeStyle = 'rgba(255,255,255,.12)';
        ctx.stroke();

        // Text
        ctx.save();
        ctx.rotate(start + slice/2);
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(0,0,0,.75)';
        ctx.font = `${Math.max(14*DPR, Math.min(22*DPR, r*0.11))}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
        const label = (names[i] || '—');
        ctx.fillText(label, r - 14*DPR, 8*DPR);
        ctx.restore();
      }

      // center cap
      ctx.beginPath();
      ctx.fillStyle = '#0b0f18';
      ctx.arc(0,0, 30*DPR, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();

      // when stopped, highlight winning slice under the TOP pointer
      if (currentWinner >= 0 && names[currentWinner]) {
        ctx.save();
        ctx.translate(w/2, h/2);
        ctx.rotate(angle);
        const N2 = Math.max(1, names.length);
        const slice2 = (Math.PI*2)/N2;
        const start = currentWinner*slice2;
        const end = start + slice2;
        // glow stroke
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.arc(0,0,r,start,end);
        ctx.closePath();
        ctx.lineWidth = 6*DPR;
        ctx.strokeStyle = 'rgba(255,255,255,.28)';
        ctx.stroke();
        ctx.restore();
      }
    }

    // index at TOP pointer (12 o'clock, -PI/2)
    function indexAtPointer(){
      const N = names.length;
      if(N===0) return -1;
      const slice = (Math.PI*2)/N;
      const pointerAngle = -Math.PI/2; // fixed top
      const rel = norm(pointerAngle - angle); // rotate space so pointer is at 0
      let idx = Math.floor(rel / slice);
      if (idx < 0) idx += N;
      if (idx >= N) idx = idx % N;
      return idx;
    }

    function tick(ts){
      if(!lastTime) lastTime = ts;
      const dt = (ts - lastTime)/1000;
      lastTime = ts;

      angle += angularVelocity * dt;
      angularVelocity *= 0.985; // friction

      if(Math.abs(angularVelocity) < 0.01){
        angularVelocity = 0;
        cancelAnimationFrame(animationId);
        animationId = 0;
        lastTime = 0;
        currentWinner = indexAtPointer();
        const winner = (currentWinner >= 0) ? names[currentWinner] : '';
        if (winner) {
          resultEl.textContent = `Ganador: ${winner}`;
          drawWheel(); // redraw to show highlight
          if (chkRemoveWinner.checked){
            // small timeout so the user sees the highlight before removal
            setTimeout(() => {
              names.splice(currentWinner,1);
              currentWinner = -1;
              saveNames(names);
              renderList();
              drawWheel();
            }, 650);
          }
        }
        return;
      }
      currentWinner = -1; // clear during spin
      drawWheel();
      animationId = requestAnimationFrame(tick);
    }

    on(btnSpin, 'click', (e) => {
      e.preventDefault();
      if(names.length === 0){ alert('Añade al menos un participante.'); return; }
      resultEl.textContent = '';
      angularVelocity = rand(6.8, 9.8); // rad/s
      if(!animationId){ animationId = requestAnimationFrame(tick); }
    });

    on(btnReset, 'click', (e) => {
      e.preventDefault();
      resultEl.textContent = '';
      angle = 0; angularVelocity = 0; currentWinner = -1;
      drawWheel();
    });

    // initial render
    renderList();
    resizeCanvas();
    drawWheel();
  }

  // ====== Mount ======
  function mount() {
    injectCSS();
    const section = createSection();
    const navBtn = addNavButton();
    if (navBtn) setupNav(navBtn, section);
    initWheel();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
