import { renderMarkdown, loadScript } from "./render.js";
import { asciiToWordmat } from "./wordmat.js";
import { STANDARD, KATEGORIER, attachAutocomplete, symbolPalette, textFor, mathContext, symbolPreview } from "./symbols.js";

const MATHLIVE = "https://cdn.jsdelivr.net/npm/mathlive@0.101.0/dist/mathlive.min.js";

const SUPABASE_URL = "https://icenjdbuofsvpxxiryne.supabase.co";
const SUPABASE_KEY = "sb_publishable_sM0PH5Kd5WDsgtg0mbt78g_moQYu27M";
const BUCKET = "filer";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const TYPER = {
  mappe: { navn: "Mappe", flertal: "Mapper", ikon: "📁" },
  projekt: { navn: "Projekt", flertal: "Projekter", ikon: "🧪" },
  post: { navn: "Post", flertal: "Poster", ikon: "📝" },
  link: { navn: "Link", flertal: "Links", ikon: "🔗" },
};
const TYPE_ORDEN = ["mappe", "projekt", "post", "link"];
const STATUSSER = ["idé", "i gang", "pause", "færdig"];
const FARVER = ["", "#2f6fdb", "#7c4dff", "#0f9d8a", "#e0a100", "#e8590c", "#d6336c", "#5c7080"];

const state = {
  user: null,
  items: [],
  byId: new Map(),
  children: new Map(),
  dirty: false,
  dbError: null,
  open: new Set(readJSON("hl-open", [])),
  symbols: STANDARD,
  symbolsSeeded: false,
  symbolsError: null,
};

// ─── Små hjælpere ───────────────────────────────────────────────────────

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const $ = (sel, root = document) => root.querySelector(sel);

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  return el;
}

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  pin: '<path d="M12 17v5M8 3h8l-1 6 3 4H6l3-4-1-6z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14A8 8 0 1 1 10 4a7 7 0 0 0 10 10z"/>',
  auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
};

function icon(name) {
  return h("span", {
    class: "icon",
    html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`,
  });
}

function itemIcon(it) {
  return it.ikon || TYPER[it.type]?.ikon || "📄";
}

function fmtDate(d, withTime = false) {
  return new Date(d).toLocaleDateString("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function relTime(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return "lige nu";
  if (s < 3600) return Math.floor(s / 60) + " min. siden";
  if (s < 86400) return Math.floor(s / 3600) + " t. siden";
  if (s < 86400 * 7) return Math.floor(s / 86400) + " d. siden";
  return fmtDate(d);
}

function fmtSize(n) {
  if (n == null) return "";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return (i ? n.toFixed(1) : n) + " " + u[i];
}

function plainText(md) {
  return (md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (_, a, __, b) => b || a)
    .replace(/[#>*_`~|\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(it, n = 140) {
  const t = it.beskrivelse || plainText(it.indhold);
  return t.length > n ? t.slice(0, n).trim() + "…" : t;
}

function wordCount(md) {
  const t = plainText(md);
  return t ? t.split(" ").length : 0;
}

function toast(msg, kind = "") {
  const t = h("div", { class: "toast " + kind }, msg);
  $("#toasts").append(t);
  setTimeout(() => t.classList.add("out"), 3200);
  setTimeout(() => t.remove(), 3600);
}

function download(name, content, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = h("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isTyping(e) {
  const t = e.target;
  return t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
}

// ─── Data ───────────────────────────────────────────────────────────────

async function loadItems() {
  const { data, error } = await db.from("elementer").select("*").order("titel");
  if (error) {
    state.dbError = error;
    state.items = [];
  } else {
    state.dbError = null;
    state.items = data;
  }
  indexItems();
}

function indexItems() {
  state.byId = new Map(state.items.map((i) => [i.id, i]));
  state.children = new Map();
  for (const it of state.items) {
    const key = it.parent_id && state.byId.has(it.parent_id) ? it.parent_id : "root";
    if (!state.children.has(key)) state.children.set(key, []);
    state.children.get(key).push(it);
  }
  for (const list of state.children.values()) list.sort(sortItems);
}

function sortItems(a, b) {
  return (
    (b.fastgjort ? 1 : 0) - (a.fastgjort ? 1 : 0) ||
    TYPE_ORDEN.indexOf(a.type) - TYPE_ORDEN.indexOf(b.type) ||
    a.titel.localeCompare(b.titel, "da", { numeric: true })
  );
}

const kids = (id) => state.children.get(id || "root") || [];
const isOwner = (it) => !!(state.user && it && it.user_id === state.user.id);
const canContain = (it) => it && it.type !== "link";

function ancestors(it) {
  const out = [];
  let p = it && state.byId.get(it.parent_id);
  while (p && !out.includes(p)) {
    out.unshift(p);
    p = state.byId.get(p.parent_id);
  }
  return out;
}

function descendants(id) {
  const out = [];
  const walk = (pid) => {
    for (const c of kids(pid)) {
      out.push(c);
      walk(c.id);
    }
  };
  walk(id);
  return out;
}

function pathText(it) {
  return ancestors(it).map((a) => a.titel).join(" / ");
}

async function loadFiles(elementId) {
  const { data, error } = await db.from("filer").select("*").eq("element_id", elementId).order("oprettet");
  if (error || !data.length) return [];
  const { data: signed } = await db.storage.from(BUCKET).createSignedUrls(data.map((f) => f.sti), 3600);
  data.forEach((f, i) => {
    f.url = signed?.[i]?.signedUrl || null;
    f.downloadUrl = f.url ? f.url + "&download=" + encodeURIComponent(f.navn) : null;
  });
  return data;
}

function fileRef(f) {
  const ref = "fil:" + encodeURIComponent(f.navn);
  return isImage(f) ? `![${f.navn}](${ref})` : `[${f.navn}](${ref})`;
}

function isImage(f) {
  return (f.mime || "").startsWith("image/");
}

function fileEmoji(f) {
  const ext = (f.navn.split(".").pop() || "").toLowerCase();
  if (isImage(f)) return "🖼️";
  if (ext === "pdf") return "📕";
  if (["py", "js", "ts", "c", "cpp", "rs", "go", "java", "m", "r", "jl", "ipynb"].includes(ext)) return "💻";
  if (["csv", "xlsx", "xls", "json", "tsv"].includes(ext)) return "📊";
  if (["zip", "tar", "gz", "7z"].includes(ext)) return "🗜️";
  if (["mp4", "mov", "webm"].includes(ext)) return "🎬";
  if (["mp3", "wav", "m4a", "flac"].includes(ext)) return "🎵";
  if (["stl", "obj", "step", "stp"].includes(ext)) return "🧊";
  return "📄";
}

async function uploadFiles(elementId, fileList) {
  const added = [];
  for (const file of fileList) {
    if (file.size > 50 * 1024 * 1024) {
      toast(`${file.name} er større end 50 MB`, "error");
      continue;
    }
    const navn = file.name || `indsat-${Date.now()}.png`;
    const safe = navn.normalize("NFKD").replace(/[^\w.\-]+/g, "_");
    const sti = `${state.user.id}/${elementId}/${Date.now()}-${safe}`;
    toast(`Uploader ${navn}…`);
    const up = await db.storage.from(BUCKET).upload(sti, file, { contentType: file.type || undefined });
    if (up.error) {
      toast(`Upload fejlede: ${up.error.message}`, "error");
      continue;
    }
    const { data, error } = await db
      .from("filer")
      .insert({ element_id: elementId, sti, navn, mime: file.type || null, stoerrelse: file.size })
      .select()
      .single();
    if (error) {
      await db.storage.from(BUCKET).remove([sti]);
      toast(`Kunne ikke gemme ${navn}: ${error.message}`, "error");
      continue;
    }
    added.push(data);
  }
  if (added.length) toast(`${added.length} fil${added.length > 1 ? "er" : ""} uploadet`, "ok");
  return added;
}

async function deleteFile(f) {
  if (!confirm(`Slet filen "${f.navn}"?`)) return false;
  await db.storage.from(BUCKET).remove([f.sti]);
  const { error } = await db.from("filer").delete().eq("id", f.id);
  if (error) {
    toast("Kunne ikke slette: " + error.message, "error");
    return false;
  }
  toast("Filen er slettet");
  return true;
}

async function deleteItem(it) {
  const under = descendants(it.id);
  const msg = under.length
    ? `Slet "${it.titel}" og ${under.length} element${under.length > 1 ? "er" : ""} indeni? Det kan ikke fortrydes.`
    : `Slet "${it.titel}"? Det kan ikke fortrydes.`;
  if (!confirm(msg)) return;
  const ids = [it.id, ...under.map((u) => u.id)];
  const { data: files } = await db.from("filer").select("sti").in("element_id", ids);
  if (files && files.length) await db.storage.from(BUCKET).remove(files.map((f) => f.sti));
  const { error } = await db.from("elementer").delete().eq("id", it.id);
  if (error) return toast("Kunne ikke slette: " + error.message, "error");
  toast(`"${it.titel}" er slettet`);
  await refresh();
  location.hash = it.parent_id && state.byId.has(it.parent_id) ? "#/e/" + it.parent_id : "#/";
}

async function moveItem(id, parentId) {
  const it = state.byId.get(id);
  if (!it || it.parent_id === parentId || id === parentId) return;
  if (parentId && descendants(id).some((d) => d.id === parentId)) {
    return toast("Et element kan ikke flyttes ind i sig selv", "error");
  }
  const { error } = await db.from("elementer").update({ parent_id: parentId }).eq("id", id);
  if (error) return toast("Kunne ikke flytte: " + error.message, "error");
  const target = parentId ? state.byId.get(parentId).titel : "øverste niveau";
  toast(`Flyttede "${it.titel}" til ${target}`, "ok");
  if (parentId) state.open.add(parentId);
  await refresh(true);
}

async function refresh(rerouteView = false) {
  await loadItems();
  renderSidebar();
  if (rerouteView) route();
}

// ─── Tema ───────────────────────────────────────────────────────────────

function applyTheme(t) {
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  const btn = $("#themeBtn");
  btn.replaceChildren(icon(t === "light" ? "sun" : t === "dark" ? "moon" : "auto"));
  btn.title = "Tema: " + (t === "light" ? "lyst" : t === "dark" ? "mørkt" : "følger systemet");
}

function cycleTheme() {
  const cur = readJSON("hl-theme", "");
  const next = cur === "" ? "light" : cur === "light" ? "dark" : "";
  writeJSON("hl-theme", next);
  applyTheme(next);
  toast("Tema: " + (next === "light" ? "lyst" : next === "dark" ? "mørkt" : "følger systemet"));
}

// ─── Topbar og sidebar ──────────────────────────────────────────────────

function renderTopbar() {
  const actions = $("#authActions");
  actions.innerHTML = "";
  if (state.user) {
    const initial = (state.user.email || "?")[0].toUpperCase();
    actions.append(
      h("button", { class: "btn primary", onclick: () => newItem() }, icon("plus"), h("span", { class: "hide-sm" }, "Ny")),
      h("button", { class: "avatar", title: state.user.email + " — log ud", onclick: logout }, initial),
    );
  } else {
    actions.append(h("button", { class: "btn", onclick: openLogin }, "Log ind"));
  }
}

function newItem(type = "post", parentId) {
  if (parentId === undefined) {
    const cur = currentItem();
    parentId = cur && canContain(cur) && isOwner(cur) ? cur.id : "";
  }
  location.hash = `#/ny?type=${type}${parentId ? "&parent=" + parentId : ""}`;
}

function currentItem() {
  const m = location.hash.match(/^#\/(?:e|ret)\/([\w-]+)/);
  return m ? state.byId.get(m[1]) : null;
}

let dragId = null;

function renderSidebar() {
  const side = $("#sidebarBody");
  side.innerHTML = "";
  const curId = currentItem()?.id;

  side.append(
    h("a", { class: "nav-link" + (location.hash.length < 3 ? " active" : ""), href: "#/" }, icon("home"), "Forside"),
    h("button", { class: "nav-link", onclick: openPalette }, icon("search"), "Søg", h("kbd", {}, "⌘K")),
    h("a", { class: "nav-link" + (location.hash.startsWith("#/symboler") ? " active" : ""), href: "#/symboler" }, h("span", { class: "icon glyph" }, "Ω"), "Symboler"),
  );

  const head = h(
    "div",
    { class: "side-head" },
    h("span", {}, "Bibliotek"),
    state.user && h("button", { class: "icon-btn small", title: "Ny mappe øverst", onclick: () => newItem("mappe", "") }, icon("plus")),
  );
  if (state.user) {
    head.addEventListener("dragover", (e) => {
      if (!dragId) return;
      e.preventDefault();
      head.classList.add("drop");
    });
    head.addEventListener("dragleave", () => head.classList.remove("drop"));
    head.addEventListener("drop", (e) => {
      e.preventDefault();
      head.classList.remove("drop");
      if (dragId) moveItem(dragId, null);
    });
  }
  side.append(head);

  const tree = h("ul", { class: "tree" });
  const build = (parentId, ul, depth) => {
    for (const it of kids(parentId)) {
      const children = kids(it.id);
      const open = state.open.has(it.id);
      const li = h("li");
      const row = h(
        "div",
        {
          class: "tree-row" + (it.id === curId ? " active" : ""),
          style: { paddingLeft: 8 + depth * 14 + "px" },
          draggable: isOwner(it) ? "true" : null,
        },
        children.length
          ? h(
              "button",
              {
                class: "twisty" + (open ? " open" : ""),
                title: open ? "Fold sammen" : "Fold ud",
                onclick: (e) => {
                  e.stopPropagation();
                  if (open) state.open.delete(it.id);
                  else state.open.add(it.id);
                  writeJSON("hl-open", [...state.open]);
                  renderSidebar();
                },
              },
              icon("chevron"),
            )
          : h("span", { class: "twisty-space" }),
        h("span", { class: "tree-icon" }, itemIcon(it)),
        h("a", { class: "tree-title", href: "#/e/" + it.id }, it.titel),
        !it.offentlig && isOwner(it) && h("span", { class: "tree-lock", title: "Privat" }, icon("lock")),
        children.length > 0 && h("span", { class: "tree-count" }, children.length),
      );
      if (it.farve) row.style.setProperty("--item-color", it.farve);

      if (isOwner(it)) {
        row.addEventListener("dragstart", (e) => {
          dragId = it.id;
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", it.id);
          row.classList.add("dragging");
        });
        row.addEventListener("dragend", () => {
          dragId = null;
          row.classList.remove("dragging");
        });
        if (canContain(it)) {
          row.addEventListener("dragover", (e) => {
            if (!dragId || dragId === it.id) return;
            e.preventDefault();
            row.classList.add("drop");
          });
          row.addEventListener("dragleave", () => row.classList.remove("drop"));
          row.addEventListener("drop", (e) => {
            e.preventDefault();
            row.classList.remove("drop");
            if (dragId) moveItem(dragId, it.id);
          });
        }
      }
      li.append(row);
      if (children.length && open) {
        const sub = h("ul");
        build(it.id, sub, depth + 1);
        li.append(sub);
      }
      ul.append(li);
    }
  };
  build(null, tree, 0);
  if (!state.items.length) {
    tree.append(h("li", { class: "muted pad" }, state.dbError ? "Databasen svarer ikke." : "Tomt endnu."));
  }
  side.append(tree);

  const tags = tagCounts();
  if (tags.length) {
    side.append(h("div", { class: "side-head" }, h("span", {}, "Tags")));
    side.append(
      h(
        "div",
        { class: "side-tags" },
        tags.slice(0, 30).map(([t, n]) => h("a", { class: "chip", href: "#/tag/" + encodeURIComponent(t) }, "#" + t, h("small", {}, n))),
      ),
    );
  }

  side.append(
    h(
      "div",
      { class: "side-foot" },
      h("button", { class: "link-btn", onclick: showShortcuts }, icon("keyboard"), "Genveje"),
      state.user && h("button", { class: "link-btn", onclick: exportBackup }, icon("download"), "Backup"),
    ),
  );
}

function tagCounts() {
  const m = new Map();
  for (const it of state.items) for (const t of it.tags || []) m.set(t, (m.get(t) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "da"));
}

// ─── Routing ────────────────────────────────────────────────────────────

let currentHash = location.hash;
let skipHash = false;

window.addEventListener("hashchange", () => {
  if (skipHash) {
    skipHash = false;
    return;
  }
  if (state.dirty && !confirm("Du har ændringer, der ikke er gemt. Vil du forlade siden?")) {
    skipHash = true;
    location.hash = currentHash;
    return;
  }
  currentHash = location.hash;
  route();
});

window.addEventListener("beforeunload", (e) => {
  if (state.dirty) e.preventDefault();
});

function view() {
  const v = $("#view");
  v.innerHTML = "";
  v.className = "view";
  return v;
}

async function route() {
  state.dirty = false;
  document.body.classList.remove("nav-open");
  const [path, query] = location.hash.slice(1).split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  const q = new URLSearchParams(query || "");
  const [a, b] = parts;
  window.scrollTo(0, 0);

  if (state.dbError) renderDbError();
  else if (a === "e" && b) await renderItem(b);
  else if (a === "ny") renderEditor(null, { type: q.get("type"), parent_id: q.get("parent"), titel: q.get("titel") });
  else if (a === "ret" && b) renderEditor(state.byId.get(b));
  else if (a === "tag" && b) renderTag(b);
  else if (a === "symboler") renderSymbols();
  else if (a === "titel" && b) {
    const it = state.items.find((i) => i.titel.toLowerCase() === b.toLowerCase());
    if (it) location.replace("#/e/" + it.id);
    else renderMissingTitle(b);
  } else renderHome();

  renderSidebar();
  const cur = currentItem();
  document.title = cur ? cur.titel + " · Harrison Library" : "Harrison Library";
}

// ─── Visninger ──────────────────────────────────────────────────────────

function renderDbError() {
  const v = view();
  v.append(
    h(
      "div",
      { class: "empty" },
      h("div", { class: "empty-icon" }, "🛠️"),
      h("h2", {}, "Databasen er ikke klar"),
      h("p", {}, "Kør filen supabase/schema-v2.sql i Supabase (SQL Editor) og genindlæs siden."),
      h("p", { class: "muted small" }, state.dbError.message),
    ),
  );
}

function card(it) {
  const children = kids(it.id);
  const c = h(
    "a",
    { class: "card type-" + it.type, href: "#/e/" + it.id },
    h(
      "div",
      { class: "card-top" },
      h("span", { class: "card-icon" }, itemIcon(it)),
      h("span", { class: "type-chip" }, TYPER[it.type].navn),
      it.status && h("span", { class: "status-chip s-" + it.status.replace(/\s/g, "") }, it.status),
      it.fastgjort && h("span", { class: "pin", title: "Fastgjort" }, icon("pin")),
      !it.offentlig && h("span", { class: "pin", title: "Privat" }, icon("lock")),
    ),
    h("h3", {}, it.titel),
    excerpt(it) && h("p", {}, excerpt(it)),
    h(
      "div",
      { class: "card-meta" },
      children.length > 0 && h("span", {}, `${children.length} element${children.length > 1 ? "er" : ""}`),
      h("span", {}, relTime(it.opdateret)),
      (it.tags || []).slice(0, 3).map((t) => h("span", { class: "tag" }, "#" + t)),
    ),
  );
  if (it.farve) c.style.setProperty("--item-color", it.farve);
  return c;
}

function section(title, ...content) {
  return h("section", { class: "section" }, h("h2", { class: "section-title" }, title), ...content);
}

function renderHome() {
  const v = view();
  const counts = Object.fromEntries(TYPE_ORDEN.map((t) => [t, state.items.filter((i) => i.type === t).length]));

  v.append(
    h(
      "section",
      { class: "hero" },
      h("div", { class: "hero-text" }, h("h1", {}, "Harrison Library"), h("p", { class: "lead" }, "Mine projekter, beregninger og ting jeg undersøger.")),
      h(
        "div",
        { class: "stats" },
        TYPE_ORDEN.map((t) =>
          h("div", { class: "stat" }, h("span", { class: "stat-num" }, counts[t]), h("span", { class: "stat-label" }, TYPER[t].ikon + " " + TYPER[t].flertal)),
        ),
      ),
    ),
  );

  if (!state.items.length) {
    v.append(
      h(
        "div",
        { class: "empty" },
        h("div", { class: "empty-icon" }, "📚"),
        h("h2", {}, "Biblioteket er tomt"),
        state.user
          ? [
              h("p", {}, "Start med en mappe eller et projekt, og læg poster, filer og beregninger ind i dem."),
              h(
                "div",
                { class: "row center" },
                h("button", { class: "btn primary", onclick: () => newItem("mappe", "") }, "📁 Ny mappe"),
                h("button", { class: "btn", onclick: () => newItem("projekt", "") }, "🧪 Nyt projekt"),
                h("button", { class: "btn", onclick: () => newItem("post", "") }, "📝 Ny post"),
              ),
            ]
          : h("p", {}, "Der er ikke delt noget offentligt endnu."),
      ),
    );
    return;
  }

  const pinned = state.items.filter((i) => i.fastgjort);
  if (pinned.length) v.append(section("📌 Fastgjort", h("div", { class: "grid" }, pinned.map(card))));

  const active = state.items.filter((i) => i.type === "projekt" && i.status === "i gang");
  if (active.length) v.append(section("⚡ Aktive projekter", h("div", { class: "grid" }, active.map(card))));

  const recent = [...state.items].sort((a, b) => new Date(b.opdateret) - new Date(a.opdateret)).slice(0, 8);
  v.append(
    section(
      "🕒 Senest opdateret",
      h(
        "div",
        { class: "list" },
        recent.map((it) =>
          h(
            "a",
            { class: "list-row", href: "#/e/" + it.id },
            h("span", { class: "list-icon" }, itemIcon(it)),
            h("span", { class: "list-title" }, it.titel, pathText(it) && h("small", {}, pathText(it))),
            h("span", { class: "muted small" }, relTime(it.opdateret)),
          ),
        ),
      ),
    ),
  );

  v.append(section("🗂️ Alt i biblioteket", h("div", { class: "grid" }, kids(null).map(card))));
}

function renderTag(tag) {
  const v = view();
  const items = state.items.filter((i) => (i.tags || []).includes(tag));
  v.append(
    h("div", { class: "page-head" }, h("div", { class: "crumbs" }, h("a", { href: "#/" }, "Forside"), " / Tags"), h("h1", {}, "#" + tag), h("p", { class: "muted" }, `${items.length} element${items.length === 1 ? "" : "er"}`)),
    h("div", { class: "grid" }, items.map(card)),
  );
}

function renderMissingTitle(titel) {
  const v = view();
  v.append(
    h(
      "div",
      { class: "empty" },
      h("div", { class: "empty-icon" }, "🔍"),
      h("h2", {}, `"${titel}" findes ikke endnu`),
      state.user
        ? h("button", { class: "btn primary", onclick: () => (location.hash = "#/ny?type=post&titel=" + encodeURIComponent(titel)) }, "Opret den")
        : h("p", { class: "muted" }, "Siden er måske privat."),
    ),
  );
}

function notFound() {
  const v = view();
  v.append(
    h(
      "div",
      { class: "empty" },
      h("div", { class: "empty-icon" }, "🕳️"),
      h("h2", {}, "Elementet findes ikke"),
      h("p", { class: "muted" }, state.user ? "Det er måske blevet slettet." : "Det er måske privat. Log ind for at se det."),
      h("a", { class: "btn", href: "#/" }, "Til forsiden"),
    ),
  );
}

function crumbs(it) {
  return h(
    "nav",
    { class: "crumbs" },
    h("a", { href: "#/" }, "Forside"),
    ancestors(it).map((a) => [" / ", h("a", { href: "#/e/" + a.id }, itemIcon(a) + " " + a.titel)]),
  );
}

async function renderItem(id) {
  const it = state.byId.get(id);
  if (!it) return notFound();
  const v = view();
  const own = isOwner(it);
  const loading = h("div", { class: "muted pad" }, "Henter…");
  v.append(loading);

  const files = await loadFiles(it.id);
  if (location.hash !== "#/e/" + id) return;
  loading.remove();

  const words = wordCount(it.indhold);
  const head = h(
    "header",
    { class: "page-head" },
    crumbs(it),
    h(
      "div",
      { class: "title-row" },
      h("span", { class: "big-icon" }, itemIcon(it)),
      h("h1", {}, it.titel),
    ),
    h(
      "div",
      { class: "meta-row" },
      h("span", { class: "type-chip" }, TYPER[it.type].navn),
      it.status && h("span", { class: "status-chip s-" + it.status.replace(/\s/g, "") }, it.status),
      h("span", { class: "vis-chip" }, icon(it.offentlig ? "globe" : "lock"), it.offentlig ? "Offentlig" : "Privat"),
      (it.tags || []).map((t) => h("a", { class: "tag", href: "#/tag/" + encodeURIComponent(t) }, "#" + t)),
    ),
    h(
      "div",
      { class: "muted small" },
      `Opdateret ${relTime(it.opdateret)} · oprettet ${fmtDate(it.oprettet)}`,
      words ? ` · ${words} ord · ${Math.max(1, Math.round(words / 200))} min. læsning` : "",
    ),
  );
  if (it.farve) head.style.setProperty("--item-color", it.farve);
  v.append(head);

  // Handlinger
  const fileInput = h("input", {
    type: "file",
    multiple: true,
    hidden: true,
    onchange: async (e) => {
      const added = await uploadFiles(it.id, e.target.files);
      if (added.length) route();
    },
  });
  const actions = h("div", { class: "actions" });
  if (own) {
    actions.append(
      h("a", { class: "btn primary", href: "#/ret/" + it.id }, icon("edit"), "Ret"),
      canContain(it) ? newMenu(it) : "",
      h("button", { class: "btn", onclick: () => fileInput.click() }, icon("upload"), "Upload"),
      h(
        "button",
        {
          class: "btn" + (it.fastgjort ? " active" : ""),
          title: it.fastgjort ? "Fjern fra forsiden" : "Fastgør på forsiden",
          onclick: async () => {
            await db.from("elementer").update({ fastgjort: !it.fastgjort }).eq("id", it.id);
            await refresh(true);
          },
        },
        icon("pin"),
        it.fastgjort ? "Fastgjort" : "Fastgør",
      ),
      h("button", { class: "btn", onclick: () => showHistory(it) }, icon("history"), "Historik"),
    );
  }
  actions.append(h("button", { class: "btn", title: "Download som Markdown", onclick: () => exportMarkdown(it) }, icon("download"), ".md"));
  if (own) actions.append(h("button", { class: "btn danger", onclick: () => deleteItem(it) }, icon("trash"), "Slet"), fileInput);
  v.append(actions);

  if (it.type === "link" && it.url) {
    let host = it.url;
    try {
      host = new URL(it.url).host;
    } catch {}
    v.append(
      h(
        "a",
        { class: "link-card", href: it.url, target: "_blank", rel: "noopener noreferrer" },
        h("span", { class: "link-card-icon" }, itemIcon(it)),
        h("div", {}, h("strong", {}, host), h("div", { class: "muted small" }, it.url)),
        icon("external"),
      ),
    );
  }

  if (it.beskrivelse) v.append(h("p", { class: "lead" }, it.beskrivelse));

  const body = h("article", { class: "content" });
  v.append(body);
  const images = files.filter(isImage);
  await renderMarkdown(it.indhold || "", body, {
    resolveFile: (navn) => files.find((f) => f.navn === navn),
    hasTitle: (t) => state.items.some((i) => i.titel.toLowerCase() === t.toLowerCase()),
    onImage: (img) => openLightbox(img.src, img.alt),
  });
  if (!it.indhold && !it.beskrivelse && own) {
    body.append(h("p", { class: "muted" }, "Ingen tekst endnu. ", h("a", { href: "#/ret/" + it.id }, "Skriv noget")));
  }

  // Filer
  if (files.length || own) {
    const sec = section(`📎 Filer (${files.length})`);
    if (images.length) {
      sec.append(
        h(
          "div",
          { class: "gallery" },
          images.map((f) =>
            h("button", { class: "thumb", title: f.navn, onclick: () => openLightbox(f.url, f.navn, images) }, h("img", { src: f.url, alt: f.navn, loading: "lazy" })),
          ),
        ),
      );
    }
    if (files.length) sec.append(fileTable(files, own, () => route()));
    if (own) sec.append(dropzone(it.id, () => route()));
    v.append(sec);
  }

  // Indhold
  const children = kids(it.id);
  if (children.length || (own && canContain(it))) {
    const sec = section(`🗂️ Indeni (${children.length})`);
    if (children.length) sec.append(h("div", { class: "grid" }, children.map(card)));
    else sec.append(h("p", { class: "muted" }, "Her er tomt. Brug \"+ Ny her\" eller træk elementer hertil i menuen."));
    v.append(sec);
  }

  // Tilbagelinks
  const needle = "[[" + it.titel.toLowerCase();
  const backlinks = state.items.filter((i) => i.id !== it.id && (i.indhold || "").toLowerCase().includes(needle));
  if (backlinks.length) {
    v.append(
      section(
        "↩︎ Linket fra",
        h(
          "div",
          { class: "list" },
          backlinks.map((b) => h("a", { class: "list-row", href: "#/e/" + b.id }, h("span", { class: "list-icon" }, itemIcon(b)), h("span", { class: "list-title" }, b.titel))),
        ),
      ),
    );
  }
}

function newMenu(parent) {
  const menu = h(
    "details",
    { class: "menu" },
    h("summary", { class: "btn" }, icon("plus"), "Ny her"),
    h(
      "div",
      { class: "menu-list" },
      TYPE_ORDEN.map((t) => h("a", { href: `#/ny?type=${t}&parent=${parent.id}` }, TYPER[t].ikon + " " + TYPER[t].navn)),
    ),
  );
  return menu;
}

function fileTable(files, own, onChange, onInsert) {
  return h(
    "div",
    { class: "files" },
    files.map((f) =>
      h(
        "div",
        { class: "file-row" },
        h("span", { class: "file-icon" }, fileEmoji(f)),
        h("a", { class: "file-name", href: f.url || "#", target: "_blank", rel: "noopener" }, f.navn),
        h("span", { class: "muted small hide-sm" }, fmtSize(f.stoerrelse)),
        h(
          "span",
          { class: "file-actions" },
          onInsert && h("button", { class: "icon-btn small", title: "Indsæt i teksten", onclick: () => onInsert(f) }, icon("plus")),
          h(
            "button",
            {
              class: "icon-btn small",
              title: "Kopiér reference til teksten",
              onclick: async () => {
                await navigator.clipboard.writeText(fileRef(f));
                toast("Reference kopieret: " + fileRef(f));
              },
            },
            icon("copy"),
          ),
          f.downloadUrl && h("a", { class: "icon-btn small", title: "Download", href: f.downloadUrl }, icon("download")),
          own && h("button", { class: "icon-btn small danger", title: "Slet", onclick: async () => (await deleteFile(f)) && onChange() }, icon("trash")),
        ),
      ),
    ),
  );
}

function dropzone(elementId, onDone, beforeUpload) {
  const input = h("input", { type: "file", multiple: true, hidden: true });
  const zone = h(
    "div",
    { class: "dropzone", tabindex: 0, role: "button" },
    icon("upload"),
    h("span", {}, "Træk filer hertil, eller ", h("u", {}, "vælg filer")),
    h("small", { class: "muted" }, "Billeder, PDF, data, kode, 3D-modeller … op til 50 MB"),
    input,
  );
  const go = async (list) => {
    if (!list.length) return;
    const id = beforeUpload ? await beforeUpload() : elementId;
    if (!id) return;
    const added = await uploadFiles(id, list);
    if (added.length) onDone(added);
  };
  zone.onclick = () => input.click();
  zone.onkeydown = (e) => (e.key === "Enter" || e.key === " ") && input.click();
  input.onchange = () => go([...input.files]);
  zone.ondragover = (e) => {
    e.preventDefault();
    zone.classList.add("over");
  };
  zone.ondragleave = () => zone.classList.remove("over");
  zone.ondrop = (e) => {
    e.preventDefault();
    zone.classList.remove("over");
    go([...e.dataTransfer.files]);
  };
  return zone;
}

// ─── Editor ─────────────────────────────────────────────────────────────

const SNIPPETS = {
  wordmat:
    "```wordmat\n# Fald fra Storebæltsbroen\nDefiner: g=9,82; h=65\nv:=√(2·g·h)\nv=\nv·3,6≈\nLøs: 1/2·g·t^2=h; t\n```\n",
  calc: "```calc\n# Fald fra Storebæltsbroen\ng = 9.82 m/s^2\nhøjde = 65 m\nv = sqrt(2 g højde)\nv to km/h\n```\n",
  plot: "```plot\ntitel: Funktioner\nx: -2pi..2pi\nsin(x)\ncos(x) / 2\nf(x) = x^3 / 20\n```\n",
  python:
    '```python\nimport numpy as np\nimport matplotlib.pyplot as plt\n\nx = np.linspace(0, 10, 300)\nplt.plot(x, np.sin(x) * np.exp(-x / 5))\nplt.title("Dæmpet svingning")\nplt.grid(True)\nprint("Maksimum:", np.max(np.sin(x) * np.exp(-x / 5)))\n```\n',
  mermaid: "```mermaid\nflowchart LR\n  A[Idé] --> B[Beregning]\n  B --> C{Giver det mening?}\n  C -->|Ja| D[Resultat]\n  C -->|Nej| A\n```\n",
  math: "$$\n\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}\n$$\n",
  table: "| Størrelse | Værdi | Enhed |\n|---|---|---|\n| Højde | 65 | m |\n| Hastighed | 35.7 | m/s |\n",
  task: "- [ ] Første opgave\n- [x] Færdig opgave\n",
};

function renderEditor(it, d = {}) {
  const v = view();
  v.classList.add("wide");
  if (!state.user) {
    v.append(h("div", { class: "empty" }, h("div", { class: "empty-icon" }, "🔒"), h("h2", {}, "Log ind for at skrive"), h("button", { class: "btn primary", onclick: openLogin }, "Log ind")));
    return;
  }
  if (it && !isOwner(it)) return notFound();

  let isNew = !it;
  const draft = it
    ? { ...it }
    : {
        id: crypto.randomUUID(),
        type: TYPER[d.type] ? d.type : "post",
        parent_id: d.parent_id && state.byId.has(d.parent_id) ? d.parent_id : null,
        titel: d.titel || "",
        beskrivelse: "",
        indhold: "",
        url: "",
        status: d.type === "projekt" ? "idé" : null,
        ikon: "",
        farve: "",
        tags: [],
        offentlig: d.parent_id ? !!state.byId.get(d.parent_id)?.offentlig : false,
        fastgjort: false,
      };
  let files = [];
  const markDirty = () => (state.dirty = true);

  // Felter
  const titel = h("input", { class: "title-input", placeholder: "Titel", value: draft.titel, oninput: markDirty });
  const beskrivelse = h("input", { class: "desc-input", placeholder: "Kort beskrivelse (valgfri)", value: draft.beskrivelse || "", oninput: markDirty });
  const ta = h("textarea", {
    class: "md-input",
    placeholder: "Skriv i Markdown …\n\n$E = mc^2$ giver formler, ```calc giver beregninger med enheder, ```python kører kode, [[Titel]] linker til andre sider.",
    spellcheck: "false",
  });
  ta.value = draft.indhold || "";
  attachAutocomplete(ta, () => state.symbols);
  const palette = symbolPalette(() => state.symbols, (e) => insert(textFor(e, mathContext(ta) || "text")));
  palette.el.classList.add("hidden");
  const preview = h("div", { class: "md-preview prose" });

  let typeSel = draft.type;
  const typeSeg = h(
    "div",
    { class: "seg" },
    TYPE_ORDEN.map((t) =>
      h(
        "button",
        {
          type: "button",
          class: t === typeSel ? "on" : "",
          onclick: (e) => {
            typeSel = t;
            typeSeg.querySelectorAll("button").forEach((b) => b.classList.remove("on"));
            e.currentTarget.classList.add("on");
            statusField.hidden = t !== "projekt";
            urlField.hidden = t !== "link";
            if (t === "projekt" && !statusSel.value) statusSel.value = "idé";
            markDirty();
          },
        },
        TYPER[t].ikon + " " + TYPER[t].navn,
      ),
    ),
  );

  const banned = new Set([draft.id, ...descendants(draft.id).map((x) => x.id)]);
  const parentSel = h("select", { onchange: markDirty }, h("option", { value: "" }, "— Øverste niveau —"));
  const addOpts = (pid, depth) => {
    for (const c of kids(pid)) {
      if (banned.has(c.id) || !canContain(c) || !isOwner(c)) continue;
      parentSel.append(h("option", { value: c.id, selected: c.id === draft.parent_id }, "  ".repeat(depth) + itemIcon(c) + " " + c.titel));
      addOpts(c.id, depth + 1);
    }
  };
  addOpts(null, 0);

  const statusSel = h("select", { onchange: markDirty }, h("option", { value: "" }, "—"), STATUSSER.map((s) => h("option", { value: s, selected: s === draft.status }, s)));
  const statusField = h("label", { class: "field", hidden: draft.type !== "projekt" }, h("span", {}, "Status"), statusSel);
  const urlInput = h("input", { type: "url", placeholder: "https://…", value: draft.url || "", oninput: markDirty });
  const urlField = h("label", { class: "field", hidden: draft.type !== "link" }, h("span", {}, "Adresse"), urlInput);
  const ikonInput = h("input", { class: "emoji-input", maxlength: 4, placeholder: TYPER[draft.type].ikon, value: draft.ikon || "", oninput: markDirty });
  const tagsInput = h("input", { placeholder: "fysik, broer, storebælt", value: (draft.tags || []).join(", "), oninput: markDirty });
  const offentlig = h("input", { type: "checkbox", checked: draft.offentlig, onchange: markDirty });
  const fastgjort = h("input", { type: "checkbox", checked: draft.fastgjort, onchange: markDirty });

  let farve = draft.farve || "";
  const swatches = h(
    "div",
    { class: "swatches" },
    FARVER.map((c) =>
      h("button", {
        type: "button",
        class: "swatch-btn" + (c === farve ? " on" : ""),
        title: c || "Ingen farve",
        style: { background: c || "transparent" },
        onclick: (e) => {
          farve = c;
          swatches.querySelectorAll("button").forEach((b) => b.classList.remove("on"));
          e.currentTarget.classList.add("on");
          markDirty();
        },
      }),
    ),
  );

  // Gem
  const saveBtn = h("button", { class: "btn primary", onclick: () => save() }, icon("save"), "Gem");
  async function save({ stay = false } = {}) {
    const row = {
      type: typeSel,
      titel: titel.value.trim(),
      beskrivelse: beskrivelse.value.trim() || null,
      indhold: ta.value,
      url: typeSel === "link" ? urlInput.value.trim() || null : null,
      status: typeSel === "projekt" ? statusSel.value || null : null,
      ikon: ikonInput.value.trim() || null,
      farve: farve || null,
      tags: [...new Set(tagsInput.value.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean))],
      offentlig: offentlig.checked,
      fastgjort: fastgjort.checked,
      parent_id: parentSel.value || null,
    };
    if (!row.titel) {
      titel.focus();
      toast("Skriv en titel først", "error");
      return false;
    }
    saveBtn.disabled = true;
    const res = isNew
      ? await db.from("elementer").insert({ ...row, id: draft.id }).select().single()
      : await db.from("elementer").update(row).eq("id", draft.id).select().single();
    saveBtn.disabled = false;
    if (res.error) {
      toast("Kunne ikke gemme: " + res.error.message, "error");
      return false;
    }
    isNew = false;
    state.dirty = false;
    await loadItems();
    renderSidebar();
    if (stay) {
      toast("Gemt ✓", "ok");
      history.replaceState(null, "", "#/ret/" + draft.id);
      currentHash = location.hash;
    } else {
      location.hash = "#/e/" + draft.id;
    }
    return true;
  }
  const ensureSaved = async () => (isNew ? ((await save({ stay: true })) ? draft.id : null) : draft.id);

  // Markdown-værktøjer
  function insert(before, after = "", placeholder = "") {
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const sel = value.slice(s, e) || placeholder;
    ta.setRangeText(before + sel + after, s, e, "end");
    if (!value.slice(s, e) && placeholder) {
      ta.selectionStart = s + before.length;
      ta.selectionEnd = s + before.length + placeholder.length;
    }
    ta.focus();
    ta.dispatchEvent(new Event("input"));
  }
  function insertBlock(text) {
    const s = ta.selectionStart;
    const pre = s > 0 && ta.value[s - 1] !== "\n" ? "\n\n" : "";
    insert(pre + text);
  }
  const tb = (label, title, fn) => h("button", { type: "button", class: "tb-btn", title, onclick: fn }, label);
  const toolbar = h(
    "div",
    { class: "toolbar" },
    tb(h("b", {}, "B"), "Fed (⌘B)", () => insert("**", "**", "fed tekst")),
    tb(h("i", {}, "I"), "Kursiv (⌘I)", () => insert("*", "*", "kursiv")),
    tb("H", "Overskrift", () => insertBlock("## ")),
    tb("🔗", "Link", () => insert("[", "](https://)", "tekst")),
    tb("[[ ]]", "Link til anden side", () => insert("[[", "]]", "Titel")),
    tb("•", "Punktliste", () => insertBlock("- ")),
    tb("☑", "Tjekliste", () => insertBlock(SNIPPETS.task)),
    tb("❝", "Citat", () => insertBlock("> ")),
    tb("⊞", "Tabel", () => insertBlock(SNIPPETS.table)),
    tb("</>", "Kode", () => insert("`", "`", "kode")),
    h("span", { class: "tb-sep" }),
    tb("$x$", "Formel i teksten", () => insert("$", "$", "x^2")),
    tb("$$", "Formel på egen linje", () => insertBlock(SNIPPETS.math)),
    tb("∑ calc", "Beregning med enheder", () => insertBlock(SNIPPETS.calc)),
    tb("📈 plot", "Graf", () => insertBlock(SNIPPETS.plot)),
    tb("🐍 py", "Python-kode der kan køres", () => insertBlock(SNIPPETS.python)),
    tb("◇ diagram", "Mermaid-diagram", () => insertBlock(SNIPPETS.mermaid)),
    tb("{{ }}", "Indsæt resultat af beregning i teksten", () => insert("{{", "}}", "v to km/h")),
    h("span", { class: "tb-sep" }),
    tb("W", "WordMat-blok (Alt+B beregn, Alt+L løs, Alt+N numerisk, Alt+D definer)", () => insertBlock(SNIPPETS.wordmat)),
    tb("Σ ligning", "Formeleditor som i Word (Alt+=)", () => formula()),
    tb("Ω", "Symboler og \\-kommandoer", () => {
      palette.el.classList.toggle("hidden");
      palette.refresh();
    }),
    h("span", { class: "tb-sep" }),
    tb("🖼️", "Upload billede/fil og indsæt", () => pickFiles()),
    h("span", { class: "tb-spacer" }),
    tb("?", "Hjælp til syntaks", showSyntaxHelp),
  );

  // Delt visning / faner
  let mode = readJSON("hl-editor-mode", "split");
  const pane = h("div", { class: "editor-pane mode-" + mode }, h("div", { class: "md-wrap" }, ta), preview);
  const modeSeg = h(
    "div",
    { class: "seg small" },
    [
      ["write", "Skriv"],
      ["split", "Delt"],
      ["preview", "Vis"],
    ].map(([m, label]) =>
      h(
        "button",
        {
          type: "button",
          class: m === mode ? "on" : "",
          onclick: (e) => {
            mode = m;
            writeJSON("hl-editor-mode", m);
            pane.className = "editor-pane mode-" + m;
            modeSeg.querySelectorAll("button").forEach((b) => b.classList.remove("on"));
            e.currentTarget.classList.add("on");
            updatePreview();
          },
        },
        label,
      ),
    ),
  );

  let timer;
  let renderSeq = 0;
  async function updatePreview() {
    if (mode === "write") return;
    const seq = ++renderSeq;
    const tmp = h("div");
    await renderMarkdown(ta.value, tmp, {
      resolveFile: (navn) => files.find((f) => f.navn === navn),
      hasTitle: (t) => state.items.some((i) => i.titel.toLowerCase() === t.toLowerCase()),
      onImage: (img) => openLightbox(img.src, img.alt),
    });
    if (seq !== renderSeq) return;
    preview.replaceChildren(...tmp.childNodes);
    if (!ta.value.trim()) preview.append(h("p", { class: "muted" }, "Forhåndsvisningen kommer her."));
  }
  ta.addEventListener("input", () => {
    markDirty();
    clearTimeout(timer);
    timer = setTimeout(updatePreview, 250);
  });

  // WordMat: formeleditor og Alt-genveje
  function inWordmat() {
    const before = ta.value.slice(0, ta.selectionStart);
    const o = Math.max(before.lastIndexOf("```wordmat"), before.lastIndexOf("```wm"));
    return o >= 0 && !before.slice(o + 3).includes("```");
  }
  function lineBounds() {
    const v = ta.value;
    const start = v.lastIndexOf("\n", ta.selectionStart - 1) + 1;
    let end = v.indexOf("\n", ta.selectionStart);
    if (end < 0) end = v.length;
    return [start, end];
  }
  function putWordmatLine(line, replaceCurrent) {
    const inside = inWordmat();
    let [start, end] = lineBounds();
    const current = ta.value.slice(start, end);
    if (!replaceCurrent && current.trim()) {
      start = end;
      line = "\n" + line;
    }
    if (!inside) line = (start > 0 && !replaceCurrent ? "\n" : "") + "```wordmat\n" + line.replace(/^\n/, "") + "\n```";
    ta.setRangeText(line, start, end, "end");
    ta.focus();
    ta.dispatchEvent(new Event("input"));
  }
  function wordmatAction(code) {
    const [start, end] = lineBounds();
    const text = ta.value
      .slice(start, end)
      .trim()
      .replace(/^(løs|definer|def)\s*:\s*/i, "")
      .replace(/\s*(=|≈)\s*$/, "");
    if (!text || text.startsWith("```")) return;
    const line = { KeyB: text + "=", KeyN: text + "≈", KeyL: "Løs: " + text, KeyD: "Definer: " + text }[code];
    putWordmatLine(line, true);
  }
  function formula() {
    openFormulaEditor((kind, latex, ascii) => {
      if (kind === "formel") return insert("$" + latex + "$");
      const line = { beregn: ascii + "=", numerisk: ascii + "≈", løs: "Løs: " + ascii, definer: "Definer: " + ascii, linje: ascii }[kind];
      putWordmatLine(line, false);
    });
  }

  ta.addEventListener("keydown", (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (e.altKey && !mod) {
      if (e.code === "Equal") {
        e.preventDefault();
        return formula();
      }
      if (["KeyB", "KeyL", "KeyN", "KeyD"].includes(e.code)) {
        e.preventDefault();
        return wordmatAction(e.code);
      }
    }
    if (e.key === "Tab" && !mod) {
      e.preventDefault();
      insert("  ");
    } else if (mod && e.key === "b") {
      e.preventDefault();
      insert("**", "**", "fed tekst");
    } else if (mod && e.key === "i") {
      e.preventDefault();
      insert("*", "*", "kursiv");
    } else if (e.key === "Enter" && !mod && !e.shiftKey) {
      // Fortsæt lister automatisk
      const s = ta.selectionStart;
      const line = ta.value.slice(ta.value.lastIndexOf("\n", s - 1) + 1, s);
      const m = line.match(/^(\s*)([-*+]|\d+\.)(\s+\[[ x]\])?\s+(.*)$/);
      if (m) {
        e.preventDefault();
        if (!m[4]) {
          ta.setRangeText("", s - line.length, s, "end");
          insert("\n");
        } else {
          const bullet = /\d+\./.test(m[2]) ? parseInt(m[2]) + 1 + "." : m[2];
          insert("\n" + m[1] + bullet + (m[3] ? " [ ]" : "") + " ");
        }
      }
    }
  });

  // Filer i editoren
  const filesBox = h("div", { class: "editor-files" });
  const hiddenInput = h("input", { type: "file", multiple: true, hidden: true, onchange: (e) => uploadAndInsert([...e.target.files]) });
  const pickFiles = () => hiddenInput.click();

  async function reloadFiles() {
    files = isNew ? [] : await loadFiles(draft.id);
    filesBox.replaceChildren(
      files.length ? fileTable(files, true, reloadFiles, (f) => insertBlock(fileRef(f) + "\n")) : h("p", { class: "muted small" }, "Ingen filer endnu."),
      dropzone(draft.id, reloadFiles, ensureSaved),
      hiddenInput,
    );
    updatePreview();
  }

  async function uploadAndInsert(list) {
    if (!list.length) return;
    const id = await ensureSaved();
    if (!id) return;
    const added = await uploadFiles(id, list);
    if (added.length) {
      insertBlock(added.map(fileRef).join("\n") + "\n");
      await reloadFiles();
    }
  }

  ta.addEventListener("paste", (e) => {
    const list = [...(e.clipboardData?.files || [])];
    if (list.length) {
      e.preventDefault();
      uploadAndInsert(list);
    }
  });
  ta.addEventListener("dragover", (e) => {
    if (e.dataTransfer.types.includes("Files")) e.preventDefault();
  });
  ta.addEventListener("drop", (e) => {
    const list = [...e.dataTransfer.files];
    if (list.length) {
      e.preventDefault();
      uploadAndInsert(list);
    }
  });

  const cancelHref = isNew ? (draft.parent_id ? "#/e/" + draft.parent_id : "#/") : "#/e/" + draft.id;

  v.append(
    h(
      "div",
      { class: "editor" },
      h(
        "div",
        { class: "editor-head" },
        h("div", { class: "crumbs" }, isNew ? "Nyt element" : "Redigerer"),
        h("div", { class: "row" }, h("a", { class: "btn ghost", href: cancelHref }, "Annuller"), saveBtn),
      ),
      h(
        "div",
        { class: "editor-grid" },
        h(
          "div",
          { class: "editor-main" },
          h("div", { class: "title-line" }, ikonInput, titel),
          beskrivelse,
          h("div", { class: "editor-bar" }, toolbar, modeSeg),
          palette.el,
          pane,
        ),
        h(
          "aside",
          { class: "editor-side" },
          h("div", { class: "field" }, h("span", {}, "Type"), typeSeg),
          h("label", { class: "field" }, h("span", {}, "Placering"), parentSel),
          statusField,
          urlField,
          h("label", { class: "field" }, h("span", {}, "Tags (adskilt med komma)"), tagsInput),
          h("div", { class: "field" }, h("span", {}, "Farve"), swatches),
          h("label", { class: "switch" }, offentlig, h("span", {}, "Offentlig — alle kan se den")),
          h("label", { class: "switch" }, fastgjort, h("span", {}, "Fastgør på forsiden")),
          h("div", { class: "field" }, h("span", {}, "Filer"), filesBox),
          h("p", { class: "muted small" }, "Tip: Indsæt et billede med ⌘V direkte i teksten, eller træk filer ind i tekstfeltet. ⌘S gemmer."),
        ),
      ),
    ),
  );

  editorSave = () => save({ stay: true });
  reloadFiles();
  (isNew ? titel : ta).focus();
}

let editorSave = null;

// ─── Modaler ────────────────────────────────────────────────────────────

async function openFormulaEditor(onInsert) {
  const status = h("div", { class: "muted pad" }, "Henter formeleditoren…");
  const body = h("div", { class: "formula" }, status);
  const m = modal(
    h("div", {}, h("div", { class: "modal-head" }, h("h2", {}, "Ligning"), h("button", { class: "icon-btn", onclick: () => m.close() }, icon("x"))), body),
    "formula-modal",
  );
  try {
    await loadScript(MATHLIVE);
  } catch {
    status.textContent = "Kunne ikke hente formeleditoren.";
    return;
  }
  window.MathfieldElement.decimalSeparator = ",";
  const mf = new window.MathfieldElement();
  const macros = {};
  for (const e of state.symbols) if (e.latex && e.latex !== "\\" + e.kommando && !/\{\}/.test(e.latex)) macros[e.kommando] = e.latex;
  mf.macros = { ...mf.macros, ...macros };
  mf.className = "formula-field";
  const done = (kind) => {
    const latex = mf.value.trim();
    if (!latex) return;
    const ascii = asciiToWordmat(mf.getValue("ascii-math"));
    m.close();
    onInsert(kind, latex, ascii);
  };
  const btn = (label, kind, keys, primary) =>
    h("button", { class: "btn" + (primary ? " primary" : ""), onclick: () => done(kind) }, label, keys && h("kbd", {}, keys));
  mf.addEventListener(
    "keydown",
    (e) => {
      const map = { KeyB: "beregn", KeyL: "løs", KeyN: "numerisk", KeyD: "definer" };
      if (e.altKey && map[e.code]) {
        e.preventDefault();
        e.stopPropagation();
        done(map[e.code]);
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        done("beregn");
      }
    },
    { capture: true },
  );
  status.replaceWith(
    mf,
    h("p", { class: "muted small" }, "Skriv som i Words formeleditor: / giver brøk, ^ giver eksponent, sqrt giver kvadratrod, pi giver π. Decimalkomma virker."),
    h(
      "div",
      { class: "row" },
      btn("Beregn =", "beregn", "Alt B", true),
      btn("Løs ligning", "løs", "Alt L"),
      btn("Numerisk ≈", "numerisk", "Alt N"),
      btn("Definer", "definer", "Alt D"),
      btn("Kun formel", "formel"),
    ),
  );
  setTimeout(() => mf.focus(), 50);
}

function modal(content, cls = "") {
  const back = h("div", { class: "modal-back", onclick: (e) => e.target === back && close() });
  const box = h("div", { class: "modal " + cls, role: "dialog" }, content);
  back.append(box);
  document.body.append(back);
  const onKey = (e) => e.key === "Escape" && close();
  document.addEventListener("keydown", onKey);
  function close() {
    back.remove();
    document.removeEventListener("keydown", onKey);
  }
  return { box, close };
}

function openLogin() {
  const email = h("input", { type: "email", autocomplete: "username", required: true });
  const pass = h("input", { type: "password", autocomplete: "current-password", required: true });
  const err = h("div", { class: "err small" });
  const btn = h("button", { class: "btn primary wide", type: "submit" }, "Log ind");
  const form = h(
    "form",
    {
      class: "login",
      onsubmit: async (e) => {
        e.preventDefault();
        btn.disabled = true;
        err.textContent = "";
        const { error } = await db.auth.signInWithPassword({ email: email.value, password: pass.value });
        btn.disabled = false;
        if (error) err.textContent = "Login mislykkedes: " + error.message;
        else m.close();
      },
    },
    h("div", { class: "login-logo" }, "∑"),
    h("h2", {}, "Log ind"),
    h("label", { class: "field" }, h("span", {}, "E-mail"), email),
    h("label", { class: "field" }, h("span", {}, "Adgangskode"), pass),
    err,
    btn,
  );
  const m = modal(form, "narrow");
  email.focus();
}

async function logout() {
  if (state.dirty && !confirm("Du har ændringer, der ikke er gemt. Log ud alligevel?")) return;
  if (!confirm("Log ud?")) return;
  state.dirty = false;
  await db.auth.signOut();
  toast("Du er logget ud");
}

function openLightbox(src, alt, list) {
  const imgs = list ? list.map((f) => ({ src: f.url, alt: f.navn })) : [{ src, alt }];
  let i = Math.max(0, imgs.findIndex((x) => x.src === src));
  const img = h("img", {});
  const cap = h("div", { class: "lb-cap" });
  const show = () => {
    img.src = imgs[i].src;
    img.alt = imgs[i].alt || "";
    cap.textContent = (imgs[i].alt || "") + (imgs.length > 1 ? `  ·  ${i + 1}/${imgs.length}` : "");
  };
  const m = modal(h("div", { class: "lb" }, img, cap), "lightbox");
  m.box.parentElement.onclick = () => m.close();
  const onKey = (e) => {
    if (!document.body.contains(img)) return document.removeEventListener("keydown", onKey);
    if (e.key === "ArrowRight") i = (i + 1) % imgs.length;
    else if (e.key === "ArrowLeft") i = (i - 1 + imgs.length) % imgs.length;
    else return;
    show();
  };
  document.addEventListener("keydown", onKey);
  show();
}

async function showHistory(it) {
  const list = h("div", { class: "hist-list" }, h("div", { class: "muted pad" }, "Henter…"));
  const prev = h("div", { class: "hist-preview prose" });
  const m = modal(h("div", { class: "hist" }, h("div", { class: "modal-head" }, h("h2", {}, "Historik: " + it.titel), h("button", { class: "icon-btn", onclick: () => m.close() }, icon("x"))), h("div", { class: "hist-body" }, list, prev)), "large");

  const { data, error } = await db.from("versioner").select("*").eq("element_id", it.id).order("gemt", { ascending: false }).limit(100);
  list.innerHTML = "";
  if (error) return list.append(h("div", { class: "err pad" }, error.message));
  const entries = [{ id: "nu", gemt: it.opdateret, titel: it.titel, indhold: it.indhold, current: true }, ...data];
  if (entries.length === 1) prev.append(h("p", { class: "muted" }, "Ingen tidligere versioner endnu. Hver gang du gemmer en ændring i teksten, gemmes den gamle version her."));
  entries.forEach((ver, idx) => {
    const btn = h(
      "button",
      {
        class: "hist-item",
        onclick: async () => {
          list.querySelectorAll(".hist-item").forEach((b) => b.classList.remove("on"));
          btn.classList.add("on");
          prev.innerHTML = "";
          const bodyEl = h("div");
          await renderMarkdown(ver.indhold || "*(tom)*", bodyEl, {});
          prev.append(
            h("div", { class: "hist-bar" }, h("strong", {}, ver.titel), !ver.current && h("button", { class: "btn small primary", onclick: () => restore(ver) }, "Gendan denne version")),
            bodyEl,
          );
        },
      },
      h("span", {}, ver.current ? "Nuværende version" : fmtDate(ver.gemt, true)),
      h("small", { class: "muted" }, `${wordCount(ver.indhold)} ord`),
    );
    list.append(btn);
    if (idx === 0) btn.click();
  });

  async function restore(ver) {
    if (!confirm("Gendan denne version? Den nuværende tekst gemmes i historikken.")) return;
    const { error } = await db.from("elementer").update({ titel: ver.titel, indhold: ver.indhold }).eq("id", it.id);
    if (error) return toast("Kunne ikke gendanne: " + error.message, "error");
    m.close();
    toast("Versionen er gendannet", "ok");
    await refresh(true);
  }
}

// ─── Kommandopalet (⌘K) ─────────────────────────────────────────────────

function openPalette() {
  const input = h("input", { class: "pal-input", placeholder: "Søg efter titel, tekst, tags … eller skriv > for kommandoer" });
  const results = h("div", { class: "pal-results" });
  const m = modal(h("div", { class: "palette" }, h("div", { class: "pal-top" }, icon("search"), input), results), "palette-modal");
  let sel = 0;
  let current = [];

  const commands = [
    ...TYPE_ORDEN.map((t) => ({ label: `Ny ${TYPER[t].navn.toLowerCase()}`, ikon: TYPER[t].ikon, run: () => newItem(t), auth: true })),
    { label: "Gå til forsiden", ikon: "🏠", run: () => (location.hash = "#/") },
    { label: "Skift tema", ikon: "🌓", run: cycleTheme },
    { label: "Download backup (JSON)", ikon: "💾", run: exportBackup, auth: true },
    { label: "Vis tastaturgenveje", ikon: "⌨️", run: showShortcuts },
    { label: "Hjælp til Markdown, matematik og kode", ikon: "📐", run: showSyntaxHelp },
    state.user ? { label: "Log ud", ikon: "🚪", run: logout } : { label: "Log ind", ikon: "🔑", run: openLogin },
  ].filter((c) => !c.auth || state.user);

  function search(q) {
    q = q.trim().toLowerCase();
    if (q.startsWith(">")) {
      const cq = q.slice(1).trim();
      return commands.filter((c) => c.label.toLowerCase().includes(cq));
    }
    if (!q) {
      const recent = [...state.items].sort((a, b) => new Date(b.opdateret) - new Date(a.opdateret)).slice(0, 6);
      return [...recent.map(itemResult), ...commands.slice(0, 4)];
    }
    const scored = [];
    for (const it of state.items) {
      const t = it.titel.toLowerCase();
      let s = 0;
      if (t === q) s = 100;
      else if (t.startsWith(q)) s = 80;
      else if (t.includes(q)) s = 60;
      else if ((it.tags || []).some((tag) => tag.toLowerCase().includes(q.replace(/^#/, "")))) s = 40;
      else if ((it.beskrivelse || "").toLowerCase().includes(q)) s = 30;
      else if ((it.indhold || "").toLowerCase().includes(q)) s = 20;
      if (s) scored.push([s, it]);
    }
    scored.sort((a, b) => b[0] - a[0] || new Date(b[1].opdateret) - new Date(a[1].opdateret));
    return [...scored.slice(0, 30).map(([, it]) => itemResult(it, q)), ...commands.filter((c) => c.label.toLowerCase().includes(q))];
  }

  function itemResult(it, q) {
    let snippet = pathText(it);
    if (q && !it.titel.toLowerCase().includes(q)) {
      const text = plainText(it.indhold);
      const i = text.toLowerCase().indexOf(q);
      if (i >= 0) snippet = "…" + text.slice(Math.max(0, i - 30), i + 60) + "…";
    }
    return { label: it.titel, ikon: itemIcon(it), sub: snippet, run: () => (location.hash = "#/e/" + it.id) };
  }

  function draw() {
    current = search(input.value);
    sel = Math.min(sel, Math.max(0, current.length - 1));
    results.replaceChildren(
      ...(current.length
        ? current.map((r, i) =>
            h(
              "button",
              {
                class: "pal-item" + (i === sel ? " on" : ""),
                onclick: () => {
                  m.close();
                  r.run();
                },
                onmousemove: () => {
                  if (sel !== i) {
                    sel = i;
                    draw();
                  }
                },
              },
              h("span", { class: "pal-icon" }, r.ikon),
              h("span", { class: "pal-label" }, r.label, r.sub && h("small", {}, r.sub)),
            ),
          )
        : [h("div", { class: "muted pad" }, "Ingen resultater")]),
    );
    results.querySelector(".on")?.scrollIntoView({ block: "nearest" });
  }

  input.addEventListener("input", () => {
    sel = 0;
    draw();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      sel = Math.min(sel + 1, current.length - 1);
      draw();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      sel = Math.max(sel - 1, 0);
      draw();
    } else if (e.key === "Enter" && current[sel]) {
      e.preventDefault();
      m.close();
      current[sel].run();
    }
  });
  draw();
  input.focus();
}

function showShortcuts() {
  const rows = [
    ["⌘ K  eller  /", "Søg og kommandoer"],
    ["N", "Ny post"],
    ["E", "Ret det åbne element"],
    ["⌘ S", "Gem (i editoren)"],
    ["⌘ B / ⌘ I", "Fed / kursiv"],
    ["⌘ V", "Indsæt billede som fil"],
    ["Alt =", "Formeleditor som i Word"],
    ["Alt B / Alt N", "WordMat: beregn = / numerisk ≈"],
    ["Alt L / Alt D", "WordMat: løs ligning / definer"],
    ["\\alpha + mellemrum", "Indsæt symbol (se Symboler)"],
    ["T", "Skift tema"],
    ["?", "Vis denne oversigt"],
    ["Esc", "Luk vinduer"],
  ];
  const m = modal(
    h(
      "div",
      {},
      h("div", { class: "modal-head" }, h("h2", {}, "Tastaturgenveje"), h("button", { class: "icon-btn", onclick: () => m.close() }, icon("x"))),
      h("table", { class: "keys" }, rows.map(([k, d]) => h("tr", {}, h("td", {}, h("kbd", {}, k)), h("td", {}, d)))),
    ),
    "narrow",
  );
}

async function showSyntaxHelp() {
  const src = `## Tekst
**fed**, *kursiv*, \`kode\`, [link](https://example.com), [[Anden side]]

## Matematik (LaTeX)
Inline: $E = mc^2$ — på egen linje:

$$
\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}
$$

## WordMat
Skriv som i WordMat: decimalkomma, semikolon mellem argumenter, grader som standard, \`log\` er 10-tals-logaritmen og \`ln\` den naturlige. I editoren: **Alt+=** åbner formeleditoren, **Alt+B** beregner linjen, **Alt+L** løser den, **Alt+N** giver tilnærmet værdi og **Alt+D** definerer.

\`\`\`wordmat
Definer: a=2; b=-3
1/3+1/4=
√8=
sin(30)=
Løs: x^2+a·x+b=0
Løs: x^2=2
Løs: 2x+y=5 ∧ x-y=1; x,y
f(x):=x^3-2x
f(1,5)≈
\`\`\`

## Infinitesimalregning (i WordMat-blokke)
Regner altid i radianer. Skriv \\int, \\sum, \\lim, \\ddx osv. og tryk mellemrum.

\`\`\`wordmat
∫ x·sin(x) dx=
∫_0^π sin(x) dx=
d/dx (x^3+2x)=
f(x):=x^3-2x
f'(2)=
lim_(x→0) sin(x)/x=
∑_(k=1)^10 k^2=
∑_(k=1)^∞ 1/k^2≈
\`\`\`

## Beregninger med enheder
Variabler deles mellem alle beregninger på siden. Undgå variabelnavne, der også er enheder (f.eks. \`h\`, \`m\`, \`s\`), hvis du bruger enhederne.

\`\`\`calc
g = 9.82 m/s^2
højde = 65 m
t = sqrt(2 højde / g)    # faldtid
v = g t
v to km/h
\`\`\`

Resultater kan bruges i teksten: hastigheden er {{v to km/h}}.

Konstanter som \`speedOfLight\`, \`gravitationConstant\` og \`planckConstant\` virker. Også matricer: \`det([1,2;3,4])\`, \`derivative("x^3", "x")\` og komplekse tal.

## Grafer
\`\`\`plot
x: 0..4
y: -1..1.2
sin(2 pi x) * e^(-x)
\`\`\`

## Python (numpy, scipy, sympy, matplotlib …)
Tryk ▶ Kør. Første gang hentes Python (tager ca. 10 sek.).

\`\`\`python
import sympy as sp
x = sp.symbols("x")
print(sp.integrate(sp.sin(x)**2, x))
\`\`\`

## Diagrammer
\`\`\`mermaid
flowchart LR
  A --> B --> C
\`\`\`

## Filer
Upload en fil og skriv \`![tekst](fil:navn.png)\` for at vise et billede.`;
  const body = h("div", { class: "help-body" });
  const m = modal(h("div", {}, h("div", { class: "modal-head" }, h("h2", {}, "Syntaks og eksempler"), h("button", { class: "icon-btn", onclick: () => m.close() }, icon("x"))), body), "large");
  await renderMarkdown(src, body, {});
}


// ─── Symboler og \-kommandoer ───────────────────────────────────────────

async function loadSymbols() {
  state.symbols = STANDARD;
  state.symbolsSeeded = false;
  state.symbolsError = null;
  if (!state.user) return;
  const { data, error } = await db.from("symboler").select("*").order("kommando");
  if (error) {
    state.symbolsError = error;
    return;
  }
  if (data.length) {
    state.symbols = data;
    state.symbolsSeeded = true;
  }
}

async function seedSymbols() {
  if (state.symbolsSeeded) return true;
  const rows = STANDARD.map(({ kommando, tegn, latex, kategori, beskrivelse }) => ({ kommando, tegn, latex, kategori, beskrivelse }));
  const { error } = await db.from("symboler").insert(rows);
  if (error) {
    toast("Kunne ikke gemme listen: " + error.message, "error");
    return false;
  }
  await loadSymbols();
  return true;
}

function renderSymbols() {
  const v = view();
  const canEdit = !!state.user && !state.symbolsError;
  let query = "";
  let cat = "";

  const search = h("input", { type: "search", placeholder: "Søg efter kommando, tegn eller beskrivelse…", oninput: (e) => ((query = e.target.value.toLowerCase()), draw()) });
  const catSel = h("select", { onchange: (e) => ((cat = e.target.value), draw()) });
  const listBox = h("div");

  function draw() {
    const list = state.symbols;
    const cats = [...new Set([...KATEGORIER, ...list.map((e) => e.kategori)])].filter((k) => list.some((e) => e.kategori === k));
    catSel.replaceChildren(h("option", { value: "" }, "Alle kategorier"), cats.map((k) => h("option", { value: k, selected: k === cat }, k)));
    listBox.innerHTML = "";
    let total = 0;
    for (const k of cats) {
      if (cat && k !== cat) continue;
      const rows = list.filter(
        (e) => e.kategori === k && (!query || [e.kommando, e.tegn, e.beskrivelse || "", e.latex || ""].join(" ").toLowerCase().includes(query.replace(/^\\/, ""))),
      );
      if (!rows.length) continue;
      total += rows.length;
      listBox.append(
        section(
          `${k} (${rows.length})`,
          h(
            "div",
            { class: "sym-table" },
            rows
              .sort((a, b) => a.kommando.localeCompare(b.kommando, "da"))
              .map((e) =>
                h(
                  "div",
                  { class: "sym-row" },
                  h("span", { class: "sym-big" }, symbolPreview(e)),
                  h("code", { class: "sym-cmd", title: "Klik for at kopiere", onclick: () => navigator.clipboard.writeText("\\" + e.kommando).then(() => toast("Kopieret: \\" + e.kommando)) }, "\\" + e.kommando),
                  h("span", { class: "sym-desc" }, e.beskrivelse || "", e.latex && e.latex !== "\\" + e.kommando ? h("small", {}, "LaTeX: " + e.latex) : null),
                  canEdit && h("button", { class: "icon-btn small danger", title: "Fjern fra listen", onclick: () => removeSymbol(e) }, icon("trash")),
                ),
              ),
          ),
        ),
      );
    }
    if (!total) listBox.append(h("p", { class: "muted" }, "Ingen symboler matcher."));
  }

  async function removeSymbol(e) {
    if (!(await seedSymbols())) return;
    const row = state.symbols.find((x) => x.kommando === e.kommando);
    const { error } = await db.from("symboler").delete().eq("id", row.id);
    if (error) return toast("Kunne ikke fjerne: " + error.message, "error");
    await loadSymbols();
    if (!state.symbolsSeeded) {
      // Listen blev tom: gem en markør, så standardlisten ikke vender tilbage
      state.symbols = [];
      state.symbolsSeeded = true;
    }
    toast(`\\${e.kommando} er fjernet`);
    draw();
  }

  const f = {
    kommando: h("input", { placeholder: "f.eks. vinkel", required: true, pattern: "[A-Za-z][A-Za-z0-9]*" }),
    tegn: h("input", { placeholder: "f.eks. ∠ eller ∫_0^1  dx", required: true }),
    latex: h("input", { placeholder: "f.eks. \\angle (valgfri)" }),
    kategori: h("input", { placeholder: "Kategori", list: "symKat", value: "Andet" }),
    beskrivelse: h("input", { placeholder: "Kort beskrivelse (valgfri)" }),
  };
  const addForm = h(
    "form",
    {
      class: "panel sym-form",
      onsubmit: async (e) => {
        e.preventDefault();
        const kommando = f.kommando.value.trim().replace(/^\\/, "");
        if (!/^[A-Za-z][A-Za-z0-9]*$/.test(kommando)) return toast("Kommandoen må kun indeholde bogstaver og tal og skal starte med et bogstav", "error");
        if (!(await seedSymbols())) return;
        const row = {
          kommando,
          tegn: f.tegn.value,
          latex: f.latex.value.trim() || null,
          kategori: f.kategori.value.trim() || "Andet",
          beskrivelse: f.beskrivelse.value.trim() || null,
        };
        const existing = state.symbols.find((x) => x.kommando === kommando);
        const { error } = existing
          ? await db.from("symboler").update(row).eq("id", existing.id)
          : await db.from("symboler").insert(row);
        if (error) return toast("Kunne ikke gemme: " + error.message, "error");
        await loadSymbols();
        toast(existing ? `\\${kommando} er opdateret` : `\\${kommando} er tilføjet`, "ok");
        Object.values(f).forEach((i) => i !== f.kategori && (i.value = ""));
        draw();
      },
    },
    h("h2", {}, "Tilføj eller ret et symbol"),
    h("p", { class: "muted small" }, "Findes kommandoen allerede, bliver den opdateret. Tegn er det, der indsættes i WordMat og tekst. LaTeX bruges inde i $…$-formler."),
    h(
      "div",
      { class: "sym-form-grid" },
      h("label", { class: "field" }, h("span", {}, "Kommando (uden \\)"), f.kommando),
      h("label", { class: "field" }, h("span", {}, "Tegn / tekst"), f.tegn),
      h("label", { class: "field" }, h("span", {}, "LaTeX"), f.latex),
      h("label", { class: "field" }, h("span", {}, "Kategori"), f.kategori),
      h("label", { class: "field wide" }, h("span", {}, "Beskrivelse"), f.beskrivelse),
    ),
    h("datalist", { id: "symKat" }, KATEGORIER.map((k) => h("option", { value: k }))),
    h(
      "div",
      { class: "row" },
      h("button", { class: "btn primary", type: "submit" }, icon("plus"), "Gem symbol"),
      h(
        "button",
        {
          class: "btn ghost",
          type: "button",
          onclick: async () => {
            if (!confirm("Slet alle dine ændringer og gendan standardlisten?")) return;
            await db.from("symboler").delete().eq("user_id", state.user.id);
            await loadSymbols();
            toast("Standardlisten er gendannet", "ok");
            draw();
          },
        },
        "Gendan standardlisten",
      ),
    ),
  );

  v.append(
    h(
      "header",
      { class: "page-head" },
      h("div", { class: "crumbs" }, h("a", { href: "#/" }, "Forside"), " / Symboler"),
      h("div", { class: "title-row" }, h("span", { class: "big-icon" }, "Ω"), h("h1", {}, "Symboler og \\-kommandoer")),
      h(
        "p",
        { class: "muted" },
        "Skriv \\ og navnet i editoren, f.eks. \\alpha eller \\int. En liste dukker op mens du skriver. Mellemrum gør \\alpha til α (som i Word), og Enter eller Tab vælger fra listen. Inde i $…$ indsættes LaTeX i stedet.",
      ),
    ),
    state.symbolsError ? h("div", { class: "notice" }, "Din egen liste kan ikke gemmes endnu: kør supabase/schema-v3.sql i Supabase. Indtil da bruges standardlisten.") : "",
    !state.user ? h("div", { class: "notice" }, "Log ind for at tilføje og fjerne symboler.") : "",
    canEdit ? addForm : "",
    h("div", { class: "toolbar-row" }, search, catSel),
    listBox,
  );
  draw();
}

// ─── Eksport ────────────────────────────────────────────────────────────

function exportMarkdown(it) {
  const fm = [
    "---",
    `titel: ${JSON.stringify(it.titel)}`,
    `type: ${it.type}`,
    it.status && `status: ${it.status}`,
    it.url && `url: ${it.url}`,
    `tags: [${(it.tags || []).map((t) => JSON.stringify(t)).join(", ")}]`,
    `oprettet: ${it.oprettet}`,
    `opdateret: ${it.opdateret}`,
    "---",
    "",
  ]
    .filter(Boolean)
    .join("\n");
  const name = it.titel.normalize("NFKD").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "element";
  download(name + ".md", fm + (it.beskrivelse ? `> ${it.beskrivelse}\n\n` : "") + (it.indhold || ""), "text/markdown");
}

async function exportBackup() {
  const { data: files } = await db.from("filer").select("*");
  const backup = { eksporteret: new Date().toISOString(), elementer: state.items, filer: files || [] };
  download(`harrison-library-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), "application/json");
  toast("Backup downloadet (filerne selv ligger stadig i Supabase)", "ok");
}

// ─── Tastatur ───────────────────────────────────────────────────────────

document.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (!$(".palette")) openPalette();
    return;
  }
  if (mod && e.key.toLowerCase() === "s") {
    if (location.hash.startsWith("#/ret/") || location.hash.startsWith("#/ny")) {
      e.preventDefault();
      editorSave && editorSave();
    }
    return;
  }
  if (isTyping(e) || mod || e.altKey || $(".modal-back")) return;
  if (e.key === "/") {
    e.preventDefault();
    openPalette();
  } else if (e.key === "n" && state.user) newItem("post");
  else if (e.key === "e") {
    const it = currentItem();
    if (it && isOwner(it) && location.hash.startsWith("#/e/")) location.hash = "#/ret/" + it.id;
  } else if (e.key === "t") cycleTheme();
  else if (e.key === "?") showShortcuts();
});

// ─── Opstart ────────────────────────────────────────────────────────────

$("#themeBtn").onclick = cycleTheme;
$("#menuBtn").onclick = () => document.body.classList.toggle("nav-open");
$("#scrim").onclick = () => document.body.classList.remove("nav-open");
$("#searchBtn").onclick = openPalette;
applyTheme(readJSON("hl-theme", ""));

let booted = false;
db.auth.onAuthStateChange((event, session) => {
  const user = session ? session.user : null;
  if (booted && (user?.id || null) === (state.user?.id || null)) return;
  state.user = user;
  setTimeout(async () => {
    booted = true;
    renderTopbar();
    await Promise.all([loadItems(), loadSymbols()]);
    if (event === "SIGNED_IN") toast("Velkommen tilbage 👋", "ok");
    route();
  }, 0);
});
