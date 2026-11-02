// Markdown med LaTeX, beregninger (math.js), grafer, Python (Pyodide) og diagrammer (Mermaid)

import { wordmatBlock, loadNerdamer } from "./wordmat.js";

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
const MERMAID = "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js";

window.marked.setOptions({ gfm: true, breaks: false });

const scripts = {};
export function loadScript(src) {
  if (!scripts[src]) {
    scripts[src] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => {
        delete scripts[src];
        reject(new Error("Kunne ikke hente " + src));
      };
      document.head.append(s);
    });
  }
  return scripts[src];
}

export function isDark() {
  const t = document.documentElement.dataset.theme;
  return t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// ─── Forbehandling af Markdown (kun uden for kode) ──────────────────────

const CODE_RE = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`)/g;

function outsideCode(src, fn) {
  return src.split(CODE_RE).map((part, i) => (i % 2 ? part : fn(part))).join("");
}

function preprocess(text, math) {
  const put = (tex, display) => {
    math.push({ tex, display });
    return `MATHPH${math.length - 1}END`;
  };
  return text
    // Filer: ![billede](fil:navn.png) → løses op til en rigtig adresse bagefter
    .replace(/\]\(fil:/g, "](#fil:")
    // Wiki-links: [[Titel]] eller [[Titel|tekst]]
    .replace(/\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g,
      (_, t, alias) => `[${alias || t}](#/titel/${encodeURIComponent(t.trim())})`)
    // Indlejrede beregninger: {{v to km/h}}
    .replace(/\{\{([^}\n]+)\}\}/g,
      (_, e) => `<span class="calc-inline" data-expr="${encodeURIComponent(e.trim())}"></span>`)
    // Matematik
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => put(t, true))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, t) => put(t, true))
    .replace(/\\\((.+?)\\\)/g, (_, t) => put(t, false))
    .replace(/(^|[^\\$\w])\$(?!\s)([^$\n]+?)(?<!\s)\$(?![\w$])/g, (_, pre, t) => pre + put(t, false));
}

function tex(src, display = false) {
  return window.katex.renderToString(src, { displayMode: display, throwOnError: false });
}

// ─── Hovedfunktion ──────────────────────────────────────────────────────

/**
 * ctx: { resolveFile(navn) → {url, navn} | null, hasTitle(titel) → bool, onImage(img), autorun }
 */
export async function renderMarkdown(src, target, ctx = {}) {
  const math = [];
  const text = outsideCode(src || "", (t) => preprocess(t, math));
  let html = window.DOMPurify.sanitize(window.marked.parse(text));
  html = html.replace(/MATHPH(\d+)END/g, (_, i) => tex(math[i].tex, math[i].display));
  target.innerHTML = html;
  target.classList.add("prose");
  await enhance(target, ctx);
}

async function enhance(root, ctx) {
  const scope = {};
  const pending = [];
  if (root.querySelector("code.language-wordmat, code.language-wm")) {
    await loadNerdamer(loadScript).catch(() => {});
  }

  for (const code of root.querySelectorAll("pre > code")) {
    const lang = ((code.className.match(/language-([\w-]+)/) || [])[1] || "").toLowerCase();
    const pre = code.parentElement;
    const src = code.textContent.replace(/\n$/, "");
    if (lang === "calc" || lang === "regn") pre.replaceWith(calcBlock(src, scope));
    else if (lang === "wordmat" || lang === "wm") pre.replaceWith(wordmatBlock(src, scope));
    else if (lang === "plot" || lang === "graf") pre.replaceWith(plotBlock(src, scope));
    else if (lang === "python" || lang === "py") {
      const spot = document.createComment("");
      pre.replaceWith(spot);
      spot.replaceWith(pythonBlock(src, pre, ctx));
    }
    else if (lang === "mermaid") {
      const box = el("div", "mermaid-block");
      pre.replaceWith(box);
      pending.push(renderMermaid(box, src));
    } else {
      if (window.hljs) window.hljs.highlightElement(code);
      pre.classList.add("code");
      pre.append(copyButton(() => code.textContent));
    }
  }

  for (const span of root.querySelectorAll(".calc-inline")) {
    const expr = decodeURIComponent(span.dataset.expr || "");
    try {
      span.textContent = formatValue(window.math.evaluate(expr, scope));
    } catch (e) {
      span.textContent = "⚠ " + expr;
      span.title = e.message;
      span.classList.add("err");
    }
  }

  for (const node of root.querySelectorAll('img[src^="#fil:"], a[href^="#fil:"]')) {
    const attr = node.tagName === "IMG" ? "src" : "href";
    const name = decodeURIComponent(node.getAttribute(attr).slice(5));
    const file = ctx.resolveFile && ctx.resolveFile(name);
    if (file) {
      node.setAttribute(attr, node.tagName === "IMG" ? file.url : file.downloadUrl || file.url);
      if (node.tagName === "A") node.setAttribute("target", "_blank");
    } else {
      node.classList.add("missing-file");
      node.setAttribute("title", "Filen findes ikke: " + name);
      if (node.tagName === "IMG") node.removeAttribute("src");
    }
  }

  for (const a of root.querySelectorAll('a[href^="http"]')) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }

  for (const a of root.querySelectorAll('a[href^="#/titel/"]')) {
    a.classList.add("wikilink");
    const t = decodeURIComponent(a.getAttribute("href").slice(8));
    if (ctx.hasTitle && !ctx.hasTitle(t)) a.classList.add("missing");
  }

  for (const img of root.querySelectorAll("img")) {
    img.loading = "lazy";
    if (ctx.onImage) img.addEventListener("click", () => ctx.onImage(img));
  }

  for (const table of root.querySelectorAll("table")) {
    const wrap = el("div", "table-wrap");
    table.replaceWith(wrap);
    wrap.append(table);
  }

  for (const h of root.querySelectorAll("h1, h2, h3")) {
    h.id = slug(h.textContent);
  }

  await Promise.all(pending);
}

export function slug(s) {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
}

function copyButton(getText) {
  const b = el("button", "copy-btn", "Kopiér");
  b.type = "button";
  b.onclick = async () => {
    await navigator.clipboard.writeText(getText());
    b.textContent = "Kopieret ✓";
    setTimeout(() => (b.textContent = "Kopiér"), 1500);
  };
  return b;
}

// ─── Beregninger med math.js ────────────────────────────────────────────

export function formatValue(v) {
  if (typeof v === "function") return "funktion";
  if (v && v.isResultSet) v = v.entries[v.entries.length - 1];
  try {
    return window.math.format(v, { precision: 6, lowerExp: -6, upperExp: 9 });
  } catch {
    return String(v);
  }
}

function exprTex(expr) {
  try {
    return tex(window.math.parse(expr).toTex({ parenthesis: "auto", implicit: "hide" }));
  } catch {
    return null;
  }
}

function splitComment(line) {
  const i = line.search(/\s#\s/);
  return i < 0 ? [line, ""] : [line.slice(0, i).trim(), line.slice(i + 2).trim()];
}

function calcBlock(src, scope) {
  const box = el("div", "calc");
  const head = el("div", "block-head");
  head.append(el("span", "block-label", "∑ Beregning"));
  const toggle = el("button", "link-btn", "Vis kilde");
  toggle.type = "button";
  head.append(toggle);
  box.append(head);

  const rows = el("div", "calc-rows");
  const source = el("pre", "calc-source hidden");
  source.textContent = src;
  toggle.onclick = () => {
    const showing = source.classList.toggle("hidden");
    toggle.textContent = showing ? "Vis kilde" : "Skjul kilde";
  };

  for (const raw of src.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#") || line.startsWith("//")) {
      rows.append(el("div", "calc-comment", line.replace(/^(#|\/\/)\s?/, "")));
      continue;
    }
    const [expr, note] = splitComment(line);
    const row = el("div", "calc-row");
    const left = el("div", "calc-expr");
    const t = exprTex(expr);
    if (t) left.innerHTML = t;
    else left.textContent = expr;
    const right = el("div", "calc-result");
    try {
      const res = window.math.evaluate(expr, scope);
      right.textContent = typeof res === "function" ? "funktion defineret" : "= " + formatValue(res);
    } catch (e) {
      right.textContent = e.message;
      right.classList.add("err");
    }
    row.append(left, right);
    if (note) row.append(el("div", "calc-note", note));
    rows.append(row);
  }
  box.append(rows, source);
  return box;
}

// ─── Grafer ─────────────────────────────────────────────────────────────

const PLOT_COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)"];

function niceTicks(min, max, count = 6) {
  const span = max - min;
  if (!(span > 0)) return [min];
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count + 1);
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  }
  return ticks;
}

function toNumber(v) {
  if (typeof v === "number") return v;
  if (v && typeof v.toNumber === "function" && v.isUnit) return v.value;
  if (v && v.isComplex) return Math.abs(v.im) < 1e-12 ? v.re : NaN;
  if (v && v.isBigNumber) return v.toNumber();
  return NaN;
}

function tickLabel(v) {
  return Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0)
    ? v.toExponential(1)
    : String(+v.toFixed(6));
}

function plotBlock(src, sharedScope) {
  // Egen kopi, så funktioner defineret i grafen ikke overskriver beregningernes variabler
  const scope = { ...sharedScope };
  const box = el("div", "plot");
  const opts = { x: [-10, 10], y: null, titel: "" };
  const series = [];
  const errors = [];

  for (const raw of src.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(x|y|titel|title)\s*:\s*(.+)$/i);
    try {
      if (m) {
        const key = m[1].toLowerCase();
        if (key === "x" || key === "y") {
          opts[key] = m[2].split(/\.\.|,/).map((s) => toNumber(window.math.evaluate(s.trim(), scope)));
        } else {
          opts.titel = m[2];
        }
        continue;
      }
      const node = window.math.parse(line);
      if (node.type === "FunctionAssignmentNode") {
        node.evaluate(scope);
        const fn = scope[node.name];
        series.push({ label: line, f: (x) => fn(x) });
      } else {
        const c = node.compile();
        series.push({ label: line, f: (x) => c.evaluate({ ...scope, x }) });
      }
    } catch (e) {
      errors.push(line + ": " + e.message);
    }
  }

  const head = el("div", "block-head");
  head.append(el("span", "block-label", "📈 " + (opts.titel || "Graf")));
  box.append(head);

  const [x0, x1] = opts.x;
  const N = 600;
  const xs = Array.from({ length: N + 1 }, (_, i) => x0 + ((x1 - x0) * i) / N);
  for (const s of series) {
    s.ys = xs.map((x) => {
      try {
        return toNumber(s.f(x));
      } catch {
        return NaN;
      }
    });
  }

  let [y0, y1] = opts.y || [NaN, NaN];
  if (!opts.y) {
    const all = series.flatMap((s) => s.ys).filter(Number.isFinite).sort((a, b) => a - b);
    if (all.length) {
      y0 = all[Math.floor(all.length * 0.02)];
      y1 = all[Math.ceil(all.length * 0.98) - 1];
      const pad = (y1 - y0) * 0.1 || 1;
      y0 -= pad;
      y1 += pad;
    } else {
      [y0, y1] = [-1, 1];
    }
  }

  const W = 640, H = 360, L = 48, R = 16, T = 16, B = 32;
  const sx = (x) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const sy = (y) => T + ((y1 - y) / (y1 - y0)) * (H - T - B);
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "plot-svg");
  const add = (tag, attrs, text) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    svg.append(e);
    return e;
  };

  for (const t of niceTicks(x0, x1)) {
    add("line", { x1: sx(t), x2: sx(t), y1: T, y2: H - B, class: "grid" });
    add("text", { x: sx(t), y: H - B + 18, class: "tick", "text-anchor": "middle" }, tickLabel(t));
  }
  for (const t of niceTicks(y0, y1)) {
    add("line", { x1: L, x2: W - R, y1: sy(t), y2: sy(t), class: "grid" });
    add("text", { x: L - 6, y: sy(t) + 4, class: "tick", "text-anchor": "end" }, tickLabel(t));
  }
  if (y0 < 0 && y1 > 0) add("line", { x1: L, x2: W - R, y1: sy(0), y2: sy(0), class: "axis" });
  if (x0 < 0 && x1 > 0) add("line", { x1: sx(0), x2: sx(0), y1: T, y2: H - B, class: "axis" });

  const clipId = "clip" + Math.random().toString(36).slice(2);
  const defs = add("defs", {});
  const clip = document.createElementNS(NS, "clipPath");
  clip.id = clipId;
  const rect = document.createElementNS(NS, "rect");
  Object.entries({ x: L, y: T, width: W - L - R, height: H - T - B }).forEach(([k, v]) => rect.setAttribute(k, v));
  clip.append(rect);
  defs.append(clip);

  const span = y1 - y0;
  series.forEach((s, i) => {
    let d = "";
    let pen = false;
    s.ys.forEach((y, j) => {
      const prev = s.ys[j - 1];
      if (!Number.isFinite(y) || (pen && Math.abs(y - prev) > span * 2)) {
        pen = false;
        if (!Number.isFinite(y)) return;
      }
      d += (pen ? "L" : "M") + sx(xs[j]).toFixed(2) + " " + sy(y).toFixed(2);
      pen = true;
    });
    add("path", { d, class: "series", stroke: PLOT_COLORS[i % PLOT_COLORS.length], "clip-path": `url(#${clipId})` });
  });

  // Hover: lodret linje og værdier
  const cross = add("line", { x1: 0, x2: 0, y1: T, y2: H - B, class: "cross hidden" });
  const dots = series.map((_, i) => add("circle", { r: 4, class: "dot hidden", fill: PLOT_COLORS[i % PLOT_COLORS.length] }));
  const tip = el("div", "plot-tip hidden");

  svg.addEventListener("pointermove", (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    if (px < L || px > W - R) return hide();
    const j = Math.round(((px - L) / (W - L - R)) * N);
    const x = xs[j];
    cross.setAttribute("x1", sx(x));
    cross.setAttribute("x2", sx(x));
    cross.classList.remove("hidden");
    const lines = [`x = ${formatValue(x)}`];
    series.forEach((s, i) => {
      const y = s.ys[j];
      if (Number.isFinite(y) && y >= y0 && y <= y1) {
        dots[i].setAttribute("cx", sx(x));
        dots[i].setAttribute("cy", sy(y));
        dots[i].classList.remove("hidden");
      } else dots[i].classList.add("hidden");
      lines.push(`${s.label.split("=")[0].trim()} = ${Number.isFinite(y) ? formatValue(y) : "–"}`);
    });
    tip.textContent = lines.join("\n");
    tip.style.left = Math.min(r.width - 140, (sx(x) / W) * r.width + 12) + "px";
    tip.classList.remove("hidden");
  });
  const hide = () => {
    cross.classList.add("hidden");
    dots.forEach((d) => d.classList.add("hidden"));
    tip.classList.add("hidden");
  };
  svg.addEventListener("pointerleave", hide);

  const stage = el("div", "plot-stage");
  stage.append(svg, tip);
  box.append(stage);

  const legend = el("div", "plot-legend");
  series.forEach((s, i) => {
    const item = el("span", "legend-item");
    const sw = el("span", "swatch");
    sw.style.background = PLOT_COLORS[i % PLOT_COLORS.length];
    const label = el("span");
    const t = exprTex(s.label);
    if (t) label.innerHTML = t;
    else label.textContent = s.label;
    item.append(sw, label);
    legend.append(item);
  });
  box.append(legend);
  for (const err of errors) box.append(el("div", "err", err));
  return box;
}

// ─── Python i browseren (Pyodide) ───────────────────────────────────────

let pyodidePromise;
function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = loadScript(PYODIDE + "pyodide.js")
      .then(() => window.loadPyodide({ indexURL: PYODIDE }))
      .catch((e) => {
        pyodidePromise = null;
        throw e;
      });
  }
  return pyodidePromise;
}

export async function runPython(src) {
  const py = await getPyodide();
  let out = "";
  py.setStdout({ batched: (s) => (out += s + "\n") });
  py.setStderr({ batched: (s) => (out += s + "\n") });
  await py.loadPackagesFromImports(src);
  const plots = /matplotlib|pyplot/.test(src);
  if (plots) await py.runPythonAsync("import matplotlib\nmatplotlib.use('agg')");
  let error = false;
  try {
    const res = await py.runPythonAsync(src);
    if (res !== undefined && res !== null) {
      out += String(res) + "\n";
      if (res.destroy) res.destroy();
    }
  } catch (e) {
    out += e.message;
    error = true;
  }
  const images = [];
  if (plots) {
    const pngs = await py.runPythonAsync(`
import io, base64
import matplotlib.pyplot as _plt
_res = []
for _n in _plt.get_fignums():
    _buf = io.BytesIO()
    _plt.figure(_n).savefig(_buf, format="png", dpi=120, bbox_inches="tight")
    _res.append(base64.b64encode(_buf.getvalue()).decode())
_plt.close("all")
_res
`);
    images.push(...pngs.toJs());
    pngs.destroy();
  }
  return { out: out.trimEnd(), images, error };
}

function pythonBlock(src, pre, ctx) {
  const box = el("div", "py");
  const head = el("div", "block-head");
  head.append(el("span", "block-label", "🐍 Python"));
  const run = el("button", "btn small primary", "▶ Kør");
  run.type = "button";
  head.append(run);
  const code = pre.querySelector("code");
  if (window.hljs) window.hljs.highlightElement(code);
  pre.classList.add("code");
  pre.append(copyButton(() => src));
  const out = el("div", "py-out hidden");
  box.append(head, pre, out);

  run.onclick = async () => {
    run.disabled = true;
    run.textContent = "⏳ Henter Python…";
    out.classList.remove("hidden");
    out.innerHTML = "";
    out.append(el("div", "muted", "Første gang tager det lidt tid at hente Python og pakker."));
    try {
      const timer = setTimeout(() => (run.textContent = "⏳ Kører…"), 300);
      const res = await runPython(src);
      clearTimeout(timer);
      out.innerHTML = "";
      if (res.out) {
        const p = el("pre", res.error ? "py-text err" : "py-text");
        p.textContent = res.out;
        out.append(p);
      }
      for (const b64 of res.images) {
        const img = el("img", "py-img");
        img.src = "data:image/png;base64," + b64;
        if (ctx.onImage) img.onclick = () => ctx.onImage(img);
        out.append(img);
      }
      if (!res.out && !res.images.length) out.append(el("div", "muted", "Færdig (intet output)."));
    } catch (e) {
      out.innerHTML = "";
      out.append(el("pre", "py-text err", e.message));
    } finally {
      run.disabled = false;
      run.textContent = "▶ Kør igen";
    }
  };
  if (ctx.autorun) queueMicrotask(() => run.click());
  return box;
}

// ─── Diagrammer (Mermaid) ───────────────────────────────────────────────

let mermaidTheme = null;
async function renderMermaid(box, src) {
  try {
    await loadScript(MERMAID);
    const theme = isDark() ? "dark" : "default";
    if (mermaidTheme !== theme) {
      window.mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme });
      mermaidTheme = theme;
    }
    const { svg } = await window.mermaid.render("mmd" + Math.random().toString(36).slice(2), src);
    box.innerHTML = svg;
  } catch (e) {
    box.classList.add("err");
    box.textContent = "Diagramfejl: " + (e.message || e);
  }
}
