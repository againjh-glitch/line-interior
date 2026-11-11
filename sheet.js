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
  // 원가·상세내역 칸 (내부용 — 고객 공유·견적서 출력에는 안 나감)
  const costIn = (k, bi, ii, x, label) => `<td class="xs-in xs-num xs-costcell">${money(x.c == null ? '' : x.c, `xsCost('${k}',${bi},${ii},this.value)`, label + ' 원가')}</td>
      <td class="xs-in xs-memocell"><textarea class="xs-memo" rows="2" onchange="xsMemo('${k}',${bi},${ii},this.value)" aria-label="${esc(label)} 상세내역">${esc(x.m || '')}</textarea></td>`;
  // 내용(고객에게 보임)·메모(내부용) — 칸에서 바로 고침
  const descIn = (k, bi, ii, v, label) => `<textarea class="xs-dtext" rows="1" oninput="xsAutoH(this)" onchange="xsDesc('${k}',${bi},${ii},this.value)" aria-label="${esc(label)} 내용">${esc(v || '')}</textarea>`;
  const noteIn = (k, bi, ii, v, label, hint) => `<textarea class="xs-ntext" rows="1" oninput="xsAutoH(this)" onchange="xsNote('${k}',${bi},${ii},this.value)" placeholder="${esc(hint || '메모')}" title="${esc(hint || '')}" aria-label="${esc(label)} 메모">${esc(v || '')}</textarea>`;
  const money = (v, call, label) => `<input class="xs-money" type="text" inputmode="numeric" value="${v === '' ? '' : fmt(v)}" onfocus="this.select()" onchange="${call}" aria-label="${esc(label)}">`;

  // ── 고객 정보
  const info = SHEET_CLIENT.map(([id, label, type, ph]) => {
    const v = document.getElementById(id)?.value || '';
    return `<tr><th>${label}</th><td class="xs-in"><input type="${type}" id="xs-${id}" value="${esc(v)}" placeholder="${esc(ph)}"
      oninput="xsClient('${id}', this.value)"></td></tr>`;
  }).join('');

  // ── Ⅰ. 기본 공사 — 엑셀과 같은 배치: 품명 | 항목 | 내용 | 견적가 | 원가 | 상세내역 | 적용 | 비고
  //  견적가: 금액 줄과 그 아래 「포함」 줄들을 한 칸으로 합쳐 보여줌(통비용). 따로 금액이 있는 줄은 따로 (나눠서).
  const baseRows = tplState.blocks.map((b, bi) => {
    const span = xsGroupSpans(b);
    return b.items.map((i, ii) => {
      const parts = [];
      if (ii === 0 && b.range) parts.push('기존 ' + b.range);
      if (i.f) parts.push(i.f);
      if (i.note) parts.push(i.note);
      const tools = i.p == null
        ? `<button class="xs-split" onclick="xsSplit(${bi},${ii})" title="이 줄만 따로 금액을 받기 (다른 사람이 작업하거나 고객이 뺄 수 있게)">✂ 따로 금액</button>`
        : (ii > 0 && b.items.slice(0, ii).some(x => x.p != null)
          ? `<button class="xs-split" onclick="xsMerge(${bi},${ii})" title="이 줄 금액을 윗줄 금액에 합쳐 통비용으로">⤴ 윗줄에 합치기</button>` : '');
      const priceCell = span[ii] === 0 ? ''
        : i.p == null ? `<td class="xs-price none" rowspan="${span[ii]}"></td>`
        : `<td class="xs-in xs-num xs-price" rowspan="${span[ii]}" data-pb="${bi}" data-pa="${ii}" data-pz="${ii + span[ii] - 1}">${money(i.p, `xsBaseAmt(${bi},${ii},this.value)`, i.n + ' 견적가')}
            ${span[ii] > 1 ? `<div class="xs-grp">${span[ii]}줄 통비용</div>` : ''}
            <div class="xs-cellops">${span[ii] > 1 ? `<button onclick="xsUnmerge(${bi},${ii})" title="합쳐진 칸을 줄마다 따로 금액으로 (원가 비율로 나눔)">✂ 나누기</button>` : ''}${b.items.slice(0, ii).some(x => x.p != null)
              ? `<button onclick="xsMergeRange(${bi},${ii - 1},${ii + span[ii] - 1})" title="위 칸과 합쳐 통비용 한 칸으로">⤴ 위와 합치기</button>` : ''}</div></td>`;
      return `<tr class="xs-row${i.on ? '' : ' x'}${i.p == null ? ' incl' : ''}${ii === 0 ? ' xs-bstart' : ''}${ii === b.items.length - 1 ? ' xs-bend' : ''}" data-k="b" data-b="${bi}" data-i="${ii}">
        ${ii === 0 ? `<td class="xs-proc" rowspan="${b.items.length}">${esc(b.proc)}${b.proc === '가구' && typeof openFurn === 'function'
          ? `<button class="xs-furn-btn" onclick="openFurn()" title="싱크대·붙박이장 사이즈로 예상 견적">🧮 사이즈로<br>계산</button>` : ''}${b.proc === '도배·바닥재' && typeof openVendor === 'function'
          ? `<button class="xs-furn-btn vd" onclick="openVendor('바닥재')" title="업체 바닥재 단가에서 고르기">📒 바닥재<br>고르기</button>` : ''}
          <button class="xs-add-btn" onclick="xsAddItem(${bi})" title="「${esc(b.proc)}」에 항목 한 줄 추가">＋ 항목 추가</button>
          <div class="xs-ptot" id="xs-tot-${bi}"></div></td>` : ''}
        <td class="xs-item"><textarea class="xs-ntitle" rows="1" data-v="${esc(i.n)}" oninput="xsAutoH(this)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}" onchange="xsName(${bi},${ii},this.value)" aria-label="항목 이름" placeholder="항목 이름">${esc(i.n)}</textarea><button class="xs-del" onclick="xsDelItem(${bi},${ii})" title="이 줄 지우기">✕</button>${i.p != null && typeof openBreakdown === 'function' ? `<button class="xs-bd-btn${i.bd ? ' on' : ''}" onclick="openBreakdown('b',${bi},${ii})" title="자재·인건비 내역으로 계산">${i.bd ? '🧮 내역' : '🧮'}</button>` : ''}</td>
        <td class="xs-in xs-desc">${descIn('b', bi, ii, i.d, i.n)}</td>
        ${priceCell}
        ${(() => { const [cTd, mTd] = costIn('b', bi, ii, i, i.n).split(/(?<=<\/td>)/);
          return cTd + mTd + (span[ii] ? `<td class="xs-mg xs-int" rowspan="${span[ii]}" id="xs-mg-${bi}-${ii}"></td>` : ''); })()}
        <td class="xs-in xs-oxcell">${ox(i.on, `xsBaseOX(${bi},${ii},this.value)`)}</td>
        <td class="xs-in xs-note">${noteIn('b', bi, ii, i.note, i.n, parts.filter(x => x !== i.note).join(' · '))}${tools}</td>
      </tr>`;
    }).join('');
  }).join('');

  // ── Ⅱ. 선택 옵션
  // 기본 공사에 이미 들어 있는 옵션(예: 샷시를 기본에 넣었는데 옵션에도 「샷시 전체 교체」)은 숨김 — 적용(O)한 옵션은 그대로 보임
  const dupOf = tplState.options.map(o => o.on ? null : xsOptDup(o));
  const hidden = tplState.options.filter((o, oi) => dupOf[oi]);
  const optRows = tplState.options.map((o, oi) => dupOf[oi] && !xsShowDupOpts ? '' : `<tr class="xs-row${o.on ? '' : ' off'}${dupOf[oi] ? ' dup' : ''}" data-k="o" data-i="${oi}">
      <td class="xs-proc sm">선택</td>
      <td class="xs-item"><textarea class="xs-ntitle" rows="1" data-v="${esc(o.n)}" oninput="xsAutoH(this)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}" onchange="tplState.options[${oi}].n=this.value.trim();calc()" aria-label="옵션 이름" placeholder="옵션 이름">${esc(o.n)}</textarea>${typeof openBreakdown === 'function' ? `<button class="xs-bd-btn${o.bd ? ' on' : ''}" onclick="openBreakdown('o',-1,${oi})" title="자재·인건비 내역으로 계산">${o.bd ? '🧮 내역' : '🧮'}</button>` : ''}</td>
      <td class="xs-in xs-desc">${descIn('o', -1, oi, o.d, o.n)}</td>
      <td class="xs-in xs-num xs-price">${money(o.p, `xsOptAmt(${oi},this.value)`, o.n + ' 견적가')}</td>
      ${(() => { const [cTd, mTd] = costIn('o', -1, oi, o, o.n).split(/(?<=<\/td>)/); return cTd + mTd + `<td class="xs-mg xs-int" id="xs-mgo-${oi}"></td>`; })()}
      <td class="xs-in xs-oxcell">${ox(o.on, `xsOptOX(${oi},this.value)`)}</td>
      <td class="xs-in xs-note">${dupOf[oi] ? `<b class="xs-dup">기본 공사 「${esc(dupOf[oi])}」에 있음</b>` : ''}${noteIn('o', -1, oi, o.note, o.n, o.f)}</td>
    </tr>`).join('');
  const dupNote = hidden.length ? `<p class="xs-dupnote">기본 공사에 이미 있어서 숨긴 옵션 ${hidden.length}개: ${hidden.map(o => esc(o.n)).join(', ')}
      <button class="xs-duptoggle" onclick="xsShowDupOpts=!xsShowDupOpts;renderTpl()">${xsShowDupOpts ? '숨기기' : '보이기'}</button></p>` : '';

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
  ${typeof qlTabsHtml === 'function' ? qlTabsHtml() : ''}
  <div class="xs-qbar" id="xs-qbar">${typeof qlBarHtml === 'function' ? qlBarHtml() : ''}</div>
  <div class="xs-tools">
    ${typeof openVendor === 'function' ? '<button class="xs-tool-vendor" onclick="openVendor()">📒 업체 단가표</button>' : ''}
    <a class="xs-tool-bath" href="bath.html">🛁 욕실 자재 견적서</a>
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
    <p class="xs-hint">🔒 <b>원가·상세내역</b> 칸은 내부용입니다 (고객 공유·견적서 출력에 안 나감). 기존 엑셀 「원가」 열의 중간값을 넣어 두었고, 지난 견적에서 원가가 다른 줄에 몰려 적혀 맞지 않는 공정은 비워 두고 상세내역에 「지난 원가」로 적어 두었어요. 현장마다 고쳐 쓰세요. (상세내역 예: 「2명300+6」, 「목수 6품」, 「2칸 방수 40만」)</p>
    <div class="xs-scroll"><table class="xs-table xs-base">
      <colgroup><col class="c-proc"><col class="c-item"><col><col class="c-price"><col class="c-cost"><col class="c-memo"><col class="c-mg"><col class="c-ox"><col class="c-note"></colgroup>
      <thead><tr><th>품명</th><th>항목</th><th>내 용</th><th>견적가<br><small>(고객에게 보임)</small></th><th class="xs-int">원가 🔒</th><th class="xs-int">상세내역 🔒</th><th class="xs-int">원가 합 · 마진 🔒<br><small>(견적가 칸마다)</small></th><th>적용<br>(O/X)</th><th>메모 🔒</th></tr></thead>
      <tbody>${baseRows}</tbody>
      <tfoot><tr class="xs-sub"><td colspan="3">A. 기본 공사 소계</td><td class="xs-num" id="xs-A"></td><td class="xs-num xs-int" id="xs-A-cost"></td><td class="xs-int"></td><td class="xs-mg xs-int" id="xs-A-margin"></td><td colspan="2"></td></tr></tfoot>
    </table></div>

    <h3 class="xs-sec">Ⅱ. 선택 옵션 <span>— 적용 칸에 O를 넣으면 견적가에 들어갑니다</span></h3>
    <div class="xs-scroll"><table class="xs-table xs-opt">
      <colgroup><col class="c-proc"><col class="c-item"><col><col class="c-price"><col class="c-cost"><col class="c-memo"><col class="c-mg"><col class="c-ox"><col class="c-note"></colgroup>
      <thead><tr><th>구분</th><th>항목</th><th>내 용</th><th>견적가</th><th class="xs-int">원가 🔒</th><th class="xs-int">상세내역 🔒</th><th class="xs-int">원가 합 · 마진 🔒<br><small>(견적가 칸마다)</small></th><th>적용<br>(O/X)</th><th>메모 🔒</th></tr></thead>
      <tbody>${optRows}</tbody>
      <tfoot><tr class="xs-sub"><td colspan="3">B. 선택 옵션 소계 <small>(적용 O만)</small></td><td class="xs-num" id="xs-B"></td><td class="xs-num xs-int" id="xs-B-cost"></td><td class="xs-int"></td><td class="xs-mg xs-int" id="xs-B-margin"></td><td colspan="2"></td></tr></tfoot>
    </table>${dupNote}</div>

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
      <tr><th>현장관리비·일반관리비 = (A+B+C) × 관리비율</th><td class="xs-num" id="xs-fee"></td>
        <td class="xs-in xs-ratecell"><input id="xs-rate" type="number" min="0" max="30" step="1" value="${tplState.feeRate || 0}" onchange="xsRate(this.value)" aria-label="이윤율"> % <small>← 이윤율</small></td></tr>
      <tr class="xs-sub"><th>총 공사 금액 (현금 기준, 부가세 별도)</th><td class="xs-num" id="xs-total"></td><td></td></tr>
      <tr><th>부가세 (영수증·계산서·카드 +10%)</th><td class="xs-num" id="xs-vat"></td><td></td></tr>
      <tr class="xs-sub"><th>견적 금액 (부가세 포함)</th><td class="xs-num" id="xs-grand"></td><td></td></tr>
    </table>

    <div class="xs-profit" id="xs-profit"></div>

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
  requestAnimationFrame(xsAutoAll);
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
      const it = tplState.blocks[+tr.dataset.b].items[i];
      tr.classList.toggle('x', !it.on);
      if (it.p != null && it.on) A += it.p;
    } else if (k === 'o') {
      const o = tplState.options[i];
      tr.classList.toggle('off', !o.on);
      if (o.on) B += o.p;
    } else if (k === 's') {
      const s = specials[i];
      const a = spLineAmt(s); C += a;
      tr.classList.toggle('idle', !(Number(s.q) > 0));
      tr.classList.toggle('minus', s.kind === '감액');
      cell.textContent = fmt(a);
    }
  });
  // 총 견적가 (공정 합계) + 그 아래 내부용 원가 합·마진
  let AC = 0, BC = 0, miss = 0;
  tplState.blocks.forEach((b, bi) => {
    const el = document.getElementById('xs-tot-' + bi);
    const tot = b.items.reduce((s, x) => s + (x.on && x.p != null ? x.p : 0), 0);
    const on = b.items.filter(x => x.on);
    const cost = on.reduce((s, x) => s + (Number(x.c) || 0), 0);
    if (on.length && !on.some(x => x.c != null)) miss++;
    AC += cost;
    if (el) el.innerHTML = `<span title="이 공정 견적가 합계">${man(tot)}</span>${cost ? `<div class="xs-tot-cost${cost > tot ? ' bad' : ''}" title="내부용 — 고객에게 안 보임">원가 ${man(cost)}<br>마진 ${xsPct(tot, cost)}</div>` : ''}`;
  });
  tplState.options.forEach(o => { if (o.on) BC += Number(o.c) || 0; });
  const setH = (id, h) => { const e = document.getElementById(id); if (e) e.innerHTML = h; };
  setH('xs-A-cost', AC ? fmt(AC) : ''); setH('xs-A-margin', AC ? xsMgHtml(A, AC, true) : '');
  setH('xs-B-cost', BC ? fmt(BC) : ''); setH('xs-B-margin', BC ? xsMgHtml(B, BC, true) : '');
  // 견적가 칸마다 원가 합 · 마진 (통비용이면 묶인 줄 원가를 모두 더함)
  let noCost = 0;
  tplState.blocks.forEach((b, bi) => {
    const span = xsGroupSpans(b);
    span.forEach((n, ii) => {
      if (!n) return;
      const grp = b.items.slice(ii, ii + n).filter(x => x.on);
      const price = b.items[ii].on && b.items[ii].p != null ? b.items[ii].p : 0;
      const cost = grp.reduce((t, x) => t + (Number(x.c) || 0), 0);
      if (price > 0 && !grp.some(x => x.c != null)) noCost++;
      setH(`xs-mg-${bi}-${ii}`, xsMgHtml(price, cost, false, grp.some(x => x.c != null)));
    });
  });
  if (AC && noCost) setH('xs-A-margin', xsMgHtml(A, AC, true) + `<div class="xs-mg-none">원가 미입력 ${noCost}칸 포함 — 실제 마진은 더 낮음</div>`);
  tplState.options.forEach((o, oi) => setH(`xs-mgo-${oi}`, o.on ? xsMgHtml(o.p || 0, Number(o.c) || 0, false, o.c != null) : ''));
  const t = calcTotals();
  const fee = t.sub - (A + B + C);
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = fmt(v); };
  set('xs-A', A); set('xs-B', B); set('xs-C', C); set('xs-fee', fee);
  const cost = AC + BC;
  setH('xs-profit', cost ? `🔒 <b>내부 확인</b> · 원가 합 ${fmt(cost)}원 → 예상 이익 <b>${fmt(t.subAfterNego - cost)}원</b> (현금가 기준 마진 ${xsPct(t.subAfterNego, cost)})${miss ? ` · <span class="xs-miss">원가 비어 있는 공정 ${miss}곳</span>` : ''}<small>특이사항은 원가에 안 들어감</small>` : '');
  set('xs-total', t.subAfterNego); set('xs-vat', t.vatAfterNego); set('xs-grand', t.totalAfterNego);
  ['deposit', 'mid', 'final'].forEach(k => set('xs-pay-' + k, Math.round(t.totalAfterNego * payRatio[k] / 100)));
}
let xsShowDupOpts = false;
// 옵션이 기본 공사에 이미 있는지 — 있으면 그 공정·항목 이름을 돌려줌
//  ① 옵션 첫 단어가 공정 이름 (예: 「샷시 전체 교체」 ↔ 샷시 공정)
//  ② 항목 이름의 단어가 모두 옵션 이름에 있음 (예: 「붙박이·수납장」 ↔ 붙박이장, 욕실 수납장은 제외)
//  ③ 다른 이름으로 들어가는 것 (중문 ↔ 현관, 도어락 ↔ 인터폰·비디오폰)
const XS_OPT_STOP = /^(전체|교체|설치|추가|시공|기본|일반|및)$/;
const XS_OPT_ALIAS = { '중문': ['중문', /^현관$/], '도어락': ['도어락', '인터폰', '비디오폰'] };
const xsWords = t => String(t || '').split(/[\s·,/()+]+/).map(w => w.replace(/장$/, '')).filter(w => w.length >= 2 && !XS_OPT_STOP.test(w));
function xsOptDup(o) {
  const ow = xsWords(o.n);
  if (!ow.length) return null;
  const alias = XS_OPT_ALIAS[String(o.n).trim()];
  for (const b of tplState.blocks) {
    if (!b.items.some(i => i.on)) continue;
    const pw = xsWords(b.proc);
    if (pw.includes(ow[0]) && pw.every(w => ow.includes(w))) return b.proc;
    const bath = /욕실|화장실/.test(b.proc) && !/욕실|화장실/.test(o.n);
    for (const i of b.items) {
      if (!i.on) continue;
      if (alias && alias.some(a => a instanceof RegExp ? a.test(i.n.trim()) : i.n.includes(a))) return `${b.proc} › ${i.n}`;
      const iw = xsWords(i.n);
      if (!bath && iw.length && iw.every(w => ow.includes(w))) return `${b.proc} › ${i.n}`;
    }
  }
  return null;
}
// 견적가 칸 합치기: 금액 줄 하나 + 그 아래 「포함」 줄들 = 한 칸 (span[ii] = 그 칸이 덮는 줄 수, 0 = 위 칸에 합쳐짐)
function xsGroupSpans(b) {
  const span = b.items.map(() => 0);
  let head = -1;
  b.items.forEach((x, k) => {
    if (x.p != null || head < 0) { head = k; span[k] = 1; } else span[head]++;
  });
  return span;
}
// ✂ 포함 줄을 따로 금액으로 (윗줄 통비용에서 빼서 나눔 — 금액은 0부터 직접 넣기)
function xsSplit(bi, ii) {
  const it = tplState.blocks[bi].items[ii];
  it.p = 0; it.on = true;
  renderTpl(); calc();
  setTimeout(() => document.querySelector(`tr[data-b="${bi}"][data-i="${ii}"] .xs-price input`)?.focus(), 30);
  showToast(`✂ 「${it.n}」을 따로 금액으로 나눴어요. 금액을 넣고, 윗줄 통비용에서 그만큼 빼 주세요`);
}
// ⤴ 따로 금액 줄을 윗줄 통비용에 합치기 (금액은 윗줄에 더함)
function xsMerge(bi, ii) {
  const items = tplState.blocks[bi].items;
  let h = ii - 1; while (h >= 0 && items[h].p == null) h--;
  if (h < 0) return;
  const it = items[ii];
  if (it.on) items[h].p = (items[h].p || 0) + (it.p || 0);
  if (it.c != null) items[h].c = (Number(items[h].c) || 0) + Number(it.c), it.c = null;
  it.p = null;
  renderTpl(); calc();
  showToast(`⤴ 「${it.n}」 금액을 「${items[h].n}」 통비용에 합쳤어요`);
}
// ── 엑셀처럼 견적가 칸 합치기 / 나누기 ──
//  · 견적가 칸을 마우스로 끌어서(또는 Shift+클릭) 여러 칸 선택 → 「셀 합치기」
//  · 합쳐진 칸 → 「✂ 나누기」 (원가가 있으면 원가 비율로, 없으면 첫 줄에 금액)
function xsGroupOf(bi, ii) { // ii 줄이 속한 칸 [첫 줄, 끝 줄]
  const items = tplState.blocks[bi].items, span = xsGroupSpans(tplState.blocks[bi]);
  let a = ii; while (a > 0 && span[a] === 0) a--;
  return [a, a + Math.max(span[a], 1) - 1];
}
function xsMergeRange(bi, from, to) {
  const items = tplState.blocks[bi].items;
  const a = xsGroupOf(bi, Math.min(from, to))[0], z = xsGroupOf(bi, Math.max(from, to))[1];
  if (a === z || xsGroupOf(bi, a)[1] >= z) return;
  const part = items.slice(a, z + 1);
  const sum = part.reduce((t, x) => t + (x.p != null && x.on ? Number(x.p) || 0 : 0), 0);
  part.forEach((x, k) => { x.p = k === 0 ? sum : null; if (sum || x.on) x.on = true; });
  xsSelClear(); renderTpl(); calc();
  showToast(`⤴ ${part.length}줄을 견적가 한 칸(${fmt(sum)}원)으로 합쳤어요`);
}
function xsUnmerge(bi, ii, quiet) {
  const items = tplState.blocks[bi].items, [a, z] = xsGroupOf(bi, ii);
  if (a === z) return;
  const part = items.slice(a, z + 1), total = Number(items[a].p) || 0;
  const costSum = part.reduce((t, x) => t + (Number(x.c) || 0), 0);
  let rest = total;
  part.forEach((x, k) => {
    if (k === 0) return;
    x.p = costSum > 0 && total > 0 ? Math.round(total * (Number(x.c) || 0) / costSum / 10000) * 10000 : 0;
    rest -= x.p;
  });
  items[a].p = rest;
  if (quiet) return;
  xsSelClear(); renderTpl(); calc();
  showToast(costSum > 0 ? `✂ ${part.length}줄로 나눴어요 — 원가 비율로 나눴으니 금액을 확인하세요 (합계 ${fmt(total)}원 그대로)`
    : `✂ ${part.length}줄로 나눴어요 — 첫 줄에 ${fmt(total)}원, 나머지는 0원이에요. 금액을 넣고 첫 줄에서 빼 주세요`);
}
// 선택 — 엑셀처럼 견적가·항목 칸을 끌어서(드래그) 고르기, Shift+클릭으로 넓히기, 칸 하나만 눌러도 선택
let xsSel = null, xsDrag = null;
function xsSelClear() { xsSel = null; xsSelPaint(); }
function xsRowAt(el) { // 마우스 아래 줄 → {bi, row}
  const tr = el?.closest?.('.xs-sheet tr.xs-row[data-k="b"]');
  if (!tr) return null;
  const td = el.closest('td.xs-price[data-pb]');
  return td ? { bi: +td.dataset.pb, row: +td.dataset.pa } : { bi: +tr.dataset.b, row: +tr.dataset.i };
}
function xsSelPaint() {
  document.querySelectorAll('.xs-sheet .sel').forEach(x => x.classList.remove('sel'));
  let bar = document.getElementById('xs-selbar');
  if (!xsSel) { bar?.remove(); return; }
  const lo = Math.min(xsSel.a, xsSel.z), hi = Math.max(xsSel.a, xsSel.z);
  const cells = [...document.querySelectorAll(`td.xs-price[data-pb="${xsSel.bi}"]`)].filter(td => +td.dataset.pz >= lo && +td.dataset.pa <= hi);
  if (!cells.length) { bar?.remove(); return; }
  const first = +cells[0].dataset.pa, last = +cells[cells.length - 1].dataset.pz;
  cells.forEach(td => td.classList.add('sel'));
  document.querySelectorAll(`.xs-sheet tr.xs-row[data-k="b"][data-b="${xsSel.bi}"]`).forEach(tr => { if (+tr.dataset.i >= first && +tr.dataset.i <= last) tr.classList.add('sel'); });
  const items = tplState.blocks[xsSel.bi].items;
  const sum = cells.reduce((t, td) => t + (items[+td.dataset.pa].on ? Number(items[+td.dataset.pa].p) || 0 : 0), 0);
  const merged = cells.filter(td => +td.dataset.pz > +td.dataset.pa);
  if (!bar) { bar = document.createElement('div'); bar.id = 'xs-selbar'; document.body.appendChild(bar); }
  bar.innerHTML = `<b>${last - first + 1}줄 · ${cells.length}칸 선택</b> · 합계 ${fmt(sum)}원
    ${cells.length > 1 ? `<button class="go" onclick="xsMergeRange(${xsSel.bi},${first},${last})">⤴ 셀 합치기</button>` : ''}
    ${merged.length ? `<button class="go2" onclick="xsUnmergeSel()">✂ 셀 나누기</button>` : ''}
    ${cells.length < 2 && !merged.length ? '<span class="hint">아래로 끌어서 여러 칸을 고르세요</span>' : ''}
    <button onclick="xsSelClear()">취소</button>`;
  const r = cells[cells.length - 1].getBoundingClientRect();
  bar.style.top = (window.scrollY + r.bottom + 6) + 'px'; bar.style.left = (window.scrollX + Math.max(8, r.left - 120)) + 'px';
}
function xsUnmergeSel() { // 고른 칸 중 합쳐진 칸 모두 나누기
  if (!xsSel) return;
  const lo = Math.min(xsSel.a, xsSel.z), hi = Math.max(xsSel.a, xsSel.z), bi = xsSel.bi;
  const heads = [...document.querySelectorAll(`td.xs-price[data-pb="${bi}"]`)].filter(td => +td.dataset.pz >= lo && +td.dataset.pa <= hi && +td.dataset.pz > +td.dataset.pa).map(td => +td.dataset.pa);
  heads.reverse().forEach(h => xsUnmerge(bi, h, true));
  xsSelClear(); renderTpl(); calc();
  showToast(`✂ ${heads.length}칸을 줄마다 따로 금액으로 나눴어요 — 원가 비율로 나눴으니 금액을 확인하세요 (합계 그대로)`);
}
// 끌기: 견적가 칸 또는 「항목」 칸에서 누른 채 아래로 — 숫자·글자 위에서 시작해도 됨
document.addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.target.closest?.('#xs-selbar, button, select, .xs-dtext, .xs-ntext, .xs-memo')) return;
  const td = e.target.closest?.('.xs-sheet td.xs-price[data-pb], .xs-sheet tr.xs-row[data-k="b"] td.xs-item, .xs-sheet tr.xs-row[data-k="b"] td.xs-costcell');
  if (!td) { if (xsSel) xsSelClear(); return; }
  const at = xsRowAt(td);
  if (e.shiftKey && xsSel && xsSel.bi === at.bi) { e.preventDefault(); xsSel.z = at.row; xsSelPaint(); return; }
  const onInput = /INPUT|TEXTAREA/.test(e.target.tagName);
  if (onInput && document.activeElement === e.target) return; // 이미 입력 중이면 글자 선택 그대로
  xsDrag = { ...at, x: e.clientX, y: e.clientY, onInput, el: e.target, moved: false };
  if (!xsDrag.onInput) { e.preventDefault(); xsSel = { bi: at.bi, a: at.row, z: at.row }; xsSelPaint(); }
  else if (xsSel) xsSelClear();
});
document.addEventListener('pointermove', e => {
  if (!xsDrag) return;
  const at = xsRowAt(document.elementFromPoint(e.clientX, e.clientY));
  if (!at || at.bi !== xsDrag.bi) return;
  if (xsDrag.onInput && !xsDrag.moved) {
    if (at.row === xsDrag.row && Math.abs(e.clientY - xsDrag.y) < 12) return; // 금액 입력하려는 클릭
    document.activeElement?.blur?.(); window.getSelection()?.removeAllRanges();
  }
  xsDrag.moved = true;
  xsSel = { bi: xsDrag.bi, a: xsDrag.row, z: at.row }; xsSelPaint();
});
// 칸 안 숫자·이름 위에서 누르면 바로 입력 대신 「끌기 준비」 — 안 움직이고 떼면 그때 입력칸으로 (텍스트 끌기 방지)
document.addEventListener('mousedown', e => {
  if (xsDrag?.onInput && e.target === xsDrag.el && document.activeElement !== xsDrag.el) e.preventDefault();
}, true);
document.addEventListener('pointerup', () => {
  const d = xsDrag; xsDrag = null;
  if (!d) return;
  if (d.moved) { window.getSelection()?.removeAllRanges(); return; }
  if (d.onInput && document.activeElement !== d.el) {
    d.el.focus();
    if (d.el.tagName === 'INPUT') d.el.select?.(); else { const n = d.el.value.length; d.el.setSelectionRange?.(n, n); }
  }
});
function xsChanged() { xsFill(); calc(); }
// 원가 합 · 마진 칸 내용 — 원가가 하나도 없으면 「원가 미입력」
function xsMgHtml(price, cost, total, hasCost = true) {
  if (!hasCost) return price ? '<span class="xs-mg-none">원가 미입력</span>' : '';
  const m = price - cost, pct = price > 0 ? Math.round(m / price * 100) : 0;
  const cls = m < 0 ? 'bad' : pct < 15 ? 'low' : 'ok';
  return `<div class="xs-mg-c">${total ? '원가 합 ' : '원가 '}${fmt(cost)}</div><div class="xs-mg-m ${cls}">마진 ${fmt(m)}<b>${price > 0 ? pct + '%' : '-'}</b></div>`;
}
const xsPct = (price, cost) => price > 0 ? Math.round((price - cost) / price * 100) + '%' : '-';
const xsLine = (k, bi, ii) => k === 'o' ? tplState.options[ii] : tplState.blocks[bi].items[ii];
function xsCost(k, bi, ii, v) {
  const x = xsLine(k, bi, ii);
  x.c = String(v).trim() === '' ? null : parseWon(v);
  xsChanged();
}
// ＋ 항목 추가 — 공정 맨 아래에 따로 금액 줄을 하나 넣고 이름 칸으로 바로 이동
function xsAddItem(bi) {
  const b = tplState.blocks[bi];
  b.items.push({ n: '', d: '', p: 0, f: '', note: '', on: true, c: null, m: '' });
  renderTpl(); calc();
  setTimeout(() => document.querySelector(`tr[data-b="${bi}"][data-i="${b.items.length - 1}"] .xs-ntitle`)?.focus(), 30);
}
function xsName(bi, ii, v) { tplState.blocks[bi].items[ii].n = v.trim(); calc(); }
function xsDelItem(bi, ii) {
  const b = tplState.blocks[bi], it = b.items[ii];
  if (b.items.length === 1) { alert('공정에 줄이 하나뿐이라 지울 수 없어요. 빼려면 적용 칸을 X로 바꾸세요.'); return; }
  if ((it.n || it.d || it.p) && !confirm(`「${it.n || '이름 없는 줄'}」 줄을 지울까요?`)) return;
  // 금액 줄을 지우면 아래 「포함」 줄들은 다음 줄이 금액을 이어받음
  if (it.p != null && b.items[ii + 1] && b.items[ii + 1].p == null && !b.items.slice(0, ii).some(x => x.p != null)) b.items[ii + 1].p = it.p;
  b.items.splice(ii, 1);
  renderTpl(); calc();
}
function xsDesc(k, bi, ii, v) { xsLine(k, bi, ii).d = v.trim(); calc(); }
function xsNote(k, bi, ii, v) { xsLine(k, bi, ii).note = v.trim(); calc(); }
function xsAutoH(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }
function xsAutoAll() { document.querySelectorAll('.xs-table textarea.xs-dtext, .xs-table textarea.xs-ntext, .xs-table textarea.xs-ntitle').forEach(xsAutoH); }
function xsMemo(k, bi, ii, v) { xsLine(k, bi, ii).m = v.trim(); calc(); }

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
  // 금액 줄을 바꾸면 그 금액에 딸린 「포함」 줄(같은 견적가 칸)도 같이 넣고 뺌
  const span = xsGroupSpans(b)[ii];
  if (b.items[ii].p != null && span > 1) {
    b.items.forEach((it, j) => {
      if (j <= ii || j >= ii + span) return;
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
