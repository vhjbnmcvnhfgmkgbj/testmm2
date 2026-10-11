"use strict";
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const C = window.Core;

/* ============================================================ تنظیمات و ذخیره‌سازی */
const DEF_CFG = {key: "", provider: "gemini", model: "gemini-2.5-flash", lang: "fa-IR", voice: true,
  rate: 1.0, theme: "cyan", fontSize: 16, persona: "", search: false};
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
let cfg = {...DEF_CFG, ...LS.get("jarvis_cfg", {})};
const saveCfg = () => LS.set("jarvis_cfg", cfg);

/* حافظه‌ی درازمدت و یادداشت‌ها */
const Memory = {
  list: LS.get("jarvis_memory", []),
  save() { LS.set("jarvis_memory", this.list); },
  add(fact) { this.list.push({id: Date.now() + "" + Math.random().toString(36).slice(2, 6), text: String(fact), at: Date.now()}); this.save(); renderMemList(); },
  remove(text) { const n = norm(text); const before = this.list.length; this.list = this.list.filter(f => !C.norm(f.text).includes(n)); this.save(); renderMemList(); return before - this.list.length; },
};
const Notes = {
  list: LS.get("jarvis_notes", []),
  save() { LS.set("jarvis_notes", this.list); },
  add(title, text) { this.list.unshift({id: Date.now() + "" + Math.random().toString(36).slice(2, 6), title: String(title), text: String(text), at: Date.now()}); this.save(); },
  list_() { return this.list.map(n => ({title: n.title, text: n.text})); },
  remove(title) { const n = C.norm(title); const before = this.list.length; this.list = this.list.filter(x => !C.norm(x.title).includes(n)); this.save(); return before - this.list.length; },
};
function norm(s) { return C.norm(s); }

/* گفتگوها (چند چت، مثل یک اپ واقعی) */
const Chats = {
  all: LS.get("jarvis_chats", []),
  curId: LS.get("jarvis_cur_chat", null),
  save() { LS.set("jarvis_chats", this.all); LS.set("jarvis_cur_chat", this.curId); },
  cur() { return this.all.find(c => c.id === this.curId); },
  create() {
    const c = {id: Date.now() + "" + Math.random().toString(36).slice(2, 6), title: "گفتگوی جدید", msgs: [], at: Date.now()};
    this.all.unshift(c); this.curId = c.id; this.save(); return c;
  },
  ensure() { if (!this.cur()) this.create(); return this.cur(); },
  remove(id) {
    this.all = this.all.filter(c => c.id !== id);
    if (this.curId === id) this.curId = this.all[0] ? this.all[0].id : null;
    if (!this.all.length) this.create();
    this.save();
  },
  touch(c) { c.at = Date.now(); this.all.sort((a, b) => b.at - a.at); this.save(); },
};

/* ============================================================ تم و قلم */
function applyTheme(t) { document.documentElement.setAttribute("data-theme", t); }
function applyFontSize(px) { document.documentElement.style.setProperty("--fs", px + "px"); }

/* ============================================================ بوت */
const BOOT_LINES = [
  "INITIALIZING J.A.R.V.I.S CORE...",
  "LOADING NEURAL INTERFACE............ OK",
  "MOUNTING LOCAL STORAGE............... OK",
  "CALIBRATING VOICE MATRIX............. OK",
  "SYNCING QUANTUM CLOCK................ OK",
  "ALL SYSTEMS NOMINAL.",
];
function boot() {
  const el = $("#bootTxt"); let i = 0, j = 0;
  const tick = () => {
    if (i >= BOOT_LINES.length) { setTimeout(() => $("#boot").classList.add("hide"), 300); return; }
    const line = BOOT_LINES[i];
    el.textContent = BOOT_LINES.slice(0, i).join("\n") + (i ? "\n" : "") + line.slice(0, j);
    j++;
    if (j > line.length) { i++; j = 0; setTimeout(tick, 90); } else setTimeout(tick, 10);
  };
  tick();
}

/* ============================================================ پس‌زمینه‌ی ذرات */
function startParticles() {
  const cv = $("#bg"), ctx = cv.getContext("2d");
  let w, h, pts = [];
  function sizeTo() {
    w = cv.width = innerWidth * devicePixelRatio; h = cv.height = innerHeight * devicePixelRatio;
    cv.style.width = innerWidth + "px"; cv.style.height = innerHeight + "px";
    const n = Math.min(70, Math.floor((innerWidth * innerHeight) / 22000));
    pts = Array.from({length: n}, () => ({x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25}));
  }
  sizeTo(); addEventListener("resize", sizeTo);
  const col = () => getComputedStyle(document.documentElement).getPropertyValue("--ac-rgb").trim() || "0,240,255";
  function frame() {
    ctx.clearRect(0, 0, w, h); const c = col();
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1;
    }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy), max = 130 * devicePixelRatio;
      if (d < max) { ctx.strokeStyle = `rgba(${c},${0.12 * (1 - d / max)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    }
    for (const p of pts) { ctx.fillStyle = `rgba(${c},.5)`; ctx.beginPath(); ctx.arc(p.x, p.y, 1.6 * devicePixelRatio, 0, 7); ctx.fill(); }
    requestAnimationFrame(frame);
  }
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) requestAnimationFrame(frame);
}

/* ============================================================ toast */
function toast(msg, ms = 2600) {
  const t = document.createElement("div"); t.className = "toast"; t.dir = "auto"; t.textContent = msg;
  $("#toasts").appendChild(t); setTimeout(() => t.remove(), ms);
}

/* ============================================================ وضعیت / orb */
function setStatus(text, mode) {
  $("#st").textContent = text;
  const ring = $("#orbRing");
  ring.style.animation = mode === "think" ? "spin .9s linear infinite" : mode === "listen" ? "spin 1.6s linear infinite" : "spin 6s linear infinite";
  ring.style.stroke = mode === "err" ? "var(--red)" : mode === "listen" ? "#fff" : "var(--ac)";
}
const styleTag = document.createElement("style");
styleTag.textContent = "@keyframes spin{to{transform:rotate(360deg)}} #orbRing{transform-origin:50px 50px}";
document.head.appendChild(styleTag);

/* ============================================================ رندر چت */
const chatEl = $("#chat");
function scrollBottom() { chatEl.scrollTop = chatEl.scrollHeight; }
function clearWelcome() { const w = chatEl.querySelector(".welcome"); if (w) w.remove(); }

function showWelcome() {
  chatEl.innerHTML = "";
  const w = document.createElement("div"); w.className = "welcome";
  w.innerHTML = `<h2>J.A.R.V.I.S</h2><p>آنلاین و آماده. بپرسید یا دستور بدهید.</p>
    <div class="chips">
      <button type="button" data-q="هوای امروز تهران چطوره؟">آب‌وهوا</button>
      <button type="button" data-q="یه تایمر ۵ دقیقه‌ای بذار">تایمر</button>
      <button type="button" data-q="۲۵۴ ضربدر ۱۷ چند میشه؟">محاسبه</button>
      <button type="button" data-q="یادت باشه اسمم علیه">به‌خاطر بسپار</button>
      <button type="button" data-q="تلگرام رو باز کن">باز کردن اپ</button>
    </div>`;
  chatEl.appendChild(w);
  w.querySelectorAll("[data-q]").forEach(b => b.addEventListener("click", () => send(b.dataset.q)));
}

function bubble(role, cls) {
  const d = document.createElement("div"); d.className = "m " + cls;
  const label = {u: "YOU", a: "JARVIS", s: "SYSTEM", e: "ERROR"}[cls] || "";
  d.innerHTML = `<div class="mh">${label}</div><div class="mb"></div>`;
  chatEl.appendChild(d); scrollBottom();
  return d;
}
function addUser(text, imgData) {
  clearWelcome();
  const d = bubble("u", "u"); const mb = d.querySelector(".mb");
  if (imgData) { const img = document.createElement("img"); img.className = "th"; img.src = imgData; mb.appendChild(img); }
  const p = document.createElement("div"); p.dir = "auto"; p.textContent = text; mb.appendChild(p);
  return d;
}
function addSystem(text) { clearWelcome(); const d = bubble("s", "s"); d.querySelector(".mb").textContent = text; return d; }
function addError(text) { clearWelcome(); const d = bubble("e", "e"); d.querySelector(".mb").textContent = text; setStatus("ERROR", "err"); return d; }

/** حباب پاسخ زنده‌ی هوش مصنوعی: متن استریم، چیپ ابزارها، لینک‌ها، منابع جستجو */
function addAssistant() {
  clearWelcome();
  const d = bubble("a", "a");
  const mb = d.querySelector(".mb");
  mb.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
  const tl = document.createElement("div"); tl.className = "tl"; d.appendChild(tl);
  const lk = document.createElement("div"); lk.className = "lk"; d.appendChild(lk);
  const src = document.createElement("div"); src.className = "src"; d.appendChild(src);
  let raw = "";
  return {
    el: d,
    setText(full) { raw = full; mb.innerHTML = C.renderMarkdown(full) || '<span class="dots"><i></i><i></i><i></i></span>'; scrollBottom(); },
    appendText(piece) { raw += piece; mb.innerHTML = C.renderMarkdown(raw); scrollBottom(); },
    finish() { if (!raw.trim()) d.remove(); return raw; },
    addToolChip(name) { const c = document.createElement("span"); c.className = "chip run"; c.textContent = "⚙ " + name; tl.appendChild(c); scrollBottom(); return c; },
    settleChip(chip, ok) { chip.classList.remove("run"); chip.classList.add(ok ? "ok" : "bad"); },
    addLink(url, label) {
      const a = document.createElement("a"); a.className = "act"; a.textContent = (label || "باز کن") + " ↗"; a.href = url;
      if (/^https?:/.test(url)) { a.target = "_blank"; a.rel = "noopener"; }
      lk.appendChild(a); scrollBottom();
    },
    addSource(url, title) { const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener"; a.textContent = title || new URL(url).hostname; src.appendChild(a); },
  };
}

function renderMemList() {
  const box = $("#memList");
  if (!Memory.list.length) { box.innerHTML = '<div class="emp">چیزی ذخیره نشده.</div>'; return; }
  box.innerHTML = "";
  for (const f of Memory.list) {
    const r = document.createElement("div"); r.className = "li";
    r.innerHTML = `<div dir="auto">${C.esc(f.text)}</div>`;
    const b = document.createElement("button"); b.textContent = "حذف"; b.type = "button";
    b.addEventListener("click", () => { Memory.list = Memory.list.filter(x => x.id !== f.id); Memory.save(); renderMemList(); });
    r.appendChild(b); box.appendChild(r);
  }
}
function renderNotes() {
  const box = $("#notesBody");
  if (!Notes.list.length) { box.innerHTML = '<div class="emp">یادداشتی ندارید. بگویید «یادداشت کن ...»</div>'; return; }
  box.innerHTML = "";
  for (const n of Notes.list) {
    const r = document.createElement("div"); r.className = "li";
    r.innerHTML = `<div dir="auto"><b>${C.esc(n.title)}</b><br>${C.esc(n.text)}</div>`;
    const b = document.createElement("button"); b.textContent = "حذف"; b.type = "button";
    b.addEventListener("click", () => { Notes.list = Notes.list.filter(x => x.id !== n.id); Notes.save(); renderNotes(); });
    r.appendChild(b); box.appendChild(r);
  }
}
function renderTimers() {
  const box = $("#timersBody");
  const list = Timers.list();
  if (!list.length) { box.innerHTML = '<div class="emp">تایمری فعال نیست.</div>'; return; }
  box.innerHTML = "";
  for (const t of list) {
    const left = Math.max(0, Math.round((t.at - Date.now()) / 1000));
    const r = document.createElement("div"); r.className = "li";
    r.innerHTML = `<div dir="auto"><b>${C.esc(t.label)}</b><br>${left} ثانیه مانده</div>`;
    const b = document.createElement("button"); b.textContent = "لغو"; b.type = "button";
    b.addEventListener("click", () => { Timers.cancel(t.id); renderTimers(); });
    r.appendChild(b); box.appendChild(r);
  }
}

/* ============================================================ تایمرها */
const Timers = (() => {
  let items = [];
  function list() { return items.map(i => ({id: i.id, label: i.label, at: i.at})); }
  function cancel(id) { const it = items.find(i => i.id === id); if (it) clearTimeout(it.h); items = items.filter(i => i.id !== id); }
  async function notify(label) {
    toast("⏰ " + label + " تمام شد");
    speak("تایمر " + label + " تمام شد");
    try {
      if ("Notification" in window) {
        if (Notification.permission === "default") await Notification.requestPermission();
        if (Notification.permission === "granted") { const r = await navigator.serviceWorker.getRegistration(); if (r) r.showNotification("J.A.R.V.I.S", {body: "⏰ " + label + " تمام شد", icon: "icon-192.png"}); else new Notification("J.A.R.V.I.S", {body: label}); }
      }
    } catch (e) {}
  }
  function set(seconds, label) {
    const id = Date.now() + "" + Math.random().toString(36).slice(2, 6), at = Date.now() + seconds * 1000;
    const h = setTimeout(() => { items = items.filter(i => i.id !== id); notify(label); renderTimers(); }, seconds * 1000);
    items.push({id, label, at, h});
    return {id, at};
  }
  return {set, list, cancel};
})();

/* ============================================================ صدا: خروجی (TTS) */
let voices = [];
if ("speechSynthesis" in window) { voices = speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => voices = speechSynthesis.getVoices(); }
let warnedVoice = false;
function speak(text, onend) {
  if (!cfg.voice || !("speechSynthesis" in window) || !text) return onend && onend();
  const fa = C.isFa(text);
  const v = voices.find(x => x.lang.toLowerCase().startsWith(fa ? "fa" : "en"));
  if (fa && !v) {
    if (!warnedVoice) { warnedVoice = true; addSystem("گوشی صدای فارسی ندارد. در تنظیمات گوشی یک موتور Text-to-speech با زبان فارسی نصب کنید؛ فعلاً فقط متن نمایش داده می‌شود."); }
    return onend && onend();
  }
  speechSynthesis.cancel();
  const plain = text.replace(/```[\s\S]*?```/g, " کد ").replace(/[`*#_>~|]/g, "").replace(/https?:\/\/\S+/g, " لینک ");
  const u = new SpeechSynthesisUtterance(plain.slice(0, 1200));
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-US";
  u.rate = cfg.rate || 1;
  u.onend = u.onerror = () => onend && onend();
  speechSynthesis.speak(u);
}

/* ============================================================ صدا: ورودی (STT) */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, live = false, recActive = false;
function startListen() {
  if (!SR) { addSystem("مرورگر شما تشخیص گفتار ندارد. از Chrome روی اندروید استفاده کنید (صفحه باید https باشد)."); return; }
  if (recActive) return;
  try { rec && rec.abort(); } catch (e) {}
  rec = new SR(); rec.lang = cfg.lang; rec.interimResults = false; rec.maxAlternatives = 1;
  let got = false;
  rec.onstart = () => { recActive = true; setStatus("LISTENING", "listen"); $("#mic").classList.add("on"); };
  rec.onresult = e => { got = true; send(e.results[0][0].transcript); };
  rec.onerror = e => {
    if (e.error === "no-speech" || e.error === "aborted") return;
    addSystem("خطای میکروفون: " + e.error + (e.error === "not-allowed" ? " — اجازه‌ی میکروفون را در مرورگر بدهید." : ""));
    live = false; $("#liveBtn").classList.remove("on");
  };
  rec.onend = () => { recActive = false; $("#mic").classList.remove("on"); if (!got) { setStatus("ONLINE"); if (live) setTimeout(startListen, 350); } };
  try { rec.start(); } catch (e) {}
}

/* ============================================================ دستگاه / موقعیت مکانی */
async function getLocation() {
  if (!("geolocation" in navigator)) throw new Error("GPS در این مرورگر نیست.");
  return new Promise((res, rej) => navigator.geolocation.getCurrentPosition(
    p => res({lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy}),
    e => rej(new Error("دسترسی به موقعیت مکانی رد شد یا در دسترس نیست: " + e.message)),
    {timeout: 10000, maximumAge: 60000}));
}
async function deviceStatus() {
  let battery = null;
  try { if (navigator.getBattery) { const b = await navigator.getBattery(); battery = {level_pct: Math.round(b.level * 100), charging: b.charging}; } } catch (e) {}
  return {online: navigator.onLine, language: navigator.language, screen: innerWidth + "x" + innerHeight, battery, standalone: matchMedia("(display-mode: standalone)").matches};
}
async function copyText(t) { try { await navigator.clipboard.writeText(t); toast("کپی شد"); } catch (e) { toast("کپی نشد"); } }

/* ============================================================ ابزارها: اجرای عملی + متصل به UI */
function toolDeps(bubbleApi) {
  return {
    fetch: (url, opt) => fetch(url, opt),
    now: () => new Date(),
    getLocation, device: deviceStatus, copy: copyText,
    setTimer: (s, l) => Timers.set(s, l), listTimers: () => Timers.list().map(t => ({label: t.label, seconds_left: Math.max(0, Math.round((t.at - Date.now()) / 1000))})),
    notes: {add: (t, x) => Notes.add(t, x), list: () => Notes.list_(), remove: t => Notes.remove(t)},
    memory: {add: f => Memory.add(f), remove: t => Memory.remove(t)},
    setTheme: t => { cfg.theme = t; saveCfg(); applyTheme(t); $$(".th-chips i").forEach(i => i.classList.toggle("on", i.dataset.t === t)); },
  };
}
async function execTool(name, args, bubbleApi) {
  const r = await C.runTool(name, args, toolDeps(bubbleApi));
  if (r && r.link) bubbleApi.addLink(r.link.url, r.link.label);
  if (name === "save_note" || name === "delete_note") renderNotes();
  if (name === "remember" || name === "forget") renderMemList();
  if (name === "set_timer" || name === "list_timers") renderTimers();
  return r;
}

function friendlyError(e) {
  const msg = String(e && e.message || e);
  const m = msg.match(/^HTTP (\d+)/);
  if (m) {
    const code = m[1];
    if (code === "401" || code === "403") return "کلید API نامعتبر است یا دسترسی ندارد. از ⚙ کلید را بررسی کنید. (" + msg.slice(0, 160) + ")";
    if (code === "404") return "نام مدل پیدا نشد. در ⚙ نام مدل را بررسی کنید. (" + msg.slice(0, 160) + ")";
    if (code === "429") return "تعداد درخواست‌ها زیاد بوده؛ کمی صبر کنید و دوباره امتحان کنید.";
    if (code.startsWith("5")) return "سرویس هوش مصنوعی موقتاً در دسترس نیست؛ دوباره امتحان کنید.";
  }
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return "اتصال اینترنت برقرار نیست یا قطع شد.";
  return msg;
}

/* ============================================================ شبکه: استریم Gemini / Anthropic با ابزار */
async function* streamGemini(history, bubbleApi, signal) {
  const useSearch = cfg.provider === "gemini" && cfg.search;
  const tools = useSearch ? [{googleSearch: {}}] : [{functionDeclarations: C.geminiDecls()}];
  let contents = history.map(h => h.toGemini());
  for (let round = 0; round < 6; round++) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:streamGenerateContent?alt=sse`;
    const resp = await fetch(url, {method: "POST", signal, headers: {"Content-Type": "application/json", "x-goog-api-key": cfg.key},
      body: JSON.stringify({systemInstruction: {parts: [{text: C.systemPrompt({persona: cfg.persona, memory: Memory.list.map(f => f.text), lang: cfg.lang, search: useSearch})}]}, contents, tools})});
    if (!resp.ok) throw new Error("HTTP " + resp.status + ": " + (await resp.text()).slice(0, 300));
    const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = "";
    let text = "", calls = [], grounding = null;
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      buf += dec.decode(value, {stream: true});
      const {events, rest} = C.parseSSE(buf); buf = rest;
      for (const ev of events) {
        let j; try { j = JSON.parse(ev); } catch (e) { continue; }
        const cand = j.candidates && j.candidates[0]; if (!cand) continue;
        const parts = (cand.content && cand.content.parts) || [];
        for (const p of parts) {
          if (p.text) { text += p.text; yield {type: "text", text}; }
          if (p.functionCall) calls.push({name: p.functionCall.name, args: p.functionCall.args || {}});
        }
        if (cand.groundingMetadata) grounding = cand.groundingMetadata;
      }
    }
    if (grounding) { const chunks = grounding.groundingChunks || []; for (const c of chunks) if (c.web) yield {type: "source", url: c.web.uri, title: c.web.title}; }
    if (!calls.length) { yield {type: "done"}; return; }
    contents.push({role: "model", parts: calls.map(c => ({functionCall: {name: c.name, args: c.args}})).concat(text ? [{text}] : [])});
    const results = [];
    for (const c of calls) {
      const chip = bubbleApi.addToolChip(c.name);
      const r = await execTool(c.name, c.args, bubbleApi);
      bubbleApi.settleChip(chip, !!(r && r.ok));
      results.push({name: c.name, response: r});
    }
    contents.push({role: "user", parts: results.map(r => ({functionResponse: {name: r.name, response: r.response}}))});
  }
  yield {type: "done"};
}

async function* streamAnthropic(history, bubbleApi, signal) {
  let messages = history.map(h => h.toAnthropic());
  for (let round = 0; round < 6; round++) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {method: "POST", signal,
      headers: {"Content-Type": "application/json", "x-api-key": cfg.key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true"},
      body: JSON.stringify({model: cfg.model, max_tokens: 2048, stream: true,
        system: C.systemPrompt({persona: cfg.persona, memory: Memory.list.map(f => f.text), lang: cfg.lang}),
        tools: C.anthropicTools(), messages})});
    if (!resp.ok) throw new Error("HTTP " + resp.status + ": " + (await resp.text()).slice(0, 300));
    const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = "";
    let text = "", blocks = [], curBlock = null, jsonBuf = "", stop = null;
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      buf += dec.decode(value, {stream: true});
      const {events, rest} = C.parseSSE(buf); buf = rest;
      for (const ev of events) {
        let j; try { j = JSON.parse(ev); } catch (e) { continue; }
        if (j.type === "content_block_start") { curBlock = j.content_block; jsonBuf = ""; if (curBlock.type === "tool_use") curBlock = {...curBlock, input: {}}; }
        else if (j.type === "content_block_delta") {
          if (j.delta.type === "text_delta") { text += j.delta.text; yield {type: "text", text}; }
          else if (j.delta.type === "input_json_delta") jsonBuf += j.delta.partial_json;
        } else if (j.type === "content_block_stop") {
          if (curBlock && curBlock.type === "tool_use") { try { curBlock.input = jsonBuf ? JSON.parse(jsonBuf) : {}; } catch (e) { curBlock.input = {}; } blocks.push(curBlock); }
          curBlock = null;
        } else if (j.type === "message_delta") { stop = j.delta.stop_reason; }
      }
    }
    if (stop !== "tool_use" || !blocks.length) { yield {type: "done"}; return; }
    const assistantContent = []; if (text) assistantContent.push({type: "text", text}); for (const b of blocks) assistantContent.push({type: "tool_use", id: b.id, name: b.name, input: b.input});
    messages.push({role: "assistant", content: assistantContent});
    const toolResults = [];
    for (const b of blocks) {
      const chip = bubbleApi.addToolChip(b.name);
      const r = await execTool(b.name, b.input, bubbleApi);
      bubbleApi.settleChip(chip, !!(r && r.ok));
      toolResults.push({type: "tool_result", tool_use_id: b.id, content: JSON.stringify(r)});
    }
    messages.push({role: "user", content: toolResults});
  }
  yield {type: "done"};
}

/* ============================================================ مدل پیام برای تاریخچه */
class Msg {
  constructor(role, text, imgData) { this.role = role; this.text = text; this.imgData = imgData || null; }
  toGemini() {
    const parts = [];
    if (this.imgData) { const [, mime, b64] = this.imgData.match(/^data:([^;]+);base64,(.*)$/) || []; if (b64) parts.push({inlineData: {mimeType: mime, data: b64}}); }
    if (this.text) parts.push({text: this.text});
    return {role: this.role === "user" ? "user" : "model", parts};
  }
  toAnthropic() {
    const content = [];
    if (this.imgData) { const [, mime, b64] = this.imgData.match(/^data:([^;]+);base64,(.*)$/) || []; if (b64) content.push({type: "image", source: {type: "base64", media_type: mime, data: b64}}); }
    if (this.text) content.push({type: "text", text: this.text});
    return {role: this.role, content};
  }
}

/* ============================================================ ارسال پیام */
let busy = false, curAbort = null, pendingImage = null;

async function send(text, opts) {
  opts = opts || {};
  text = (text == null ? $("#in").value : text).trim();
  const img = opts.imgData || pendingImage;
  if (!text && !img) return;
  if (busy) { toast("صبر کنید تا پاسخ قبلی تمام شود"); return; }
  $("#in").value = ""; autoGrow(); clearAttach();

  const low = norm(text);
  if (low === "/clear" || low === "پاک کن") { const c = Chats.ensure(); c.msgs = []; Chats.save(); showWelcome(); return; }
  if (low === "/new") { Chats.create(); renderChatList(); loadChat(); return; }

  const c = Chats.ensure();
  addUser(text, img);
  c.msgs.push(new Msg("user", text, img));
  if (c.msgs.length === 1) { c.title = text.slice(0, 40) || "تصویر"; }
  Chats.touch(c); renderChatList();

  // مسیر محلی سریع (بدون تماس با API) فقط برای متن خالص بدون تصویر
  if (!img) {
    const lc = C.localCommand(text);
    if (lc) {
      const b = addAssistant();
      const chip = b.addToolChip(lc.tool);
      const r = await execTool(lc.tool, lc.args, b);
      b.settleChip(chip, !!(r && r.ok));
      const LOCAL_MSG = {
        get_datetime: () => r.ok ? ("امروز " + r.weekday + "، " + r.persian) : null,
        calculate: () => r.ok ? (lc.args.expression + " = " + r.formatted) : null,
        set_timer: () => r.ok ? ("تایمر «" + lc.args.label + "» برای " + lc.args.seconds + " ثانیه دیگر تنظیم شد.") : null,
        open_url: () => r.ok ? ("سایت آماده است، دکمه‌ی زیر را بزنید.") : null,
        open_app: () => r.ok ? ("«" + (r.link && r.link.label || lc.args.name) + "» آماده است، دکمه‌ی زیر را بزنید.") : null,
        web_search: () => r.ok ? ("نتایج جستجو آماده است.") : null,
      };
      const msg = r.ok ? ((LOCAL_MSG[lc.tool] && LOCAL_MSG[lc.tool]()) || "انجام شد.") : ("خطا: " + r.error);
      b.setText(msg);
      c.msgs.push(new Msg("assistant", msg)); Chats.save();
      speak(msg);
      return;
    }
  }

  if (!cfg.key) { addError("کلید API تنظیم نشده. دکمه‌ی ⚙ را بزنید."); return; }

  busy = true; setStatus("THINKING", "think"); $("#send").classList.add("stop"); $("#send").textContent = "STOP";
  curAbort = new AbortController();
  const b = addAssistant();
  try {
    const gen = cfg.provider === "anthropic" ? streamAnthropic(c.msgs, b, curAbort.signal) : streamGemini(c.msgs, b, curAbort.signal);
    for await (const ev of gen) {
      if (ev.type === "text") b.setText(ev.text);
      else if (ev.type === "source") b.addSource(ev.url, ev.title);
    }
    const finalText = b.finish();
    if (finalText) { c.msgs.push(new Msg("assistant", finalText)); Chats.save(); speak(finalText); }
    setStatus("ONLINE");
  } catch (e) {
    if (e.name === "AbortError") { b.appendText("\n\n[متوقف شد]"); setStatus("ONLINE"); }
    else { b.el.remove(); addError(friendlyError(e)); }
  } finally {
    busy = false; curAbort = null; $("#send").classList.remove("stop"); $("#send").textContent = "SEND";
  }
}

/* ============================================================ تصویر ضمیمه */
function clearAttach() { pendingImage = null; $("#attach").classList.remove("on"); $("#attachImg").src = ""; }
function readImage(file) {
  if (!file.type.startsWith("image/")) { toast("فقط فایل تصویر"); return; }
  if (file.size > 8 * 1024 * 1024) { toast("حجم تصویر زیاد است (حداکثر ۸ مگابایت)"); return; }
  const r = new FileReader();
  r.onload = () => { pendingImage = r.result; $("#attachImg").src = pendingImage; $("#attachName").textContent = file.name; $("#attach").classList.add("on"); $("#in").focus(); };
  r.readAsDataURL(file);
}

/* ============================================================ گفتگوی زنده (LIVE) */
function toggleLive() {
  live = !live; $("#liveBtn").classList.toggle("on", live);
  if (live) {
    if (!cfg.voice) { cfg.voice = true; saveCfg(); }
    addSystem("گفتگوی پیوسته روشن شد؛ فقط صحبت کنید.");
    startListen();
  } else { try { rec && rec.abort(); } catch (e) {} setStatus("ONLINE"); }
}
const origSpeak = speak;
speak = function (text, onend) { origSpeak(text, () => { onend && onend(); if (live && !busy) setTimeout(startListen, 250); }); };

/* ============================================================ دکمه‌ها / اینپوت */
const inputEl = $("#in");
function autoGrow() { inputEl.style.height = "auto"; inputEl.style.height = Math.min(140, inputEl.scrollHeight) + "px"; }
inputEl.addEventListener("input", autoGrow);
inputEl.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
$("#f").addEventListener("submit", e => { e.preventDefault(); if (busy) { curAbort && curAbort.abort(); } else send(); });
$("#mic").addEventListener("click", () => { speechSynthesis && speechSynthesis.cancel(); startListen(); });
$("#liveBtn").addEventListener("click", toggleLive);
$("#searchBtn").addEventListener("click", () => {
  if (cfg.provider !== "gemini") { toast("جستجوی وب فقط با Gemini کار می‌کند"); return; }
  cfg.search = !cfg.search; saveCfg(); $("#searchBtn").classList.toggle("on", cfg.search);
  toast(cfg.search ? "جستجوی وب روشن شد" : "جستجوی وب خاموش شد");
});
$("#imgBtn").addEventListener("click", () => $("#fileIn").click());
$("#fileIn").addEventListener("change", e => { if (e.target.files[0]) readImage(e.target.files[0]); e.target.value = ""; });
$("#attachX").addEventListener("click", clearAttach);
chatEl.addEventListener("paste", e => { const f = [...(e.clipboardData.files || [])][0]; if (f) readImage(f); });
chatEl.addEventListener("click", e => {
  const btn = e.target.closest('[data-act="copycode"]');
  if (btn) { const code = btn.closest(".code").querySelector("code").textContent; copyText(code); btn.textContent = "✓"; setTimeout(() => btn.textContent = "copy", 1200); }
});
$("#orb").addEventListener("click", () => { speechSynthesis && speechSynthesis.cancel(); startListen(); });

/* ============================================================ درآور گفتگوها */
function renderChatList() {
  const box = $("#chats"); box.innerHTML = "";
  for (const c of Chats.all) {
    const row = document.createElement("div"); row.className = "ci" + (c.id === Chats.curId ? " cur" : "");
    const span = document.createElement("span"); span.dir = "auto"; span.textContent = c.title || "گفتگو"; row.appendChild(span);
    const del = document.createElement("button"); del.type = "button"; del.textContent = "🗑"; row.appendChild(del);
    row.addEventListener("click", e => { if (e.target === del) return; Chats.curId = c.id; Chats.save(); loadChat(); closeDrawer(); });
    del.addEventListener("click", () => { Chats.remove(c.id); renderChatList(); loadChat(); });
    box.appendChild(row);
  }
}
function loadChat() {
  const c = Chats.ensure(); chatEl.innerHTML = "";
  if (!c.msgs.length) { showWelcome(); renderChatList(); return; }
  for (const m of c.msgs) {
    if (m.role === "user") addUser(m.text, m.imgData);
    else { const b = addAssistant(); b.setText(m.text); }
  }
  renderChatList();
}
function openDrawer() { $("#drawer").classList.add("on"); $("#scrim").classList.add("on"); }
function closeDrawer() { $("#drawer").classList.remove("on"); $("#scrim").classList.remove("on"); }
$("#menuBtn").addEventListener("click", openDrawer);
$("#closeDrawer").addEventListener("click", closeDrawer);
$("#scrim").addEventListener("click", closeDrawer);
$("#newChat").addEventListener("click", () => { Chats.create(); renderChatList(); loadChat(); closeDrawer(); });

/* ============================================================ تنظیمات دیالوگ */
const dlg = $("#dlg");
function fillSettings() {
  $("#k").value = cfg.key; $("#p").value = cfg.provider; $("#m").value = cfg.model;
  $("#sg").checked = !!cfg.search; $("#sg").disabled = cfg.provider !== "gemini";
  $("#persona").value = cfg.persona || ""; $("#l").value = cfg.lang; $("#v").checked = cfg.voice;
  $("#rate").value = cfg.rate; $("#rateV").textContent = cfg.rate.toFixed(1);
  $("#fs").value = cfg.fontSize; $("#fsV").textContent = cfg.fontSize;
  renderMemList();
}
$("#setBtn").addEventListener("click", () => { fillSettings(); dlg.showModal(); });
$("#dlgClose").addEventListener("click", () => dlg.close());
$("#p").addEventListener("change", () => { $("#m").value = $("#p").value === "gemini" ? "gemini-2.5-flash" : "claude-sonnet-5-5"; $("#sg").disabled = $("#p").value !== "gemini"; });
$("#rate").addEventListener("input", () => $("#rateV").textContent = (+$("#rate").value).toFixed(1));
$("#fs").addEventListener("input", () => { $("#fsV").textContent = $("#fs").value; applyFontSize(+$("#fs").value); });
const THEME_HEX = {cyan: "#00f0ff", green: "#00ff9c", purple: "#b388ff", red: "#ff4d6d", amber: "#ffb000"};
(function buildThemeChips() {
  const box = $("#themeChips"); box.innerHTML = "";
  for (const t of C.THEMES) {
    const i = document.createElement("i"); i.style.background = THEME_HEX[t]; i.dataset.t = t;
    i.className = t === cfg.theme ? "on" : ""; i.addEventListener("click", () => { applyTheme(t); $$(".th-chips i").forEach(x => x.classList.toggle("on", x === i)); });
    box.appendChild(i);
  }
})();
$("#save").addEventListener("click", () => {
  cfg = {...cfg, key: $("#k").value.trim(), provider: $("#p").value, model: $("#m").value.trim() || DEF_CFG.model,
    search: $("#sg").checked, persona: $("#persona").value.trim(), lang: $("#l").value, voice: $("#v").checked,
    rate: +$("#rate").value, fontSize: +$("#fs").value, theme: document.querySelector(".th-chips i.on")?.dataset.t || cfg.theme};
  saveCfg(); applyTheme(cfg.theme); applyFontSize(cfg.fontSize);
  $("#searchBtn").classList.toggle("on", cfg.search);
  dlg.close(); toast("تنظیمات ذخیره شد");
});
$("#memClear").addEventListener("click", () => { if (confirm("کل حافظه پاک شود؟")) { Memory.list = []; Memory.save(); renderMemList(); } });

/* یادداشت‌ها و تایمرها به‌عنوان دیالوگ‌های جدا (از پیام سیستمی قابل‌باز شدن) */
$("#notesClose").addEventListener("click", () => $("#notesDlg").close());
$("#timersClose").addEventListener("click", () => $("#timersDlg").close());
function openNotes() { renderNotes(); $("#notesDlg").showModal(); }
function openTimers() { renderTimers(); $("#timersDlg").showModal(); }
$("#notesBtn").addEventListener("click", () => { openNotes(); closeDrawer(); });
$("#timersBtn").addEventListener("click", () => { openTimers(); closeDrawer(); });
setInterval(() => { if ($("#timersDlg").open) renderTimers(); }, 1000);

/* ============================================================ خروجی/ورودی/پاک کردن کامل داده‌ها */
$("#expData").addEventListener("click", () => {
  const data = {cfg, memory: Memory.list, notes: Notes.list, chats: Chats.all, exported_at: new Date().toISOString()};
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "jarvis-backup.json"; a.click();
});
$("#impData").addEventListener("click", () => $("#impFile").click());
$("#impFile").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (d.cfg) { cfg = {...DEF_CFG, ...d.cfg}; saveCfg(); applyTheme(cfg.theme); applyFontSize(cfg.fontSize); }
    if (Array.isArray(d.memory)) { Memory.list = d.memory; Memory.save(); }
    if (Array.isArray(d.notes)) { Notes.list = d.notes; Notes.save(); }
    if (Array.isArray(d.chats)) { Chats.all = d.chats; Chats.curId = d.chats[0] && d.chats[0].id; Chats.save(); }
    toast("وارد شد"); fillSettings(); renderChatList(); loadChat();
  } catch (e2) { toast("فایل معتبر نیست"); }
});
$("#wipeAll").addEventListener("click", () => {
  if (!confirm("همه‌چیز پاک شود؟ این کار برگشت‌ناپذیر است.")) return;
  localStorage.clear(); location.reload();
});

/* ============================================================ آنلاین/آفلاین */
addEventListener("online", () => toast("اتصال اینترنت وصل شد"));
addEventListener("offline", () => toast("اتصال اینترنت قطع شد"));

/* ============================================================ شروع */
applyTheme(cfg.theme); applyFontSize(cfg.fontSize);
$("#searchBtn").classList.toggle("on", cfg.search);
$("#v").checked = cfg.voice;
Chats.ensure(); renderChatList(); loadChat();
startParticles(); boot();
if (!cfg.key) setTimeout(() => { fillSettings(); dlg.showModal(); toast("اول کلید API را وارد کنید"); }, 900);
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
