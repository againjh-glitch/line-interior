// 엑셀처럼 쓰기 — 견적서 표(sheet.js) 위에 얹는 기능
//  · Ctrl+Z 되돌리기 / Ctrl+Y 다시 하기 (↶ ↷ 버튼)
//  · Enter 아래 칸, Shift+Enter 위 칸, ↑↓ 위아래 칸, Esc 입력 취소, Alt+Enter 줄바꿈
//  · 오른쪽 클릭 메뉴: 줄 삽입·복제·삭제·이동, 셀 합치기·나누기, 적용 O/X
//  · 끌어서 고른 줄: Ctrl+C 복사(엑셀에 붙여넣기 가능), Delete 견적가 지우기
//  · 엑셀에서 복사한 여러 줄·여러 칸을 그대로 Ctrl+V — 줄이 모자라면 자동으로 추가
(function () {
  // ── 되돌리기 ──────────────────────────────────────────
  const H = { past: [], future: [], last: null, key: null, lock: false };
  const snap = () => JSON.stringify(tplState);
  function record() {
    if (H.lock || !tplState) return;
    const k = tplState.key + '|' + (typeof currentQuoteKey !== 'undefined' ? currentQuoteKey : '');
    const s = snap();
    if (k !== H.key) { H.key = k; H.past = []; H.future = []; H.last = s; xlBtns(); return; } // 다른 견적 열면 새로 시작
    if (s === H.last) return;
    if (H.last) H.past.push(H.last);
    if (H.past.length > 150) H.past.shift();
    H.last = s; H.future = []; xlBtns();
  }
  function restore(s) {
    H.lock = true;
    tplState = JSON.parse(s); H.last = s;
    if (typeof xsSelClear === 'function') xsSelClear();
    renderTpl(); calc();
    H.lock = false; xlBtns();
  }
  window.xlUndo = function () {
    if (!H.past.length) { showToast('더 되돌릴 게 없어요'); return; }
    H.future.push(H.last); restore(H.past.pop()); showToast('↶ 되돌렸어요');
  };
  window.xlRedo = function () {
    if (!H.future.length) { showToast('다시 할 게 없어요'); return; }
    H.past.push(H.last); restore(H.future.pop()); showToast('↷ 다시 했어요');
  };
  function xlBtns() {
    const u = document.getElementById('xl-undo'), r = document.getElementById('xl-redo');
    if (u) u.disabled = !H.past.length;
    if (r) r.disabled = !H.future.length;
  }
  const calc0 = calc;
  calc = function () { const r = calc0.apply(this, arguments); record(); return r; };

  // 표 위 도구줄
  const render0 = renderSheet;
  renderSheet = function () {
    const r = render0.apply(this, arguments);
    const base = document.querySelector('#tpl-content .xs-scroll');
    if (base && !document.getElementById('xl-bar')) {
      const bar = document.createElement('div');
      bar.id = 'xl-bar';
      bar.innerHTML = `<button id="xl-sheet" class="xl-big" onclick="openXlSheet()" title="지금 견적을 엑셀 시트로 열어 고치기">📊 엑셀로 편집</button>
        <button id="xl-undo" onclick="xlUndo()" title="되돌리기 (Ctrl+Z)">↶ 되돌리기</button>
        <button id="xl-redo" onclick="xlRedo()" title="다시 하기 (Ctrl+Y)">↷ 다시 하기</button>
        <span class="xl-tip">엑셀처럼 — <b>끌어서 선택</b> → 셀 합치기·나누기 · <b>오른쪽 클릭</b> 줄 삽입·삭제·이동 · <b>Enter</b> 아래 칸 · <b>Alt+Enter</b> 줄바꿈 · 엑셀에서 복사해 <b>Ctrl+V</b></span>`;
      base.parentNode.insertBefore(bar, base);
    }
    xlBtns();
    return r;
  };

  // ── 칸 찾기 ─────────────────────────────────────────
  const COLS = ['xs-item', 'xs-desc', 'xs-price', 'xs-costcell', 'xs-memocell', 'xs-note'];
  const colOf = td => COLS.find(c => td?.classList.contains(c));
  const fieldIn = td => td?.querySelector('textarea, input');
  const rowSel = tr => `.xs-sheet tr.xs-row[data-k="${tr.dataset.k}"]${tr.dataset.b != null ? `[data-b="${tr.dataset.b}"]` : ''}[data-i="${tr.dataset.i}"]`;
  function cellTarget(tr, col, dir) { // dir: +1 아래, -1 위 → 같은 표에서 같은 칸이 있는 줄
    let t = tr;
    for (;;) {
      t = dir > 0 ? t.nextElementSibling : t.previousElementSibling;
      if (!t) {
        const tb = (dir > 0 ? tr.parentElement.nextElementSibling : tr.parentElement.previousElementSibling);
        if (!tb || tb.tagName !== 'TBODY') return null;
        t = dir > 0 ? tb.firstElementChild : tb.lastElementChild; tr = t;
        if (!t) return null;
      }
      if (!t.classList.contains('xs-row')) continue;
      const td = t.querySelector('td.' + col);
      if (td && fieldIn(td)) return { sel: rowSel(t), col };
      if (col === 'xs-price') { // 합쳐진 칸 아래 줄 → 그 칸을 덮은 금액 칸
        continue;
      }
    }
  }
  function focusCell(tg) {
    if (!tg) return;
    requestAnimationFrame(() => {
      const f = fieldIn(document.querySelector(`${tg.sel} td.${tg.col}`));
      if (!f) return;
      f.focus();
      if (f.tagName === 'INPUT') f.select(); else { const n = f.value.length; f.setSelectionRange(n, n); }
      f.scrollIntoView({ block: 'nearest' });
    });
  }

  // ── 키보드 ──────────────────────────────────────────
  document.addEventListener('keydown', e => {
    const el = e.target, typing = /INPUT|TEXTAREA|SELECT/.test(el.tagName);
    const inSheet = el.closest?.('.xs-sheet');
    // 되돌리기 — 글자 입력 중이 아닐 때 (입력 중이면 브라우저가 글자 단위로 되돌림)
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (!typing && document.getElementById('xl-bar')) {
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); xlUndo(); return; }
        if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); xlRedo(); return; }
      }
    }
    // 선택한 줄 Delete → 견적가 지우기
    if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && typeof xsSel !== 'undefined' && xsSel) {
      e.preventDefault(); xlClearPrices(); return;
    }
    if (!typing && e.key === 'Escape' && typeof xsSel !== 'undefined' && xsSel) { xsSelClear(); return; }
    if (!inSheet || !typing || el.tagName === 'SELECT') return;
    const td = el.closest('td'), tr = el.closest('tr.xs-row'), col = colOf(td);
    if (!tr || !col) return;
    if (e.key === 'Escape') { // 입력 취소
      el.value = el.defaultValue; el.blur(); return;
    }
    if (e.key === 'Enter' && !e.isComposing) {
      if (e.altKey || (e.shiftKey && el.tagName === 'TEXTAREA' && col !== 'xs-item')) { // 칸 안 줄바꿈
        if (e.altKey) { e.preventDefault(); const p = el.selectionStart; el.setRangeText('\n', p, el.selectionEnd, 'end'); el.dispatchEvent(new Event('input')); }
        return;
      }
      e.preventDefault(); e.stopPropagation();
      const tg = cellTarget(tr, col, e.shiftKey ? -1 : 1);
      el.blur(); focusCell(tg); return;
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.shiftKey && !e.altKey && !e.isComposing) {
      const down = e.key === 'ArrowDown';
      if (el.tagName === 'TEXTAREA') { // 글이 여러 줄이면 첫/끝 줄에서만 칸 이동
        const v = el.value, p = el.selectionStart;
        if (down ? v.indexOf('\n', p) !== -1 : v.lastIndexOf('\n', p - 1) !== -1) return;
      }
      const tg = cellTarget(tr, col, down ? 1 : -1);
      if (!tg) return;
      e.preventDefault(); el.blur(); focusCell(tg);
    }
  }, true);

  // ── 선택한 줄 ───────────────────────────────────────
  function selRows() { // [{bi, ii}] 고른 줄 (끌어서 선택한 범위)
    if (typeof xsSel === 'undefined' || !xsSel) return [];
    const lo = Math.min(xsSel.a, xsSel.z), hi = Math.max(xsSel.a, xsSel.z);
    const [a] = xsGroupOf(xsSel.bi, lo), [, z] = xsGroupOf(xsSel.bi, hi);
    const out = []; for (let i = a; i <= z; i++) out.push({ bi: xsSel.bi, ii: i });
    return out;
  }
  function xlClearPrices() {
    const rows = selRows(); if (!rows.length) return;
    const items = tplState.blocks[rows[0].bi].items;
    rows.forEach(({ ii }) => { if (items[ii].p != null) items[ii].p = 0; });
    xsSelClear(); renderTpl(); calc();
    showToast('견적가를 지웠어요 — 되돌리려면 Ctrl+Z');
  }
  const num = v => (v == null || v === '' ? '' : String(v));
  function rowsTsv(rows) {
    return rows.map(({ bi, ii }) => {
      const i = tplState.blocks[bi].items[ii];
      const clean = s => String(s || '').replace(/[\t\r\n]+/g, ' ');
      return [clean(i.n), clean(i.d), i.p == null ? '' : num(i.p), num(i.c), clean(i.m), clean(i.note)].join('\t');
    }).join('\n');
  }
  document.addEventListener('copy', e => {
    if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;
    const rows = selRows(); if (!rows.length) return;
    e.clipboardData.setData('text/plain', rowsTsv(rows)); e.preventDefault();
    showToast(`📋 ${rows.length}줄 복사했어요 (항목·내용·견적가·원가·상세내역·메모) — 엑셀이나 다른 칸에 붙여넣기`);
  });

  // ── 엑셀에서 붙여넣기 ────────────────────────────────
  const toNum = s => { const t = String(s).replace(/[,\s원₩]/g, ''); if (t === '') return null; const n = Number(t); return isFinite(n) ? n : NaN; };
  document.addEventListener('paste', e => {
    const text = e.clipboardData?.getData('text/plain') || '';
    const active = document.activeElement;
    let tr = active?.closest?.('.xs-sheet tr.xs-row[data-k="b"]'), col = colOf(active?.closest?.('td'));
    if (!tr && typeof xsSel !== 'undefined' && xsSel) { // 고른 칸에 붙여넣기 → 견적가 칸부터
      tr = document.querySelector(`.xs-sheet tr.xs-row[data-k="b"][data-b="${xsSel.bi}"][data-i="${Math.min(xsSel.a, xsSel.z)}"]`); col = 'xs-price';
    }
    if (!tr || !col) return;
    const lines = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n');
    if (lines.length < 2 && !text.includes('\t')) return; // 한 칸짜리는 그냥 글자 붙여넣기
    e.preventDefault();
    const bi = +tr.dataset.b, start = +tr.dataset.i, items = tplState.blocks[bi].items;
    const keys = ['n', 'd', 'p', 'c', 'm', 'note'], c0 = COLS.indexOf(col);
    let added = 0;
    lines.forEach((line, r) => {
      const ii = start + r;
      if (!items[ii]) { items.push({ n: '', d: '', p: 0, f: '', note: '', on: true, c: null, m: '' }); added++; }
      const it = items[ii];
      line.split('\t').forEach((v, k) => {
        const key = keys[c0 + k]; if (!key) return;
        if (key === 'p') { const n = toNum(v); if (n === null) { if (ii > 0 && r > 0) it.p = it.p ?? null; } else if (!isNaN(n)) { it.p = n; it.on = true; } }
        else if (key === 'c') { const n = toNum(v); it.c = n === null || isNaN(n) ? null : n; }
        else it[key] = v.trim();
      });
    });
    if (items[0] && items[0].p == null) items[0].p = 0;
    active?.blur?.(); if (typeof xsSelClear === 'function') xsSelClear();
    renderTpl(); calc();
    showToast(`📋 ${lines.length}줄 붙여넣었어요${added ? ` (새 줄 ${added}개 추가)` : ''} — 되돌리려면 Ctrl+Z`);
  });

  // ── 오른쪽 클릭 메뉴 ─────────────────────────────────
  const blank = () => ({ n: '', d: '', p: 0, f: '', note: '', on: true, c: null, m: '' });
  window.xlRow = function (act, k, bi, ii) {
    xlMenuClose();
    if (k === 'o') { // 선택 옵션 줄
      const L = tplState.options;
      if (act === 'below') L.splice(ii + 1, 0, { n: '', d: '', p: 0, f: '', note: '', on: false });
      else if (act === 'above') L.splice(ii, 0, { n: '', d: '', p: 0, f: '', note: '', on: false });
      else if (act === 'dup') L.splice(ii + 1, 0, JSON.parse(JSON.stringify(L[ii])));
      else if (act === 'del') L.splice(ii, 1);
      else if (act === 'up' && ii > 0) [L[ii - 1], L[ii]] = [L[ii], L[ii - 1]];
      else if (act === 'down' && ii < L.length - 1) [L[ii + 1], L[ii]] = [L[ii], L[ii + 1]];
      else if (act === 'ox') L[ii].on = !L[ii].on;
      renderTpl(); calc(); return;
    }
    const L = tplState.blocks[bi].items, it = L[ii];
    const inGroup = j => L[j] && L[j].p == null; // j 줄이 윗줄 금액 칸에 포함
    if (act === 'above' || act === 'below') {
      const at = act === 'above' ? ii : ii + 1, n = blank();
      if (inGroup(at)) n.p = null; // 합쳐진 칸 한가운데 넣으면 그 칸에 같이 포함
      L.splice(at, 0, n);
      renderTpl(); calc();
      focusCell({ sel: `.xs-sheet tr.xs-row[data-k="b"][data-b="${bi}"][data-i="${at}"]`, col: 'xs-item' });
      return;
    }
    if (act === 'dup') { const c = JSON.parse(JSON.stringify(it)); if (c.p != null && inGroup(ii + 1)) c.p = null; L.splice(ii + 1, 0, c); }
    else if (act === 'del') { xsDelItem(bi, ii); return; }
    else if (act === 'up' || act === 'down') {
      const j = act === 'up' ? ii - 1 : ii + 1;
      if (!L[j]) return;
      [L[j], L[ii]] = [L[ii], L[j]];
      if (L[0].p == null) { L[0].p = L[1]?.p ?? 0; if (L[1]) L[1].p = null; } // 맨 윗줄은 항상 금액 칸
    }
    else if (act === 'ox') it.on = !it.on;
    else if (act === 'merge') { xsMergeRange(bi, xsSel.a, xsSel.z); return; }
    else if (act === 'unmerge') { xsUnmerge(bi, ii); return; }
    else if (act === 'unmergeSel') { xsUnmergeSel(); return; }
    else if (act === 'split') { xsSplit(bi, ii); return; }
    else if (act === 'mergeUp') { xsMerge(bi, ii); return; }
    else if (act === 'copy') {
      const rows = selRows().length ? selRows() : [{ bi, ii }];
      navigator.clipboard?.writeText(rowsTsv(rows)).then(() => showToast(`📋 ${rows.length}줄 복사했어요`), () => showToast('복사가 막혔어요 — Ctrl+C를 써 주세요'));
      return;
    }
    renderTpl(); calc();
  };
  function xlMenuClose() { document.getElementById('xl-menu')?.remove(); }
  window.xlMenuClose = xlMenuClose;
  document.addEventListener('contextmenu', e => {
    const tr = e.target.closest?.('.xs-sheet tr.xs-row[data-k="b"], .xs-sheet tr.xs-row[data-k="o"]');
    if (!tr) { xlMenuClose(); return; }
    if (/INPUT|TEXTAREA/.test(e.target.tagName) && e.target.selectionStart !== e.target.selectionEnd) return; // 글자 고른 채면 브라우저 메뉴(복사 등)
    e.preventDefault();
    const k = tr.dataset.k, bi = k === 'b' ? +tr.dataset.b : -1, ii = +tr.dataset.i;
    const B = (act, label, extra = '') => `<button onclick="xlRow('${act}','${k}',${bi},${ii})" ${extra}>${label}</button>`;
    let html;
    if (k === 'b') {
      const L = tplState.blocks[bi].items, it = L[ii], [ga, gz] = xsGroupOf(bi, ii);
      // 오른쪽 클릭한 줄이 선택 밖이면 그 줄(칸)만 선택
      const inSel = xsSel && xsSel.bi === bi && ii >= Math.min(xsSel.a, xsSel.z) && ii <= Math.max(xsSel.a, xsSel.z);
      if (!inSel) { xsSel = { bi, a: ii, z: ii }; xsSelPaint(); }
      const lo = Math.min(xsSel.a, xsSel.z), hi = Math.max(xsSel.a, xsSel.z);
      const multi = xsGroupOf(bi, lo)[0] !== xsGroupOf(bi, hi)[0];
      const anyMerged = [...document.querySelectorAll(`td.xs-price[data-pb="${bi}"]`)].some(td => +td.dataset.pz >= lo && +td.dataset.pa <= hi && +td.dataset.pz > +td.dataset.pa);
      html = `<div class="xl-mh">「${esc(it.n || '이름 없는 줄')}」</div>
        ${B('above', '⬆ 위에 줄 삽입')}${B('below', '⬇ 아래에 줄 삽입')}${B('dup', '⧉ 줄 복제')}
        <hr>${multi ? B('merge', '⤴ 셀 합치기 (고른 칸)') : ''}${anyMerged ? B('unmergeSel', '✂ 셀 나누기 (원가 비율)') : ''}
        ${it.p == null ? B('split', '✂ 이 줄만 따로 금액') : ''}${it.p != null && ga > 0 ? B('mergeUp', '⤴ 위 칸에 합치기') : ''}
        <hr>${B('up', '↑ 위로 이동', ii === 0 ? 'disabled' : '')}${B('down', '↓ 아래로 이동', ii === L.length - 1 ? 'disabled' : '')}
        ${B('ox', it.on ? '✕ 빼기 (적용 X)' : '○ 넣기 (적용 O)')}${B('copy', '📋 복사 (엑셀로)')}
        <hr>${B('del', '🗑 줄 삭제', 'class="danger"')}`;
    } else {
      const o = tplState.options[ii];
      html = `<div class="xl-mh">옵션 「${esc(o.n || '이름 없는 옵션')}」</div>
        ${B('above', '⬆ 위에 옵션 삽입')}${B('below', '⬇ 아래에 옵션 삽입')}${B('dup', '⧉ 옵션 복제')}
        <hr>${B('up', '↑ 위로 이동', ii === 0 ? 'disabled' : '')}${B('down', '↓ 아래로 이동', ii === tplState.options.length - 1 ? 'disabled' : '')}
        ${B('ox', o.on ? '✕ 빼기 (적용 X)' : '○ 넣기 (적용 O)')}
        <hr>${B('del', '🗑 옵션 삭제', 'class="danger"')}`;
    }
    xlMenuClose();
    const m = document.createElement('div'); m.id = 'xl-menu'; m.innerHTML = html; document.body.appendChild(m);
    const w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.min(e.clientX, innerWidth - w - 8) + scrollX + 'px';
    m.style.top = Math.min(e.clientY, innerHeight - h - 8) + scrollY + 'px';
  });
  document.addEventListener('pointerdown', e => { if (!e.target.closest?.('#xl-menu')) xlMenuClose(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') xlMenuClose(); });
})();
