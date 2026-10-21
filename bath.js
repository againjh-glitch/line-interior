/**
 * bath.js — 욕실 자재 견적서 → 자재 주문서
 *
 *  · 견적서 줄마다 제품명을 고르면 지난 주문 단가(bath-data.js)가 들어갑니다.
 *  · 세트(BATH_SETS)는 자재 주문서에서 구성품으로 풀어 씁니다.
 *  · 「현장 요청」 탭: 현장에 붙여 둔 종이 「현장 자재 요청서」에 담당자들이 적은 걸 옮겨 적는 곳.
 *    업체 단가표(vendor-data.js) + 욕실 자재에서 골라 단가가 들어가고, 자재 주문서 탭에 업체 견적서 형식으로 나옵니다.
 *  · 저장한 견적과 「내 단가」(새로 넣은 단가)는 이 브라우저(localStorage)에만 저장됩니다.
 */
(function () {
'use strict';

const LS_DRAFT = 'bath-draft-v2', LS_QUOTES = 'bath-quotes-v1', LS_MY = 'bath-my-prices-v1';
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = n => (n === '' || n == null || isNaN(n)) ? '' : Math.round(Number(n)).toLocaleString('ko-KR');
const parseNum = v => { const s = String(v ?? '').replace(/[,\s원]/g, ''); if (s === '') return ''; const n = Number(s); return isNaN(n) ? '' : n; };
const key = s => String(s || '').replace(/[\s\[\]()★=·,]/g, '').toLowerCase();
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
};

/* ───────── 자재 목록 (기본 + 내 단가) ───────── */
let ITEMS = [], BYKEY = new Map();
function buildCatalog() {
  const my = store.get(LS_MY, {});
  ITEMS = BATH_ITEMS.map(x => Object.assign({}, x));
  BYKEY = new Map(ITEMS.map(x => [key(x.n), x]));
  Object.values(my).forEach(m => {
    if (m.req) return;   // 현장 요청에서 배운 단가는 요청 목록에서만
    const k = key(m.n), base = BYKEY.get(k);
    if (base) { base.my = m; }
    else { const it = { n: m.n, c: m.c || '기타', p: m.p, my: m, mine: true }; ITEMS.push(it); BYKEY.set(k, it); }
  });
}
const find = n => BYKEY.get(key(n));
function priceOf(it) {
  if (!it) return '';
  if (it.set || BATH_SETS[it.n]) return setPrice(it.n);
  if (it.my && it.my.p !== '' && it.my.p != null) return it.my.p;
  return it.p ?? '';
}
function setPrice(name) {
  const comps = BATH_SETS[name]; if (!comps) return '';
  let sum = 0;
  for (const [c, q] of comps) { const p = priceOf(find(c)); if (p === '') return ''; sum += p * q; }
  return sum;
}
const isSet = n => !!BATH_SETS[n] || !!BATH_SETS[(find(n) || {}).n];

/* ───────── 상태 ───────── */
const newLine = l => ({ no: l.no, row: l.row, name: l.name, c: l.c, sub: l.sub ? 1 : 0, n: '', spec: '', q: '', p: '', memo: '', st: '' });
const newReq = () => ({ d: '', who: '', place: '', n: '', spec: '', u: '', q: '', p: '', memo: '', v: '' });
const REQ_MIN = 12;
function ensureReq(st) {
  if (!Array.isArray(st.req)) st.req = [];
  while (st.req.length < REQ_MIN) st.req.push(newReq());
  return st;
}
function blankState() {
  return ensureReq({ v: 2, info: { date: today(), shop: '라인 인테리어', tel: '', addr: '', site: '', memo: '' }, lines: BATH_LINES.map(newLine), req: [] });
}
// 예전(종이 양식 이전) 견적을 새 칸에 옮겨 담기
function migrate(old) {
  if (!old) return old;
  if (old.v === 2) return ensureReq(old);
  const st = blankState(); Object.assign(st.info, old.info || {});
  (old.lines || []).filter(l => l.n).forEach(l => {
    const nm = String(l.name || '').replace(/^.*·\s*/, '').replace(/\s/g, '');
    const t = st.lines.find(x => !x.n && (x.name.replace(/\s/g, '') === nm || x.name.replace(/\s/g, '') === String(l.name || '').replace(/\s/g, '')))
           || st.lines.find(x => !x.n && x.c === l.c && !x.sub);
    if (t) Object.assign(t, { n: l.n, q: l.q, p: l.p, memo: l.memo || '', st: l.st || '' });
    else st.lines.push(Object.assign(newLine({ no: 27, name: '', c: '전체', extra: 1 }), { extra: 1, n: l.n, q: l.q, p: l.p, memo: l.memo || '' }));
  });
  if (Array.isArray(old.req)) st.req = old.req;
  return ensureReq(st);
}
let S = migrate(store.get(LS_DRAFT, null)) || blankState();
let curId = store.get(LS_DRAFT + '-id', null);

function saveDraft() { store.set(LS_DRAFT, S); store.set(LS_DRAFT + '-id', curId); }

/* ───────── 견적서 화면 (종이 견적서 그대로) ───────── */
const INFO = { date: 'i-date', shop: 'i-shop', tel: 'i-tel', addr: 'i-addr', site: 'i-site', memo: 'i-memo' };
function renderInfo() {
  for (const [k, id] of Object.entries(INFO)) {
    const el = document.getElementById(id); if (!el) continue;
    el.value = S.info[k] || '';
    el.oninput = () => { S.info[k] = el.value; saveDraft(); renderOrder(); syncInfo(k); };
  }
}
// 현장명·주소 등은 견적서·현장 요청 탭에서 같이 씀
function syncInfo(k) {
  document.querySelectorAll(`[data-info="${k}"]`).forEach(el => { if (document.activeElement !== el) el.value = S.info[k] || ''; });
}
const sizeOf = n => { const m = String(n || '').match(/\d{3,4}\s*[*xX×]\s*\d{3,4}(\s*[*xX]\s*\d+T?)?/g); return m ? m[m.length - 1].replace(/\s/g, '') : ''; };
const lineLabel = l => l.sub && l.row ? `${l.row} · ${l.name}` : (l.name || '');

function lineStatus(l) {
  if (!l.n) return ['', ''];
  if (isSet(l.n)) return l.q === '' ? ['수량?', 'warn'] : ['세트', 'set'];
  if (l.p === '') return ['단가 없음', 'bad'];
  if (l.q === '') return ['수량?', 'warn'];
  return ['', ''];
}
const linePrice = l => isSet(l.n) ? (l.vp != null && l.vp !== '' ? l.vp : setPrice(find(l.n).n)) : l.p;
function lineAmount(l) {
  if (!l.n || l.q === '') return '';
  const p = linePrice(l);
  return p === '' ? '' : l.q * p;
}
function metaHtml(l, i) {
  const raw = l.raw && l.raw !== l.n ? `<span class="m-raw">📷 ${esc(l.raw)}</span>` : '';
  return raw + metaCore(l, i);
}
function metaCore(l, i) {
  const it = l.n ? find(l.n) : null;
  if (!it) return l.n ? (l.p !== '' ? '<span class="m-new">새 자재 — 💾 저장하면 이 단가를 「내 단가」로 기억</span>' : '<span class="m-new">목록에 없음 — 단가 넣으면 「내 단가」로 기억</span>') : '';
  if (isSet(it.n)) return `<span>세트: ${esc(BATH_SETS[it.n].map(([c, q]) => c.split(/[\[(]/)[0].trim() + (q > 1 ? ' ×' + q : '')).join(' · '))}</span>`;
  const bits = [];
  if (it.my) bits.push(`내 단가 ${won(it.my.p)}`);
  if (it.h && it.h.length) bits.push(`지난 ${it.h.length}회` + (it.lo !== it.hi ? ` ${won(it.lo)}~${won(it.hi)}` : '') + (it.s ? ` · ${esc(it.s)}` : ''));
  const cur = priceOf(it);
  const diff = (l.p !== '' && cur !== '' && Number(l.p) !== Number(cur)) ? ` <button onclick="bathUsePrice(${i})">최근 ${won(cur)}로</button>` : '';
  return `<span>${bits.join(' / ')}</span>${diff}${it.h && it.h.length ? ` <button onclick="bathHistory(${i})">📈</button>` : ''}`;
}
const priceVal = l => won(linePrice(l));
const nameInput = (l, i, ph) => `<input type="text" class="in-n" data-i="${i}" value="${esc(l.n)}" title="${esc(l.n)}" placeholder="${esc(ph)}" autocomplete="off" aria-label="${esc(lineLabel(l))} 제품명">`;

// 견적서 한 줄. 같은 번호의 줄들은 번호 칸을 세로로 합침 (예: 8번 부자재 → 본드·압착·백시멘·에폭시 4줄)
function lineRow(l, i, k, span) {
  const set = isSet(l.n), first = k === 0;
  const cap = first && l.sub && l.row ? `<small class="pp-cap">${esc(l.row)}</small>` : '';
  const nm = l.extra ? '' : (l.sub ? `${esc(l.name)}/` : esc(l.name));
  return `<tr class="pp-row${l.n ? ' filled' : ''}${l.extra ? ' extra' : ''}${l.sub ? ' sub' : ''}${first ? ' grp-first' : ''}" data-row="${i}">
    ${first ? `<td class="pp-no"${span > 1 ? ` rowspan="${span}"` : ''}>${l.no}</td>` : ''}
    <td class="pp-nm">${cap}${nm}${l.extra ? '' : `<button class="pp-add" title="이 칸 아래에 줄 추가" onclick="bathAddUnder(${i})">＋</button>`}</td>
    <td class="pp-prod">${nameInput(l, i, '')}<div class="meta" data-meta="${i}">${metaHtml(l, i)}</div></td>
    <td class="pp-spec"><input type="text" class="in-spec" data-i="${i}" value="${esc(l.spec)}" aria-label="규격"></td>
    <td class="pp-q"><input type="text" inputmode="decimal" class="in-q" data-i="${i}" value="${esc(l.q)}" aria-label="${esc(lineLabel(l))} 수량"></td>
    <td class="pp-p"><input type="text" inputmode="numeric" class="in-p" data-i="${i}" value="${priceVal(l)}"${set ? ' readonly title="세트 단가 = 구성품 합"' : ''} aria-label="단가"><div class="pdiff" data-pd="${i}"></div><div class="st" data-st="${i}"></div></td>
    <td class="pp-memo"><input type="text" class="in-m" data-i="${i}" value="${esc(l.memo)}" aria-label="비고">${l.extra ? `<button class="pp-del" onclick="bathDel(${i})" title="줄 삭제">✕</button>` : ''}</td>
  </tr>`;
}

function renderLines() {
  const rows = [];
  for (let i = 0; i < S.lines.length; ) {
    let j = i; while (j + 1 < S.lines.length && S.lines[j + 1].no === S.lines[i].no) j++;
    const span = j - i + 1;
    for (let k = 0; k < span; k++) rows.push(lineRow(S.lines[i + k], i + k, k, span));
    i = j + 1;
  }
  $('#b-lines').innerHTML = rows.join('');
  $('#b-lines').querySelectorAll('input[data-i]').forEach(wireInput);
  S.lines.forEach((l, i) => refreshLine(i, true));
  renderTotals();
}

function refreshLine(i, quiet) {
  const l = S.lines[i]; if (!l) return;
  const [st, cls] = lineStatus(l), set = isSet(l.n);
  const host = $(`[data-row="${i}"]`); if (host) host.classList.toggle('filled', !!l.n);
  const m = $(`[data-meta="${i}"]`); if (m) m.innerHTML = metaHtml(l, i);
  const ne = $(`.in-n[data-i="${i}"]`); if (ne) ne.title = l.n || '';
  const pe = $(`.in-p[data-i="${i}"]`);
  if (pe) {
    if (document.activeElement !== pe) pe.value = priceVal(l);
    pe.readOnly = set; pe.classList.toggle('noprice', !!(l.n && !set && l.p === ''));
  }
  const sp = $(`.in-spec[data-i="${i}"]`); if (sp && document.activeElement !== sp) sp.value = l.spec || '';
  const se = $(`[data-st="${i}"]`); if (se) { se.textContent = st; se.className = 'st ' + cls; }
  const pd = $(`[data-pd="${i}"]`); if (pd) pd.innerHTML = diffHtml(l);
  if (!quiet) renderTotals();
}

function wireInput(el) {
  const i = Number(el.dataset.i), l = S.lines[i];
  if (el.classList.contains('in-n')) {
    el.addEventListener('focus', () => openAC(el, i));
    el.addEventListener('input', () => {
      const was = find(l.n); l.n = el.value; const it = find(l.n);
      delete l.prev; delete l.vp;   // 제품을 바꾸면 업체 견적 비교도 초기화
      if (it) { l.p = priceOf(it); l.spec = sizeOf(it.n); }
      else if (was) { l.p = ''; if (l.spec === sizeOf(was.n)) l.spec = ''; }   // 목록 제품에서 다른 이름으로 바꾸면 단가 비움
      changed(i); openAC(el, i);
    });
    el.addEventListener('keydown', e => acKey(e, el, i));
    el.addEventListener('blur', () => setTimeout(() => { if (AC.input === el) closeAC(); }, 160));
  } else if (el.classList.contains('in-q')) {
    el.addEventListener('input', () => { l.q = parseNum(el.value); changed(i); });
  } else if (el.classList.contains('in-p')) {
    el.addEventListener('input', () => { if (!el.readOnly) { l.p = parseNum(el.value); changed(i); } });
    el.addEventListener('blur', () => { if (!el.readOnly) el.value = won(l.p); });
  } else if (el.classList.contains('in-spec')) {
    el.addEventListener('input', () => { l.spec = el.value; saveDraft(); });
  } else if (el.classList.contains('in-m')) {
    el.addEventListener('input', () => { l.memo = el.value; saveDraft(); renderOrder(); });
  }
}
function changed(i) { saveDraft(); refreshLine(i); renderOrder(); }
window.bathUsePrice = i => { const l = S.lines[i]; l.p = priceOf(find(l.n)); changed(i); };
window.bathHistory = i => showHistory(find(S.lines[i].n));
window.bathAddUnder = i => {
  const l = S.lines[i]; let k = i; while (k + 1 < S.lines.length && S.lines[k + 1].no === l.no && S.lines[k + 1].extra) k++;
  S.lines.splice(k + 1, 0, Object.assign(newLine({ no: l.no, row: l.row, name: l.name, c: l.c, sub: l.sub, extra: 1 }), { extra: 1 }));
  saveDraft(); renderLines(); $(`.in-n[data-i="${k + 1}"]`)?.focus();
};
window.bathDel = i => { S.lines.splice(i, 1); saveDraft(); renderLines(); renderOrder(); };

function renderTotals() {
  if (typeof renderVendorBanner === 'function' && S.vendor) renderVendorBanner();
  let sum = 0, miss = 0;
  S.lines.forEach(l => { const a = lineAmount(l); if (a !== '') sum += a; else if (l.n && lineStatus(l)[1] === 'bad') miss++; });
  const rq = reqTotals();
  miss += rq.miss;
  $('#b-total').textContent = won(sum) + '원';
  $('#b-total-req').textContent = rq.sum ? `· 현장 요청 ${won(rq.sum)}원` : '';
  $('#b-warn').textContent = miss ? `⚠ 단가 없는 품목 ${miss}건 (합계에서 빠짐)` : '';
}

/* ───────── 자동완성 ───────── */
const AC = { input: null, i: -1, list: [], sel: 0 };
function score(it, toks) {
  const k = key(it.n);
  for (const t of toks) if (!k.includes(t)) return -1;
  return 1;
}
function suggestions(i, qstr) {
  const cat = S.lines[i].c;
  const toks = qstr.split(/\s+/).map(key).filter(Boolean);
  const byRecent = (a, b) => (b.my ? 1 : 0) - (a.my ? 1 : 0) || ((b.h || []).length - (a.h || []).length);
  const match = ITEMS.filter(it => score(it, toks) >= 0);
  if (!toks.length) return { same: match.filter(it => cat === '전체' || it.c === cat).slice(0, 80), other: [] };
  const same = cat === '전체' ? match : match.filter(it => it.c === cat);
  const other = cat === '전체' ? [] : match.filter(it => it.c !== cat);
  return { same: same.slice(0, 40), other: other.sort(byRecent).slice(0, 30) };
}
function hl(n, toks) {
  let s = esc(n);
  toks.forEach(t => { if (t.length < 1) return; const re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'); s = s.replace(re, '<mark>$1</mark>'); });
  return s;
}
function openAC(input, i) {
  const box = $('#b-ac');
  const qs = input.value.trim();
  const { same, other } = suggestions(i, qs);
  AC.input = input; AC.i = i; AC.list = [...same, ...other]; AC.sel = 0; AC.mode = 'bath';
  const toks = qs.split(/\s+/).filter(Boolean);
  const cat = S.lines[i].c;
  const it = (x, idx) => {
    const pr = priceOf(x);
    const tags = (x.set || BATH_SETS[x.n] ? '<span class="tag set">세트</span>' : '') + (x.mine ? '<span class="tag my">내 단가</span>' : x.my ? '<span class="tag my">내 단가 반영</span>' : '') + (cat !== x.c ? `<span class="tag">${esc(x.c)}</span>` : '');
    const hist = x.h && x.h.length ? `${x.h.length}회 · 최근 ${esc(x.s || '')}` + (x.lo !== x.hi ? ` · ${won(x.lo)}~${won(x.hi)}` : '') : (BATH_SETS[x.n] ? '구성품 합계' : x.mine ? '내가 넣은 단가' : '');
    return `<div class="ac-it${idx === 0 ? ' on' : ''}" data-k="${idx}" role="option">
      <span class="ac-n">${tags}${hl(x.n, toks)}</span><span class="ac-p">${pr === '' ? '단가 없음' : won(pr)}</span>
      <span class="ac-s">${x.c === cat || cat === '전체' ? esc(x.c) : ''}</span><span class="ac-s r">${hist}</span></div>`;
  };
  let html = '';
  if (same.length) html += `<div class="ac-sec">${esc(cat === '전체' ? '전체 자재' : cat)} (${same.length})</div>` + same.map((x, k) => it(x, k)).join('');
  if (other.length) html += `<div class="ac-sec">다른 분류</div>` + other.map((x, k) => it(x, same.length + k)).join('');
  if (!html) html = `<div class="ac-empty">「${esc(qs)}」 — 목록에 없어요. 그대로 쓰고 단가를 직접 넣으세요.</div>`;
  box.innerHTML = html;
  const r = input.getBoundingClientRect();
  box.style.left = (r.left + window.scrollX) + 'px';
  box.style.top = (r.bottom + window.scrollY + 2) + 'px';
  box.style.width = Math.max(r.width, 420) + 'px';
  box.classList.remove('hidden');
  box.onmousedown = e => e.preventDefault();
  box.querySelectorAll('.ac-it').forEach(el => el.onclick = () => pickAC(Number(el.dataset.k)));
  const vw = document.documentElement.clientWidth;
  const br = box.getBoundingClientRect();
  if (br.right > vw - 8) box.style.left = Math.max(8, vw - br.width - 8 + window.scrollX) + 'px';
}
function closeAC() { $('#b-ac').classList.add('hidden'); AC.input = null; }
const reopenAC = (input, i) => AC.mode === 'req' ? openReqAC(input, i) : openAC(input, i);
function pickAC(k) {
  const x = AC.list[k]; if (!x) return;
  if (AC.mode === 'req') return pickReq(x);
  const i = AC.i, l = S.lines[i], input = AC.input;
  l.n = x.n; l.p = priceOf(x); l.spec = sizeOf(x.n); delete l.prev; delete l.vp;
  input.value = x.n;
  closeAC(); changed(i);
  const q = $(`.in-q[data-i="${i}"]`); if (q) q.focus();
}
function acKey(e, input, i) {
  const box = $('#b-ac');
  if (box.classList.contains('hidden')) { if (e.key === 'ArrowDown') reopenAC(input, i); return; }
  const items = box.querySelectorAll('.ac-it');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    AC.sel = Math.max(0, Math.min(items.length - 1, AC.sel + (e.key === 'ArrowDown' ? 1 : -1)));
    items.forEach((el, k) => el.classList.toggle('on', k === AC.sel));
    items[AC.sel]?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    if (items.length) { e.preventDefault(); pickAC(AC.sel); }
  } else if (e.key === 'Escape') closeAC();
}
window.addEventListener('resize', closeAC);

/* ───────── 자재 주문서 ───────── */
function orderRows() {
  const rows = [];
  S.lines.forEach(l => {
    if (!l.n) return;
    if (l.q === 0) return;
    const it = find(l.n);
    if (it && BATH_SETS[it.n] && l.vp != null && l.vp !== '') {
      // 업체가 세트 단가로 준 경우: 세트 한 줄 + 구성품(포함)
      rows.push({ cat: it.c, label: lineLabel(l), n: it.n, q: l.q, p: l.vp, memo: placeMemo(l), st: l.st, prev: l.prev });
      BATH_SETS[it.n].forEach(([c, cq]) => rows.push({ cat: it.c, label: '', n: '  └ ' + c, q: l.q === '' ? '' : l.q * cq, p: '', inc: true, memo: '세트 포함', st: l.st }));
    } else if (it && BATH_SETS[it.n]) {
      BATH_SETS[it.n].forEach(([c, cq], k) => {
        const ci = find(c);
        rows.push({ cat: it.c, label: k === 0 ? lineLabel(l) : '', n: c, q: l.q === '' ? '' : l.q * cq, p: priceOf(ci), memo: k === 0 ? placeMemo(l) : '', st: l.st });
      });
    } else {
      rows.push({ cat: it ? it.c : (l.c === '전체' ? '' : l.c), label: lineLabel(l), n: l.n, q: l.q, p: l.p, memo: placeMemo(l), st: l.st, prev: l.prev });
    }
  });
  let run = 0;
  rows.forEach(r => { r.amt = (r.q === '' || r.p === '') ? '' : r.q * r.p; if (r.amt !== '') run += r.amt; r.run = r.amt === '' ? '' : run; });
  return { rows, total: run };
}
const placeMemo = l => l.memo || '';
function addrText() { return [S.info.addr, S.info.memo].filter(Boolean).join('\n'); }
function renderOrder() {
  const { rows, total } = orderRows();
  $('#b-order-count').textContent = rows.length || '';
  const body = rows.length ? rows.map(r => `<tr>
      <td class="c">${esc(r.cat)}</td><td>${esc(r.label)}</td><td class="prod">${esc(r.n)}</td>
      <td class="n${r.q === '' ? ' noq' : ''}">${esc(r.q)}</td><td class="n${r.p === '' && !r.inc ? ' miss' : ''}">${r.inc ? '<small>포함</small>' : won(r.p)}${diffHtml({ prev: r.prev, n: 1, _p: r.p })}</td><td class="n">${won(r.amt)}</td>
      <td>${esc(r.memo)}</td><td class="n">${won(r.run)}</td><td class="c">${esc(r.st)}</td></tr>`).join('')
    : '<tr class="empty"><td colspan="9">견적서에 제품을 넣으면 여기에 주문서가 만들어집니다</td></tr>';
  const rq = reqOrder();
  $('#b-order-count').textContent = (rows.length + rq.rows.length) || '';
  $('#b-order').innerHTML = `<table class="x-sheet">
    <colgroup><col style="width:9%"><col style="width:11%"><col><col style="width:5%"><col style="width:8%"><col style="width:9%"><col style="width:12%"><col style="width:9%"><col style="width:7%"></colgroup>
    <tr><td class="x-site">${esc(S.info.site || '현장명')}</td><td class="x-addr" colspan="3">${esc(addrText())}</td><td class="c"><b>합계</b></td><td class="x-sum">${won(total)}</td><td colspan="3">${esc(S.info.date || '')}${S.info.tel ? ' · ' + esc(S.info.tel) : ''}</td></tr>
    <tr><th>구분</th><th>내용</th><th>제품명 및 사이즈</th><th>수량</th><th>원가</th><th>총 가격</th><th>비고</th><th>누계</th><th>주문상태</th></tr>
    ${body}
    <tr><td colspan="5" class="c"><b>합계</b></td><td class="x-sum">${won(total)}</td><td colspan="3"></td></tr>
  </table>`;
  renderReqOrder(rq);
}

function orderTSV() {
  const { rows, total } = orderRows();
  const cell = v => String(v ?? '').replace(/\t/g, ' ').includes('\n') ? '"' + String(v).replace(/"/g, '""') + '"' : String(v ?? '');
  const out = [[S.info.site, addrText(), '', '', '합계', total].map(cell).join('\t'),
    ['구분', '내용', '제품명 및 사이즈', '수량', '원가', '총 가격', '비고', '누계', '주문상태'].join('\t')];
  rows.forEach(r => out.push([r.cat, r.label, r.n, r.q, r.p, r.amt, r.memo, r.run, r.st].map(cell).join('\t')));
  out.push(['', '', '', '', '합계', total].join('\t'));
  return out.join('\n');
}
async function copyOrder(which) {
  const t = which === 'req' ? reqTSV() : orderTSV(), msg = $('#b-copy-msg');
  try { await navigator.clipboard.writeText(t); msg.textContent = '✅ 복사했어요 — 엑셀에서 붙여넣으세요 (Ctrl+V)'; }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); msg.textContent = '✅ 복사했어요'; } catch (e2) { msg.textContent = '복사가 막혀 있어요. 엑셀 파일 저장을 써주세요.'; }
    ta.remove();
  }
  setTimeout(() => msg.textContent = '', 5000);
}

async function downloadXlsx() {
  if (typeof ExcelJS === 'undefined') { alert('엑셀 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인하세요.'); return; }
  const { rows, total } = orderRows();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('자재주문');
  ws.columns = [12.9, 16, 70, 6.5, 11, 12, 18, 12, 10].map(width => ({ width }));
  const thin = { style: 'thin', color: { argb: 'FF999999' } }, box = { top: thin, left: thin, bottom: thin, right: thin };
  const r1 = ws.addRow([S.info.site, addrText(), '', '', '합계', { formula: `SUM(F3:F${2 + rows.length})`, result: total }]);
  ws.mergeCells('B1:D1');
  r1.height = 36;
  r1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B0F0' } };
  r1.getCell(1).font = { name: '함초롬바탕', size: 12, bold: true };
  r1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  r1.getCell(2).alignment = { vertical: 'middle', wrapText: true };
  r1.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  r1.getCell(6).font = { bold: true }; r1.getCell(6).numFmt = '#,##0';
  const hr = ws.addRow(['구분', '내용', '제품명 및 사이즈', '수량', '원가', '총 가격', '비고', '누계', '주문상태']);
  hr.eachCell(c => { c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }; c.border = box; c.alignment = { horizontal: 'center' }; });
  rows.forEach((r, k) => {
    const n = 3 + k;
    const row = ws.addRow([r.cat, r.label, r.n, r.q === '' ? null : r.q, r.p === '' ? null : r.p,
      { formula: `IF(OR(D${n}="",E${n}=""),"",D${n}*E${n})`, result: r.amt === '' ? '' : r.amt }, r.memo, { formula: `SUM(F$3:F${n})`, result: r.run || 0 }, r.st]);
    row.eachCell({ includeEmpty: true }, (c, j) => {
      c.border = box; c.font = { name: [3, 4, 5, 6, 8].includes(j) ? 'Arial' : '맑은 고딕', size: 10 };
      if ([4, 5, 6, 8].includes(j)) c.numFmt = '#,##0';
    });
    if (r.p === '') row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
  });
  const tr = ws.addRow(['', '', '', '', '합계', { formula: `SUM(F3:F${2 + rows.length})`, result: total }]);
  tr.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  tr.getCell(6).font = { bold: true }; tr.getCell(6).numFmt = '#,##0'; tr.getCell(5).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 2 }];

  // 견적서 시트: 종이 견적서 모양 그대로
  const we = wb.addWorksheet('견적서', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  we.columns = [4.5, 17, 50, 13, 8, 11, 14].map(width => ({ width }));
  const ink = { style: 'thin', color: { argb: 'FF374151' } }, pbox = { top: ink, left: ink, bottom: ink, right: ink };
  const pen = { color: { argb: 'FF1E3A8A' }, size: 11 };
  we.mergeCells('A1:G1'); we.getCell('A1').value = '견 적 서';
  we.getCell('A1').font = { size: 20, name: '바탕' }; we.getCell('A1').alignment = { horizontal: 'center' }; we.getRow(1).height = 34;
  we.getCell('A2').value = '일자:'; we.getCell('B2').value = S.info.date || ''; we.getCell('C2').value = '상호:  ' + (S.info.shop || '');
  we.getCell('E2').value = '전화번호:'; we.mergeCells('F2:G2'); we.getCell('F2').value = S.info.tel || '';
  [['B2'], ['C2'], ['F2']].forEach(([c]) => we.getCell(c).font = pen);
  we.getCell('A3').value = '주소:'; we.mergeCells('B3:G3'); we.getCell('B3').value = S.info.addr || ''; we.getCell('B3').font = pen;
  [2, 3].forEach(n => we.getRow(n).height = 22);
  const hd = we.getRow(4); hd.values = ['No', '품명', '제품명', '규격', '수량', '단가', '비고']; hd.height = 24;
  hd.eachCell(c => { c.border = pbox; c.alignment = { horizontal: 'center', vertical: 'middle' }; });
  let r = 5;
  for (let i = 0; i < S.lines.length; ) {
    let j = i; while (j + 1 < S.lines.length && S.lines[j + 1].no === S.lines[i].no) j++;
    for (let k = i; k <= j; k++) {
      const l = S.lines[k], row = we.getRow(r + k - i), p = l.n ? linePrice(l) : '';
      const nm = l.extra ? '' : (l.sub ? l.name + '/' : l.name);
      row.values = [k === i ? l.no : null, nm, l.n || '', l.spec || '', l.q === '' ? null : l.q, p === '' ? null : p, l.memo || ''];
      [3, 4, 5, 6, 7].forEach(c => row.getCell(c).font = pen);
      row.getCell(6).numFmt = '#,##0'; row.height = 20;
      for (let c = 1; c <= 7; c++) { const cell = row.getCell(c); cell.border = pbox; if (c <= 2) cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
    }
    if (j > i) we.mergeCells(`A${r}:A${r + j - i}`);
    r += j - i + 1; i = j + 1;
  }
  addReqSheets(wb);
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = `자재주문_${(S.info.site || '현장').replace(/[\\/:*?"<>|]/g, '')}_${S.info.date || today()}.xlsx`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ───────── 단가 이력 ───────── */
let pLimit = 120;
function renderPrices() {
  const q = $('#p-q').value.trim(), cat = $('#p-cat').value;
  const toks = q.split(/\s+/).map(key).filter(Boolean);
  const list = ITEMS.filter(x => (!cat || x.c === cat) && score(x, toks) >= 0 && ((x.h && x.h.length) || x.mine || x.my));
  const shown = list.slice(0, pLimit);
  $('#b-prices').innerHTML = `<table class="p-table"><thead><tr><th>분류</th><th>제품명</th><th class="n">최근 단가</th><th class="n">최저~최고</th><th class="n">횟수</th><th>최근 현장</th></tr></thead><tbody>
    ${shown.map(x => `<tr class="row" data-n="${esc(x.n)}"><td class="cat">${esc(x.c)}</td><td>${hl(x.n, q.split(/\s+/).filter(Boolean))}${x.my ? '<span class="tag">내 단가 ' + won(x.my.p) + '</span>' : ''}</td>
      <td class="n"><b>${won(x.h && x.h.length ? x.p : x.my.p)}</b></td><td class="n">${x.h && x.h.length ? (x.lo === x.hi ? '—' : won(x.lo) + '~' + won(x.hi)) : ''}</td>
      <td class="n">${x.h ? x.h.length : 0}</td><td>${esc(x.s || (x.my && x.my.s) || '')}</td></tr>`).join('')}
    </tbody></table>${list.length > shown.length ? `<div class="p-more"><button class="b-addline" id="p-more">${list.length - shown.length}개 더 보기</button></div>` : ''}
    ${!list.length ? '<div class="p-more">검색 결과가 없어요</div>' : ''}`;
  $('#b-prices').querySelectorAll('tr.row').forEach(tr => tr.onclick = () => showHistory(find(tr.dataset.n)));
  const more = $('#p-more'); if (more) more.onclick = () => { pLimit += 200; renderPrices(); };
}
function showHistory(it) {
  if (!it) return;
  const h = it.h || [];
  const max = Math.max(1, ...h.map(r => r[1]));
  $('#b-modal-title').textContent = it.n;
  $('#b-modal-body').innerHTML = `
    <div class="h-stats">
      <div>분류<b>${esc(it.c)}</b></div>
      <div>최근 단가<b>${won(it.p)}</b></div>
      ${h.length ? `<div>최저 ~ 최고<b>${won(it.lo)} ~ ${won(it.hi)}</b></div><div>주문 횟수<b>${h.length}회</b></div>` : ''}
      ${it.my ? `<div>내 단가<b>${won(it.my.p)}</b><small>${esc(it.my.d || '')} ${esc(it.my.s || '')}</small></div>` : ''}
    </div>
    ${h.length ? `<table class="p-table"><thead><tr><th>#</th><th>현장</th><th class="n">원가</th><th class="n">수량</th><th style="width:30%"></th></tr></thead><tbody>
      ${h.map((r, k) => `<tr><td class="cat">${k + 1}</td><td>${esc(r[0])}</td><td class="n">${won(r[1])}</td><td class="n">${esc(r[2])}</td><td><div class="h-bar" style="width:${Math.round(r[1] / max * 100)}%"></div></td></tr>`).reverse().join('')}
    </tbody></table><p class="b-hint" style="margin-top:8px">위쪽이 최근 주문입니다 (엑셀에서 아래쪽에 적힌 순서).</p>` : '<p class="b-hint">지난 주문 기록이 없어요.</p>'}
    ${it.my ? `<button class="b-addline" onclick="bathForgetMy('${esc(key(it.n))}')">「내 단가」 지우기</button>` : ''}`;
  $('#b-modal').classList.remove('hidden');
}
window.closeModal = () => $('#b-modal').classList.add('hidden');
$('#b-modal').addEventListener('click', e => { if (e.target.id === 'b-modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
window.bathForgetMy = k => {
  const my = store.get(LS_MY, {}); delete my[k]; store.set(LS_MY, my);
  buildCatalog(); buildReqCatalog(); closeModal(); renderLines(); renderReq(); renderOrder(); renderPrices();
};

/* ───────── 저장 / 불러오기 / 백업 ───────── */
function learnPrices() {
  const my = store.get(LS_MY, {});
  let n = 0;
  S.lines.forEach(l => {
    if (!l.n || l.p === '' || isSet(l.n)) return;
    const it = find(l.n);
    const base = it && !it.mine ? it.p : null;
    if (base != null && Number(base) === Number(l.p)) return;
    my[key(l.n)] = { n: it ? it.n : l.n, c: it ? it.c : (l.c === '전체' ? '기타' : l.c), p: l.p, s: S.info.site, d: S.info.date };
    n++;
  });
  S.req.forEach(r => {
    if (!r.n || r.p === '') return;
    const it = findReq(r);
    if (it && Number(it.p) === Number(r.p)) return;
    my[key(r.n + ' ' + (r.spec || ''))] = { n: r.n, spec: r.spec || '', u: r.u || '', c: '현장 요청', p: r.p, s: S.info.site, d: S.info.date, req: 1 };
    n++;
  });
  store.set(LS_MY, my);
  return n;
}
function saveQuote() {
  const list = store.get(LS_QUOTES, []);
  if (!curId) curId = 'q' + Date.now();
  const rec = { id: curId, at: new Date().toISOString(), site: S.info.site, date: S.info.date, total: orderRows().total, S };
  const k = list.findIndex(x => x.id === curId);
  if (k >= 0) list[k] = rec; else list.unshift(rec);
  const ok = store.set(LS_QUOTES, list);
  const learned = learnPrices();
  buildCatalog(); buildReqCatalog(); saveDraft(); renderLines(); renderReq();
  $('#b-saved-at').textContent = ok ? `저장됨 ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}${learned ? ` · 새 단가 ${learned}개를 「내 단가」로 기억` : ''}` : '저장 실패 (브라우저 저장 공간이 막혀 있어요)';
}
function openLoad() {
  const list = store.get(LS_QUOTES, []);
  $('#b-modal-title').textContent = '📂 저장된 견적';
  $('#b-modal-body').innerHTML = list.length ? `<div class="q-list">${list.map(x => `<div class="q-item">
      <div class="t"><b>${esc(x.site || '(현장명 없음)')}</b><small>${esc(x.date || '')} · 원가 ${won(x.total)}원 · 저장 ${new Date(x.at).toLocaleString('ko-KR')}</small></div>
      <button class="go" data-go="${x.id}">열기</button><button data-del="${x.id}">삭제</button></div>`).join('')}</div>`
    : '<p class="b-hint">저장된 견적이 없어요. 💾 저장을 누르면 이 브라우저에 저장됩니다.</p>';
  $('#b-modal-body').querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    const x = list.find(y => y.id === b.dataset.go); S = migrate(JSON.parse(JSON.stringify(x.S))); curId = x.id;
    saveDraft(); closeModal(); renderAll(); $('#b-saved-at').textContent = '불러옴: ' + (x.site || '');
  });
  $('#b-modal-body').querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    if (!confirm('이 견적을 삭제할까요?')) return;
    store.set(LS_QUOTES, list.filter(y => y.id !== b.dataset.del)); openLoad();
  });
  $('#b-modal').classList.remove('hidden');
}
function newQuote() {
  if (S.lines.some(l => l.n) && !confirm('지금 견적을 비우고 새로 시작할까요? (저장 안 한 내용은 사라집니다)')) return;
  S = blankState(); curId = null; saveDraft(); renderAll(); $('#b-saved-at').textContent = '';
}
function backup() {
  const data = { kind: 'bath-backup', at: new Date().toISOString(), quotes: store.get(LS_QUOTES, []), my: store.get(LS_MY, {}) };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  a.download = `욕실견적_백업_${today()}.json`; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500);
}
function restore(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result); if (d.kind !== 'bath-backup') throw 0;
      const cur = store.get(LS_QUOTES, []), ids = new Set(cur.map(x => x.id));
      store.set(LS_QUOTES, cur.concat((d.quotes || []).filter(x => !ids.has(x.id))));
      store.set(LS_MY, Object.assign(store.get(LS_MY, {}), d.my || {}));
      buildCatalog(); renderAll(); alert('가져왔어요: 견적 ' + (d.quotes || []).length + '개, 내 단가 ' + Object.keys(d.my || {}).length + '개');
    } catch (e) { alert('욕실 견적 백업 파일이 아니에요.'); }
  };
  fr.readAsText(file);
}


/* ═════════ 현장 요청 (현장에 붙여 둔 종이 → 웹으로 옮겨 적기 → 업체 견적서 형식 발주) ═════════ */
const PLACES = ['거실욕실', '안방욕실', '거실', '안방', '작은방', '주방', '현관', '베란다', '세탁실', '다용도실', '드레스룸', '복도', '천장', '전체'];
let REQ_ITEMS = [], REQ_BYKEY = new Map();
const rkey = (n, spec) => key(n + ' ' + (spec || ''));
function buildReqCatalog() {
  const list = [];
  (typeof VENDOR_PRICES !== 'undefined' ? VENDOR_PRICES : []).forEach(x => {
    if (!x.n || x.p == null) return;
    const p = x.vat === '포함' ? Math.round(x.p / 1.1) : x.p;   // 업체 견적서처럼 공급가(부가세 별도)로
    list.push({ n: x.n, spec: x.spec || '', u: x.u || '', p, c: x.cat, v: x.vendor || x.sub || '', d: x.date || '', note: x.note || '' });
  });
  ITEMS.forEach(x => { if (!x.mine && !BATH_SETS[x.n]) list.push({ n: x.n, spec: sizeOf(x.n), u: '', p: priceOf(x), c: '욕실 · ' + x.c, v: x.s ? '지난 주문 ' + x.s : '욕실 단가', d: '' }); });
  Object.values(store.get(LS_MY, {})).forEach(m => { if (m.req) list.push({ n: m.n, spec: m.spec || '', u: m.u || '', p: m.p, c: '내 단가', v: m.s || '', d: m.d || '', mine: 1 }); });
  // 같은 품명·규격은 최근 것 하나만 (내 단가 > 날짜 최근)
  const by = new Map();
  list.forEach(x => {
    const k = rkey(x.n, x.spec), o = by.get(k);
    if (!o || x.mine || (!o.mine && String(x.d) > String(o.d))) by.set(k, x);
  });
  REQ_ITEMS = [...by.values()].sort((a, b) => (b.mine || 0) - (a.mine || 0) || String(b.d).localeCompare(String(a.d)));
  REQ_BYKEY = by;
}
const findReq = r => REQ_BYKEY.get(rkey(r.n, r.spec)) || null;
const reqAmt = r => (r.n && r.q !== '' && r.p !== '') ? r.q * r.p : '';
function reqTotals() {
  let sum = 0, miss = 0;
  (S.req || []).forEach(r => { const a = reqAmt(r); if (a !== '') sum += a; else if (r.n && r.p === '') miss++; });
  return { sum, miss };
}

function renderReq() {
  const host = $('#b-req'); if (!host) return;
  host.innerHTML = S.req.map((r, i) => `<tr class="rq-row${r.n ? ' filled' : ''}" data-r="${i}">
    <td class="rq-no">${i + 1}</td>
    <td><input type="text" class="rq-d" data-r="${i}" value="${esc(r.d)}" placeholder="${i === 0 ? '1/6' : ''}" aria-label="${i + 1}번 날짜"></td>
    <td><input type="text" class="rq-who" data-r="${i}" value="${esc(r.who)}" aria-label="${i + 1}번 이름"></td>
    <td><input type="text" class="rq-place" data-r="${i}" value="${esc(r.place)}" list="b-places" aria-label="${i + 1}번 사용 장소"></td>
    <td class="rq-prod"><input type="text" class="rq-n" data-r="${i}" value="${esc(r.n)}" autocomplete="off" aria-label="${i + 1}번 품명"><div class="meta" data-rmeta="${i}"></div></td>
    <td><input type="text" class="rq-spec" data-r="${i}" value="${esc(r.spec)}" aria-label="${i + 1}번 규격"></td>
    <td class="rq-qu"><input type="text" inputmode="decimal" class="rq-q" data-r="${i}" value="${esc(r.q)}" aria-label="${i + 1}번 수량"><input type="text" class="rq-u" data-r="${i}" value="${esc(r.u)}" placeholder="${r.n ? '단위' : ''}" aria-label="${i + 1}번 단위"></td>
    <td><input type="text" class="rq-memo" data-r="${i}" value="${esc(r.memo)}" aria-label="${i + 1}번 비고"></td>
    <td class="rq-off"><input type="text" inputmode="numeric" class="rq-p" data-r="${i}" value="${won(r.p)}" aria-label="${i + 1}번 단가"></td>
    <td class="rq-off rq-amt" data-ramt="${i}">${won(reqAmt(r))}</td>
  </tr>`).join('');
  host.querySelectorAll('input[data-r]').forEach(wireReq);
  S.req.forEach((r, i) => refreshReq(i));
}
function refreshReq(i) {
  const r = S.req[i]; if (!r) return;
  const row = $(`.rq-row[data-r="${i}"]`); if (row) row.classList.toggle('filled', !!r.n);
  const it = r.n ? findReq(r) : null;
  const m = $(`[data-rmeta="${i}"]`);
  if (m) m.innerHTML = (r.raw && r.raw !== r.n ? `<span class="m-raw">📷 ${esc(r.raw)}</span>` : '') + (!r.n ? '' : it ? `<span>${esc(it.v)}${it.d ? ' · ' + esc(it.d) : ''}${it.note ? ' · ' + esc(it.note) : ''}</span>` : '<span class="m-new">목록에 없음 — 단가 넣으면 「내 단가」로 기억</span>');
  const pe = $(`.rq-p[data-r="${i}"]`); if (pe) { if (document.activeElement !== pe) pe.value = won(r.p); pe.classList.toggle('noprice', !!(r.n && r.p === '')); }
  ['spec', 'u'].forEach(f => { const el = $(`.rq-${f}[data-r="${i}"]`); if (el && document.activeElement !== el) el.value = r[f] || ''; });
  const a = $(`[data-ramt="${i}"]`); if (a) a.textContent = won(reqAmt(r));
}
function reqChanged(i) { saveDraft(); refreshReq(i); renderTotals(); renderOrder(); }
function wireReq(el) {
  const i = Number(el.dataset.r), r = S.req[i];
  const f = [...el.classList].find(c => c.startsWith('rq-')).slice(3);
  if (f === 'n') {
    el.addEventListener('focus', () => openReqAC(el, i));
    el.addEventListener('input', () => {
      const was = findReq(r); r.n = el.value;
      const it = REQ_ITEMS.find(x => key(x.n) === key(r.n) && (!r.spec || key(x.spec) === key(r.spec)));
      if (it) { r.spec = it.spec; r.u = it.u; r.p = it.p; r.v = it.v; } else if (was) { r.p = ''; r.v = ''; }
      reqChanged(i); openReqAC(el, i);
    });
    el.addEventListener('keydown', e => acKey(e, el, i));
    el.addEventListener('blur', () => setTimeout(() => { if (AC.input === el) closeAC(); }, 160));
    return;
  }
  el.addEventListener('input', () => {
    r[f] = (f === 'q' || f === 'p') ? parseNum(el.value) : el.value;
    if (f === 'spec') { const it = findReq(r); if (it) { r.p = it.p; r.u = r.u || it.u; } }
    reqChanged(i);
  });
  if (f === 'p') el.addEventListener('blur', () => el.value = won(r.p));
  // 마지막 줄에 쓰기 시작하면 빈 줄 자동 추가
  el.addEventListener('focus', () => { if (i >= S.req.length - 2) { for (let k = 0; k < 5; k++) S.req.push(newReq()); saveDraft(); const a = document.activeElement; renderReq(); $(`.${a.className.split(' ')[0]}[data-r="${i}"]`)?.focus(); } }, { once: true });
}
function openReqAC(input, i) {
  const box = $('#b-ac');
  const qs = input.value.trim(), toks = qs.split(/\s+/).map(key).filter(Boolean);
  const list = REQ_ITEMS.filter(x => { const k = key(x.n + x.spec + x.c); return toks.every(t => k.includes(t)); }).slice(0, toks.length ? 60 : 40);
  AC.input = input; AC.i = i; AC.list = list; AC.sel = 0; AC.mode = 'req';
  const raw = qs.split(/\s+/).filter(Boolean);
  box.innerHTML = list.length ? `<div class="ac-sec">${toks.length ? '찾은 자재' : '최근 업체 단가'} (${list.length})</div>` + list.map((x, k) => `<div class="ac-it${k === 0 ? ' on' : ''}" data-k="${k}" role="option">
      <span class="ac-n">${x.mine ? '<span class="tag my">내 단가</span>' : ''}<span class="tag">${esc(x.c)}</span>${hl(x.n, raw)}${x.spec ? ` <small>${hl(x.spec, raw)}</small>` : ''}</span>
      <span class="ac-p">${won(x.p)}${x.u ? `<small>/${esc(x.u)}</small>` : ''}</span>
      <span class="ac-s">${esc(x.v)}</span><span class="ac-s r">${esc(x.d)}</span></div>`).join('')
    : `<div class="ac-empty">「${esc(qs)}」 — 단가표에 없어요. 그대로 쓰고 단가를 넣으세요.</div>`;
  const rc = input.getBoundingClientRect();
  box.style.left = (rc.left + window.scrollX) + 'px'; box.style.top = (rc.bottom + window.scrollY + 2) + 'px';
  box.style.width = Math.max(rc.width, 460) + 'px';
  box.classList.remove('hidden');
  box.onmousedown = e => e.preventDefault();
  box.querySelectorAll('.ac-it').forEach(el => el.onclick = () => pickAC(Number(el.dataset.k)));
  const vw = document.documentElement.clientWidth, br = box.getBoundingClientRect();
  if (br.right > vw - 8) box.style.left = Math.max(8, vw - br.width - 8 + window.scrollX) + 'px';
}
function pickReq(x) {
  const i = AC.i, r = S.req[i], input = AC.input;
  Object.assign(r, { n: x.n, spec: x.spec, u: x.u, p: x.p, v: x.v });
  input.value = x.n; closeAC(); reqChanged(i);
  $(`.rq-q[data-r="${i}"]`)?.focus();
}

// 자재 주문서 탭: 업체 견적서 형식 (No · 품명 · 규격 · 단위 · 수량 · 단가 · 금액 · 부가세 · 적요)
function reqOrder() {
  const rows = (S.req || []).filter(r => r.n && r.q !== 0).map(r => {
    const amt = reqAmt(r);
    const note = [r.place, r.who, r.d, r.memo].filter(Boolean).join(' · ');
    return { n: r.n, spec: r.spec, u: r.u, q: r.q, p: r.p, amt, vat: amt === '' ? '' : Math.round(amt * 0.1), note, v: r.v };
  });
  const sum = rows.reduce((a, r) => a + (r.amt || 0), 0);
  return { rows, sum, vat: Math.round(sum * 0.1), total: sum + Math.round(sum * 0.1) };
}
function renderReqOrder(rq) {
  const host = $('#b-order-req'); if (!host) return;
  host.innerHTML = `<table class="x-sheet x-quote">
    <colgroup><col style="width:4%"><col style="width:24%"><col style="width:14%"><col style="width:5%"><col style="width:6%"><col style="width:9%"><col style="width:10%"><col style="width:8%"><col></colgroup>
    <tr><td colspan="3" class="x-q-to"><b>${esc(S.info.site || '현장명')}</b> 현장 자재 <small>${esc(S.info.date || '')}</small></td>
        <td colspan="3" class="c">합계금액 <small>(부가세 포함)</small></td><td colspan="3" class="x-sum">${won(rq.total)}원</td></tr>
    <tr><th>No.</th><th>품명</th><th>규격</th><th>단위</th><th>수량</th><th>단가</th><th>금액</th><th>부가세</th><th>적요 (장소 · 요청자 · 날짜)</th></tr>
    ${rq.rows.length ? rq.rows.map((r, k) => `<tr><td class="c">${k + 1}</td><td class="prod">${esc(r.n)}</td><td>${esc(r.spec)}</td><td class="c">${esc(r.u)}</td>
      <td class="n${r.q === '' ? ' noq' : ''}">${esc(r.q)}</td><td class="n${r.p === '' ? ' miss' : ''}">${won(r.p)}</td><td class="n">${won(r.amt)}</td><td class="n">${won(r.vat)}</td><td>${esc(r.note)}</td></tr>`).join('')
      : '<tr class="empty"><td colspan="9">「현장 요청」 탭에 적은 자재가 여기에 업체 견적서 형식으로 정리됩니다</td></tr>'}
    <tr><td colspan="6" class="c"><b>공급가 합계</b></td><td class="n"><b>${won(rq.sum)}</b></td><td class="n"><b>${won(rq.vat)}</b></td><td class="x-sum">합계 ${won(rq.total)}</td></tr>
  </table>`;
}
function reqTSV() {
  const rq = reqOrder();
  const cell = v => String(v ?? '').replace(/[\t\n]/g, ' ');
  const out = [[`${S.info.site || ''} 현장 자재`, '', '', '', '', '합계금액', rq.total].join('\t'), ['No.', '품명', '규격', '단위', '수량', '단가', '금액', '부가세', '적요'].join('\t')];
  rq.rows.forEach((r, k) => out.push([k + 1, r.n, r.spec, r.u, r.q, r.p, r.amt, r.vat, r.note].map(cell).join('\t')));
  out.push(['', '', '', '', '', '공급가 합계', rq.sum, rq.vat, '합계 ' + rq.total].join('\t'));
  return out.join('\n');
}
function addReqSheets(wb) {
  const rq = reqOrder(); if (!rq.rows.length) return;
  const thin = { style: 'thin', color: { argb: 'FF999999' } }, box = { top: thin, left: thin, bottom: thin, right: thin };
  const ws = wb.addWorksheet('현장요청 발주', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = [5, 30, 18, 6, 7, 11, 12, 10, 30].map(width => ({ width }));
  ws.mergeCells('A1:I1'); ws.getCell('A1').value = '견 적 서 (현장 요청 자재)'; ws.getCell('A1').font = { size: 18, bold: true }; ws.getCell('A1').alignment = { horizontal: 'center' };
  ws.getCell('A2').value = `${S.info.shop || ''} · 현장: ${S.info.site || ''} · ${S.info.addr || ''}`; ws.mergeCells('A2:F2');
  ws.getCell('G2').value = '합계금액'; ws.mergeCells('H2:I2'); ws.getCell('H2').value = rq.total; ws.getCell('H2').numFmt = '#,##0"원"'; ws.getCell('H2').font = { bold: true, size: 13 };
  const hr = ws.addRow(['No.', '품명', '규격', '단위', '수량', '단가', '금액', '부가세', '적요']);
  hr.eachCell(c => { c.font = { bold: true }; c.border = box; c.alignment = { horizontal: 'center' }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }; });
  rq.rows.forEach((r, k) => {
    const n = 4 + k;
    const row = ws.addRow([k + 1, r.n, r.spec, r.u, r.q === '' ? null : r.q, r.p === '' ? null : r.p,
      { formula: `IF(OR(E${n}="",F${n}=""),"",E${n}*F${n})`, result: r.amt === '' ? '' : r.amt }, { formula: `IF(G${n}="","",ROUND(G${n}*0.1,0))`, result: r.vat === '' ? '' : r.vat }, r.note]);
    row.eachCell({ includeEmpty: true }, (c, j) => { c.border = box; if ([5, 6, 7, 8].includes(j)) c.numFmt = '#,##0'; });
  });
  const last = 3 + rq.rows.length;
  const tr = ws.addRow(['', '', '', '', '', '공급가', { formula: `SUM(G4:G${last})`, result: rq.sum }, { formula: `SUM(H4:H${last})`, result: rq.vat }, '']);
  [7, 8].forEach(j => { tr.getCell(j).numFmt = '#,##0'; tr.getCell(j).font = { bold: true }; });
  ws.getCell('H2').value = { formula: `G${last + 1}+H${last + 1}`, result: rq.total };

  // 현장 자재 요청서 (종이 양식에 적힌 그대로)
  const wq = wb.addWorksheet('현장 자재 요청서');
  wq.columns = [5, 9, 10, 12, 30, 16, 8, 6, 22].map(width => ({ width }));
  wq.addRow([`현장 자재 요청서 — ${S.info.site || ''}`]).font = { size: 14, bold: true };
  const h2 = wq.addRow(['No', '날짜', '이름', '사용 장소', '품명', '규격', '수량', '단위', '비고']);
  h2.eachCell(c => { c.font = { bold: true }; c.border = box; });
  S.req.filter(r => r.n || r.who || r.place).forEach((r, k) => {
    const row = wq.addRow([k + 1, r.d, r.who, r.place, r.n, r.spec, r.q === '' ? null : r.q, r.u, r.memo]);
    row.eachCell({ includeEmpty: true }, c => c.border = box);
  });
}

// 현장에 붙일 종이 (빈 양식 / 적은 내용)
function printReq(blank) {
  const rows = blank ? [] : S.req.filter(r => r.n || r.who || r.place || r.q !== '');
  const N = Math.max(22, rows.length);
  const tel = typeof COMPANY !== 'undefined' ? `${COMPANY.name} ${COMPANY.tel}` : '';
  const body = Array.from({ length: N }, (_, k) => {
    const r = rows[k] || {};
    return `<tr><td class="c">${k + 1}</td><td>${esc(r.d || '')}</td><td>${esc(r.who || '')}</td><td>${esc(r.place || '')}</td><td>${esc(r.n || '')}</td><td>${esc(r.spec || '')}</td><td class="c">${esc(r.q ?? '')} ${esc(r.u || '')}</td><td>${esc(r.memo || '')}</td><td></td></tr>`;
  }).join('');
  $('#print-area').innerHTML = `<div class="pr-sheet">
    <div class="pr-title">현장 자재 요청서</div>
    <div class="pr-head"><span>현장: <b>${esc(S.info.site || '')}</b>${S.info.addr ? ' · ' + esc(S.info.addr) : ''}</span><span>${esc(tel)}</span></div>
    <div class="pr-guide">필요한 자재를 아래에 적어주세요 — <b>날짜 · 이름 · 사용 장소(안방 / 거실욕실 / 주방 …) · 품명 · 규격 · 수량</b>. 사무실에서 확인하고 주문합니다.</div>
    <table class="pr-table">
      <colgroup><col style="width:5%"><col style="width:8%"><col style="width:9%"><col style="width:11%"><col style="width:24%"><col style="width:15%"><col style="width:9%"><col style="width:13%"><col style="width:6%"></colgroup>
      <tr><th>No</th><th>날짜</th><th>이름</th><th>사용 장소</th><th>품명</th><th>규격</th><th>수량</th><th>비고</th><th>주문<br>✔</th></tr>
      <tr class="pr-ex"><td class="c">예</td><td>1/6</td><td>김○○</td><td>안방</td><td>MDF</td><td>12T</td><td class="c">7장</td><td>2:8 절단</td><td></td></tr>
      ${body}
    </table>
    <div class="pr-foot">자주 쓰는 자재: 타카핀(ST64 · ST32 · DT64 · 422 · F30) · 205본드 · 실리콘 · 폼본드 · MDF(9T · 12T) · 합판(8.5T · 11.5T) · 다루끼 · 나나부 · 투바이 · 석고보드(일반 · 방수) · 평6전 · 마이너스몰딩 · 천장몰딩 · 걸레받이</div>
  </div>`;
  document.body.classList.add('print-req');
  const done = () => { document.body.classList.remove('print-req'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(done, 500); }, 50);
}



/* ═════════ 여기가 우리집(업체)에 단가 받기: 보내기 링크 → 업체가 단가 입력 → 회신 링크로 반영 ═════════ */
const LS_VENDOR = 'bath-vendor-name';
const vendorName = () => { try { return localStorage.getItem(LS_VENDOR) || '여기가 우리집'; } catch (e) { return '여기가 우리집'; } };
// 지난 단가 대비 ▲▼ (l.prev = 업체 견적 반영 전 단가)
function diffHtml(l) {
  if (!l || l.prev === undefined || l.prev === null || !l.n) return '';
  const cur = l._p !== undefined ? l._p : linePrice(l);
  if (cur === '' || cur == null) return '';
  if (l.prev === '') return '<span class="pd pd-new">신규</span>';
  const d = Number(cur) - Number(l.prev);
  if (!d) return '<span class="pd pd-eq">= 지난 단가</span>';
  const pct = l.prev ? ` ${Math.abs(Math.round(d / l.prev * 100))}%` : '';
  return `<span class="pd ${d > 0 ? 'pd-up' : 'pd-down'}" title="지난 단가 ${won(l.prev)}">${d > 0 ? '▲' : '▼'} ${won(Math.abs(d))}${pct}<small> (지난 ${won(l.prev)})</small></span>`;
}
function vendorStats() {
  let up = 0, down = 0, same = 0, fresh = 0, diff = 0; const items = [];
  S.lines.forEach(l => {
    if (!l.n || l.prev === undefined || l.prev === null) return;
    const cur = linePrice(l); if (cur === '') return;
    if (l.prev === '') { fresh++; items.push([l, '']); return; }
    const d = cur - l.prev; const q = l.q === '' ? 1 : l.q;
    if (d > 0) up++; else if (d < 0) down++; else same++;
    diff += d * q; items.push([l, d]);
  });
  return { up, down, same, fresh, diff, items };
}
function renderVendorBanner() {
  const el = $('#b-vendor-banner'); if (!el) return;
  if (!S.vendor) { el.innerHTML = ''; el.classList.add('hidden'); return; }
  const v = S.vendor, st = vendorStats();
  el.classList.remove('hidden');
  el.innerHTML = `<b>📥 ${esc(v.name)} 견적 반영됨</b> <small>${esc(new Date(v.at).toLocaleString('ko-KR'))}${v.vat ? ' · 단가 부가세 ' + esc(v.vat) : ''}</small>
    <span class="vb-stats"><span class="pd pd-up">▲ 오름 ${st.up}</span> <span class="pd pd-down">▼ 내림 ${st.down}</span> <span class="pd pd-eq">= 같음 ${st.same}</span>${st.fresh ? ` <span class="pd pd-new">신규 ${st.fresh}</span>` : ''}
    · 지난 단가 대비 <b class="${st.diff > 0 ? 'pd-up' : st.diff < 0 ? 'pd-down' : ''}">${st.diff > 0 ? '+' : ''}${won(st.diff)}원</b></span>
    ${v.memo ? `<div class="vb-memo">💬 ${esc(v.memo)}</div>` : ''}
    <button onclick="bathVendorList()">변동 보기</button>`;
}
window.bathVendorList = () => {
  const st = vendorStats();
  $('#b-modal-title').textContent = `📥 ${S.vendor ? S.vendor.name : '업체'} 견적 — 지난 단가 비교`;
  $('#b-modal-body').innerHTML = `<table class="p-table"><thead><tr><th>품명</th><th>제품명</th><th class="n">지난 단가</th><th class="n">이번 단가</th><th class="n">차이</th></tr></thead><tbody>
    ${st.items.sort((a, b) => Math.abs(b[1] || 0) - Math.abs(a[1] || 0)).map(([l, d]) => `<tr><td class="cat">${esc(lineLabel(l))}</td><td>${esc(l.n)}</td><td class="n">${l.prev === '' ? '—' : won(l.prev)}</td><td class="n"><b>${won(linePrice(l))}</b></td><td class="n">${diffHtml(l)}</td></tr>`).join('')}
    </tbody></table>
    <p class="b-hint" style="margin-top:8px">지난 단가 = 업체 견적을 넣기 전 이 견적서의 단가 (지난 주문·내 단가). 💾 저장하면 이번 단가가 「내 단가」로 기억되어 다음 비교 기준이 됩니다.</p>`;
  $('#b-modal').classList.remove('hidden');
};

async function sendToVendor() {
  const filled = S.lines.filter(l => l.n);
  if (!filled.length) { alert('견적서에 제품을 먼저 넣어 주세요.'); return; }
  if (!S.qid) S.qid = 'q' + Date.now().toString(36);
  S.lines.forEach(l => { if (l.n && !l.id) l.id = Math.random().toString(36).slice(2, 8); });
  saveDraft();
  const name = vendorName();
  const payload = { v: 1, qid: S.qid, to: name, from: S.info.shop || (typeof COMPANY !== 'undefined' ? COMPANY.name : ''), fromTel: S.info.tel || (typeof COMPANY !== 'undefined' ? COMPANY.tel : ''),
    info: { date: S.info.date, addr: S.info.addr, memo: S.info.memo, site: S.info.site },
    lines: filled.map(l => ({ id: l.id, no: l.no, nm: l.extra ? '' : lineLabel(l), n: l.n, spec: l.spec || '', q: l.q, memo: l.memo || '' })) };   // 단가는 넣지 않음
  const url = new URL('bath-quote.html', location.href).href.split('#')[0] + '#q=' + await packQuote(payload);
  const text = `[${payload.from}] 욕실 자재 견적 요청드립니다${S.info.addr ? ' (' + S.info.addr + ')' : ''}. 단가를 넣어서 보내주세요.\n${url}`;
  $('#b-modal-title').textContent = `📤 ${name}에 단가 요청 보내기`;
  $('#b-modal-body').innerHTML = `
    <p class="b-hint">제품명·규격·수량·비고만 보내고 <b>단가는 보내지 않아요</b>. 받은 분이 링크를 열어 단가를 넣고 「보내기」를 누르면, 돌아온 링크를 열었을 때 이 견적서에 단가가 들어가고 지난 단가와 비교해 ▲▼로 표시됩니다.</p>
    <label class="vd-name">받는 곳 <input type="text" id="vd-name" value="${esc(name)}"></label>
    <div class="q-list" style="margin:10px 0">
      <div class="q-item"><div class="t"><b>${filled.length}품목</b><small>${esc(S.info.addr || '')}</small></div>
        <button class="go" id="vd-sms">💬 문자</button>${navigator.share ? '<button id="vd-share">📤 카톡 등 공유</button>' : ''}<button id="vd-copy">📋 링크 복사</button><a class="vd-open" href="${esc(url)}" target="_blank" rel="noopener">미리보기</a></div>
    </div>
    <div id="vd-msg" class="b-hint"></div>`;
  $('#b-modal').classList.remove('hidden');
  $('#vd-name').oninput = e => { try { localStorage.setItem(LS_VENDOR, e.target.value.trim()); } catch (er) {} };
  $('#vd-sms').onclick = () => { location.href = `sms:?&body=${encodeURIComponent(text)}`; };
  if ($('#vd-share')) $('#vd-share').onclick = async () => { try { await navigator.share({ title: '욕실 자재 견적 요청', text: text.replace(url, '').trim(), url }); } catch (e) {} };
  $('#vd-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(text); $('#vd-msg').textContent = '✅ 복사했어요 — 카톡·문자에 붙여넣어 보내세요.'; }
    catch (e) { $('#vd-msg').textContent = url; }
  };
}

async function receiveVendor(code) {
  let r;
  try { r = await unpackQuote(code); } catch (e) { alert('업체 회신 링크가 잘렸거나 맞지 않아요.'); return; }
  const clear = () => { try { history.replaceState(null, '', location.pathname + '#form'); } catch (e) {} };
  // 같은 견적이 지금 열려 있지 않으면 저장된 견적에서 찾아 열기
  let note = '';
  if (r.qid && S.qid !== r.qid) {
    const rec = store.get(LS_QUOTES, []).find(x => x.S && x.S.qid === r.qid);
    if (rec) { S = migrate(JSON.parse(JSON.stringify(rec.S))); curId = rec.id; saveDraft(); renderAll(); note = `저장된 견적 「${esc(rec.site || '')}」을 열었어요. `; }
    else note = '⚠ 이 회신을 보낸 견적을 이 브라우저에서 찾지 못해서, 제품명이 같은 칸에 넣어요. ';
  }
  const n = (r.lines || []).filter(x => x.p !== '' && x.p != null).length;
  $('#b-modal-title').textContent = `📥 ${r.from || '업체'} 견적 도착`;
  $('#b-modal-body').innerHTML = `<p>${note}단가 <b>${n}개</b>를 이 견적서에 넣을까요?${r.vat ? ` <small>(부가세 ${esc(r.vat)})</small>` : ''}</p>
    ${r.memo ? `<p class="b-hint">💬 ${esc(r.memo)}</p>` : ''}
    <div class="q-list"><div class="q-item"><div class="t"></div><button id="vr-no">취소</button><button class="go" id="vr-go">단가 넣기</button></div></div>`;
  $('#b-modal').classList.remove('hidden');
  $('#vr-no').onclick = () => { clear(); closeModal(); };
  $('#vr-go').onclick = () => {
    UNDO = JSON.stringify(S);
    let hit = 0;
    (r.lines || []).forEach(x => {
      if (x.p === '' || x.p == null) return;
      const l = S.lines.find(y => y.id && y.id === x.id) || S.lines.find(y => y.n && key(y.n) === key(x.n));
      if (!l) return;
      if (l.prev === undefined || l.prev === null) l.prev = linePrice(l) === '' ? (priceOf(find(l.n)) ?? '') : linePrice(l);
      const p = Number(x.p);
      if (isSet(l.n)) l.vp = p; else { l.p = p; l.vp = p; }
      hit++;
    });
    S.vendor = { name: r.from || vendorName(), at: r.at || new Date().toISOString(), vat: r.vat || '', memo: r.memo || '', n: hit };
    saveDraft(); clear(); renderAll(); closeModal(); showTab('form');
    window.bathVendorList();
  };
}

/* ═════════ 사진·붙여넣기로 채우기 (bath-photo.js 가 씀) ═════════ */
const normName = t => String(t || '').replace(/[\s/·]/g, '').toLowerCase();
const toQty = v => { if (v === '' || v == null) return ''; const m = String(v).replace(/,/g, '').match(/\d+(\.\d+)?/); return m ? Number(m[0]) : ''; };
let UNDO = null;
function applyFill(data) {
  if (!data || typeof data !== 'object') throw new Error('내용이 비어 있어요');
  UNDO = JSON.stringify(S);
  const res = { bath: 0, req: 0, noPrice: [], skipped: [] };
  const info = data.info || {};
  if (info.date && /^\d{4}-\d{2}-\d{2}$/.test(info.date)) S.info.date = info.date;
  ['shop', 'tel', 'addr', 'site', 'memo'].forEach(k => { if (info[k]) S.info[k] = String(info[k]); });
  (data.lines || []).forEach(it => {
    if (!it || !(it.n || it.raw)) return;
    const no = Number(it.no);
    const grp = S.lines.map((l, i) => [l, i]).filter(([l]) => l.no === no);
    if (!grp.length) { res.skipped.push(it.raw || it.n); return; }
    let hit = grp.find(([l]) => !l.n && !l.extra && (!l.sub || normName(l.name) === normName(it.name)))
           || grp.find(([l]) => !l.n && l.extra);
    let idx;
    if (hit) idx = hit[1];
    else {   // 같은 번호에 줄 추가
      const last = grp[grp.length - 1], base = grp.find(([l]) => !l.sub || normName(l.name) === normName(it.name)) || grp[0];
      idx = last[1] + 1;
      S.lines.splice(idx, 0, Object.assign(newLine({ no, row: base[0].row, name: base[0].name, c: base[0].c, sub: base[0].sub, extra: 1 }), { extra: 1 }));
    }
    const l = S.lines[idx], cat = find(it.n || '');
    l.n = cat ? cat.n : String(it.n || it.raw);
    l.raw = it.raw ? String(it.raw) : '';
    l.p = cat ? priceOf(cat) : (it.p != null && it.p !== '' ? toQty(it.p) : '');
    l.spec = it.spec ? String(it.spec) : (cat ? sizeOf(cat.n) : '');
    l.q = toQty(it.q);
    l.memo = it.memo ? String(it.memo) : '';
    if (!isSet(l.n) && l.p === '') res.noPrice.push(l.n);
    res.bath++;
  });
  (data.rows || []).forEach(it => {
    if (!it || !(it.n || it.raw)) return;
    let i = S.req.findIndex(r => !r.n && !r.who && !r.place);
    if (i < 0) { S.req.push(newReq()); i = S.req.length - 1; }
    const r = S.req[i];
    const n = String(it.n || it.raw), spec = String(it.spec || '');
    const cat = REQ_BYKEY.get(rkey(n, spec)) || REQ_ITEMS.find(x => key(x.n) === key(n) && (!spec || key(x.spec) === key(spec))) || null;
    Object.assign(r, { d: String(it.d || ''), who: String(it.who || ''), place: String(it.place || ''), n: cat ? cat.n : n, spec: cat ? cat.spec : spec,
      u: String(it.u || (cat ? cat.u : '')), q: toQty(it.q), p: cat ? cat.p : '', v: cat ? cat.v : '', memo: String(it.memo || ''), raw: it.raw ? String(it.raw) : '' });
    if (r.p === '') res.noPrice.push(r.n);
    res.req++;
  });
  ensureReq(S); saveDraft(); renderAll();
  return res;
}
function undoFill() { if (!UNDO) return false; S = JSON.parse(UNDO); UNDO = null; saveDraft(); renderAll(); return true; }
window.BATH = {
  applyFill, undoFill, showTab,
  get state() { return S; },
  lines: () => BATH_LINES.map(l => ({ no: l.no, name: l.sub ? l.name : l.name, group: l.row || '', sub: !!l.sub })),
  catalog: () => ITEMS.filter(x => !x.mine).map(x => [x.c, x.n]),
  reqCatalog: () => REQ_ITEMS.slice(0, 400).map(x => [x.n, x.spec, x.u]),
};

/* ───────── 탭 / 시작 ───────── */
function showTab(t) {
  document.querySelectorAll('.b-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  ['form', 'req', 'order', 'prices'].forEach(x => $('#tab-' + x).classList.toggle('hidden', x !== t));
  closeAC();
  $('#b-total-bar').classList.toggle('hidden', t === 'prices');
  if (t === 'prices') renderPrices();
  try { if (!/^#(fill|reply)=/.test(location.hash)) history.replaceState(null, '', '#' + t); } catch (e) {}
}
function renderAll() { buildReqCatalog(); renderVendorBanner(); renderInfo(); ['site', 'addr', 'date'].forEach(syncInfo); renderLines(); renderReq(); renderOrder(); }

buildCatalog();
// 저장된 견적이 예전 줄 구성이면 빠진 줄을 채움
if (!Array.isArray(S.lines) || !S.lines.length) S = blankState();
document.querySelectorAll('.b-tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
$('#b-addline').onclick = () => { const i27 = S.lines.map(l => l.no).lastIndexOf(27); bathAddUnder(i27 >= 0 ? i27 : S.lines.length - 1); };
$('#b-save').onclick = saveQuote;
$('#b-load').onclick = openLoad;
$('#b-new').onclick = newQuote;
$('#b-copy').onclick = () => copyOrder('bath');
$('#b-copy-req').onclick = () => copyOrder('req');
$('#b-req-print-blank').onclick = () => printReq(true);
$('#b-req-print').onclick = () => printReq(false);
$('#b-req-add').onclick = () => { for (let k = 0; k < 5; k++) S.req.push(newReq()); saveDraft(); renderReq(); };
$('#b-req-clear').onclick = () => { if (!S.req.some(r => r.n) || confirm('현장 요청 내용을 모두 지울까요?')) { S.req = []; ensureReq(S); saveDraft(); renderReq(); renderTotals(); renderOrder(); } };
document.querySelectorAll('[data-info]').forEach(el => { el.addEventListener('input', () => { S.info[el.dataset.info] = el.value; saveDraft(); renderOrder(); const main = document.getElementById(INFO[el.dataset.info]); if (main) main.value = el.value; syncInfo(el.dataset.info); }); });
$('#b-places').innerHTML = PLACES.map(p => `<option value="${p}">`).join('');
$('#b-xlsx').onclick = downloadXlsx;
$('#b-print').onclick = () => { showTab('order'); setTimeout(() => window.print(), 50); };
$('#b-backup').onclick = backup;
$('#b-restore').onclick = () => $('#b-restore-file').click();
$('#b-restore-file').onchange = e => { if (e.target.files[0]) restore(e.target.files[0]); e.target.value = ''; };
const catSel = $('#p-cat');
BATH_CATS.forEach(c => catSel.insertAdjacentHTML('beforeend', `<option>${esc(c)}</option>`));
$('#p-q').oninput = () => { pLimit = 120; renderPrices(); };
catSel.onchange = () => { pLimit = 120; renderPrices(); };
$('#p-total').textContent = `${BATH_ITEMS.reduce((s, x) => s + (x.h ? x.h.length : 0), 0)}건 (자재 ${BATH_ITEMS.filter(x => x.h).length}종)`;
renderAll();
const start = (location.hash || '').slice(1);
$('#b-send-vendor').onclick = sendToVendor;
if (start.startsWith('reply=')) receiveVendor(start.slice(6));
showTab(['form', 'req', 'order', 'prices'].includes(start) ? start : 'form');
})();
