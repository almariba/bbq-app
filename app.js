import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

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
  expenses: []
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
function msg(text, id="menu-msg"){ el(id).textContent = text; }
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
    joinSec.classList.remove("hidden");
    nav.classList.add("hidden");
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

// Renderiza items con contador
function renderMenu(){
  const cont = el("menu-list");
  cont.innerHTML = "";
  for (const it of state.menu){
    const qty = state.selections[it.id] || 0;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div><strong>${it.name}</strong> <span class="badge">${it.category}</span></div>
      <small>Unidad: ${it.unit || "ud."}${it.price_estimate ? " · Est: " + euro(it.price_estimate): ""}</small>
      <div class="counter">
        <button data-id="${it.id}" data-d="-1">−</button>
        <input data-id="${it.id}" type="number" min="0" value="${qty}" />
        <button data-id="${it.id}" data-d="1">+</button>
      </div>
    `;
    cont.appendChild(div);
  }
  // listeners
  cont.querySelectorAll("button[data-id]").forEach(btn=>{
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

// --- Tareas ---
async function loadTasks(){
  if (!state.event) return;
  const { data, error } = await supabase
    .from("tasks")
    .select("id,title,status,assigned_to,updated_at,users:nested_assigned_to(id,nickname)")
    .eq("event_id", state.event.id)
    .order("updated_at", { ascending: false });
  if (error){ console.error(error); return; }
  state.tasks = data || [];
  renderTasks();
}

function renderTasks(){
  const ul = el("task-list");
  ul.innerHTML = "";
  for (const t of state.tasks){
    const li = document.createElement("li");
    const mine = t.assigned_to === state.me?.id;
    li.innerHTML = `
      <span class="badge">${t.status}</span>
      <span>${t.title}</span>
      <span class="badge">${mine ? "Yo" : (t.users?.nickname || "—")}</span>
      <span style="margin-left:auto"></span>
    `;
    const btnToggle = document.createElement("button");
    btnToggle.textContent = t.status === "done" ? "↩︎ Pendiente" : "✓ Hecha";
    btnToggle.onclick = ()=>toggleTask(t.id, t.status==="done"?"pending":"done");
    const btnMine = document.createElement("button");
    btnMine.textContent = mine ? "Quitar de mí" : "Asignarme";
    btnMine.onclick = ()=>assignTask(t.id, mine ? null : state.me.id);
    li.append(btnMine, btnToggle);
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

async function toggleTask(id, status){
  const { error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", id);
  if (error){ alert(error.message); return; }
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

// --- Gastos ---
async function loadExpenses(){
  if (!state.event) return;
  const { data, error } = await supabase
    .from("expenses")
    .select("id,concept,amount,payer_user_id,created_at,users:payer_user_id(nickname)")
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
    <div class="row">
      <span class="badge">${g.users?.nickname || "Alguien"}</span>
      <span style="flex:1">${g.concept}</span>
      <strong>${euro(g.amount)}</strong>
    </div>
  `).join("");
  box.innerHTML = rows;
}

function renderBalances(){
  const box = el("balances");
  // participantes
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

// --- Resumen ---
async function loadSummary(){
  if (!state.event) return;
  // Totales por item
  const { data: totals, error } = await supabase
    .from("user_selections")
    .select("menu_item_id, qty, menu_items(name, unit)")
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
  // carga datos
  await Promise.all([loadMenu(), loadUsers(), loadTasks(), loadExpenses(), loadSummary()]);
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
el("btn-add-task").onclick = addTask;
el("btn-add-expense").onclick = addExpense;
el("btn-join").onclick = joinEvent;
el("btn-create").onclick = createEvent;

// Arranque
showApp();
if (state.event && state.me){
  afterLogin();
} else {
  // Carga catálogo por si ya queremos verlo
  loadMenu();
}
