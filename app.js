import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_PIN } from "./config.js";

// Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Estado en memoria/localStorage ---
const state = {
  event: null,     // { id, title, code }
  me: null,        // { id, nickname }
  selections: {},  // menu_item_id -> qty
  menu: [],        // catálogo
  users: [],       // participantes
  tasks: [],
  performers: {},  // task_id -> [user_id]
  expenses: [],
  editMode: false  // modo edición de catálogo
};

const LS_KEY = "bbq-state-v1";

function saveLS(){
  const minimal = { event: state.event, me: state.me };
  localStorage.setItem(LS_KEY, JSON.stringify(minimal));
}
function loadLS(){
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const { event, me } = JSON.parse(raw);
    state.event = event || null;
    state.me = me || null;
  } catch {}
}
loadLS();

// --- Utilidades ---
function el(id){ return document.getElementById(id); }
function msg(text, id="menu-msg"){ const n = el(id); if(n) n.textContent = text; }
function shortCode(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }
function euro(n){ return (n||0).toLocaleString("es-ES",{style:"currency",currency:"EUR"}); }

// --- UI básicos ---
const joinSec = el("join");
const nav = el("nav");
const tabs = document.querySelectorAll(".tab");
const sessionInfo = el("session-info");

function showTab(name){
  tabs.forEach(t => t.classList.add("hidden"));
  el(name).classList.remove("hidden");
  // marca activa
  document.querySelectorAll("nav button[data-tab]").forEach(b=>{
    b.classList.toggle("active", b.dataset.tab===name);
  });
}

function setSessionInfo(){
  if (state.event && state.me){
    sessionInfo.textContent = `Evento: ${state.event.title} (${state.event.code}) — Yo: ${state.me.nickname}`;
  } else {
    sessionInfo.textContent = "";
  }
}

function showApp(){
  if (state.event && state.me){
    joinSec.classList.add("hidden");
    nav.classList.remove("hidden");
    setSessionInfo();
    showTab("menu");
  } else {
    // Vista no logueada: solo formulario de acceso
    joinSec.classList.remove("hidden");
    nav.classList.add("hidden");
    document.querySelectorAll('.tab').forEach(t=>t.classList.add('hidden'));
  }
}

// --- Carga catálogo de menú ---
async function loadMenu(){
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error){ console.error(error); return; }
  state.menu = data || [];
  renderMenu();
}

// Renderiza items con contador (y controles de edición si está activo)
function renderMenu(){
  const cont = el("menu-list");
  cont.innerHTML = "";
  for (const it of state.menu){
    const qty = state.selections[it.id] || 0;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="row" style="justify-content:space-between;gap:.5rem">
        <div><strong>${it.name}</strong> <span class="badge">${it.category}</span></div>
        ${state.editMode ? `<span class="pill">id:${it.id}</span>` : ""}
      </div>
      <small>Unidad: ${it.unit || "ud."}${it.price_estimate != null ? " · Est: " + euro(it.price_estimate): ""}</small>
      <div class="counter">
        <button data-id="${it.id}" data-d="-1">−</button>
        <input data-id="${it.id}" type="number" min="0" value="${qty}" />
        <button data-id="${it.id}" data-d="1">+</button>
        ${state.editMode ? `
          <button class="btn-edit" data-id="${it.id}" title="Editar">✎</button>
          <button class="btn-del" data-id="${it.id}" title="Eliminar">🗑️</button>
        ` : ""}
      </div>
    `;
    cont.appendChild(div);
  }
  // listeners contadores
  cont.querySelectorAll("button[data-id][data-d]").forEach(btn=>{
    btn.onclick = ()=>{
      const id = +btn.dataset.id;
      const d = +btn.dataset.d;
      const input = cont.querySelector(`input[data-id="${id}"]`);
      const v = Math.max(0, (+input.value||0)+d);
      input.value = v;
      state.selections[id] = v;
    };
  });
  cont.querySelectorAll("input[type=number]").forEach(inp=>{
    inp.oninput = ()=>{
      const id = +inp.dataset.id;
      const v = Math.max(0, (+inp.value||0));
      state.selections[id] = v;
    };
  });
  // listeners edición
  if (state.editMode){
    cont.querySelectorAll(".btn-edit").forEach(btn=>{
      btn.onclick = ()=> openEditMenuItem(+btn.dataset.id);
    });
    cont.querySelectorAll(".btn-del").forEach(btn=>{
      btn.onclick = ()=> deleteMenuItem(+btn.dataset.id);
    });
    el("btn-add-menu")?.classList.remove("hidden");
  } else {
    el("btn-add-menu")?.classList.add("hidden");
  }
}

// Guarda selecciones propias
async function saveSelections(){
  if (!state.event || !state.me) return;
  const rows = Object.entries(state.selections)
    .filter(([id, qty]) => (+qty)>0)
    .map(([menu_item_id, qty]) => ({
      event_id: state.event.id,
      user_id: state.me.id,
      menu_item_id: +menu_item_id,
      qty: +qty
    }));

  // Borra previas del usuario y vuelve a insertar (simplificación)
  const del = await supabase
    .from("user_selections")
    .delete()
    .eq("event_id", state.event.id)
    .eq("user_id", state.me.id);
  if (del.error){ msg("Error borrando previas: "+del.error.message); return; }

  if (rows.length===0){ msg("Guardado: sin selecciones"); return; }

  const ins = await supabase
    .from("user_selections")
    .insert(rows)
    .select();
  if (ins.error){ msg("Error guardando: "+ins.error.message); return; }
  msg("¡Selecciones guardadas!");
}

// ---- NUEVO: borrar todas mis selecciones ----
async function clearMySelections(){
  if (!state.event || !state.me) return;
  const { error } = await supabase
    .from("user_selections")
    .delete()
    .eq("event_id", state.event.id)
    .eq("user_id", state.me.id);
  if (error){ msg("Error al borrar: " + error.message); return; }
  state.selections = {};
  renderMenu();
  msg("Has vaciado todas tus selecciones.");
}

// ---- NUEVO: edición del catálogo ----
function toggleEditMode(){
  state.editMode = !state.editMode;
  el("btn-toggle-edit").textContent = state.editMode ? "✎ Modo edición (ON)" : "✎";
  renderMenu();
}

// Añadir elemento
async function addMenuItem(){
  const name = prompt("Nombre del elemento (ej: Salchicha):");
  if (!name) return;
  const category = prompt("Categoría (comida, bebida, otros):", "comida") || "otros";
  const unit = prompt("Unidad (ud., lata, kg...):", "ud.");
  const priceStr = prompt("Precio estimado (ej: 1.20). Deja vacío si no aplica:", "");
  const price = priceStr ? parseFloat(priceStr) : null;

  const { error } = await supabase.from("menu_items").insert({
    name, category, unit, price_estimate: price
  });
  if (error){ alert("Error insertando: " + error.message); return; }
  await loadMenu();
  msg(`Añadido “${name}” al catálogo.`);
}

// Editar elemento (incluye precio)
async function openEditMenuItem(id){
  const it = state.menu.find(m=>m.id===id);
  if (!it) return;
  const name = prompt("Nombre:", it.name);
  if (!name) return;
  const category = prompt("Categoría (comida, bebida, otros):", it.category || "otros") || "otros";
  const unit = prompt("Unidad:", it.unit || "ud.");
  const priceStr = prompt("Precio estimado (vacío para null):", it.price_estimate ?? "");
  const price = priceStr === "" ? null : parseFloat(priceStr);

  const { error } = await supabase
    .from("menu_items")
    .update({ name, category, unit, price_estimate: price })
    .eq("id", id);
  if (error){ alert("Error actualizando: " + error.message); return; }
  await loadMenu();
  msg(`Elemento “${name}” actualizado.`);
}

// Eliminar elemento (borra antes selecciones que lo referencien)
async function deleteMenuItem(id){
  const it = state.menu.find(m=>m.id===id);
  if (!it) return;
  if (!confirm(`¿Eliminar “${it.name}”? Esto quitará también las selecciones asociadas.`)) return;

  // Borra selecciones que referencian este item para evitar restricción FK
  const delSel = await supabase
    .from("user_selections")
    .delete()
    .eq("menu_item_id", id);
  if (delSel.error){ alert("Error borrando selecciones: " + delSel.error.message); return; }

  // Ahora borra el item del catálogo
  const delItem = await supabase
    .from("menu_items")
    .delete()
    .eq("id", id);
  if (delItem.error){ alert("Error borrando elemento: " + delItem.error.message); return; }

  await loadMenu();
  msg(`Elemento “${it.name}” eliminado.`);
}

// --- Tareas ---
async function loadTasks(){
  if (!state.event) return;
  const { data, error } = await supabase
    .from("tasks")
    .select("id,title,status,assigned_to,updated_at")
    .eq("event_id", state.event.id)
    .order("updated_at", { ascending: false });
  if (error){ console.error(error); return; }
  state.tasks = data || [];

  // Performers
  state.performers = {};
  const ids = state.tasks.map(t=>t.id);
  if (ids.length){
    const { data: perf } = await supabase
      .from("task_performers")
      .select("task_id,user_id")
      .in("task_id", ids);
    (perf||[]).forEach(p=>{
      if(!state.performers[p.task_id]) state.performers[p.task_id]=[];
      state.performers[p.task_id].push(p.user_id);
    });
  }

  renderTasks();
}

function nicknameById(uid){
  return (state.users.find(u=>u.id===uid)||{}).nickname || "—";
}

function renderTasks(){
  const ul = el("task-list");
  ul.innerHTML = "";
  for (const t of state.tasks){
    const li = document.createElement("li");

    const mine = t.assigned_to === state.me?.id;
    const perf = state.performers[t.id]||[];
    const perfNames = perf.map(nicknameById).join(", ");

    // Estado visual: check verde si done
    const statusBadge = t.status === "done"
      ? '<span class="badge done">✅</span>'
      : '<span class="badge">⏳</span>';

    const assigned = mine ? "Yo" : (t.assigned_to ? nicknameById(t.assigned_to) : "sin asignar");

    const head = document.createElement("div");
    head.className = "row";
    head.innerHTML = `
      ${statusBadge}
      <span class="task-title" style="flex:1">${t.title}</span>
      <span class="pill">${assigned}</span>
      ${perf.length? `<span class="pill">Hecha por: ${perfNames}</span>` : ""}
    `;

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const btnMine = document.createElement("button");
    btnMine.title = mine ? "Quitarme" : "Asignarme";
    btnMine.textContent = mine ? "👤−" : "👤+"; // iconos cortos
    btnMine.onclick = ()=>assignTask(t.id, mine ? null : state.me.id);

    const btnToggle = document.createElement("button");
    btnToggle.title = t.status === "done" ? "Marcar pendiente" : "Marcar hecha";
    btnToggle.textContent = t.status === "done" ? "↩︎" : "✓";
    btnToggle.onclick = ()=>{
      if(t.status==="done"){
        markPending(t.id);
      } else {
        openDoneDialog(t.id);
      }
    };

    const btnDel = document.createElement("button");
    btnDel.title = "Eliminar tarea";
    btnDel.textContent = "🗑️";
    btnDel.onclick = ()=> deleteTask(t.id, t.title);

    actions.append(btnMine, btnToggle, btnDel);

    li.append(head, actions);
    ul.appendChild(li);
  }
}

async function addTask(){
  const title = el("task-title").value.trim();
  if (!title) return;
  const { data, error } = await supabase
    .from("tasks")
    .insert({ event_id: state.event.id, title, status: "pending", created_by: state.me.id })
    .select();
  if (error){ alert(error.message); return; }
  el("task-title").value = "";
  await loadTasks();
}

async function assignTask(id, user_id){
  const { error } = await supabase
    .from("tasks")
    .update({ assigned_to: user_id })
    .eq("id", id);
  if (error){ alert(error.message); return; }
  await loadTasks();
}

// Marcar como pendiente (borra performers y cambia estado)
async function markPending(task_id){
  const del = await supabase.from("task_performers").delete().eq("task_id", task_id);
  if(del.error){ alert(del.error.message); return; }
  const upd = await supabase.from("tasks").update({ status: "pending" }).eq("id", task_id);
  if(upd.error){ alert(upd.error.message); return; }
  await loadTasks();
}

// --- NUEVO: eliminar tarea ---
async function deleteTask(task_id, title){
  if(!confirm(`¿Eliminar la tarea “${title}”?`)) return;
  const { error } = await supabase.from("tasks").delete().eq("id", task_id);
  if(error){ alert(error.message); return; }
  await loadTasks();
}

// Dialogo de selección de usuarios para "Hecha"
let currentTask = null;
function openDoneDialog(task_id){
  currentTask = task_id;
  const wrap = el("done-users"); wrap.innerHTML = "";
  state.users.forEach(u=>{
    const id = "chk-"+u.id;
    const lab = document.createElement("label");
    lab.innerHTML = `<input type="checkbox" id="${id}" value="${u.id}" /> ${u.nickname}`;
    wrap.appendChild(lab);
  });
  el("done-dialog").classList.remove("hidden");
}
function closeDoneDialog(){ el("done-dialog").classList.add("hidden"); currentTask=null; }
el("btn-cancel-done").onclick = closeDoneDialog;
el("btn-confirm-done").onclick = async ()=>{
  if(!currentTask) return;
  const selected = Array.from(document.querySelectorAll("#done-users input[type=checkbox]:checked")).map(x=>x.value);
  if(selected.length===0){ alert("Debes seleccionar al menos una persona."); return; }
  const del = await supabase.from("task_performers").delete().eq("task_id", currentTask);
  if(del.error){ alert(del.error.message); return; }
  const rows = selected.map(uid=>({ task_id: currentTask, user_id: uid }));
  const ins = await supabase.from("task_performers").insert(rows);
  if(ins.error){ alert(ins.error.message); return; }
  const upd = await supabase.from("tasks").update({ status: "done" }).eq("id", currentTask);
  if(upd.error){ alert(upd.error.message); return; }
  closeDoneDialog();
  await loadTasks();
};

// --- Gastos ---
async function loadExpenses(){
  if (!state.event) return;
  const { data, error } = await supabase
    .from("expenses")
    .select("id,concept,amount,payer_user_id,created_at")
    .eq("event_id", state.event.id)
    .order("created_at", { ascending: false });
  if (error){ console.error(error); return; }
  state.expenses = data || [];
  renderExpenses();
  renderBalances();
}

function renderExpenses(){
  const box = el("expenses");
  if (state.expenses.length===0){ box.innerHTML = "<p>No hay gastos.</p>"; return; }
  const rows = state.expenses.map(g=>`
    <div class="row" data-id="${g.id}">
      <span class="badge">${nicknameById(g.payer_user_id)}</span>
      <span style="flex:1">${g.concept}</span>
      <strong>${euro(g.amount)}</strong>
      <button class="btn-del-expense" title="Eliminar gasto">🗑️</button>
    </div>
  `).join("");
  box.innerHTML = rows;

  // listeners de borrado
  box.querySelectorAll(".btn-del-expense").forEach(btn=>{
    btn.onclick = (e)=>{
      const id = +(e.target.closest(".row").dataset.id);
      const concept = e.target.closest(".row").querySelector("span[style*='flex:1']").textContent;
      deleteExpense(id, concept);
    };
  });
}

function renderBalances(){
  const box = el("balances");
  const participants = state.users;
  const n = Math.max(1, participants.length);
  const total = state.expenses.reduce((s,g)=>s + (+g.amount||0), 0);
  const perHead = total / n;

  const paid = {};
  for (const u of participants){ paid[u.id]=0; }
  for (const g of state.expenses){ paid[g.payer_user_id] = (paid[g.payer_user_id]||0) + (+g.amount||0); }

  const lines = participants.map(u=>{
    const diff = (paid[u.id]||0) - perHead;
    const sign = diff>=0 ? "a favor" : "a pagar";
    return `<div class="row"><span>${u.nickname}</span><span style="margin-left:auto">${euro(diff)} ${sign}</span></div>`;
  }).join("");

  box.innerHTML = `<div class="row"><strong>Total</strong><span style="margin-left:auto">${euro(total)}</span></div>
  <div class="row"><strong>Por cabeza</strong><span style="margin-left:auto">${euro(perHead)}</span></div>${lines}`;
}

async function addExpense(){
  const concept = el("g-concept").value.trim();
  const amount = parseFloat(el("g-amount").value);
  if (!concept || !(amount>0)) return;
  const { error } = await supabase
    .from("expenses")
    .insert({ event_id: state.event.id, concept, amount, payer_user_id: state.me.id });
  if (error){ alert(error.message); return; }
  el("g-concept").value = "";
  el("g-amount").value = "";
  await loadExpenses();
}

// --- NUEVO: eliminar gasto ---
async function deleteExpense(id, concept){
  if(!confirm(`¿Eliminar el gasto “${concept}”?`)) return;
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error){ alert(error.message); return; }
  await loadExpenses();
  renderBalances();
}

// --- Resumen ---
async function loadSummary(){
  if (!state.event) return;
  // Totales por item
  const { data: totals, error } = await supabase
    .from("user_selections")
    .select("menu_item_id, qty")
    .eq("event_id", state.event.id);
  if (error){ console.error(error); return; }
  const agg = new Map();
  for (const r of totals){
    agg.set(r.menu_item_id, (agg.get(r.menu_item_id)||0) + (+r.qty||0));
  }
  const rows = [...agg.entries()].map(([id, sum])=>{
    const item = state.menu.find(m=>m.id===id);
    return `<div class="row"><span>${item?.name || id}</span><span style="margin-left:auto">${sum} ${item?.unit||""}</span></div>`;
  }).join("");
  el("summary").innerHTML = rows || "<p>No hay selecciones aún.</p>";
}

// --- Cargar participantes ---
async function loadUsers(){
  const { data, error } = await supabase
    .from("users")
    .select("id,nickname")
    .eq("event_id", state.event.id)
    .order("nickname");
  if (!error) state.users = data || [];
}

// --- Entrar / Crear evento ---
async function joinEvent(){
  const code = el("event-code").value.trim().toUpperCase();
  const nickname = el("nickname").value.trim();
  if (!code || !nickname){ alert("Código y nickname son obligatorios"); return; }

  // localiza evento por code
  const { data: evs, error: e1 } = await supabase.from("events").select("*").eq("code", code).limit(1);
  if (e1 || !evs || evs.length===0){ alert("No existe un evento con ese código"); return; }
  const event = evs[0];

  // crea o reutiliza usuario
  const { data: users, error: e2 } = await supabase
    .from("users")
    .select("*")
    .eq("event_id", event.id)
    .eq("nickname", nickname)
    .limit(1);
  let me = users && users[0];
  if (!me){
    const { data: ins, error: e3 } = await supabase
      .from("users")
      .insert({ event_id: event.id, nickname })
      .select()
      .limit(1);
    if (e3){ alert(e3.message); return; }
    me = ins[0];
  }

  state.event = event;
  state.me = me;
  saveLS();
  await afterLogin();
}

async function createEvent(){
  // --- Restricción por PIN de administrador ---
  const pinInput = el("admin-pin");
  const providedPIN = (pinInput?.value || "").trim();
  if (!ADMIN_PIN || ADMIN_PIN === "CAMBIA_ESTE_PIN"){
    alert("Configura ADMIN_PIN en config.js antes de crear eventos.");
    return;
  }
  if (providedPIN !== ADMIN_PIN){
    alert("PIN incorrecto. Solo el creador puede crear nuevas barbacoas.");
    return;
  }

  const title = el("new-title").value.trim() || "Barbacoa";
  const date = el("new-date").value || null;
  const code = shortCode();
  const { data, error } = await supabase
    .from("events")
    .insert({ title, date, code })
    .select()
    .limit(1);
  if (error){ alert(error.message); return; }
  // autologin creador: pide nickname
  const nickname = prompt("Tu nickname para este evento:");
  if (!nickname) return;
  const ev = data[0];
  const { data: uins, error: uerr } = await supabase
    .from("users")
    .insert({ event_id: ev.id, nickname })
    .select()
    .limit(1);
  if (uerr){ alert(uerr.message); return; }
  state.event = ev;
  state.me = uins[0];
  saveLS();
  await afterLogin();
  alert("Evento creado. Comparte este código: " + ev.code);
}

async function afterLogin(){
  await loadUsers();
  await Promise.all([loadMenu(), loadTasks(), loadExpenses(), loadSummary()]);
  // carga mis selecciones
  const { data: mine } = await supabase
    .from("user_selections")
    .select("menu_item_id, qty")
    .eq("event_id", state.event.id)
    .eq("user_id", state.me.id);
  state.selections = {};
  (mine||[]).forEach(r=> state.selections[r.menu_item_id]=r.qty);
  renderMenu();
  showApp();
}

function logout(){
  state.event = null;
  state.me = null;
  state.selections = {};
  // limpia UI
  document.getElementById('menu-list').innerHTML = '';
  document.getElementById('menu-msg').textContent = '';
  document.getElementById('task-list').innerHTML = '';
  document.getElementById('expenses').innerHTML = '';
  document.getElementById('balances').innerHTML = '';
  document.getElementById('summary').innerHTML = '';
  saveLS();
  showApp();
}

// --- Listeners ---
document.querySelectorAll("nav button[data-tab]").forEach(btn=>{
  btn.onclick = ()=>{
    showTab(btn.dataset.tab);
    if (btn.dataset.tab==="tareas") loadTasks();
    if (btn.dataset.tab==="gastos") loadExpenses();
    if (btn.dataset.tab==="resumen") loadSummary();
  };
});
el("btn-salir").onclick = logout;
el("btn-guardar-menu").onclick = saveSelections;
el("btn-borrar-todo").onclick = clearMySelections;
el("btn-toggle-edit").onclick = toggleEditMode;
el("btn-add-menu").onclick = addMenuItem;
el("btn-add-task").onclick = addTask;
el("btn-add-expense").onclick = addExpense;
el("btn-join").onclick = joinEvent;
el("btn-create").onclick = createEvent;

// Arranque
showApp();
if (state.event && state.me){
  afterLogin();
}
