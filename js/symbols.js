// Symboler og \-kommandoer: standardliste, autofuldførelse i editoren og symbolpalet

export const KATEGORIER = [
  "Græske bogstaver",
  "Infinitesimalregning",
  "Operatorer",
  "Relationer",
  "Pile og logik",
  "Mængder",
  "Andet",
];

const g = (kommando, tegn, beskrivelse) => ({ kommando, tegn, latex: "\\" + kommando, kategori: "Græske bogstaver", beskrivelse });
const s = (kategori) => (kommando, tegn, latex, beskrivelse) => ({ kommando, tegn, latex: latex ?? "\\" + kommando, kategori, beskrivelse });
const inf = s("Infinitesimalregning");
const op = s("Operatorer");
const rel = s("Relationer");
const pil = s("Pile og logik");
const mgd = s("Mængder");
const and = s("Andet");

export const STANDARD = [
  g("alpha", "α", "alfa"), g("beta", "β", "beta"), g("gamma", "γ", "gamma"), g("delta", "δ", "delta"),
  g("epsilon", "ε", "epsilon"), g("zeta", "ζ", "zeta"), g("eta", "η", "eta"), g("theta", "θ", "theta – vinkler"),
  g("iota", "ι", "iota"), g("kappa", "κ", "kappa"), g("lambda", "λ", "lambda – bølgelængde"), g("mu", "μ", "my – friktion, mikro"),
  g("nu", "ν", "ny – frekvens"), g("xi", "ξ", "xi"), g("pi", "π", "pi"), g("rho", "ρ", "rho – densitet"),
  g("sigma", "σ", "sigma – spredning"), g("tau", "τ", "tau"), g("upsilon", "υ", "ypsilon"), g("phi", "φ", "phi"),
  g("chi", "χ", "chi – χ²-test"), g("psi", "ψ", "psi"), g("omega", "ω", "omega – vinkelhastighed"),
  g("Gamma", "Γ", "stort gamma"), g("Delta", "Δ", "stort delta – ændring"), g("Theta", "Θ", "stort theta"),
  g("Lambda", "Λ", "stort lambda"), g("Xi", "Ξ", "stort xi"), g("Pi", "Π", "stort pi"), g("Sigma", "Σ", "stort sigma"),
  g("Phi", "Φ", "stort phi"), g("Psi", "Ψ", "stort psi"), g("Omega", "Ω", "stort omega – ohm"),

  inf("int", "∫", null, "integral"),
  inf("dint", "∫_0^1  dx", "\\int_{a}^{b} \\,dx", "bestemt integral (skabelon)"),
  inf("iint", "∬", null, "dobbeltintegral"),
  inf("iiint", "∭", null, "tripelintegral"),
  inf("oint", "∮", null, "kurveintegral"),
  inf("ddx", "d/dx ", "\\frac{d}{dx}", "differentialkvotient (skabelon)"),
  inf("ddx2", "d²/dx² ", "\\frac{d^2}{dx^2}", "anden afledede (skabelon)"),
  inf("lim", "lim_(x→0) ", "\\lim_{x\\to 0}", "grænseværdi (skabelon)"),
  inf("sum", "∑", null, "sum"),
  inf("dsum", "∑_(k=1)^n ", "\\sum_{k=1}^{n}", "sum med grænser (skabelon)"),
  inf("prod", "∏", null, "produkt"),
  inf("partial", "∂", null, "partiel afledet"),
  inf("nabla", "∇", null, "nabla / gradient"),
  inf("infty", "∞", null, "uendelig"),
  inf("prime", "′", "^{\\prime}", "mærke (f′)"),
  inf("dx", "dx", "\\,dx", "dx med lille mellemrum"),

  op("times", "×", null, "gange (kryds)"), op("cdot", "·", null, "gange (prik)"), op("div", "÷", null, "division"),
  op("pm", "±", null, "plus/minus"), op("mp", "∓", null, "minus/plus"), op("sqrt", "√", "\\sqrt{}", "kvadratrod"),
  op("cbrt", "∛", "\\sqrt[3]{}", "kubikrod"), op("circ", "∘", null, "sammensat funktion"), op("ast", "∗", null, "stjerne"),
  op("oplus", "⊕", null, "direkte sum"), op("otimes", "⊗", null, "tensorprodukt"), op("deg", "°", "^{\\circ}", "grader"),

  rel("le", "≤", null, "mindre end eller lig"), rel("ge", "≥", null, "større end eller lig"), rel("ne", "≠", null, "forskellig fra"),
  rel("approx", "≈", null, "cirka lig"), rel("equiv", "≡", null, "identisk / kongruent"), rel("sim", "∼", null, "ligefrem / tilnærmet"),
  rel("propto", "∝", null, "proportional med"), rel("ll", "≪", null, "meget mindre end"), rel("gg", "≫", null, "meget større end"),
  rel("cong", "≅", null, "kongruent"), rel("perp", "⊥", null, "vinkelret"), rel("parallel", "∥", null, "parallel"),
  rel("defeq", "≔", ":=", "defineres som"),

  pil("to", "→", null, "går mod"), pil("rightarrow", "→", null, "pil højre"), pil("leftarrow", "←", null, "pil venstre"),
  pil("Rightarrow", "⇒", null, "medfører"), pil("Leftarrow", "⇐", null, "følger af"), pil("Leftrightarrow", "⇔", null, "ensbetydende"),
  pil("iff", "⇔", null, "hvis og kun hvis"), pil("mapsto", "↦", null, "afbildes til"), pil("uparrow", "↑", null, "pil op"),
  pil("downarrow", "↓", null, "pil ned"), pil("land", "∧", null, "og"), pil("lor", "∨", null, "eller"), pil("neg", "¬", null, "ikke"),
  pil("forall", "∀", null, "for alle"), pil("exists", "∃", null, "der findes"), pil("therefore", "∴", null, "derfor"),

  mgd("in", "∈", null, "tilhører"), mgd("notin", "∉", null, "tilhører ikke"), mgd("subset", "⊂", null, "ægte delmængde"),
  mgd("subseteq", "⊆", null, "delmængde"), mgd("supset", "⊃", null, "overmængde"), mgd("cup", "∪", null, "foreningsmængde"),
  mgd("cap", "∩", null, "fællesmængde"), mgd("emptyset", "∅", null, "tom mængde"), mgd("setminus", "∖", null, "mængdedifferens"),
  mgd("N", "ℕ", "\\mathbb{N}", "naturlige tal"), mgd("Z", "ℤ", "\\mathbb{Z}", "hele tal"), mgd("Q", "ℚ", "\\mathbb{Q}", "rationale tal"),
  mgd("R", "ℝ", "\\mathbb{R}", "reelle tal"), mgd("C", "ℂ", "\\mathbb{C}", "komplekse tal"),

  and("angle", "∠", null, "vinkel"), and("hbar", "ℏ", null, "reduceret Plancks konstant"), and("ell", "ℓ", null, "skrive-l"),
  and("aleph", "ℵ", null, "aleph"), and("dots", "…", "\\dots", "prikker"), and("cdots", "⋯", null, "midterprikker"),
  and("permil", "‰", "‰", "promille"), and("triangle", "△", null, "trekant"), and("square", "□", null, "kvadrat"),
  and("vec", "⃗", "\\vec{}", "vektorpil (sættes efter bogstavet)"),
];

// ─── Indsættelse ────────────────────────────────────────────────────────

export function textFor(entry, ctx) {
  if (ctx === "latex") {
    const l = entry.latex || entry.tegn;
    return /[A-Za-z]$/.test(l) ? l + " " : l;
  }
  return entry.tegn;
}

// "latex" i $…$ / $$…$$, "text" i WordMat/calc/almindelig tekst, null i anden kode
export function mathContext(ta) {
  const before = ta.value.slice(0, ta.selectionStart);
  const fences = [...before.matchAll(/^(```|~~~)\s*([\w-]*)/gm)];
  if (fences.length % 2) {
    const lang = fences[fences.length - 1][2].toLowerCase();
    return ["wordmat", "wm", "calc", "regn", "plot", "graf"].includes(lang) ? "text" : null;
  }
  if (((before.match(/\$\$/g) || []).length) % 2) return "latex";
  const para = before.slice(before.lastIndexOf("\n\n") + 1).replace(/\$\$/g, "");
  if (((para.match(/(?<!\\)\$/g) || []).length) % 2) return "latex";
  return "text";
}

function caretPoint(ta) {
  const cs = getComputedStyle(ta);
  const div = document.createElement("div");
  for (const p of [
    "boxSizing", "width", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "tabSize",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  ]) div.style[p] = cs[p];
  Object.assign(div.style, { position: "absolute", visibility: "hidden", whiteSpace: "pre-wrap", overflowWrap: "break-word", top: "0", left: "-9999px" });
  div.textContent = ta.value.slice(0, ta.selectionStart);
  const span = document.createElement("span");
  span.textContent = "​";
  div.append(span);
  document.body.append(div);
  const r = ta.getBoundingClientRect();
  const lh = parseFloat(cs.lineHeight) || 20;
  const pt = { x: r.left + span.offsetLeft - ta.scrollLeft, y: r.top + span.offsetTop - ta.scrollTop + lh };
  div.remove();
  return pt;
}

function preview(entry) {
  const span = document.createElement("span");
  span.className = "sym-preview";
  try {
    span.innerHTML = window.katex.renderToString(entry.latex || entry.tegn, { throwOnError: false });
  } catch {
    span.textContent = entry.tegn;
  }
  return span;
}

export function symbolPreview(entry) {
  return preview(entry);
}

// ─── Autofuldførelse: skriv \alpha → α ──────────────────────────────────

export function attachAutocomplete(ta, getSymbols) {
  const pop = document.createElement("div");
  pop.className = "ac-pop hidden";
  document.body.append(pop);
  let items = [];
  let sel = 0;
  let token = null;

  const close = () => {
    pop.classList.add("hidden");
    items = [];
    token = null;
  };

  function currentToken() {
    const before = ta.value.slice(0, ta.selectionStart);
    const m = before.match(/\\([A-Za-z][A-Za-z0-9]*|)$/);
    return m ? m[1] : null;
  }

  function accept(entry) {
    const ctx = mathContext(ta);
    const start = ta.selectionStart - token.length - 1;
    ta.setRangeText(textFor(entry, ctx), start, ta.selectionStart, "end");
    close();
    ta.dispatchEvent(new Event("input"));
    ta.focus();
  }

  function draw() {
    pop.innerHTML = "";
    items.forEach((e, i) => {
      const row = document.createElement("div");
      row.className = "ac-item" + (i === sel ? " on" : "");
      const cmd = document.createElement("span");
      cmd.className = "ac-cmd";
      cmd.textContent = "\\" + e.kommando;
      const desc = document.createElement("span");
      desc.className = "ac-desc";
      desc.textContent = e.beskrivelse || "";
      row.append(preview(e), cmd, desc);
      row.onmousedown = (ev) => {
        ev.preventDefault();
        accept(e);
      };
      pop.append(row);
    });
    pop.querySelector(".on")?.scrollIntoView({ block: "nearest" });
  }

  function update() {
    if (!document.body.contains(ta)) {
      pop.remove();
      return;
    }
    token = currentToken();
    if (token == null || mathContext(ta) == null) return close();
    const t = token.toLowerCase();
    const all = getSymbols();
    const starts = all.filter((e) => e.kommando.toLowerCase().startsWith(t));
    const contains = t ? all.filter((e) => !starts.includes(e) && ((e.beskrivelse || "").toLowerCase().includes(t) || e.kommando.toLowerCase().includes(t))) : [];
    items = [...starts.sort((a, b) => (a.kommando === token ? -1 : b.kommando === token ? 1 : a.kommando.length - b.kommando.length)), ...contains].slice(0, 9);
    if (!items.length) return close();
    sel = 0;
    const pt = caretPoint(ta);
    pop.style.left = Math.min(pt.x, innerWidth - 330) + "px";
    pop.style.top = (pt.y + 230 > innerHeight ? pt.y - 250 : pt.y + 4) + "px";
    pop.classList.remove("hidden");
    draw();
  }

  ta.addEventListener("keydown", (e) => {
    // Som i Word: \alpha + mellemrum bliver til α (ikke inde i LaTeX-formler)
    if (e.key === " " && !e.ctrlKey && !e.metaKey) {
      const t = currentToken();
      if (t) {
        const ctx = mathContext(ta);
        const entry = getSymbols().find((s) => s.kommando === t);
        if (entry && ctx === "text") {
          e.preventDefault();
          e.stopImmediatePropagation();
          token = t;
          accept(entry);
          // I almindelig tekst beholdes mellemrummet; i WordMat/beregninger spises det som i Word
          const fences = (ta.value.slice(0, ta.selectionStart).match(/^(```|~~~)/gm) || []).length;
          if (fences % 2 === 0) {
            ta.setRangeText(" ", ta.selectionStart, ta.selectionStart, "end");
            ta.dispatchEvent(new Event("input"));
          }
          return;
        }
      }
    }
    if (pop.classList.contains("hidden")) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopImmediatePropagation();
      sel = (sel + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
      draw();
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      e.stopImmediatePropagation();
      accept(items[sel]);
    } else if (e.key === "Escape") {
      e.stopImmediatePropagation();
      close();
    }
  });
  ta.addEventListener("input", update);
  ta.addEventListener("click", update);
  ta.addEventListener("blur", () => setTimeout(close, 150));
  ta.addEventListener("scroll", close);
  return { close };
}

// ─── Symbolpalet i editoren ─────────────────────────────────────────────

export function symbolPalette(getSymbols, onPick) {
  const box = document.createElement("div");
  box.className = "sym-palette";
  const tabs = document.createElement("div");
  tabs.className = "sym-tabs";
  const grid = document.createElement("div");
  grid.className = "sym-grid";
  box.append(tabs, grid);
  let current = null;

  function draw() {
    const list = getSymbols();
    const cats = [...new Set([...KATEGORIER.filter((k) => list.some((e) => e.kategori === k)), ...list.map((e) => e.kategori)])];
    if (!current || !cats.includes(current)) current = cats[0];
    tabs.innerHTML = "";
    for (const k of cats) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sym-tab" + (k === current ? " on" : "");
      b.textContent = k;
      b.onclick = () => {
        current = k;
        draw();
      };
      tabs.append(b);
    }
    grid.innerHTML = "";
    for (const e of list.filter((x) => x.kategori === current)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sym-btn";
      b.title = `\\${e.kommando}${e.beskrivelse ? " – " + e.beskrivelse : ""}`;
      b.append(preview(e));
      b.onmousedown = (ev) => ev.preventDefault();
      b.onclick = () => onPick(e);
      grid.append(b);
    }
  }
  draw();
  return { el: box, refresh: draw };
}
