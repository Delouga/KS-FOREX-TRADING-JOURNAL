/* Calculs du journal de trading (reproduit la logique de la feuille TRADE LOG du classeur d'origine). */
(function (root) {
'use strict';
const CURRENCIES = [['USD','$'],['EUR','€'],['CHF','CHF'],['GBP','£'],['CAD','CAD'],['JPY','¥'],['AUD','A$'],['NZD','NZD'],['HKD','HKD'],['NOK','kr'],['SEK','kr'],['DKK','Kr.'],['ZAR','R']];
const symOf = c => (CURRENCIES.find(x => x[0] === c) || [c, c])[1];

function toNum(v, lang) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[\s\u00a0\u202f]/g, '').replace(/[^0-9,.\-+eE]/g, '');
  if (s === '' || s === '-' || s === '+') return null;
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes(',')) {
    if (lang === 'en' && /^[+-]?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}
const pd = s => { if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d; };
const sum = a => a.reduce((x, y) => x + y, 0);
const mean = a => a.length ? sum(a) / a.length : 0;

function enrich(trades, S, pairsSet) {
  const risk = toNum(S.riskPct) || 0.01;
  const fxLev = toNum(S.leverage) || 1;
  const rows = trades.map((t, i) => {
    const type = String(t.type || '').toLowerCase();
    const isT = type === 'in' || type === 'out';
    const open = pd(t.open), close = pd(t.close);
    const r = { id: t.id, no: i + 1, type, isTransfer: isT, open, close, raw: t,
      size: toNum(t.size), item: String(t.item || '').trim(), entry: toNum(t.entry), sl: toNum(t.sl), tp: toNum(t.tp),
      exit: toNum(t.exit), fees: toNum(t.fees) || 0, pl: toNum(t.pl), lev: toNum(t.lev),
      setup: t.setup || '', ee: t.ee || '', emo: t.emo || '', reason: t.reason || '', notes: t.notes || '' };
    if (isT) {
      const a = Math.abs(r.pl || 0);
      r.gross = type === 'in' ? a : -a; r.net = r.gross; r.when = close || open; r.closed = !!r.when;
      return r;
    }
    r.when = close;
    r.closed = !!(close && r.exit !== null);                    // Excel : date de clôture ET prix de sortie renseignés
    const li = r.item.toLowerCase();
    const inList = pairsSet && pairsSet.has(li);
    const pipDiff = (r.entry !== null && r.exit !== null) ? (type === 'buy' ? r.exit - r.entry : r.entry - r.exit) : null;
    let pipSize;
    const given = toNum(t.pipSize);
    if (given !== null && given !== 0) pipSize = given;
    else if (li.slice(-3) === 'jpy') pipSize = 0.01;
    else if (li.length < 6) pipSize = 0.01;
    else if (r.entry !== null && r.entry >= 10 && r.entry < 1000) pipSize = 0.01;
    else if (r.entry !== null && r.entry >= 1000) pipSize = 0.1;
    else pipSize = 0.0001;
    const units = li.slice(-3) === 'jpy' ? 1000 : inList ? 100000 : li.slice(0, 3) === 'xau' ? 100 : 1;
    const AJ = inList ? 1 / fxLev : li.slice(0, 3) === 'xau' ? 1 / (toNum(S.levGold) || 1) : 1 / (toNum(S.levStock) || 1);
    let contract;
    if (r.pl === null) contract = units;
    else contract = (pipDiff !== null && r.size && pipDiff * r.size !== 0) ? r.pl / (pipDiff * r.size) : 0;
    const k = (r.lev && r.lev > 0) ? 1 / r.lev : AJ;
    const amt = p => (r.size !== null && p !== null) ? r.size * p * (contract === 0 ? units : contract) * k : null;
    r.pipDiff = pipDiff; r.pipSize = pipSize; r.units = units; r.contract = contract;
    r.pips = (r.exit === null || pipDiff === null) ? null : (/^[0-9]{2}$/.test(r.item.slice(-2)) ? pipDiff : pipDiff / pipSize);
    r.entryAmt = amt(r.entry); r.exitAmt = amt(r.exit);
    if (r.closed) {
      r.gross = r.pl !== null ? r.pl : (pipDiff !== null && r.size !== null ? pipDiff * r.size * contract : 0);
      r.net = r.gross + r.fees;
      r.pct = r.entryAmt ? r.net / r.entryAmt : null;
      r.result = r.net <= 0 ? 'L' : 'W';
    }
    r.durMs = (open && close) ? close - open : null;
    return r;
  });
  const closed = rows.filter(r => r.closed && r.when).sort((a, b) => a.when - b.when || a.no - b.no);
  let bal = 0, cum = 0, evalCum = 0;
  closed.forEach(r => {
    r.balBefore = bal;
    if (!r.isTransfer) {
      r.rMul = (bal > 0 && risk > 0) ? r.net / (bal * risk) : null;
      const sc = scoreOf(S.entryExit, r.ee), se = scoreOf(S.emotions, r.emo);
      r.evalScore = (r.ee || r.emo) ? sc + se : null;
      if (r.evalScore !== null) evalCum += r.evalScore;
      r.evalCum = evalCum;
      cum += r.net; r.cum = cum;
    }
    bal += r.net; r.balAfter = bal;
  });
  return { rows, closed, trades: closed.filter(r => !r.isTransfer) };
}
const scoreOf = (list, name) => { const e = (list || []).find(x => x.name === name); return e ? (toNum(e.score) || 0) : 0; };

function stats(tr) {
  const n = tr.length, w = tr.filter(r => r.result === 'W'), l = tr.filter(r => r.result === 'L');
  const gp = sum(w.map(r => r.net)), gl = sum(l.map(r => r.net)), net = gp + gl;
  const avgWin = w.length ? gp / w.length : 0, avgLoss = l.length ? gl / l.length : 0;
  const winRate = n ? w.length / n : 0;
  const rrr = avgLoss ? avgWin / Math.abs(avgLoss) : 0;
  const pcts = x => x.map(r => r.pct).filter(v => v !== null && v !== undefined);
  let mw = 0, ml = 0, cw = 0, cl = 0;
  tr.forEach(r => { if (r.result === 'W') { cw++; cl = 0; mw = Math.max(mw, cw); } else { cl++; cw = 0; ml = Math.max(ml, cl); } });
  const kelly = rrr > 0 ? winRate - (1 - winRate) / rrr : 0;
  const rw = w.map(r => r.rMul).filter(v => v != null), rl = l.map(r => r.rMul).filter(v => v != null);
  return { n, wins: w.length, losses: l.length, net, gp, gl, avgWin, avgLoss, winRate, rrr,
    profitFactor: gl ? gp / Math.abs(gl) : (gp > 0 ? Infinity : 0), expectancy: n ? net / n : 0,
    largestProfit: w.length ? Math.max(...w.map(r => r.net)) : 0, largestLoss: l.length ? Math.min(...l.map(r => r.net)) : 0,
    largestWinPct: pcts(w).length ? Math.max(...pcts(w)) : 0, largestLossPct: pcts(l).length ? Math.min(...pcts(l)) : 0,
    avgWinPct: mean(pcts(w)), avgLossPct: mean(pcts(l)), maxConsecWins: mw, maxConsecLosses: ml, curWins: cw, curLosses: cl,
    maxConsecProfit: maxRun(tr, 'W'), maxConsecLoss: maxRun(tr, 'L'), kelly,
    avgWinR: mean(rw), avgLossR: mean(rl), rRatio: mean(rl) ? mean(rw) / Math.abs(mean(rl)) : 0,
    durWin: mean(w.map(r => r.durMs).filter(v => v != null)), durLoss: mean(l.map(r => r.durMs).filter(v => v != null)),
    durAll: mean(tr.map(r => r.durMs).filter(v => v != null)),
    allocWin: mean(w.map(r => r.entryAmt).filter(v => v != null)), allocLoss: mean(l.map(r => r.entryAmt).filter(v => v != null)),
    allocAll: mean(tr.map(r => r.entryAmt).filter(v => v != null)) };
}
function maxRun(tr, res) { let best = 0, cur = 0; tr.forEach(r => { if (r.result === res) { cur += r.net; best = res === 'W' ? Math.max(best, cur) : Math.min(best, cur); } else cur = 0; }); return best; }

function drawdown(trades, capital) {
  let eq = capital || 0, peak = eq, maxDD = 0, maxDDPct = 0;
  trades.forEach(r => { eq += r.net; if (eq > peak) peak = eq; const dd = peak - eq; if (dd > maxDD) { maxDD = dd; maxDDPct = peak > 0 ? dd / peak : 0; } });
  return { maxDD, maxDDPct };
}
const inMonth = (r, y, m) => r.when.getFullYear() === y && r.when.getMonth() === m;
function monthly(E, y) {
  const out = [];
  for (let m = 0; m < 12; m++) {
    const all = E.closed.filter(r => inMonth(r, y, m)), tr = all.filter(r => !r.isTransfer);
    const dep = sum(all.filter(r => r.type === 'in').map(r => r.net)), wd = -sum(all.filter(r => r.type === 'out').map(r => r.net));
    const prior = E.closed.filter(r => r.when < new Date(y, m, 1));
    const beg = prior.length ? prior[prior.length - 1].balAfter : 0;
    const gp = sum(tr.map(r => r.gross).filter(v => v > 0)), gl = sum(tr.map(r => r.gross).filter(v => v < 0)), fees = sum(tr.map(r => r.fees));
    const s = stats(tr), net = gp + gl + fees;
    out.push({ m, dep, wd, beg, transfer: dep - wd, gp, gl, fees, net, end: beg + dep - wd + net, pct: beg > 0 ? net / beg : null,
      n: tr.length, winRate: s.winRate, avgWinPct: s.avgWinPct, avgLossPct: s.avgLossPct, rrr: s.rrr, pf: s.profitFactor, rNet: sum(tr.map(r => r.rMul || 0)), has: all.length > 0 });
  }
  return out;
}
function periodNet(E, from, to) {
  const tr = E.trades.filter(r => r.when >= from && r.when < to);
  const prior = E.closed.filter(r => r.when < from);
  const beg = prior.length ? prior[prior.length - 1].balAfter : 0;
  const net = sum(tr.map(r => r.net));
  return { net, pct: beg > 0 ? net / beg : null, n: tr.length };
}
function byItem(tr) {
  const m = new Map();
  tr.forEach(r => { const k = r.item || '—'; if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
  return [...m.entries()].map(([item, a]) => ({ item, s: stats(a) })).sort((a, b) => b.s.net - a.s.net);
}
function bySetup(tr) {
  const m = new Map();
  tr.forEach(r => { const k = r.setup || ''; if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
  return [...m.entries()].map(([setup, a]) => ({ setup, s: stats(a) })).sort((a, b) => b.s.net - a.s.net);
}
function byWeekday(tr) {
  const d = [1, 2, 3, 4, 5, 6, 0].map(w => ({ w, n: 0, win: 0, loss: 0 }));
  tr.forEach(r => { const e = d.find(x => x.w === r.when.getDay()); e.n++; r.result === 'W' ? e.win++ : e.loss++; });
  return d;
}
function histogram(tr) {
  const edges = []; for (let i = -10; i <= 10; i++) edges.push(i * 0.02);
  const bins = []; for (let i = 0; i < 20; i++) bins.push({ from: edges[i], to: edges[i + 1], neg: 0, pos: 0 });
  tr.forEach(r => { if (r.pct === null || r.pct === undefined) return;
    let i = Math.floor((r.pct + 0.2) / 0.02); i = Math.max(0, Math.min(19, i));
    r.pct < 0 ? bins[i].neg++ : bins[i].pos++; });
  return bins;
}
function calendar(E, y) {
  const map = {};
  E.trades.filter(r => r.when.getFullYear() === y).forEach(r => {
    const k = r.when.getMonth() + '-' + r.when.getDate();
    (map[k] = map[k] || { net: 0, n: 0 }); map[k].net += r.net; map[k].n++;
  });
  return map;
}

/* ---------- formats ---------- */
const locale = l => l === 'fr' ? 'fr-FR' : 'en-US';
function fmtNum(v, lang, d) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return new Intl.NumberFormat(locale(lang), { minimumFractionDigits: d, maximumFractionDigits: d }).format(v).replace(/\u202f/g, '\u00a0');
}
function fmtMoney(v, cur, lang) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  const sym = symOf(cur), neg = v < 0, s = fmtNum(Math.abs(v), lang, 2);
  const body = lang === 'fr' ? s + '\u00a0' + sym : (sym.length > 1 && /^[A-Z]{3}$/.test(sym) ? sym + '\u00a0' + s : sym + s);
  return (neg ? '-' : '') + body;
}
const fmtPct = (v, lang, d = 2) => (v === null || v === undefined || !isFinite(v)) ? '—' : fmtNum(v * 100, lang, d) + (lang === 'fr' ? '\u00a0%' : '%');
function fmtDur(ms, lang) {
  if (ms === null || ms === undefined || !isFinite(ms)) return '—';
  const m = Math.round(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mi = m % 60;
  const u = lang === 'fr' ? ['j', 'h', 'min'] : ['d', 'h', 'm'];
  return `${d}${u[0]} ${h}${u[1]} ${mi}${u[2]}`;
}
const fmtDT = d => { if (!d) return ''; const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

root.Calc = { CURRENCIES, symOf, toNum, pd, enrich, stats, drawdown, monthly, periodNet, byItem, bySetup, byWeekday, histogram, calendar, fmtNum, fmtMoney, fmtPct, fmtDur, fmtDT, sum, mean };
if (typeof module !== 'undefined') module.exports = root.Calc;
})(typeof window !== 'undefined' ? window : globalThis);
