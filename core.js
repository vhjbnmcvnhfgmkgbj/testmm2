"use strict";
/* Core: منطق خالص و ابزارها (بدون وابستگی مستقیم به DOM) — قابل تست در Node */
const Core = (() => {
  const FA_RE = /[\u0600-\u06FF]/;
  const isFa = t => { const L = [...String(t)].filter(c => /\p{L}/u.test(c)); return L.length > 0 && L.filter(c => FA_RE.test(c)).length / L.length > 0.3; };
  const digits = s => String(s).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  const norm = s => digits(String(s)).trim().toLowerCase().replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[\u200c\u200f\u200e]/g, " ").replace(/\s+/g, " ");
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const enc = encodeURIComponent;

  /* ---------------- Markdown امن ---------------- */
  function inline(t) {
    const codes = [];
    t = t.replace(/`([^`\n]+)`/g, (m, c) => { codes.push(c); return "\u0001" + (codes.length - 1) + "\u0001"; });
    t = esc(t);
    t = t.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/(^|[^*\w])\*([^*\n]+)\*(?![*\w])/g, "$1<em>$2</em>");
    t = t.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    return t.replace(/\u0001(\d+)\u0001/g, (m, i) => "<code>" + esc(codes[+i]) + "</code>");
  }
  function codeHtml(b) {
    return '<div class="code" dir="ltr"><div class="ch"><span>' + esc(b.lang || "code") + '</span><button class="cp" type="button" data-act="copycode">copy</button></div><pre><code>' + esc(b.code) + "</code></pre></div>";
  }
  function renderMarkdown(src) {
    const blocks = [];
    const s = String(src).replace(/```([\w+#.-]*)[ \t]*\n?([\s\S]*?)(?:```|$)/g, (m, lang, code) => {
      blocks.push({lang, code: code.replace(/\n$/, "")}); return "\n\u0000" + (blocks.length - 1) + "\u0000\n";
    });
    const out = []; let list = null, para = [], table = [];
    const flushPara = () => { if (para.length) { out.push("<p>" + para.map(inline).join("<br>") + "</p>"); para = []; } };
    const flushList = () => { if (list) { out.push("<" + list.t + ">" + list.items.map(i => "<li>" + inline(i) + "</li>").join("") + "</" + list.t + ">"); list = null; } };
    const flushTable = () => {
      if (!table.length) return;
      const cells = r => r.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      const rows = table.filter(r => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r) || !/-/.test(r));
      const head = cells(rows[0]), body = rows.slice(1).map(cells);
      out.push('<div class="tw"><table><thead><tr>' + head.map(c => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>" +
        body.map(r => "<tr>" + r.map(c => "<td>" + inline(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>");
      table = [];
    };
    for (const raw of s.split("\n")) {
      const line = raw.replace(/\s+$/, ""); let m;
      if ((m = line.match(/^\u0000(\d+)\u0000$/))) { flushPara(); flushList(); flushTable(); out.push(codeHtml(blocks[+m[1]])); continue; }
      if (/^\s*\|.*\|\s*$/.test(line)) { flushPara(); flushList(); table.push(line); continue; }
      flushTable();
      if (!line.trim()) { flushPara(); flushList(); continue; }
      if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flushPara(); flushList(); const n = Math.min(m[1].length + 2, 6); out.push("<h" + n + ">" + inline(m[2]) + "</h" + n + ">"); continue; }
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flushPara(); flushList(); out.push("<hr>"); continue; }
      if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) { flushPara(); if (!list || list.t !== "ul") { flushList(); list = {t: "ul", items: []}; } list.items.push(m[1]); continue; }
      if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { flushPara(); if (!list || list.t !== "ol") { flushList(); list = {t: "ol", items: []}; } list.items.push(m[1]); continue; }
      if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); flushList(); out.push("<blockquote>" + inline(m[1]) + "</blockquote>"); continue; }
      flushList(); para.push(line);
    }
    flushPara(); flushList(); flushTable();
    return out.join("");
  }

  /* ---------------- ماشین‌حساب امن (بدون eval) ---------------- */
  const FUNCS = {sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
    log: Math.log10, log10: Math.log10, ln: Math.log, log2: Math.log2, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
    exp: Math.exp, min: Math.min, max: Math.max, pow: Math.pow};
  const CONSTS = {pi: Math.PI, e: Math.E};
  function calc(input) {
    let s = digits(input).replace(/×/g, "*").replace(/÷/g, "/").replace(/٫/g, ".").replace(/[،٬]/g, "").replace(/\b\d{1,3}(?:,\d{3})+\b/g, m => m.replace(/,/g, "")).replace(/\*\*/g, "^");
    if (s.length > 200) throw new Error("expression too long");
    const re = /\s*(\d+\.?\d*|\.\d+|[A-Za-z_][A-Za-z_0-9]*|[-+*/^%(),])/y; const tok = []; let pos = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(s))) { tok.push(m[1]); pos = re.lastIndex; }
    if (s.slice(pos).trim()) throw new Error("invalid character: " + s.slice(pos).trim()[0]);
    let i = 0, depth = 0;
    const peek = () => tok[i], next = () => tok[i++];
    const expr = () => { let v = term(); while (peek() === "+" || peek() === "-") { const o = next(); const r = term(); v = o === "+" ? v + r : v - r; } return v; };
    const term = () => { let v = unary(); while (peek() === "*" || peek() === "/" || peek() === "%") { const o = next(); const r = unary(); v = o === "*" ? v * r : o === "/" ? v / r : v % r; } return v; };
    const unary = () => { if (peek() === "-") { next(); return -unary(); } if (peek() === "+") { next(); return unary(); } return power(); };
    const power = () => { const b = atom(); if (peek() === "^") { next(); return Math.pow(b, unary()); } return b; };
    const atom = () => {
      const t = next(); if (t === undefined) throw new Error("unexpected end");
      if (/^[\d.]/.test(t)) return parseFloat(t);
      if (t === "(") { if (++depth > 40) throw new Error("too deep"); const v = expr(); if (next() !== ")") throw new Error("missing )"); depth--; return v; }
      if (/^[A-Za-z_]/.test(t)) {
        const k = t.toLowerCase();
        if (peek() === "(") { next(); const args = []; if (peek() !== ")") { args.push(expr()); while (peek() === ",") { next(); args.push(expr()); } } if (next() !== ")") throw new Error("missing )"); if (!FUNCS[k]) throw new Error("unknown function " + t); return FUNCS[k](...args); }
        if (k in CONSTS) return CONSTS[k]; throw new Error("unknown name " + t);
      }
      throw new Error("unexpected " + t);
    };
    const v = expr(); if (i < tok.length) throw new Error("unexpected " + tok[i]);
    if (!Number.isFinite(v)) throw new Error("result is not finite");
    return v;
  }
  const fmtNum = n => String(+n.toPrecision(12));

  /* ---------------- SSE ---------------- */
  function parseSSE(buf) {
    const parts = buf.split(/\r?\n\r?\n/); const rest = parts.pop(); const events = [];
    for (const p of parts) { const d = p.split(/\r?\n/).filter(l => l.startsWith("data:")).map(l => l.slice(5).trimStart()).join("\n"); if (d) events.push(d); }
    return {events, rest};
  }

  /* ---------------- برنامه‌ها و لینک‌ها ---------------- */
  const APPS = [
    [["telegram", "تلگرام"], "tg://", "تلگرام"], [["whatsapp", "واتساپ", "واتس اپ"], "whatsapp://send", "واتساپ"],
    [["instagram", "اینستاگرام", "اینستا"], "instagram://app", "اینستاگرام"], [["youtube", "یوتیوب"], "https://www.youtube.com/", "یوتیوب"],
    [["spotify", "اسپاتیفای"], "spotify:", "اسپاتیفای"], [["gmail", "جیمیل", "email", "ایمیل"], "mailto:", "ایمیل"],
    [["maps", "نقشه", "نقشه گوگل", "google maps"], "https://www.google.com/maps", "نقشه"], [["discord", "دیسکورد"], "discord://", "دیسکورد"],
    [["twitter", "توییتر", "x"], "twitter://", "توییتر"], [["netflix", "نتفلیکس"], "nflx://", "نتفلیکس"],
    [["play store", "پلی استور", "فروشگاه پلی"], "market://", "Play Store"], [["phone", "تماس", "شماره گیر", "dialer"], "tel:", "شماره‌گیر"],
    [["messages", "پیامک", "sms"], "sms:", "پیامک"], [["google", "گوگل"], "https://www.google.com/", "گوگل"],
    [["github", "گیتهاب", "گیت هاب"], "https://github.com/", "GitHub"],
  ];
  const STOP = new Set(["برنامه", "برنامه‌ی", "اپ", "اپلیکیشن", "app", "application", "the", "لطفا", "جارویس", "jarvis"]);
  const clean = s => norm(s).replace(/[.!؟?،,"']/g, " ").split(" ").filter(w => w && !STOP.has(w)).join(" ");
  const findApp = n => { n = clean(n); return APPS.find(x => x[0].includes(n)) || null; };
  function fixUrl(u) { u = String(u).trim(); if (!/^https?:\/\//i.test(u)) u = "https://" + u; return /^https?:\/\/[^\s]+\.[^\s]+$/i.test(u) ? u : null; }

  /* ---------------- تعریف ابزارها ---------------- */
  const S = {type: "string"}, N = {type: "number"};
  const TOOLS = [
    {name: "get_datetime", description: "Get the current date and time (Gregorian and Persian/Jalali), weekday and timezone.", parameters: {type: "object", properties: {}}},
    {name: "calculate", description: "Evaluate a math expression exactly. Supports + - * / ^ % parentheses, sqrt, sin, cos, tan, log, ln, abs, round, floor, ceil, min, max, pi, e.", parameters: {type: "object", properties: {expression: S}, required: ["expression"]}},
    {name: "get_weather", description: "Current weather and 3-day forecast. If city is omitted, uses the phone's GPS location (asks permission).", parameters: {type: "object", properties: {city: {type: "string", description: "City name, e.g. Tehran or تهران"}}}},
    {name: "wikipedia_search", description: "Look up a factual summary on Wikipedia for a topic.", parameters: {type: "object", properties: {query: S, lang: {type: "string", description: "fa or en. Default fa."}}, required: ["query"]}},
    {name: "open_url", description: "Prepare a button for the user to open a website URL.", parameters: {type: "object", properties: {url: S}, required: ["url"]}},
    {name: "web_search", description: "Prepare a Google search button for the user.", parameters: {type: "object", properties: {query: S}, required: ["query"]}},
    {name: "youtube_search", description: "Prepare a YouTube search button for the user.", parameters: {type: "object", properties: {query: S}, required: ["query"]}},
    {name: "map_search", description: "Prepare a Google Maps button for a place or directions query.", parameters: {type: "object", properties: {query: S}, required: ["query"]}},
    {name: "open_app", description: "Prepare a button to open an app by common name (telegram, whatsapp, instagram, youtube, spotify, gmail, discord, twitter, netflix, maps, phone, messages).", parameters: {type: "object", properties: {name: S}, required: ["name"]}},
    {name: "call_phone", description: "Prepare a button to call a phone number.", parameters: {type: "object", properties: {number: S}, required: ["number"]}},
    {name: "send_message", description: "Prepare a button to send an SMS (kind=sms) or an email (kind=email).", parameters: {type: "object", properties: {kind: {type: "string", description: "sms or email"}, to: S, subject: S, body: S}, required: ["kind", "body"]}},
    {name: "set_timer", description: "Set a timer/reminder that notifies the user when it ends.", parameters: {type: "object", properties: {seconds: N, label: S}, required: ["seconds"]}},
    {name: "list_timers", description: "List active timers.", parameters: {type: "object", properties: {}}},
    {name: "save_note", description: "Save a note with a title.", parameters: {type: "object", properties: {title: S, text: S}, required: ["title", "text"]}},
    {name: "list_notes", description: "List all saved notes.", parameters: {type: "object", properties: {}}},
    {name: "delete_note", description: "Delete notes whose title contains the given text.", parameters: {type: "object", properties: {title: S}, required: ["title"]}},
    {name: "remember", description: "Save a durable fact about the user (name, preferences, etc.) to long-term memory. Use when the user asks you to remember something.", parameters: {type: "object", properties: {fact: S}, required: ["fact"]}},
    {name: "forget", description: "Remove memory facts containing the given text.", parameters: {type: "object", properties: {text: S}, required: ["text"]}},
    {name: "get_device_status", description: "Get battery level, online status, language and screen size of the phone.", parameters: {type: "object", properties: {}}},
    {name: "get_location", description: "Get the phone's GPS coordinates (asks permission).", parameters: {type: "object", properties: {}}},
    {name: "copy_to_clipboard", description: "Copy text to the phone clipboard.", parameters: {type: "object", properties: {text: S}, required: ["text"]}},
    {name: "set_theme", description: "Change the app color theme.", parameters: {type: "object", properties: {theme: {type: "string", description: "cyan, green, purple, red or amber"}}, required: ["theme"]}},
  ];
  const upper = o => Array.isArray(o) ? o.map(upper) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k === "type" && typeof v === "string" ? v.toUpperCase() : upper(v)])) : o;
  const geminiDecls = () => TOOLS.map(t => ({name: t.name, description: t.description, parameters: upper(t.parameters)}));
  const anthropicTools = () => TOOLS.map(t => ({name: t.name, description: t.description, input_schema: t.parameters}));
  const WMO = {0: "صاف", 1: "عمدتاً صاف", 2: "نیمه‌ابری", 3: "ابری", 45: "مه", 48: "مه یخ‌زده", 51: "نم‌نم باران", 53: "نم‌نم باران", 55: "نم‌نم شدید", 61: "باران ضعیف", 63: "باران", 65: "باران شدید",
    66: "باران یخ‌زده", 67: "باران یخ‌زده", 71: "برف ضعیف", 73: "برف", 75: "برف شدید", 77: "دانه‌های برف", 80: "رگبار ضعیف", 81: "رگبار", 82: "رگبار شدید", 85: "بارش برف", 86: "بارش برف شدید", 95: "رعدوبرق", 96: "رعدوبرق با تگرگ", 99: "رعدوبرق شدید با تگرگ"};
  const THEMES = ["cyan", "green", "purple", "red", "amber"];

  async function jget(deps, url) { const r = await deps.fetch(url); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }
  const link = (url, label) => ({url, label});

  async function runTool(name, a, deps) {
    a = a || {};
    try {
      switch (name) {
        case "get_datetime": {
          const d = deps.now();
          return {ok: true, iso: d.toISOString(), gregorian: d.toLocaleString("en-GB"), persian: d.toLocaleString("fa-IR-u-ca-persian", {dateStyle: "full", timeStyle: "short"}),
            weekday: d.toLocaleDateString("fa-IR", {weekday: "long"}), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone};
        }
        case "calculate": { const v = calc(a.expression); return {ok: true, expression: a.expression, result: v, formatted: fmtNum(v)}; }
        case "get_weather": {
          let lat, lon, place;
          if (a.city) {
            const g = await jget(deps, "https://geocoding-api.open-meteo.com/v1/search?name=" + enc(a.city) + "&count=1&language=fa&format=json");
            const r = g.results && g.results[0]; if (!r) return {ok: false, error: "city not found: " + a.city};
            lat = r.latitude; lon = r.longitude; place = [r.name, r.country].filter(Boolean).join("، ");
          } else { const p = await deps.getLocation(); lat = p.lat; lon = p.lon; place = "موقعیت فعلی"; }
          const w = await jget(deps, "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
            "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3");
          const c = w.current, d = w.daily;
          return {ok: true, place, now: {temp_c: c.temperature_2m, feels_like_c: c.apparent_temperature, humidity_pct: c.relative_humidity_2m, wind_kmh: c.wind_speed_10m, condition: WMO[c.weather_code] || String(c.weather_code)},
            forecast: d.time.map((t, i) => ({date: t, min_c: d.temperature_2m_min[i], max_c: d.temperature_2m_max[i], rain_chance_pct: d.precipitation_probability_max[i], condition: WMO[d.weather_code[i]] || String(d.weather_code[i])}))};
        }
        case "wikipedia_search": {
          const tryLang = async lang => {
            const j = await jget(deps, "https://" + lang + ".wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=" + enc(a.query) +
              "&gsrlimit=1&prop=extracts%7Cinfo&exintro=1&explaintext=1&exchars=1500&inprop=url");
            const pages = j.query && j.query.pages; if (!pages) return null;
            const p = Object.values(pages).sort((x, y) => (x.index || 0) - (y.index || 0))[0]; if (!p) return null;
            return {title: p.title, extract: p.extract, url: p.fullurl || "https://" + lang + ".wikipedia.org/?curid=" + p.pageid, lang};
          };
          const first = a.lang === "en" ? "en" : "fa";
          const r = (await tryLang(first)) || (first === "fa" ? await tryLang("en") : null);
          return r ? {ok: true, ...r, link: link(r.url, "ویکی‌پدیا: " + r.title)} : {ok: false, error: "nothing found"};
        }
        case "open_url": { const u = fixUrl(a.url); return u ? {ok: true, message: "Button shown; the user must tap it to open.", link: link(u, "باز کردن سایت")} : {ok: false, error: "invalid url"}; }
        case "web_search": return {ok: true, message: "Button shown; the user must tap it.", link: link("https://www.google.com/search?q=" + enc(a.query), "نتایج گوگل")};
        case "youtube_search": return {ok: true, message: "Button shown; the user must tap it.", link: link("https://www.youtube.com/results?search_query=" + enc(a.query), "نتایج یوتیوب")};
        case "map_search": return {ok: true, message: "Button shown; the user must tap it.", link: link("https://www.google.com/maps/search/?api=1&query=" + enc(a.query), "نقشه")};
        case "open_app": {
          const app = findApp(a.name || "");
          return app ? {ok: true, message: "Button shown; the user must tap it to open " + app[2] + ".", link: link(app[1], app[2])}
            : {ok: false, error: "This web app can only open apps with deep links: telegram, whatsapp, instagram, youtube, spotify, gmail, discord, twitter, netflix, maps, phone, messages."};
        }
        case "call_phone": return {ok: true, message: "Call button shown.", link: link("tel:" + String(a.number).replace(/[^\d+]/g, ""), "تماس " + a.number)};
        case "send_message": {
          if (a.kind === "email") return {ok: true, message: "Email button shown.", link: link("mailto:" + (a.to || "") + "?subject=" + enc(a.subject || "") + "&body=" + enc(a.body || ""), "ارسال ایمیل")};
          return {ok: true, message: "SMS button shown.", link: link("sms:" + String(a.to || "").replace(/[^\d+]/g, "") + "?body=" + enc(a.body || ""), "ارسال پیامک")};
        }
        case "set_timer": {
          const sec = Math.round(Number(a.seconds)); if (!(sec > 0) || sec > 86400 * 7) return {ok: false, error: "seconds must be between 1 and 604800"};
          const t = await deps.setTimer(sec, a.label || "تایمر"); return {ok: true, id: t.id, ends_at: new Date(t.at).toLocaleTimeString("fa-IR"), seconds: sec};
        }
        case "list_timers": return {ok: true, timers: deps.listTimers()};
        case "save_note": deps.notes.add(a.title, a.text); return {ok: true, saved: a.title};
        case "list_notes": return {ok: true, notes: deps.notes.list()};
        case "delete_note": return {ok: true, deleted: deps.notes.remove(a.title)};
        case "remember": deps.memory.add(a.fact); return {ok: true, remembered: a.fact};
        case "forget": return {ok: true, removed: deps.memory.remove(a.text)};
        case "get_device_status": return {ok: true, ...(await deps.device())};
        case "get_location": { const p = await deps.getLocation(); return {ok: true, latitude: p.lat, longitude: p.lon, accuracy_m: p.acc}; }
        case "copy_to_clipboard": await deps.copy(a.text); return {ok: true, copied: true};
        case "set_theme": { const t = String(a.theme || "").toLowerCase(); if (!THEMES.includes(t)) return {ok: false, error: "theme must be one of " + THEMES.join(", ")}; deps.setTheme(t); return {ok: true, theme: t}; }
        default: return {ok: false, error: "unknown tool " + name};
      }
    } catch (e) { return {ok: false, error: String(e && e.message || e)}; }
  }

  /* ---------------- مسیر سریع محلی (بدون API) ---------------- */
  const FA_OPEN = /^(?:لطفا\s+)?(?:جارویس\s+)?(.+?)\s*(?:رو|را)?\s*(?:باز\s*کن|باز\s*بکن|بازکن|اجرا\s*کن|اجرا\s*بکن|بالا\s*بیار)\s*[.!]?$/;
  const EN_OPEN = /^(?:please\s+)?(?:jarvis\s+)?(?:open|launch|start|run)\s+(.+?)\s*[.!]?$/;
  const FA_SEARCH = /^(?:لطفا\s+)?(?:جارویس\s+)?(.+?)\s*(?:رو|را)?\s*(?:سرچ|جستجو)\s*(?:کن|بکن)\s*$/;
  const EN_SEARCH = /^(?:search(?: for)?|google)\s+(.+)$/;
  const URLRE = /^[\w-]+(\.[\w-]+)*\.(com|org|net|ir|io|dev|app|co|ai|me)(\/\S*)?$/;
  const FA_TIMER = /^(?:لطفا\s+)?(?:یه\s+|یک\s+)?(?:تایمر|زمان\s?سنج)\s*(\d+(?:\.\d+)?)\s*(ثانیه|دقیقه|ساعت)(?:\s*ای)?(?:\s+(?:برای|با عنوان)\s+([^.!؟?]+?))?\s*(?:بذار|بزار|تنظیم کن|شروع کن|کن)?\s*[.!]?$/;
  const EN_TIMER = /^(?:please\s+)?(?:set\s+(?:a\s+)?)?timer\s*(?:for\s+)?(\d+(?:\.\d+)?)\s*(second|sec|minute|min|hour)s?(?:\s+(?:for|called)\s+(.+))?$/;
  function localCommand(text) {
    const t = norm(text);
    if (/^(ساعت|تاریخ|time|date|ساعت چنده|الان ساعت چنده)\??$/.test(t)) return {tool: "get_datetime", args: {}};
    let m = t.match(FA_TIMER) || t.match(EN_TIMER);
    if (m) { const u = m[2], mult = /^(ثانیه|sec)/.test(u) ? 1 : /^(دقیقه|min)/.test(u) ? 60 : 3600; return {tool: "set_timer", args: {seconds: Math.round(parseFloat(m[1]) * mult), label: m[3] || "تایمر"}}; }
    m = t.match(FA_SEARCH) || t.match(EN_SEARCH);
    if (m) return {tool: "web_search", args: {query: m.slice(1).find(Boolean)}};
    m = t.match(FA_OPEN) || t.match(EN_OPEN);
    if (!m) return null;
    const raw = norm(m[1]).replace(/^[\s.!؟?]+|[\s.!؟?]+$/g, "");
    if (URLRE.test(raw)) return {tool: "open_url", args: {url: raw}};
    const n = clean(m[1]); if (!n) return null;
    return findApp(n) ? {tool: "open_app", args: {name: n}} : null;
  }

  /* ---------------- پرامپت سیستم ---------------- */
  function systemPrompt({persona, memory, now, lang, search}) {
    const d = now || new Date();
    return [
      "You are J.A.R.V.I.S, an extremely capable, witty, concise personal AI assistant living on the user's phone (a PWA).",
      "Current time: " + d.toISOString() + " | Persian date: " + d.toLocaleString("fa-IR-u-ca-persian", {dateStyle: "full", timeStyle: "short"}) + " | timezone: " + Intl.DateTimeFormat().resolvedOptions().timeZone + ".",
      "Reply in the user's language (Persian if they write Persian). Be direct and short unless detail is requested. Light markdown is fine (bold, lists, code blocks); avoid big headings and emojis. Your answers may be read aloud, so keep them natural.",
      search ? "Web search grounding is ON: use it for current/fast-changing facts and rely on the found sources." :
        "You can call tools to act on the phone and fetch live data (weather, Wikipedia, math, timers, notes, memory, links). Prefer calling a tool over guessing. Tools that open links/apps only show a button: after calling them tell the user to tap it. Never claim an app was opened.",
      "Preferred speech language: " + (lang || "fa-IR") + ".",
      memory && memory.length ? "Long-term memory about the user:\n- " + memory.join("\n- ") : "",
      persona ? "Extra instructions from the user: " + persona : "",
    ].filter(Boolean).join("\n");
  }

  return {isFa, norm, esc, renderMarkdown, calc, fmtNum, parseSSE, APPS, findApp, fixUrl, TOOLS, geminiDecls, anthropicTools, runTool, localCommand, systemPrompt, THEMES, upper};
})();
if (typeof module !== "undefined") module.exports = Core;
else window.Core = Core;
