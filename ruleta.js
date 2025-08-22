(() => {
  'use strict';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts || {passive:false});

  function injectCSS() {
    if ($('#ruleta-style')) return;
    const css = `
#ruleta.tab.hidden{display:none !important}
#ruleta .ruleta-grid{display:grid;grid-template-columns:1fr 380px;gap:1.25rem;align-items:start}
@media (max-width:1000px){#ruleta .ruleta-grid{grid-template-columns:1fr}}
#ruleta .ruleta-card{position:relative;background:#111;border:1px solid #222;border-radius:1rem;padding:1rem;box-shadow:0 10px 30px rgba(0,0,0,.25)}
#ruleta-canvas{display:block;width:100%;max-width:520px;aspect-ratio:1/1;margin:.25rem auto .75rem;background:radial-gradient(40% 40% at 50% 50%,#0d111a 0%,#0a0d14 60%,#070a12 100%);border-radius:999px;border:6px solid #0a0f19;box-shadow:0 20px 45px rgba(0,0,0,.45),inset 0 0 60px rgba(0,0,0,.35),inset 0 0 8px rgba(255,255,255,.05)}
#ruleta .ruleta-pointer{position:absolute;left:50%;top:14px;transform:translateX(-50%);width:0;height:0;border-left:14px solid transparent;border-right:14px solid transparent;border-bottom:20px solid #22c55e;filter:drop-shadow(0 2px 4px rgba(0,0,0,.55))}
#ruleta .ruleta-tick{position:absolute;left:50%;top:44px;transform:translateX(-50%);width:10px;height:10px;background:#22c55e;border-radius:50%;box-shadow:0 0 0 4px rgba(34,197,94,.22),0 0 10px rgba(34,197,94,.6)}
#ruleta .ruleta-controls{margin-top:.5rem;display:flex;flex-direction:column;gap:.5rem;align-items:center;justify-content:center}
#ruleta #ruleta-spin{background:#3b82f6;color:#fff;border:0;padding:.8rem 1.1rem;border-radius:1rem;cursor:pointer;font-weight:800;font-size:1.1rem}
#ruleta .ruleta-secondary{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center}
#ruleta .ruleta-controls button.secondary{background:#222;color:#eaeaea}
#ruleta .ruleta-checkbox{display:flex;align-items:center;gap:.5rem;opacity:.9;font-size:.92rem}
#ruleta .ruleta-result{margin-top:.25rem;text-align:center;font-size:1.1rem;font-weight:800;min-height:1.4rem}
#ruleta .ruleta-form{display:flex;gap:.5rem}
#ruleta .ruleta-form input{flex:1;background:#0f1117;border:1px solid #222;color:#eaeaea;padding:.6rem .8rem;border-radius:.8rem}
#ruleta .ruleta-form button{background:#22c55e;color:#052b12;border:0;padding:.6rem .9rem;border-radius:.8rem;font-weight:800;cursor:pointer}
#ruleta .ruleta-list{margin:.75rem 0 .5rem;padding:0;list-style:none;display:flex;flex-direction:column;gap:.5rem;max-height:360px;overflow:auto}
#ruleta .ruleta-item{display:flex;align-items:center;gap:.5rem;padding:.55rem .6rem;background:#0f1117;border:1px solid #222;border-radius:.8rem}
#ruleta .ruleta-item .name{flex:1;outline:none;border:0;background:transparent;color:#eaeaea;font-size:.98rem}
#ruleta .ruleta-item button{border:0;padding:.4rem .55rem;border-radius:.6rem;cursor:pointer;background:#1e2636;color:#eaeaea}
#ruleta .ruleta-item button.delete{background:#3a1a1f;color:#ffc7ce}
    `.trim();
    const style = document.createElement('style');
    style.id = 'ruleta-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function createSection(){
    const existing = $('#ruleta');
    if (existing){
      // Si ya existe, asegúrate de que tenga la clase 'tab'
      if (!existing.classList.contains('tab')) existing.classList.add('tab');
      if (!existing.classList.contains('hidden')) existing.classList.add('hidden');
      existing.innerHTML = '';
      var sec = existing;
    } else {
      const sec = document.createElement('section');
    sec.id = 'ruleta';
    sec.className = 'tab hidden';
    sec.setAttribute('aria-labelledby','ruleta-title');
    sec.innerHTML = `
      <h2 id="ruleta-title">Ruleta de participantes</h2>
      <div class="ruleta-grid">
        <div class="ruleta-card">
          <div style="position:relative">
            <canvas id="ruleta-canvas" width="420" height="420" aria-label="Ruleta aleatoria"></canvas>
            <div class="ruleta-pointer" aria-hidden="true"></div>
            <div class="ruleta-tick" aria-hidden="true"></div>
          </div>
          <div class="ruleta-controls">
            <button id="ruleta-spin">🎯 Girar</button>
            <div id="ruleta-result" class="ruleta-result" role="status" aria-live="polite"></div>
            <label class="ruleta-checkbox">
              <input type="checkbox" id="ruleta-remove-winner" checked />
              Quitar ganador al salir
            </label>
            <div class="ruleta-secondary">
              <button id="ruleta-reset" class="secondary">Reiniciar</button>
            </div>
          </div>
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
    const resumen = $('#resumen');
    if (resumen && resumen.parentElement) resumen.parentElement.insertBefore(sec, resumen.nextSibling);
    else (document.querySelector('main')||document.body).appendChild(sec);
    return sec;
  }

  function addNavButton(){
    // Usa botón existente si ya está en el HTML
    const existing = document.querySelector('#nav-ruleta, #nav [data-tab="ruleta"]');
    if (existing) return existing;
    const nav = $('#nav');
    if (!nav) return null;
    const salir = $('#btn-salir');
    const btn = document.createElement('button');
    btn.id = 'nav-ruleta';
    btn.dataset.tab = 'ruleta';
    btn.textContent = 'Ruleta';
    if (salir) nav.insertBefore(btn, salir);
    else nav.appendChild(btn);
    return btn;
  }

  function patchOtherTabsHideRuleta(){
    $$('#nav button[data-tab]').forEach(b=>{
      if (b.dataset.tab !== 'ruleta'){
        on(b,'click',()=>{ const r=$('#ruleta'); if(r) r.classList.add('hidden'); });
      }
    });
    const salir = $('#btn-salir');
    on(salir,'click',()=>{ const r=$('#ruleta'); if(r) r.classList.add('hidden'); });
  }

  function hsl(h,s,l){ return `hsl(${h} ${s}% ${l}%)`; }
  function palette(n){
    const out=[]; const golden=137.508; const start=180;
    for(let i=0;i<n;i++){ const h=(start+i*golden)%360; const s=72; const l=i%2?55:62; out.push(hsl(Math.round(h),s,l)); }
    return out;
  }

  function initWheel(){
    const section = document.getElementById('ruleta');

    const canvas = $('#ruleta-canvas'); const ctx = canvas.getContext('2d');
    const listEl = $('#ruleta-list'); const form = $('#ruleta-form'); const input = $('#ruleta-name');
    const btnSpin = $('#ruleta-spin'); const btnReset = $('#ruleta-reset'); const chkRemoveWinner = $('#ruleta-remove-winner'); const resultEl = $('#ruleta-result');

    const STORAGE_KEY = 'ruleta_participantes_v3';
    const load = ()=>{ try{const r=localStorage.getItem(STORAGE_KEY); const a=r?JSON.parse(r):[]; return Array.isArray(a)?a:[];}catch{return[];} };
    const save = (a)=> localStorage.setItem(STORAGE_KEY, JSON.stringify(a));

    let names = load();
    let angle=0, vel=0, raf=0, last=0, winner=-1, colors=[], lastN=0;
    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio||1));

    function resize(){ const rect=canvas.getBoundingClientRect(); const size=Math.min(rect.width||420,560); canvas.width=size*DPR; canvas.height=size*DPR; }
    on(window,'resize',()=>{ resize(); draw(); });

    function renderList(){
  listEl.innerHTML='';
  names.forEach((n,i)=>{
    const li=document.createElement('li'); li.className='ruleta-item';

    const nm=document.createElement('input'); nm.className='name'; nm.value=n;
    on(nm,'input',()=>{ names[i]=nm.value.trim(); save(names); draw(); });

    const btns=document.createElement('div'); btns.className='btns';
    const up=document.createElement('button'); up.textContent='↑'; on(up,'click',(e)=>{e.preventDefault(); if(i>0){[names[i-1],names[i]]=[names[i],names[i-1]]; save(names); renderList(); draw();}});
    const dn=document.createElement('button'); dn.textContent='↓'; on(dn,'click',(e)=>{e.preventDefault(); if(i<names.length-1){[names[i+1],names[i]]=[names[i],names[i+1]]; save(names); renderList(); draw();}});
    const del=document.createElement('button'); del.className='delete'; del.textContent='🗑'; on(del,'click',(e)=>{e.preventDefault(); names.splice(i,1); save(names); renderList(); draw();});

    btns.append(up,dn,del);
    li.append(nm,btns);
    listEl.appendChild(li);
  });
});
        const up=document.createElement('button'); up.textContent='↑'; on(up,'click',(e)=>{e.preventDefault(); if(i>0){[names[i-1],names[i]]=[names[i],names[i-1]]; save(names); renderList(); draw();}});
        const dn=document.createElement('button'); dn.textContent='↓'; on(dn,'click',(e)=>{e.preventDefault(); if(i<names.length-1){[names[i+1],names[i]]=[names[i],names[i+1]]; save(names); renderList(); draw();}});
        const del=document.createElement('button'); del.className='delete'; del.textContent='🗑'; on(del,'click',(e)=>{e.preventDefault(); names.splice(i,1); save(names); renderList(); draw();});
        li.append(nm,up,dn,del); listEl.appendChild(li);
      });
    }

    on(form,'submit',(e)=>{ e.preventDefault(); e.stopPropagation(); const v=input.value.trim(); if(!v) return false; names.push(v); input.value=''; save(names); renderList(); draw(); return false; });

    function rand(min,max){ return Math.random()*(max-min)+min; }
    function norm(a){ const t=Math.PI*2; a%=t; if(a<0)a+=t; return a; }

    function draw(){
      resize();
      const w=canvas.width, h=canvas.height; const r=Math.min(w,h)/2 - (18*DPR);
      ctx.clearRect(0,0,w,h); ctx.save(); ctx.translate(w/2,h/2); ctx.rotate(angle);
      const N=Math.max(1,names.length);
      if(N!==lastN){ colors=palette(N); lastN=N; }
      const slice=(Math.PI*2)/N;

      for(let i=0;i<N;i++){
        const start=i*slice, end=start+slice;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,r,start,end); ctx.closePath();
        ctx.fillStyle=colors[i%colors.length]; ctx.fill();
        ctx.lineWidth=2*DPR; ctx.strokeStyle='rgba(0,0,0,.30)'; ctx.stroke();

        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(end)*r, Math.sin(end)*r);
        ctx.lineWidth=1*DPR; ctx.strokeStyle='rgba(255,255,255,.12)'; ctx.stroke();

        ctx.save(); ctx.rotate(start+slice/2); ctx.textAlign='right'; ctx.fillStyle='rgba(0,0,0,.75)';
        ctx.font=`${Math.max(14*DPR, Math.min(22*DPR, r*0.11))}px system-ui,-apple-system,Segoe UI,Roboto,sans-serif`;
        ctx.fillText(names[i]||'—', r-14*DPR, 8*DPR); ctx.restore();
      }

      // center cap
      ctx.beginPath(); ctx.fillStyle='#0b0f18'; ctx.arc(0,0,30*DPR,0,Math.PI*2); ctx.fill();
      ctx.restore();

      if(winner>=0 && names[winner]){
        ctx.save(); ctx.translate(w/2,h/2); ctx.rotate(angle);
        const slice2=(Math.PI*2)/Math.max(1,names.length);
        const s=winner*slice2, e=s+slice2;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,r,s,e); ctx.closePath();
        ctx.lineWidth=6*DPR; ctx.strokeStyle='rgba(255,255,255,.28)'; ctx.stroke();
        ctx.restore();
      }
    }

    function indexAtPointer(){
      const N=names.length; if(N===0) return -1;
      const slice=(Math.PI*2)/N; const pointer=-Math.PI/2;
      const rel=norm(pointer - angle);
      let idx=Math.floor(rel/slice); if(idx<0) idx+=N; if(idx>=N) idx%=N; return idx;
    }

    function step(ts){
      if(!last) last=ts; const dt=(ts-last)/1000; last=ts;
      angle += vel*dt; vel *= 0.985;
      if(Math.abs(vel)<0.01){
        vel=0; cancelAnimationFrame(raf); raf=0; last=0;
        winner=indexAtPointer(); const name= winner>=0 ? names[winner] : '';
        if(name){ $('#ruleta-result').textContent = `Ganador: ${name}`; draw();
          if(chkRemoveWinner.checked){ setTimeout(()=>{ names.splice(winner,1); winner=-1; save(names); renderList(); draw(); }, 650); }
        }
        return;
      }
      winner=-1; draw(); raf=requestAnimationFrame(step);
    }

    on(btnSpin,'click',(e)=>{ e.preventDefault(); if(!names.length){ alert('Añade al menos un participante.'); return; } $('#ruleta-result').textContent=''; vel=rand(6.8,9.8); if(!raf) raf=requestAnimationFrame(step); });
    on(btnReset,'click',(e)=>{ e.preventDefault(); $('#ruleta-result').textContent=''; angle=0; vel=0; winner=-1; draw(); });

    renderList(); resize(); draw();
    // --- FORCE REFRESH when the tab becomes visible ---
    function __ruletaRefresh(){ try{ resize(); draw(); }catch(e){} }
    // Hook on nav button
    const navBtnRefresh = document.querySelector('#nav-ruleta,[data-tab="ruleta"]');
    if (navBtnRefresh) navBtnRefresh.addEventListener('click', ()=> setTimeout(__ruletaRefresh, 0));
    // Observe class changes (hidden <-> visible)
    if (section){
      const mo = new MutationObserver(()=>{ if(!section.classList.contains('hidden')) __ruletaRefresh(); });
      mo.observe(section, {attributes:true, attributeFilter:['class']});
    }
    // Fallback: refresh shortly after mount
    setTimeout(__ruletaRefresh, 250);
  }

  function mount(){
    injectCSS();
    const section = createSection();
    const navBtn = addNavButton();

    on(navBtn,'click',(e)=>{
      e.preventDefault();
      $$('.tab').forEach(t=>t.classList.add('hidden'));
      section.classList.remove('hidden');
      $$('#nav button[data-tab]').forEach(b=> b.classList.toggle('active', b===navBtn));
    });

    patchOtherTabsHideRuleta();

    initWheel();
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

})();
