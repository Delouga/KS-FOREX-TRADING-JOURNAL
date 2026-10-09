/* Interface du journal de trading — rendu des onglets, formulaires, paramètres. */
(function () {
'use strict';
const C = window.Calc, CH = window.Charts, PAIRS = window.REF.pairs, PSET = new Set(PAIRS.map(p => p.toLowerCase()));
const TITLE = 'KS FOREX TRADING JOURNAL';
const TABS = [['dashboard', 'tab_dashboard'], ['log', 'tab_log'], ['stats', 'tab_stats'], ['monthly', 'tab_monthly'], ['calendar', 'tab_calendar'], ['settings', 'tab_settings']];
let DB, E, LANG = 'fr', TAB = 'dashboard', YEAR = new Date().getFullYear(), DRAW = [], saveTimer = null;
const UI = { showCalc: true, showEval: true, lastN: 50, desc: false, f: { item: '', res: '', setup: '', emo: '', from: '', to: '' } };
const $ = (s, el) => (el || document).querySelector(s), $$ = (s, el) => [...(el || document).querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const t = k => { const e = window.I18N[k]; return e ? e[LANG === 'fr' ? 0 : 1] : k; };
const money = v => C.fmtMoney(v, DB.settings.currency, LANG), pct = (v, d) => C.fmtPct(v, LANG, d), num = (v, d = 2) => C.fmtNum(v, LANG, d);
const cls = v => v > 0 ? 'pos' : v < 0 ? 'neg' : '';
const ratio = v => v ? num(v) + ' : 1' : '0 : 0';
const pf = v => v === Infinity ? '∞' : num(v);
const numStr = v => v == null ? '' : String(v).replace('.', LANG === 'fr' ? ',' : '.');
const mname = (m, f = 'short') => new Intl.DateTimeFormat(LANG === 'fr' ? 'fr-FR' : 'en-US', { month: f }).format(new Date(2023, m, 1));
const wname = (w, f = 'short') => new Intl.DateTimeFormat(LANG === 'fr' ? 'fr-FR' : 'en-US', { weekday: f }).format(new Date(2023, 0, 1 + w));

const mk = (n, d) => ({ name: n, score: d });
const defaults = () => ({ version: 1, nextId: 1, trades: [], settings: { currency: 'USD', leverage: 100, levGold: 1, levStock: 1, riskPct: 0.01, planRRR: 2, rrRange: 0.1,
  entryExit: [['TOO EARLY', -1], ['TOO LATE', -1], ['NOT IN PLAN', -1], ['AS PLANNED', 1], ['BROKE RULES', -1]].map(a => mk(...a)),
  emotions: [['FEAR', -1], ['HOPE', -1], ['GREED', -1], ['BORED', -1], ['IMPULSE', -2], ['FOMO', -1], ['CONFIDENT', 1], ['HYPED', -1]].map(a => mk(...a)),
  setups: ['NO SETUP', 'Momentum', 'Bounce', 'Trend Follow', 'Swing Trade', 'Bottom fishing', 'My Setup 1', 'My Setup 2', 'My Setup 3', 'My Setup 4', 'My Setup 5'].map(n => ({ name: n, def: '' })) } });

function recalc() { E = C.enrich(DB.trades, DB.settings, PSET); }
function commit() { recalc(); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 300); render(); }
function flush() { clearTimeout(saveTimer); saveTimer = null; return window.api.save(DB); }
function toast(msg) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 3200); }

/* ---------- briques HTML ---------- */
const card = (title, body, c = '') => `<section class="card ${c}"><h3>${title}</h3>${body}</section>`;
const kv = rows => `<table class="kv">${rows.map(r => `<tr><td>${t(r[0])}</td><td class="n ${r[2] || ''}">${r[1]}</td></tr>`).join('')}</table>`;
const tbl = (head, rows, c = '') => `<div class="scroll"><table class="grid ${c}"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const kpi = (k, v, c = '') => `<div class="kpi"><span>${t(k)}</span><b class="${c}">${v}</b></div>`;
const canvas = (id, h = 220) => `<canvas id="${id}" style="height:${h}px"></canvas>`;
const sel = (name, list, val, blank = true) => `<select name="${name}">${blank ? '<option value=""></option>' : ''}${list.map(o => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;

/* ---------- Tableau de bord ---------- */
function viewDashboard() {
  const tr = E.trades, all = C.stats(tr), lastN = Math.max(1, parseInt(UI.lastN) || 50), last20 = C.stats(tr.slice(-20));
  const cap = C.sum(E.closed.filter(r => r.type === 'in').map(r => r.net)), wd = -C.sum(E.closed.filter(r => r.type === 'out').map(r => r.net)), end = cap + all.net - wd;
  const L = C.stats(tr.filter(r => r.type === 'buy')), Sh = C.stats(tr.filter(r => r.type === 'sell'));
  const now = new Date(), refM = YEAR === now.getFullYear() ? now.getMonth() : 11, P = (y, a, b) => C.periodNet(E, new Date(y, a, 1), new Date(y, b + 1, 1));
  const periods = [['p_month', P(YEAR, refM, refM)], ['p_q1', P(YEAR, 0, 2)], ['p_q2', P(YEAR, 3, 5)], ['p_q3', P(YEAR, 6, 8)], ['p_q4', P(YEAR, 9, 11)], ['p_ytd', P(YEAR, 0, refM)], ['p_prev', P(YEAR - 1, 0, refM)]];
  const dd = C.drawdown(tr, cap), S = DB.settings;
  const row = (k, a, b) => `<tr><td>${t(k)}</td><td class="n">${a}</td><td class="n">${b}</td></tr>`;
  const stat = s => [['st_winrate', pct(s.winRate)], ['st_largest_profit', money(s.largestProfit)], ['st_largest_loss', money(s.largestLoss)], ['st_largest_win_pct', pct(s.largestWinPct)], ['st_largest_loss_pct', pct(s.largestLossPct)],
    ['st_avg_win_pct', pct(s.avgWinPct)], ['st_avg_loss_pct', pct(s.avgLossPct)], ['st_rrr', num(s.rrr)], ['st_avg_profit', money(s.avgWin)], ['st_avg_loss', money(s.avgLoss)], ['st_edge', ratio(s.rrr)], ['st_pf', pf(s.profitFactor)], ['st_expect', money(s.expectancy)]];
  const A = stat(all), B = stat(last20);
  const evalN = tr.filter(r => r.evalScore != null), score = evalN.length ? evalN[evalN.length - 1].evalCum : 0;
  const cnt = (list, key) => list.map(o => `<tr><td>${esc(o.name)}</td><td class="n">${tr.filter(r => r[key] === o.name).length}</td><td class="n ${cls(+o.score)}">${o.score}</td></tr>`).join('');
  const items = C.byItem(tr), top = items.slice(0, 3), bot = items.length > 3 ? items.slice(-3).reverse() : [];
  const ib = a => a.map(x => `<tr><td>${esc(x.item)}</td><td class="n ${cls(x.s.net)}">${money(x.s.net)}</td></tr>`).join('') || `<tr><td colspan="2" class="muted">${t('no_data')}</td></tr>`;
  const curve = E.closed.filter(r => !r.isTransfer).slice(-lastN);
  DRAW.push(() => CH.line($('#c-perf'), curve.map(r => r.balAfter), { fmt: v => num(v, 0), empty: t('no_data') }));
  DRAW.push(() => CH.histo($('#c-hist'), C.histogram(tr), Array.from({ length: 20 }, (_, i) => Math.round((i * 2 - 20)) + '%'), { empty: t('no_data') }));
  DRAW.push(() => CH.donut($('#c-donut'), [{ v: all.wins, c: CH.COL.pos }, { v: all.losses, c: CH.COL.neg }], { center: all.n ? pct(all.winRate, 0) : '', empty: t('no_data') }));
  DRAW.push(() => CH.line($('#c-eval'), evalN.map(r => r.evalCum), { color: CH.COL.alt, fill: 'rgba(245,165,36,.12)', fmt: v => num(v, 0), empty: t('no_data') }));
  return `<div class="kpis">${kpi('k_capital', money(cap))}${kpi('k_net', money(all.net), cls(all.net))}${kpi('k_withdrawals', money(wd))}${kpi('k_end', money(end))}</div>
  <div class="kpis small">${kpi('k_long', money(L.net), cls(L.net))}${kpi('k_short', money(Sh.net), cls(Sh.net))}${kpi('k_total', money(L.net + Sh.net), cls(L.net + Sh.net))}</div>
  <div class="grid2">${card(t('c_curve') + ` <span class="inl">${t('last_n')} <input id="lastN" class="mini" value="${UI.lastN}" inputmode="numeric"></span>`, canvas('c-perf'))}
  ${card(t('c_distribution'), canvas('c-hist'))}</div>
  <div class="grid3">${card(t('c_periods') + ` <small class="muted">${YEAR}</small>`, `<table class="kv">${periods.map(p => `<tr><td>${t(p[0])}</td><td class="n ${cls(p[1].net)}">${money(p[1].net)}</td><td class="n ${cls(p[1].net)}">${pct(p[1].pct)}</td></tr>`).join('')}</table>`)}
  ${card(t('c_winloss'), canvas('c-donut', 180) + `<div class="legend"><i class="pos"></i>${t('wins')} ${all.wins} <i class="neg"></i>${t('losses')} ${all.losses}</div>`)}
  ${card(t('c_dd'), kv([['dd_max', money(dd.maxDD) + ' (' + pct(dd.maxDDPct) + ')', 'neg'], ['dd_cw', all.maxConsecWins], ['dd_cl', all.maxConsecLosses], ['dd_mcp', money(all.maxConsecProfit), 'pos'], ['dd_mcl', money(all.maxConsecLoss), 'neg']]))}</div>
  <div class="grid2">${card(t('c_statistics'), `<table class="kv"><tr><th></th><th class="n">${t('all_trades')}</th><th class="n">${t('last20')}</th></tr>${A.map((a, i) => row(a[0], a[1], B[i][1])).join('')}</table>`)}
  <div class="stack">${card(t('c_money'), kv([['kelly', pct(all.kelly)], ['bet', money(Math.max(0, all.kelly) * end)]]))}
  ${card(t('c_rmul'), kv([['avg_win_r', num(all.avgWinR)], ['avg_loss_r', num(all.avgLossR)], ['r_ratio', num(all.rRatio)]]))}
  ${card(t('c_dur'), `<table class="kv"><tr><th></th><th class="n">${t('wins')}</th><th class="n">${t('losses')}</th><th class="n">${t('all_trades')}</th></tr>
   <tr><td>${t('avg_duration')}</td><td class="n">${C.fmtDur(all.durWin, LANG)}</td><td class="n">${C.fmtDur(all.durLoss, LANG)}</td><td class="n">${C.fmtDur(all.durAll, LANG)}</td></tr>
   <tr><td>${t('avg_alloc')}</td><td class="n">${money(all.allocWin)}</td><td class="n">${money(all.allocLoss)}</td><td class="n">${money(all.allocAll)}</td></tr></table>`)}</div></div>
  <div class="grid3">${card(t('c_eval_curve') + ` <small class="muted">${t('total_score')}: <b>${score}</b></small>`, canvas('c-eval', 190))}
  ${card(t('c_eval'), `<table class="kv"><tr><th>${t('f_ee')}</th><th class="n">#</th><th class="n">${t('score')}</th></tr>${cnt(S.entryExit, 'ee')}<tr><th>${t('f_emo')}</th><th></th><th></th></tr>${cnt(S.emotions, 'emo')}</table>`)}
  ${card(t('c_topbottom'), `<table class="kv"><tr><th colspan="2">${t('top')}</th></tr>${ib(top)}<tr><th colspan="2">${t('bottom')}</th></tr>${ib(bot)}</table>`)}</div>`;
}

/* ---------- Journal des trades ---------- */
function filtered() {
  const f = UI.f, from = f.from ? new Date(f.from + 'T00:00') : null, to = f.to ? new Date(f.to + 'T23:59:59') : null;
  let rows = E.rows.filter(r => (!f.item || r.item === f.item) && (!f.setup || r.setup === f.setup) && (!f.emo || r.emo === f.emo) &&
    (!f.res || (f.res === 'W' ? r.result === 'W' : r.result === 'L')) && (!from || ((r.when || r.open) && (r.when || r.open) >= from)) && (!to || ((r.when || r.open) && (r.when || r.open) <= to)));
  return UI.desc ? rows.slice().reverse() : rows;
}
function viewLog() {
  const S = DB.settings, rows = filtered(), items = [...new Set(E.rows.map(r => r.item).filter(Boolean))].sort();
  const dt = d => d ? C.fmtDT(d) : '';
  const head = ['No.', t('f_open'), t('f_type'), t('f_size'), t('f_item'), t('f_entry'), 'S/L', 'T/P', t('f_close'), t('f_exit'), t('f_fees'), t('f_pl')];
  const hc = [t('f_pips'), t('f_net'), 'P&L %', t('f_duration'), 'R'], he = [t('f_setup'), t('f_ee'), t('f_emo')];
  const th = head.concat(UI.showCalc ? hc : [], UI.showEval ? he : [], ['']);
  const body = rows.map(r => {
    const tt = r.isTransfer, open = !tt && !r.closed;
    const base = [r.no, dt(r.open), t('type_' + r.type) || r.type, tt ? '' : num(r.size, 2), esc(r.item), tt ? '' : num(r.entry, 5), tt ? '' : num(r.sl, 5), tt ? '' : num(r.tp, 5), dt(r.close), tt ? '' : num(r.exit, 5), tt ? '' : num(r.fees), r.pl == null ? '' : money(r.pl)]
      .map((v, i) => `<td class="${i >= 3 && i !== 4 && i !== 8 ? 'n' : ''}">${v === '—' ? '' : v}</td>`);
    const calc = UI.showCalc ? [tt ? '' : num(r.pips, 1), r.closed ? money(r.net) : '', tt ? '' : pct(r.pct), tt ? '' : C.fmtDur(r.durMs, LANG), tt || r.rMul == null ? '' : num(r.rMul)].map((v, i) => `<td class="n ${i === 1 && r.closed ? cls(r.net) : ''}">${v === '—' ? '' : v}</td>`) : [];
    const ev = UI.showEval ? [esc(r.setup), esc(r.ee), esc(r.emo)].map(v => `<td>${v}</td>`) : [];
    return `<tr class="${open ? 'open' : ''} ${tt ? 'xfer' : ''}" data-id="${r.id}" title="${esc((r.reason ? r.reason + ' — ' : '') + r.notes)}">${base.join('')}${calc.join('')}${ev.join('')}<td class="act"><button data-edit="${r.id}" title="${t('edit')}">✎</button><button data-del="${r.id}" title="${t('delete')}">✕</button></td></tr>`;
  });
  return `<div class="toolbar"><button class="btn primary" id="add">＋ ${t('add_trade')}</button>
   <select id="f-item"><option value="">${t('f_item')}: ${t('all')}</option>${items.map(i => `<option ${UI.f.item === i ? 'selected' : ''}>${esc(i)}</option>`).join('')}</select>
   <select id="f-res"><option value="">${t('result')}: ${t('all')}</option><option value="W" ${UI.f.res === 'W' ? 'selected' : ''}>${t('winners')}</option><option value="L" ${UI.f.res === 'L' ? 'selected' : ''}>${t('losers')}</option></select>
   <select id="f-setup"><option value="">${t('f_setup')}: ${t('all')}</option>${S.setups.map(s => `<option ${UI.f.setup === s.name ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
   <select id="f-emo"><option value="">${t('f_emo')}: ${t('all')}</option>${S.emotions.map(s => `<option ${UI.f.emo === s.name ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
   <input type="date" id="f-from" value="${UI.f.from}" title="${t('from')}"><input type="date" id="f-to" value="${UI.f.to}" title="${t('to')}">
   <button class="btn" id="f-reset">${t('reset')}</button>
   <label class="chk"><input type="checkbox" id="t-calc" ${UI.showCalc ? 'checked' : ''}>${t('show_calc')}</label>
   <label class="chk"><input type="checkbox" id="t-eval" ${UI.showEval ? 'checked' : ''}>${t('show_eval')}</label>
   <label class="chk"><input type="checkbox" id="t-desc" ${UI.desc ? 'checked' : ''}>${t('newest_first')}</label></div>
   <p class="muted hint">${rows.length} / ${E.rows.length} — ${t('hint_log')}</p>
   <div class="scroll tall">${body.length ? `<table class="grid log"><thead><tr>${th.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body.join('')}</tbody></table>` : `<p class="empty">${t('empty_log')}</p>`}</div>`;
}
function openForm(id) {
  const S = DB.settings, r = id ? DB.trades.find(x => x.id === id) : { type: 'buy', open: C.fmtDT(new Date()).replace(' ', 'T') };
  const f = (k, label, kind = 'text', extra = '') => `<label class="fld ${extra}"><span>${label}</span>${kind === 'dt' ? `<input type="datetime-local" name="${k}" value="${esc(r[k] || '')}">` : kind === 'num' ? `<input name="${k}" inputmode="decimal" value="${esc(numStr(C.toNum(r[k])))}">` : `<input name="${k}" value="${esc(r[k] || '')}">`}</label>`;
  const m = $('#modal'); m.className = 'show';
  m.innerHTML = `<div class="dlg"><h2>${id ? t('edit_trade') : t('add_trade')}</h2><form id="tf" class="${r.type === 'in' || r.type === 'out' ? 'xfer' : ''}">
   <div class="fgrid"><label class="fld"><span>${t('f_type')}</span><select name="type">${['buy', 'sell', 'in', 'out'].map(x => `<option value="${x}" ${r.type === x ? 'selected' : ''}>${t('type_' + x)}</option>`).join('')}</select></label>
   ${f('open', t('f_open'), 'dt', 'only-trade')}${f('close', t('f_close'), 'dt')}
   ${f('size', t('f_size'), 'num', 'only-trade')}
   <label class="fld only-trade"><span>${t('f_item')}</span><input name="item" list="pairs" value="${esc(r.item || '')}" autocomplete="off"><datalist id="pairs">${PAIRS.map(p => `<option value="${p}">`).join('')}</datalist></label>
   ${f('entry', t('f_entry'), 'num', 'only-trade')}${f('sl', 'S/L', 'num', 'only-trade')}${f('tp', 'T/P', 'num', 'only-trade')}${f('exit', t('f_exit'), 'num', 'only-trade')}${f('fees', t('f_fees'), 'num', 'only-trade')}
   ${f('pl', t('f_pl') + ' / ' + t('amount'), 'num')}${f('lev', t('f_lev'), 'num', 'only-trade')}${f('pipSize', t('f_pipsize'), 'num', 'only-trade')}
   <label class="fld only-trade"><span>${t('f_setup')}</span>${sel('setup', S.setups.map(s => s.name), r.setup)}</label>
   <label class="fld only-trade"><span>${t('f_ee')}</span>${sel('ee', S.entryExit.map(s => s.name), r.ee)}</label>
   <label class="fld only-trade"><span>${t('f_emo')}</span>${sel('emo', S.emotions.map(s => s.name), r.emo)}</label></div>
   <label class="fld only-trade"><span>${t('f_reason')}</span><textarea name="reason" rows="2">${esc(r.reason || '')}</textarea></label>
   <label class="fld"><span>${t('f_notes')}</span><textarea name="notes" rows="2">${esc(r.notes || '')}</textarea></label>
   <p class="muted">${t('hint_form')}</p><div class="btns"><button type="button" class="btn" id="cancel">${t('cancel')}</button><button class="btn primary">${t('save')}</button></div></form></div>`;
  const form = $('#tf');
  form.type.onchange = () => form.classList.toggle('xfer', form.type.value === 'in' || form.type.value === 'out');
  $('#cancel').onclick = closeForm;
  form.onsubmit = e => {
    e.preventDefault(); const d = new FormData(form), o = {};
    ['type', 'open', 'close', 'item', 'setup', 'ee', 'emo', 'reason', 'notes'].forEach(k => o[k] = (d.get(k) || '').toString().trim());
    ['size', 'entry', 'sl', 'tp', 'exit', 'fees', 'pl', 'lev', 'pipSize'].forEach(k => o[k] = C.toNum(d.get(k), LANG));
    if (id) Object.assign(DB.trades.find(x => x.id === id), o); else DB.trades.push(Object.assign({ id: DB.nextId++ }, o));
    closeForm(); commit();
  };
}
function closeForm() { const m = $('#modal'); m.className = ''; m.innerHTML = ''; }

/* ---------- Statistiques ---------- */
function viewStats() {
  const tr = E.trades, all = C.stats(tr), lg = C.stats(tr.filter(r => r.type === 'buy')), sh = C.stats(tr.filter(r => r.type === 'sell'));
  const items = C.byItem(tr), setups = C.bySetup(tr).slice(0, 6), wd = C.byWeekday(tr);
  const wr = s => `${s.n} (${pct(s.winRate, 1)})`;
  const r6 = (a, b, c) => `<tr><td>${t(a)}</td><td class="n">${b}</td><td class="n">${c[0]}</td><td class="n">${c[1]}</td></tr>`;
  const cell = s => [`<td class="n ${cls(s.net)}">${money(s.net)}</td>`, `<td class="n">${wr(s)}</td>`, `<td class="n">${ratio(s.rrr)}</td>`, `<td class="n">${pf(s.profitFactor)}</td>`, `<td class="n ${cls(s.expectancy)}">${money(s.expectancy)}</td>`].join('');
  const trow = (name, a, b, c) => `<tr><td>${esc(name)}</td>${cell(a)}${cell(b)}${cell(c)}</tr>`;
  DRAW.push(() => CH.stacked($('#c-wd'), wd.map(d => wname(d.w)), wd.map(d => d.win), wd.map(d => -d.loss), { empty: t('no_data'), fmt: v => String(Math.abs(Math.round(v))) }));
  const H = [t('f_net'), t('trades_win'), 'P/Ratio', 'P/Factor', t('st_expect')];
  const top = setups.length ? setups.map(x => `<tr><td>${esc(x.setup)}</td><td class="n ${cls(x.s.net)}">${money(x.s.net)}</td><td class="n">${x.s.n}</td><td class="n">${pct(x.s.winRate, 1)}</td><td class="n">${money(x.s.expectancy)}</td></tr>`) : [`<tr><td colspan="5" class="muted">${t('no_data')}</td></tr>`];
  return `<div class="grid2">${card(t('c_top_setups'), tbl([t('f_setup'), t('f_net'), t('f_trades'), t('st_winrate'), t('st_expect')], top))}
   ${card(t('c_statistics'), `<table class="kv"><tr><th></th><th class="n">${t('total')}</th><th class="n">${t('long')}</th><th class="n">${t('short')}</th></tr>
   ${r6('st_avg_profit', money(all.avgWin), [money(lg.avgWin), money(sh.avgWin)])}${r6('st_avg_loss', money(all.avgLoss), [money(lg.avgLoss), money(sh.avgLoss)])}
   ${r6('st_edge', ratio(all.rrr), [ratio(lg.rrr), ratio(sh.rrr)])}${r6('st_pf', pf(all.profitFactor), [pf(lg.profitFactor), pf(sh.profitFactor)])}${r6('st_expect', money(all.expectancy), [money(lg.expectancy), money(sh.expectancy)])}</table>`)}</div>
   ${card(t('c_by_item'), tbl([t('f_item'), t('all_trades') + ' — ' + H.join(' · '), t('long'), t('short')].slice(0, 1).concat(['', '', '', '', ''].map((_, i) => `${t('all_trades')}: ${H[i]}`), H.map(h => `${t('long')}: ${h}`), H.map(h => `${t('short')}: ${h}`)),
     [`<tr class="total"><td>${t('total')}</td>${cell(all)}${cell(lg)}${cell(sh)}</tr>`].concat(items.map(x => trow(x.item, x.s, C.stats(tr.filter(r => r.item === x.item && r.type === 'buy')), C.stats(tr.filter(r => r.item === x.item && r.type === 'sell'))))), 'wide'))}
   ${card(t('c_weekday'), canvas('c-wd', 220) + `<div class="legend"><i class="pos"></i>${t('wins')} <i class="neg"></i>${t('losses')}</div>`)}`;
}

/* ---------- Rapport mensuel ---------- */
function viewMonthly() {
  const M = C.monthly(E, YEAR), yt = E.trades.filter(r => r.when.getFullYear() === YEAR), ys = C.stats(yt), has = M.filter(m => m.has);
  const cur = M.map(m => m.has ? m.end : null); let last = null; const endLine = M.map(m => { if (m.has) last = m.end; return last; });
  DRAW.push(() => CH.line($('#c-m1'), has.length ? M.filter((m, i) => endLine[i] != null).map((m, i) => endLine[M.indexOf(m)]) : [], { labels: M.filter((m, i) => endLine[i] != null).map(m => mname(m.m)), fmt: v => num(v, 0), empty: t('no_data') }));
  DRAW.push(() => CH.bars($('#c-m2'), M.map(m => mname(m.m)), M.map(m => m.net), { fmt: v => num(v, 0), empty: t('no_data') }));
  DRAW.push(() => CH.bars($('#c-m3'), M.map(m => mname(m.m)), M.map(m => m.n ? m.winRate * 100 : 0), { color: CH.COL.line, fmt: v => Math.round(v) + '%', empty: t('no_data') }));
  const head = ['c_month', 'm_dep', 'm_wd', 'm_beg', 'm_fund', 'm_gp', 'm_gl', 'm_fees', 'm_end', 'm_net', 'm_pct', 'f_trades', 'st_winrate', 'st_avg_win_pct', 'st_avg_loss_pct', 'st_rrr', 'st_edge', 'st_pf', 'm_rnet'].map(k => t(k));
  const line = (name, m, c = '') => `<tr class="${c}"><td>${name}</td><td class="n">${money(m.dep)}</td><td class="n">${money(m.wd)}</td><td class="n">${money(m.beg)}</td><td class="n">${money(m.transfer)}</td><td class="n pos">${money(m.gp)}</td><td class="n neg">${money(m.gl)}</td><td class="n">${money(m.fees)}</td><td class="n">${money(m.end)}</td><td class="n ${cls(m.net)}">${money(m.net)}</td><td class="n ${cls(m.net)}">${pct(m.pct)}</td><td class="n">${m.n}</td><td class="n">${m.n ? pct(m.winRate, 1) : '—'}</td><td class="n">${m.n ? pct(m.avgWinPct) : '—'}</td><td class="n">${m.n ? pct(m.avgLossPct) : '—'}</td><td class="n">${m.n ? num(m.rrr) : '—'}</td><td class="n">${m.n ? ratio(m.rrr) : '—'}</td><td class="n">${m.n ? pf(m.pf) : '—'}</td><td class="n ${cls(m.rNet)}">${m.n ? num(m.rNet) : '—'}</td></tr>`;
  const tot = { dep: C.sum(M.map(m => m.dep)), wd: C.sum(M.map(m => m.wd)), beg: M[0].beg, transfer: C.sum(M.map(m => m.transfer)), gp: C.sum(M.map(m => m.gp)), gl: C.sum(M.map(m => m.gl)), fees: C.sum(M.map(m => m.fees)), end: M[11].end, net: C.sum(M.map(m => m.net)), pct: M[0].beg > 0 ? C.sum(M.map(m => m.net)) / M[0].beg : null, n: ys.n, winRate: ys.winRate, avgWinPct: ys.avgWinPct, avgLossPct: ys.avgLossPct, rrr: ys.rrr, pf: ys.profitFactor, rNet: C.sum(M.map(m => m.rNet)) };
  return card(t('tab_monthly') + ` <small class="muted">${YEAR}</small>`, tbl(head, M.map(m => line(mname(m.m, 'long'), m)).concat(line(t('total'), tot, 'total')), 'wide')) +
    `<div class="grid3">${card(t('c_equity'), canvas('c-m1'))}${card(t('c_monthly_net'), canvas('c-m2'))}${card(t('st_winrate'), canvas('c-m3'))}</div>`;
}

/* ---------- Calendrier ---------- */
function viewCalendar() {
  const map = C.calendar(E, YEAR); let out = '';
  for (let m = 0; m < 12; m++) {
    const first = new Date(YEAR, m, 1).getDay(), days = new Date(YEAR, m + 1, 0).getDate(), cells = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    while (cells.length % 7) cells.push(null);
    let mtot = 0, rows = '';
    for (let w = 0; w < cells.length; w += 7) {
      let wt = 0, wn = 0, tds = '';
      cells.slice(w, w + 7).forEach(d => {
        if (!d) { tds += '<td class="blank"></td>'; return; }
        const e = map[m + '-' + d]; if (e) { wt += e.net; wn += e.n; }
        tds += `<td class="${e ? (e.net >= 0 ? 'win' : 'loss') : ''}"><i>${d}</i>${e ? `<b>${C.fmtNum(e.net, LANG, 0)}</b><small>${e.n}</small>` : ''}</td>`;
      });
      mtot += wt; rows += `<tr>${tds}<td class="wk ${cls(wt)}">${wn ? C.fmtNum(wt, LANG, 0) : ''}</td></tr>`;
    }
    out += `<section class="card cal"><h3>${mname(m, 'long')} <span class="${cls(mtot)}">${mtot ? money(mtot) : ''}</span></h3><table><thead><tr>${[0, 1, 2, 3, 4, 5, 6].map(w => `<th>${wname(w)}</th>`).join('')}<th>Σ</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  }
  return `<div class="calgrid">${out}</div>`;
}

/* ---------- Paramètres ---------- */
function viewSettings() {
  const S = DB.settings, cap = C.sum(E.closed.filter(r => r.type === 'in').map(r => r.net)), end = E.closed.length ? E.closed[E.closed.length - 1].balAfter : 0;
  const fld = (k, label, val, extra = '') => `<label class="fld"><span>${label}</span><input data-set="${k}" value="${esc(val)}" inputmode="decimal" ${extra}></label>`;
  const list = (name, arr, second) => `<div class="lst">${arr.map((o, i) => `<div class="lrow"><input data-list="${name}" data-i="${i}" data-f="name" value="${esc(o.name)}"><input data-list="${name}" data-i="${i}" data-f="${second}" value="${esc(o[second])}" ${second === 'score' ? 'class="sc" inputmode="numeric"' : ''}><button data-rm="${name}:${i}" title="${t('delete')}">✕</button></div>`).join('')}<button class="btn" data-add="${name}">＋ ${t('add')}</button></div>`;
  return `<div class="grid3">${card(t('s_account'), `<label class="fld"><span>${t('s_currency')}</span><select data-set="currency">${C.CURRENCIES.map(c => `<option value="${c[0]}" ${S.currency === c[0] ? 'selected' : ''}>${c[0]} (${c[1]})</option>`).join('')}</select></label>
     ${fld('leverage', t('s_leverage'), numStr(S.leverage))}<label class="fld"><span>${t('s_margin')}</span><input value="${numStr(+(1 / (S.leverage || 1)).toFixed(4))}" disabled></label>${fld('levGold', t('s_lev_gold'), numStr(S.levGold))}${fld('levStock', t('s_lev_stock'), numStr(S.levStock))}`)}
   ${card(t('s_risk'), fld('riskPct', t('s_risk_pct'), numStr(+(S.riskPct * 100).toFixed(4))) + fld('planRRR', t('s_plan_rrr'), numStr(S.planRRR)) + fld('rrRange', t('s_range'), numStr(+(S.rrRange * 100).toFixed(4))) + `<p class="muted">${t('s_var')}: <b>${money(end * S.riskPct)}</b></p>`)}
   ${card(t('s_data'), `<div class="btns col"><button class="btn" data-act="backup">${t('m_backup')}</button><button class="btn" data-act="restore">${t('m_restore')}</button><button class="btn" data-act="exportCsv">${t('m_export')}</button><button class="btn" data-act="importCsv">${t('m_import')}</button><button class="btn danger" data-act="clear">${t('s_clear')}</button></div><p class="muted">${t('s_data_hint')}</p>`)}</div>
   <div class="grid3">${card(t('s_ee'), list('entryExit', S.entryExit, 'score') + `<p class="muted">${t('s_score_hint')}</p>`)}${card(t('s_emo'), list('emotions', S.emotions, 'score'))}${card(t('s_setups'), list('setups', S.setups, 'def'))}</div>`;
}

/* ---------- rendu général ---------- */
function render() {
  if (!DB) return;
  $('#tabs').innerHTML = TABS.map(([k, l]) => `<button data-tab="${k}" class="${TAB === k ? 'on' : ''}">${t(l)}</button>`).join('');
  const years = new Set([new Date().getFullYear(), YEAR]); E.closed.forEach(r => years.add(r.when.getFullYear()));
  $('#year').innerHTML = [...years].sort().map(y => `<option ${y === YEAR ? 'selected' : ''}>${y}</option>`).join('');
  $('#lbl-year').textContent = t('year'); $$('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === LANG));
  document.documentElement.lang = LANG;
  DRAW = []; const v = { dashboard: viewDashboard, log: viewLog, stats: viewStats, monthly: viewMonthly, calendar: viewCalendar, settings: viewSettings }[TAB];
  const keep = $('.scroll.tall') ? [$('.scroll.tall').scrollTop, $('.scroll.tall').scrollLeft] : null;
  $('#view').innerHTML = v(); DRAW.forEach(f => f());
  if (keep && $('.scroll.tall')) { $('.scroll.tall').scrollTop = keep[0]; $('.scroll.tall').scrollLeft = keep[1]; }
}

/* ---------- import / export ---------- */
const CSV_COLS = ['no', 'type', 'open', 'close', 'size', 'item', 'entry', 'sl', 'tp', 'exit', 'fees', 'pl', 'leverage', 'pip_size', 'setup', 'entry_exit', 'emotion', 'reason', 'notes'];
const KEYS = ['', 'type', 'open', 'close', 'size', 'item', 'entry', 'sl', 'tp', 'exit', 'fees', 'pl', 'lev', 'pipSize', 'setup', 'ee', 'emo', 'reason', 'notes'];
function toCsv() {
  const q = v => { v = v == null ? '' : String(v); return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const lines = [CSV_COLS.join(';')];
  DB.trades.forEach((r, i) => lines.push(KEYS.map((k, j) => j === 0 ? i + 1 : q(['size', 'entry', 'sl', 'tp', 'exit', 'fees', 'pl', 'lev', 'pipSize'].includes(k) ? numStr(r[k]) : (k === 'open' || k === 'close') ? String(r[k] || '').replace('T', ' ') : r[k])).join(';')));
  return '\ufeff' + lines.join('\r\n');
}
function parseCsv(text) {
  text = text.replace(/^\ufeff/, ''); const delim = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') inQ = false; else cur += c; }
    else if (c === '"') inQ = true; else if (c === delim) { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}
function normDate(s) {
  s = (s || '').trim(); if (!s) return ''; let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T]?(\d{2})?:?(\d{2})?/);
  if (!m) { m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T]?(\d{1,2})?:?(\d{2})?/); if (m) m = [m[0], m[3], m[2].padStart(2, '0'), m[1].padStart(2, '0'), m[4], m[5]]; }
  if (!m) return ''; return `${m[1]}-${m[2]}-${m[3]}T${(m[4] || '00').padStart(2, '0')}:${m[5] || '00'}`;
}
async function importCsv() {
  const text = await window.api.importCsv(); if (!text) return;
  const rows = parseCsv(text); if (rows.length < 2) return toast(t('import_bad'));
  const head = rows[0].map(h => h.trim().toLowerCase()); let n = 0;
  rows.slice(1).forEach(r => {
    const o = { id: DB.nextId }; CSV_COLS.forEach((c, j) => { const idx = head.indexOf(c); if (idx < 0 || !KEYS[j]) return; const v = (r[idx] || '').trim(), k = KEYS[j];
      o[k] = ['size', 'entry', 'sl', 'tp', 'exit', 'fees', 'pl', 'lev', 'pipSize'].includes(k) ? C.toNum(v, LANG) : (k === 'open' || k === 'close') ? normDate(v) : v; });
    o.type = String(o.type || '').toLowerCase(); if (!['buy', 'sell', 'in', 'out'].includes(o.type)) return;
    DB.trades.push(o); DB.nextId++; n++;
  });
  commit(); toast(t('import_ok').replace('{n}', n));
}
async function action(a) {
  if (a === 'backup') { if (await window.api.backup(DB)) toast(t('saved')); }
  else if (a === 'restore') { const d = await window.api.restore(); if (d && Array.isArray(d.trades) && d.settings) { DB = Object.assign(defaults(), d); DB.settings = Object.assign(defaults().settings, d.settings); commit(); toast(t('restored')); } else if (d) toast(t('import_bad')); }
  else if (a === 'exportCsv') { if (await window.api.exportCsv(toCsv(), 'ftj-trades.csv')) toast(t('saved')); }
  else if (a === 'importCsv') importCsv();
  else if (a === 'clear') { if (confirm(t('confirm_clear')) && confirm(t('confirm_clear2'))) { const s = DB.settings; DB = defaults(); DB.settings = s; commit(); } }
}
async function setLang(l) { LANG = l; await window.api.setLang(l); applyStatic(); render(); }
function applyStatic() { document.title = TITLE; $('#brand-title').textContent = TITLE; $('#brand-sub').textContent = t('subtitle'); }

/* ---------- événements ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('button,td'); if (!b) return;
  if (b.dataset.tab) { TAB = b.dataset.tab; render(); window.scrollTo(0, 0); }
  else if (b.dataset.lang) setLang(b.dataset.lang);
  else if (b.id === 'add') openForm();
  else if (b.dataset.edit) openForm(+b.dataset.edit);
  else if (b.dataset.del) { if (confirm(t('confirm_delete'))) { DB.trades = DB.trades.filter(x => x.id !== +b.dataset.del); commit(); } }
  else if (b.id === 'f-reset') { UI.f = { item: '', res: '', setup: '', emo: '', from: '', to: '' }; render(); }
  else if (b.dataset.act) action(b.dataset.act);
  else if (b.dataset.add) { const n = b.dataset.add; DB.settings[n].push(n === 'setups' ? { name: '', def: '' } : { name: '', score: 0 }); commit(); }
  else if (b.dataset.rm) { const [n, i] = b.dataset.rm.split(':'); DB.settings[n].splice(+i, 1); commit(); }
  else if (e.target.id === 'modal') closeForm();
});
document.addEventListener('dblclick', e => { const tr = e.target.closest('tr[data-id]'); if (tr) openForm(+tr.dataset.id); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeForm(); });
document.addEventListener('change', e => {
  const el = e.target, id = el.id;
  if (id === 'year') { YEAR = +el.value; render(); }
  else if (id === 'lastN') { UI.lastN = parseInt(el.value) || 50; render(); }
  else if (id.startsWith('f-')) { UI.f[id.slice(2)] = el.value; render(); }
  else if (id === 't-calc') { UI.showCalc = el.checked; render(); }
  else if (id === 't-eval') { UI.showEval = el.checked; render(); }
  else if (id === 't-desc') { UI.desc = el.checked; render(); }
  else if (el.dataset.set) {
    const k = el.dataset.set; let v = el.value;
    if (k === 'currency') DB.settings[k] = v;
    else { v = C.toNum(v, LANG); if (v === null) return render(); DB.settings[k] = (k === 'riskPct' || k === 'rrRange') ? v / 100 : v; }
    commit();
  } else if (el.dataset.list) {
    const o = DB.settings[el.dataset.list][+el.dataset.i], f = el.dataset.f; const old = o.name;
    o[f] = f === 'score' ? (C.toNum(el.value, LANG) || 0) : el.value;
    if (f === 'name' && old !== o.name) { const key = { entryExit: 'ee', emotions: 'emo', setups: 'setup' }[el.dataset.list]; DB.trades.forEach(r => { if (r[key] === old) r[key] = o.name; }); }
    commit();
  }
});
let rz; window.addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => DRAW.forEach(f => f())); });
window.addEventListener('beforeunload', () => { if (saveTimer) flush(); });

/* ---------- démarrage ---------- */
(async function init() {
  LANG = (await window.api.getLang()) || 'fr';
  const d = await window.api.load();
  DB = d && Array.isArray(d.trades) ? Object.assign(defaults(), d) : defaults();
  DB.settings = Object.assign(defaults().settings, DB.settings || {});
  window.api.onMenu(a => { if (a === 'lang:fr') setLang('fr'); else if (a === 'lang:en') setLang('en'); else action(a); });
  recalc(); applyStatic(); render();
})();
})();
