/**
 * tpl.js — 아파트별 기본 견적서 · 특이사항 · 템플릿 저장/공통사항 추출 · 전체 백업
 *
 * app.js 다음에 로드됩니다.
 *  - calcTotals()가 tplCollectRows() / specialRows()를 불러 견적 줄에 더합니다.
 *  - 상태 변수(isTplMode, tplState, specials)는 app.js에 선언되어 있습니다.
 *  - 데이터: tpl-data.js (BASE_TEMPLATES, SPECIAL_LIBRARY)
 */

const SP_CAT       = '특이사항 (현장 조건)';
const OPT_CAT      = '선택 옵션';
const USER_TPL_KEY = 'tplUser_';     // 직접 저장한 템플릿
const SP_LIB_KEY   = 'spLibCustom';  // 직접 추가한 특이사항 목록
const START_MODE   = 'tpl';          // 처음 열 때 화면: 'tpl'(아파트별 기본 견적서) / 'normal'(일반 견적)

/* ════════ 공통 도우미 ════════ */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function parseWon(v) { return Number(String(v ?? '').replace(/[^\d-]/g, '')) || 0; }
function median(arr) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2 / 10000) * 10000;
}
function man(n) { return (Math.round(n / 10000)).toLocaleString('ko-KR') + '만'; }
function lsGet(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }

/* ════════ 템플릿 목록 ════════ */
function getUserTemplates() {
  return Object.keys(localStorage).filter(k => k.startsWith(USER_TPL_KEY)).sort()
    .map(k => { const t = lsGet(k, null); return t ? { ...t, storeKey: k } : null; })
    .filter(Boolean);
}
function allTemplates() { return [...BASE_TEMPLATES, ...getUserTemplates()]; }
function findTemplate(key) { return allTemplates().find(t => t.key === key); }
function tplBaseTotal(t) {
  let s = 0;
  t.blocks.forEach(b => b.items.forEach(i => { if (i.on !== false && i.p != null) s += Number(i.p) || 0; }));
  return s;
}

// 템플릿 → 편집용 상태 (기본 항목은 켜짐, 옵션은 템플릿에 저장된 대로)
function tplFromTemplate(t) {
  return {
    key: t.key, name: t.name, basis: t.basis || '', feeRate: Number(t.feeRate) || 0,
    blocks: t.blocks.map(b => ({
      proc: b.proc, range: b.range || '', freq: b.freq || '',
      items: b.items.map(i => ({
        n: i.n, d: i.d || '', p: i.p == null ? null : Number(i.p),
        f: i.f || '', note: i.note || '', on: i.on !== false,
        c: i.c == null || i.c === '' ? null : Number(i.c), m: i.m || '', // 원가·상세내역 (내부용)
        ...(i.bd ? { bd: i.bd, bdOrig: i.bdOrig } : {}),
      })),
    })),
    options: (t.options || []).map(o => ({ n: o.n, d: o.d || '', p: Number(o.p) || 0, f: o.f || '', on: !!o.on,
      c: o.c == null || o.c === '' ? null : Number(o.c), m: o.m || '', ...(o.bd ? { bd: o.bd, bdOrig: o.bdOrig } : {}) })),
  };
}

// 공유 링크용 압축: 기본 템플릿이면 켜짐/금액만 담고, 열 때 원래 템플릿에서 복원
function tplPack(t) {
  const base = BASE_TEMPLATES.find(b => b.key === t.key);
  if (!base || t.packed) return t;
  // 가구 계산기 등으로 줄 구성이 바뀐 공정은 통째로 담음
  const bx = {};
  t.blocks.forEach((bl, bi) => {
    const bb = base.blocks[bi];
    if (!bb || bb.proc !== bl.proc || bb.items.length !== bl.items.length || bb.items.some((x, j) => x.n !== bl.items[j].n) || bl.items.some(x => x.bd)) bx[bi] = bl;
  });
  return {
    key: t.key, packed: 1, feeRate: t.feeRate,
    // [켜짐, 금액] + 원가·상세내역이 기본값과 다르면 [.., 원가, 상세내역]
    b: t.blocks.map((bl, bi) => bl.items.map((i, ii) => {
      const bi0 = base.blocks[bi]?.items[ii] || {};
      const v = [i.on ? 1 : 0, i.p];
      if ((i.c ?? null) !== (bi0.c ?? null) || (i.m || '') !== (bi0.m || '')) v.push(i.c ?? null, i.m || '');
      return v;
    })),
    o: t.options.map((o, oi) => {
      const o0 = base.options[oi] || {};
      const v = [o.on ? 1 : 0, o.p];
      if ((o.c ?? null) !== (o0.c ?? null) || (o.m || '') !== (o0.m || '')) v.push(o.c ?? null, o.m || '');
      return v;
    }),
    bx, nb: t.blocks.length, fu: t.furn || null,
    // 업체 단가표 등으로 옵션이 늘어난 경우 옵션 전체를 담음
    ox: (t.options.length !== base.options.length || t.options.some((o, i) => o.n !== base.options[i].n || o.bd)) ? t.options : null,
  };
}
function tplUnpack(t) {
  if (!t || !t.packed) return t;
  const base = BASE_TEMPLATES.find(b => b.key === t.key);
  if (!base) return null;
  const s = tplFromTemplate(base);
  s.feeRate = t.feeRate || 0;
  s.blocks.forEach((bl, bi) => bl.items.forEach((i, ii) => {
    const v = t.b?.[bi]?.[ii]; if (v) { i.on = !!v[0]; i.p = v[1]; if (v.length > 2) { i.c = v[2]; i.m = v[3] || ''; } }
  }));
  s.options.forEach((o, oi) => { const v = t.o?.[oi]; if (v) { o.on = !!v[0]; o.p = v[1]; if (v.length > 2) { o.c = v[2]; o.m = v[3] || ''; } } });
  if (t.nb) s.blocks.length = t.nb; // 공정이 새로 생기거나 빠진 경우 개수 맞춤
  Object.entries(t.bx || {}).forEach(([bi, bl]) => { s.blocks[bi] = bl; });
  s.blocks = s.blocks.filter(Boolean);
  if (t.fu) s.furn = t.fu;
  if (t.ox) s.options = t.ox;
  return s;
}

/* ════════ 모드 전환 ════════ */
function showMode(m) {
  isTplMode = m === 'tpl';
  isYanguMode = m === 'yangu';
  document.body.classList.toggle('sheet-mode', m === 'tpl' && typeof renderSheet === 'function');
  document.getElementById('normal-mode').classList.toggle('hidden', m !== 'normal');
  document.getElementById('yangu-mode').classList.toggle('hidden', m !== 'yangu');
  document.getElementById('tpl-mode').classList.toggle('hidden', m !== 'tpl');
  document.getElementById('summary-title').textContent =
    m === 'tpl' ? '📋 기본 견적서 요약' : m === 'yangu' ? '🏢 양우아파트 견적 요약' : '견적 요약';
  if (m === 'tpl') renderTpl();
  else if (m === 'yangu') renderYanguItems();
  else renderItems();
}
function enterTplMode() { showMode('tpl'); calc(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function exitTplMode()  { showMode('normal'); calc(); }

function applyTemplate(key) {
  const t = findTemplate(key);
  if (!t) return;
  const hasWork = tplState && tplState.key !== key;
  if (hasWork && !confirm(`「${t.name}」으로 바꿀까요? 지금 고친 금액·선택은 사라집니다. (특이사항은 그대로)`)) return;
  tplState = tplFromTemplate(t);
  if (t.pyung) {
    document.getElementById('pyung').value = t.pyung;
  }
  const addr = document.getElementById('clientAddr');
  if (!addr.value && t.addr) addr.value = t.addr.replace(/_+/g, '').replace(/\s+/g, ' ').replace(/ 동 호/, '').trim();
  renderTpl(); calc();
}

/* ════════ 기본 견적서 → 견적 줄 ════════ */
function tplCollectRows() {
  if (!tplState) return [];
  const rows = [];
  // range·f·note는 내부 참고용 (일반 공유에만 보이고 고객용에는 빠짐)
  tplState.blocks.forEach(b => {
    b.items.forEach(i => {
      if (!i.on) return;
      const meta = { range: b.range || '', f: i.f || '', note: i.note || '' };
      if (i.p == null) rows.push({ catName: b.proc, label: i.n, detail: i.d, qty: '', u: '', unitP: 0, amt: 0, incl: true, ...meta });
      else rows.push({ catName: b.proc, label: i.n, detail: i.d, qty: 1, u: '식', unitP: i.p, amt: i.p, ...meta });
    });
  });
  tplState.options.forEach(o => {
    if (o.on) rows.push({ catName: OPT_CAT, label: o.n, detail: o.d, qty: 1, u: '식', unitP: o.p, amt: o.p, f: o.f || '' });
  });
  return rows;
}

/* ════════ 기본 견적서 화면 ════════ */
function renderTpl() {
  if (typeof renderSheet === 'function') { renderSheet(); return; } // 엑셀 모양 화면 (sheet.js)
  const el = document.getElementById('tpl-content');
  if (!el) return;
  const users = getUserTemplates();
  const card = t => {
    const on = tplState?.key === t.key;
    const del = t.storeKey
      ? `<span class="tpl-card-del" title="템플릿 삭제" onclick="event.stopPropagation();deleteUserTemplate('${esc(t.storeKey)}')">✕</span>` : '';
    return `<button class="tpl-card${on ? ' on' : ''}${t.storeKey ? ' user' : ''}" onclick="applyTemplate('${esc(t.key)}')">
      ${del}<span class="tpl-card-name">${esc(t.name)}</span>
      <span class="tpl-card-amt">기본 ${man(tplBaseTotal(t))}원</span></button>`;
  };
  let html = `<div class="tpl-picker">
    <div class="tpl-picker-title">아파트를 고르면 기본 견적서가 채워집니다</div>
    <div class="tpl-cards">${BASE_TEMPLATES.map(card).join('')}</div>
    ${users.length ? `<div class="tpl-picker-title sub">직접 저장한 템플릿</div><div class="tpl-cards">${users.map(card).join('')}</div>` : ''}
    <div class="tpl-tools">
      <button class="tpl-tool" onclick="saveAsTemplate()" ${tplState ? '' : 'disabled'}>💾 지금 구성을 템플릿으로 저장</button>
      <button class="tpl-tool" onclick="openExtract()">🧩 저장된 견적으로 기본 견적서 만들기</button>
    </div>
  </div>`;

  if (!tplState) {
    html += `<p class="tpl-empty">위에서 아파트를 고르세요. 목록에 없는 아파트는 「그 외 아파트 (30평대 공통)」으로 시작하면 됩니다.</p>`;
    el.innerHTML = html;
    return;
  }

  html += `<div class="tpl-basis">📊 ${esc(tplState.basis)}<br>
    <span>금액은 기존 견적의 중간값입니다. 칸을 눌러 바로 고칠 수 있고, 체크를 풀면 견적에서 빠집니다. 「포함」 줄은 같은 공정 윗줄 금액에 들어 있는 항목입니다.</span></div>`;

  tplState.blocks.forEach((b, bi) => {
    const sum = b.items.reduce((s, i) => s + (i.on && i.p != null ? i.p : 0), 0);
    html += `<div class="tpl-block">
      <div class="tpl-block-h"><span class="tpl-proc">${esc(b.proc)}</span>
        ${b.range ? `<span class="tpl-range" title="기존 견적 금액 범위">기존 ${esc(b.range)}</span>` : ''}
        <span class="tpl-block-sum">${fmt(sum)}원</span></div>`;
    b.items.forEach((i, ii) => {
      html += `<div class="tpl-line${i.on ? '' : ' off'}">
        <input type="checkbox" class="tpl-chk" ${i.on ? 'checked' : ''} onchange="tplToggle(${bi},${ii})" aria-label="${esc(i.n)} 포함">
        <div class="tpl-line-main" onclick="tplToggle(${bi},${ii})">
          <div class="tpl-line-n">${esc(i.n)}${i.f ? `<span class="tpl-freq" title="기존 견적 중 포함 건수">${esc(i.f)}</span>` : ''}</div>
          <div class="tpl-line-d">${esc(i.d)}${i.note ? ` <span class="tpl-note">· ${esc(i.note)}</span>` : ''}</div>
        </div>
        ${i.p == null
          ? '<span class="tpl-incl">포함</span>'
          : `<input class="tpl-amt" type="text" inputmode="numeric" value="${fmt(i.p)}" onfocus="this.select()" onchange="tplSetAmt(${bi},${ii},this.value)" aria-label="${esc(i.n)} 금액">`}
      </div>`;
    });
    html += `</div>`;
  });

  if (tplState.options.length) {
    const osum = tplState.options.reduce((s, o) => s + (o.on ? o.p : 0), 0);
    html += `<div class="tpl-block tpl-opt">
      <div class="tpl-block-h"><span class="tpl-proc">선택 옵션</span>
        <span class="tpl-range">가끔 들어가는 항목 — 체크하면 추가</span>
        <span class="tpl-block-sum">${fmt(osum)}원</span></div>`;
    tplState.options.forEach((o, oi) => {
      html += `<div class="tpl-line${o.on ? '' : ' off'}">
        <input type="checkbox" class="tpl-chk" ${o.on ? 'checked' : ''} onchange="tplOptToggle(${oi})" aria-label="${esc(o.n)} 추가">
        <div class="tpl-line-main" onclick="tplOptToggle(${oi})">
          <div class="tpl-line-n">${esc(o.n)}${o.f ? `<span class="tpl-freq">${esc(o.f)}</span>` : ''}</div>
          <div class="tpl-line-d">${esc(o.d)}</div>
        </div>
        <input class="tpl-amt" type="text" inputmode="numeric" value="${fmt(o.p)}" onfocus="this.select()" onchange="tplOptAmt(${oi},this.value)" aria-label="${esc(o.n)} 금액">
      </div>`;
    });
    html += `</div>`;
  }

  html += `<div class="tpl-fee">
    <label>감리비 (업체이윤)
      <input type="number" min="0" max="30" step="1" value="${tplState.feeRate}" onchange="tplSetFee(this.value)"> %</label>
    <span>기본 + 옵션 + 특이사항 합계에 붙습니다. 최근 양우 견적(602·502호)은 10% 적용.</span>
  </div>`;
  el.innerHTML = html;
}

function tplToggle(bi, ii) { const i = tplState.blocks[bi].items[ii]; i.on = !i.on; renderTpl(); calc(); }
function tplSetAmt(bi, ii, v) { tplState.blocks[bi].items[ii].p = parseWon(v); renderTpl(); calc(); }
function tplOptToggle(oi) { const o = tplState.options[oi]; o.on = !o.on; renderTpl(); calc(); }
function tplOptAmt(oi, v) { tplState.options[oi].p = parseWon(v); renderTpl(); calc(); }
function tplSetFee(v) { tplState.feeRate = Math.max(0, Math.min(30, Number(v) || 0)); renderTpl(); calc(); }

/* ════════ 템플릿 저장 / 삭제 ════════ */
function saveAsTemplate() {
  if (!tplState) return;
  const name = prompt('템플릿 이름을 입력하세요 (예: 양우 32평 확장형)', tplState.name + ' (수정)');
  if (!name) return;
  const key = 'u' + Date.now();
  const t = {
    key, name: name.trim(), pyung: getPyung(), feeRate: tplState.feeRate,
    basis: `직접 저장한 템플릿 · ${new Date().toLocaleDateString('ko-KR')} · 원본: ${tplState.name}`,
    blocks: tplState.blocks, options: tplState.options,
  };
  try {
    localStorage.setItem(USER_TPL_KEY + key, JSON.stringify(t));
  } catch (e) { alert('저장 실패: ' + e.message); return; }
  tplState = tplFromTemplate(t);
  renderTpl(); calc();
  showToast('💾 템플릿 저장: ' + t.name);
}
function deleteUserTemplate(storeKey) {
  const t = lsGet(storeKey, null);
  if (!confirm(`「${t?.name || '템플릿'}」을 삭제할까요?`)) return;
  localStorage.removeItem(storeKey);
  renderTpl();
}

/* ════════ 특이사항 ════════ */
function getSpLib() {
  const custom = lsGet(SP_LIB_KEY, []);
  return [...SPECIAL_LIBRARY, ...custom.map(c => ({ ...c, cat: '내가 추가한 항목', custom: true }))];
}
function findSp(name) { return getSpLib().find(x => x.n === name); }

function specialRows() {
  return specials
    .filter(s => s.n && (Number(s.p) || 0) > 0 && (Number(s.q) || 0) > 0)
    .map(s => {
      const sign = s.kind === '감액' ? -1 : 1;
      const unitP = sign * Number(s.p);
      const qty = Number(s.q);
      const src = findSp(s.n)?.src;
      return { catName: SP_CAT, label: (s.kind === '감액' ? '[감액] ' : '') + s.n, detail: s.d || '', qty, u: s.u || '식', unitP, amt: unitP * qty,
               note: src ? '참고: ' + src : '' };
    });
}
function spLineAmt(s) { return (s.kind === '감액' ? -1 : 1) * (Number(s.p) || 0) * (Number(s.q) || 0); }

function renderSpecials() {
  const el = document.getElementById('sp-panel');
  if (!el) return;
  const lib = getSpLib();
  const cats = [...new Set(lib.map(x => x.cat))];
  const optionsHtml = sel => `<option value="">— 목록에서 고르기 —</option>` +
    cats.map(c => `<optgroup label="${esc(c)}">${lib.filter(x => x.cat === c).map(x =>
      `<option value="${esc(x.n)}"${x.n === sel ? ' selected' : ''}>${esc(x.n)}${x.p ? ` (${man(x.p)}/${esc(x.u)})` : ''}</option>`).join('')}</optgroup>`).join('') +
    `<option value="__custom"${sel === '__custom' ? ' selected' : ''}>✏️ 직접 입력</option>`;
  const total = specials.reduce((s, x) => s + spLineAmt(x), 0);

  let rows = specials.map((s, i) => {
    if (s.pre && !(Number(s.q) > 0)) return ''; // 엑셀 화면에서 미리 넣어 둔 빈 줄은 숨김
    const libItem = findSp(s.n);
    const pickVal = !s.n ? '' : libItem ? s.n : '__custom';
    const canSave = s.n && !libItem;
    return `<div class="sp-row">
      <div class="sp-row-top">
        <select class="sp-pick" onchange="spPick(${i},this.value)" aria-label="특이사항 항목">${optionsHtml(pickVal)}</select>
        <button class="sp-kind ${s.kind === '감액' ? 'minus' : 'plus'}" onclick="spKind(${i})" title="추가/감액 바꾸기">${s.kind === '감액' ? '− 감액' : '+ 추가'}</button>
        <button class="sp-del" onclick="spDel(${i})" title="삭제" aria-label="삭제">✕</button>
      </div>
      <div class="sp-row-fields">
        <input class="sp-name" type="text" placeholder="항목명" value="${esc(s.n)}" oninput="spSet(${i},'n',this.value)">
        <input class="sp-desc" type="text" placeholder="내용·위치 (예: 안방 천장 처짐)" value="${esc(s.d)}" oninput="spSet(${i},'d',this.value)">
        <label class="sp-num">수량<input type="number" min="0" step="0.5" value="${esc(s.q)}" oninput="spSet(${i},'q',this.value)"></label>
        <label class="sp-num">단위<input type="text" class="sp-u" value="${esc(s.u)}" oninput="spSet(${i},'u',this.value)"></label>
        <label class="sp-num sp-price">단가<input type="text" inputmode="numeric" value="${s.p ? fmt(s.p) : ''}" placeholder="직접 입력" onfocus="this.select()" oninput="spSet(${i},'p',parseWon(this.value))" onchange="this.value=this.value?fmt(parseWon(this.value)):''"></label>
        <span class="sp-amt" id="sp-amt-${i}">${fmt(spLineAmt(s))}원</span>
      </div>
      <div class="sp-row-foot" id="sp-foot-${i}">${spFootHtml(i)}</div>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="sp-head">
      <div><div class="sp-title">⚠️ 특이사항 (현장 조건)</div>
      <div class="sp-sub">누수·보강·구조변경·확장처럼 집마다 다른 추가·감액. 목록에서 고르면 참고 단가가 들어오고, 직접 고쳐도 됩니다.</div></div>
      <div class="sp-total${total < 0 ? ' minus' : ''}" id="sp-total">${spTotalText(total)}</div>
    </div>
    ${rows || '<p class="sp-empty">아직 특이사항이 없습니다.</p>'}
    <button class="sp-add" onclick="spAdd()">+ 특이사항 추가</button>`;
}

function spAdd() { specials.push({ n: '', d: '', kind: '추가', q: 1, p: 0, u: '식' }); renderSpecials(); calc(); }
function spDel(i) { specials.splice(i, 1); renderSpecials(); calc(); }
function spKind(i) { specials[i].kind = specials[i].kind === '감액' ? '추가' : '감액'; renderSpecials(); calc(); }
function spPick(i, name) {
  const s = specials[i];
  if (name === '__custom') { if (findSp(s.n)) { s.n = ''; } s.p = s.p || 0; renderSpecials(); calc(); return; }
  const x = findSp(name);
  if (!x) { s.n = ''; renderSpecials(); calc(); return; }
  Object.assign(s, { n: x.n, kind: x.kind || '추가', u: x.u || '식', p: Number(x.p) || 0 });
  renderSpecials(); calc();
}
function spTotalText(total) { return total ? (total > 0 ? '+' : '') + fmt(total) + '원' : ''; }
function spFootHtml(i) {
  const s = specials[i];
  const libItem = findSp(s.n);
  const canSave = s.n && !libItem;
  return (libItem?.src ? `<span class="sp-src">참고: ${esc(libItem.src)}</span>` : '') +
    (canSave ? `<button class="sp-save" onclick="spSaveToLib(${i})">☆ 다음에도 쓰게 목록에 저장</button>` : '') +
    (libItem?.custom ? `<button class="sp-save" onclick="spRemoveFromLib('${esc(s.n)}')">목록에서 빼기</button>` : '');
}
// 글자를 입력하는 동안에는 패널을 다시 그리지 않고 금액·합계·안내만 바꿈 (입력 중인 칸 유지)
function spSet(i, key, v) {
  const s = specials[i];
  s[key] = key === 'q' ? (Number(v) || 0) : v;
  const a = document.getElementById('sp-amt-' + i);
  if (a) a.textContent = fmt(spLineAmt(s)) + '원';
  const total = specials.reduce((t, x) => t + spLineAmt(x), 0);
  const tEl = document.getElementById('sp-total');
  if (tEl) { tEl.textContent = spTotalText(total); tEl.classList.toggle('minus', total < 0); }
  if (key === 'n') { const f = document.getElementById('sp-foot-' + i); if (f) f.innerHTML = spFootHtml(i); }
  calc();
}
function spSaveToLib(i) {
  const s = specials[i];
  if (!s.n) return;
  const custom = lsGet(SP_LIB_KEY, []);
  if (custom.some(c => c.n === s.n)) return;
  custom.push({ kind: s.kind, n: s.n, d: s.d || '', u: s.u || '식', p: Number(s.p) || null, src: '직접 추가 · ' + new Date().toLocaleDateString('ko-KR') });
  localStorage.setItem(SP_LIB_KEY, JSON.stringify(custom));
  renderSpecials();
  showToast('☆ 특이사항 목록에 저장: ' + s.n);
}
function spRemoveFromLib(name) {
  if (!confirm(`「${name}」을 목록에서 뺄까요? (이 견적의 줄은 그대로 남습니다)`)) return;
  localStorage.setItem(SP_LIB_KEY, JSON.stringify(lsGet(SP_LIB_KEY, []).filter(c => c.n !== name)));
  renderSpecials();
}

/* ════════ 스냅샷 · 초기화 연동 (app.js에서 호출) ════════ */
function tplApplySnapshot(snap) {
  specials = JSON.parse(JSON.stringify(snap.specials || []));
  renderSpecials();
  if (snap.mode === 'tpl' && snap.tpl) {
    tplState = JSON.parse(JSON.stringify(snap.tpl));
    showMode('tpl');
  } else {
    showMode(snap.mode === 'yangu' ? 'yangu' : 'normal');
  }
}
function tplOnReset() {
  specials = [];
  renderSpecials();
  if (isTplMode && tplState) {
    const t = findTemplate(tplState.key);
    tplState = t ? tplFromTemplate(t) : null;
    renderTpl();
  } else if (isYanguMode) renderYanguItems();
  else renderItems();
}

/* ════════ 저장된 견적 → 공통 항목 추출 ════════ */
function getTplSnaps() {
  return Object.keys(localStorage).filter(k => k.startsWith('quote_')).sort().reverse()
    .map(k => ({ key: k, snap: lsGet(k, null) }))
    .filter(x => x.snap && x.snap.mode === 'tpl' && x.snap.tpl);
}

function openExtract() {
  const list = getTplSnaps();
  const box = document.getElementById('extract-body');
  if (list.length < 2) {
    box.innerHTML = `<p class="ex-msg">「기본 견적서」 화면에서 만든 견적을 <b>2개 이상</b> 저장해야 공통 항목을 뽑을 수 있어요. (지금 ${list.length}개)<br><br>
      다른 기기에서 만든 견적은 📂 불러오기 → 「백업 가져오기」로 먼저 모아주세요.</p>`;
  } else {
    box.innerHTML = `<p class="ex-msg">같은 아파트 견적을 여러 개 고르세요. 고른 견적 중 기준 비율 이상에 들어간 항목이 기본 공사가 되고, 그보다 적게 들어간 항목은 선택 옵션이 됩니다. 금액은 중간값입니다.</p>
      <div class="ex-list">${list.map(({ key, snap }) => `<label class="ex-item">
        <input type="checkbox" value="${esc(key)}">
        <span><b>${esc(snap.label || '견적')}</b><br><small>📋 ${esc(snap.tpl.name)} · 특이사항 ${(snap.specials || []).filter(x => x.n && Number(x.q) > 0).length}건</small></span></label>`).join('')}</div>
      <div class="ex-ctrl">
        <label>기본 공사 기준 <select id="ex-th">
          <option value="0.5" selected>절반 이상</option><option value="0.6">60% 이상</option>
          <option value="0.7">70% 이상</option><option value="1">모두 포함</option></select></label>
        <button class="tpl-tool primary" onclick="runExtract()">공통 항목 뽑기</button>
      </div>
      <div id="ex-result"></div>`;
  }
  document.getElementById('extract-modal').classList.remove('hidden');
}
function closeExtract() { document.getElementById('extract-modal').classList.add('hidden'); }

let extractDraft = null;
function extractCommon(snaps, th) {
  const N = snaps.length;
  const procOrder = [], stat = {}, opt = {}, sp = {};
  const blockTotals = {};
  snaps.forEach((s, si) => {
    s.tpl.blocks.forEach(b => {
      if (!procOrder.includes(b.proc)) procOrder.push(b.proc);
      b.items.forEach((i, ii) => {
        const k = b.proc + '|' + i.n;
        const st = stat[k] || (stat[k] = { proc: b.proc, n: i.n, d: i.d, note: i.note || '', bundled: i.p == null, cnt: 0, amts: [], order: ii });
        if (!i.on) return;
        st.cnt++; st.d = i.d;
        if (i.p != null) {
          st.amts.push(i.p);
          const bt = blockTotals[b.proc] || (blockTotals[b.proc] = {});
          bt[si] = (bt[si] || 0) + i.p;
        }
      });
    });
    s.tpl.options.forEach(o => {
      if (!o.on) return;
      const st = opt[o.n] || (opt[o.n] = { n: o.n, d: o.d, cnt: 0, amts: [] });
      st.cnt++; st.amts.push(o.p);
    });
    (s.specials || []).forEach(x => {
      if (!x.n || !(Number(x.q) > 0)) return;
      const st = sp[x.n] || (sp[x.n] = { n: x.n, cnt: 0, amts: [] });
      st.cnt++; st.amts.push(spLineAmt(x));
    });
  });
  const blocks = [], options = [], dropped = [];
  procOrder.forEach(proc => {
    const items = Object.values(stat).filter(s => s.proc === proc).sort((a, b) => a.order - b.order);
    const base = [];
    items.forEach(s => {
      if (!s.cnt) return;
      const f = `${s.cnt}/${N}`;
      if (s.cnt / N >= th) base.push({ n: s.n, d: s.d, p: s.bundled ? null : median(s.amts), f, note: s.note, on: true });
      else if (!s.bundled && s.amts.length) options.push({ n: s.n, d: s.d, p: median(s.amts), f, on: false });
      else dropped.push(`${proc} · ${s.n}`);
    });
    if (base.some(x => x.p != null)) {
      const tots = Object.values(blockTotals[proc] || {});
      const range = tots.length ? `${man(Math.min(...tots))}~${man(Math.max(...tots))}`.replace('만~', '~') : '';
      blocks.push({ proc, range, freq: `${tots.length}/${N}`, items: base });
    }
  });
  Object.values(opt).forEach(s => options.push({ n: s.n, d: s.d, p: median(s.amts), f: `${s.cnt}/${N}`, on: s.cnt / N >= th }));
  const spList = Object.values(sp).sort((a, b) => b.cnt - a.cnt).map(s => ({ n: s.n, f: `${s.cnt}/${N}`, p: median(s.amts) }));
  return { blocks, options, spList, dropped, N };
}

function runExtract() {
  const keys = [...document.querySelectorAll('#extract-body .ex-item input:checked')].map(x => x.value);
  const out = document.getElementById('ex-result');
  if (keys.length < 2) { out.innerHTML = '<p class="ex-warn">견적을 2개 이상 골라주세요.</p>'; return; }
  const snaps = keys.map(k => lsGet(k, null)).filter(Boolean);
  const th = Number(document.getElementById('ex-th').value);
  const r = extractCommon(snaps, th);
  const names = [...new Set(snaps.map(s => s.tpl.name))];
  extractDraft = { ...r, src: snaps.map(s => s.label || '견적'), names };
  const total = r.blocks.reduce((s, b) => s + b.items.reduce((t, i) => t + (i.p || 0), 0), 0);

  out.innerHTML = `<div class="ex-preview">
    <div class="ex-sum">기본 공사 <b>${fmt(total)}원</b> · ${r.blocks.length}개 공정 · 선택 옵션 ${r.options.length}개 (${r.N}건 기준)</div>
    ${r.blocks.map(b => `<div class="ex-blk"><b>${esc(b.proc)}</b> ${b.range ? `<small>기존 ${esc(b.range)}</small>` : ''}
      <ul>${b.items.map(i => `<li>${esc(i.n)} <small>${esc(i.f)}</small><span>${i.p == null ? '포함' : fmt(i.p)}</span></li>`).join('')}</ul></div>`).join('')}
    ${r.options.length ? `<div class="ex-blk"><b>선택 옵션</b><ul>${r.options.map(o => `<li>${esc(o.n)} <small>${esc(o.f)}${o.on ? ' · 기본 체크' : ''}</small><span>${fmt(o.p)}</span></li>`).join('')}</ul></div>` : ''}
    ${r.spList.length ? `<div class="ex-blk ex-sp"><b>⚠️ 자주 나온 특이사항</b> <small>템플릿에는 안 들어가고, 견적마다 따로 넣습니다</small>
      <ul>${r.spList.map(s => `<li>${esc(s.n)} <small>${esc(s.f)}</small><span>${fmt(s.p)}</span></li>`).join('')}</ul></div>` : ''}
    <div class="ex-save">
      <input type="text" id="ex-name" value="${esc((names.length === 1 ? names[0].replace(/ \(.*\)$/, '') : '공통') + ' 기본 견적서 (' + r.N + '건)')}" aria-label="템플릿 이름">
      <button class="tpl-tool primary" onclick="saveExtract()">💾 템플릿으로 저장하고 쓰기</button>
    </div>
  </div>`;
}

function saveExtract() {
  if (!extractDraft) return;
  const name = (document.getElementById('ex-name').value || '').trim() || '추출 템플릿';
  const key = 'u' + Date.now();
  const t = {
    key, name, pyung: getPyung(), feeRate: 0,
    basis: `저장된 견적 ${extractDraft.N}건에서 추출 (${extractDraft.src.join(', ')})`,
    blocks: extractDraft.blocks, options: extractDraft.options,
  };
  localStorage.setItem(USER_TPL_KEY + key, JSON.stringify(t));
  tplState = tplFromTemplate(t);
  closeExtract();
  showMode('tpl'); calc();
  showToast('🧩 새 기본 견적서 저장: ' + name);
}

/* ════════ 전체 백업 내보내기 / 가져오기 ════════ */
function backupKeys() {
  return Object.keys(localStorage).filter(k => k.startsWith('quote_') || k.startsWith(USER_TPL_KEY) || k === SP_LIB_KEY);
}
function exportAll() {
  const items = {};
  backupKeys().forEach(k => { items[k] = localStorage.getItem(k); });
  const data = { app: 'line-interior-quote', v: 1, exportedAt: new Date().toISOString(), items };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `라인인테리어_견적백업_${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  const n = Object.keys(items).filter(k => k.startsWith('quote_')).length;
  showToast(`⬇ 견적 ${n}개 + 템플릿·특이사항 목록을 파일로 저장했습니다`);
}
function importAll(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); } catch (e) { alert('백업 파일을 읽을 수 없습니다.'); return; }
    if (!data || data.app !== 'line-interior-quote' || !data.items) { alert('라인 인테리어 견적 백업 파일이 아닙니다.'); return; }
    let added = 0, same = 0;
    Object.entries(data.items).forEach(([k, v]) => {
      if (k === SP_LIB_KEY) {
        const mine = lsGet(SP_LIB_KEY, []);
        let theirs = []; try { theirs = JSON.parse(v) || []; } catch (e) {}
        theirs.forEach(x => { if (!mine.some(m => m.n === x.n)) { mine.push(x); added++; } });
        localStorage.setItem(SP_LIB_KEY, JSON.stringify(mine));
        return;
      }
      if (!(k.startsWith('quote_') || k.startsWith(USER_TPL_KEY))) return;
      const cur = localStorage.getItem(k);
      if (cur === v) { same++; return; }
      const key = cur == null ? k : k + '_' + Math.random().toString(36).slice(2, 7);
      localStorage.setItem(key, v);
      added++;
    });
    loadSavedList();
    if (isTplMode) renderTpl();
    renderSpecials();
    showToast(`⬆ 가져오기 완료: 새 항목 ${added}개${same ? `, 이미 있던 ${same}개는 건너뜀` : ''}`);
  };
  reader.readAsText(file);
}

// 일반 공유 링크에서 「계산기에서 열어 수정」으로 들어왔을 때
async function openEditLink(packed) {
  try {
    const snap = await unpackQuote(packed);
    if (snap.tpl) snap.tpl = tplUnpack(snap.tpl);
    applySnapshot(snap);
    history.replaceState(null, '', location.pathname);
    showToast('✏️ 공유받은 견적을 열었습니다. 고친 뒤 💾 저장하세요');
  } catch (e) {
    console.warn(e);
    showMode(START_MODE); calc();
    showToast('링크가 잘려서 견적을 열지 못했습니다');
  }
}

/* ════════ 시작 ════════ */
document.addEventListener('DOMContentLoaded', () => {
  renderSpecials();
  const ex = document.getElementById('extract-modal');
  ex?.addEventListener('click', e => { if (e.target === ex) closeExtract(); });
  document.getElementById('backup-file')?.addEventListener('change', e => { importAll(e.target.files[0]); e.target.value = ''; });
  const w = location.hash.match(/[#&]w=([^&]+)/);
  if (w) openEditLink(w[1]);                                         // 🔗 일반 공유 → 「계산기에서 열어 수정」
  else if (new URLSearchParams(location.search).get('q')) loadFromURL(); // 예전 작업 화면 공유 링크
  else if (START_MODE === 'tpl') { showMode('tpl'); calc(); }
});
