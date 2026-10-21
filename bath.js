/**
 * bath.js — 욕실 자재 견적서 → 자재 주문서
 *
 *  · 견적서 줄마다 제품명을 고르면 지난 주문 단가(bath-data.js)가 들어갑니다.
 *  · 세트(BATH_SETS)는 자재 주문서에서 구성품으로 풀어 씁니다.
 *  · 저장한 견적과 「내 단가」(새로 넣은 단가)는 이 브라우저(localStorage)에만 저장됩니다.
 */
(function () {
'use strict';

const LS_DRAFT = 'bath-draft-v1', LS_QUOTES = 'bath-quotes-v1', LS_MY = 'bath-my-prices-v1';
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
function blankState() {
  return {
    info: { date: today(), site: '', tel: '', addr: '', memo: '' },
    lines: BATH_LINES.map(l => ({ no: l.no, name: l.name, c: l.c, n: '', q: '', p: '', memo: '', st: '' })),
  };
}
let S = store.get(LS_DRAFT, null) || blankState();
let curId = store.get(LS_DRAFT + '-id', null);

function saveDraft() { store.set(LS_DRAFT, S); store.set(LS_DRAFT + '-id', curId); }

/* ───────── 견적서 화면 ───────── */
const INFO = { date: 'i-date', site: 'i-site', tel: 'i-tel', addr: 'i-addr', memo: 'i-memo' };
function renderInfo() {
  for (const [k, id] of Object.entries(INFO)) {
    const el = document.getElementById(id); el.value = S.info[k] || '';
    el.oninput = () => { S.info[k] = el.value; saveDraft(); renderOrder(); };
  }
}

function lineStatus(l) {
  if (!l.n) return ['', ''];
  if (isSet(l.n)) return l.q === '' ? ['수량 미입력', 'warn'] : ['세트', 'set'];
  if (l.p === '') return ['⚠ 단가 없음', 'bad'];
  if (l.q === '') return ['수량 미입력', 'warn'];
  return ['', ''];
}
function lineAmount(l) {
  if (!l.n || l.q === '') return '';
  const p = isSet(l.n) ? setPrice(find(l.n)?.n || l.n) : l.p;
  return p === '' ? '' : l.q * p;
}
function metaHtml(l, i) {
  const it = l.n ? find(l.n) : null;
  if (!it) return l.n ? '<span>목록에 없는 제품 — 단가를 넣고 저장하면 「내 단가」로 기억합니다</span>' : '';
  if (isSet(it.n)) return `<span>구성: ${esc(BATH_SETS[it.n].map(([c, q]) => c.split(/[\[(]/)[0].trim() + (q > 1 ? ' ×' + q : '')).join(' · '))}</span>`;
  const bits = [];
  if (it.my) bits.push(`내 단가 ${won(it.my.p)}`);
  if (it.k || (it.h && it.h.length)) {
    bits.push(`지난 주문 ${it.h.length}회` + (it.lo !== it.hi ? ` · ${won(it.lo)}~${won(it.hi)}` : ` · ${won(it.p)}`) + (it.s ? ` · 최근 ${esc(it.s)}` : ''));
  }
  const cur = priceOf(it);
  const diff = (l.p !== '' && cur !== '' && Number(l.p) !== Number(cur)) ? ` <button onclick="bathUsePrice(${i})">최근 ${won(cur)}로</button>` : '';
  return `<span>${bits.join(' / ')}</span>${diff}${it.h && it.h.length ? ` <button onclick="bathHistory(${i})">📈 이력</button>` : ''}`;
}

function renderLines() {
  const host = $('#b-lines');
  let prevNo = null;
  host.innerHTML = S.lines.map((l, i) => {
    const [st, cls] = lineStatus(l);
    const grp = l.no !== prevNo; prevNo = l.no;
    const set = isSet(l.n);
    const sub = l.c && l.c !== '전체' ? `<small>${esc(l.c)}</small>` : '';
    return `<div class="b-line${grp ? ' grp-start' : ''}${l.n ? ' filled' : ''}" data-i="${i}">
      <span class="no">${grp ? l.no : ''}</span>
      <span class="nm">${esc(l.name)}${sub}</span>
      <div class="prod"><input type="text" class="in-n" value="${esc(l.n)}" placeholder="제품 검색 / 입력" autocomplete="off" aria-label="${esc(l.name)} 제품명">
        <div class="meta">${metaHtml(l, i)}</div></div>
      <div class="q"><input type="text" inputmode="decimal" class="in-q" value="${esc(l.q)}" aria-label="수량"></div>
      <div class="pr"><input type="text" inputmode="numeric" class="in-p${l.n && !set && l.p === '' ? ' noprice' : ''}" value="${set ? won(setPrice(find(l.n).n)) : won(l.p)}" ${set ? 'readonly title="세트 단가는 구성품 단가의 합입니다"' : ''} aria-label="단가"></div>
      <span class="amt">${won(lineAmount(l))}</span>
      <div class="memo"><input type="text" class="in-m" value="${esc(l.memo)}" placeholder="비고" aria-label="비고"></div>
      <div class="ost"><select class="in-st" aria-label="주문상태">${['', '주문', '재고', '직송', '현장구매', '고객준비'].map(o => `<option${o === l.st ? ' selected' : ''}>${o}</option>`).join('')}</select>
        <div class="st ${cls}">${st}</div></div>
      <button class="del" title="${l.extra ? '줄 삭제' : '내용 지우기'}" aria-label="지우기">✕</button>
    </div>`;
  }).join('');
  host.querySelectorAll('.b-line').forEach(row => wireLine(row, Number(row.dataset.i)));
  renderTotals();
}

function refreshLine(i) {
  const row = $(`.b-line[data-i="${i}"]`); if (!row) return;
  const l = S.lines[i], [st, cls] = lineStatus(l), set = isSet(l.n);
  row.classList.toggle('filled', !!l.n);
  row.querySelector('.meta').innerHTML = metaHtml(l, i);
  row.querySelector('.amt').textContent = won(lineAmount(l));
  const pe = row.querySelector('.in-p');
  if (document.activeElement !== pe) pe.value = set ? won(setPrice(find(l.n).n)) : won(l.p);
  pe.readOnly = set;
  pe.classList.toggle('noprice', !!(l.n && !set && l.p === ''));
  const se = row.querySelector('.st'); se.textContent = st; se.className = 'st ' + cls;
  renderTotals();
}

function wireLine(row, i) {
  const l = S.lines[i];
  const n = row.querySelector('.in-n'), q = row.querySelector('.in-q'), p = row.querySelector('.in-p');
  n.addEventListener('focus', () => openAC(n, i));
  n.addEventListener('input', () => {
    const was = find(l.n); l.n = n.value; const it = find(l.n);
    if (it) l.p = priceOf(it); else if (was) l.p = '';   // 목록 제품에서 다른 이름으로 바꾸면 단가 비움
    changed(i); openAC(n, i);
  });
  n.addEventListener('keydown', e => acKey(e, n, i));
  n.addEventListener('blur', () => setTimeout(() => { if (AC.input === n) closeAC(); }, 160));
  q.addEventListener('input', () => { l.q = parseNum(q.value); changed(i); });
  p.addEventListener('input', () => { if (!p.readOnly) { l.p = parseNum(p.value); changed(i); } });
  p.addEventListener('blur', () => { if (!p.readOnly) p.value = won(l.p); });
  row.querySelector('.in-m').addEventListener('input', e => { l.memo = e.target.value; saveDraft(); renderOrder(); });
  row.querySelector('.in-st').addEventListener('change', e => { l.st = e.target.value; saveDraft(); renderOrder(); });
  row.querySelector('.del').addEventListener('click', () => {
    if (l.extra) S.lines.splice(i, 1); else Object.assign(l, { n: '', q: '', p: '', memo: '', st: '' });
    saveDraft(); renderLines(); renderOrder();
  });
}
function changed(i) { saveDraft(); refreshLine(i); renderOrder(); }
window.bathUsePrice = i => { const l = S.lines[i]; l.p = priceOf(find(l.n)); changed(i); };
window.bathHistory = i => showHistory(find(S.lines[i].n));

function renderTotals() {
  let sum = 0, miss = 0;
  S.lines.forEach(l => { const a = lineAmount(l); if (a !== '') sum += a; else if (l.n && lineStatus(l)[1] === 'bad') miss++; });
  $('#b-total').textContent = won(sum) + '원';
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
  AC.input = input; AC.i = i; AC.list = [...same, ...other]; AC.sel = 0;
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
function pickAC(k) {
  const x = AC.list[k]; if (!x) return;
  const i = AC.i, l = S.lines[i], input = AC.input;
  l.n = x.n; l.p = priceOf(x);
  input.value = x.n;
  closeAC(); changed(i);
  const q = $(`.b-line[data-i="${i}"] .in-q`); if (q) q.focus();
}
function acKey(e, input, i) {
  const box = $('#b-ac');
  if (box.classList.contains('hidden')) { if (e.key === 'ArrowDown') openAC(input, i); return; }
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
    if (it && BATH_SETS[it.n]) {
      BATH_SETS[it.n].forEach(([c, cq], k) => {
        const ci = find(c);
        rows.push({ cat: it.c, label: k === 0 ? l.name : '', n: c, q: l.q === '' ? '' : l.q * cq, p: priceOf(ci), memo: k === 0 ? l.memo : '', st: l.st });
      });
    } else {
      rows.push({ cat: it ? it.c : (l.c === '전체' ? '' : l.c), label: l.name, n: l.n, q: l.q, p: l.p, memo: l.memo, st: l.st });
    }
  });
  let run = 0;
  rows.forEach(r => { r.amt = (r.q === '' || r.p === '') ? '' : r.q * r.p; if (r.amt !== '') run += r.amt; r.run = r.amt === '' ? '' : run; });
  return { rows, total: run };
}
function addrText() { return [S.info.addr, S.info.memo].filter(Boolean).join('\n'); }
function renderOrder() {
  const { rows, total } = orderRows();
  $('#b-order-count').textContent = rows.length || '';
  const body = rows.length ? rows.map(r => `<tr>
      <td class="c">${esc(r.cat)}</td><td>${esc(r.label)}</td><td class="prod">${esc(r.n)}</td>
      <td class="n${r.q === '' ? ' noq' : ''}">${esc(r.q)}</td><td class="n${r.p === '' ? ' miss' : ''}">${won(r.p)}</td><td class="n">${won(r.amt)}</td>
      <td>${esc(r.memo)}</td><td class="n">${won(r.run)}</td><td class="c">${esc(r.st)}</td></tr>`).join('')
    : '<tr class="empty"><td colspan="9">견적서에 제품을 넣으면 여기에 주문서가 만들어집니다</td></tr>';
  $('#b-order').innerHTML = `<table class="x-sheet">
    <colgroup><col style="width:9%"><col style="width:11%"><col><col style="width:5%"><col style="width:8%"><col style="width:9%"><col style="width:12%"><col style="width:9%"><col style="width:7%"></colgroup>
    <tr><td class="x-site">${esc(S.info.site || '현장명')}</td><td class="x-addr" colspan="3">${esc(addrText())}</td><td class="c"><b>합계</b></td><td class="x-sum">${won(total)}</td><td colspan="3">${esc(S.info.date || '')}${S.info.tel ? ' · ' + esc(S.info.tel) : ''}</td></tr>
    <tr><th>구분</th><th>내용</th><th>제품명 및 사이즈</th><th>수량</th><th>원가</th><th>총 가격</th><th>비고</th><th>누계</th><th>주문상태</th></tr>
    ${body}
    <tr><td colspan="5" class="c"><b>합계</b></td><td class="x-sum">${won(total)}</td><td colspan="3"></td></tr>
  </table>`;
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
async function copyOrder() {
  const t = orderTSV(), msg = $('#b-copy-msg');
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

  // 견적서 시트도 같이
  const we = wb.addWorksheet('견적서');
  we.columns = [5, 18, 60, 7, 11, 12, 18, 9].map(width => ({ width }));
  we.addRow(['견적서']).font = { size: 16, bold: true };
  we.addRow(['일자', S.info.date, '현장명: ' + (S.info.site || ''), '', '', '', '전화: ' + (S.info.tel || '')]);
  we.addRow(['주소', S.info.addr]); we.addRow(['메모', S.info.memo]); we.addRow([]);
  const eh = we.addRow(['No', '품명', '제품명', '수량', '단가', '금액', '비고', '주문상태']);
  eh.eachCell(c => { c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }; c.border = box; });
  S.lines.filter(l => l.n).forEach(l => {
    const set = isSet(l.n), p = set ? setPrice(find(l.n).n) : l.p, a = lineAmount(l);
    const row = we.addRow([l.no, l.name, l.n, l.q === '' ? null : l.q, p === '' ? null : p, a === '' ? null : a, l.memo, l.st]);
    row.eachCell({ includeEmpty: true }, (c, j) => { c.border = box; if ([4, 5, 6].includes(j)) c.numFmt = '#,##0'; });
  });
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
  buildCatalog(); closeModal(); renderLines(); renderOrder(); renderPrices();
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
  buildCatalog(); saveDraft(); renderLines();
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
    const x = list.find(y => y.id === b.dataset.go); S = JSON.parse(JSON.stringify(x.S)); curId = x.id;
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

/* ───────── 탭 / 시작 ───────── */
function showTab(t) {
  document.querySelectorAll('.b-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  ['form', 'order', 'prices'].forEach(x => $('#tab-' + x).classList.toggle('hidden', x !== t));
  closeAC();
  $('#b-total-bar').classList.toggle('hidden', t === 'prices');
  if (t === 'prices') renderPrices();
  try { history.replaceState(null, '', '#' + t); } catch (e) {}
}
function renderAll() { renderInfo(); renderLines(); renderOrder(); }

buildCatalog();
// 저장된 견적이 예전 줄 구성이면 빠진 줄을 채움
if (!Array.isArray(S.lines) || !S.lines.length) S = blankState();
document.querySelectorAll('.b-tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
$('#b-addline').onclick = () => { S.lines.push({ no: 27, name: '기타', c: '전체', n: '', q: '', p: '', memo: '', st: '', extra: true }); saveDraft(); renderLines(); const ins = document.querySelectorAll('.in-n'); ins[ins.length - 1].focus(); };
$('#b-save').onclick = saveQuote;
$('#b-load').onclick = openLoad;
$('#b-new').onclick = newQuote;
$('#b-copy').onclick = copyOrder;
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
showTab(['form', 'order', 'prices'].includes(start) ? start : 'form');
})();
