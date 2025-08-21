
(() => {
  'use strict';

  // ====== Utilities ======
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn, {passive:true});

  function injectCSS() {
    if ($('#ruleta-style')) return;
    const css = `
/* ======= RULETA (scoped) ======= */
#ruleta.section { padding: 16px; }
#ruleta .ruleta-grid { display:grid; grid-template-columns: 1fr 360px; gap: 24px; align-items:start; }
@media (max-width: 900px){ #ruleta .ruleta-grid { grid-template-columns: 1fr; } }
#ruleta .ruleta-card {
  background: var(--ruleta-card, #ffffff0d);
  border: 1px solid var(--ruleta-border, #ffffff22);
  border-radius: 16px;
  padding: 16px;
  position: relative;
}
#ruleta-canvas {
  display:block;
  width: 100%;
  max-width: 420px;
  aspect-ratio: 1 / 1;
  margin: 0 auto;
  background: radial-gradient(120px 120px at center, rgba(0,0,0,.15), transparent);
  border-radius: 999px;
  border: 6px solid rgba(0,0,0,.2);
  box-shadow: 0 10px 30px rgba(0,0,0,.35), inset 0 0 40px rgba(0,0,0,.25);
}
#ruleta .ruleta-pointer {
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: 0; height: 0;
  border-left: 14px solid transparent;
  border-right: 14px solid transparent;
  border-bottom: 18px solid #3b82f6;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,.45));
}
#ruleta .ruleta-controls { margin-top: 14px; display:flex; gap: 10px; flex-wrap: wrap; align-items:center; justify-content:center; }
#ruleta .ruleta-controls button {
  background: #3b82f6; color: white; border: 0; padding: 8px 12px; border-radius: 10px; cursor: pointer; font-weight: 600;
}
#ruleta .ruleta-controls button.secondary { background: #2a3146; color: inherit; }
#ruleta .ruleta-checkbox { display:flex; align-items:center; gap:8px; opacity:.85; font-size: 14px; }
#ruleta .ruleta-result { margin-top: 10px; text-align: center; font-size: 18px; font-weight: 700; min-height: 24px; }

#ruleta .ruleta-form { display:flex; gap: 8px; }
#ruleta .ruleta-form input {
  flex: 1;
  background: transparent;
  border: 1px solid currentColor;
  color: inherit;
  padding: 10px 12px;
  border-radius: 10px;
}
#ruleta .ruleta-form button { background: #22c55e; color: #052b12; border: 0; padding: 10px 12px; border-radius: 10px; font-weight: 700; cursor:pointer; }

#ruleta .ruleta-list { margin: 12px 0 6px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; max-height: 360px; overflow: auto; }
#ruleta .ruleta-item { display:flex; align-items:center; gap: 10px; padding: 8px 10px; border: 1px dashed currentColor; border-radius: 10px; }
#ruleta .ruleta-item .name { flex: 1; outline: none; border: 0; background: transparent; color: inherit; font-size: 15px; }
#ruleta .ruleta-item button { border: 0; padding: 6px 8px; border-radius: 8px; cursor: pointer; }
#ruleta .ruleta-item button.delete { background: #35161a; color: #f7c0c6; }
#ruleta .ruleta-actions { display:flex; gap:8px; }
#ruleta .ruleta-hint { opacity:.8; font-size: 13px; }
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
    // Try to match existing "section" class
    sec.className = 'section';
    sec.style.display = 'none'; // hidden by default
    sec.setAttribute('aria-labelledby', 'ruleta-title');
    sec.innerHTML = `
      <div class="ruleta-grid">
        <div class="ruleta-card">
          <h2 id="ruleta-title">Ruleta de participantes</h2>
          <canvas id="ruleta-canvas" width="400" height="400" aria-label="Ruleta aleatoria"></canvas>
          <div class="ruleta-pointer" aria-hidden="true"></div>
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
          <div class="ruleta-actions">
            <button id="ruleta-import" class="secondary">Importar</button>
            <button id="ruleta-export" class="secondary">Exportar</button>
          </div>
          <p class="ruleta-hint">Consejo: haz clic en un nombre para editarlo. Usa la papelera para eliminar.</p>
        </div>
      </div>
    `;
    // Insert after last known section or at end of main/body
    const lastKnown = $('#resumen') || $('#gastos') || $('#tareas') || $('#menu');
    if (lastKnown && lastKnown.parentElement) {
      lastKnown.parentElement.appendChild(sec);
    } else {
      (document.querySelector('main') || document.body).appendChild(sec);
    }
    return sec;
  }

  function cloneNavButton() {
    // Find a nav button/link to clone
    let btn = $('.tab-btn[data-target]') || $('[data-target="resumen"]') || $('[data-target="menu"]');
    if (!btn) btn = $('nav button, nav a'); // fallback
    if (!btn) return null;
    const clone = btn.cloneNode(true);
    // Adjust attributes/text
    if ('dataset' in clone) clone.dataset.target = 'ruleta';
    if (clone.getAttribute('href')) clone.setAttribute('href', '#ruleta');
    clone.id = 'nav-ruleta';
    clone.textContent = 'Ruleta';
    // Insert it after the last nav item
    const parent = btn.parentElement && btn.parentElement.tagName === 'NAV' ? btn.parentElement : btn.parentElement;
    if (btn.parentElement && btn.parentElement.parentElement && btn.parentElement.parentElement.tagName === 'NAV') {
      // If nav uses <ul><li><button>
      const li = document.createElement('li');
      li.appendChild(clone);
      btn.parentElement.parentElement.appendChild(li);
    } else {
      // Just put next to it
      parent.appendChild(clone);
    }
    return clone;
  }

  function setupNavBehavior(navBtn, section) {
    // Try to piggyback on existing behavior: if other tabs have click handlers, they might toggle by data-target.
    // We add our own safe handler that hides other known sections and shows ruleta.
    const otherIds = ['menu','tareas','gastos','resumen'];
    on(navBtn, 'click', (e) => {
      // Prevent default only if it's an anchor with hash
      if (navBtn.tagName === 'A') e.preventDefault();
      // Hide others
      otherIds.forEach(id => {
        const sec = document.getElementById(id);
        if (sec) sec.style.display = 'none';
      });
      // Show ruleta
      section.style.display = '';
      // Optional: set active class like siblings
      try {
        const siblings = navBtn.parentElement ? $$(navBtn.parentElement.tagName === 'LI' ? 'li > *' : navBtn.tagName, navBtn.parentElement.parentElement || navBtn.parentElement) : [];
        siblings.forEach(el => {
          if (el.classList) el.classList.toggle('active', el === navBtn);
        });
      } catch {}
    });
  }

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
    const btnImport = $('#ruleta-import');
    const btnExport = $('#ruleta-export');

    const STORAGE_KEY = 'ruleta_participantes_v1';
    const loadNames = () => {
      try { const raw = localStorage.getItem(STORAGE_KEY); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; } catch { return []; }
    };
    const saveNames = (arr) => localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    let names = loadNames();

    // Render list
    function renderList(){
      listEl.innerHTML = '';
      names.forEach((n, i) => {
        const li = document.createElement('li');
        li.className = 'ruleta-item';

        const span = document.createElement('input');
        span.className = 'name';
        span.value = n;
        span.setAttribute('aria-label', 'Nombre ' + (i+1));
        on(span, 'change', () => {
          names[i] = span.value.trim();
          saveNames(names);
          drawWheel();
        });

        const up = document.createElement('button');
        up.textContent = '↑';
        up.title = 'Subir';
        on(up, 'click', () => {
          if(i>0){ [names[i-1], names[i]] = [names[i], names[i-1]]; saveNames(names); renderList(); drawWheel(); }
        });

        const down = document.createElement('button');
        down.textContent = '↓';
        down.title = 'Bajar';
        on(down, 'click', () => {
          if(i<names.length-1){ [names[i+1], names[i]] = [names[i], names[i+1]]; saveNames(names); renderList(); drawWheel(); }
        });

        const del = document.createElement('button');
        del.className = 'delete';
        del.textContent = '🗑';
        del.title = 'Eliminar';
        on(del, 'click', () => {
          names.splice(i,1);
          saveNames(names);
          renderList();
          drawWheel();
        });

        li.appendChild(span);
        li.appendChild(up);
        li.appendChild(down);
        li.appendChild(del);
        listEl.appendChild(li);
      });
    }

    on(form, 'submit', (e) => {
      e.preventDefault();
      const value = input.value.trim();
      if(!value) return;
      names.push(value);
      input.value = '';
      saveNames(names);
      renderList();
      drawWheel();
    });

    on(btnReset, 'click', () => {
      resultEl.textContent = '';
      angle = 0; angularVelocity = 0;
      drawWheel();
    });

    on(btnExport, 'click', () => {
      const blob = new Blob([JSON.stringify(names, null, 2)], {type: 'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'participantes_ruleta.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    on(btnImport, 'click', () => {
      const inputFile = document.createElement('input');
      inputFile.type = 'file';
      inputFile.accept = 'application/json';
      on(inputFile, 'change', async () => {
        const file = inputFile.files?.[0];
        if(!file) return;
        try {
          const txt = await file.text();
          const arr = JSON.parse(txt);
          if(Array.isArray(arr)){
            names = arr.map(x => String(x).trim()).filter(Boolean);
            saveNames(names);
            renderList();
            drawWheel();
          } else {
            alert('El archivo no contiene un array válido.');
          }
        } catch(err){
          alert('No se pudo importar el archivo.');
        }
      });
      inputFile.click();
    });

    // ===== Wheel drawing/physics =====
    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    function resizeCanvas(){
      const rect = canvas.getBoundingClientRect();
      const size = Math.min(rect.width || 400, 560);
      canvas.width = size * DPR;
      canvas.height = size * DPR;
    }
    window.addEventListener('resize', () => { resizeCanvas(); drawWheel(); });

    let angle = 0; // rad
    let angularVelocity = 0; // rad/s
    let animationId = 0;
    let lastTime = 0;

    const COLORS = ['#5eead4','#60a5fa','#a78bfa','#f472b6','#fca5a5','#fbbf24','#86efac','#93c5fd','#fcd34d','#c4b5fd'];

    function drawWheel(){
      resizeCanvas();
      const w = canvas.width, h = canvas.height;
      const r = Math.min(w, h)/2 - (16*DPR);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0,0,w,h);
      ctx.save();
      ctx.translate(w/2, h/2);
      ctx.rotate(angle);

      const N = names.length || 1;
      const slice = (Math.PI*2)/N;

      for(let i=0;i<N;i++){
        const start = i*slice;
        const end = start + slice;
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.arc(0,0,r,start,end);
        ctx.closePath();
        ctx.fillStyle = COLORS[i % COLORS.length];
        ctx.fill();
        ctx.lineWidth = 2*DPR;
        ctx.strokeStyle = 'rgba(0,0,0,.25)';
        ctx.stroke();

        // Text
        ctx.save();
        ctx.rotate(start + slice/2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#0c0f19';
        ctx.font = `${Math.max(14*DPR, Math.min(20*DPR, r*0.10))}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
        const label = (names[i] || '—');
        ctx.fillText(label, r - 12*DPR, 6*DPR);
        ctx.restore();
      }

      // center disc
      ctx.beginPath();
      ctx.fillStyle = '#0d1222';
      ctx.arc(0,0, 28*DPR, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    function indexAtPointer(){
      const N = names.length;
      if(N===0) return -1;
      // pointer at top
      const normalized = (Math.PI*1.5 - angle) % (Math.PI*2);
      const slice = (Math.PI*2)/N;
      let idx = Math.floor(normalized / slice);
      if(idx < 0) idx += N;
      if(idx >= N) idx = idx % N;
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
        // announce winner
        const idx = indexAtPointer();
        if(idx >= 0 && names[idx]){
          const winner = names[idx];
          resultEl.textContent = `Ganador: ${winner}`;
          if($('#ruleta-remove-winner').checked){
            names.splice(idx,1);
            saveNames(names);
            renderList();
            drawWheel();
          }
        }
        return;
      }
      drawWheel();
      animationId = requestAnimationFrame(tick);
    }

    on(btnSpin, 'click', () => {
      if(names.length === 0){
        alert('Añade al menos un participante.');
        return;
      }
      resultEl.textContent = '';
      angularVelocity = Math.random() * (9.5 - 6.5) + 6.5; // rad/s
      if(!animationId){ animationId = requestAnimationFrame(tick); }
    });

    renderList();
    drawWheel();
  }

  function mount() {
    injectCSS();
    const section = createSection();
    const navBtn = cloneNavButton();
    if (navBtn) setupNavBehavior(navBtn, section);
    initWheel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
