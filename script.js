const exprEl = document.getElementById('expr');
const resultEl = document.getElementById('result');
const modeEl = document.getElementById('mode');
const memEl = document.getElementById('memInd');
const historyEl = document.getElementById('history');
const panelEl = document.getElementById('panel');
const histListEl = document.getElementById('histList');

let expr = '';
let ans = 0;
let mem = 0;
let hasMem = false;
let degrees = true;
let justEvaluated = false;
let history = [];
const MAX_HISTORY = 50;

// ---------- Save / Load (localStorage) ----------
function saveState() {
  try {
    localStorage.setItem('calcState', JSON.stringify({
      expr, ans, mem, hasMem, degrees, history: historyEl.textContent
    }));
  } catch (e) {}
}
function saveHistory() {
  try { localStorage.setItem('calcHistory', JSON.stringify(history)); } catch (e) {}
}
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('calcState'));
    if (s) {
      expr = s.expr || '';
      ans = s.ans || 0;
      mem = s.mem || 0;
      hasMem = !!s.hasMem;
      degrees = s.degrees !== false;
      historyEl.textContent = s.history || '';
    }
    const h = JSON.parse(localStorage.getItem('calcHistory'));
    if (Array.isArray(h)) history = h;
  } catch (e) {}
  modeEl.textContent = degrees ? 'DEG' : 'RAD';
  memEl.textContent = hasMem ? 'M' : '';
}

// ---------- Theme ----------
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  document.getElementById('themeBtn').textContent = t === 'dark' ? '☀' : '☾';
  try { localStorage.setItem('calcTheme', t); } catch (e) {}
}
function loadTheme() {
  let t = 'light';
  try { t = localStorage.getItem('calcTheme') || 'light'; } catch (e) {}
  setTheme(t);
}

// ---------- Math helpers ----------
const toRad = x => (degrees ? x * Math.PI / 180 : x);
const fromRad = x => (degrees ? x * 180 / Math.PI : x);

const f = {
  sin: x => { const r = Math.sin(toRad(x)); return Math.abs(r) < 1e-12 ? 0 : r; },
  cos: x => { const r = Math.cos(toRad(x)); return Math.abs(r) < 1e-12 ? 0 : r; },
  tan: x => Math.tan(toRad(x)),
  asin: x => fromRad(Math.asin(x)),
  acos: x => fromRad(Math.acos(x)),
  atan: x => fromRad(Math.atan(x)),
  log: Math.log10,
  ln: Math.log,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  fact: n => {
    if (n < 0 || !Number.isInteger(n) || n > 170) throw new Error('Invalid factorial');
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  },
  nCr: (n, r) => {
    if (r > n) throw new Error('Invalid nCr');
    return Math.round(f.fact(n) / (f.fact(r) * f.fact(n - r)));
  },
  nPr: (n, r) => {
    if (r > n) throw new Error('Invalid nPr');
    return Math.round(f.fact(n) / f.fact(n - r));
  }
};

// Bade/chhote numbers ko scientific notation mein dikhao
function fmt(v) {
  if (v !== 0 && (Math.abs(v) >= 1e12 || Math.abs(v) < 1e-9)) {
    return v.toExponential(8).replace(/\.?0+e/, 'e');
  }
  return String(v);
}

// Expression ko calculate karke number wapis karta hai (error par throw)
function compute(src) {
  let js = src
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/\^/g, '**')
    .replace(/π/g, '(Math.PI)')
    .replace(/Ans/g, '(A)')
    .replace(/MR/g, '(Mm)')
    .replace(/\be\b/g, '(Math.E)')
    .replace(/(\d+\.?\d*)%/g, '($1/100)')
    .replace(/(\d+)C(\d+)/g, 'f.nCr($1,$2)')
    .replace(/(\d+)P(\d+)/g, 'f.nPr($1,$2)')
    .replace(/(\d+\.?\d*|\([^()]*\))!/g, 'f.fact($1)')
    .replace(/\b(asin|acos|atan|sin|cos|tan|log|ln|sqrt|cbrt)\(/g, 'f.$1(');

  // khuley brackets khud band kar do
  const open = (js.match(/\(/g) || []).length - (js.match(/\)/g) || []).length;
  if (open > 0) js += ')'.repeat(open);

  // safety check: sirf digits, operators, brackets aur apne functions allowed
  const cleaned = js
    .replace(/f\.[a-zA-Z]+/g, '')
    .replace(/Math\.(PI|E)/g, '1')
    .replace(/\b(A|Mm)\b/g, '1');
  if (!/^[\d+\-*/().\s]*$/.test(cleaned)) throw new Error('Invalid input');

  const value = new Function('f', 'A', 'Mm', 'return ' + js)(f, ans, mem);
  if (!Number.isFinite(value)) throw new Error('Math error');
  return value;
}

// ---------- Display ----------
function showPreview() {
  resultEl.classList.remove('error');
  resultEl.classList.add('preview');
  let t = '';
  if (expr && !/^[\d.]+$/.test(expr)) {
    try { t = fmt(parseFloat(compute(expr).toPrecision(12))); } catch (e) {}
  }
  resultEl.textContent = t;
}

function render() {
  exprEl.textContent = expr || '0';
  exprEl.scrollLeft = exprEl.scrollWidth;
  if (!justEvaluated) showPreview();
  saveState();
}

function renderHistory() {
  histListEl.innerHTML = '';
  if (history.length === 0) {
    const p = document.createElement('div');
    p.className = 'empty';
    p.textContent = 'Abhi koi history nahi hai';
    histListEl.appendChild(p);
    return;
  }
  history.forEach(h => {
    const b = document.createElement('button');
    b.className = 'item';
    b.textContent = h.expr + ' = ' + h.result;
    b.addEventListener('click', () => {
      expr = h.expr;
      justEvaluated = false;
      render();
    });
    histListEl.appendChild(b);
  });
}

// ---------- Input ----------
function insert(v) {
  const isOperator = ['+', '-', '×', '÷', '^', '^2', '!', '%', 'C', 'P', '×10^'].includes(v);
  if (justEvaluated) {
    expr = isOperator ? 'Ans' : '';
    justEvaluated = false;
  }
  expr += v;
  render();
}

function negate() {
  if (justEvaluated) { expr = 'Ans'; justEvaluated = false; }
  if (!expr) return;
  expr = '-(' + expr + ')';
  render();
}

// ---------- Calculate ----------
function evaluate() {
  if (!expr) return;
  try {
    ans = parseFloat(compute(expr).toPrecision(12));
    resultEl.classList.remove('error', 'preview');
    resultEl.textContent = fmt(ans);
    historyEl.textContent = expr + ' =';
    justEvaluated = true;

    history.unshift({ expr: expr, result: fmt(ans) });
    if (history.length > MAX_HISTORY) history.pop();
    saveHistory();
    renderHistory();
    saveState();
  } catch (err) {
    resultEl.classList.remove('preview');
    resultEl.classList.add('error');
    resultEl.textContent = 'Error';
  }
}

// ---------- Memory ----------
function memAdd(sign) {
  try {
    const v = expr ? compute(expr) : ans;
    mem += sign * v;
    hasMem = true;
    memEl.textContent = 'M';
    saveState();
  } catch (e) {
    resultEl.classList.remove('preview');
    resultEl.classList.add('error');
    resultEl.textContent = 'Error';
  }
}
function memClear() {
  mem = 0;
  hasMem = false;
  memEl.textContent = '';
  saveState();
}

// ---------- Clear / Delete / Mode ----------
function clearAll() {
  expr = '';
  justEvaluated = false;
  historyEl.textContent = '';
  render();
}

function backspace() {
  if (justEvaluated) return clearAll();
  expr = expr.replace(/(asin\(|acos\(|atan\(|sin\(|cos\(|tan\(|log\(|ln\(|sqrt\(|cbrt\(|Ans|MR|.)$/, '');
  render();
}

function toggleMode() {
  degrees = !degrees;
  modeEl.textContent = degrees ? 'DEG' : 'RAD';
  render();
}

// ---------- Button events ----------
document.getElementById('keys').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (btn && btn.dataset.v) insert(btn.dataset.v);
});
document.getElementById('eq').addEventListener('click', evaluate);
document.getElementById('ac').addEventListener('click', clearAll);
document.getElementById('del').addEventListener('click', backspace);
document.getElementById('modeBtn').addEventListener('click', toggleMode);
document.getElementById('negBtn').addEventListener('click', negate);
document.getElementById('memP').addEventListener('click', () => memAdd(1));
document.getElementById('memM').addEventListener('click', () => memAdd(-1));
document.getElementById('memC').addEventListener('click', memClear);
document.getElementById('themeBtn').addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});
document.getElementById('histBtn').addEventListener('click', () => {
  panelEl.hidden = !panelEl.hidden;
});
document.getElementById('clearHist').addEventListener('click', () => {
  history = [];
  saveHistory();
  renderHistory();
});

// ---------- Keyboard support ----------
document.addEventListener('keydown', e => {
  const k = e.key;
  if (/^[0-9.()]$/.test(k)) insert(k);
  else if (k === '+' || k === '-') insert(k);
  else if (k === '*') insert('×');
  else if (k === '/') { e.preventDefault(); insert('÷'); }
  else if (k === '^') insert('^');
  else if (k === '!') insert('!');
  else if (k === '%') insert('%');
  else if (k === 'Enter' || k === '=') { e.preventDefault(); evaluate(); }
  else if (k === 'Backspace') backspace();
  else if (k === 'Escape') clearAll();
});

// ---------- Start ----------
loadTheme();
loadState();
render();
renderHistory();