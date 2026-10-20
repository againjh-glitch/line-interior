/**
 * vendor.js — 📒 업체 단가표 보기 · 견적서에 넣기
 *
 * 기본 견적서 시트의 「📒 업체 단가표」(또는 바닥재 칸의 버튼) → 공정 탭·검색으로 단가 확인
 * → ＋ 넣기 → 수량·마진 배율·넣을 공정 선택 → 그 공정에 줄로 추가 (바닥재는 「바닥재」 줄 바꾸기 가능)
 *
 * 고객 견적서에는 항목·내용·견적가만, 업체 원가는 시트 비고와 일반 공유에만 보입니다.
 * 데이터: vendor-data.js (VENDOR_PRICES)
 */

const VENDOR_CATS = ['바닥재', '철거', '도배', '문·몰딩', '목공 자재', '부자재', '욕실', '도장', '중문'];
// 넣을 공정 기본값 (시트에 그 공정이 없으면 새로 만듦)
const VENDOR_TARGET = { '바닥재': '도배·바닥재', '철거': '철거', '도배': '도배·바닥재', '문·몰딩': '목공', '목공 자재': '목공',
  '부자재': '기타', '욕실': '거실 욕실', '도장': '도장', '중문': '목공' };
// 마진 배율 기본값 — 바닥재는 양우 304호 「동화 나투스 그란데 350만」 ≈ 25평 × 119,000 × 1.18 근거
const VENDOR_MULT = { '바닥재': 1.2 };
const VENDOR_MULT_OTHER = 1.15;

let vendorCat = '바닥재';
let vendorQuery = '';
let vendorPick = null; // 고른 단가 줄 index

const vNet = x => x.vat === '포함' ? Math.round(x.p / 1.1 / 100) * 100 : x.p; // 공급가 (VAT 제외)
const vFloorArea = () => Math.max(1, Math.round((getPyung() || 32) * 0.75)); // 32평형 → 약 24평

function openVendor(cat) {
  if (cat) vendorCat = cat;
  vendorPick = null;
  renderVendor();
  document.getElementById('vendor-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('vd-search')?.focus(), 50);
}
function closeVendor() { document.getElementById('vendor-modal').classList.add('hidden'); }

function vendorRows() {
  const q = vendorQuery.trim().toLowerCase();
  return VENDOR_PRICES.map((x, i) => ({ ...x, i })).filter(x =>
    (q ? true : x.cat === vendorCat) &&
    (!q || [x.n, x.spec, x.sub, x.vendor, x.note, x.cat].join(' ').toLowerCase().includes(q)));
}

function renderVendor() {
  const body = document.getElementById('vendor-body');
  const tabs = VENDOR_CATS.map(c => `<button class="vd-tab${c === vendorCat && !vendorQuery ? ' on' : ''}" onclick="vendorTab('${c}')">${c}
      <small>${VENDOR_PRICES.filter(x => x.cat === c).length}</small></button>`).join('');
  body.innerHTML = `
    <div class="vd-top">
      <div class="vd-tabs">${tabs}</div>
      <input id="vd-search" class="vd-search" type="search" placeholder="🔍 제품·업체 검색 (예: 3.2T, 나투스, 영림)" value="${esc(vendorQuery)}" oninput="vendorSearch(this.value)" aria-label="단가 검색">
    </div>
    <div id="vd-list" class="vd-list"></div>
    <div id="vd-pick" class="vd-pick"></div>`;
  renderVendorList();
  renderVendorPick();
}

function renderVendorList() {
  const rows = vendorRows();
  let html = '', sub = null;
  rows.forEach(x => {
    if (x.sub !== sub) {
      if (sub !== null) html += '</tbody></table>';
      sub = x.sub;
      html += `<div class="vd-sub"><b>${esc(x.sub)}</b> <span>${esc(x.vendor)}${x.date ? ' · ' + esc(x.date) : ''}${vendorQuery ? ' · ' + esc(x.cat) : ''}</span>
        ${x.src ? `<div class="vd-src">${esc(x.src)}</div>` : ''}</div>
        <table class="vd-table"><colgroup><col><col class="vd-c-spec"><col class="vd-c-u"><col class="vd-c-p"><col class="vd-c-vat"><col class="vd-c-net"><col class="vd-c-add"></colgroup>
        <thead><tr><th>제품</th><th>규격</th><th>단위</th><th>표 단가</th><th>부가세</th><th>공급가</th><th></th></tr></thead><tbody>`;
    }
    html += `<tr class="${vendorPick === x.i ? 'on' : ''}">
      <td><b>${esc(x.n)}</b>${x.note ? `<div class="vd-note">${esc(x.note)}</div>` : ''}</td>
      <td class="vd-spec">${esc(x.spec)}</td><td class="vd-u">${esc(x.u)}</td>
      <td class="xs-num">${fmt(x.p)}</td><td class="vd-vat ${x.vat === '포함' ? 'inc' : ''}">${esc(x.vat)}</td>
      <td class="xs-num"><b>${fmt(vNet(x))}</b></td>
      <td><button class="vd-add" onclick="vendorSelect(${x.i})">＋ 넣기</button></td></tr>`;
  });
  if (sub !== null) html += '</tbody></table>';
  document.getElementById('vd-list').innerHTML = html || '<p class="vd-empty">찾는 단가가 없습니다.</p>';
}

function vendorTab(c) { vendorCat = c; vendorQuery = ''; renderVendor(); }
function vendorSearch(v) { vendorQuery = v; renderVendorList(); document.querySelectorAll('.vd-tab').forEach(t => t.classList.toggle('on', !v && t.textContent.trim().startsWith(vendorCat))); }

function vendorSelect(i) {
  vendorPick = i;
  renderVendorList();
  renderVendorPick();
  document.getElementById('vd-pick').scrollIntoView({ block: 'nearest' });
}

function renderVendorPick() {
  const box = document.getElementById('vd-pick');
  if (vendorPick == null) {
    box.innerHTML = '<p class="vd-hint">목록에서 <b>＋ 넣기</b>를 누르면 수량과 마진을 넣어 견적서에 줄로 추가할 수 있어요. 보기만 해도 됩니다.</p>';
    return;
  }
  const x = VENDOR_PRICES[vendorPick];
  const target = VENDOR_TARGET[x.cat] || '기타';
  const blocks = [...new Set([...tplState.blocks.map(b => b.proc), target])];
  const hasFloorLine = x.cat === '바닥재' && tplState.blocks.some(b => b.proc === '도배·바닥재' && b.items.some(i => i.n === '바닥재'));
  const qty = x.u === '평' && (x.cat === '바닥재' || x.cat === '철거') ? vFloorArea() : 1;
  box.innerHTML = `
    <div class="vd-pick-h">＋ <b>${esc(x.n)}</b> <span>${esc(x.vendor)} · 공급가 ${fmt(vNet(x))}/${esc(x.u)}</span></div>
    <div class="vd-form">
      <label>수량 (${esc(x.u)})<input id="vd-q" type="number" min="0" step="${x.u === '평' ? '0.5' : '1'}" value="${qty}" oninput="vendorCalc()"></label>
      <label>마진 배율<input id="vd-m" type="number" min="1" max="3" step="0.01" value="${VENDOR_MULT[x.cat] || VENDOR_MULT_OTHER}" oninput="vendorCalc()"></label>
      <label>넣을 공정<select id="vd-t" onchange="vendorCalc()">${blocks.map(b => `<option${b === target ? ' selected' : ''}>${esc(b)}</option>`).join('')}<option value="__opt">선택 옵션</option></select></label>
      ${hasFloorLine ? '<label class="vd-chk"><input id="vd-replace" type="checkbox" checked onchange="vendorCalc()"> 기본 「바닥재」 줄을 이 제품으로 바꾸기</label>' : ''}
    </div>
    ${x.min ? `<p class="vd-tip">최소 금액 ${fmt(x.min)}원 — 원가가 이보다 적으면 ${fmt(x.min)}원으로 계산해요.</p>` : ''}
    ${(x.cat === '바닥재' || x.cat === '철거') && x.u === '평' ? `<p class="vd-tip">시공 면적은 평형 × 0.75로 넣었어요 (32평형 → 24평, 방·거실 기준). 베란다까지 깔면 늘려주세요.${/우경데코/.test(x.vendor) ? ' 우경데코는 기본 시공비 25만(헤링본 40만)이 따로 있어요.' : ''}</p>` : ''}
    <div class="vd-result"><span>업체 원가 <b id="vd-cost"></b></span><span>→ 고객 견적가 <b id="vd-price"></b></span>
      <button class="tpl-tool primary" onclick="vendorInsert()">견적서에 넣기</button></div>`;
  vendorCalc();
}

function vendorCalcValues() {
  const x = VENDOR_PRICES[vendorPick];
  const q = Number(document.getElementById('vd-q').value) || 0;
  const m = Math.max(1, Number(document.getElementById('vd-m').value) || 1);
  const cost = Math.max(x.min && q ? x.min : 0, Math.round(vNet(x) * q)); // 최소 금액 (바닥 철거 최하 20만)
  const price = Math.ceil(cost * m / 10000) * 10000;
  return { x, q, m, cost, price };
}
function vendorCalc() {
  const { cost, price } = vendorCalcValues();
  document.getElementById('vd-cost').textContent = fmt(cost) + '원';
  document.getElementById('vd-price').textContent = fmt(price) + '원';
}

function vendorInsert() {
  const { x, q, m: mult, cost, price } = vendorCalcValues();
  if (!q) { alert('수량을 넣어주세요.'); return; }
  const target = document.getElementById('vd-t').value;
  const replace = document.getElementById('vd-replace')?.checked;
  const qtyText = `${q}${x.u}`;
  const desc = [x.spec && x.u !== '평' ? x.spec : '', x.u === '평' ? `${qtyText} 시공` : q > 1 ? qtyText : ''].filter(Boolean).join(' · ');
  const note = `업체 원가 ${fmt(cost)} (${x.vendor.replace(/ \(.*\)$/, '')} ${x.date || ''} ${fmt(vNet(x))}/${x.u} × ${q}) × ${mult}배`;
  const name = x.n;

  const m = `${x.vendor.replace(/ \(.*\)$/, '')} ${fmt(vNet(x))}/${x.u}×${q}`; // 상세내역
  if (target === '__opt') {
    tplState.options.push({ n: name, d: desc, p: price, f: note, on: true, c: cost, m });
  } else {
    let blk = tplState.blocks.find(b => b.proc === target);
    if (!blk) {
      blk = { proc: target, range: '', freq: '', items: [] };
      const at = tplState.blocks.findIndex(b => b.proc === '기타');
      if (at < 0) tplState.blocks.push(blk); else tplState.blocks.splice(at, 0, blk);
    }
    const line = replace && blk.items.find(i => i.n === '바닥재');
    if (line) Object.assign(line, { d: `${name}${desc ? ' · ' + desc : ''}`, p: price, on: true, note, f: '', c: cost, m });
    else blk.items.push({ n: name, d: desc, p: price, on: true, f: '', note, c: cost, m });
  }
  closeVendor();
  renderTpl(); calc();
  showToast(`📒 ${name} ${fmt(price)}원을 ${target === '__opt' ? '선택 옵션' : target}에 넣었습니다`);
}

document.addEventListener('DOMContentLoaded', () => {
  const m = document.getElementById('vendor-modal');
  m?.addEventListener('click', e => { if (e.target === m) closeVendor(); });
});
