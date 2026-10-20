/**
 * furniture.js — 싱크대·붙박이장 사이즈로 예상 견적 내기
 *
 * 기본 견적서 시트의 「가구」 공정에서 🧮 사이즈로 계산 → 사이즈·종류 입력
 * → 코렉스 퍼니처 예상 원가 × 마진 배율 = 고객 견적가 → 가구 줄을 자동으로 채움.
 *
 * 단가: 코렉스 퍼니처 견적서 19장(2025.07~2026.10) 중 2026년 견적의 1m당 중간값.
 *       2026년 견적 11장으로 다시 계산했을 때 평균 오차 약 3% (최대 7%).
 * 마진: 같은 현장 9곳에서 우리 견적가 ÷ 업체 원가 중간값 1.12배 (1.08~1.34배).
 *
 * 고객 견적서에는 항목·내용·견적가만 나가고, 업체 원가는 비고(일반 공유)에만 남습니다.
 * 업체 단가가 바뀌면 아래 FURN_ROWS의 숫자만 고치세요.
 */

const FURN_MULT_DEFAULT = 1.12;

// key, 항목, 단위, 종류 목록[이름, 업체 단가], 기본 수량, 메모, 최소 금액
const FURN_ROWS = [
  { key: 'kitchen', n: '주방가구', u: 'M', kinds: [['매립·히든 후드 포함', 230000]], q: 0, hint: '상부+하부 길이 합 (업체 견적서의 「9.7M」)' },
  { key: 'top', n: '상판', u: 'M', kinds: [['인조대리석', 240000], ['하이막스(오로라 등)', 260000], ['실버트랙', 200000], ['세라믹', 500000]], q: 0, hint: '보통 주방가구 길이의 약 45%' },
  { key: 'ceramic', n: '세라믹 상판 추가비', u: '식', kinds: [['', 500000]], q: 0, hint: '세라믹이면 1 (스카이 양중 45만 별도)' },
  { key: 'bowl', n: '싱크볼+수전', u: '세트', kinds: [['하츠사각볼+와이드수전', 400000], ['엠보사각볼+폭포수전', 400000], ['사각볼+일반수전', 170000], ['기본스텐볼+원홀수전', 150000], ['하츠사각볼 (볼만)', 250000]], q: 0, hint: '' },
  { key: 'cook', n: '쿡탑', u: '개', kinds: [['하츠 가스 3구', 160000], ['하츠 인덕션 3구', 430000], ['하이브리드 (전기2+가스1)', 500000]], q: 0, hint: '고객이 직접 사면 0' },
  { key: 'hood', n: '침니후드 (하츠)', u: '개', kinds: [['', 320000]], q: 0, hint: '매립·히든 후드는 주방가구에 포함' },
  { key: 'fridge', n: '냉장고장·키큰장', u: 'm', kinds: [['', 420000]], q: 0, hint: '폭 (2500 → 2.5)' },
  { key: 'sub', n: '보조주방 하부장', u: '개소', kinds: [['', 365000]], q: 0, hint: '1600 35만 · 2600 38만' },
  { key: 'subtop', n: '보조주방 상판', u: '개소', kinds: [['', 360000]], q: 0, hint: '' },
  { key: 'closet1', n: '안방 붙박이장', u: 'm', kinds: [['여닫이', 430000], ['슬라이딩', 480000]], q: 0, hint: '폭 (3680 → 3.68)' },
  { key: 'closet2', n: '작은방 붙박이장', u: 'm', kinds: [['여닫이', 430000], ['슬라이딩', 480000]], q: 0, hint: '' },
  { key: 'closet3', n: '입구방 붙박이장', u: 'm', kinds: [['여닫이', 430000], ['슬라이딩', 480000]], q: 0, hint: '' },
  { key: 'drawer', n: '붙박이장 서랍 추가', u: '개', kinds: [['', 150000]], q: 0, hint: '3단 15만 · 큰 서랍 35만' },
  { key: 'shoe', n: '신발장', u: 'm', kinds: [['', 450000]], q: 0, hint: '1m 이하도 최소 45만', min: 450000 },
  { key: 'storage', n: '베란다 창고장', u: 'm', kinds: [['', 270000]], q: 0, hint: '도어+선반' },
  { key: 'cabinet', n: '수납장·발코니장', u: 'm', kinds: [['', 460000]], q: 0, hint: '도어+선반 수납장' },
  { key: 'outlet', n: '빌트인 콘센트 2구', u: '개', kinds: [['', 70000]], q: 0, hint: '' },
  { key: 'door', n: '붙박이장 도어만 교체', u: '짝', kinds: [['', 90000]], q: 0, hint: '기존 장 문짝만' },
];

// 처음 열 때 미리 넣어 둘 수량 (거의 모든 견적에 들어가는 싱크볼·쿡탑)
const FURN_SAMPLE = { bowl: 1, cook: 1 };

function furnState() {
  if (!tplState.furn) {
    const rows = {};
    FURN_ROWS.forEach(r => { rows[r.key] = { k: 0, q: FURN_SAMPLE[r.key] || 0, p: null }; });
    tplState.furn = { rows, mult: FURN_MULT_DEFAULT, extra: [], applied: false };
  }
  return tplState.furn;
}
function furnUnit(r, st) { return st.p != null ? st.p : (r.kinds[st.k] || r.kinds[0])[1]; }
function furnCost(r, st) {
  const q = Number(st.q) || 0;
  if (!q) return 0;
  const c = Math.round(q * furnUnit(r, st) / 10000) * 10000;
  return r.min ? Math.max(r.min, c) : c;
}
function furnLines() {
  const f = furnState();
  const out = [];
  FURN_ROWS.forEach(r => {
    const st = f.rows[r.key] || { k: 0, q: 0 };
    const cost = furnCost(r, st);
    if (!cost) return;
    const kind = (r.kinds[st.k] || r.kinds[0])[0];
    const q = Number(st.q);
    const size = r.u === 'M' || r.u === 'm' ? `${r.u === 'M' ? '' : '폭 '}${q}${r.u}` : q > 1 ? `${q}${r.u}` : '';
    out.push({ n: r.n, d: [kind, size].filter(Boolean).join(' · '), cost });
  });
  (f.extra || []).forEach(x => { const c = (Number(x.q) || 0) * (Number(x.p) || 0); if (x.n && c) out.push({ n: x.n, d: x.d || '', cost: c }); });
  return out;
}
const furnPrice = cost => Math.ceil(cost * (furnState().mult || 1) / 10000) * 10000; // 만원 단위 올림

/* ── 계산 창 ── */
function openFurn() {
  if (!tplState) return;
  furnState();
  renderFurn();
  document.getElementById('furn-modal').classList.remove('hidden');
}
function closeFurn() { document.getElementById('furn-modal').classList.add('hidden'); }

function renderFurn() {
  const f = furnState();
  const body = document.getElementById('furn-body');
  const rows = FURN_ROWS.map(r => {
    const st = f.rows[r.key] || (f.rows[r.key] = { k: 0, q: 0, p: null });
    const kindCell = r.kinds.length > 1
      ? `<select onchange="furnSet('${r.key}','k',+this.value)" aria-label="${esc(r.n)} 종류">${r.kinds.map(([n], i) => `<option value="${i}"${i === st.k ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`
      : `<span class="fu-fixed">${esc(r.kinds[0][0])}</span>`;
    return `<tr data-key="${r.key}">
      <th>${esc(r.n)}</th>
      <td class="xs-in${r.kinds.length > 1 ? '' : ' fu-nokind'}">${kindCell}</td>
      <td class="xs-in"><input type="number" min="0" step="${r.u === 'M' || r.u === 'm' ? '0.1' : '1'}" value="${Number(st.q) || ''}" placeholder="0" oninput="furnSet('${r.key}','q',this.value)" aria-label="${esc(r.n)} 길이·수량"></td>
      <td class="fu-u">${r.u}</td>
      <td class="xs-in xs-num"><input class="xs-money" type="text" inputmode="numeric" value="${fmt(furnUnit(r, st))}" onfocus="this.select()" onchange="furnSet('${r.key}','p',parseWon(this.value))" aria-label="${esc(r.n)} 업체 단가"></td>
      <td class="xs-num fu-cost"></td>
      <td class="fu-hint">${esc(r.hint)}</td>
    </tr>`;
  }).join('');
  const extra = (f.extra || []).map((x, i) => `<tr data-extra="${i}">
      <td class="xs-in"><input type="text" value="${esc(x.n)}" placeholder="항목 (직접 입력)" oninput="furnExtra(${i},'n',this.value)"></td>
      <td class="xs-in"><input type="text" value="${esc(x.d)}" placeholder="내용" oninput="furnExtra(${i},'d',this.value)"></td>
      <td class="xs-in"><input type="number" min="0" value="${Number(x.q) || ''}" placeholder="0" oninput="furnExtra(${i},'q',this.value)"></td>
      <td class="fu-u">식</td>
      <td class="xs-in xs-num"><input class="xs-money" type="text" inputmode="numeric" value="${x.p ? fmt(x.p) : ''}" placeholder="단가" onchange="furnExtra(${i},'p',parseWon(this.value));this.value=this.value?fmt(parseWon(this.value)):''"></td>
      <td class="xs-num fu-cost"></td>
      <td class="fu-hint"><button class="xs-del" onclick="furnExtraDel(${i})" aria-label="삭제">✕</button></td>
    </tr>`).join('');
  body.innerHTML = `
    <p class="fu-intro">사이즈와 종류를 넣으면 <b>코렉스 퍼니처 예상 원가</b>와 <b>고객 견적가</b>가 나옵니다. 업체 견적서 19장 기준 단가이고, 2026년 견적으로 확인한 오차는 평균 3%예요. 파란 단가는 직접 고쳐도 됩니다.</p>
    <div class="fu-wrap"><table class="fu-table">
      <colgroup><col class="fu-c-n"><col class="fu-c-k"><col class="fu-c-q"><col class="fu-c-u"><col class="fu-c-p"><col class="fu-c-c"><col></colgroup>
      <thead><tr><th>항목</th><th>종류</th><th>길이·폭 / 수량</th><th>단위</th><th>업체 단가</th><th>업체 예상 원가</th><th>메모</th></tr></thead>
      <tbody>${rows}${extra}</tbody>
      <tfoot>
        <tr><td colspan="7" class="xs-addcell"><button class="xs-add" onclick="furnExtraAdd()">+ 기타 항목 직접 추가</button></td></tr>
        <tr class="xs-sub"><th colspan="5">업체 예상 원가 합계</th><td class="xs-num" id="fu-cost"></td><td></td></tr>
        <tr><th colspan="5">마진 배율 <small>(같은 현장 9곳 중간값 1.12배)</small></th>
          <td class="xs-in xs-num"><input id="fu-mult" type="number" min="1" max="2" step="0.01" value="${f.mult}" oninput="furnMult(this.value)" aria-label="마진 배율"></td><td class="fu-hint">배</td></tr>
        <tr class="xs-sub fu-grand"><th colspan="5">고객 견적가 (만원 단위 올림)</th><td class="xs-num" id="fu-price"></td><td class="fu-hint" id="fu-margin"></td></tr>
      </tfoot>
    </table></div>
    <div class="fu-actions">
      <button class="tpl-tool primary" onclick="applyFurn()">✅ 견적서 「가구」에 넣기</button>
      ${f.applied ? '<button class="tpl-tool" onclick="resetFurnBlock()">↩ 원래 기본 가구 항목으로</button>' : ''}
      <button class="tpl-tool" onclick="closeFurn()">닫기</button>
    </div>
    <p class="fu-note">넣으면 가구 공정이 항목별 줄로 바뀝니다. 고객 견적서에는 항목·내용·견적가만 보이고, 업체 원가는 「일반 공유」 비고에만 보입니다. 스카이 양중·사다리차·거리비용은 별도예요.</p>`;
  furnFill();
}

function furnFill() {
  const f = furnState();
  let total = 0;
  document.querySelectorAll('#furn-body tr[data-key]').forEach(tr => {
    const r = FURN_ROWS.find(x => x.key === tr.dataset.key);
    const c = furnCost(r, f.rows[r.key]);
    total += c;
    tr.querySelector('.fu-cost').textContent = c ? fmt(c) : '';
    tr.classList.toggle('fu-zero', !c);
    const unit = tr.querySelector('.xs-money');
    if (unit && document.activeElement !== unit) unit.value = fmt(furnUnit(r, f.rows[r.key]));
  });
  document.querySelectorAll('#furn-body tr[data-extra]').forEach(tr => {
    const x = f.extra[+tr.dataset.extra];
    const c = (Number(x.q) || 0) * (Number(x.p) || 0);
    total += c;
    tr.querySelector('.fu-cost').textContent = c ? fmt(c) : '';
  });
  const price = furnLines().reduce((s, l) => s + furnPrice(l.cost), 0);
  document.getElementById('fu-cost').textContent = fmt(total);
  document.getElementById('fu-price').textContent = fmt(price);
  document.getElementById('fu-margin').textContent = total ? `마진 ${fmt(price - total)}` : '';
}

function furnSet(key, field, v) {
  const st = furnState().rows[key];
  if (field === 'k') { st.k = v; st.p = null; } // 종류를 바꾸면 그 종류 단가로
  else if (field === 'q') st.q = Number(v) || 0;
  else st.p = v || null;
  furnFill();
}
function furnMult(v) { furnState().mult = Math.max(1, Number(v) || FURN_MULT_DEFAULT); furnFill(); }
function furnExtraAdd() { furnState().extra.push({ n: '', d: '', q: 1, p: 0 }); renderFurn(); }
function furnExtraDel(i) { furnState().extra.splice(i, 1); renderFurn(); }
function furnExtra(i, k, v) { furnState().extra[i][k] = k === 'q' || k === 'p' ? Number(v) || 0 : v; furnFill(); }

function furnBlockIndex() {
  let bi = tplState.blocks.findIndex(b => b.proc === '가구');
  if (bi < 0) { // 가구 공정이 없는 템플릿이면 도배·바닥재 앞에 만들기
    const at = tplState.blocks.findIndex(b => b.proc === '도배·바닥재');
    const blk = { proc: '가구', range: '', freq: '', items: [] };
    if (at < 0) tplState.blocks.push(blk); else tplState.blocks.splice(at, 0, blk);
    bi = tplState.blocks.indexOf(blk);
  }
  return bi;
}

function applyFurn() {
  const lines = furnLines();
  if (!lines.length) { alert('사이즈를 하나 이상 넣어주세요.'); return; }
  const f = furnState();
  const blk = tplState.blocks[furnBlockIndex()];
  blk.items = lines.map(l => ({
    n: l.n, d: l.d, p: furnPrice(l.cost), on: true, f: '',
    c: l.cost, m: `코렉스 단가 기준 예상 원가`,
    note: `업체 예상 원가 ${fmt(l.cost)} × ${f.mult}배`,
  }));
  blk.range = blk.range || '';
  f.applied = true;
  closeFurn();
  renderTpl(); calc();
  showToast(`🧮 가구 ${lines.length}줄을 넣었습니다 (고객 견적가 ${fmt(blk.items.reduce((s, i) => s + i.p, 0))}원)`);
}

function resetFurnBlock() {
  const t = findTemplate(tplState.key);
  const orig = t && tplFromTemplate(t).blocks.find(b => b.proc === '가구');
  const bi = tplState.blocks.findIndex(b => b.proc === '가구');
  if (orig && bi >= 0) tplState.blocks[bi] = orig;
  else if (bi >= 0) tplState.blocks.splice(bi, 1);
  tplState.furn.applied = false;
  closeFurn();
  renderTpl(); calc();
  showToast('↩ 가구를 기본 견적서 항목으로 되돌렸습니다');
}

document.addEventListener('DOMContentLoaded', () => {
  const m = document.getElementById('furn-modal');
  m?.addEventListener('click', e => { if (e.target === m) closeFurn(); });
});
