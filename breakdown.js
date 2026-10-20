/**
 * breakdown.js — 통비용 줄을 내역(자재 · 부자재 · 인건비 · 기타)으로 풀어서 계산
 *
 * 기본 견적서의 금액은 기존 견적의 「통비용」(자재+인건비+마진 합친 금액)입니다.
 * 실측 후에는 줄 옆 🧮 를 눌러 내역으로 다시 계산합니다:
 *   자재 (업체 단가표에서 고르거나 직접 입력) × 수량
 * + 부자재 (경첩·손잡이 등)
 * + 인건비 (품 단가 × 품 수 — 사람·현장마다 달라서 직접 입력, 품 단가 기본 35만)
 * + 기타 (운반·폐기물 등)
 * = 원가 × 마진 배율 → 그 줄의 기본 금액
 *
 * 고객 견적서에는 「고객에게 보일 내용」과 금액만, 내역은 시트 비고·일반 공유에만 보입니다.
 */

const BD_LABOR_DEFAULT = 350000;   // 목수 1품 (data.js 목공 인건비와 같음)
const BD_MULT_DEFAULT = 1.15;
const BD_KINDS = ['자재', '부자재', '인건비', '기타'];

// 줄 이름별 미리 채울 구성 (per: 개수를 바꾸면 같이 바뀌는 줄)
const BD_PRESETS = {
  '문짝 교체': {
    count: 7, countLabel: '문 개수', unitWord: '개소',
    desc: c => `문짝 교체 ${c}개소 (경첩·손잡이 포함)`,
    rows: [
      { k: '자재', n: '예림 민자 문짝', u: '짝', vendor: '예림 민자 문짝', q: 7, per: true },
      { k: '부자재', n: '경첩·손잡이', u: '개', p: 17500, q: 7, per: true, memo: '양우 302호 기록: 경첩 6천 + 손잡이 11,500' },
      { k: '인건비', n: '목수', u: '품', p: null, q: 1, memo: '문짝만 교체는 하루 6~8개 정도 (사람마다 다름)' },
    ],
    tip: '문틀까지 바꾸면 자재를 「예림 발포 세트 155바 · 식기 없음」 등 세트로 바꾸고 품을 2 정도로 늘려보세요.',
  },
  '몰딩·걸레받이': {
    count: 30, countLabel: '몰딩 개수 (2440 기준)', unitWord: '개',
    desc: () => '거실·방 전체 상단 몰딩 + 하단 걸레받이',
    rows: [
      { k: '자재', n: '마이너스몰딩 (크림화이트)', u: '개', vendor: '마이너스몰딩 (크림화이트)', q: 30, per: true },
      { k: '자재', n: '평6전 (크림화이트) 걸레받이', u: '개', vendor: '평6전 (크림화이트)', q: 30, per: true },
      { k: '부자재', n: '본드·실리콘·타카핀', u: '식', p: 50000, q: 1, memo: '대략값 — 현장 따라 조정' },
      { k: '인건비', n: '목수', u: '품', p: null, q: 1, memo: '32평 몰딩+걸레받이 1~2품 정도 (사람마다 다름)' },
    ],
    tip: '몰딩 개수는 실측 둘레(m) ÷ 2.44로 계산하면 됩니다.',
  },
};
BD_PRESETS['문짝'] = BD_PRESETS['문짝 교체'];
BD_PRESETS['몰딩'] = BD_PRESETS['몰딩·걸레받이'];

let bdTarget = null;   // { kind:'b'|'o', bi, ii }
let bdState = null;    // 편집 중인 내역

const bdLaborRate = () => { try { return Number(localStorage.getItem('bdLaborRate')) || BD_LABOR_DEFAULT; } catch (e) { return BD_LABOR_DEFAULT; } };
function bdVendorFind(name) { return (typeof VENDOR_PRICES !== 'undefined' ? VENDOR_PRICES : []).find(x => x.n === name); }
function bdVendorLabel(x) { return `${x.n}${x.spec ? ' · ' + x.spec : ''} · ${x.vendor.replace(/ \(.*\)$/, '')}`; }
function bdVendorByLabel(label) { return (typeof VENDOR_PRICES !== 'undefined' ? VENDOR_PRICES : []).find(x => bdVendorLabel(x) === label); }

function bdTargetItem() {
  if (!bdTarget) return null;
  return bdTarget.kind === 'o' ? tplState.options[bdTarget.ii] : tplState.blocks[bdTarget.bi].items[bdTarget.ii];
}

function bdNewState(item) {
  const preset = BD_PRESETS[item.n];
  const labor = bdLaborRate();
  if (preset) {
    return {
      count: preset.count, mult: BD_MULT_DEFAULT, preset: item.n,
      desc: preset.desc(preset.count),
      rows: preset.rows.map(r => {
        const v = r.vendor && bdVendorFind(r.vendor);
        return { k: r.k, n: v ? bdVendorLabel(v) : r.n, u: v ? v.u : r.u, p: v ? vNet(v) : (r.p == null ? labor : r.p), q: r.q, per: !!r.per, memo: r.memo || '' };
      }),
    };
  }
  return { count: 0, mult: BD_MULT_DEFAULT, preset: '', desc: item.d || '',
    rows: [{ k: '자재', n: '', u: '', p: 0, q: 1, per: false, memo: '' }, { k: '인건비', n: '목수', u: '품', p: labor, q: 1, per: false, memo: '' }] };
}

function openBreakdown(kind, bi, ii) {
  bdTarget = { kind, bi, ii };
  const item = bdTargetItem();
  bdState = item.bd ? JSON.parse(JSON.stringify(item.bd)) : bdNewState(item);
  renderBreakdown();
  document.getElementById('bd-modal').classList.remove('hidden');
}
function closeBreakdown() { document.getElementById('bd-modal').classList.add('hidden'); }

function bdRowCost(r) { return Math.round((Number(r.p) || 0) * (Number(r.q) || 0)); }
function bdTotals() {
  const by = {}; let cost = 0;
  bdState.rows.forEach(r => { const c = bdRowCost(r); by[r.k] = (by[r.k] || 0) + c; cost += c; });
  const price = Math.ceil(cost * (Number(bdState.mult) || 1) / 10000) * 10000;
  return { by, cost, price };
}

function renderBreakdown() {
  const item = bdTargetItem();
  const preset = BD_PRESETS[bdState.preset];
  const list = (typeof VENDOR_PRICES !== 'undefined' ? VENDOR_PRICES : [])
    .filter(x => ['문·몰딩', '목공 자재', '부자재', '도배', '바닥재', '철거', '욕실', '도장', '중문'].includes(x.cat));
  // 공정 맨 윗줄이면 아래 「포함」 줄 값도 이 금액에 들어 있음
  const bundled = bdTarget.kind === 'b' && typeof xsIsBlockHead === 'function' && xsIsBlockHead(tplState.blocks[bdTarget.bi], bdTarget.ii)
    ? tplState.blocks[bdTarget.bi].items.filter(x => x.p == null && x.on).map(x => x.n) : [];
  const body = document.getElementById('bd-body');
  body.innerHTML = `
    ${bundled.length ? `<p class="bd-warn">⚠️ 이 줄 금액에는 아래 「포함」 줄 <b>${bundled.map(esc).join(', ')}</b>도 들어 있어요. 내역에 그 항목들도 넣어야 금액이 맞습니다.</p>` : ''}
    <p class="fu-intro"><b>${esc(item.n)}</b> — 지금 기본 금액 <b>${fmt(item.p || 0)}원</b>은 기존 견적의 통비용이에요. 자재·인건비로 풀어서 다시 계산하면 이 금액이 바뀝니다.
      인건비 품 수는 사람·현장마다 달라서 직접 넣어주세요.</p>
    ${preset ? `<div class="bd-count"><label>${esc(preset.countLabel)} <input id="bd-count" type="number" min="0" value="${bdState.count}" oninput="bdCount(this.value)"></label>
      <span>바꾸면 「개수 따라」 줄 수량이 같이 바뀝니다.</span></div>` : ''}
    <div class="fu-wrap"><table class="fu-table bd-table">
      <colgroup><col class="bd-c-k"><col><col class="bd-c-u"><col class="bd-c-p"><col class="bd-c-q"><col class="bd-c-c"><col class="bd-c-del"></colgroup>
      <thead><tr><th>구분</th><th>내용 (자재는 업체 단가표에서 고르기)</th><th>단위</th><th>단가 (원가)</th><th>수량</th><th>금액</th><th></th></tr></thead>
      <tbody>${bdState.rows.map((r, i) => `<tr data-i="${i}">
        <td class="xs-in"><select onchange="bdSet(${i},'k',this.value)" aria-label="구분">${BD_KINDS.map(k => `<option${k === r.k ? ' selected' : ''}>${k}</option>`).join('')}</select></td>
        <td class="xs-in"><input type="text" ${r.k === '자재' ? 'list="bd-vendor-list"' : ''} value="${esc(r.n)}" placeholder="${r.k === '자재' ? '업체 단가표에서 고르거나 직접 입력' : r.k === '인건비' ? '목수 / 타일공 / 보조 등' : '내용'}" onchange="bdName(${i},this.value)" aria-label="내용">
          ${r.memo ? `<div class="bd-memo">${esc(r.memo)}</div>` : ''}</td>
        <td class="xs-in"><input type="text" value="${esc(r.u)}" onchange="bdSet(${i},'u',this.value)" aria-label="단위" style="text-align:center"></td>
        <td class="xs-in xs-num"><input class="xs-money" type="text" inputmode="numeric" value="${r.p ? fmt(r.p) : ''}" placeholder="0" onfocus="this.select()" onchange="bdSet(${i},'p',parseWon(this.value));this.value=this.value?fmt(parseWon(this.value)):''" aria-label="단가"></td>
        <td class="xs-in"><input type="number" min="0" step="0.5" value="${r.q}" oninput="bdSet(${i},'q',this.value)" aria-label="수량">${preset ? `<label class="bd-per" title="개수를 바꾸면 이 줄 수량도 같이"><input type="checkbox" ${r.per ? 'checked' : ''} onchange="bdSet(${i},'per',this.checked)"> 개수 따라</label>` : ''}</td>
        <td class="xs-num fu-cost"></td>
        <td><button class="xs-del" onclick="bdDel(${i})" aria-label="줄 삭제">✕</button></td></tr>`).join('')}</tbody>
      <tfoot>
        <tr><td colspan="7" class="xs-addcell"><button class="xs-add" onclick="bdAdd('자재')">+ 자재</button><button class="xs-add" onclick="bdAdd('인건비')">+ 인건비</button><button class="xs-add" onclick="bdAdd('기타')">+ 기타 (운반·폐기물 등)</button></td></tr>
        <tr><th colspan="5">자재 / 부자재 / 인건비 / 기타</th><td class="xs-num" colspan="2" id="bd-by"></td></tr>
        <tr class="xs-sub"><th colspan="5">원가 합계</th><td class="xs-num" id="bd-cost"></td><td></td></tr>
        <tr><th colspan="5">마진 배율</th><td class="xs-in xs-num"><input id="bd-mult" type="number" min="1" max="3" step="0.01" value="${bdState.mult}" oninput="bdMult(this.value)" aria-label="마진 배율"></td><td class="fu-hint">배</td></tr>
        <tr class="xs-sub fu-grand"><th colspan="5">견적가 (만원 단위 올림)</th><td class="xs-num" id="bd-price"></td><td></td></tr>
      </tfoot>
    </table></div>
    <datalist id="bd-vendor-list">${list.map(x => `<option value="${esc(bdVendorLabel(x))}">${fmt(vNet(x))}/${esc(x.u)}</option>`).join('')}</datalist>
    <label class="bd-desc">고객 견적서에 보일 내용<input id="bd-desc" type="text" value="${esc(bdState.desc)}" oninput="bdState.desc=this.value"></label>
    ${preset?.tip ? `<p class="fu-note">💡 ${esc(preset.tip)}</p>` : ''}
    <div class="fu-actions">
      <button class="tpl-tool primary" onclick="applyBreakdown()">✅ 이 금액으로 「${esc(item.n)}」 바꾸기</button>
      ${item.bd ? '<button class="tpl-tool" onclick="clearBreakdown()">↩ 원래 통비용으로</button>' : ''}
      <button class="tpl-tool" onclick="closeBreakdown()">닫기</button>
    </div>`;
  bdFill();
}

function bdFill() {
  const { by, cost, price } = bdTotals();
  document.querySelectorAll('#bd-body tbody tr[data-i]').forEach(tr => {
    const c = bdRowCost(bdState.rows[+tr.dataset.i]);
    tr.querySelector('.fu-cost').textContent = c ? fmt(c) : '';
  });
  document.getElementById('bd-by').textContent = BD_KINDS.map(k => `${fmt(by[k] || 0)}`).join(' / ');
  document.getElementById('bd-cost').textContent = fmt(cost);
  document.getElementById('bd-price').textContent = fmt(price);
}

function bdSet(i, key, v) {
  const r = bdState.rows[i];
  if (key === 'q') r.q = Number(v) || 0;
  else if (key === 'per') r.per = !!v;
  else if (key === 'k') { r.k = v; renderBreakdown(); return; }
  else r[key] = v;
  if (key === 'p' && r.k === '인건비' && Number(v)) { try { localStorage.setItem('bdLaborRate', String(Number(v))); } catch (e) {} }
  bdFill();
}
function bdName(i, v) {
  const r = bdState.rows[i];
  r.n = v;
  const x = r.k === '자재' && bdVendorByLabel(v);
  if (x) { r.p = vNet(x); r.u = x.u; renderBreakdown(); return; }
  bdFill();
}
function bdCount(v) {
  const c = Number(v) || 0;
  bdState.count = c;
  bdState.rows.forEach(r => { if (r.per) r.q = c; });
  const preset = BD_PRESETS[bdState.preset];
  if (preset) {
    bdState.desc = preset.desc(c);
    const d = document.getElementById('bd-desc'); if (d) d.value = bdState.desc;
  }
  document.querySelectorAll('#bd-body tbody tr[data-i]').forEach(tr => {
    const r = bdState.rows[+tr.dataset.i];
    if (r.per) tr.querySelector('input[type=number]').value = r.q;
  });
  bdFill();
}
function bdMult(v) { bdState.mult = Math.max(1, Number(v) || 1); bdFill(); }
function bdAdd(k) {
  bdState.rows.push({ k, n: k === '인건비' ? '목수' : '', u: k === '인건비' ? '품' : '', p: k === '인건비' ? bdLaborRate() : 0, q: 1, per: false, memo: '' });
  renderBreakdown();
}
function bdDel(i) { bdState.rows.splice(i, 1); renderBreakdown(); }

function bdNoteText() {
  const { by, cost } = bdTotals();
  const labor = bdState.rows.filter(r => r.k === '인건비' && bdRowCost(r));
  const parts = BD_KINDS.filter(k => by[k]).map(k => k === '인건비'
    ? `인건비 ${fmt(by[k])}(${labor.map(r => `${r.n || '인건비'} ${r.q}품×${fmt(r.p)}`).join(', ')})`
    : `${k} ${fmt(by[k])}`);
  return `내역: ${parts.join(' + ')} = 원가 ${fmt(cost)} × ${bdState.mult}배`;
}

function applyBreakdown() {
  const { cost, price } = bdTotals();
  if (!cost) { alert('단가와 수량을 넣어주세요.'); return; }
  const item = bdTargetItem();
  if (!item.bd) item.bdOrig = { p: item.p, d: item.d, note: item.note || '', f: item.f || '' };
  item.bd = JSON.parse(JSON.stringify(bdState));
  item.p = price;
  item.on = true;
  if (bdState.desc) item.d = bdState.desc;
  if (bdTarget.kind === 'o') item.f = bdNoteText(); else item.note = bdNoteText();
  closeBreakdown();
  renderTpl(); calc();
  showToast(`🧮 「${item.n}」을 내역으로 계산했습니다: ${fmt(price)}원`);
}
function clearBreakdown() {
  const item = bdTargetItem();
  if (item.bdOrig) Object.assign(item, item.bdOrig);
  delete item.bd; delete item.bdOrig;
  closeBreakdown();
  renderTpl(); calc();
  showToast(`↩ 「${item.n}」을 원래 통비용으로 되돌렸습니다`);
}

document.addEventListener('DOMContentLoaded', () => {
  const m = document.getElementById('bd-modal');
  m?.addEventListener('click', e => { if (e.target === m) closeBreakdown(); });
});
