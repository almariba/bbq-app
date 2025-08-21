// === Enlazado básico de pestañas (por si el proyecto no lo tuviera) ===
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.target;
      // activar botón
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      // mostrar sección
      document.querySelectorAll('.section').forEach(sec => sec.style.display = (sec.id === id) ? 'block' : 'none');
    });
  });

  // Mostrar ruleta por defecto si existe
  if (document.getElementById('ruleta')) {
    document.querySelectorAll('.section').forEach(sec => sec.style.display = (sec.id === 'ruleta') ? 'block' : 'none');
  }

  // Inicializar ruleta
  initRuleta();
});

// ========================= RULETA =========================
function initRuleta(){
  const canvas = document.getElementById('ruleta-canvas');
  const ctx = canvas.getContext('2d');
  const listEl = document.getElementById('ruleta-list');
  const form = document.getElementById('ruleta-form');
  const input = document.getElementById('ruleta-name');
  const btnSpin = document.getElementById('ruleta-spin');
  const btnReset = document.getElementById('ruleta-reset');
  const chkRemoveWinner = document.getElementById('ruleta-remove-winner');
  const resultEl = document.getElementById('ruleta-result');
  const btnImport = document.getElementById('ruleta-import');
  const btnExport = document.getElementById('ruleta-export');

  if(!canvas || !ctx) return; // sección no presente

  // Persistencia simple en localStorage
  const STORAGE_KEY = 'ruleta_participantes_v1';

  function loadNames(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
  function saveNames(arr){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  let names = loadNames();

  // Render lista
  function renderList(){
    listEl.innerHTML = '';
    names.forEach((n, i) => {
      const li = document.createElement('li');
      li.className = 'ruleta-item';

      const span = document.createElement('input');
      span.className = 'name';
      span.value = n;
      span.setAttribute('aria-label', 'Nombre ' + (i+1));
      span.addEventListener('change', () => {
        names[i] = span.value.trim();
        saveNames(names);
        drawWheel();
      });

      const up = document.createElement('button');
      up.innerText = '↑';
      up.title = 'Subir';
      up.addEventListener('click', () => {
        if(i>0){ [names[i-1], names[i]] = [names[i], names[i-1]]; saveNames(names); renderList(); drawWheel(); }
      });

      const down = document.createElement('button');
      down.innerText = '↓';
      down.title = 'Bajar';
      down.addEventListener('click', () => {
        if(i<names.length-1){ [names[i+1], names[i]] = [names[i], names[i+1]]; saveNames(names); renderList(); drawWheel(); }
      });

      const del = document.createElement('button');
      del.className = 'delete';
      del.innerText = '🗑';
      del.title = 'Eliminar';
      del.addEventListener('click', () => {
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

  // Añadir desde form
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if(!value) return;
    names.push(value);
    input.value = '';
    saveNames(names);
    renderList();
    drawWheel();
  });

  // Botones utilidades
  btnReset.addEventListener('click', () => {
    resultEl.textContent = '';
    // No vaciamos participantes; solo reseteamos estado de giro
    angle = 0; angularVelocity = 0;
    drawWheel();
  });

  btnExport.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(names, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'participantes_ruleta.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  btnImport.addEventListener('click', async () => {
    const inputFile = document.createElement('input');
    inputFile.type = 'file';
    inputFile.accept = 'application/json';
    inputFile.addEventListener('change', async () => {
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

  // ===== LÓGICA RULETA =====
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  function resizeCanvas(){
    const rect = canvas.getBoundingClientRect();
    const size = Math.min(rect.width, 560);
    canvas.width = size * DPR;
    canvas.height = size * DPR;
  }
  window.addEventListener('resize', () => { resizeCanvas(); drawWheel(); });

  let angle = 0; // rad
  let angularVelocity = 0; // rad/s
  let animationId = 0;
  let lastTime = 0;

  function rand(min, max){ return Math.random() * (max - min) + min; }

  const COLORS = [
    '#5eead4','#60a5fa','#a78bfa','#f472b6','#fca5a5','#fbbf24','#86efac','#93c5fd','#fcd34d','#c4b5fd'
  ];

  function drawWheel(){
    resizeCanvas();
    const w = canvas.width, h = canvas.height;
    const r = Math.min(w, h)/2 - (16*DPR);
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

    // centro
    ctx.beginPath();
    ctx.fillStyle = '#0d1222';
    ctx.arc(0,0, 28*DPR, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  function indexAtPointer(){
    const N = names.length;
    if(N===0) return -1;
    // El puntero está arriba; convertimos ángulo a índice
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
    angularVelocity *= 0.985; // fricción

    if(Math.abs(angularVelocity) < 0.01){
      angularVelocity = 0;
      cancelAnimationFrame(animationId);
      animationId = 0;
      lastTime = 0;
      // anunciar ganador
      const idx = indexAtPointer();
      if(idx >= 0 && names[idx]){
        const winner = names[idx];
        resultEl.textContent = `Ganador: ${winner}`;
        if(chkRemoveWinner.checked){
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

  btnSpin.addEventListener('click', () => {
    if(names.length === 0){
      alert('Añade al menos un participante.');
      return;
    }
    resultEl.textContent = '';
    // velocidad aleatoria y arranque
    angularVelocity = rand(6.5, 9.5); // rad/s
    if(!animationId){
      animationId = requestAnimationFrame(tick);
    }
  });

  // inicial
  renderList();
  drawWheel();
}
