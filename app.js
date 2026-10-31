/* Macros de Julio — app personal de calorías y macros. Datos en este teléfono (localStorage). IA: Gemini vía Worker propio. */
(() => {
"use strict";

/* =================== constantes =================== */
const KEY = "mj.v1";
const VERSION = "1.0.0";
const MEALS = [["desayuno","Desayuno"],["almuerzo","Almuerzo"],["once","Once"],["cena","Cena"],["colacion","Colación"],["extra","Comida extra"]];
const GOALS = {
  bajar:   {l:"Bajar grasa", d:"Perder grasa a un ritmo sostenible", adj:-0.20, pkg:2.0},
  definir: {l:"Definir", d:"Ya entrenas y quieres marcar (por ejemplo, después de una etapa de volumen)", adj:-0.15, pkg:2.2},
  recomp:  {l:"Bajar grasa y ganar músculo", d:"Si empiezas o vuelves a entrenar, o tienes más grasa que músculo", adj:-0.10, pkg:2.0},
  mantener:{l:"Mantener", d:"Comer lo que gastas y ordenar mis comidas", adj:0, pkg:1.6},
  ganar:   {l:"Ganar músculo", d:"Comer un poco más, junto con entrenar", adj:0.10, pkg:1.8}
};
const JOBS = {
  sentado:{l:"Sentado la mayor parte del día", d:"Oficina, computador, manejar, estudiar", f:1.2},
  pie:{l:"De pie / me muevo bastante", d:"Comercio, salud, enseñar, atender público", f:1.35},
  fisico:{l:"Trabajo físico pesado", d:"Construcción, bodega, campo, cargar peso", f:1.5}
};
const STEPS = {bajo:["Menos de 5.000 pasos",0],medio:["5.000 a 8.000",0.05],alto:["8.000 a 12.000",0.1],muy:["Más de 12.000",0.15]};
const ACTS = [["Caminar rápido",4.3],["Trotar / correr",9],["Bicicleta",7.5],["Natación",8],["Aguas abiertas",9],["Pesas / fuerza",5],["Fútbol",7],["Artes marciales",10],["Baile",5.5],["Cerro / trekking",6.5],["Otro",6]];
const DIETS = [["todo","Como de todo"],["vegetariano","Vegetariano"],["vegano","Vegano"],["singluten","Sin gluten"]];
const MEASURES = [["cintura","Cintura"],["cadera","Cadera"],["cuello","Cuello"],["pecho","Pecho"],["brazo","Brazo"],["muslo","Muslo"]];

/* =================== utilidades =================== */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = x => { const v = parseFloat(String(x ?? "").replace(",", ".")); return Number.isFinite(v) && v > 0 ? v : 0; };
const r1 = x => Math.round(x * 10) / 10;
const rnd = x => Math.round(x);
const r10 = x => Math.round(x / 10) * 10;
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
const z = n => String(n).padStart(2, "0");
const ymd = d => d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
const parseD = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const t = parseD(s); t.setDate(t.getDate() + n); return ymd(t); };
const dow = s => parseD(s).getDay(); // 0 = domingo
const diffDays = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
const fmtShort = s => new Intl.DateTimeFormat("es-CL", {day:"numeric", month:"short"}).format(parseD(s));
const fmtHM = t => new Intl.DateTimeFormat("es-CL", {hour:"2-digit", minute:"2-digit"}).format(new Date(t));
function fmtDay(s){ const t = today(); if (s === t) return "Hoy"; if (s === addDays(t, -1)) return "Ayer"; if (s === addDays(t, 1)) return "Mañana";
  return new Intl.DateTimeFormat("es-CL", {weekday:"short", day:"numeric", month:"short"}).format(parseD(s)); }
function mondayOf(s){ const w = dow(s); return addDays(s, w === 0 ? -6 : 1 - w); }
let toastT; function toast(m){ const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2800); }

/* =================== datos =================== */
function DEF(){ return {
  version: 1,
  settings: { workerUrl:"", token:"", model:"", dayCut:0, glassMl:250, waterGoalMl:2000, showWater:true,
    fasting:{on:false, hours:16, manualStart:null}, supps:[], weekendSave:{on:false, pct:10},
    cycling:{on:false, days:[1,3,5], delta:150}, diet:"todo", avoid:"", recalcEvery:15 },
  profile: null, goals: null, days: {}, favs: [], dishes: [], weights: [], measures: [], comps: [], bfEstimates: []
};}
function load(){
  try { const raw = localStorage.getItem(KEY); if (raw) { const d = JSON.parse(raw), b = DEF();
    return {...b, ...d, settings:{...b.settings, ...(d.settings||{}), fasting:{...b.settings.fasting, ...(d.settings?.fasting||{})},
      weekendSave:{...b.settings.weekendSave, ...(d.settings?.weekendSave||{})}, cycling:{...b.settings.cycling, ...(d.settings?.cycling||{})}}}; } }
  catch(e){}
  return DEF();
}
let DB = load();
function save(){ try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch(e){ toast("No se pudo guardar: la memoria está llena. Exporta un respaldo en Ajustes."); } }
try { navigator.storage?.persist?.(); } catch(e){}

function today(){ return ymd(new Date(Date.now() - (DB.settings.dayCut || 0) * 3600e3)); }
function getDay(d){ return DB.days[d] || null; }
function ensureDay(d){ return DB.days[d] || (DB.days[d] = {entries:[], water:0, acts:[], supps:{}, extraName:""}); }
function totals(dd){ const t = {kcal:0,p:0,c:0,f:0,fib:0}; (dd?.entries || []).forEach(e => { t.kcal += num(e.kcal); t.p += num(e.p); t.c += num(e.c); t.f += num(e.f); t.fib += num(e.fib); }); return t; }
function hasEntries(d){ return !!(DB.days[d]?.entries?.length); }
function lastWeight(){ const w = [...DB.weights].sort((a,b) => a.date < b.date ? -1 : 1); return w.length ? w[w.length - 1] : null; }

/* =================== cálculo de la meta =================== */
function calcPlan(p){
  const w = num(p.weight), h = num(p.height), a = num(p.age), bf = num(p.bf);
  if (!w || !h || !a) return null;
  const lbm = bf ? w * (1 - bf / 100) : 0;
  const bmr = bf ? 370 + 21.6 * lbm : 10 * w + 6.25 * h - 5 * a + (p.sex === "m" ? -161 : 5);
  const job = (JOBS[p.job] || JOBS.sentado).f, st = (STEPS[p.steps] || STEPS.bajo)[1];
  const neat = bmr * (job + st - 1);
  const train = num(p.trainings) * 4 * w / 7;
  const tdee = bmr + neat + train;
  const g = GOALS[p.goal] || GOALS.mantener;
  const kcal = r10(tdee * (1 + g.adj));
  // proteína: sobre el peso, salvo exceso de grasa (usa masa magra o peso a IMC 25)
  let pBase = w;
  const highBf = bf && (p.sex === "m" ? bf > 32 : bf > 25);
  if (highBf) pBase = lbm * 1.15; else if (!bf && w / ((h / 100) ** 2) > 30) pBase = 25 * (h / 100) ** 2;
  const pg = rnd(pBase * g.pkg);
  const fg = Math.max(rnd(kcal * 0.25 / 9), rnd(0.6 * w));
  const cg = Math.max(0, rnd((kcal - pg * 4 - fg * 9) / 4));
  return {bmr:rnd(bmr), neat:rnd(neat), train:rnd(train), tdee:rnd(tdee), kcal, p:pg, c:cg, f:fg, adj:g.adj, pkg:g.pkg, katch:!!bf};
}
function baseGoals(){ return DB.goals || {kcal:2000, p:140, c:220, f:60, example:true}; }
function applyCut(g, k){ g.kcal -= k; const cK = Math.min(g.c * 4, k * 0.6); g.c -= cK / 4; g.f = Math.max(0, g.f - (k - cK) / 9); }
function targetFor(d){
  const b = baseGoals(), g = {kcal:b.kcal, p:b.p, c:b.c, f:b.f}, notes = [], s = DB.settings;
  if (s.cycling.on && s.cycling.days.length && s.cycling.days.length < 7) {
    const n = s.cycling.days.length, plus = num(s.cycling.delta), minus = rnd(plus * n / (7 - n));
    if (s.cycling.days.includes(dow(d))) { g.kcal += plus; g.c += plus / 4; notes.push(["ok", `Día de entreno +${plus}`]); }
    else { applyCut(g, minus); notes.push(["", `Día de descanso −${minus}`]); }
  }
  if (s.weekendSave.on) {
    const w = dow(d), sv = rnd(b.kcal * num(s.weekendSave.pct) / 100);
    if (w >= 1 && w <= 5) { applyCut(g, sv); notes.push(["", `Ahorro para el sábado −${sv}`]); }
    else if (w === 6) { g.kcal += sv * 5; g.c += sv * 5 * 0.6 / 4; g.f += sv * 5 * 0.4 / 9; notes.push(["ok", `Sábado +${sv * 5} ahorradas`]); }
  }
  const comp = DB.comps.reduce((a, c) => a + (c.dates.includes(d) ? c.perDay : 0), 0);
  if (comp) { applyCut(g, comp); notes.push(["warn", `Compensando −${comp}`]); }
  const act = (DB.days[d]?.acts || []).reduce((a, x) => a + num(x.kcal), 0);
  if (act) { g.kcal += act; g.c += act * 0.7 / 4; g.f += act * 0.3 / 9; notes.push(["ok", `Actividad extra +${rnd(act)}`]); }
  return {kcal:rnd(g.kcal), p:rnd(g.p), c:rnd(Math.max(0, g.c)), f:rnd(Math.max(0, g.f)), fib:rnd(b.kcal / 1000 * 14), notes, example:!!b.example};
}
function compensate(from, excess){
  const cap = rnd(baseGoals().kcal * 0.15);
  let dates = [], d = addDays(from, 1);
  while (dow(d) !== 1 && dates.length < 6) { dates.push(d); d = addDays(d, 1); }
  if (!dates.length || excess / dates.length > cap) {
    const n = Math.min(7, Math.max(3, Math.ceil(excess / cap))); dates = [];
    for (let i = 1; i <= n; i++) dates.push(addDays(from, i));
  }
  const perDay = Math.min(cap, rnd(excess / dates.length));
  DB.comps = DB.comps.filter(c => c.from !== from);
  DB.comps.push({id:uid(), from, excess:rnd(excess), perDay, dates});
  save();
  return {perDay, dates, left: rnd(excess - perDay * dates.length)};
}

/* =================== IA (Gemini vía Worker) =================== */
function parseJSONLoose(t){
  if (t && typeof t === "object") return t;
  const s = String(t || "").trim();
  try { return JSON.parse(s); } catch(e){}
  const f = s.match(/```(?:json)?\s*([\s\S]*?)```/); if (f) { try { return JSON.parse(f[1]); } catch(e){} }
  const a = s.search(/[\[{]/), b = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch(e){} }
  throw {code:"parse"};
}
async function fileToPart(file, max = 1024){
  let img, url;
  try { img = await createImageBitmap(file); }
  catch(e){ url = URL.createObjectURL(file); img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }); }
  const sc = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  if (url) URL.revokeObjectURL(url);
  return {mime:"image/jpeg", data:c.toDataURL("image/jpeg", 0.8).split(",")[1]};
}
let ctl = null;
async function ai(prompt, files = [], thinking = "minimal"){
  const s = DB.settings;
  if (!s.workerUrl || !s.token) throw {code:"config"};
  const images = [];
  for (const f of files) images.push(await fileToPart(f));
  ctl = new AbortController();
  const tStart = Date.now(); const tick = setInterval(() => document.querySelectorAll("[data-elapsed]").forEach(e => e.textContent = Math.floor((Date.now() - tStart) / 1000)), 1000);
  try {
    let r;
    try {
      r = await fetch(s.workerUrl.replace(/\/+$/, "") + "/ai", {method:"POST", signal:ctl.signal,
        headers:{"Content-Type":"application/json", "X-App-Token":s.token},
        body:JSON.stringify({prompt, images, json:true, thinking, model:s.model || undefined})});
    } catch(e){ throw {code: e?.name === "AbortError" ? "cancelled" : "network"}; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw {code:d.error || "http", message:d.message || ""};
    return parseJSONLoose(d.text);
  } finally { clearInterval(tick); }
}
function aiErr(e){
  switch (e?.code){
    case "config": return "Falta conectar Gemini: completa la dirección del Worker y tu clave personal en Ajustes.";
    case "token": return "El Worker rechazó la clave personal. Revísala en Ajustes.";
    case "origin": return "El Worker no acepta esta dirección. Revisa ALLOWED_ORIGINS en Cloudflare.";
    case "rate_limited": return "Gemini llegó al límite gratis por ahora. Espera un rato o anota los datos a mano.";
    case "network": return "No hay conexión con el Worker. Revisa internet o la dirección en Ajustes.";
    case "parse": return "La respuesta de Gemini vino en un formato inesperado. Intenta de nuevo.";
    case "blocked": return "Gemini no procesó esa entrada. Prueba con otra foto o descripción.";
    case "too_large": return "Las fotos pesan demasiado. Prueba con menos fotos.";
    case "upstream": return "Gemini respondió con un error" + (e.message ? ": " + e.message : ".");
    default: return "No se pudo completar. Intenta de nuevo.";
  }
}
const ITEM_JSON = '{"nombre":"arroz blanco cocido","gramos":150,"kcal":195,"proteina":4,"carbos":42,"grasa":0.4,"fibra":0.6}';
const CTX = "Contexto: Chile y Latinoamérica. Usa tablas nutricionales estándar (USDA o tabla chilena) y porciones chilenas típicas (marraqueta ≈ 100 g, hallulla ≈ 90 g, taza ≈ 200 ml, cucharada ≈ 15 g).";
const P = {
  plate: (n, total, hint) => `Actúa como nutricionista deportivo. ${CTX}
${n > 1 ? "La primera foto es el plato completo. La segunda muestra lo que sobró (huesos, cáscaras, comida que no se comió): resta lo que sobró." : "La foto es un plato de comida."}
Identifica cada alimento visible por separado y estima su peso en gramos usando como referencia el plato, cubiertos y envases. Considera el método de cocción visible (frito, aceite, mayonesa, salsas).
${total ? `El peso total de la comida, sin el plato, es ${total} g: ajusta los gramos para que sumen eso.` : ""}
${hint ? `Indicación del usuario, tiene prioridad sobre lo que veas: ${hint}` : ""}
Responde solo JSON: {"items":[${ITEM_JSON}],"confianza":"alta|media|baja","nota":"una frase con los supuestos importantes"}
Si no hay comida en la imagen: {"items":[],"nota":"motivo"}`,
  text: t => `Actúa como nutricionista deportivo. ${CTX}
El usuario describe lo que comió: "${t.slice(0, 1500)}".
Separa cada alimento, estima gramos si no los indica y calcula calorías, macros y fibra.
Responde solo JSON: {"items":[${ITEM_JSON}],"confianza":"alta|media|baja","nota":"una frase con los supuestos importantes"}`,
  label: () => `La imagen es la tabla de información nutricional (o el envase) de un producto. Léela con cuidado.
Devuelve los valores por 100 g (o 100 ml). Si solo trae valores por porción, conviértelos a 100 g usando el tamaño de la porción.
Responde solo JSON: {"nombre":"nombre del producto si se ve, si no Producto","porcion_g":30,"por100":{"kcal":0,"proteina":0,"carbos":0,"grasa":0,"fibra":0},"nota":""}
Si no hay una tabla legible: {"error":"motivo breve"}`,
  complete: (rem, pending, freq) => `Actúa como nutricionista deportivo. ${CTX}
Le falta comer hoy aproximadamente: ${rem.kcal} kcal, ${rem.p} g proteína, ${rem.c} g carbohidratos, ${rem.f} g grasa.
Momentos de comida que aún no registra: ${pending.join(", ")}.
Estilo de alimentación: ${dietLabel()}. No come: ${DB.settings.avoid || "nada en especial"}.
Alimentos que suele comer (úsalos de preferencia): ${freq.join(", ") || "sin datos aún, usa comidas chilenas comunes"}.
Propón una comida por cada momento pendiente (máximo 3) que juntas cierren lo que falta con un margen de ±5 %. Prioriza llegar a la proteína.
Responde solo JSON: {"comidas":[{"momento":"${pending[0] || "cena"}","nombre":"nombre corto de la comida","items":[{"nombre":"...","gramos":0,"medida":"medida casera","kcal":0,"proteina":0,"carbos":0,"grasa":0,"fibra":0}]}],"nota":""}`,
  swap: (meal, freq) => `Actúa como nutricionista deportivo. ${CTX}
Reemplaza esta comida por otra distinta con calorías y macros parecidos (±5 %): ${meal.nombre} = ${rnd(meal.kcal)} kcal, ${rnd(meal.p)} g proteína, ${rnd(meal.c)} g carbos, ${rnd(meal.f)} g grasa. Momento: ${meal.momento}.
Estilo: ${dietLabel()}. No come: ${DB.settings.avoid || "nada en especial"}. Suele comer: ${freq.join(", ") || "comida chilena común"}.
Responde solo JSON: {"comida":{"momento":"${meal.momento}","nombre":"...","items":[{"nombre":"...","gramos":0,"medida":"...","kcal":0,"proteina":0,"carbos":0,"grasa":0,"fibra":0}]}}`,
  plan: (g, freq) => `Actúa como nutricionista deportivo. ${CTX}
Arma un menú de referencia de un día para estas metas: ${g.kcal} kcal, ${g.p} g proteína, ${g.c} g carbohidratos, ${g.f} g grasa (±5 %).
Momentos: desayuno, almuerzo, once y cena${g.kcal > 2300 ? ", más una colación" : ""}.
Estilo: ${dietLabel()}. No come: ${DB.settings.avoid || "nada en especial"}. Presupuesto medio. Alimentos que suele comer: ${freq.join(", ") || "comida chilena común"}.
Usa alimentos fáciles de encontrar en un supermercado chileno. ${DB.settings.diet === "singluten" ? "Todo sin gluten." : ""}
Responde solo JSON: {"comidas":[{"momento":"desayuno","nombre":"...","items":[{"nombre":"...","gramos":0,"medida":"medida casera","kcal":0,"proteina":0,"carbos":0,"grasa":0,"fibra":0}]}],"nota":""}`,
  bodyfat: (p, m) => `Estima el porcentaje de grasa corporal de una persona a partir de fotos de su cuerpo (frente y perfiles), con estos datos: sexo ${p.sex === "m" ? "mujer" : "hombre"}, edad ${p.age}, estatura ${p.height} cm, peso ${lastWeight()?.kg || p.weight} kg${m ? ", medidas: " + m : ""}.
Fíjate en definición abdominal, distribución de grasa y contorno de cintura. Da un valor central y un rango realista.
Responde solo JSON: {"grasa_pct":0,"rango":[0,0],"nota":"una frase con lo que observaste"}`
};
function dietLabel(){ return (DIETS.find(d => d[0] === DB.settings.diet) || DIETS[0])[1]; }
function frequentFoods(n = 18){
  const cnt = {};
  Object.entries(DB.days).filter(([d]) => d >= addDays(today(), -45)).forEach(([, dd]) => (dd.entries || []).forEach(e => { const k = (e.name || "").toLowerCase().trim(); if (k) cnt[k] = (cnt[k] || 0) + 1; }));
  return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, n).map(x => x[0]);
}
function toItems(arr){
  return (Array.isArray(arr) ? arr : []).map(it => { const g = num(it.gramos) || 100;
    return {name:String(it.nombre || "Alimento").slice(0, 80), measure:String(it.medida || "").slice(0, 40), g, k:num(it.kcal) / g, p:num(it.proteina) / g, c:num(it.carbos) / g, f:num(it.grasa) / g, fb:num(it.fibra) / g};
  }).filter(i => i.k > 0 || i.p > 0 || i.c > 0 || i.f > 0);
}
const itemTot = items => items.reduce((t, i) => ({kcal:t.kcal + i.k * i.g, p:t.p + i.p * i.g, c:t.c + i.c * i.g, f:t.f + i.f * i.g, fib:t.fib + i.fb * i.g}), {kcal:0, p:0, c:0, f:0, fib:0});
function itemToEntry(i, meal, src, t = Date.now()){ const e = {id:uid(), t, meal, name:i.name, g:i.noGrams ? 0 : rnd(i.g), kcal:rnd(i.k * i.g), p:r1(i.p * i.g), c:r1(i.c * i.g), f:r1(i.f * i.g), fib:r1(i.fb * i.g), src}; if (i.noGrams) e.q = r1(i.g); return e; }
function entryToItem(e){ const g = num(e.g) || num(e.q) || 1; return {name:e.name, g, k:num(e.kcal) / g, p:num(e.p) / g, c:num(e.c) / g, f:num(e.f) / g, fb:num(e.fib) / g, noGrams:!num(e.g)}; }

/* =================== estado de interfaz =================== */
const S = {
  view: DB.profile || DB.goals ? "hoy" : "onb", date: today(), sheet: null,
  add: {mode:"foto", meal:defaultMeal(), files:[], urls:[], hint:"", total:"", text:"", labelG:"", manual:{}, draft:null, err:"", busy:null, tab:"recientes", q:""},
  onb: {step:0, p:{sex:"h", goal:"bajar", job:"sentado", steps:"medio", trainings:"3", late:false}, manual:false},
  plan: {tab:"completar", busy:null, err:"", res:null, days:1},
  prog: {busy:null, err:"", files:[], urls:[], bf:null},
  pending:false
};
function defaultMeal(){ const h = new Date().getHours(); return h < 11 ? "desayuno" : h < 16 ? "almuerzo" : h < 20 ? "once" : "cena"; }

/* =================== vistas =================== */
const IC = {
  hoy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>',
  prog:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19l5-6 4 3 7-9"/><path d="M4 4v15h16"/></svg>',
  add:'<span class="dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" style="width:18px;height:18px"><path d="M12 5v14M5 12h14"/></svg></span>',
  plan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3l2.2 5.2L20 9l-4.3 3.8L17 18.5 12 15.6 7 18.5l1.3-5.7L4 9l5.8-.8z"/></svg>',
  ajustes:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
};
function renderTabs(){
  const nav = $(".tabs"); nav.hidden = S.view === "onb";
  const L = [["hoy","Hoy"],["prog","Progreso"],["add","Agregar"],["plan","Ideas IA"],["ajustes","Ajustes"]];
  $("#tabs").innerHTML = L.map(([k, l]) => `<button class="tab" data-a="tab" data-v="${k}" ${S.view === k ? 'aria-current="page"' : ""}>${IC[k]}<span>${l}</span></button>`).join("");
}
const macBar = (lbl, v, goal, col) => `<div class="mac"><div class="lbl"><span>${lbl}</span><span class="num"><b>${rnd(v)}</b> / ${rnd(goal)} g</span></div><div class="bar"><i style="width:${goal ? Math.min(100, v / goal * 100) : 0}%;background:var(${col})"></i></div></div>`;
function ring(pct, over, big, small){
  const C = 2 * Math.PI * 54;
  return `<div class="ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="none" stroke="var(--sunk)" stroke-width="11"/><circle cx="60" cy="60" r="54" fill="none" stroke="${over ? "var(--warn)" : "var(--accent)"}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - Math.min(1, Math.max(0, pct)))}"/></svg><div class="c"><div><div class="big num">${big}</div><div class="muted xs">${small}</div></div></div></div>`;
}
function banners(){
  const out = [], s = DB.settings;
  if (!s.workerUrl || !s.token) out.push(`<div class="banner">Para usar fotos e ideas con IA, conecta Gemini. <button class="btn sm" data-a="tab" data-v="ajustes">Conectar</button></div>`);
  if (DB.profile && DB.goals?.source === "calc") {
    const days = DB.profile.calcAt ? diffDays(DB.profile.calcAt, today()) : 0;
    if (days >= num(s.recalcEvery || 15)) out.push(`<div class="banner">Pasaron ${days} días desde tu último cálculo. Anota tu peso y recalcula tus macros. <button class="btn sm" data-a="sheet" data-v="peso">Anotar peso</button></div>`);
  }
  const st = stalled(); if (st) out.push(`<div class="banner err"><b>¿Estancado?</b> Tu peso casi no se movió en 3 semanas (${st}). Revisa que registres todo, incluidos aceites y bebidas, o recalcula tu meta.</div>`);
  return out.join("");
}
function stalled(){
  if (!DB.profile || !["bajar","definir","recomp"].includes(DB.profile.goal)) return "";
  const from = addDays(today(), -21), w = DB.weights.filter(x => x.date >= from).sort((a, b) => a.date < b.date ? -1 : 1);
  if (w.length < 3 || diffDays(w[0].date, w[w.length - 1].date) < 14) return "";
  const ch = w[w.length - 1].kg - w[0].kg;
  return Math.abs(ch) < 0.3 ? `${ch >= 0 ? "+" : ""}${r1(ch)} kg` : "";
}
function fastingCard(){
  const f = DB.settings.fasting; if (!f.on) return "";
  let last = 0; for (let i = 0; i < 3; i++) (DB.days[addDays(today(), -i)]?.entries || []).forEach(e => { if (e.t > last && e.t <= Date.now()) last = e.t; });
  const start = Math.max(last, f.manualStart || 0);
  if (!start) return `<section class="card"><div class="row between"><b>Ayuno intermitente</b><span class="muted small">Meta ${f.hours} h</span></div><p class="muted small">Tu ayuno se cuenta solo desde tu última comida registrada.</p></section>`;
  const h = (Date.now() - start) / 36e5, pct = Math.min(1, h / f.hours);
  return `<section class="card"><div class="row between"><b>Ayuno intermitente</b><span class="pill ${h >= f.hours ? "ok" : ""} num">${Math.floor(h)} h ${z(Math.floor((h % 1) * 60))} min</span></div>
    <div class="meter"><i style="width:${pct * 100}%"></i></div>
    <div class="row between xs muted"><span>Desde ${fmtHM(start)}${start === f.manualStart ? " (inicio manual)" : " (última comida)"}</span><span>${h >= f.hours ? "Meta cumplida" : "Faltan " + r1(f.hours - h) + " h"}</span></div>
    <div class="row"><button class="btn ghost sm" data-a="faststart">Empezar ayuno ahora</button></div></section>`;
}
function viewHoy(){
  const d = S.date, t = targetFor(d), dd = getDay(d), tot = totals(dd), rest = rnd(t.kcal - tot.kcal), over = rest < 0;
  const isToday = d === today(), s = DB.settings;
  const waterMl = num(dd?.water), wg = num(s.waterGoalMl) || 2000, gl = num(s.glassMl) || 250, nG = Math.max(Math.ceil(wg / gl), Math.ceil(waterMl / gl));
  const comp = DB.comps.find(c => c.from === d);
  let meals = "";
  const entries = dd?.entries || [];
  if (!entries.length) meals = `<section class="card empty"><h2>${isToday ? "Aún no registras comida hoy" : "Sin registros este día"}</h2><p class="muted">Saca una foto a tu plato, fotografía la tabla nutricional o escribe lo que comiste.</p><button class="btn" data-a="tab" data-v="add">Agregar comida</button></section>`;
  else meals = MEALS.map(([k, l]) => {
    const es = entries.filter(e => e.meal === k); if (!es.length) return "";
    const kc = es.reduce((a, e) => a + num(e.kcal), 0);
    const name = k === "extra" && dd.extraName ? dd.extraName : l;
    return `<section class="card" style="gap:0"><div class="meal-h"><h3>${esc(name)}</h3><span class="row" style="gap:8px"><span class="num muted small">${rnd(kc)} kcal</span>${!isToday ? `<button class="link small" data-a="copymeal" data-m="${k}">Copiar a hoy</button>` : ""}</span></div>
      ${es.map(e => `<button class="entry" data-a="entry" data-id="${e.id}"><div class="grow"><div class="n">${esc(e.name)}</div><div class="m num">${e.g ? rnd(e.g) + " g · " : ""}P ${r1(num(e.p))} · C ${r1(num(e.c))} · G ${r1(num(e.f))}</div></div><span class="kc num">${rnd(num(e.kcal))}</span></button>`).join("")}</section>`;
  }).join("");
  const supps = s.supps.length ? `<section class="card"><b>Suplementos</b><div class="checks">${s.supps.map(x => `<button class="chip" data-a="supp" data-id="${x.id}" aria-pressed="${!!dd?.supps?.[x.id]}">${dd?.supps?.[x.id] ? "✓ " : ""}${esc(x.name)}</button>`).join("")}</div></section>` : "";
  const acts = dd?.acts?.length ? dd.acts.map(a => `<div class="mrow"><span>${esc(a.name)}${a.min ? " · " + a.min + " min" : ""}${a.steps ? " · " + a.steps + " pasos" : ""}</span><span class="row"><b class="num">+${rnd(a.kcal)} kcal</b><button class="rm" data-a="delact" data-id="${a.id}">quitar</button></span></div>`).join("") : "";
  return `
  <header class="top"><div><div class="eyebrow">Macros de Julio</div><h1>${esc(fmtDay(d))}</h1></div>
    <div class="datenav"><button class="icon-btn" data-a="prev" aria-label="Día anterior">‹</button><button class="icon-btn" data-a="today" aria-label="Ir a hoy" ${isToday ? "disabled" : ""}>•</button><button class="icon-btn" data-a="next" aria-label="Día siguiente" ${d >= addDays(today(), 7) ? "disabled" : ""}>›</button></div></header>
  ${isToday ? banners() : ""}
  ${t.example ? `<div class="banner">Estas metas son genéricas. <button class="btn sm" data-a="onb">Calcular mi plan</button></div>` : ""}
  <section class="card"><div class="sum">
    ${ring(tot.kcal / (t.kcal || 1), over, Math.abs(rest), over ? "kcal de más" : "kcal restantes")}
    <div class="macros">
      <div class="row between small"><span class="muted">Consumido</span><span class="num"><b>${rnd(tot.kcal)}</b> / ${t.kcal} kcal</span></div>
      ${macBar("Proteína", tot.p, t.p, "--prot")}${macBar("Carbohidratos", tot.c, t.c, "--carb")}${macBar("Grasa", tot.f, t.f, "--fat")}
      <div class="lbl row between xs muted"><span>Fibra (aprox.)</span><span class="num">${rnd(tot.fib)} / ${t.fib} g</span></div>
    </div></div>
    ${t.notes.length ? `<div class="notes">${t.notes.map(n => `<span class="pill ${n[0]}">${esc(n[1])} kcal</span>`).join("")}</div>` : ""}
    ${over && rest < -100 && !comp && d <= today() ? `<div class="banner err">Te pasaste ${-rest} kcal. Un día no cambia nada, lo que cuenta es tu semana. <button class="btn sm" data-a="compensar">Compensar en los próximos días</button></div>` : ""}
    ${comp ? `<div class="banner">Compensando ${comp.excess} kcal: −${comp.perDay} kcal por ${comp.dates.length} días (hasta ${fmtShort(comp.dates[comp.dates.length - 1])}). <button class="link small" data-a="uncomp">Cancelar</button></div>` : ""}
  </section>
  ${s.showWater ? `<section class="card"><div class="row"><div class="grow"><div class="row between"><b>Agua</b><span class="muted num small">${r1(waterMl / 1000)} / ${r1(wg / 1000)} L</span></div><div class="glasses" style="margin-top:8px">${Array.from({length:nG}, (_, i) => `<i class="glass ${i < Math.round(waterMl / gl) ? "on" : ""}"></i>`).join("")}</div></div>
    <button class="icon-btn" data-a="wminus" aria-label="Quitar un vaso">−</button><button class="icon-btn" data-a="wplus" aria-label="Agregar un vaso de ${gl} ml">+</button></div></section>` : ""}
  ${isToday ? fastingCard() : ""}
  ${meals}
  <section class="card"><div class="row between"><b>Actividad extra</b><button class="btn ghost sm" data-a="sheet" data-v="act">+ Agregar</button></div>
    ${acts || `<p class="muted small">Tu gym, cardio y pasos de siempre ya están en tus calorías. Anota aquí solo lo que hiciste de más.</p>`}</section>
  ${supps}`;
}

/* ----- agregar ----- */
function viewDraft(){
  const A = S.add, d = A.draft, t = itemTot(d.items);
  const mealName = (MEALS.find(m => m[0] === A.meal) || MEALS[0])[1];
  return `<section class="label" aria-label="Resultado">
    <span class="eyebrow">${{foto:"Desde foto", etiqueta:"Desde etiqueta", texto:"Desde descripción", reciente:"Repetir", fav:"Favorito", plato:"Mis platos", manual:"Manual"}[d.src] || ""}${d.conf ? " · confianza " + esc(d.conf) : ""}</span>
    <h2>Información nutricional</h2>
    <div class="muted xs" style="padding:6px 0;border-bottom:1px solid var(--ink)">Ajusta los gramos si la estimación no calza.</div>
    ${d.items.map((i, ix) => `<div class="li"><div class="nm">${esc(i.name)}${i.measure ? ` <span class="sub">(${esc(i.measure)})</span>` : ""}<div class="sub num" id="sub${ix}">${rnd(i.k * i.g)} kcal · P ${r1(i.p * i.g)} · C ${r1(i.c * i.g)} · G ${r1(i.f * i.g)}</div>
      <span class="row" style="gap:12px">${d.items.length > 1 ? `<button class="rm" data-a="rmitem" data-ix="${ix}">quitar</button>` : ""}<button class="rm" data-a="favitem" data-ix="${ix}">★ favorito</button></span></div>
      <label class="gin" data-keep><input id="g${ix}" inputmode="decimal" value="${i.noGrams ? r1(i.g) : rnd(i.g)}" data-gi="${ix}" aria-label="Cantidad de ${esc(i.name)}"><span>${i.noGrams ? "porc." : "g"}</span></label></div>`).join("")}
    <div class="tot"><b style="font-size:16px">Calorías</b><span class="k num" id="tk">${rnd(t.kcal)}</span></div>
    <div class="mrow"><span>Proteína</span><b class="num" id="tp">${r1(t.p)} g</b></div>
    <div class="mrow"><span>Carbohidratos</span><b class="num" id="tc">${r1(t.c)} g</b></div>
    <div class="mrow"><span>Grasa</span><b class="num" id="tf">${r1(t.f)} g</b></div>
    <div class="mrow"><span>Fibra</span><b class="num" id="tfb">${r1(t.fib)} g</b></div>
    ${d.note ? `<p class="muted xs" style="margin-top:8px">${esc(d.note)}</p>` : ""}
  </section>
  <div class="row"><button class="btn ghost grow" data-a="discard">Descartar</button><button class="btn grow" data-a="savedraft">Guardar en ${esc(mealName)}</button></div>
  ${d.items.length > 1 || d.src === "foto" ? `<button class="btn soft block" data-a="sheet" data-v="dish">Guardar en Mis platos</button>` : ""}`;
}
function photoPicker(max, labels){
  const A = S.add;
  return `${A.urls.length ? `<div class="thumbs">${A.urls.map((u, i) => `<div class="thumb"><img src="${u}" alt="${labels[i] || "Foto"}"><span>${labels[i] || "Foto"}</span><button data-a="rmphoto" data-ix="${i}" aria-label="Quitar foto">×</button></div>`).join("")}</div>` : ""}
  ${A.urls.length < max ? `<div class="drop">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
    <b>${A.urls.length === 0 ? (A.mode === "foto" ? "Toma o elige una foto de tu plato" : "Fotografía la tabla nutricional") : labels[A.urls.length] ? "Agregar: " + labels[A.urls.length] + " (opcional)" : "Agregar otra foto"}</b>
    <span class="muted small">${A.urls.length === 0 ? (A.mode === "foto" ? "Desde arriba, con todo el plato a la vista y buena luz." : "Que se lean bien los números, sin reflejos.") : "Saca una segunda foto con lo que sobró (huesos, cáscaras) y la IA lo resta."}</span>
    <div class="row wrapr" style="justify-content:center"><label class="btn sm filebtn">Tomar foto<input type="file" id="pick" accept="image/*" capture="environment"></label><label class="btn ghost sm filebtn">Elegir de la galería<input type="file" id="pickgal" accept="image/*"></label></div></div>` : ""}`;
}
function viewAdd(){
  const A = S.add;
  const modes = [["foto","Plato"],["etiqueta","Etiqueta"],["texto","Escribir"],["buscar","Guardados"],["manual","Manual"]];
  let body = "";
  if (A.busy) body = `<section class="card thinking"><span class="spin" aria-hidden="true"></span><div class="grow"><b>${A.busy === "etiqueta" ? "Leyendo la tabla…" : "Calculando calorías y macros…"}</b><div class="muted small num"><span data-elapsed>0</span> s · suele tardar menos de 15 s</div></div><button class="btn ghost sm" data-a="stop">Cancelar</button></section>`;
  else if (A.draft) body = viewDraft();
  else if (A.mode === "foto") body = `${photoPicker(2, ["Plato", "Lo que sobró"])}
    <div class="g2"><label class="f" data-keep>Peso total en gramos (opcional)<input class="in" id="ptotal" inputmode="decimal" placeholder="Sin el plato" value="${esc(A.total)}"></label><div></div></div>
    <label class="f" data-keep>Detalle opcional<textarea class="in" id="phint" placeholder="Ej: la carne es vacuno magro, el arroz tiene aceite, comí la mitad">${esc(A.hint)}</textarea></label>
    <button class="btn block" data-a="ai" ${A.files.length ? "" : "disabled"}>Calcular</button>`;
  else if (A.mode === "etiqueta") body = `${photoPicker(1, ["Etiqueta"])}
    <label class="f" data-keep>¿Cuántos gramos comiste? (vacío = 1 porción)<input class="in" id="lgrams" inputmode="decimal" placeholder="Ej: 45" value="${esc(A.labelG)}"></label>
    <button class="btn block" data-a="ai" ${A.files.length ? "" : "disabled"}>Leer etiqueta</button>
    <button class="link small" data-a="mode" data-v="manual">Prefiero escribir los datos de la etiqueta a mano</button>`;
  else if (A.mode === "texto") body = `<label class="f" data-keep>¿Qué comiste?<textarea class="in" id="ptext" rows="4" placeholder="Ej: 2 marraquetas con palta y jamón de pavo, café con leche descremada">${esc(A.text)}</textarea></label>
    <button class="btn block" data-a="ai">Calcular</button>`;
  else if (A.mode === "buscar") {
    const q = A.q.toLowerCase().trim(), match = n => !q || n.toLowerCase().includes(q);
    let list = "";
    if (A.tab === "recientes") { const r = recents().filter(e => match(e.name)); list = r.length ? r.map((e, i) => `<button class="listbtn" data-a="pickrecent" data-id="${e.id}"><span class="grow"><b style="font-weight:600">${esc(e.name)}</b><br><span class="muted xs num">${e.g ? rnd(e.g) + " g · " : ""}P ${r1(num(e.p))} · C ${r1(num(e.c))} · G ${r1(num(e.f))}</span></span><span class="kc num" style="font-size:18px">${rnd(num(e.kcal))}</span></button>`).join("") : `<p class="muted small">Lo que registres va a aparecer aquí, para repetirlo con un toque.</p>`; }
    else if (A.tab === "favoritos") { const r = DB.favs.filter(f => match(f.name)); list = r.length ? r.map(f => `<div class="listbtn"><button class="grow" style="background:none;border:0;text-align:left;padding:0" data-a="pickfav" data-id="${f.id}"><b style="font-weight:600">${esc(f.name)}</b><br><span class="muted xs num">${f.g ? rnd(f.g) + " g · " : ""}${rnd(f.kcal)} kcal · P ${r1(f.p)} · C ${r1(f.c)} · G ${r1(f.f)}</span></button><button class="rm" data-a="unfav" data-id="${f.id}">quitar</button></div>`).join("") : `<p class="muted small">Todavía no tienes favoritos. Toca «★ favorito» en un alimento para guardarlo aquí.</p>`; }
    else { const r = DB.dishes.filter(f => match(f.name)); list = r.length ? r.map(f => `<div class="listbtn"><button class="grow" style="background:none;border:0;text-align:left;padding:0" data-a="pickdish" data-id="${f.id}"><b style="font-weight:600">${esc(f.name)}</b><br><span class="muted xs num">${f.servings} porc. · ${rnd(f.kcal / f.servings)} kcal por porción</span></button><button class="rm" data-a="deldish" data-id="${f.id}">borrar</button></div>`).join("") : `<p class="muted small">Cuando registres una comida con varios ingredientes, toca «Guardar en Mis platos» para reutilizarla.</p>`; }
    body = `<div class="seg" role="group">${[["recientes","Recientes"],["favoritos","Favoritos"],["platos","Mis platos"]].map(([k, l]) => `<button data-a="addtab" data-v="${k}" aria-pressed="${A.tab === k}">${l}</button>`).join("")}</div>
      <label class="f" data-keep><span class="eyebrow">Buscar</span><input class="in" id="aq" value="${esc(A.q)}" placeholder="Nombre del alimento"></label>
      <section class="card" style="gap:0">${list}</section>`;
  } else { const m = A.manual;
    body = `<section class="card" data-keep>
      <label class="f">Nombre<input class="in" id="mname" value="${esc(m.name || "")}" placeholder="Ej: Yogur protein"></label>
      <div class="g2"><label class="f">Gramos comidos (opcional)<input class="in" id="mg" inputmode="decimal" value="${esc(m.g || "")}"></label><label class="f">kcal<input class="in" id="mkcal" inputmode="decimal" value="${esc(m.kcal || "")}"></label></div>
      <div class="g4"><label class="f">Prot. g<input class="in" id="mp" inputmode="decimal" value="${esc(m.p || "")}"></label><label class="f">Carb. g<input class="in" id="mc" inputmode="decimal" value="${esc(m.c || "")}"></label><label class="f">Grasa g<input class="in" id="mf" inputmode="decimal" value="${esc(m.f || "")}"></label><label class="f">Fibra g<input class="in" id="mfb" inputmode="decimal" value="${esc(m.fib || "")}"></label></div>
      <p class="muted xs">Si copias de una etiqueta, pon los valores de lo que comiste (no por 100 g).</p>
      <button class="btn block" data-a="savemanual">Revisar y guardar</button></section>`; }
  return `<header class="top"><div><div class="eyebrow">${esc(fmtDay(S.date))}</div><h1>Agregar comida</h1></div></header>
  <div class="chips" role="group" aria-label="Comida">${MEALS.map(([k, l]) => `<button class="chip" data-a="meal" data-v="${k}" aria-pressed="${A.meal === k}">${l}</button>`).join("")}</div>
  ${A.meal === "extra" ? `<label class="f" data-keep>Nombre de la comida extra<input class="in" id="extraname" placeholder="Pre entreno, colación…" value="${esc(ensureDayPeek(S.date).extraName || "")}"></label>` : ""}
  ${A.busy || A.draft ? "" : `<div class="seg" role="group" aria-label="Forma de registrar">${modes.map(([k, l]) => `<button data-a="mode" data-v="${k}" aria-pressed="${A.mode === k}">${l}</button>`).join("")}</div>`}
  ${A.err ? `<div class="banner err">${esc(A.err)}</div>` : ""}
  ${body}`;
}
function ensureDayPeek(d){ return DB.days[d] || {}; }
function recents(){
  const all = [], from = addDays(today(), -60);
  Object.entries(DB.days).forEach(([d, dd]) => { if (d >= from) (dd.entries || []).forEach(e => all.push(e)); });
  all.sort((a, b) => (b.t || 0) - (a.t || 0));
  const seen = new Set(), out = [];
  for (const e of all) { const k = (e.name || "").toLowerCase().trim(); if (!k || seen.has(k)) continue; seen.add(k); out.push(e); if (out.length >= 25) break; }
  return out;
}
function findEntry(id){ for (const [d, dd] of Object.entries(DB.days)) { const e = (dd.entries || []).find(x => x.id === id); if (e) return {d, e}; } return null; }
async function runAddAI(){
  const A = S.add; if (A.busy) return;
  A.err = ""; A.draft = null;
  let prompt, files = [];
  if (A.mode === "foto") { if (!A.files.length) return; prompt = P.plate(A.files.length, num(A.total), A.hint.trim()); files = A.files; }
  else if (A.mode === "etiqueta") { if (!A.files.length) return; prompt = P.label(); files = A.files.slice(0, 1); }
  else { if (!A.text.trim()) { A.err = "Escribe lo que comiste."; render(); return; } prompt = P.text(A.text.trim()); }
  A.busy = A.mode; render();
  try {
    const res = await ai(prompt, files);
    if (A.mode === "etiqueta") {
      if (res?.error) A.err = "No se leyó la tabla: " + String(res.error).slice(0, 160) + ". Prueba con una foto más cerca o escribe los datos a mano.";
      else { const per = res?.por100 || {}, g = num(A.labelG) || num(res?.porcion_g) || 100;
        A.draft = {src:"etiqueta", note:String(res?.nota || "").slice(0, 240), items:[{name:String(res?.nombre || "Producto").slice(0, 80), g, k:num(per.kcal) / 100, p:num(per.proteina) / 100, c:num(per.carbos) / 100, f:num(per.grasa) / 100, fb:num(per.fibra) / 100}]}; }
    } else {
      const items = toItems(res?.items);
      if (!items.length) A.err = res?.nota ? "No se reconoció comida: " + String(res.nota).slice(0, 160) : "No se reconoció comida en la entrada.";
      else A.draft = {src:A.mode === "foto" ? "foto" : "texto", items, note:String(res?.nota || "").slice(0, 240), conf:String(res?.confianza || "")};
    }
  } catch(e){ if (e?.code !== "cancelled") A.err = aiErr(e); }
  finally { A.busy = null; ctl = null; render(); }
}
function resetAdd(){ const A = S.add; A.urls.forEach(u => URL.revokeObjectURL(u)); Object.assign(A, {files:[], urls:[], hint:"", total:"", text:"", labelG:"", manual:{}, draft:null, err:""}); }

/* ----- progreso ----- */
function weekStats(start){
  const ds = []; for (let i = 0; i < 7; i++) ds.push(addDays(start, i));
  const logged = ds.filter(d => d <= today() && hasEntries(d));
  const avg = k => logged.length ? logged.reduce((a, d) => a + totals(DB.days[d])[k], 0) / logged.length : 0;
  const tg = logged.length ? logged.reduce((a, d) => { const t = targetFor(d); return {kcal:a.kcal + t.kcal, p:a.p + t.p, c:a.c + t.c, f:a.f + t.f}; }, {kcal:0, p:0, c:0, f:0}) : null;
  return {ds, logged, avg:{kcal:avg("kcal"), p:avg("p"), c:avg("c"), f:avg("f")}, tgt:tg ? {kcal:tg.kcal / logged.length, p:tg.p / logged.length, c:tg.c / logged.length, f:tg.f / logged.length} : targetFor(today())};
}
function weekChart(ds){
  const W = 320, H = 170, top = 24, bot = 26, ch = H - top - bot;
  const vals = ds.map(d => totals(DB.days[d]).kcal), tg = ds.map(d => targetFor(d).kcal);
  const max = Math.max(...tg.map(x => x * 1.25), ...vals, 100), y = v => top + ch - (v / max) * ch, bw = 28, gap = (W - 20 - 7 * bw) / 6;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calorías por día de la semana">${ds.map((d, i) => { const x = 10 + i * (bw + gap), v = vals[i], ov = v > tg[i] * 1.05;
    const lbl = new Intl.DateTimeFormat("es-CL", {weekday:"narrow"}).format(parseD(d)).toUpperCase();
    return `<rect x="${x}" y="${y(v)}" width="${bw}" height="${Math.max(0, ch - (y(v) - top))}" rx="5" fill="${v ? (ov ? "var(--warn)" : "var(--accent)") : "var(--sunk)"}"/>
      <line x1="${x - 3}" x2="${x + bw + 3}" y1="${y(tg[i])}" y2="${y(tg[i])}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="3 2"/>
      ${v ? `<text x="${x + bw / 2}" y="${y(Math.max(v, tg[i])) - 5}" text-anchor="middle" font-size="10" fill="var(--muted)">${rnd(v)}</text>` : ""}
      <text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="11" font-weight="700" fill="${d === today() ? "var(--ink)" : "var(--muted)"}">${lbl}</text>`; }).join("")}</svg>`;
}
function weightChart(){
  const w = [...DB.weights].sort((a, b) => a.date < b.date ? -1 : 1).slice(-16);
  if (w.length < 2) return `<p class="muted small">Anota tu peso una vez por semana (en ayunas, después del baño) y aquí verás la línea.</p>`;
  const W = 320, H = 170, L = 34, R = 34, T = 14, B = 26, iw = W - L - R, ih = H - T - B;
  const kg = w.map(x => x.kg), mn = Math.floor(Math.min(...kg) - 1), mx = Math.ceil(Math.max(...kg) + 1);
  const bfs = w.filter(x => num(x.bf)); const bmn = bfs.length ? Math.floor(Math.min(...bfs.map(x => x.bf)) - 2) : 0, bmx = bfs.length ? Math.ceil(Math.max(...bfs.map(x => x.bf)) + 2) : 1;
  const X = i => L + (w.length === 1 ? iw / 2 : i * iw / (w.length - 1)), Y = v => T + ih - (v - mn) / (mx - mn) * ih, YB = v => T + ih - (v - bmn) / (bmx - bmn) * ih;
  const path = w.map((x, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(x.kg).toFixed(1)).join(" ");
  const bpath = w.map((x, i) => [i, x]).filter(([, x]) => num(x.bf)).map(([i, x], j) => (j ? "L" : "M") + X(i).toFixed(1) + " " + YB(x.bf).toFixed(1)).join(" ");
  const ticks = [mn, (mn + mx) / 2, mx];
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Peso en el tiempo">
    ${ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--line)"/><text x="${L - 6}" y="${Y(t) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${r1(t)}</text>`).join("")}
    ${bfs.length > 1 ? `<path d="${bpath}" fill="none" stroke="var(--water)" stroke-width="2" stroke-dasharray="4 3"/>${[bmn, bmx].map(t => `<text x="${W - R + 6}" y="${YB(t) + 4}" font-size="10" fill="var(--water)">${t}%</text>`).join("")}` : ""}
    <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
    ${w.map((x, i) => `<circle cx="${X(i)}" cy="${Y(x.kg)}" r="${i === w.length - 1 ? 4.5 : 3}" fill="var(--accent)"/>`).join("")}
    <text x="${X(w.length - 1)}" y="${Y(kg[kg.length - 1]) - 9}" text-anchor="end" font-size="11" font-weight="700" fill="var(--ink)">${r1(kg[kg.length - 1])} kg</text>
    <text x="${L}" y="${H - 6}" font-size="10" fill="var(--muted)">${fmtShort(w[0].date)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end" font-size="10" fill="var(--muted)">${fmtShort(w[w.length - 1].date)}</text></svg>`;
}
function navyBF(m){
  const p = DB.profile; if (!p) return null;
  const h = num(p.height), wa = num(m.cintura), ne = num(m.cuello), hi = num(m.cadera);
  if (!h || !wa || !ne) return null;
  if (p.sex === "m") { if (!hi) return null; return r1(495 / (1.29579 - 0.35004 * Math.log10(wa + hi - ne) + 0.22100 * Math.log10(h)) - 450); }
  return r1(495 / (1.0324 - 0.19077 * Math.log10(wa - ne) + 0.15456 * Math.log10(h)) - 450);
}
function monthSummary(){
  const t = today(), first = t.slice(0, 8) + "01", ds = []; for (let d = first; d <= t; d = addDays(d, 1)) ds.push(d);
  const logged = ds.filter(hasEntries), within = logged.filter(d => { const k = totals(DB.days[d]).kcal, g = targetFor(d).kcal; return Math.abs(k - g) <= g * 0.1; });
  let streak = 0, best = 0, cur = 0; ds.forEach(d => { if (hasEntries(d)) { cur++; best = Math.max(best, cur); } else cur = 0; });
  for (let d = hasEntries(t) ? t : addDays(t, -1); hasEntries(d); d = addDays(d, -1)) streak++;
  const avgP = logged.length ? logged.reduce((a, d) => a + totals(DB.days[d]).p, 0) / logged.length : 0;
  return {days:ds.length, logged:logged.length, within:within.length, best, streak, avgP};
}
function viewProg(){
  const st = weekStats(mondayOf(today())), a = st.avg, g = st.tgt, ms = monthSummary();
  const ms0 = [...DB.measures].sort((x, y) => x.date < y.date ? -1 : 1), mFirst = ms0[0], mLast = ms0[ms0.length - 1];
  const lw = lastWeight(), fw = [...DB.weights].sort((x, y) => x.date < y.date ? -1 : 1)[0];
  const nb = mLast ? navyBF(mLast) : null;
  const PR = S.prog;
  return `<header class="top"><div><div class="eyebrow">Tu avance</div><h1>Progreso</h1></div></header>
  <section class="card"><div class="row between"><span class="eyebrow">Promedios de esta semana</span><span class="muted small">${st.logged.length} de ${diffDays(mondayOf(today()), today()) + 1} días</span></div>
    ${st.logged.length ? `<div class="chart">${weekChart(st.ds)}</div>
      <table class="table num"><tr><th></th><th class="r">Promedio</th><th class="r">Meta</th></tr>
      <tr><td>Calorías</td><td class="r"><b>${rnd(a.kcal)}</b></td><td class="r">${rnd(g.kcal)}</td></tr>
      <tr><td>Proteínas</td><td class="r"><b>${rnd(a.p)} g</b></td><td class="r">${rnd(g.p)} g</td></tr>
      <tr><td>Carbohidratos</td><td class="r"><b>${rnd(a.c)} g</b></td><td class="r">${rnd(g.c)} g</td></tr>
      <tr><td>Grasas</td><td class="r"><b>${rnd(a.f)} g</b></td><td class="r">${rnd(g.f)} g</td></tr></table>
      <p class="muted xs">Los promedios consideran solo los días con registros. La línea punteada es la meta de cada día.</p>`
      : `<p class="muted small">Todavía no registras comidas esta semana. Anota lo que comes y aquí verás tu promedio de calorías, proteínas, grasas y carbos.</p>`}
  </section>
  <section class="card"><div class="row between"><span class="eyebrow">Peso y % de grasa</span><button class="btn sm" data-a="sheet" data-v="peso">+ Anotar peso</button></div>
    ${lw ? `<div class="stats"><div class="stat"><div class="v num">${r1(lw.kg)}</div><div class="l">kg actual</div></div><div class="stat"><div class="v num">${fw && fw !== lw ? (lw.kg - fw.kg > 0 ? "+" : "") + r1(lw.kg - fw.kg) : "—"}</div><div class="l">kg desde el inicio</div></div><div class="stat"><div class="v num">${num(lw.bf) ? r1(lw.bf) + "%" : nb ? nb + "%" : "—"}</div><div class="l">% grasa ${num(lw.bf) ? "anotado" : nb ? "(medidas)" : ""}</div></div></div>` : ""}
    <div class="chart">${weightChart()}</div>
    <p class="muted xs">Si tu báscula o un InBody te da el % de grasa, anótalo junto a tu peso y aparece en celeste.</p></section>
  <section class="card"><div class="row between"><span class="eyebrow">Tus medidas</span><button class="btn ghost sm" data-a="sheet" data-v="medidas">+ Anotar medidas</button></div>
    ${mLast ? `<table class="table num"><tr><th></th><th class="r">${fmtShort(mLast.date)}</th><th class="r">Desde el inicio</th></tr>${MEASURES.filter(([k]) => num(mLast[k])).map(([k, l]) => { const d0 = mFirst && num(mFirst[k]) ? mLast[k] - mFirst[k] : 0; return `<tr><td>${l}</td><td class="r"><b>${r1(mLast[k])} cm</b></td><td class="r">${mFirst !== mLast && num(mFirst?.[k]) ? (d0 > 0 ? "+" : "") + r1(d0) + " cm" : "—"}</td></tr>`; }).join("")}</table>
      ${nb ? `<p class="muted xs">% de grasa estimado con tus medidas (fórmula de la Marina de EE. UU.): <b>${nb} %</b>. ${DB.profile?.sex === "m" ? "" : ""}</p>` : `<p class="muted xs">Con cintura, cuello${DB.profile?.sex === "m" ? " y cadera" : ""} se estima tu % de grasa sin fotos.</p>`}`
      : `<p class="muted small">Anota tu cintura, cadera y más para ver tu avance también fuera de la pesa. Mídete una vez al mes, en la mañana y con la misma cinta.</p>`}</section>
  <section class="card"><span class="eyebrow">% de grasa con fotos (IA)</span>
    <p class="small">Sube 3 fotos: de frente y de ambos lados, con luz pareja. Gemini estima tu % de grasa con tus fotos, peso y estatura.</p>
    <p class="banner err xs">Ojo: en el plan gratis de Gemini, Google puede usar lo que envías para mejorar sus productos. Si prefieres no enviar fotos de tu cuerpo, usa la estimación con medidas.</p>
    ${PR.urls.length ? `<div class="thumbs">${PR.urls.map((u, i) => `<div class="thumb"><img src="${u}" alt="Foto ${i + 1}"><span>${["Frente", "Lado izq.", "Lado der."][i]}</span><button data-a="rmbf" data-ix="${i}" aria-label="Quitar foto">×</button></div>`).join("")}</div>` : ""}
    ${PR.urls.length < 3 ? `<label class="btn ghost filebtn">Agregar foto ${PR.urls.length + 1} de 3<input type="file" id="bfpick" accept="image/*"></label>` : ""}
    ${PR.busy ? `<div class="thinking"><span class="spin"></span><span>Analizando tus fotos… <span class="num" data-elapsed>0</span> s</span></div>` : `<button class="btn" data-a="bfrun" ${PR.urls.length ? "" : "disabled"}>Estimar mi % de grasa</button>`}
    ${PR.err ? `<div class="banner err">${esc(PR.err)}</div>` : ""}
    ${PR.bf ? `<div class="label" style="border-width:1px"><div class="tot" style="border-top:0;margin:0;padding:0"><b>% de grasa estimado</b><span class="k num">${r1(PR.bf.v)} %</span></div><p class="muted xs">Rango ${PR.bf.r[0]}–${PR.bf.r[1]} %. ${esc(PR.bf.note)}</p><button class="btn sm" data-a="bfsave">Guardar junto a mi peso de hoy</button></div>` : ""}
  </section>
  <section class="card"><span class="eyebrow">Tu mes</span>
    <div class="stats"><div class="stat"><div class="v num">${ms.logged}/${ms.days}</div><div class="l">días registrados</div></div><div class="stat"><div class="v num">${ms.streak}</div><div class="l">racha actual (mejor ${ms.best})</div></div><div class="stat"><div class="v num">${ms.within}</div><div class="l">días a ±10 % de tu meta</div></div></div>
    <p class="muted xs">Proteína promedio del mes: ${rnd(ms.avgP)} g.</p></section>`;
}

/* ----- ideas IA ----- */
function remainingToday(){ const d = today(), t = targetFor(d), tot = totals(DB.days[d]); return {kcal:rnd(t.kcal - tot.kcal), p:rnd(Math.max(0, t.p - tot.p)), c:rnd(Math.max(0, t.c - tot.c)), f:rnd(Math.max(0, t.f - tot.f))}; }
function pendingMeals(){
  const dd = DB.days[today()], had = new Set((dd?.entries || []).map(e => e.meal)), h = new Date().getHours();
  const order = [["desayuno", 11], ["almuerzo", 16], ["once", 20], ["cena", 24]];
  return order.filter(([m, until]) => !had.has(m) && h < until).map(x => x[0]);
}
function mealsFromAI(arr){ return (Array.isArray(arr) ? arr : []).map(m => { const items = toItems(m.items), t = itemTot(items); return {momento:String(m.momento || "cena").toLowerCase(), nombre:String(m.nombre || "Comida").slice(0, 80), items, kcal:t.kcal, p:t.p, c:t.c, f:t.f, added:false}; }).filter(m => m.items.length); }
function mealKey(m){ const k = (MEALS.find(x => x[0] === m || x[1].toLowerCase() === m) || [])[0]; return k || (m.startsWith("col") ? "colacion" : "extra"); }
function viewPlan(){
  const PL = S.plan, rem = remainingToday(), pend = pendingMeals();
  let body = "";
  if (PL.busy) body = `<section class="card thinking"><span class="spin"></span><div class="grow"><b>${PL.busy === "plan" ? "Armando tu menú…" : PL.busy === "swap" ? "Calculando otra opción…" : "Calculando lo que te falta…"}</b><div class="muted small num"><span data-elapsed>0</span> s · suele tardar menos de 30 s</div></div><button class="btn ghost sm" data-a="stop">Cancelar</button></section>`;
  else if (PL.res) {
    const all = PL.res.meals, tot = all.reduce((a, m) => ({kcal:a.kcal + m.kcal, p:a.p + m.p, c:a.c + m.c, f:a.f + m.f}), {kcal:0, p:0, c:0, f:0});
    body = `${all.map((m, i) => `<section class="card"><div class="row between"><span class="eyebrow">${esc((MEALS.find(x => x[0] === mealKey(m.momento)) || [0, m.momento])[1])}</span><span class="num muted small">${rnd(m.kcal)} kcal</span></div><h3>${esc(m.nombre)}</h3>
      ${m.items.map(it => `<div class="mrow"><span>${esc(it.name)}${it.measure ? ` <span class="muted">(${esc(it.measure)})</span>` : ""}</span><span class="num muted">${rnd(it.g)} g</span></div>`).join("")}
      <div class="xs muted num">P ${rnd(m.p)} · C ${rnd(m.c)} · G ${rnd(m.f)}</div>
      <div class="row">${PL.res.kind === "completar" ? (m.added ? `<span class="pill ok">Agregado ✓</span>` : `<button class="btn sm" data-a="planadd" data-ix="${i}">Agregar a mi día</button>`) : ""}<button class="btn ghost sm" data-a="planswap" data-ix="${i}">Cambiar</button></div></section>`).join("")}
      <section class="card"><div class="row between"><b>Total</b><span class="num"><b>${rnd(tot.kcal)}</b> kcal · P ${rnd(tot.p)} · C ${rnd(tot.c)} · G ${rnd(tot.f)}</span></div>
      ${PL.res.kind === "completar" ? `<p class="muted small">Con esto cierras el día en ~${rnd(totals(DB.days[today()]).kcal + all.filter(m => !m.added).reduce((a, m) => a + m.kcal, 0))} kcal.</p><button class="btn block" data-a="planaddall" ${all.every(m => m.added) ? "disabled" : ""}>${all.every(m => m.added) ? "Todo agregado ✓" : "Agregar todo al día"}</button>` : ""}
      ${PL.res.note ? `<p class="muted xs">${esc(PL.res.note)}</p>` : ""}</section>
      ${PL.res.kind === "plan" ? shoppingList(all) : ""}
      <button class="btn ghost block" data-a="planreset">Volver</button>`;
  } else if (PL.tab === "completar") {
    body = `<section class="card"><span class="eyebrow">Para cerrar hoy te faltan</span>
      <div class="stats"><div class="stat"><div class="v num">${Math.max(0, rem.kcal)}</div><div class="l">kcal</div></div><div class="stat"><div class="v num">${rem.p} g</div><div class="l">proteína</div></div><div class="stat"><div class="v num">${rem.c} / ${rem.f}</div><div class="l">carbos / grasa (g)</div></div></div>
      ${rem.kcal < 150 ? `<div class="banner">Ya casi cumples tu meta de hoy.</div>` : `<p class="small">Gemini arma ${pend.length ? `tu ${pend.join(", ")}` : "una comida más"} con lo que sueles comer${frequentFoods().length < 5 ? " (aún hay pocos registros tuyos, así que serán ideas generales)" : ""}.</p>
      <button class="btn block" data-a="plancomplete">Completa mi día</button>`}</section>`;
  } else {
    const g = targetFor(today());
    body = `<section class="card"><span class="eyebrow">Plan de referencia</span><p class="small">Un menú de ejemplo de un día para tus macros (${g.kcal} kcal, P ${g.p} · C ${g.c} · G ${g.f}), con lista de compras.</p>
      <div class="f">Estilo<div class="chips">${DIETS.map(([k, l]) => `<button class="chip" data-a="diet" data-v="${k}" aria-pressed="${DB.settings.diet === k}">${l}</button>`).join("")}</div></div>
      <label class="f" data-keep>Lo que no comes<input class="in" id="avoid" value="${esc(DB.settings.avoid)}" placeholder="Ej: pescado, champiñones"></label>
      ${DB.settings.diet === "singluten" ? `<p class="muted xs">Si eres celíaco, revisa siempre la etiqueta: no se puede garantizar ausencia de trazas.</p>` : ""}
      <button class="btn block" data-a="planmake">Armar mi menú</button></section>`;
  }
  return `<header class="top"><div><div class="eyebrow">Con Gemini</div><h1>Ideas IA</h1></div></header>
  ${PL.busy || PL.res ? "" : `<div class="seg" role="group">${[["completar","Completa mi día"],["plan","Plan de referencia"]].map(([k, l]) => `<button data-a="plantab" data-v="${k}" aria-pressed="${PL.tab === k}">${l}</button>`).join("")}</div>`}
  ${PL.err ? `<div class="banner err">${esc(PL.err)}</div>` : ""}
  ${body}`;
}
function shoppingList(meals){
  const n = S.plan.days, agg = {};
  meals.forEach(m => m.items.forEach(i => { const k = i.name.toLowerCase(); agg[k] = agg[k] || {name:i.name, g:0}; agg[k].g += i.g * n; }));
  const rows = Object.values(agg).sort((a, b) => a.name.localeCompare(b.name, "es"));
  return `<section class="card"><div class="row between"><b>Lista de compras</b><div class="seg" role="group" style="width:auto">${[1, 3, 7].map(d => `<button data-a="shopdays" data-v="${d}" aria-pressed="${n === d}" style="padding:6px 10px">${d} día${d > 1 ? "s" : ""}</button>`).join("")}</div></div>
    ${rows.map(r => `<div class="mrow"><span>${esc(r.name)}</span><span class="num">${r.g >= 1000 ? r1(r.g / 1000) + " kg" : rnd(r.g) + " g"}</span></div>`).join("")}
    <button class="btn ghost sm" data-a="copyshop">Copiar lista</button></section>`;
}
async function runPlan(kind, ix){
  const PL = S.plan; if (PL.busy) return; PL.err = "";
  const freq = frequentFoods();
  try {
    if (kind === "swap") {
      PL.busy = "swap"; render();
      const m = PL.res.meals[ix], res = await ai(P.swap(m, freq), [], "low"), nm = mealsFromAI([res?.comida || res])[0];
      if (!nm) throw {code:"parse"};
      PL.res.meals[ix] = nm; toast("Listo, cambié tu " + ((MEALS.find(x => x[0] === mealKey(nm.momento)) || [0, "comida"])[1]).toLowerCase());
    } else if (kind === "complete") {
      PL.busy = "complete"; render();
      const pend = pendingMeals();
      const res = await ai(P.complete(remainingToday(), pend.length ? pend : ["colación"], freq), [], "low"), meals = mealsFromAI(res?.comidas);
      if (!meals.length) throw {code:"parse"};
      PL.res = {kind:"completar", meals, note:String(res?.nota || "")};
    } else {
      PL.busy = "plan"; render();
      const res = await ai(P.plan(targetFor(today()), freq), [], "low"), meals = mealsFromAI(res?.comidas);
      if (!meals.length) throw {code:"parse"};
      PL.res = {kind:"plan", meals, note:String(res?.nota || "")};
    }
  } catch(e){ if (e?.code !== "cancelled") PL.err = aiErr(e); }
  finally { PL.busy = null; ctl = null; render(); }
}
function addPlanMeal(m){
  const dd = ensureDay(today()), k = mealKey(m.momento), t0 = Date.now();
  m.items.forEach((i, j) => dd.entries.push(itemToEntry(i, k, "ideas", t0 + j)));
  m.added = true; save();
}

/* ----- ajustes ----- */
function viewAjustes(){
  const s = DB.settings, p = DB.profile, g = baseGoals();
  const days = ["D","L","M","M","J","V","S"];
  return `<header class="top"><div><div class="eyebrow">Configuración</div><h1>Ajustes</h1></div></header>
  <section class="card"><span class="eyebrow">Tu plan</span>
    <div class="row between"><div><b class="num">${g.kcal} kcal</b><div class="muted small num">P ${g.p} · C ${g.c} · G ${g.f} g</div></div><span class="pill">${DB.goals?.source === "manual" ? "Metas escritas por ti" : p ? GOALS[p.goal]?.l || "" : "Genérico"}</span></div>
    <div class="row wrapr"><button class="btn sm" data-a="onb">Recalcular mi plan</button><button class="btn ghost sm" data-a="onbmanual">Escribir mis metas</button></div>
    ${p ? `<p class="muted xs">Perfil: ${p.sex === "m" ? "mujer" : "hombre"}, ${p.age} años, ${p.height} cm, ${lastWeight()?.kg || p.weight} kg. Último cálculo: ${p.calcAt ? fmtShort(p.calcAt) : "—"}.</p>` : ""}
    <label class="f" data-keep>Recordar recalcular cada (días)<input class="in" id="s_recalc" inputmode="numeric" value="${esc(s.recalcEvery)}"></label></section>

  <section class="card"><span class="eyebrow">Conexión con Gemini</span>
    <label class="f" data-keep>Dirección del Worker<input class="in" id="s_url" placeholder="https://macros-julio.TU-USUARIO.workers.dev" value="${esc(s.workerUrl)}" autocomplete="off" spellcheck="false"></label>
    <label class="f" data-keep>Clave personal (APP_TOKEN)<input class="in" id="s_token" type="password" value="${esc(s.token)}" autocomplete="off"></label>
    <label class="f" data-keep>Modelo (vacío = el que definiste en el Worker)<input class="in" id="s_model" list="models" placeholder="gemini-flash-latest" value="${esc(s.model)}" autocomplete="off" spellcheck="false"><datalist id="models">${(S.models || []).map(m => `<option value="${esc(m)}">`).join("")}</datalist></label>
    <div class="row wrapr"><button class="btn sm" data-a="savesettings">Guardar</button><button class="btn ghost sm" data-a="testconn">Probar conexión</button></div>
    ${S.connMsg ? `<div class="banner ${S.connOk ? "" : "err"}">${esc(S.connMsg)}</div>` : ""}
    <p class="muted xs">La API key de Google no se guarda en el teléfono: vive en el Worker de Cloudflare. Aquí solo va tu clave personal para que nadie más use tu Worker.</p></section>

  <section class="card"><span class="eyebrow">Día y agua</span>
    <label class="check"><input type="checkbox" id="s_late" ${s.dayCut ? "checked" : ""}> Me acuesto tarde: lo que registre antes de las 3:00 cuenta para el día anterior</label>
    <label class="check"><input type="checkbox" id="s_water" ${s.showWater ? "checked" : ""}> Mostrar la barra de agua en Hoy</label>
    <div class="g2"><label class="f" data-keep>Meta de agua (ml)<input class="in" id="s_wgoal" inputmode="numeric" value="${esc(s.waterGoalMl)}"></label><label class="f" data-keep>Cada toque suma (ml)<input class="in" id="s_glass" inputmode="numeric" value="${esc(s.glassMl)}"></label></div></section>

  <section class="card"><span class="eyebrow">Ayuno intermitente</span>
    <label class="check"><input type="checkbox" id="s_fast" ${s.fasting.on ? "checked" : ""}> Activar. Tu ayuno se cuenta solo desde tu última comida.</label>
    <label class="f" data-keep>Meta de horas<select class="in" id="s_fasth">${[12, 13, 14, 16, 18, 20].map(h => `<option ${s.fasting.hours === h ? "selected" : ""}>${h}</option>`).join("")}</select></label></section>

  <section class="card"><span class="eyebrow">Reparto de la semana</span>
    <label class="check"><input type="checkbox" id="s_wk" ${s.weekendSave.on ? "checked" : ""}> Ahorrar para el sábado: de lunes a viernes guardas un % de tu meta y el sábado comes más. La proteína no baja.</label>
    <label class="f" data-keep>% que ahorras cada día<select class="in" id="s_wkpct">${[5, 10, 15].map(v => `<option ${num(s.weekendSave.pct) === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
    <label class="check"><input type="checkbox" id="s_cyc" ${s.cycling.on ? "checked" : ""}> Días altos y bajos: más carbos los días que entrenas, menos en descanso, con el mismo promedio.</label>
    <div class="f">Días de entreno<div class="chips">${days.map((l, i) => `<button class="chip" data-a="cycday" data-v="${i}" aria-pressed="${s.cycling.days.includes(i)}">${l}</button>`).join("")}</div></div>
    <label class="f" data-keep>kcal extra en día de entreno<input class="in" id="s_cycd" inputmode="numeric" value="${esc(s.cycling.delta)}"></label></section>

  <section class="card"><span class="eyebrow">Suplementos</span>
    ${s.supps.map(x => `<div class="mrow"><span>${esc(x.name)}</span><button class="rm" data-a="delsupp" data-id="${x.id}">quitar</button></div>`).join("") || `<p class="muted small">Agrega los que tomas para marcarlos cada día.</p>`}
    <div class="row" data-keep><input class="in grow" id="s_supp" placeholder="Ej: Creatina 5 g"><button class="btn sm" data-a="addsupp">Agregar</button></div></section>

  <section class="card"><span class="eyebrow">Tus datos</span>
    <p class="small">Todo se guarda solo en este teléfono. Exporta un respaldo de vez en cuando: si borras los datos del navegador, se pierde.</p>
    <div class="row wrapr"><button class="btn sm" data-a="export">Exportar respaldo</button><label class="btn ghost sm filebtn">Importar respaldo<input type="file" id="importf" accept="application/json,.json"></label></div>
    ${S.confirmWipe ? `<div class="banner err">¿Borrar todos tus datos de este teléfono? No se puede deshacer. <button class="btn danger sm" data-a="wipeok">Sí, borrar</button><button class="btn ghost sm" data-a="wipeno">No</button></div>` : `<button class="link small" data-a="wipe" style="color:var(--warn)">Borrar todos mis datos</button>`}
    <p class="muted xs">Versión ${VERSION}. Las estimaciones de calorías y de % de grasa son referencias: no reemplazan a un nutricionista.</p></section>`;
}
function readSettings(){
  const s = DB.settings, v = id => document.getElementById(id);
  if (v("s_url")) s.workerUrl = v("s_url").value.trim();
  if (v("s_token")) s.token = v("s_token").value.trim();
  if (v("s_model")) s.model = v("s_model").value.trim();
  if (v("s_late")) s.dayCut = v("s_late").checked ? 3 : 0;
  if (v("s_water")) s.showWater = v("s_water").checked;
  if (v("s_wgoal")) s.waterGoalMl = num(v("s_wgoal").value) || 2000;
  if (v("s_glass")) s.glassMl = num(v("s_glass").value) || 250;
  if (v("s_fast")) s.fasting.on = v("s_fast").checked;
  if (v("s_fasth")) s.fasting.hours = num(v("s_fasth").value) || 16;
  if (v("s_wk")) s.weekendSave.on = v("s_wk").checked;
  if (v("s_wkpct")) s.weekendSave.pct = num(v("s_wkpct").value) || 10;
  if (v("s_cyc")) s.cycling.on = v("s_cyc").checked;
  if (v("s_cycd")) s.cycling.delta = num(v("s_cycd").value) || 150;
  if (v("s_recalc")) s.recalcEvery = num(v("s_recalc").value) || 15;
  save();
}

/* ----- onboarding ----- */
function viewOnb(){
  const O = S.onb, p = O.p;
  const opt = (k, v, l, d) => `<button class="opt" data-a="onbset" data-k="${k}" data-v="${v}" aria-pressed="${p[k] === v}"><b>${l}</b>${d ? `<span>${d}</span>` : ""}</button>`;
  const head = (n, t, sub) => `<header class="stack" style="gap:6px"><div class="row between"><span class="eyebrow">Paso ${n} de 4</span>${DB.goals ? `<button class="link small" data-a="onbcancel">Cancelar</button>` : ""}</div><h1>${t}</h1>${sub ? `<p class="muted">${sub}</p>` : ""}<div class="meter"><i style="width:${n * 25}%"></i></div></header>`;
  if (O.manual) return `<header class="stack" style="gap:6px"><div class="row between"><span class="eyebrow">Mis metas</span><button class="link small" data-a="onbback">Volver</button></div><h1>Escribe tus metas</h1><p class="muted">Escríbelas como te las dio tu nutricionista o tu otra app.</p></header>
    <section class="card" data-keep><div class="g4"><label class="f">kcal<input class="in" id="gk" inputmode="numeric" value="${esc(DB.goals?.kcal || "")}"></label><label class="f">Prot. g<input class="in" id="gp" inputmode="numeric" value="${esc(DB.goals?.p || "")}"></label><label class="f">Carb. g<input class="in" id="gc" inputmode="numeric" value="${esc(DB.goals?.c || "")}"></label><label class="f">Grasa g<input class="in" id="gf" inputmode="numeric" value="${esc(DB.goals?.f || "")}"></label></div>
    <button class="btn block" data-a="savegoals">Guardar mis metas</button></section>`;
  if (O.step === 0) return `${head(1, "¿Qué quieres lograr?", "Con 4 pasos cortos se calcula tu plan de calorías y macros.")}
    <div class="stack">${Object.entries(GOALS).map(([k, g]) => opt("goal", k, g.l, g.d)).join("")}</div>
    <button class="btn block" data-a="onbnext">Siguiente</button><button class="link small" data-a="onbmanual" style="align-self:center">Ya tengo mis metas</button>`;
  if (O.step === 1) return `${head(2, "Tu cuerpo", "Mientras más exacto, más preciso tu plan. Nadie más lo ve.")}
    <section class="card" data-keep><div class="seg" role="group">${[["h","Hombre"],["m","Mujer"]].map(([v, l]) => `<button data-a="onbset" data-k="sex" data-v="${v}" aria-pressed="${p.sex === v}">${l}</button>`).join("")}</div>
    <div class="g3"><label class="f">Edad<input class="in" id="o_age" inputmode="numeric" value="${esc(p.age || "")}"></label><label class="f">Estatura cm<input class="in" id="o_h" inputmode="numeric" value="${esc(p.height || "")}"></label><label class="f">Peso kg<input class="in" id="o_w" inputmode="decimal" value="${esc(p.weight || "")}"></label></div>
    <label class="f">% de grasa (opcional, de un InBody o báscula)<input class="in" id="o_bf" inputmode="decimal" value="${esc(p.bf || "")}"></label>
    ${O.err ? `<div class="banner err">${esc(O.err)}</div>` : ""}</section>
    <div class="row"><button class="btn ghost grow" data-a="onbprev">Atrás</button><button class="btn grow" data-a="onbnext">Siguiente</button></div>`;
  if (O.step === 2) return `${head(3, "Tu día a día", "Lo que gastas depende de cómo vives, no solo de tu peso.")}
    <div class="stack">${Object.entries(JOBS).map(([k, j]) => opt("job", k, j.l, j.d)).join("")}</div>
    <section class="card" data-keep><label class="f">Pasos en un día normal<select class="in" id="o_steps">${Object.entries(STEPS).map(([k, s]) => `<option value="${k}" ${p.steps === k ? "selected" : ""}>${s[0]}</option>`).join("")}</select></label>
    <label class="f">Entrenamientos por semana (de ~1 hora)<select class="in" id="o_tr">${[0,1,2,3,4,5,6,7].map(n => `<option ${String(p.trainings) === String(n) ? "selected" : ""}>${n}</option>`).join("")}</select></label></section>
    <div class="row"><button class="btn ghost grow" data-a="onbprev">Atrás</button><button class="btn grow" data-a="onbnext">Siguiente</button></div>`;
  if (O.step === 3) return `${head(4, "Tu horario", "Último paso.")}
    <section class="card" data-keep><label class="check"><input type="checkbox" id="o_late" ${p.late ? "checked" : ""}> Me acuesto tarde: lo que registre antes de las 3:00 cuenta para el día anterior</label>
    <p class="muted xs">Si no lo marcas, tu día se cierra a medianoche. Lo puedes cambiar después en Ajustes.</p></section>
    <div class="row"><button class="btn ghost grow" data-a="onbprev">Atrás</button><button class="btn grow" data-a="onbcalc">Calcular mi plan</button></div>`;
  const c = calcPlan(p);
  return `<header class="stack" style="gap:6px"><span class="eyebrow">${esc(GOALS[p.goal].l)}</span><h1>Tu plan de cada día</h1></header>
    <section class="label"><h2>${c.kcal} kcal</h2>
      <div class="mrow"><span>Tu gasto en reposo (${c.katch ? "con tu % de grasa" : "edad, peso, estatura"})</span><b class="num">${c.bmr}</b></div>
      <div class="mrow"><span>Tu trabajo y tus pasos</span><b class="num">+${c.neat}</b></div>
      <div class="mrow"><span>Tus entrenamientos (promedio diario)</span><b class="num">+${c.train}</b></div>
      <div class="mrow"><span>Lo que gastas</span><b class="num">${c.tdee}</b></div>
      <div class="mrow"><span>Tu objetivo</span><b class="num">${c.adj ? (c.adj > 0 ? "+" : "−") + Math.abs(c.adj * 100) + " %" : "sin cambio"}</b></div>
      <div class="tot"><b>Repartido en</b><span></span></div>
      <div class="mrow"><span>Proteína (${c.pkg} g por kg${num(p.bf) || num(p.weight) / ((num(p.height) / 100) ** 2) > 30 ? ", ajustada" : ""})</span><b class="num">${c.p} g</b></div>
      <div class="mrow"><span>Grasa (25 %)</span><b class="num">${c.f} g</b></div>
      <div class="mrow"><span>Carbohidratos (el resto)</span><b class="num">${c.c} g</b></div></section>
    <p class="muted xs">Cálculo Mifflin-St Jeor${c.katch ? " / Katch-McArdle" : ""} × actividad. Es una referencia: no reemplaza a un nutricionista. Se recuerda recalcular cada 15 días con tu peso nuevo.</p>
    ${DB.goals && DB.goals.source === "manual" ? `<div class="banner">¿Reemplazar tus metas actuales por este plan?</div>` : ""}
    <div class="row"><button class="btn ghost grow" data-a="onbprev">Atrás</button><button class="btn grow" data-a="onbaccept">Usar este plan</button></div>`;
}
function readOnb(){
  const p = S.onb.p, v = id => document.getElementById(id);
  if (v("o_age")) p.age = v("o_age").value.trim();
  if (v("o_h")) p.height = v("o_h").value.trim();
  if (v("o_w")) p.weight = v("o_w").value.trim();
  if (v("o_bf")) p.bf = v("o_bf").value.trim();
  if (v("o_steps")) p.steps = v("o_steps").value;
  if (v("o_tr")) p.trainings = v("o_tr").value;
  if (v("o_late")) p.late = v("o_late").checked;
}

/* ----- hojas (sheets) ----- */
function viewSheet(){
  const sh = S.sheet; if (!sh) return "";
  let inner = "";
  if (sh.kind === "entry") {
    const f = findEntry(sh.id); if (!f) { S.sheet = null; return ""; }
    const e = f.e;
    inner = `<div class="row between"><h2>${esc(e.name)}</h2><button class="icon-btn" data-a="closesheet" aria-label="Cerrar">×</button></div>
      <p class="muted small num">${e.g ? rnd(e.g) + " g · " : ""}${rnd(e.kcal)} kcal · P ${r1(e.p)} · C ${r1(e.c)} · G ${r1(e.f)}</p>
      <label class="f" data-keep>${e.g ? "Gramos" : "Porciones"}<input class="in" id="eg" inputmode="decimal" value="${e.g ? rnd(e.g) : r1(num(e.q) || 1)}"></label>
      <label class="f">Mover a<select class="in" id="emeal">${MEALS.map(([k, l]) => `<option value="${k}" ${e.meal === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <button class="btn block" data-a="entrysave">Guardar cambios</button>
      <div class="g2"><button class="btn soft" data-a="entryfav">★ Favorito</button><button class="btn soft" data-a="entrycopy">Copiar a hoy</button></div>
      <button class="btn soft block" data-a="entryrepeat">Repetir los próximos 7 días</button>
      ${S.sheet.del ? `<button class="btn danger block" data-a="entrydelok">Sí, borrar</button>` : `<button class="btn ghost block" data-a="entrydel" style="color:var(--warn)">Borrar</button>`}`;
  } else if (sh.kind === "peso") {
    inner = `<div class="row between"><h2>Tu peso de hoy</h2><button class="icon-btn" data-a="closesheet" aria-label="Cerrar">×</button></div>
      <p class="muted small">En ayunas, después del baño: así se compara bien semana a semana.</p>
      <div class="g2" data-keep><label class="f">Peso kg<input class="in" id="wkg" inputmode="decimal" value="${esc(lastWeight()?.kg || DB.profile?.weight || "")}"></label><label class="f">% grasa (opcional)<input class="in" id="wbf" inputmode="decimal"></label></div>
      ${DB.goals?.source === "calc" ? `<label class="check"><input type="checkbox" id="wrecalc" checked> Recalcular mis macros con este peso</label>` : ""}
      <button class="btn block" data-a="saveweight">Guardar</button>
      ${DB.weights.length ? `<details><summary class="small">Mediciones anteriores</summary>${[...DB.weights].sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 12).map(w => `<div class="mrow"><span>${fmtShort(w.date)}</span><span class="row"><b class="num">${r1(w.kg)} kg${num(w.bf) ? " · " + r1(w.bf) + " %" : ""}</b><button class="rm" data-a="delweight" data-d="${w.date}">borrar</button></span></div>`).join("")}</details>` : ""}`;
  } else if (sh.kind === "medidas") {
    inner = `<div class="row between"><h2>Anotar mis medidas</h2><button class="icon-btn" data-a="closesheet" aria-label="Cerrar">×</button></div>
      <p class="muted small">Anota solo las que quieras, en centímetros.</p>
      <div class="g3" data-keep>${MEASURES.map(([k, l]) => `<label class="f">${l}<input class="in" id="m_${k}" inputmode="decimal"></label>`).join("")}</div>
      <button class="btn block" data-a="savemeasures">Guardar</button>`;
  } else if (sh.kind === "act") {
    inner = `<div class="row between"><h2>Actividad extra</h2><button class="icon-btn" data-a="closesheet" aria-label="Cerrar">×</button></div>
      <p class="muted small">Solo lo que hiciste de más: un entreno extra, una salida en bici, pasos sobre tu día normal.</p>
      <div class="seg" role="group">${[["ej","Ejercicio"],["pasos","Pasos extra"]].map(([k, l]) => `<button data-a="actmode" data-v="${k}" aria-pressed="${(sh.mode || "ej") === k}">${l}</button>`).join("")}</div>
      ${(sh.mode || "ej") === "ej" ? `<div class="g2" data-keep><label class="f">Ejercicio<select class="in" id="aname">${ACTS.map(a => `<option>${a[0]}</option>`).join("")}</select></label><label class="f">Minutos<input class="in" id="amin" inputmode="numeric" placeholder="45"></label></div>`
        : `<label class="f" data-keep>Pasos de más<input class="in" id="asteps" inputmode="numeric" placeholder="4000"></label>`}
      <label class="f" data-keep>¿Cuánto sumar a tu meta?<select class="in" id="apct"><option value="100">Todo</option><option value="50">La mitad (más conservador)</option></select></label>
      <button class="btn block" data-a="saveact">Agregar</button>`;
  } else if (sh.kind === "dish") {
    const t = itemTot(S.add.draft?.items || []);
    inner = `<div class="row between"><h2>Guardar en Mis platos</h2><button class="icon-btn" data-a="closesheet" aria-label="Cerrar">×</button></div>
      <p class="muted small num">Total: ${rnd(t.kcal)} kcal · P ${rnd(t.p)} · C ${rnd(t.c)} · G ${rnd(t.f)}</p>
      <div data-keep class="stack"><label class="f">Nombre del plato<input class="in" id="dname" value="${esc(S.add.draft?.items?.[0]?.name || "")}"></label>
      <label class="f">¿Para cuántos platos alcanza?<input class="in" id="dserv" inputmode="numeric" value="1"></label></div>
      <button class="btn block" data-a="savedish">Guardar plato</button>`;
  } else if (sh.kind === "pickdish") {
    const dsh = DB.dishes.find(x => x.id === sh.id); if (!dsh) { S.sheet = null; return ""; }
    inner = `<div class="row between"><h2>${esc(dsh.name)}</h2><button class="icon-btn" data-a="closesheet" aria-label="Cerrar">×</button></div>
      <p class="muted small num">Por porción: ${rnd(dsh.kcal / dsh.servings)} kcal · P ${rnd(dsh.p / dsh.servings)} · C ${rnd(dsh.c / dsh.servings)} · G ${rnd(dsh.f / dsh.servings)}</p>
      <label class="f" data-keep>Porciones que comiste<input class="in" id="dportions" inputmode="decimal" value="1"></label>
      <button class="btn block" data-a="adddish">Agregar a ${esc((MEALS.find(m => m[0] === S.add.meal) || MEALS[0])[1])}</button>`;
  }
  return `<div class="sheet-back" data-a="backdrop"><div class="sheet" role="dialog" aria-modal="true">${inner}</div></div>`;
}

/* =================== render =================== */
function render(){
  const a = document.activeElement;
  if (a && a !== document.body && a.closest && a.closest("[data-keep]") && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.type !== "checkbox") { S.pending = true; return; }
  S.pending = false;
  renderTabs();
  const v = S.view;
  const html = v === "onb" ? viewOnb() : v === "hoy" ? viewHoy() : v === "add" ? viewAdd() : v === "prog" ? viewProg() : v === "plan" ? viewPlan() : viewAjustes();
  $("#app").innerHTML = html + viewSheet();
}
document.addEventListener("focusout", () => setTimeout(() => { if (S.pending) render(); }, 0));

/* =================== eventos =================== */
function go(view){ S.view = view; window.scrollTo(0, 0); }
document.addEventListener("click", ev => {
  const b = ev.target.closest("[data-a]"); if (!b) return;
  const a = b.dataset.a, A = S.add, PL = S.plan;
  if (a === "backdrop") { if (ev.target === b) { S.sheet = null; render(); } return; }
  switch (a) {
    /* navegación */
    case "tab": if (S.view === "ajustes") readSettings(); go(b.dataset.v); if (b.dataset.v === "hoy") S.date = S.date || today(); break;
    case "prev": S.date = addDays(S.date, -1); break;
    case "next": S.date = addDays(S.date, 1); break;
    case "today": S.date = today(); break;
    case "sheet": S.sheet = {kind:b.dataset.v}; break;
    case "closesheet": S.sheet = null; break;
    /* hoy */
    case "wplus": case "wminus": { const dd = ensureDay(S.date); dd.water = Math.max(0, num(dd.water) + (a === "wplus" ? 1 : -1) * (num(DB.settings.glassMl) || 250)); save(); break; }
    case "supp": { const dd = ensureDay(S.date); dd.supps = dd.supps || {}; dd.supps[b.dataset.id] = !dd.supps[b.dataset.id]; save(); break; }
    case "faststart": DB.settings.fasting.manualStart = Date.now(); save(); toast("Ayuno iniciado"); break;
    case "compensar": { const t = targetFor(S.date), ex = totals(DB.days[S.date]).kcal - t.kcal; const r = compensate(S.date, ex);
      toast(`Listo: −${r.perDay} kcal por ${r.dates.length} días${r.left > 0 ? `. ${r.left} kcal quedan sin compensar` : ""}`); break; }
    case "uncomp": DB.comps = DB.comps.filter(c => c.from !== S.date); save(); toast("Compensación cancelada"); break;
    case "copymeal": { const src = DB.days[S.date]; if (!src) break; const dd = ensureDay(today()), t0 = Date.now();
      src.entries.filter(e => e.meal === b.dataset.m).forEach((e, i) => dd.entries.push({...e, id:uid(), t:t0 + i}));
      save(); toast("Copiado a hoy"); break; }
    case "delact": { const dd = ensureDay(S.date); dd.acts = dd.acts.filter(x => x.id !== b.dataset.id); save(); break; }
    case "entry": S.sheet = {kind:"entry", id:b.dataset.id}; break;
    case "entrysave": { const f = findEntry(S.sheet.id); if (!f) break; const e = f.e, it = entryToItem(e), nv = num($("#eg").value);
      if (nv) { Object.assign(e, {kcal:rnd(it.k * nv), p:r1(it.p * nv), c:r1(it.c * nv), f:r1(it.f * nv), fib:r1(it.fb * nv)}); if (it.noGrams) e.q = r1(nv); else e.g = rnd(nv); }
      e.meal = $("#emeal").value; save(); S.sheet = null; toast("Guardado"); break; }
    case "entryfav": { const f = findEntry(S.sheet.id); if (f) addFav(f.e); break; }
    case "entrycopy": { const f = findEntry(S.sheet.id); if (!f) break; ensureDay(today()).entries.push({...f.e, id:uid(), t:Date.now()}); save(); toast("Copiado a hoy"); S.sheet = null; break; }
    case "entryrepeat": { const f = findEntry(S.sheet.id); if (!f) break; for (let i = 1; i <= 7; i++) ensureDay(addDays(f.d, i)).entries.push({...f.e, id:uid(), t:f.e.t + i * 864e5}); save(); toast("Repetido en los próximos 7 días"); S.sheet = null; break; }
    case "entrydel": S.sheet.del = true; break;
    case "entrydelok": { const f = findEntry(S.sheet.id); if (f) { DB.days[f.d].entries = DB.days[f.d].entries.filter(x => x.id !== f.e.id); save(); toast("Borrado"); } S.sheet = null; break; }
    /* agregar */
    case "meal": A.meal = b.dataset.v; break;
    case "mode": A.mode = b.dataset.v; A.err = ""; A.urls.forEach(u => URL.revokeObjectURL(u)); A.files = []; A.urls = []; break;
    case "addtab": A.tab = b.dataset.v; break;
    case "rmphoto": { const i = +b.dataset.ix; URL.revokeObjectURL(A.urls[i]); A.urls.splice(i, 1); A.files.splice(i, 1); break; }
    case "ai": runAddAI(); return;
    case "stop": ctl?.abort(); return;
    case "discard": A.draft = null; break;
    case "rmitem": A.draft.items.splice(+b.dataset.ix, 1); break;
    case "favitem": { const i = A.draft.items[+b.dataset.ix]; addFav(itemToEntry(i, A.meal, "fav")); break; }
    case "savedraft": { const dd = ensureDay(S.date), t0 = Date.now();
      A.draft.items.forEach((i, j) => dd.entries.push(itemToEntry(i, A.meal, A.draft.src, t0 + j)));
      save(); resetAdd(); go("hoy"); toast("Guardado"); return render(); }
    case "savemanual": { const v = id => $("#" + id).value.trim();
      const m = {name:v("mname"), g:v("mg"), kcal:v("mkcal"), p:v("mp"), c:v("mc"), f:v("mf"), fib:v("mfb")};
      A.manual = m;
      if (!m.name || !num(m.kcal)) { A.err = "Escribe al menos un nombre y las calorías."; break; }
      const g = num(m.g) || 1; A.err = "";
      A.draft = {src:"manual", note:"", items:[{name:m.name.slice(0, 80), g, k:num(m.kcal) / g, p:num(m.p) / g, c:num(m.c) / g, f:num(m.f) / g, fb:num(m.fib) / g, noGrams:!num(m.g)}]}; break; }
    case "pickrecent": { const e = recents().find(x => x.id === b.dataset.id); if (e) A.draft = {src:"reciente", note:"", items:[entryToItem(e)]}; break; }
    case "pickfav": { const e = DB.favs.find(x => x.id === b.dataset.id); if (e) A.draft = {src:"fav", note:"", items:[entryToItem(e)]}; break; }
    case "unfav": DB.favs = DB.favs.filter(x => x.id !== b.dataset.id); save(); break;
    case "pickdish": S.sheet = {kind:"pickdish", id:b.dataset.id}; break;
    case "deldish": DB.dishes = DB.dishes.filter(x => x.id !== b.dataset.id); save(); toast("Plato borrado"); break;
    case "adddish": { const d = DB.dishes.find(x => x.id === S.sheet.id), n = num($("#dportions").value) || 1; if (!d) break;
      ensureDay(S.date).entries.push({id:uid(), t:Date.now(), meal:A.meal, name:d.name + (n !== 1 ? ` (${r1(n)} porc.)` : ""), g:rnd(d.totalG / d.servings * n), kcal:rnd(d.kcal / d.servings * n), p:r1(d.p / d.servings * n), c:r1(d.c / d.servings * n), f:r1(d.f / d.servings * n), fib:r1((d.fib || 0) / d.servings * n), src:"plato"});
      save(); S.sheet = null; go("hoy"); toast("Guardado"); break; }
    case "savedish": { const t = itemTot(A.draft.items), name = $("#dname").value.trim() || "Mi plato", sv = num($("#dserv").value) || 1;
      DB.dishes.unshift({id:uid(), name:name.slice(0, 80), servings:sv, totalG:rnd(A.draft.items.reduce((x, i) => x + i.g, 0)), kcal:rnd(t.kcal), p:r1(t.p), c:r1(t.c), f:r1(t.f), fib:r1(t.fib)});
      save(); S.sheet = null; toast("Guardado en Mis platos"); break; }
    /* actividad */
    case "actmode": S.sheet.mode = b.dataset.v; break;
    case "saveact": { const kg = num(lastWeight()?.kg || DB.profile?.weight) || 75, pct = num($("#apct").value) / 100 || 1, dd = ensureDay(S.date); dd.acts = dd.acts || [];
      if ((S.sheet.mode || "ej") === "ej") { const nm = $("#aname").value, min = num($("#amin").value); if (!min) { toast("Escribe los minutos."); return; }
        const met = (ACTS.find(x => x[0] === nm) || ACTS[ACTS.length - 1])[1]; dd.acts.push({id:uid(), name:nm, min, kcal:rnd((met - 1) * kg * min / 60 * pct)}); }
      else { const st = num($("#asteps").value); if (!st) { toast("Escribe los pasos."); return; } dd.acts.push({id:uid(), name:"Pasos extra", steps:st, kcal:rnd(st * 0.0005 * kg * pct)}); }
      save(); S.sheet = null; toast("Actividad agregada a tu meta de " + fmtDay(S.date).toLowerCase()); break; }
    /* progreso */
    case "saveweight": { const kg = num($("#wkg").value), bf = num($("#wbf").value); if (!kg || kg > 400) { toast("Revisa el número."); return; }
      const d = today(); DB.weights = DB.weights.filter(w => w.date !== d); DB.weights.push({date:d, kg, bf:bf || undefined});
      if ($("#wrecalc")?.checked && DB.profile) { DB.profile.weight = String(kg); if (bf) DB.profile.bf = String(bf); recalcFromProfile(); toast("Listo, tus macros se reajustaron"); } else toast("Peso guardado");
      save(); S.sheet = null; break; }
    case "delweight": DB.weights = DB.weights.filter(w => w.date !== b.dataset.d); save(); break;
    case "savemeasures": { const m = {date:today()}; let any = false; MEASURES.forEach(([k]) => { const v = num($("#m_" + k).value); if (v) { m[k] = v; any = true; } });
      if (!any) { toast("Anota al menos una medida."); return; } DB.measures = DB.measures.filter(x => x.date !== m.date); DB.measures.push(m); save(); S.sheet = null; toast("Mediciones guardadas"); break; }
    case "rmbf": { const i = +b.dataset.ix; URL.revokeObjectURL(S.prog.urls[i]); S.prog.urls.splice(i, 1); S.prog.files.splice(i, 1); break; }
    case "bfrun": runBF(); return;
    case "bfsave": { const d = today(), w = DB.weights.find(x => x.date === d); const kg = w?.kg || lastWeight()?.kg || num(DB.profile?.weight);
      if (!kg) { toast("Anota tu peso de hoy primero."); return; }
      DB.weights = DB.weights.filter(x => x.date !== d); DB.weights.push({date:d, kg, bf:r1(S.prog.bf.v)}); save(); toast("Guardado en tu gráfico"); S.prog.bf = null; break; }
    /* ideas */
    case "plantab": PL.tab = b.dataset.v; PL.err = ""; break;
    case "plancomplete": runPlan("complete"); return;
    case "planmake": { const av = $("#avoid"); if (av) { DB.settings.avoid = av.value.trim(); save(); } runPlan("plan"); return; }
    case "planswap": runPlan("swap", +b.dataset.ix); return;
    case "planadd": addPlanMeal(PL.res.meals[+b.dataset.ix]); toast("Agregado a tu día"); break;
    case "planaddall": PL.res.meals.filter(m => !m.added).forEach(addPlanMeal); toast("Tu día quedó completo"); break;
    case "planreset": PL.res = null; PL.err = ""; break;
    case "shopdays": PL.days = +b.dataset.v; break;
    case "copyshop": { const agg = {}; PL.res.meals.forEach(m => m.items.forEach(i => { const k = i.name.toLowerCase(); agg[k] = agg[k] || {name:i.name, g:0}; agg[k].g += i.g * PL.days; }));
      const txt = "Lista de compras (" + PL.days + " día" + (PL.days > 1 ? "s" : "") + ")\n" + Object.values(agg).map(r => "- " + r.name + ": " + (r.g >= 1000 ? r1(r.g / 1000) + " kg" : rnd(r.g) + " g")).join("\n");
      navigator.clipboard?.writeText(txt).then(() => toast("Lista copiada"), () => toast("No se pudo copiar")); return; }
    case "diet": DB.settings.diet = b.dataset.v; save(); break;
    /* ajustes */
    case "savesettings": readSettings(); toast("Ajustes guardados"); break;
    case "testconn": readSettings(); testConn(); return;
    case "cycday": { const d = +b.dataset.v, s = DB.settings.cycling; readSettings(); s.days = s.days.includes(d) ? s.days.filter(x => x !== d) : [...s.days, d].sort(); save(); break; }
    case "addsupp": { const v = $("#s_supp").value.trim(); if (!v) return; readSettings(); DB.settings.supps.push({id:uid(), name:v.slice(0, 40)}); save(); break; }
    case "delsupp": readSettings(); DB.settings.supps = DB.settings.supps.filter(x => x.id !== b.dataset.id); save(); break;
    case "export": exportData(); return;
    case "wipe": S.confirmWipe = true; break;
    case "wipeno": S.confirmWipe = false; break;
    case "wipeok": localStorage.removeItem(KEY); DB = DEF(); S.confirmWipe = false; S.view = "onb"; S.onb.step = 0; toast("Datos borrados"); break;
    /* onboarding */
    case "onb": S.onb.step = 0; S.onb.manual = false; S.onb.err = ""; if (DB.profile) S.onb.p = {...DB.profile, weight:String(lastWeight()?.kg || DB.profile.weight)}; go("onb"); break;
    case "onbmanual": S.onb.manual = true; go("onb"); break;
    case "onbback": S.onb.manual = false; if (DB.goals) go("hoy"); break;
    case "onbcancel": go("hoy"); break;
    case "onbset": readOnb(); S.onb.p[b.dataset.k] = b.dataset.v; break;
    case "onbprev": readOnb(); S.onb.step = Math.max(0, S.onb.step - 1); break;
    case "onbnext": case "onbcalc": { readOnb(); const p = S.onb.p;
      if (S.onb.step === 1) { const ag = num(p.age), h = num(p.height), w = num(p.weight);
        if (!ag || ag < 14 || ag > 100 || !h || h < 120 || h > 230 || !w || w < 35 || w > 300) { S.onb.err = "Revisa edad, estatura (cm) y peso (kg)."; break; } S.onb.err = ""; }
      S.onb.step++; window.scrollTo(0, 0); break; }
    case "onbaccept": { const p = {...S.onb.p, calcAt:today()}; DB.profile = p; DB.settings.dayCut = p.late ? 3 : 0;
      const c = calcPlan(p); DB.goals = {kcal:c.kcal, p:c.p, c:c.c, f:c.f, source:"calc"};
      if (!DB.weights.some(w => w.date === today())) DB.weights.push({date:today(), kg:num(p.weight), bf:num(p.bf) || undefined});
      if (!DB.settings.waterGoalMl || DB.settings.waterGoalMl === 2000) DB.settings.waterGoalMl = Math.round(num(p.weight) * 35 / 250) * 250 || 2000;
      save(); S.date = today(); go("hoy"); toast("Tu plan está listo"); break; }
    case "savegoals": { const k = num($("#gk").value), p = num($("#gp").value), c = num($("#gc").value), f = num($("#gf").value);
      if (!k) { toast("Escribe al menos las calorías."); return; }
      DB.goals = {kcal:rnd(k), p:rnd(p) || rnd(k * 0.25 / 4), c:rnd(c) || rnd(k * 0.45 / 4), f:rnd(f) || rnd(k * 0.3 / 9), source:"manual"}; save(); S.onb.manual = false; go("hoy"); toast("Listo, tu meta se actualizó"); break; }
  }
  render();
});
function addFav(e){
  const k = (e.name || "").toLowerCase().trim();
  if (DB.favs.some(f => f.name.toLowerCase().trim() === k)) { toast("Ya está en tus favoritos"); return; }
  DB.favs.unshift({id:uid(), name:e.name, g:num(e.g), kcal:num(e.kcal), p:num(e.p), c:num(e.c), f:num(e.f), fib:num(e.fib)}); save(); toast("Guardado en tus favoritos");
}
function recalcFromProfile(){ const c = calcPlan(DB.profile); if (!c) return; DB.profile.calcAt = today(); DB.goals = {kcal:c.kcal, p:c.p, c:c.c, f:c.f, source:"calc"}; }
async function runBF(){
  const PR = S.prog; if (PR.busy || !PR.files.length) return;
  if (!DB.profile) { PR.err = "Primero calcula tu plan (sexo, edad, estatura y peso)."; render(); return; }
  PR.busy = true; PR.err = ""; PR.bf = null; render();
  const m = [...DB.measures].sort((a, b) => a.date < b.date ? 1 : -1)[0];
  const ms = m ? MEASURES.filter(([k]) => num(m[k])).map(([k, l]) => `${l.toLowerCase()} ${m[k]} cm`).join(", ") : "";
  try { const r = await ai(P.bodyfat(DB.profile, ms), PR.files, "low"); const v = num(r?.grasa_pct); if (!v) throw {code:"parse"};
    const rg = Array.isArray(r?.rango) ? r.rango.map(num) : [v - 2, v + 2]; PR.bf = {v, r:[rnd(rg[0] || v - 2), rnd(rg[1] || v + 2)], note:String(r?.nota || "").slice(0, 200)}; }
  catch(e){ if (e?.code !== "cancelled") PR.err = aiErr(e); }
  finally { PR.busy = false; ctl = null; render(); }
}
async function testConn(){
  const s = DB.settings; S.connMsg = "Probando…"; S.connOk = true; render();
  if (!s.workerUrl || !s.token) { S.connMsg = "Completa la dirección del Worker y tu clave personal."; S.connOk = false; return render(); }
  try { const r = await fetch(s.workerUrl.replace(/\/+$/, "") + "/models", {headers:{"X-App-Token":s.token}}); const d = await r.json().catch(() => ({}));
    if (!r.ok) throw {code:d.error || "http", message:d.message};
    S.models = d.models || []; S.connOk = true; S.connMsg = `Conectado. Modelo por defecto del Worker: ${d.default || "—"}. ${S.models.length} modelos disponibles (escribe en «Modelo» para ver la lista).`; }
  catch(e){ S.connOk = false; S.connMsg = e?.code ? aiErr(e) : aiErr({code:"network"}); }
  render();
}
function exportData(){
  const blob = new Blob([JSON.stringify(DB, null, 1)], {type:"application/json"}), url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = "macros-julio-" + today() + ".json"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast("Respaldo descargado");
}
document.addEventListener("input", ev => {
  const el = ev.target, A = S.add;
  if (el.id === "phint") A.hint = el.value; else if (el.id === "ptotal") A.total = el.value; else if (el.id === "ptext") A.text = el.value;
  else if (el.id === "lgrams") A.labelG = el.value;
  else if (el.id === "aq") { A.q = el.value; const pos = el.selectionStart; S.pending = false; renderKeepFocus("aq", pos); }
  else if (el.id === "extraname") { ensureDay(S.date).extraName = el.value.slice(0, 40); save(); }
  else if (el.dataset.gi != null && A.draft) {
    const ix = +el.dataset.gi, it = A.draft.items[ix]; if (!it) return;
    it.g = num(el.value);
    const s = $("#sub" + ix); if (s) s.textContent = `${rnd(it.k * it.g)} kcal · P ${r1(it.p * it.g)} · C ${r1(it.c * it.g)} · G ${r1(it.f * it.g)}`;
    const t = itemTot(A.draft.items); $("#tk").textContent = rnd(t.kcal); $("#tp").textContent = r1(t.p) + " g"; $("#tc").textContent = r1(t.c) + " g"; $("#tf").textContent = r1(t.f) + " g"; $("#tfb").textContent = r1(t.fib) + " g";
  }
});
function renderKeepFocus(id, pos){
  const sTop = window.scrollY; renderTabs(); $("#app").innerHTML = viewAdd() + viewSheet(); window.scrollTo(0, sTop);
  const el = document.getElementById(id); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch(e){} }
}
document.addEventListener("change", ev => {
  const el = ev.target;
  if (el.id === "pick" || el.id === "pickgal") { const f = el.files?.[0]; if (!f) return; const A = S.add; A.files.push(f); A.urls.push(URL.createObjectURL(f)); A.err = ""; render(); }
  else if (el.id === "bfpick") { const f = el.files?.[0]; if (!f) return; S.prog.files.push(f); S.prog.urls.push(URL.createObjectURL(f)); render(); }
  else if (el.id === "importf") { const f = el.files?.[0]; if (!f) return; f.text().then(t => { const d = JSON.parse(t); if (!d || typeof d !== "object" || !("days" in d)) throw 0;
      localStorage.setItem(KEY, JSON.stringify(d)); DB = load(); S.view = DB.profile || DB.goals ? "hoy" : "onb"; toast("Respaldo importado"); render(); }).catch(() => toast("Ese archivo no es un respaldo válido.")); }
  else if (el.id && el.id.startsWith("s_") && el.type === "checkbox") { readSettings(); render(); }
  else if (el.id === "s_fasth" || el.id === "s_wkpct") readSettings();
});
document.addEventListener("keydown", ev => { if (ev.key === "Escape" && S.sheet) { S.sheet = null; render(); } });
window.addEventListener("pagehide", () => { if (S.view === "ajustes") readSettings(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.view === "hoy") render(); });
setInterval(() => { if (S.view === "hoy" && !document.hidden && !S.sheet) render(); }, 60000);

/* =================== sin zoom (gesto de pellizcar / doble toque) =================== */
["gesturestart","gesturechange","gestureend"].forEach(t => document.addEventListener(t, e => e.preventDefault(), {passive:false}));
document.addEventListener("touchmove", e => { if (e.touches.length > 1) e.preventDefault(); }, {passive:false});
document.addEventListener("wheel", e => { if (e.ctrlKey) e.preventDefault(); }, {passive:false});

/* =================== arranque =================== */
render();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
