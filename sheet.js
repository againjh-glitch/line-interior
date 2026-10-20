/**
 * sheet.js — 엑셀 견적서와 같은 모양의 작업 화면 (아파트별 기본 견적서 모드)
 *
 *  시트 탭(아파트) → 고객 정보 → Ⅰ.기본 공사 → Ⅱ.선택 옵션 → Ⅲ.특이사항 → 합계·계약금
 *  노란 칸 = 입력, 파란 글씨 = 기존 견적에서 가져온 기본 금액, 적용 O/X로 넣고 빼기.
 *
 *  상태는 tpl.js / app.js와 같은 것을 씁니다 (tplState, specials, negoAmt, payRatio),
 *  그래서 저장·불러오기·고객 공유·엑셀 출력·인쇄가 그대로 동작합니다.
 */

const SHEET_SP_PREFILL = ['천장 평탄화', '욕실 올철거+방수', '외벽 단열', '우수관 방수',
  '발코니 단차맞춤 방수 미장', '가벽 설립+문짝', '거실 확장', '분전함·차단기 전체 교체'];
const SHEET_CLIENT = [
  ['clientName', '고객명', 'text', '홍길동 님'], ['clientPhone', '연락처', 'tel', '010-0000-0000'],
  ['clientAddr', '주소 / 평형', 'text', '양우 ___동 ___호 / 32평형'], ['clientPeriod', '시공 예상기간', 'text', '4주'],
  ['clientDate', '견적서 작성일', 'date', ''], ['clientNote', '특이사항 메모', 'text', '현장 메모 (견적서에 표시됨)'],
];

// 자주 나오는 특이사항 8개를 수량 비운 채로 미리 넣어 둠 (수량을 넣어야 금액이 잡힘)
function xsEnsurePrefill() {
  SHEET_SP_PREFILL.forEach(name => {
    if (specials.some(s => s.n === name)) return;
    const x = findSp(name);
    if (x) specials.push({ n: x.n, d: '', kind: x.kind || '추가', q: 0, p: Number(x.p) || 0, u: x.u || '식', pre: true });
  });
}

// 블록 첫 금액 줄에 「포함」 줄이 딸려 있는지 (그 줄을 X로 하면 공정 전체를 뺌)
function xsIsBlockHead(b, ii) {
  const firstPriced = b.items.findIndex(i => i.p != null);
  return ii === firstPriced && b.items.some(i => i.p == null);
}

function renderSheet() {
  const el = document.getElementById('tpl-content');
  if (!el) return;
  if (!tplState) tplState = tplFromTemplate(BASE_TEMPLATES[0]);
  xsEnsurePrefill();

  const tab = t => `<button class="xs-tab${tplState.key === t.key ? ' on' : ''}" onclick="applyTemplate('${esc(t.key)}')" title="기본 ${man(tplBaseTotal(t))}원">
      ${esc(t.name.replace(' (비확장)', '').replace(' (30평대 공통)', ''))}${t.storeKey
        ? ` <span class="xs-tab-del" title="템플릿 삭제" onclick="event.stopPropagation();deleteUserTemplate('${esc(t.storeKey)}')">✕</span>` : ''}</button>`;
  const ox = (on, call) => `<select class="xs-ox" onchange="${call}" aria-label="적용 O/X">
      <option value="O"${on ? ' selected' : ''}>O</option><option value="X"${on ? '' : ' selected'}>X</option></select>`;
  const money = (v, call, label) => `<input class="xs-money" type="text" inputmode="numeric" value="${v === '' ? '' : fmt(v)}" onfocus="this.select()" onchange="${call}" aria-label="${esc(label)}">`;

  // ── 고객 정보
  const info = SHEET_CLIENT.map(([id, label, type, ph]) => {
    const v = document.getElementById(id)?.value || '';
    return `<tr><th>${label}</th><td class="xs-in"><input type="${type}" id="xs-${id}" value="${esc(v)}" placeholder="${esc(ph)}"
      oninput="xsClient('${id}', this.value)"></td></tr>`;
  }).join('');

  // ── Ⅰ. 기본 공사
  const baseRows = tplState.blocks.map((b, bi) => b.items.map((i, ii) => {
    const parts = [];
    if (ii === 0 && b.range) parts.push('기존 ' + b.range);
    if (i.f) parts.push(i.f);
    if (i.p == null) parts.push('윗줄 금액에 포함');
    else if (xsIsBlockHead(b, ii)) parts.push('X면 이 공정 전체가 빠짐');
    if (i.note) parts.push(i.note);
    return `<tr class="xs-row${i.on ? '' : ' x'}" data-k="b" data-b="${bi}" data-i="${ii}">
      ${ii === 0 ? `<td class="xs-proc" rowspan="${b.items.length}">${esc(b.proc)}${b.proc === '가구' && typeof openFurn === 'function'
        ? `<button class="xs-furn-btn" onclick="openFurn()" title="싱크대·붙박이장 사이즈로 예상 견적">🧮 사이즈로<br>계산</button>` : ''}${b.proc === '도배·바닥재' && typeof openVendor === 'function'
        ? `<button class="xs-furn-btn vd" onclick="openVendor('바닥재')" title="업체 바닥재 단가에서 고르기">📒 바닥재<br>고르기</button>` : ''}</td>` : ''}
      <td class="xs-item">${esc(i.n)}${i.p != null && typeof openBreakdown === 'function' ? `<button class="xs-bd-btn${i.bd ? ' on' : ''}" onclick="openBreakdown('b',${bi},${ii})" title="자재·인건비 내역으로 계산">${i.bd ? '🧮 내역' : '🧮'}</button>` : ''}</td>
      <td class="xs-desc">${esc(i.d)}</td>
      <td class="xs-num xs-amt"></td>
      ${ii === 0 ? `<td class="xs-num xs-tot" rowspan="${b.items.length}" id="xs-tot-${bi}"></td>` : ''}
      ${i.p == null ? '<td></td>' : `<td class="xs-in xs-num">${money(i.p, `xsBaseAmt(${bi},${ii},this.value)`, i.n + ' 기본 금액')}</td>`}
      <td class="xs-in xs-oxcell">${ox(i.on, `xsBaseOX(${bi},${ii},this.value)`)}</td>
      <td class="xs-note">${esc(parts.join(' · '))}</td>
    </tr>`;
  }).join('')).join('');

  // ── Ⅱ. 선택 옵션
  const optRows = tplState.options.map((o, oi) => `<tr class="xs-row${o.on ? '' : ' off'}" data-k="o" data-i="${oi}">
      <td class="xs-proc sm">선택</td>
      <td class="xs-item">${esc(o.n)}${typeof openBreakdown === 'function' ? `<button class="xs-bd-btn${o.bd ? ' on' : ''}" onclick="openBreakdown('o',-1,${oi})" title="자재·인건비 내역으로 계산">${o.bd ? '🧮 내역' : '🧮'}</button>` : ''}</td>
      <td class="xs-desc">${esc(o.d)}</td>
      <td class="xs-num xs-amt"></td>
      <td class="xs-in xs-num">${money(o.p, `xsOptAmt(${oi},this.value)`, o.n + ' 참고 금액')}</td>
      <td class="xs-in xs-oxcell">${ox(o.on, `xsOptOX(${oi},this.value)`)}</td>
      <td class="xs-note">${esc(o.f)}</td>
    </tr>`).join('');

  // ── Ⅲ. 특이사항
  const spRows = specials.map((s, i) => `<tr class="xs-row${Number(s.q) > 0 ? '' : ' idle'}" data-k="s" data-i="${i}">
      <td class="xs-in xs-kindcell"><select class="xs-kind" onchange="xsSp(${i},'kind',this.value)" aria-label="구분">
        <option${s.kind === '감액' ? '' : ' selected'}>추가</option><option${s.kind === '감액' ? ' selected' : ''}>감액</option></select></td>
      <td class="xs-in"><input class="xs-spname" type="text" list="xs-sp-list" value="${esc(s.n)}" placeholder="목록에서 고르거나 입력" onchange="xsSpName(${i},this.value)" aria-label="특이사항 항목"></td>
      <td class="xs-in"><input type="text" value="${esc(s.d)}" placeholder="위치·내용" onchange="xsSp(${i},'d',this.value)" aria-label="내용·위치"></td>
      <td class="xs-num xs-amt"></td>
      <td class="xs-in xs-num">${money(s.p || '', `xsSp(${i},'p',parseWon(this.value))`, '단가')}</td>
      <td class="xs-in xs-qtycell"><input class="xs-qty" type="number" min="0" step="0.5" value="${Number(s.q) > 0 ? s.q : ''}" onchange="xsSp(${i},'q',Number(this.value)||0)" aria-label="수량"></td>
      <td class="xs-in xs-unitcell"><input class="xs-unit" type="text" value="${esc(s.u)}" onchange="xsSp(${i},'u',this.value)" aria-label="단위"></td>
      <td class="xs-delcell"><button class="xs-del" onclick="xsSpDel(${i})" title="줄 삭제" aria-label="줄 삭제">✕</button></td>
    </tr>`).join('');

  const lib = getSpLib();
  el.innerHTML = `
  <div class="xs-tabs" role="tablist">${BASE_TEMPLATES.map(tab).join('')}${getUserTemplates().map(tab).join('')}</div>
  <div class="xs-tools">
    ${typeof openVendor === 'function' ? '<button class="xs-tool-vendor" onclick="openVendor()">📒 업체 단가표</button>' : ''}
    <button onclick="saveAsTemplate()">💾 지금 구성을 템플릿으로 저장</button>
    <button onclick="openExtract()">🧩 저장된 견적으로 기본 견적서 만들기</button>
    <button onclick="exitTplMode()">🧮 일반 견적 계산기로</button>
  </div>
  <div class="xs-wrap"><div class="xs-sheet">
    <div class="xs-company">${esc(typeof COMPANY !== 'undefined' ? COMPANY.name : '라인 인테리어')}</div>
    <h2 class="xs-title">${esc(tplState.name)} 기본 견적서</h2>
    <div class="xs-basis">${esc(tplState.basis)}</div>

    <table class="xs-info">${info}</table>

    <h3 class="xs-sec">Ⅰ. 기본 공사 <span>— 안 하는 항목은 적용 칸을 X로 바꾸면 빠집니다</span></h3>
    <table class="xs-table">
      <colgroup><col class="c-proc"><col class="c-item"><col><col class="c-amt"><col class="c-tot"><col class="c-base"><col class="c-ox"><col class="c-note"></colgroup>
      <thead><tr><th>품명</th><th>항목</th><th>내용 (기본 규격·수량)</th><th>상세 견적가</th><th>총 견적가<br><small>(고객에게 보임)</small></th><th>기본 금액</th><th>적용(O/X)</th><th>기존 견적 범위 · 포함 빈도 · 비고</th></tr></thead>
      <tbody>${baseRows}</tbody>
      <tfoot><tr class="xs-sub"><td colspan="4">A. 기본 공사 소계</td><td class="xs-num" id="xs-A"></td><td colspan="3"></td></tr></tfoot>
    </table>

    <h3 class="xs-sec">Ⅱ. 선택 옵션 <span>— 적용 칸에 O를 넣으면 견적가에 들어갑니다</span></h3>
    <table class="xs-table">
      <colgroup><col class="c-proc"><col class="c-item"><col><col class="c-amt"><col class="c-base"><col class="c-ox"><col class="c-note"></colgroup>
      <thead><tr><th>구분</th><th>항목</th><th>내용</th><th>견적가</th><th>참고 금액</th><th>적용(O/X)</th><th>포함 빈도 · 근거</th></tr></thead>
      <tbody>${optRows}</tbody>
      <tfoot><tr class="xs-sub"><td colspan="3">B. 선택 옵션 소계</td><td class="xs-num" id="xs-B"></td><td colspan="3"></td></tr></tfoot>
    </table>

    <h3 class="xs-sec">Ⅲ. 특이사항 (현장 조건) <span>— 해당하는 줄에 수량만 넣으세요</span></h3>
    <p class="xs-hint">자주 나오는 항목은 미리 넣어 두었습니다 (수량 비우면 0원). 다른 항목은 「+ 줄 추가」 후 항목 칸에서 목록을 고르거나 직접 입력하세요. 목록에서 고르면 단가·단위가 자동으로 들어옵니다.</p>
    <table class="xs-table xs-sp">
      <colgroup><col class="c-kind"><col class="c-spname"><col><col class="c-amt"><col class="c-base"><col class="c-qty"><col class="c-unit"><col class="c-del"></colgroup>
      <thead><tr><th>구분</th><th>항목</th><th>내용·위치</th><th>견적가</th><th>단가</th><th>수량</th><th>단위</th><th></th></tr></thead>
      <tbody>${spRows}</tbody>
      <tfoot>
        <tr><td colspan="8" class="xs-addcell"><button class="xs-add" onclick="xsSpAdd()">+ 줄 추가</button></td></tr>
        <tr class="xs-sub"><td colspan="3">C. 특이사항 소계</td><td class="xs-num" id="xs-C"></td><td colspan="4"></td></tr>
      </tfoot>
    </table>
    <datalist id="xs-sp-list">${lib.map(x => `<option value="${esc(x.n)}">${esc(x.cat)}${x.p ? ' · ' + man(x.p) + '/' + esc(x.u) : ''}</option>`).join('')}</datalist>

    <table class="xs-totals">
      <tr><th>할인 / 네고 (마이너스로 입력)</th><td class="xs-in xs-num"><input class="xs-money" id="xs-nego" type="text" inputmode="numeric"
        value="${negoAmt ? '-' + fmt(negoAmt) : '0'}" onfocus="this.select()" onchange="xsNego(this.value)" aria-label="할인 금액"></td><td></td></tr>
      <tr><th>감리비 (업체이윤) = (A+B+C) × 이윤율</th><td class="xs-num" id="xs-fee"></td>
        <td class="xs-in xs-ratecell"><input id="xs-rate" type="number" min="0" max="30" step="1" value="${tplState.feeRate || 0}" onchange="xsRate(this.value)" aria-label="이윤율"> % <small>← 이윤율</small></td></tr>
      <tr class="xs-sub"><th>총 공사 금액 (현금 기준, 부가세 별도)</th><td class="xs-num" id="xs-total"></td><td></td></tr>
      <tr><th>부가세 (영수증·계산서·카드 +10%)</th><td class="xs-num" id="xs-vat"></td><td></td></tr>
      <tr class="xs-sub"><th>견적 금액 (부가세 포함)</th><td class="xs-num" id="xs-grand"></td><td></td></tr>
    </table>

    <table class="xs-pay">
      ${[['deposit', '계약금'], ['mid', '중도금'], ['final', '잔금']].map(([k, l]) => `<tr><th>${l}</th>
        <td class="xs-in xs-pct"><input type="number" min="0" max="100" value="${payRatio[k]}" onchange="xsPay()" aria-label="${l} 비율"> %</td>
        <td class="xs-num" id="xs-pay-${k}"></td></tr>`).join('')}
    </table>
    <p class="xs-warn" id="xs-pay-err"></p>

    <div class="xs-foot">
      <div>* 부가세 별도 견적입니다. 실제 견적은 현장 실측 후 변동될 수 있습니다.</div>
      <div>* 본 업체는 전문 기공 인력만 시공합니다. (연습생, 외국인 인력 제한)</div>
      <div>* 파란 금액은 기존 견적의 중간값입니다. 자재 등급·현장 상황에 맞게 조정하세요. 계약금·중도금·잔금은 견적 금액(부가세 포함) 기준.</div>
      <div class="xs-ver">화면 버전 ${esc(document.querySelector('meta[name="app-version"]')?.content || '')}</div>
    </div>
  </div></div>`;
  xsFill();
}

/* ── 숫자 칸 채우기 (다시 그리지 않고 값만 바꿈 → 입력 중인 칸 유지) ── */
function xsFill() {
  const root = document.getElementById('tpl-content');
  if (!root || !tplState) return;
  let A = 0, B = 0, C = 0;
  root.querySelectorAll('tr[data-k]').forEach(tr => {
    const k = tr.dataset.k, i = +tr.dataset.i;
    const cell = tr.querySelector('.xs-amt');
    if (k === 'b') {
      const blk = tplState.blocks[+tr.dataset.b];
      const it = blk.items[i];
      tr.classList.toggle('x', !it.on);
      // 상세 견적가: 줄마다 따로 금액이 있을 때만. 공정 통비용(아래 「포함」 줄이 딸린 맨 윗줄)은 총 견적가로만 보여줌
      if (it.p == null) cell.innerHTML = '<span class="xs-incl">포함</span>';
      else {
        const a = it.on ? it.p : 0; A += a;
        if (xsIsBlockHead(blk, i)) cell.innerHTML = '<span class="xs-incl">공정 통비용 →</span>';
        else cell.textContent = fmt(a);
      }
    } else if (k === 'o') {
      const o = tplState.options[i];
      tr.classList.toggle('off', !o.on);
      const a = o.on ? o.p : 0; B += a; cell.textContent = fmt(a);
    } else if (k === 's') {
      const s = specials[i];
      const a = spLineAmt(s); C += a;
      tr.classList.toggle('idle', !(Number(s.q) > 0));
      tr.classList.toggle('minus', s.kind === '감액');
      cell.textContent = fmt(a);
    }
  });
  // 총 견적가 (공정 합계)
  tplState.blocks.forEach((b, bi) => {
    const el = document.getElementById('xs-tot-' + bi);
    if (el) el.textContent = fmt(b.items.reduce((s, x) => s + (x.on && x.p != null ? x.p : 0), 0));
  });
  const t = calcTotals();
  const fee = t.sub - (A + B + C);
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = fmt(v); };
  set('xs-A', A); set('xs-B', B); set('xs-C', C); set('xs-fee', fee);
  set('xs-total', t.subAfterNego); set('xs-vat', t.vatAfterNego); set('xs-grand', t.totalAfterNego);
  ['deposit', 'mid', 'final'].forEach(k => set('xs-pay-' + k, Math.round(t.totalAfterNego * payRatio[k] / 100)));
}
function xsChanged() { xsFill(); calc(); }

/* ── 입력 처리 ── */
function xsClient(id, v) {
  const top = document.getElementById(id);
  if (!top) return;
  top.value = v;
  top.dispatchEvent(new Event('input', { bubbles: true })); // 견적서 미리보기·요약 갱신
}
function xsBaseAmt(bi, ii, v) { tplState.blocks[bi].items[ii].p = parseWon(v); xsChanged(); }
function xsBaseOX(bi, ii, v) {
  const b = tplState.blocks[bi], on = v === 'O';
  b.items[ii].on = on;
  // 공정 맨 윗줄(금액 줄)을 바꾸면 「포함」 줄도 같이 넣고 뺌
  if (xsIsBlockHead(b, ii)) {
    b.items.forEach((it, j) => {
      if (it.p != null) return;
      it.on = on;
      const sel = document.querySelector(`#tpl-content tr[data-k="b"][data-b="${bi}"][data-i="${j}"] .xs-ox`);
      if (sel) sel.value = v;
    });
  }
  xsChanged();
}
function xsOptAmt(oi, v) { tplState.options[oi].p = parseWon(v); xsChanged(); }
function xsOptOX(oi, v) { tplState.options[oi].on = v === 'O'; xsChanged(); }
function xsSp(i, key, v) { specials[i][key] = v; xsChanged(); }
function xsSpName(i, name) {
  const s = specials[i];
  s.n = name.trim();
  const x = findSp(s.n);
  const tr = document.querySelector(`#tpl-content tr[data-k="s"][data-i="${i}"]`);
  if (x) {
    Object.assign(s, { kind: x.kind || '추가', u: x.u || '식', p: Number(x.p) || 0 });
    if (tr) {
      tr.querySelector('.xs-kind').value = s.kind;
      tr.querySelector('.xs-unit').value = s.u;
      tr.querySelector('.xs-money').value = s.p ? fmt(s.p) : '';
      if (!(Number(s.q) > 0)) { s.q = 1; tr.querySelector('.xs-qty').value = 1; }
    }
  }
  xsChanged();
}
function xsSpAdd() {
  specials.push({ n: '', d: '', kind: '추가', q: 0, p: 0, u: '식' });
  renderSheet(); calc();
  const rows = document.querySelectorAll('#tpl-content tr[data-k="s"] .xs-spname');
  rows[rows.length - 1]?.focus();
}
function xsSpDel(i) { specials.splice(i, 1); renderSheet(); calc(); }
function xsNego(v) {
  negoAmt = Math.abs(parseWon(v));
  document.getElementById('xs-nego').value = negoAmt ? '-' + fmt(negoAmt) : '0';
  xsChanged();
}
function xsRate(v) { tplState.feeRate = Math.max(0, Math.min(30, Number(v) || 0)); xsChanged(); }
function xsPay() {
  // 세 칸을 함께 읽음 (하나씩 고치는 중간에는 합계가 100이 아닐 수 있음)
  const ins = document.querySelectorAll('#tpl-content .xs-pct input');
  const next = { deposit: Number(ins[0].value) || 0, mid: Number(ins[1].value) || 0, final: Number(ins[2].value) || 0 };
  const sum = next.deposit + next.mid + next.final;
  document.getElementById('xs-pay-err').textContent = sum === 100 ? '' : `계약금+중도금+잔금 합계가 ${sum}%입니다. 100%가 되어야 반영됩니다.`;
  ['deposit', 'mid', 'final'].forEach(x => { const el = document.getElementById('pay-' + x); if (el) el.value = next[x]; });
  if (sum === 100) { updatePayRatio(); xsFill(); }
}
