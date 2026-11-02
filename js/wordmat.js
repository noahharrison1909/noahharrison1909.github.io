// WordMat-agtig matematik: decimalkomma, Definer:, = (beregn), ≈ (numerisk), Løs:, grader, log/ln
// Eksakte resultater og ligningsløsning med nerdamer, tal og enheder med math.js

const NERDAMER = "https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/";

let nerdamerPromise;
export function loadNerdamer(loadScript) {
  if (!nerdamerPromise) {
    nerdamerPromise = ["nerdamer.core.js", "Algebra.js", "Calculus.js", "Solve.js"]
      .reduce((p, f) => p.then(() => loadScript(NERDAMER + f)), Promise.resolve())
      .catch((e) => {
        nerdamerPromise = null;
        throw e;
      });
  }
  return nerdamerPromise;
}

// Trigonometri i grader (WordMats standard)
const RAD = Math.PI / 180;
let imported = false;
function importDegrees() {
  if (imported) return;
  const m = window.math;
  const fwd = (f) => (x) => (x && x.isUnit ? m[f](x) : m[f](m.multiply(x, RAD)));
  const inv = (f) => (x) => m.divide(m[f](x), RAD);
  m.import({
    sind: fwd("sin"),
    cosd: fwd("cos"),
    tand: fwd("tan"),
    asind: inv("asin"),
    acosd: inv("acos"),
    atand: inv("atan"),
  });
  imported = true;
}

// ─── Omskrivning af WordMat-syntaks ─────────────────────────────────────

function normalize(s) {
  return s
    .replace(/[−–]/g, "-")
    .replace(/[·∙×⋅]/g, "*")
    .replace(/÷/g, "/")
    .replace(/π/g, " pi ")
    .replace(/∞/g, "Infinity")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/√\s*\(/g, "sqrt(")
    .replace(/√\s*([\w.,]+)/g, "sqrt($1)")
    .replace(/∛\s*\(/g, "cbrt(")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/;/g, ",")
    .replace(/\barc(sin|cos|tan)\(/g, "a$1(");
}

function toMathjs(s, opts) {
  let out = normalize(s).replace(/\blog\(/g, "log10(").replace(/\bln\(/g, "log(");
  if (opts.grader) out = out.replace(/\b(a?(?:sin|cos|tan))\(/g, "$1d(");
  return out;
}

function toNerdamer(s, opts) {
  let out = normalize(s).replace(/\blog\(/g, "log10(").replace(/\bln\(/g, "log(");
  if (opts.grader) {
    out = wrapCalls(out, /\b(sin|cos|tan)\(/, (fn, arg) => `${fn}((${arg})*pi/180)`);
    out = wrapCalls(out, /\ba(sin|cos|tan)\(/, (fn, arg) => `(${fn}(${arg})*180/pi)`);
  }
  return out;
}

// Erstat fn(...) med matchende parenteser
function wrapCalls(s, re, make) {
  let out = "";
  let rest = s;
  for (;;) {
    const m = rest.match(re);
    if (!m) return out + rest;
    const start = m.index;
    let i = start + m[0].length;
    let depth = 1;
    while (i < rest.length && depth) {
      if (rest[i] === "(") depth++;
      else if (rest[i] === ")") depth--;
      i++;
    }
    const fn = m[0].slice(0, -1);
    const arg = rest.slice(start + m[0].length, i - 1);
    out += rest.slice(0, start) + make(fn, arg);
    rest = rest.slice(i);
  }
}

function splitTop(s, sep) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === sep && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

// ─── Visning ────────────────────────────────────────────────────────────

const dk = (s) => s.replace(/(\d)\.(\d)/g, "$1{,}$2");
const ndTex = (expr) => dk(expr.toTeX().replace(/\\mathrm\{log10\}/g, "\\log").replace(/\\mathrm\{log\}/g, "\\ln"));
const ugly = (str) => /\d{6,}/.test(str);

function tex(src, display = false) {
  return window.katex.renderToString(src, { displayMode: display, throwOnError: false });
}

function exprToTex(s, opts) {
  try {
    const node = window.math.parse(toMathjs(s, { ...opts, grader: false }));
    return dk(node.toTex({ parenthesis: "auto", implicit: "hide" }))
      .replace(/\\log_\{10\}|\\log10/g, "\\log")
      .replace(/\\mathrm\{([a-zA-Z]\w*)\}/g, (m, name) => (opts.scope && name in opts.scope ? "{" + name + "}" : m));
  } catch {
    return "\\text{" + s.replace(/[{}\\]/g, "") + "}";
  }
}

// a=b eller a<b osv. vises side for side
function statementToTex(s, opts) {
  const m = s.match(/(<=|>=|≤|≥|≠|<|>|=)/);
  if (!m) return exprToTex(s, opts);
  const rel = { "<=": "\\le", ">=": "\\ge", "≤": "\\le", "≥": "\\ge", "≠": "\\ne", "<": "<", ">": ">", "=": "=" }[m[1]];
  const [l, ...r] = s.split(m[1]);
  return exprToTex(l, opts) + " " + rel + " " + statementToTex(r.join(m[1]), opts);
}

function numToDk(str) {
  return str
    .replace(/(\d)\.(\d)/g, "$1,$2")
    .replace(/e\+?(-?\d+)/g, "·10^$1");
}

function numericTex(v, digits) {
  const m = window.math;
  if (v && v.isResultSet) v = v.entries[v.entries.length - 1];
  const str = m.format(v, { precision: digits, lowerExp: -5, upperExp: 9 });
  try {
    const node = m.parse(str.replace(/e\+?(-?\d+)/g, "*10^$1"));
    return dk(node.toTex({ parenthesis: "auto", implicit: "hide" }));
  } catch {
    return "\\text{" + numToDk(str) + "}";
  }
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// ─── Beregning ──────────────────────────────────────────────────────────

function knownValues(scope) {
  const out = {};
  for (const [k, v] of Object.entries(scope)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = String(v);
    else if (v && v.isFraction) out[k] = `${v.s * v.n}/${v.d}`;
  }
  return out;
}

function hasUnitsOrDecimals(src, scope) {
  if (/\d[.,]\d/.test(src)) return true;
  const m = window.math;
  try {
    let unit = false;
    m.parse(normalize(src)).traverse((n) => {
      if (n.isSymbolNode) {
        const v = scope[n.name];
        if (v && v.isUnit) unit = true;
        else if (typeof v === "number" && !Number.isInteger(v)) unit = true;
        else if (!(n.name in scope) && m.Unit.isValuelessUnit(n.name) && !/^[a-zA-Z]$/.test(n.name)) unit = true;
      }
    });
    return unit;
  } catch {
    return true;
  }
}

function exact(src, scope, opts) {
  const nd = window.nerdamer;
  if (!nd) return null;
  try {
    const r = nd(toNerdamer(src, opts), knownValues(scope));
    const simplified = nd("simplify(" + r.toString() + ")");
    const t = ndTex(simplified);
    if (/NaN|Infinity|undefined/.test(t) || ugly(simplified.toString())) return null;
    let approx = null;
    try {
      const n = Number(simplified.evaluate().text("decimals"));
      if (Number.isFinite(n) && !/^-?\d+$/.test(simplified.toString())) approx = n;
    } catch {}
    return { tex: t, approx, isNumber: Number.isFinite(Number(simplified.evaluate().text("decimals"))) };
  } catch {
    return null;
  }
}

function numericSolve(f, lo, hi) {
  const N = 4000;
  const roots = [];
  let px = lo;
  let py = f(px);
  for (let i = 1; i <= N; i++) {
    const x = lo + ((hi - lo) * i) / N;
    const y = f(x);
    if (Number.isFinite(py) && Number.isFinite(y)) {
      if (py === 0) roots.push(px);
      else if (py * y < 0) {
        let a = px, b = x, fa = py;
        for (let k = 0; k < 80; k++) {
          const c = (a + b) / 2;
          const fc = f(c);
          if (fa * fc <= 0) b = c;
          else { a = c; fa = fc; }
        }
        const r = (a + b) / 2;
        if (Math.abs(f(r)) < 1e-6 * (1 + Math.abs(r))) roots.push(r);
      }
    }
    px = x;
    py = y;
  }
  return roots.filter((r, i) => i === 0 || Math.abs(r - roots[i - 1]) > 1e-7);
}

function solve(body, scope, opts) {
  // "Løs: x^2=4" eller "Løs: x^2=4; x" eller system "2x+y=5 ∧ x-y=1; x,y"
  const parts = splitTop(body.replace(/∧/g, "&"), ";").length > 1 && /[a-zA-ZæøåÆØÅ]\s*$/.test(body)
    ? [body.slice(0, body.lastIndexOf(";")), body.slice(body.lastIndexOf(";") + 1)]
    : [body, ""];
  const eqs = splitTop(parts[0].replace(/∧/g, "&"), "&");
  let vars = parts[1].split(/[,\s]+/).map((v) => v.trim()).filter(Boolean);
  const nd = window.nerdamer;
  const known = knownValues(scope);

  const asExpr = (eq) => {
    const i = eq.indexOf("=");
    const e = i < 0 ? eq : `(${eq.slice(0, i)})-(${eq.slice(i + 1)})`;
    return nd ? nd(toNerdamer(e, opts), known).toString() : toNerdamer(e, opts);
  };

  if (!vars.length && nd) {
    const all = new Set();
    for (const eq of eqs) for (const v of nd(asExpr(eq)).variables()) all.add(v);
    vars = [...all];
  }
  if (!vars.length) throw new Error("Fandt ingen ubekendt. Skriv f.eks. Løs: 2x+3=7; x");

  const lhs = eqs.map((e) => statementToTex(e, opts)).join(" \\;\\land\\; ");

  // Ligningssystem
  if (eqs.length > 1) {
    if (!nd) throw new Error("Ligningssystemer kræver nerdamer");
    const sol = nd.solveEquations(eqs.map((e) => toNerdamer(e, opts)), vars);
    const list = Array.isArray(sol) ? sol : [];
    if (!list.length) return { tex: lhs + " \\;\\Leftrightarrow\\; \\text{ingen løsning fundet}" };
    const rhs = list.map(([v, val]) => (ugly(String(val)) ? `${v} \\approx ${dk(fmtNum(Number(nd(String(val)).evaluate().text("decimals")), opts.cifre))}` : `${v} = ${ndTex(nd(String(val)))}`)).join(" \\;\\land\\; ");
    return { tex: lhs + " \\;\\Leftrightarrow\\; " + rhs };
  }

  if (vars.length > 1) throw new Error(`Flere ubekendte (${vars.join(", ")}). Angiv hvilken: Løs: ...; ${vars[0]}`);
  const v = vars[0];
  const trig = opts.grader && /\b(a?(sin|cos|tan))\(/.test(eqs[0]);

  // Eksakt løsning (kun uden decimaltal og enheder, ligesom WordMat)
  if (nd && !trig && !hasUnitsOrDecimals(eqs[0].replace(/[=<>]/g, "-"), scope)) {
    try {
      const expr = asExpr(eqs[0]);
      let sols = null;
      let deg = NaN;
      try {
        deg = Number(nd(`deg(${expr}, ${v})`).toString());
      } catch {}
      if (deg === 1 || deg === 2) {
        const c = nd.coeffs(expr, v).symbol.elements.map((e) => `(${e.toString()})`);
        if (c.every((x) => !new RegExp(`\\b${v}\\b`).test(x))) {
          if (deg === 1) sols = [nd(`simplify(-${c[0]}/${c[1]})`)];
          else {
            const D = nd(`${c[1]}^2-4*${c[2]}*${c[0]}`);
            const dNum = Number(D.evaluate().text("decimals"));
            if (Number.isFinite(dNum) && dNum < 0) return { tex: lhs + " \\;\\Leftrightarrow\\; \\text{ingen reelle løsninger}" };
            sols = dNum === 0
              ? [nd(`simplify(-${c[1]}/(2*${c[2]}))`)]
              : [nd(`simplify((-${c[1]}-sqrt(${D}))/(2*${c[2]}))`), nd(`simplify((-${c[1]}+sqrt(${D}))/(2*${c[2]}))`)];
          }
        }
      }
      if (!sols) {
        const res = nd.solve(expr, v);
        sols = ((res.symbol && res.symbol.elements) || [])
          .map((s) => nd(s.toString()))
          .filter((s) => !/(^|[^\w])i([^\w]|$)/.test(s.toString()));
      }
      if (sols.length) {
        const parts = sols.map((s) => {
          const str = s.toString();
          const n = Number(s.evaluate().text("decimals"));
          if (ugly(str)) return `${v} \\approx ${dk(fmtNum(n, opts.cifre))}`;
          let t = `${v} = ${ndTex(s)}`;
          if (!/^-?\d+(\/\d+)?$/.test(str) && Number.isFinite(n)) t += ` \\approx ${dk(fmtNum(n, opts.cifre))}`;
          return t;
        });
        return { tex: lhs + " \\;\\Leftrightarrow\\; " + parts.join(" \\;\\lor\\; ") };
      }
    } catch {}
  }

  // Numerisk løsning
  const i = eqs[0].indexOf("=");
  const exprStr = i < 0 ? eqs[0] : `(${eqs[0].slice(0, i)})-(${eqs[0].slice(i + 1)})`;
  const code = window.math.compile(toMathjs(exprStr, opts));
  const f = (x) => {
    try {
      const r = code.evaluate({ ...scope, [v]: x });
      return typeof r === "number" ? r : r && r.isUnit ? r.value : NaN;
    } catch {
      return NaN;
    }
  };
  const [lo, hi] = trig ? [0, 360] : [-1000, 1000];
  let roots = numericSolve(f, lo, hi);
  if (!trig && !roots.length) roots = numericSolve(f, -1e6, 1e6);
  if (!roots.length) return { tex: lhs + " \\;\\Leftrightarrow\\; \\text{ingen løsning fundet}" };
  const note = trig ? " \\quad (0 \\le " + v + " \\le 360)" : "";
  return { tex: lhs + " \\;\\Leftrightarrow\\; " + roots.map((r) => (Math.abs(r - Math.round(r)) < 1e-9 ? `${v} = ${Math.round(r)}` : `${v} \\approx ${dk(fmtNum(r, opts.cifre))}`)).join(" \\;\\lor\\; ") + note };
}

function fmtNum(n, digits) {
  return String(Number(n.toPrecision(digits)));
}

// ─── Blokken ────────────────────────────────────────────────────────────


// ─── Infinitesimalregning (altid i radianer) ────────────────────────────

const V = "[a-zA-Zα-ωΑ-Ω]";
const RE_INT = new RegExp(`^∫\\s*(?:_\\s*(\\([^()]*\\)|[^\\s^_]+)\\s*\\^\\s*(\\([^()]*\\)|\\S+?)\\s+)?(.+?)\\s*d(${V})$`, "u");
const RE_DIFF = new RegExp(`^d(?:\\^(\\d)|([²³]))?\\/d(${V})(?:\\^\\d|[²³])?\\s*(.+)$`, "u");
const RE_PRIME = new RegExp(`^(${V}\\w*)('+)\\((.+)\\)$`, "u");
const RE_LIM = new RegExp(`^lim\\s*_?\\s*\\(?\\s*(${V})\\s*(?:→|->)\\s*([^)\\s]+)\\s*\\)?\\s*(.+)$`, "u");
const RE_SUM = new RegExp(`^(∑|∏)\\s*_\\s*\\(?\\s*(${V})\\s*=\\s*([^)^]+?)\\s*\\)?\\s*\\^\\s*(\\([^()]*\\)|\\S+?)\\s+(.+)$`, "u");

function strip(s) {
  s = s.trim();
  if (!s.startsWith("(") || !s.endsWith(")")) return s;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    if (depth === 0 && i < s.length - 1) return s;
  }
  return s.slice(1, -1).trim();
}

function boundTex(b, opts) {
  if (/^-?∞$|^-?Infinity$/.test(b)) return (b.startsWith("-") ? "-" : "") + "\\infty";
  return exprToTex(b, opts);
}

function simpson(f, a, b, n = 2000) {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

function resultTex(mode, exactExpr, numeric, cifre, suffix = "") {
  let n = numeric;
  if (exactExpr && !Number.isFinite(n)) {
    try {
      n = Number(exactExpr.evaluate().text("decimals"));
    } catch {}
  }
  const approx = Number.isFinite(n) ? dk(fmtNum(n, cifre)) : null;
  if (mode !== "≈" && exactExpr) {
    const str = exactExpr.toString();
    if (!ugly(str) && !/integrate|defint|limit|erf|diff|sum\(|product/.test(str)) {
      let t = " = " + ndTex(exactExpr) + suffix;
      if (approx && !/^-?\d+$/.test(str)) t += " \\approx " + approx;
      return t;
    }
  }
  if (approx) return (Math.abs(n - Math.round(n)) < 1e-12 && mode !== "≈" ? " = " + Math.round(n) : " \\approx " + approx) + suffix;
  throw new Error("Kunne ikke beregne udtrykket");
}

function calculus(expr, scope, opts, mode) {
  const ro = { ...opts, grader: false };
  const nd = window.nerdamer;
  const known = knownValues(scope);
  const N = (s) => (nd ? nd(toNerdamer(s, ro), known).toString() : toNerdamer(s, ro));
  const tx = (s) => exprToTex(s, opts);
  const num = (s) => {
    const v = window.math.evaluate(toMathjs(s, ro), scope);
    return typeof v === "number" ? v : Number(v);
  };
  const fn = (body, v) => {
    const c = window.math.compile(toMathjs(body, ro));
    return (x) => {
      try {
        const r = c.evaluate({ ...scope, [v]: x });
        return typeof r === "number" ? r : NaN;
      } catch {
        return NaN;
      }
    };
  };
  const tryNd = (s) => {
    if (!nd) return null;
    try {
      return nd(s);
    } catch {
      return null;
    }
  };

  // Integral
  let m = expr.match(RE_INT);
  if (m) {
    const [, a, b, f, v] = m;
    if (a == null) {
      const lhs = `\\int ${tx(f)}\\,d${v}`;
      if (!mode) return lhs;
      const F = tryNd(`integrate(${N(f)}, ${v})`);
      if (!F || /integrate/.test(F.toString())) throw new Error("Kunne ikke finde en stamfunktion");
      return lhs + " = " + ndTex(F) + " + k";
    }
    const A = strip(a);
    const B = strip(b);
    const lhs = `\\int_{${boundTex(A, opts)}}^{${boundTex(B, opts)}} ${tx(f)}\\,d${v}`;
    if (!mode) return lhs;
    let exactRes = null;
    const F = tryNd(`integrate(${N(f)}, ${v})`);
    if (F && !/integrate|erf/.test(F.toString()) && !/∞|Infinity/.test(A + B)) {
      const Fs = F.toString();
      exactRes = tryNd(`simplify((${nd(Fs, { [v]: N(B) }).toString()})-(${nd(Fs, { [v]: N(A) }).toString()}))`);
    }
    let numeric = NaN;
    if (!/∞|Infinity/.test(A + B)) numeric = simpson(fn(f, v), num(A), num(B));
    return lhs + resultTex(mode, exactRes, numeric, opts.cifre);
  }

  // d/dx (…)
  m = expr.match(RE_DIFF);
  if (m) {
    const n = +(m[1] || { "²": 2, "³": 3 }[m[2]] || 1);
    const v = m[3];
    const g = strip(m[4]);
    const lhs = n === 1 ? `\\frac{d}{d${v}}\\left(${tx(g)}\\right)` : `\\frac{d^{${n}}}{d${v}^{${n}}}\\left(${tx(g)}\\right)`;
    if (!mode) return lhs;
    const D = tryNd(`diff(${N(g)}, ${v}, ${n})`);
    if (!D) throw new Error("Kunne ikke differentiere");
    return lhs + resultTex(mode, D, NaN, opts.cifre);
  }

  // f'(x), f''(2)
  m = expr.match(RE_PRIME);
  if (m && opts.fns[m[1]]) {
    const { params, body } = opts.fns[m[1]];
    const n = m[2].length;
    const p = params[0];
    const arg = m[3].trim();
    const lhs = `${m[1]}${"'".repeat(n)}\\left(${tx(arg)}\\right)`;
    if (!mode) return lhs;
    const D = tryNd(`diff(${N(body)}, ${p}, ${n})`);
    if (!D) throw new Error("Kunne ikke differentiere");
    const res = arg === p ? D : tryNd(`simplify(${nd(D.toString(), { [p]: N(arg) }).toString()})`);
    return lhs + resultTex(mode, res, NaN, opts.cifre);
  }

  // Grænseværdi
  m = expr.match(RE_LIM);
  if (m) {
    const [, v, to, gRaw] = m;
    const g = strip(gRaw);
    const lhs = `\\lim_{${v}\\to ${boundTex(to, opts)}} ${tx(g)}`;
    if (!mode) return lhs;
    const L = tryNd(`limit(${N(g)}, ${v}, ${toNerdamer(to, ro)})`);
    let numeric = NaN;
    if (!/∞|Infinity/.test(to)) {
      const f = fn(g, v);
      const t = num(to);
      numeric = (f(t - 1e-7) + f(t + 1e-7)) / 2;
    }
    return lhs + resultTex(mode, L && !/limit/.test(L.toString()) ? L : null, numeric, opts.cifre);
  }

  // Sum og produkt
  m = expr.match(RE_SUM);
  if (m) {
    const [, op, v, a, b, g] = m;
    const B = strip(b);
    const lhs = `\\${op === "∑" ? "sum" : "prod"}_{${v}=${tx(a)}}^{${boundTex(B, opts)}} ${tx(g)}`;
    if (!mode) return lhs;
    const f = fn(g, v);
    const lo = Math.round(num(a));
    const infinite = /∞|Infinity/.test(B);
    const hi = infinite ? lo + 200000 : Math.round(num(B));
    if (hi - lo > 1e6) throw new Error("For mange led");
    let acc = op === "∑" ? 0 : 1;
    for (let k = lo; k <= hi; k++) acc = op === "∑" ? acc + f(k) : acc * f(k);
    if (infinite) return lhs + " \\approx " + dk(fmtNum(acc, opts.cifre));
    let exactRes = null;
    if (!Number.isInteger(acc) && Number.isFinite(acc)) {
      try {
        const fr = window.math.fraction(acc);
        if (fr.d < 100000) exactRes = window.nerdamer(`${fr.s * fr.n}/${fr.d}`);
      } catch {}
    }
    return lhs + resultTex(mode, exactRes, acc, opts.cifre);
  }

  return null;
}

export function wordmatBlock(src, scope) {
  importDegrees();
  const opts = { grader: true, cifre: 6, scope, fns: {} };
  const box = el("div", "calc wordmat");
  const head = el("div", "block-head");
  const label = el("span", "block-label", "WordMat");
  const mode = el("span", "wm-mode");
  head.append(label, mode);
  box.append(head);
  const rows = el("div", "calc-rows");
  box.append(rows);

  const addRow = (texStr, cls = "") => {
    const row = el("div", "wm-row " + cls);
    row.innerHTML = tex(texStr, false);
    rows.append(row);
    return row;
  };
  const addError = (line, msg) => {
    const row = el("div", "wm-row");
    row.innerHTML = tex(statementToTex(line.replace(/[=≈]\s*$/, ""), opts));
    row.append(el("div", "calc-note err", msg));
    rows.append(row);
  };

  for (const raw of src.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    try {
      if (line.startsWith("#") || line.startsWith("//")) {
        rows.append(el("div", "calc-comment", line.replace(/^(#|\/\/)\s?/, "")));
        continue;
      }
      if (/^(grader|radianer)$/i.test(line)) {
        opts.grader = /^grader$/i.test(line);
        continue;
      }
      const cifre = line.match(/^cifre\s*:?\s*(\d+)$/i);
      if (cifre) {
        opts.cifre = Math.min(15, Math.max(1, +cifre[1]));
        continue;
      }

      // Definer: a=2; b=3,5
      const def = line.match(/^def(?:iner)?\s*:\s*(.+)$/i);
      if (def || /:=/.test(line)) {
        const body = def ? def[1] : line;
        const items = splitTop(body.replace(/(\d),(\d)/g, "$1.$2"), ";");
        const shown = [];
        for (const item of items) {
          const [name, ...rest] = item.split(/:=|=/);
          const rhs = rest.join("=");
          window.math.evaluate(`${normalize(name)} = ${toMathjs(rhs, opts)}`, scope);
          const fn = name.match(/^\s*(\w+)\s*\(([^)]*)\)\s*$/);
          if (fn) opts.fns[fn[1]] = { params: fn[2].split(",").map((p) => p.trim()), body: rhs };
          if (fn && window.nerdamer) {
            try {
              window.nerdamer.setFunction(fn[1], fn[2].split(",").map((s) => s.trim()), toNerdamer(rhs, opts));
            } catch {}
          }
          shown.push(exprToTex(name, opts) + " = " + exprToTex(rhs, opts));
        }
        addRow("\\textbf{Definer:}\\; " + shown.join(",\\; "), "wm-def");
        continue;
      }

      // Løs: ligning
      const sol = line.match(/^løs\s*:\s*(.+)$/i) || line.match(/^løs\((.+)\)$/i);
      if (sol) {
        const r = solve(sol[1], scope, opts);
        addRow(r.tex, "wm-solve");
        continue;
      }

      // Beregn (=) eller numerisk (≈)
      const calc = line.match(/^(.+?)\s*(=|≈|~=)\s*$/);
      if (calc) {
        const expr = calc[1];
        const approx = calc[2] !== "=";
        const cal = calculus(expr, scope, opts, approx ? "≈" : "=");
        if (cal) {
          addRow(cal);
          continue;
        }
        const lhs = statementToTex(expr, opts);
        if (!approx && !hasUnitsOrDecimals(expr, scope)) {
          const ex = exact(expr, scope, opts);
          if (ex && ex.isNumber !== false) {
            addRow(lhs + " = " + ex.tex + (ex.approx != null ? " \\approx " + dk(fmtNum(ex.approx, opts.cifre)) : ""));
            continue;
          }
          if (ex) {
            addRow(lhs + " = " + ex.tex);
            continue;
          }
        }
        const v = window.math.evaluate(toMathjs(expr, opts), scope);
        addRow(lhs + (approx ? " \\approx " : " = ") + numericTex(v, opts.cifre));
        continue;
      }

      // Kun visning
      addRow(calculus(line, scope, opts, null) || statementToTex(line, opts));
    } catch (e) {
      addError(line, e.message);
    }
  }
  mode.textContent = opts.grader ? "grader" : "radianer";
  return box;
}

// MathLive giver ASCII-math; gør det til WordMat-syntaks
const GREEK = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ",
  vartheta: "ϑ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", rho: "ρ", sigma: "σ", tau: "τ",
  upsilon: "υ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω", Gamma: "Γ", Delta: "Δ", Theta: "Θ",
  Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};

export function asciiToWordmat(a) {
  return a
    .replace(/\s*\bint\s*/g, "∫")
    .replace(/\s*\bsum\s*/g, "∑")
    .replace(/\s*\bprod\s*/g, "∏")
    .replace(/\blim\s*_/g, "lim_")
    .replace(/->/g, "→")
    .replace(/\boo\b/g, "∞")
    .replace(/\(d\)\/\(d([a-z])\)/g, "d/d$1 ")
    .replace(/(∫|∑|∏)_(\([^)]*\)|[^\s^]+?)\^(\([^)]*\)|-?\d+(?:[.,]\d+)?|[a-zA-Zπ∞])/g, "$1_$2^$3 ")
    .replace(/\b(alpha|beta|gamma|delta|varepsilon|epsilon|zeta|eta|vartheta|theta|iota|kappa|lambda|mu|nu|xi|rho|sigma|tau|upsilon|varphi|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega)\b/g, (g) => GREEK[g])
    .replace(/\broot\(([^()]*)\)\(([^()]*)\)/g, "nthRoot($2;$1)")
    .replace(/\b(sin|cos|tan|arcsin|arccos|arctan|ln|log|sqrt|exp)\s+\(/g, "$1(")
    .replace(/\bsqrt\(/g, "√(")
    .replace(/\bpi\b|\bpi(?=[a-zA-Z])/g, "π")
    .replace(/\*/g, "·")
    .replace(/\(([\w.,π]+)\)\/\(([\w.,π]+)\)/g, "$1/$2")
    .trim();
}
