// 📊 엑셀로 편집 — 지금 견적서를 진짜 스프레드시트(Jspreadsheet CE, MIT)로 열어 고치고 「적용」하면 견적서에 반영
//  열: 품명 | 항목 | 내용 | 견적가 | 원가 | 상세내역 | 적용 | 메모 | (숨김 id)
//  · 품명 칸 병합 = 공정 하나, 견적가 칸 병합 = 통비용 한 칸 (병합 해제 → 줄마다 따로 금액)
//  · 견적가·원가 칸에 수식(=1200000*1.1, =SUM(D3:D5) 등) 가능 — 계산된 값이 들어감
//  · 견적가 칸이 비어 있고 병합도 아니면 → 윗칸 통비용에 포함 (공정 첫 줄은 0원)
//  · 품명 칸에 「선택 옵션」이라고 적힌 아래 줄들은 선택 옵션
const XLS_LIB = [
  ['css', 'https://cdn.jsdelivr.net/npm/jsuites@5.0.25/dist/jsuites.css'],
  ['css', 'https://cdn.jsdelivr.net/npm/jspreadsheet-ce@4.13.4/dist/jspreadsheet.css'],
  ['js', 'https://cdn.jsdelivr.net/npm/jsuites@5.0.25/dist/jsuites.js'],
  ['js', 'https://cdn.jsdelivr.net/npm/jspreadsheet-ce@4.13.4/dist/index.js'],
];
const XLS_OPT = '선택 옵션';
let xlsWs = null, xlsLibP = null;

function xlsLoadLib() {
  if (window.jspreadsheet) return Promise.resolve();
  if (xlsLibP) return xlsLibP;
  xlsLibP = XLS_LIB.reduce((p, [t, url]) => p.then(() => new Promise((ok, no) => {
    const el = document.createElement(t === 'css' ? 'link' : 'script');
    if (t === 'css') { el.rel = 'stylesheet'; el.href = url; } else { el.src = url; }
    el.onload = ok; el.onerror = () => no(new Error(url));
    document.head.appendChild(el);
  })), Promise.resolve()).catch(e => { xlsLibP = null; throw e; });
  return xlsLibP;
}
const xlsCell = (x, y) => String.fromCharCode(65 + x) + (y + 1);
const xlsNum = v => {
  if (v == null) return null;
  const t = String(v).replace(/<[^>]*>/g, '').replace(/[^0-9.\-]/g, '');
  if (t === '' || t === '-' || t === '.') return null;
  const n = Number(t); return isFinite(n) ? Math.round(n) : null;
};

// 견적서 → 시트
function xlsBuild() {
  const data = [], merges = {}, style = {};
  const PROC_BG = '#eef2f7', PRICE_BG = '#fff8d6', INT_BG = '#fdf3e1';
  const push = (row, kind) => {
    const y = data.length; data.push(row);
    style[xlsCell(0, y)] = `background-color:${kind === 'o' ? '#f3f4f6' : PROC_BG};font-weight:bold;text-align:center;`;
    style[xlsCell(3, y)] = `background-color:${PRICE_BG};font-weight:bold;color:#1d4ed8;`;
    style[xlsCell(4, y)] = `background-color:${INT_BG};color:#1d4ed8;`;
    style[xlsCell(5, y)] = `background-color:${INT_BG};`;
    style[xlsCell(6, y)] = 'text-align:center;font-weight:bold;';
    return y;
  };
  tplState.blocks.forEach((b, bi) => {
    const span = xsGroupSpans(b), y0 = data.length;
    b.items.forEach((i, ii) => {
      const y = push([ii === 0 ? b.proc : '', i.n || '', i.d || '', i.p == null ? '' : (Number(i.p) || 0), i.c == null ? '' : Number(i.c),
        i.m || '', i.on ? 'O' : 'X', i.note || '', `b:${bi}:${ii}`], 'b');
      if (span[ii] > 1) merges[xlsCell(3, y)] = [1, span[ii]];
    });
    if (b.items.length > 1) merges[xlsCell(0, y0)] = [1, b.items.length];
  });
  const oy = data.length;
  (tplState.options.length ? tplState.options : [{ n: '', d: '', p: 0, on: false }]).forEach((o, oi) => {
    push([oi === 0 ? XLS_OPT : '', o.n || '', o.d || '', Number(o.p) || 0, o.c == null ? '' : Number(o.c), o.m || '', o.on ? 'O' : 'X', o.note || '',
      tplState.options.length ? `o:${oi}` : ''], 'o');
  });
  if (data.length - oy > 1) merges[xlsCell(0, oy)] = [1, data.length - oy];
  return { data, merges, style };
}

// 시트 → 견적서
function xlsParse(ws) {
  const raw = ws.getData(), rows = raw.length;
  const merges = ws.getMerge() || {};
  const dCovered = new Set();
  Object.entries(merges).forEach(([name, [cs, rs]]) => {
    const x = name.charCodeAt(0) - 65, y = Number(name.slice(1)) - 1;
    if (x <= 3 && 3 < x + cs) for (let k = 1; k < rs; k++) dCovered.add(y + k);
  });
  // 글자는 원래 값, 수식(=…)만 계산된 값 (계산 값은 병합으로 가려진 칸에도 위 칸 값이 나와서 쓰면 안 됨)
  const val = (x, y) => {
    let v = raw[y]?.[x];
    if (typeof v === 'string' && v.trim().startsWith('=')) v = ws.getValueFromCoords(x, y, true);
    return v == null ? '' : String(v).replace(/<[^>]*>/g, '').trim();
  };
  const blocks = [], options = [];
  let mode = null, cur = null;
  for (let y = 0; y < rows; y++) {
    const A = val(0, y);
    if (A) {
      if (A.replace(/\s/g, '') === XLS_OPT.replace(/\s/g, '')) mode = 'o';
      else {
        mode = 'b';
        const id = String(raw[y][8] || ''), m = id.match(/^b:(\d+):/);
        const ob = m ? tplState.blocks[+m[1]] : tplState.blocks.find(b => b.proc === A);
        cur = { ...(ob ? JSON.parse(JSON.stringify(ob)) : { range: '', freq: '' }), proc: A, items: [] };
        blocks.push(cur);
      }
    }
    const B = val(1, y), C = val(2, y), D = xlsNum(val(3, y)), E = xlsNum(val(4, y)), F = val(5, y), G = val(6, y).toUpperCase(), H = val(7, y);
    const id = String(raw[y][8] || '');
    if (!B && !C && D == null && E == null && !F && !H && !id && !A) continue; // 빈 줄
    if (mode === null) { mode = 'b'; cur = { proc: '기타', range: '', freq: '', items: [] }; blocks.push(cur); }
    let base = null, m;
    if ((m = id.match(/^b:(\d+):(\d+)$/))) base = tplState.blocks[+m[1]]?.items[+m[2]];
    else if ((m = id.match(/^o:(\d+)$/))) base = tplState.options[+m[1]];
    const it = base ? JSON.parse(JSON.stringify(base)) : { f: '' };
    Object.assign(it, { n: B, d: C, c: E, m: F, note: H });
    if (mode === 'o') {
      Object.assign(it, { p: D || 0, on: G === 'O' });
      if (!B && !C && !D) continue;
      options.push(it);
    } else {
      it.on = G !== 'X';
      if (dCovered.has(y)) it.p = null;
      else it.p = D != null ? D : (cur.items.length ? null : 0);
      cur.items.push(it);
    }
  }
  return { blocks: blocks.filter(b => b.items.length), options };
}

// 위쪽 합계 표시
function xlsSummary() {
  if (!xlsWs) return;
  try {
    const r = xlsParse(xlsWs);
    let price = 0, cost = 0, opt = 0;
    r.blocks.forEach(b => b.items.forEach(i => { if (i.on) { price += Number(i.p) || 0; cost += Number(i.c) || 0; } }));
    r.options.forEach(o => { if (o.on) opt += Number(o.p) || 0; });
    const mg = price - cost;
    document.getElementById('xls-sum').innerHTML = `기본 공사 <b>${fmt(price)}</b>원 · 원가 ${fmt(cost)}원 · 마진 <b class="${mg < 0 ? 'neg' : ''}">${fmt(mg)}</b>원${price ? ` (${Math.round(mg / price * 100)}%)` : ''}${opt ? ` · 선택 옵션 ${fmt(opt)}원` : ''} <small>(관리비·부가세 별도)</small>`;
  } catch (e) { /* 편집 중 일시 오류 무시 */ }
}

// 위쪽 버튼을 누르는 순간 시트가 선택을 풀어 버리므로, 마지막으로 고른 범위를 따로 기억
let xlsLastSel = null;
function xlsSel() { // [x1,y1,x2,y2]
  const s = (xlsWs?.selectedCell?.length === 4 ? xlsWs.selectedCell : null) || xlsLastSel; if (!s) return null;
  const [a, b, c, d] = s.map(Number);
  return [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)];
}
function xlsAct(act) {
  if (!xlsWs) return;
  const s = xlsSel();
  if (act === 'undo') return xlsWs.undo();
  if (act === 'redo') return xlsWs.redo();
  if (!s) { showToast('먼저 칸을 고르세요'); return; }
  const [x1, y1, x2, y2] = s;
  if (act === 'merge') {
    if (x1 === x2 && y1 === y2) { showToast('합칠 칸을 두 칸 이상 끌어서 고르세요'); return; }
    // 견적가 칸을 합치면 → 금액을 더해서 첫 칸에
    if (x1 === 3 && x2 === 3) {
      let sum = 0; for (let y = y1; y <= y2; y++) { const r = xlsWs.getValueFromCoords(3, y); sum += xlsNum(String(r).trim().startsWith('=') ? xlsWs.getValueFromCoords(3, y, true) : r) || 0; }
      xlsUnmergeIn(x1, y1, x2, y2);
      xlsWs.setValueFromCoords(3, y1, sum);
      for (let y = y1 + 1; y <= y2; y++) xlsWs.setValueFromCoords(3, y, '');
    } else xlsUnmergeIn(x1, y1, x2, y2);
    xlsWs.setMerge(xlsCell(x1, y1), x2 - x1 + 1, y2 - y1 + 1);
  } else if (act === 'unmerge') {
    if (!xlsUnmergeIn(x1, y1, x2, y2)) showToast('고른 칸에 합쳐진 칸이 없어요');
  } else if (act === 'above') xlsWs.insertRow(1, y1, true);
  else if (act === 'below') xlsWs.insertRow(1, y2);
  else if (act === 'del') xlsWs.deleteRow(y1, y2 - y1 + 1);
  xlsSummary();
}
function xlsUnmergeIn(x1, y1, x2, y2) {
  let n = 0;
  Object.entries(xlsWs.getMerge() || {}).forEach(([name, [cs, rs]]) => {
    const x = name.charCodeAt(0) - 65, y = Number(name.slice(1)) - 1;
    if (x <= x2 && x + cs - 1 >= x1 && y <= y2 && y + rs - 1 >= y1) { xlsWs.removeMerge(name); n++; }
  });
  return n;
}

async function openXlSheet() {
  if (!tplState) return;
  let ov = document.getElementById('xls-ov');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'xls-ov';
    ov.innerHTML = `<div class="xls-box" role="dialog" aria-label="엑셀로 편집">
      <div class="xls-top">
        <b class="xls-title">📊 엑셀로 편집</b>
        <div class="xls-tools">
          <button onclick="xlsAct('undo')" title="되돌리기 (Ctrl+Z)">↶</button><button onclick="xlsAct('redo')" title="다시 하기 (Ctrl+Y)">↷</button>
          <span class="sep"></span>
          <button onclick="xlsAct('merge')" title="고른 칸 병합 — 견적가 칸이면 금액을 더해 통비용 한 칸">⊞ 셀 병합</button>
          <button onclick="xlsAct('unmerge')" title="병합 해제 — 견적가 칸이면 줄마다 따로 금액 칸">⊟ 병합 해제</button>
          <span class="sep"></span>
          <button onclick="xlsAct('above')">⬆ 위에 행</button><button onclick="xlsAct('below')">⬇ 아래에 행</button><button onclick="xlsAct('del')" class="danger">🗑 행 삭제</button>
        </div>
        <div class="xls-btns"><button onclick="closeXlSheet()">취소</button><button class="go" onclick="applyXlSheet()">✔ 적용하고 닫기</button></div>
      </div>
      <div class="xls-sum" id="xls-sum"></div>
      <div class="xls-help">끌어서 고르기 · 칸 오른쪽 아래 점을 끌어 채우기 · 견적가·원가에 <b>=수식</b> 가능 · <b>품명 병합</b> = 공정 하나 · <b>견적가 병합</b> = 통비용 (빈 견적가 칸은 윗칸 통비용에 포함) · 품명에 「선택 옵션」 아래는 옵션 · 🔒 원가·상세내역·메모는 고객에게 안 나감</div>
      <div class="xls-wrap"><div id="xls-sheet"></div></div>
    </div>`;
    document.body.appendChild(ov);
  }
  ov.classList.add('on'); document.body.classList.add('xls-open'); xlsLastSel = null;
  ov.querySelectorAll('.xls-tools button').forEach(b => b.onmousedown = e => { e.preventDefault(); e.stopPropagation(); });
  const host = document.getElementById('xls-sheet');
  host.innerHTML = '<div class="xls-loading">엑셀 불러오는 중…</div>';
  try { await xlsLoadLib(); } catch (e) {
    host.innerHTML = '<div class="xls-loading">엑셀 프로그램을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.</div>'; return;
  }
  host.innerHTML = '';
  const { data, merges, style } = xlsBuild();
  const H = Math.max(320, window.innerHeight - 190);
  const ws = jspreadsheet(host, {
    data, mergeCells: merges, style,
    columns: [
      { type: 'text', title: '품명', width: 90, wordWrap: true },
      { type: 'text', title: '항목', width: 130, wordWrap: true },
      { type: 'text', title: '내용 (고객에게 보임)', width: 420, wordWrap: true, align: 'left' },
      { type: 'numeric', title: '견적가', width: 110, mask: '#,##0' },
      { type: 'numeric', title: '원가 🔒', width: 100, mask: '#,##0' },
      { type: 'text', title: '상세내역 🔒', width: 240, wordWrap: true, align: 'left' },
      { type: 'dropdown', title: '적용', width: 52, source: ['O', 'X'] },
      { type: 'text', title: '메모 🔒', width: 170, wordWrap: true, align: 'left' },
      { type: 'hidden', title: 'id' },
    ],
    tableOverflow: true, tableHeight: H + 'px', tableWidth: '100%',
    allowInsertColumn: false, allowDeleteColumn: false, allowRenameColumn: false, columnDrag: false,
    allowManualInsertColumn: false, columnSorting: false, rowResize: true, defaultColWidth: 100,
    minSpareRows: 0, parseFormulas: true, autoIncrement: false,
    text: { areYouSureToDeleteTheSelectedRows: '고른 행을 지울까요?', thisActionWillDestroyAnyExistingMergedCellsAreYouSure: '이 작업을 하면 걸쳐 있는 병합 칸이 풀려요. 계속할까요?', thisActionWillClearYourSearchResultsAreYouSure: '계속할까요?' },
    onchange: () => xlsSummary(), onafterchanges: () => xlsSummary(), oninsertrow: () => xlsSummary(), ondeleterow: () => xlsSummary(),
    onselection: (el, x1, y1, x2, y2) => { xlsLastSel = [x1, y1, x2, y2]; },
    onmerge: () => xlsSummary(), onundo: () => xlsSummary(), onredo: () => xlsSummary(),
    contextMenu: (obj, x, y) => {
      const items = [];
      items.push({ title: '⊞ 셀 병합', onclick: () => xlsAct('merge') });
      items.push({ title: '⊟ 병합 해제', onclick: () => xlsAct('unmerge') });
      items.push({ type: 'line' });
      items.push({ title: '⬆ 위에 행 삽입', onclick: () => xlsAct('above') });
      items.push({ title: '⬇ 아래에 행 삽입', onclick: () => xlsAct('below') });
      items.push({ title: '🗑 행 삭제', onclick: () => xlsAct('del') });
      items.push({ type: 'line' });
      items.push({ title: '↶ 되돌리기', shortcut: 'Ctrl+Z', onclick: () => xlsAct('undo') });
      items.push({ title: '↷ 다시 하기', shortcut: 'Ctrl+Y', onclick: () => xlsAct('redo') });
      items.push({ title: '📋 복사', shortcut: 'Ctrl+C', onclick: () => obj.copy(true) });
      return items;
    },
  });
  xlsWs = Array.isArray(ws) ? ws[0] : ws;
  xlsSummary();
}
function closeXlSheet() {
  document.getElementById('xls-ov')?.classList.remove('on'); document.body.classList.remove('xls-open');
  try { if (xlsWs && window.jspreadsheet?.destroy) jspreadsheet.destroy(document.getElementById('xls-sheet')); } catch (e) { /* 무시 */ }
  xlsWs = null;
}
function applyXlSheet() {
  if (!xlsWs) return;
  let r;
  try { r = xlsParse(xlsWs); } catch (e) { alert('시트를 읽지 못했어요: ' + e.message); return; }
  if (!r.blocks.length) { alert('공정이 하나도 없어요. 품명 칸에 공정 이름을 적어 주세요.'); return; }
  tplState.blocks = r.blocks; tplState.options = r.options;
  closeXlSheet(); renderTpl(); calc();
  showToast('📊 엑셀에서 고친 내용을 견적서에 적용했어요 — 되돌리려면 Ctrl+Z');
}
