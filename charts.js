/* Graphiques dessinés sur canvas (aucune dépendance externe). */
(function (root) {
'use strict';
const COL = { grid: '#e3e8ef', axis: '#7b8794', text: '#52606d', pos: '#1f9d63', neg: '#d64545', line: '#2f6fed', fill: 'rgba(47,111,237,.12)', alt: '#f5a524' };
function setup(cv) {
  const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const w = Math.max(120, r.width), h = Math.max(100, r.height);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  g.font = '11px "Segoe UI", system-ui, sans-serif'; return { g, w, h };
}
const nice = (min, max) => {
  if (min === max) { max = min + 1; }
  const span = max - min, step0 = Math.pow(10, Math.floor(Math.log10(span / 4))), err = span / 4 / step0;
  const step = step0 * (err >= 5 ? 10 : err >= 2 ? 5 : err >= 1 ? 2 : 1);
  return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step, step };
};
function short(v) { const a = Math.abs(v); return (a >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : a >= 1e4 ? (v / 1e3).toFixed(0) + 'k' : a >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : (+v.toFixed(a < 10 ? 2 : 0)) + ''); }
function frame(cv, vals, fmt, opt) {
  const { g, w, h } = setup(cv); const o = opt || {};
  const lo = Math.min(...vals, o.zero ? 0 : Infinity), hi = Math.max(...vals, o.zero ? 0 : -Infinity);
  const sc = nice(isFinite(lo) ? lo : 0, isFinite(hi) ? hi : 1);
  const L = 46, R = 10, T = 10, B = o.bottom || 24, pw = w - L - R, ph = h - T - B;
  const y = v => T + ph - (v - sc.min) / (sc.max - sc.min) * ph;
  g.strokeStyle = COL.grid; g.fillStyle = COL.axis; g.textAlign = 'right'; g.lineWidth = 1;
  for (let v = sc.min; v <= sc.max + 1e-9; v += sc.step) { const yy = Math.round(y(v)) + .5; g.beginPath(); g.moveTo(L, yy); g.lineTo(w - R, yy); g.stroke(); g.fillText(fmt ? fmt(v) : short(v), L - 6, yy + 4); }
  return { g, w, h, L, R, T, B, pw, ph, y, sc };
}
function empty(cv, msg) { const { g, w, h } = setup(cv); g.fillStyle = COL.axis; g.textAlign = 'center'; g.fillText(msg || '—', w / 2, h / 2); }

function line(cv, vals, o) {
  o = o || {};
  if (!vals.length) return empty(cv, o.empty);
  const f = frame(cv, vals, o.fmt, o), g = f.g, n = vals.length;
  const x = i => f.L + (n === 1 ? f.pw / 2 : i * f.pw / (n - 1));
  g.beginPath(); vals.forEach((v, i) => i ? g.lineTo(x(i), f.y(v)) : g.moveTo(x(i), f.y(v)));
  g.strokeStyle = o.color || COL.line; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();
  g.lineTo(x(n - 1), f.y(f.sc.min)); g.lineTo(x(0), f.y(f.sc.min)); g.closePath(); g.fillStyle = o.fill || COL.fill; g.fill();
  if (n <= 60) { g.fillStyle = o.color || COL.line; vals.forEach((v, i) => { g.beginPath(); g.arc(x(i), f.y(v), 2.5, 0, 7); g.fill(); }); }
  if (o.labels) { g.fillStyle = COL.axis; g.textAlign = 'center'; const st = Math.ceil(n / Math.max(2, Math.floor(f.pw / 48))); o.labels.forEach((t, i) => { if (i % st === 0) g.fillText(t, x(i), f.h - 8); }); }
}
function bars(cv, labels, vals, o) {
  o = o || {};
  if (!vals.length) return empty(cv, o.empty);
  const f = frame(cv, vals, o.fmt, Object.assign({ zero: true }, o)), g = f.g, n = vals.length, bw = f.pw / n;
  const y0 = f.y(0);
  vals.forEach((v, i) => {
    const bx = f.L + i * bw + bw * .15, w = bw * .7, yy = f.y(v);
    g.fillStyle = o.color || (v >= 0 ? COL.pos : COL.neg); g.fillRect(bx, Math.min(yy, y0), w, Math.max(1, Math.abs(yy - y0)));
  });
  g.strokeStyle = COL.axis; g.beginPath(); g.moveTo(f.L, Math.round(y0) + .5); g.lineTo(f.w - f.R, Math.round(y0) + .5); g.stroke();
  g.fillStyle = COL.axis; g.textAlign = 'center';
  const st = Math.ceil(n / Math.max(2, Math.floor(f.pw / 34)));
  labels.forEach((t, i) => { if (i % st === 0) g.fillText(t, f.L + i * bw + bw / 2, f.h - 8); });
}
function stacked(cv, labels, pos, neg, o) {
  o = o || {}; const n = labels.length, tot = pos.map((p, i) => p + neg[i]);
  if (!n || !Math.max(...tot)) return empty(cv, o.empty);
  const f = frame(cv, tot, o.fmt, { zero: true }), g = f.g, bw = f.pw / n;
  labels.forEach((t, i) => {
    const bx = f.L + i * bw + bw * .15, w = bw * .7, y0 = f.y(0), yp = f.y(neg[i] + pos[i]), yn = f.y(neg[i]);
    g.fillStyle = COL.pos; g.fillRect(bx, yp, w, yn - yp); g.fillStyle = COL.neg; g.fillRect(bx, yn, w, y0 - yn);
    g.fillStyle = COL.axis; g.textAlign = 'center'; g.fillText(t, f.L + i * bw + bw / 2, f.h - 8);
  });
}
function histo(cv, bins, labels, o) {
  o = o || {}; const n = bins.length; if (!bins.some(b => b.pos + b.neg)) return empty(cv, o.empty);
  const f = frame(cv, bins.map(b => b.pos + b.neg), v => String(Math.round(v)), { zero: true, bottom: 28 }), g = f.g, bw = f.pw / n;
  bins.forEach((b, i) => { const bx = f.L + i * bw + 1, w = bw - 2, v = b.pos + b.neg, yy = f.y(v);
    g.fillStyle = b.neg ? COL.neg : COL.pos; g.fillRect(bx, yy, w, f.y(0) - yy); });
  g.fillStyle = COL.axis; g.textAlign = 'center';
  [0, 5, 10, 15, 19].forEach(i => g.fillText(labels[i], f.L + i * bw + bw / 2, f.h - 8));
}
function donut(cv, parts, o) {
  o = o || {}; const { g, w, h } = setup(cv), tot = parts.reduce((a, p) => a + p.v, 0);
  if (!tot) return empty(cv, o.empty);
  const r = Math.min(w, h) / 2 - 8, cx = w / 2, cy = h / 2; let a0 = -Math.PI / 2;
  parts.forEach(p => { const a1 = a0 + p.v / tot * Math.PI * 2; g.beginPath(); g.arc(cx, cy, r, a0, a1); g.arc(cx, cy, r * .62, a1, a0, true); g.closePath(); g.fillStyle = p.c; g.fill(); a0 = a1; });
  g.fillStyle = '#1f2933'; g.textAlign = 'center'; g.font = 'bold 18px "Segoe UI", system-ui, sans-serif'; g.fillText(o.center || '', cx, cy + 6);
}
root.Charts = { line, bars, stacked, histo, donut, COL };
})(window);
