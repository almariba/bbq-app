import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado
const state = { event:null, me:null, users:[], tasks:[], performers:{} };
const LS_KEY = "bbq-state-v1";
function saveLS(){ localStorage.setItem(LS_KEY, JSON.stringify({event:state.event, me:state.me})); }
function loadLS(){ try{ const raw=localStorage.getItem(LS_KEY); if(!raw) return; const {event,me}=JSON.parse(raw); state.event=event||null; state.me=me||null; }catch{} }
loadLS();

// Utilidades
function el(id){ return document.getElementById(id); }
function showTab(name){ document.querySelectorAll(".tab").forEach(t=>t.classList.add("hidden")); el(name).classList.remove("hidden"); }
function setSession(){ el("session-info").textContent = state.event && state.me ? `Evento: ${state.event.title} (${state.event.code}) — Yo: ${state.me.nickname}` : ""; }
function showApp(){ if(state.event&&state.me){ el("join").classList.add("hidden"); el("nav").classList.remove("hidden"); setSession(); showTab("tareas"); loadTasks(); } else { el("join").classList.remove("hidden"); el("nav").classList.add("hidden"); } }

// Entrar/crear evento
async function joinEvent(){
  const code = el("event-code").value.trim().toUpperCase();
  const nickname = el("nickname").value.trim();
  if(!code||!nickname) return alert("Código y nickname obligatorios");
  const { data:evs } = await supabase.from("events").select("*").eq("code", code).limit(1);
  if(!evs||evs.length===0) return alert("No existe un evento con ese código");
  const event = evs[0];
  const { data:users } = await supabase.from("users").select("*").eq("event_id", event.id).eq("nickname", nickname).limit(1);
  let me = users&&users[0];
  if(!me){
    const ins = await supabase.from("users").insert({ event_id:event.id, nickname }).select().limit(1);
    if(ins.error) return alert(ins.error.message);
    me = ins.data[0];
  }
  state.event=event; state.me=me; saveLS();
  await loadUsers();
  showApp();
}
async function createEvent(){
  const title = el("new-title").value.trim() || "Barbacoa";
  const date = el("new-date").value || null;
  const code = Math.random().toString(36).slice(2,8).toUpperCase();
  const { data, error } = await supabase.from("events").insert({ title, date, code }).select().limit(1);
  if(error) return alert(error.message);
  const ev = data[0];
  const nickname = prompt("Tu nickname para este evento:");
  if(!nickname) return;
  const u = await supabase.from("users").insert({ event_id: ev.id, nickname }).select().limit(1);
  if(u.error) return alert(u.error.message);
  state.event=ev; state.me=u.data[0]; saveLS();
  await loadUsers();
  showApp();
  alert("Evento creado. Código: " + ev.code);
}

// Usuarios del evento
async function loadUsers(){
  const { data, error } = await supabase.from("users").select("id,nickname").eq("event_id", state.event.id).order("nickname");
  if(!error) state.users = data||[];
}

// TAREAS
async function addTask(){
  const title = el("task-title").value.trim();
  if(!title) return;
  const { error } = await supabase.from("tasks").insert({ event_id: state.event.id, title, status: "pending", created_by: state.me.id });
  if(error) return alert(error.message);
  el("task-title").value = "";
  await loadTasks();
}

async function loadTasks(){
  // Carga tareas (sin embeds raros)
  const { data, error } = await supabase
    .from("tasks")
    .select("id,title,status,assigned_to,updated_at")
    .eq("event_id", state.event.id)
    .order("updated_at",{ascending:false});
  if(error){ console.error(error); return; }
  state.tasks = data||[];

  // Carga performers de estas tareas y móntalo en memoria
  const ids = state.tasks.map(t=>t.id);
  state.performers = {};
  if(ids.length>0){
    const { data:perf } = await supabase
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
  const ul = el("task-list"); ul.innerHTML="";
  for(const t of state.tasks){
    const li = document.createElement("li");
    const mine = t.assigned_to === state.me?.id;
    const perf = state.performers[t.id]||[];
    const perfNames = perf.map(nicknameById).join(", ");
    li.innerHTML = `
      <span class="badge">${t.status}</span>
      <span style="flex:1">${t.title}</span>
      <span class="pill">${mine ? "Yo" : (t.assigned_to ? nicknameById(t.assigned_to) : "sin asignar")}</span>
      ${perf.length? `<span class="pill">Hecha por: ${perfNames}</span>` : ""}
    `;
    const btnMine = document.createElement("button");
    btnMine.textContent = mine ? "Quitar de mí" : "Asignarme";
    btnMine.onclick = ()=>assignTask(t.id, mine ? null : state.me.id);

    const btnToggle = document.createElement("button");
    btnToggle.textContent = t.status === "done" ? "↩︎ Pendiente" : "✓ Hecha";
    btnToggle.onclick = ()=>{
      if(t.status==="done"){
        // Volver a pendiente: borra performers
        markPending(t.id);
      } else {
        openDoneDialog(t.id);
      }
    };

    li.append(btnMine, btnToggle);
    ul.appendChild(li);
  }
}

async function assignTask(id, user_id){
  const { error } = await supabase.from("tasks").update({ assigned_to: user_id }).eq("id", id);
  if(error) return alert(error.message);
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
  // Borra performers previos y añade los nuevos
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

// Listeners UI
el("btn-join").onclick = joinEvent;
el("btn-create").onclick = createEvent;
el("btn-salir").onclick = ()=>{ state.event=null; state.me=null; saveLS(); showApp(); };
el("btn-add-task").onclick = addTask;

// Arranque
async function boot(){
  if(state.event && state.me){ await loadUsers(); }
  showApp();
}
boot();
