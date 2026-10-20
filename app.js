/**
 * app.js — 인테리어 견적 계산기 v5
 */

/* ════════ 상태 ════════ */
const sel = {};   // { id: { on, q, val } }
const floorDemoSel = {}; // { fd_id: { on, q } }
// 욕실별 타입 상태: [ {type: 'std'|'high'|'prem'}, ... ]
let bathRooms = []; // 길이 = 욕실 수
let negoAmt = 0;    // 네고(할인) 금액 — 항상 양수로 저장, 총액에서 차감
// 화장실 방수: [ { type: '1st'|'2nd', count: 1 }, ... ] — 개소별
let bathWaterList = []; // 레거시 — 더 이상 사용 안 함
let wallPaperName = ''; // 도배지명 메모
// 양우아파트 아코디언 상태: divider id -> 열림 여부
const yanguOpen = {}; // 양우 아코디언 열림 상태
let yanguTemplate = null; // 선택된 템플릿
let isYanguMode = false;   // 양우 독립 모드 여부
let isTplMode = false;     // 아파트별 기본 견적서 모드 여부 (tpl.js)
let tplState = null;       // 기본 견적서 편집 상태 (tpl.js)
let specials = [];         // 특이사항 목록 — 모든 모드 공통 (tpl.js)

// A/B/C형 기본 선택 항목
const YANGU_TEMPLATES = {
  A: {
    label: 'A형 — 기본 풀공사',
    desc: '32평 비확장 · 욕실2 · 장판 · 전기·전등 · 싱크대',
    color: '#2563eb',
    ids: {
      yw_dem_labor:{on:true,q:5}, yw_dem1:{on:true,q:1}, yw_dem2:{on:true,q:1},
      yw_dem3:{on:true,q:1}, yw_dem4:{on:true,q:1}, yw_dem5:{on:true,q:1},
      yw_dem6:{on:true,q:1},
      yw_plm1:{on:true,q:1}, yw_plm2:{on:true,q:2},
      yw_mid1:{on:true,q:1},
      yw_carp0:{on:true,q:3}, yw_carp1s:{on:true,q:5}, yw_carp2:{on:true,q:1}, yw_carp3:{on:true,q:1},
      yw_bt1:{on:true,q:2}, yw_bt2:{on:true,q:2}, yw_bt3:{on:true,q:2},
      yw_bt4:{on:true,q:2}, yw_bt5:{on:true,q:2}, yw_bt6:{on:true,q:2},
      yw_bt8:{on:true,q:2}, yw_bt9:{on:true,q:1},
      yw_tl1:{on:true,q:1}, yw_tl2:{on:true,q:1},
      yw_wp1:{on:true,q:1},
      yw_fl7:{on:true,q:1},
      yw_el1:{on:true,q:1}, yw_el2:{on:true,q:1}, yw_el4:{on:true,q:1},
      yw_fu1:{on:true,q:1}, yw_fu2:{on:true,q:1}, yw_fu3:{on:true,q:1}, yw_fu5:{on:true,q:2},
      yw_etc1:{on:true,q:1}, yw_etc2:{on:true,q:1}, yw_etc3:{on:true,q:1}, yw_etc4:{on:true,q:1},
    }
  },
  B: {
    label: 'B형 — 확장 풀공사',
    desc: '32평 거실+방 확장 · 창호교체 · 마루 · 싱크대 프리미엄',
    color: '#16a34a',
    ids: {
      yw_dem_labor:{on:true,q:5}, yw_dem1:{on:true,q:1}, yw_dem2:{on:true,q:1},
      yw_dem3:{on:true,q:1}, yw_dem4:{on:true,q:1}, yw_dem5:{on:true,q:1},
      yw_dem7:{on:true,q:1},
      yw_plm1:{on:true,q:1}, yw_plm2:{on:true,q:2}, yw_plm5:{on:true,q:1},
      yw_win1:{on:true,q:1}, yw_win3:{on:true,q:2}, yw_win5:{on:true,q:1},
      yw_mid2:{on:true,q:1},
      yw_carp0:{on:true,q:3}, yw_carp1s:{on:true,q:7}, yw_carp3:{on:true,q:1}, yw_carp5:{on:true,q:1},
      yw_bt1:{on:true,q:2}, yw_bt2:{on:true,q:2}, yw_bt3:{on:true,q:2},
      yw_bt4:{on:true,q:2}, yw_bt5:{on:true,q:2}, yw_bt6:{on:true,q:2},
      yw_bt7:{on:true,q:1}, yw_bt8:{on:true,q:2}, yw_bt9:{on:true,q:1},
      yw_tl1:{on:true,q:1}, yw_tl2:{on:true,q:1}, yw_tl3:{on:true,q:2},
      yw_wp1:{on:true,q:1},
      yw_fl3:{on:true,q:1},
      yw_el1:{on:true,q:1}, yw_el2:{on:true,q:1}, yw_el3:{on:true,q:1}, yw_el4:{on:true,q:1},
      yw_fu1p:{on:true,q:1}, yw_fu2:{on:true,q:1}, yw_fu3:{on:true,q:1}, yw_fu5:{on:true,q:2},
      yw_etc1:{on:true,q:1}, yw_etc2:{on:true,q:1}, yw_etc3:{on:true,q:1}, yw_etc4:{on:true,q:1},
    }
  },
  C: {
    label: 'C형 — 맞춤 견적',
    desc: '원하는 항목만 직접 선택해서 구성',
    color: '#d97706',
    ids: {}
  }
};

// 전기·조명 패키지 상태
let elecPkg = { type: null }; // type: 'basic'|'standard'|'premium'|null
// 계약금 비율 설정 (합계 100이어야 함)
let payRatio = { deposit: 10, mid: 40, final: 50 }; // % 단위
// 욕실 철거: { living: false, master: false } — 거실/안방 각각
let bathDemoState = { living: false, master: false };
// 카테고리별 기타/네고: { [id]: { text:'', amt:0, nego:0 } }
const catExtraState = {};

function initSel() {
  Object.values(DATA).forEach(cat =>
    cat.items.forEach(it => {
      // bath-demo/water/rooms/cat-extra 는 항상 on=true (별도 상태로 관리)
      const alwaysOn = ['bath-demo','bath-rooms','cat-extra','divider','wall-paper-name','elec-pkg'].includes(it.type);
      if (!sel[it.id]) sel[it.id] = { on: alwaysOn, q: 1, val: 0, selectIdx: 0 };
      else if (alwaysOn) sel[it.id].on = true;
      if (it.type === 'cat-extra' && !catExtraState[it.id]) {
        catExtraState[it.id] = { text:'', amt:0, nego:0 };
      }
    })
  );
  FLOOR_DEMO_TYPES.forEach(ft => {
    if (!floorDemoSel[ft.id]) floorDemoSel[ft.id] = { on: false, q: 1 };
  });
}

let curCat = Object.keys(DATA)[0];

/* ════════ 초기화 ════════ */
document.addEventListener('DOMContentLoaded', () => {
  initSel();
  document.getElementById('clientDate').value = today();
  renderTabs(); renderItems(); calc();
  initItemEvents(); // 이벤트 위임 — wrap에 딱 한 번만 등록
  document.getElementById('pyung').addEventListener('input', onPyungChange);
  document.getElementById('btn-reset').addEventListener('click', resetAll);
  document.getElementById('btn-excel').addEventListener('click', downloadExcel);
  document.getElementById('btn-print-detail').addEventListener('click', () => { setPrintMode('detail'); window.print(); });
  document.getElementById('btn-print-simple').addEventListener('click', () => { setPrintMode('simple'); window.print(); });
  document.getElementById('btn-save').addEventListener('click', saveQuote);
  document.getElementById('btn-load').addEventListener('click', () => document.getElementById('load-modal').classList.remove('hidden'));
  document.getElementById('btn-share')?.addEventListener('click', shareQuote); // (예전 작업 화면 공유 — 지금은 send.js 일반 공유 사용)
  document.getElementById('load-modal-close').addEventListener('click', () => document.getElementById('load-modal').classList.add('hidden'));
  loadSavedList();
  ['clientName','clientPhone','clientAddr','clientPeriod','clientNote','clientDate']
    .forEach(id => document.getElementById(id).addEventListener('input', () => renderQuoteDoc()));
});

function today() { return new Date().toISOString().split('T')[0]; }
function getPyung() { return parseFloat(document.getElementById('pyung').value) || 0; }
function fmt(n) { return Math.round(n).toLocaleString('ko-KR'); }
function fmtW(n) { return fmt(n) + '원'; }
function findItem(id) {
  for (const c of Object.values(DATA)) for (const it of c.items) if (it.id === id) return it;
  return null;
}

/* ════════ 평수 변경 ════════ */
function onPyungChange() {
  const py = getPyung();
  Object.values(DATA).forEach(cat =>
    cat.items.forEach(it => { if (it.pyAuto && sel[it.id]?.on) sel[it.id].q = Math.max(1, Math.round(py)); })
  );
  renderItems(); calc();
}

/* ════════ 탭 ════════ */
function renderTabs() {
  // 카테고리별 금액 합산 (탭 배지용)
  const catTotals = getCatTotals();
  document.getElementById('tabs').innerHTML = Object.keys(DATA)
    .map(c => {
      const amt = catTotals[c] || 0;
      const hasAmt = amt > 0;
      const badge = hasAmt ? `<span class="tab-badge">${formatTabAmt(amt)}</span>` : '';
      return `<div class="tab${c === curCat ? ' on' : ''}${hasAmt ? ' has-amt' : ''}" onclick="switchTab('${c}')">${c}${badge}</div>`;
    }).join('');
}

function formatTabAmt(n) {
  if (n >= 10000000) return (n/10000000).toFixed(0) + '천만';
  if (n >= 1000000)  return (n/10000).toFixed(0) + '만';
  if (n >= 10000)    return (n/10000).toFixed(0) + '만';
  return (n/1000).toFixed(0) + '천';
}

function getCatTotals() {
  const map = {};
  // calcTotals의 catMap만 빠르게 재계산
  const { catMap } = calcTotals();
  return catMap;
}

function switchTab(cat) {
  curCat = cat;
  renderTabs();
  renderItems();
  // 양우 탭이면 평수 안내 고정
  if (cat === '양우아파트') {
    document.getElementById('sqm').textContent = '(105㎡ 고정)';
  }
}

/* ════════ 항목 렌더링 ════════ */
const CAT_COLORS = {
  '양우아파트': 'cat-yangu',
  '철거':     'cat-red',
  '창호':     'cat-sky',
  '설비':     'cat-blue',
  '중문':     'cat-teal',
  '목공':     'cat-amber',
  '욕실':     'cat-cyan',
  '타일':     'cat-stone',
  '도배':     'cat-lime',
  '마루':     'cat-wood',
  '전기·조명':'cat-yellow',
  '가구·설비':'cat-purple',
  '기타':     'cat-gray',
};

function renderItems() {
  const catData = DATA[curCat];
  const colorClass = CAT_COLORS[curCat] || 'cat-gray';
  const isYangu = curCat === '양우아파트';

  // 일반 탭: 기존 방식 (양우아파트는 별도 모드)
  let html = `<div class="items cat-zone ${colorClass}">`;
  catData.items.forEach(it => { html += renderItem(it); });
  html += '</div>';
  document.getElementById('content').innerHTML = html;
}

function isSpecialOn(it) {
  if (it.type === 'bath-rooms') return bathRooms.length > 0;
  if (it.type === 'elec-pkg') return !!elecPkg.type;
  if (it.type === 'bath-demo') return bathDemoState.living || bathDemoState.master;
  return false;
}

function getItemAmt(it) {
  const s = sel[it.id];
  if (!s?.on && !isSpecialOn(it)) return 0;
  if (it.pct) return 0;
  if (it.type === 'bath-rooms') return bathRooms.reduce((sum,r) => sum + calcBathRoomAmt(r), 0);
  if (it.type === 'elec-pkg') return elecPkg.type ? getElecPrice(getPyung(), elecPkg.type) : 0;
  if (it.type === 'cat-extra') { const st = catExtraState[it.id]; return st ? (st.amt||0)-(st.nego||0) : 0; }
  if (it.type === 'input') return s.val || 0;
  if (it.type === 'select-price') { const opt = it.options?.[s.selectIdx]; return opt?.p || 0; }
  return (it.p || 0) * (s.q || 1);
}

function toggleYangu(divId) {
  yanguOpen[divId] = !yanguOpen[divId];
  renderYanguItems(); calc();
}

/* ════════ 양우 모드 전환 ════════ */
function switchToYangu() {
  isYanguMode = true;
  document.getElementById('normal-mode').classList.add('hidden');
  document.getElementById('yangu-mode').classList.remove('hidden');
  document.getElementById('summary-title').textContent = '🏢 양우아파트 견적 요약';
  renderYanguItems(); calc();
}

function switchToNormal() {
  isYanguMode = false;
  document.getElementById('normal-mode').classList.remove('hidden');
  document.getElementById('yangu-mode').classList.add('hidden');
  document.getElementById('summary-title').textContent = '견적 요약';
  renderItems(); calc();
}

function renderYanguItems() {
  const catData = DATA['양우아파트'];
  if (!catData) return;
  const colorClass = 'cat-yangu';
  let html = renderYanguSelector() + `<div class="yangu-accordion cat-zone ${colorClass}">`;
  let currentGroup = null;
  let groupItems = [];
  let currentDivId = null;

  const flush = () => {
    if (!currentGroup) return;
    const isOpen = yanguOpen[currentDivId] !== false;
    const selCount = groupItems.filter(it => sel[it.id]?.on || isSpecialOn(it)).length;
    const selAmt = groupItems.reduce((s, it) => s + getItemAmt(it), 0);
    html += `<div class="yacc-section${isOpen?' open':''}">
      <div class="yacc-header" onclick="toggleYangu('${currentDivId}')">
        <span class="yacc-title">${currentGroup}</span>
        <div class="yacc-meta">
          ${selCount>0?`<span class="yacc-sel-badge">${selCount}개 선택</span>`:''}
          ${selAmt>0?`<span class="yacc-amt">${fmt(selAmt)}원</span>`:''}
        </div>
        <span class="yacc-arrow">${isOpen?'▲':'▼'}</span>
      </div>
      <div class="yacc-body">
        <div class="items">${groupItems.map(it => renderItem(it)).join('')}</div>
      </div>
    </div>`;
    groupItems = [];
  };

  catData.items.forEach(it => {
    if (it.type === 'divider') {
      flush();
      currentGroup = it.label || '';
      currentDivId = it.id;
      if (!(it.id in yanguOpen)) yanguOpen[it.id] = true;
    } else {
      groupItems.push(it);
    }
  });
  flush();
  html += '</div>';
  document.getElementById('yangu-content').innerHTML = html;
}

/* ════════ 양우 템플릿 선택 UI ════════ */
function renderYanguSelector() {
  const btns = Object.entries(YANGU_TEMPLATES).map(([key, t]) => {
    const isOn = yanguTemplate === key;
    return `<button class="yangu-tmpl-btn${isOn?' active':''}"
      style="${isOn?'background:'+t.color+';color:#fff;border-color:'+t.color:''}"
      onclick="event.stopPropagation();applyYanguTemplate('${key}')">
      <span class="yangu-tmpl-key">${t.label}</span>
      <span class="yangu-tmpl-desc">${t.desc}</span>
    </button>`;
  }).join('');

  const resetBtn = yanguTemplate
    ? `<button class="yangu-tmpl-reset" onclick="event.stopPropagation();resetYanguTemplate()">✕ 초기화</button>` : '';

  return `<div class="yangu-selector" onclick="event.stopPropagation()">
    <div class="yangu-selector-title">📋 견적 유형 선택</div>
    <div class="yangu-tmpl-btns">${btns}</div>
    ${resetBtn}
    ${yanguTemplate ? `<div class="yangu-tmpl-note">선택된 항목을 자유롭게 추가/제거할 수 있습니다</div>` : ''}
  </div>`;
}

function applyYanguTemplate(key) {
  yanguTemplate = key;
  const tmpl = YANGU_TEMPLATES[key];
  // 모든 양우 항목 초기화
  DATA['양우아파트'].items.forEach(it => {
    if (sel[it.id]) sel[it.id].on = false;
  });
  // 템플릿 항목 적용
  Object.entries(tmpl.ids).forEach(([id, state]) => {
    if (sel[id]) {
      sel[id].on = state.on;
      sel[id].q  = state.q || 1;
    }
  });
  renderYanguItems(); calc();
}

function resetYanguTemplate() {
  yanguTemplate = null;
  Object.values(DATA['양우아파트'].items).forEach(it => {
    if (sel[it.id]) { sel[it.id].on = false; sel[it.id].q = 1; }
  });
  renderItems(); calc();
}

function renderItem(it) {
  const s = sel[it.id];
  const isOn = s.on;

  if (it.type === 'floor-demo') return renderFloorDemo(it, isOn);

  if (it.type === 'bath-rooms') return renderBathRooms(it);
  if (it.type === 'auto-labor') return renderAutoLabor(it, isOn);
  if (it.type === 'auto-waste') return renderAutoWaste(it, isOn);
  if (it.type === 'nego') return renderNego(it);

  if (it.type === 'bath-demo') return renderBathDemo(it);
  if (it.type === 'wall-paper-name') return renderWallPaperName(it);
  if (it.type === 'elec-pkg') return renderElecPkg(it);
  if (it.type === 'divider') return renderDivider(it);
  if (it.type === 'cat-extra') return renderCatExtra(it);

  let priceLabel = '';
  if (it.pct) priceLabel = `공사금 ${(it.pct*100).toFixed(0)}% 자동`;
  else if (it.type === 'input') priceLabel = '직접 입력';
  else if (it.type === 'select-price') {
    // 선택 전: 옵션 수만 표시 / 선택 후: 선택된 항목 금액 표시
    if (!isOn) {
      priceLabel = `${it.options.length - 1}가지 선택`;
    } else {
      const sel_opt = it.options[s.selectIdx];
      priceLabel = sel_opt?.p ? `+${fmt(sel_opt.p)}원` : '선택 안함';
    }
  }
  else priceLabel = `${fmt(it.p)}원/${it.u}`;

  let controlHtml = '';
  if (isOn) {
    if (it.type === 'stepper' || it.type === 'pyung-unit') {
      controlHtml = `
        <div class="qty-row" onclick="event.stopPropagation()">
          <button class="qbtn" onclick="event.stopPropagation();adjQ('${it.id}',-1)">−</button>
          <input class="qinput" type="number" value="${s.q}" min="1" max="9999" data-id="${it.id}" onclick="event.stopPropagation()" oninput="event.stopPropagation();setQv('${it.id}',this.value)">
          <button class="qbtn" onclick="event.stopPropagation();adjQ('${it.id}',1)">+</button>
          <span class="iunit">${it.u}</span>
        </div>`;
    } else if (it.type === 'select-price') {
      const opts = it.options.map((o,i) => `<option value="${i}" ${s.selectIdx===i?'selected':''}>${o.label}${o.p?` (+${fmt(o.p)}원)`:''}</option>`).join('');
      controlHtml = `<div class="qty-row" onclick="event.stopPropagation()"><select class="sel-input" data-id="${it.id}" onchange="event.stopPropagation();setSelect('${it.id}',this.value)">${opts}</select></div>`;
    } else if (it.type === 'input') {
      controlHtml = `
        <div class="qty-row" onclick="event.stopPropagation()">
          <input class="qinput wide" type="number" placeholder="금액 입력" value="${s.val||''}" data-id="${it.id}" onclick="event.stopPropagation()" oninput="event.stopPropagation();setVal('${it.id}',this.value)">
          <span class="iunit">원</span>
        </div>`;
    }
  }

  const pytag = it.pyAuto ? `<span class="pytag">평수연동</span>` : '';
  // 우수관 방수+교체 동시 선택 시 세트 배지
  const drainBoth = (it.id==='plm_drain1'||it.id==='plm_drain2') && sel['plm_drain1']?.on && sel['plm_drain2']?.on;
  const setBadge = drainBoth ? `<span class="set-badge">🎉 세트 500,000원</span>` : '';
  return `
    <div class="item${isOn?' sel':''}" data-id="${it.id}">
      <div class="chk">${isOn?'✓':''}</div>
      <div class="iinfo">
        <div class="iname">${it.n}${pytag}${setBadge}</div>
        <div class="idesc">${it.type === 'select-price' && !isOn ? it.options.filter(o=>o.p>0).map(o=>o.label+' '+Math.round(o.p).toLocaleString()+'원').join(' · ') : it.d}</div>
      </div>
      <div class="iright">
        <div class="iprice">${priceLabel}</div>
        ${controlHtml}
      </div>
    </div>`;
}

/* 마루 철거 특수 렌더 */
function renderFloorDemo(it, isOn) {
  let inner = '';
  if (isOn) {
    inner = `<div class="floor-demo-grid" onclick="event.stopPropagation()">` +
      FLOOR_DEMO_TYPES.map(ft => {
        const fs = floorDemoSel[ft.id];
        const u = ft.u || '평';
        return `
          <div class="fd-row${fs.on?' fd-on':''}">
            <label class="fd-check" onclick="toggleFD('${ft.id}')">
              <span class="fd-chk">${fs.on?'✓':''}</span>
              <span class="fd-name">${ft.n}</span>
              <span class="fd-price">${fmt(ft.p)}원/${u}</span>
            </div>
            ${fs.on ? `<div class="fd-qty">
              <button onclick="adjFD('${ft.id}',-1)">−</button>
              <input type="number" value="${fs.q}" min="1" max="999" onchange="setFD('${ft.id}',this.value)">
              <button onclick="adjFD('${ft.id}',1)">+</button>
              <span class="iunit">${u}</span>
            </div>` : ''}
          </div>`;
      }).join('') + `</div>`;
  }
  return `
    <div class="item item-wide${isOn?' sel':''}" data-id="${it.id}">
      <div class="chk">${isOn?'✓':''}</div>
      <div class="iinfo" style="flex:1">
        <div class="iname">${it.n}</div>
        <div class="idesc">${it.d}</div>
        ${inner}
      </div>
    </div>`;
}

// renderMatOption 제거됨


/* 욕실 수 + 타입 + 옵션 통합 렌더 */
const BATH_TYPES = [
  { key:'std',  label:'베이직형',   p:2900000, color:'#4a7c59' },
  { key:'high', label:'스탠다드형', p:4300000, color:'#185fa5' },
  { key:'prem', label:'프리미엄형', p:5200000, color:'#7b3fa0' },
];

const BATH_OPTS = [
  { key:'faucet', label:'수전금구 업그레이드', p:300000 },
  { key:'shower', label:'해바라기 수전',       p:150000 },
  { key:'zendai', label:'젠다이',              p:150000 },
  { key:'mirror', label:'수납장 거울형',       p:200000 },
  { key:'size',   label:'사이즈 추가',         p:150000 },
  { key:'elec',   label:'전기 추가',           p:100000 },
  { key:'tub',    label:'욕조',                p:200000 },
  { key:'spray',  label:'스프레이건',          p:50000  },
];
const BATH_FAN_OPTS = [
  { label:'환풍기 기본', p:0 },
  { label:'휴젠뜨',      p:300000 },
  { label:'휴젠뜨 노바', p:350000 },
  { label:'휴젠뜨 팔레트', p:450000 },
];

function calcBathRoomAmt(r) {
  const BPRICES = { std:2900000, high:4300000, prem:5200000 };
  let a = BPRICES[r.type] || 0;
  BATH_OPTS.forEach(o => { if (r.opts[o.key]) a += o.p; });
  a += (BATH_FAN_OPTS[r.opts.fan] || {p:0}).p;
  return a;
}

function renderBathRooms(it) {
  const count = bathRooms.length;
  const total = bathRooms.reduce((s,r) => s + calcBathRoomAmt(r), 0);

  let roomCards = '';
  for (let i = 0; i < count; i++) {
    const r = bathRooms[i];
    const roomAmt = calcBathRoomAmt(r);

    // 타입 버튼
    const typeBtns = BATH_TYPES.map(t => `
      <button class="bath-type-btn${r.type===t.key?' active':''}"
        style="${r.type===t.key?'background:'+t.color+';color:#fff;border-color:'+t.color:''}"
        onclick="event.stopPropagation();setBathType(${i},'${t.key}')">
        ${t.label}<br><span class="bath-type-price">${fmt(t.p)}원</span>
      </button>`).join('');

    // 추가 옵션 체크
    const optChecks = BATH_OPTS.map(o => `
      <div class="bath-opt-item${r.opts[o.key]?' on':''}" onclick="event.stopPropagation();toggleBathOpt(${i},'${o.key}')">
        <span class="bath-opt-chk">${r.opts[o.key]?'✓':''}</span>
        <span class="bath-opt-label">${o.label}</span>
        <span class="bath-opt-price">+${fmt(o.p)}</span>
      </div>`).join('');

    // 환풍기 셀렉트
    const fanOpts = BATH_FAN_OPTS.map((f,fi) =>
      `<option value="${fi}" ${r.opts.fan===fi?'selected':''}>` +
      `${f.label}${f.p?` (+${fmt(f.p)}원)`:''}</option>`
    ).join('');

    roomCards += `
      <div class="bath-room-card">
        <div class="bath-room-header">
          <span class="bath-room-label">${i===0?'1번째 욕실 (거실)':i===1?'2번째 욕실 (안방)':(i+1)+'번째 욕실'}</span>
          <span class="bath-room-amt">${fmtW(roomAmt)}</span>
        </div>
        <div class="bath-type-btns">${typeBtns}</div>
        <div class="bath-opts-grid">${optChecks}</div>
        <div class="bath-fan-row">
          <span class="bath-opt-label" style="white-space:nowrap">환풍기</span>
          <select class="sel-input" style="flex:1"
            onclick="event.stopPropagation()"
            onchange="event.stopPropagation();setBathFan(${i},this.value)">${fanOpts}</select>
        </div>
      </div>`;
  }

  return `
    <div class="item item-wide bath-rooms-item">
      <div class="iinfo" style="flex:1">
        <div class="bath-header">
          <div>
            <div class="iname">욕실 수 선택</div>
            <div class="idesc">욕실 수를 선택 후 각각 타입과 옵션을 지정하세요</div>
          </div>
          <div class="bath-counter" onclick="event.stopPropagation()">
            <button class="qbtn" onclick="event.stopPropagation();adjBathCount(-1)">−</button>
            <span class="bath-count-num">${count}</span>
            <button class="qbtn" onclick="event.stopPropagation();adjBathCount(1)">+</button>
            <span class="iunit">실</span>
            ${count > 0 ? `<span class="bath-total-badge">${fmtW(total)}</span>` : ''}
          </div>
        </div>
        ${count > 0 ? `<div class="bath-rooms-grid">${roomCards}</div>` : ''}
      </div>
    </div>`;
}

function adjBathCount(d) {
  const newCount = Math.max(0, bathRooms.length + d);
  while (bathRooms.length < newCount) bathRooms.push({
    type: 'std',
    opts: { faucet:false, shower:false, zendai:false, mirror:false, size:false, elec:false, tub:false, spray:false, fan:0 }
  });
  while (bathRooms.length > newCount) bathRooms.pop();
  requestAnimationFrame(() => { renderItems(); calc(); });
}

function setBathType(idx, type) {
  if (bathRooms[idx]) { bathRooms[idx].type = type; requestAnimationFrame(() => { renderItems(); calc(); }); }
}
function toggleBathOpt(idx, key) {
  if (bathRooms[idx]) { bathRooms[idx].opts[key] = !bathRooms[idx].opts[key]; requestAnimationFrame(() => { renderItems(); calc(); }); }
}
function setBathFan(idx, val) {
  if (bathRooms[idx]) {
    bathRooms[idx].opts.fan = parseInt(val)||0;
    if (isYanguMode) renderYanguItems();
    calc();
  }
}

/* ════════ 카테고리별 기타 / 네고 렌더 ════════ */
function renderCatExtra(it) {
  const st = catExtraState[it.id] || { text:'', amt:0, nego:0 };
  const netAmt = (st.amt||0) - (st.nego||0);
  const hasData = st.amt > 0 || st.nego > 0;

  return `
    <div class="item item-wide cat-extra-item">
      <div class="iinfo" style="flex:1">
        <div class="cat-extra-header">
          <div class="iname" style="font-size:13px">기타 항목 &amp; 네고</div>
          ${hasData ? `<span class="cat-extra-net ${netAmt<0?'neg':'pos'}">${netAmt>=0?'+':''}${fmt(netAmt)}원</span>` : ''}
        </div>
        <div class="cat-extra-grid" onclick="event.stopPropagation()">

          <!-- 기타 금액 입력 -->
          <div class="cat-extra-col">
            <div class="cat-extra-label">📝 기타 항목</div>
            <input class="cat-extra-text" type="text" placeholder="항목명 메모 (예: 도어락 교체)"
              value="${st.text||''}"
              oninput="event.stopPropagation();setCatExtraText('${it.id}',this.value)">
            <div class="cat-extra-amt-row">
              <span class="cat-extra-sign">+</span>
              <input class="cat-extra-num" type="number" min="0" placeholder="금액 입력"
                value="${st.amt > 0 ? st.amt : ''}"
                oninput="event.stopPropagation();setCatExtraAmt('${it.id}',this.value)">
              <span class="iunit">원</span>
            </div>
          </div>

          <!-- 네고 입력 -->
          <div class="cat-extra-col">
            <div class="cat-extra-label" style="color:#e05c5c">🔻 네고 / 할인</div>
            <input class="cat-extra-text" type="text" placeholder="네고 사유 (예: 현장 특이사항)"
              value="${st.negoText||''}"
              oninput="event.stopPropagation();setCatExtraNegoText('${it.id}',this.value)">
            <div class="cat-extra-amt-row">
              <span class="cat-extra-sign" style="color:#e05c5c">−</span>
              <input class="cat-extra-num nego" type="number" min="0" placeholder="할인 금액"
                value="${st.nego > 0 ? st.nego : ''}"
                oninput="event.stopPropagation();setCatExtraNego('${it.id}',this.value)">
              <span class="iunit">원</span>
            </div>
          </div>

        </div>
      </div>
    </div>`;
}

function setCatExtraText(id, v) {
  if (!catExtraState[id]) catExtraState[id] = { text:'', amt:0, nego:0 };
  catExtraState[id].text = v;
  calc(); // 텍스트 변경도 견적서에 반영
}
function setCatExtraNegoText(id, v) {
  if (!catExtraState[id]) catExtraState[id] = { text:'', amt:0, nego:0 };
  catExtraState[id].negoText = v;
}
function setCatExtraAmt(id, v) {
  if (!catExtraState[id]) catExtraState[id] = { text:'', amt:0, nego:0 };
  const parsed = parseFloat(v);
  // 빈 문자열이나 0이면 완전히 0으로 초기화 (삭제 가능)
  catExtraState[id].amt = (!v || v === '' || isNaN(parsed)) ? 0 : Math.max(0, parsed);
  calc();
}
function setCatExtraNego(id, v) {
  if (!catExtraState[id]) catExtraState[id] = { text:'', amt:0, nego:0 };
  const parsed = parseFloat(v);
  catExtraState[id].nego = (!v || v === '' || isNaN(parsed)) ? 0 : Math.max(0, parsed);
  calc();
}

/* ════════ 섹션 구분선 ════════ */
function renderDivider(it) {
  // data.js에서 label 필드로 구분선 텍스트 커스텀 가능
  const label = it.label || '추가 옵션';
  return `<div class="items-divider" data-id="${it.id}">
    <span class="items-divider-label">${label}</span>
  </div>`;
}

/* ════════ 전기·조명 패키지 렌더 ════════ */
const ELEC_TYPES = [
  {
    key:'basic', label:'베이직', color:'#16a34a',
    items:['기존 배선 점검 및 보수','LED 전등 전체 교체','스위치·콘센트 전체 교체','차단기 점검','욕실/베란다 조명 교체','전기 마감 및 절연']
  },
  {
    key:'standard', label:'스탠다드', color:'#2563eb',
    items:['베이직 포함','기본 매립등 시공','매립등 추가 설치','간접조명(우물·커튼박스 등)','콘센트·스위치 위치 변경','TV/인터넷 배선 정리','주방 펜던트 조명','회로 일부 증설','IoT 스위치 일부 적용']
  },
  {
    key:'premium', label:'프리미엄', color:'#7c3aed',
    items:['스탠다드 포함','공간별 조명 설계','전기배선 신규 입선','회로 증설 및 분리','스마트 스위치 전체','팬던트·라인조명 시공','무드 간접조명','대용량 가전 전용 회로','분전반 정비 및 교체(필요시)']
  },
];

// 평형별 단가표
function getElecPrice(pyung, type) {
  const ranges = [
    { max:24,  basic:1800000, standard:2600000, premium:3600000 },
    { max:34,  basic:2400000, standard:3300000, premium:4500000 },
    { max:42,  basic:2900000, standard:3900000, premium:5300000 },
    { max:999, basic:3400000, standard:4600000, premium:6200000 },
  ];
  const range = ranges.find(r => pyung <= r.max) || ranges[ranges.length-1];
  return range[type] || 0;
}

function getPyungLabel(pyung) {
  if (pyung <= 24)  return '21~24평';
  if (pyung <= 34)  return '28~34평';
  if (pyung <= 42)  return '36~42평';
  return '43~48평';
}

function renderElecPkg(it) {
  const py = getPyung();
  const pyLabel = getPyungLabel(py);
  const cur = elecPkg.type;

  const typeBtns = ELEC_TYPES.map(t => {
    const p = getElecPrice(py, t.key);
    const isOn = cur === t.key;
    return `<button class="elec-type-btn${isOn ? ' active' : ''}"
      style="${isOn ? 'background:'+t.color+';color:#fff;border-color:'+t.color : ''}"
      onclick="event.stopPropagation();setElecType('${t.key}')">
      <span class="elec-type-label">${t.label}</span>
      <span class="elec-type-price">${fmt(p)}원</span>
    </button>`;
  }).join('');

  // 선택된 타입의 항목 목록
  let itemList = '';
  if (cur) {
    const sel_type = ELEC_TYPES.find(t => t.key === cur);
    if (sel_type) {
      itemList = `<div class="elec-items-list">
        ${sel_type.items.map(item => `<span class="elec-item-tag">✓ ${item}</span>`).join('')}
      </div>`;
    }
  }

  const totalAmt = cur ? getElecPrice(py, cur) : 0;

  return `
    <div class="item item-wide elec-pkg-item" onclick="event.stopPropagation()">
      <div class="iinfo" style="flex:1">
        <div class="bath-header">
          <div>
            <div class="iname">전기·조명 패키지</div>
            <div class="idesc">평형(${py}평 · ${pyLabel}) 기준 자동 단가 적용</div>
          </div>
          ${totalAmt > 0 ? `<span class="bath-total-badge">${fmtW(totalAmt)}</span>` : ''}
        </div>
        <div class="elec-type-btns">${typeBtns}</div>
        ${itemList}
      </div>
    </div>`;
}

function setElecType(type) {
  elecPkg.type = (elecPkg.type === type) ? null : type; // 재클릭 시 해제
  renderItems(); calc();
}

/* ════════ 도배지명 메모 렌더 ════════ */
function renderWallPaperName(it) {
  return `
    <div class="item item-wide wall-paper-name-item" onclick="event.stopPropagation()">
      <div class="iinfo" style="flex:1">
        <div class="wall-paper-header">
          <span class="iname">📋 도배지명 메모</span>
          <span class="idesc">사용할 도배지 브랜드 및 제품명을 입력하세요 (견적서에 포함됩니다)</span>
        </div>
        <input class="wall-paper-input" type="text"
          placeholder="예: 개나리 로하스 / LG 실크벽지 프리미엄 등"
          value="${wallPaperName}"
          oninput="event.stopPropagation();setWallPaperName(this.value)"
          onclick="event.stopPropagation()">
      </div>
    </div>`;
}

function setWallPaperName(v) {
  wallPaperName = v;
  renderQuoteDoc(); // 견적서 즉시 갱신
}

/* ════════ 욕실 철거 렌더 ════════ */
function renderBathDemo(it) {
  const total = (bathDemoState.living ? 800000 : 0) + (bathDemoState.master ? 800000 : 0);
  return `
    <div class="item item-wide bath-rooms-item">
      <div class="iinfo" style="flex:1">
        <div class="bath-header">
          <div>
            <div class="iname">욕실 철거</div>
            <div class="idesc">개소당 800,000원 · 거실/안방 각각 선택</div>
          </div>
          ${total > 0 ? `<span class="bath-total-badge">${fmtW(total)}</span>` : ''}
        </div>
        <div class="bath-demo-grid" onclick="event.stopPropagation()">
          <div class="bath-demo-card${bathDemoState.living?' active':''}"
            onclick="event.stopPropagation();toggleBathDemo('living')">
            <div class="bath-demo-chk">${bathDemoState.living?'✓':''}</div>
            <div class="bath-demo-info">
              <div class="bath-demo-label">1개소 (거실 욕실)</div>
              <div class="bath-demo-price">800,000원</div>
            </div>
          </div>
          <div class="bath-demo-card${bathDemoState.master?' active':''}"
            onclick="event.stopPropagation();toggleBathDemo('master')">
            <div class="bath-demo-chk">${bathDemoState.master?'✓':''}</div>
            <div class="bath-demo-info">
              <div class="bath-demo-label">2개소 (안방 욕실)</div>
              <div class="bath-demo-price">800,000원</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function toggleBathDemo(key) {
  bathDemoState[key] = !bathDemoState[key];
  requestAnimationFrame(() => { renderItems(); calc(); });
}

/* ════════ 화장실 방수 렌더 ════════ */
// 욕실 방수: 1차=20만, 2~3차 단독=40만, 동시선택 시 각 20만
// → 1차만: 20만 / 2~3차만: 40만 / 1차+2~3차: 각20만 (합40만)
// 욕실 방수 상수/함수 제거됨 (stepper 방식으로 대체)




function renderNego(it) {
  return `
    <div class="item item-wide nego-item">
      <div class="nego-icon">%</div>
      <div class="iinfo" style="flex:1">
        <div class="nego-header">
          <div>
            <div class="iname" style="color:#e05c5c">네고 / 할인</div>
            <div class="idesc">마이너스(-) 금액을 입력하면 총 견적에서 차감됩니다</div>
          </div>
          ${negoAmt > 0 ? `<span class="nego-badge">− ${fmt(negoAmt)}원</span>` : ''}
        </div>
        <div class="nego-input-row" onclick="event.stopPropagation()">
          <span class="nego-minus">−</span>
          <input class="nego-input" id="nego-input" type="number" min="0"
            placeholder="할인 금액 입력 (예: 200000)"
            value="${negoAmt || ''}"
            oninput="event.stopPropagation();setNego(this.value)">
          <span class="iunit">원</span>
          ${negoAmt > 0 ? `<button class="nego-clear" onclick="event.stopPropagation();setNego(0);document.getElementById('nego-input').value=''">✕ 취소</button>` : ''}
        </div>
      </div>
    </div>`;
}

function setNego(v) {
  negoAmt = Math.max(0, parseFloat(v) || 0);
  calc();
}

/* ════════ 평수 기반 자동 계산 헬퍼 ════════ */
function getLaborCount(py) {
  if (py <= 21) return 3;
  if (py <= 24) return 4;
  if (py <= 32) return 5;
  if (py <= 40) return 6;
  if (py <= 48) return 7;
  return 8; // 56평+
}

function getWasteCount(py) {
  if (py <= 32) return 2;
  if (py <= 48) return 3;
  return 4;
}

function renderAutoLabor(it, isOn) {
  const py = getPyung();
  const autoCount = getLaborCount(py);
  const s = sel[it.id];
  // 수동 조정값 (0이면 자동)
  const manualAdj = s.val || 0;
  const count = autoCount + manualAdj;
  const amt = count * 250000;

  return `
    <div class="item item-wide auto-item${isOn?' sel':''}" data-id="${it.id}">
      <div class="chk">${isOn?'✓':''}</div>
      <div class="iinfo" style="flex:1">
        <div class="auto-item-header">
          <div>
            <div class="iname">${it.n}</div>
            <div class="idesc">품당 250,000원 · 평수(${py}평) 기준 자동 계산</div>
          </div>
          <div class="auto-result">
            <span class="auto-count-badge">${count}품</span>
            <span class="auto-amt">${isOn ? fmtW(amt) : ''}</span>
          </div>
        </div>
        ${isOn ? `
        <div class="auto-adjust-row" onclick="event.stopPropagation()">
          <span class="auto-base-info">기본 ${autoCount}품 (${py}평 기준)</span>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:11px;color:var(--tx2)">품 수 조정</span>
            <button class="qbtn" onclick="event.stopPropagation();adjAutoLabor(-1)">−</button>
            <span class="auto-adj-num">${manualAdj > 0 ? '+'+manualAdj : manualAdj}</span>
            <button class="qbtn" onclick="event.stopPropagation();adjAutoLabor(1)">+</button>
            <span style="font-size:11px;color:var(--tx3)">최종 ${count}품 = ${fmtW(amt)}</span>
          </div>
        </div>` : ''}
      </div>
    </div>`;
}

function renderAutoWaste(it, isOn) {
  const py = getPyung();
  const autoCount = getWasteCount(py);
  const s = sel[it.id];
  const manualAdj = s.val || 0;
  const count = Math.max(1, autoCount + manualAdj);
  const amt = count * 450000;

  return `
    <div class="item item-wide auto-item${isOn?' sel':''}" data-id="${it.id}">
      <div class="chk">${isOn?'✓':''}</div>
      <div class="iinfo" style="flex:1">
        <div class="auto-item-header">
          <div>
            <div class="iname">${it.n}</div>
            <div class="idesc">차량당 450,000원 · 평수(${py}평) 기준 자동 계산</div>
          </div>
          <div class="auto-result">
            <span class="auto-count-badge">${count}대</span>
            <span class="auto-amt">${isOn ? fmtW(amt) : ''}</span>
          </div>
        </div>
        ${isOn ? `
        <div class="auto-adjust-row" onclick="event.stopPropagation()">
          <span class="auto-base-info">기본 ${autoCount}대 (${py}평 기준 · 21~32평 2대 / ~48평 3대 / 이상 4대)</span>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:11px;color:var(--tx2)">차량 수 조정</span>
            <button class="qbtn" onclick="event.stopPropagation();adjAutoWaste(-1)">−</button>
            <span class="auto-adj-num">${manualAdj > 0 ? '+'+manualAdj : manualAdj}</span>
            <button class="qbtn" onclick="event.stopPropagation();adjAutoWaste(1)">+</button>
            <span style="font-size:11px;color:var(--tx3)">최종 ${count}대 = ${fmtW(amt)}</span>
          </div>
        </div>` : ''}
      </div>
    </div>`;
}

function adjAutoLabor(d) {
  const s = sel['dem_labor'];
  s.val = (s.val || 0) + d;
  if (isYanguMode) { renderYanguItems(); } else { renderItems(); }
  calc();
}
function adjAutoWaste(d) {
  const s = sel['dem_waste'];
  const py = getPyung();
  const autoCount = getWasteCount(py);
  s.val = Math.max(1 - autoCount, (s.val || 0) + d);
  renderItems(); calc();
}

// calcYoungDoorBase 제거됨 (매트 옵션 삭제)


/* ════════ 이벤트 바인딩 — DOMContentLoaded에서 wrap에 딱 한 번 등록 ════════ */
function initItemEvents() {
  document.querySelector('.wrap').addEventListener('click', e => {
    // 일반 탭 or 양우 탭 모두 감지
    const itemEl = e.target.closest('#content .item[data-id], #yangu-content .item[data-id]');
    if (!itemEl) return;
    const stopZones = '.qty-row,.floor-demo-grid,.fd-row,.fd-qty,.fd-check,.auto-adjust-row,.bath-demo-grid,.bath-type-btns,.bath-opts-grid,.bath-fan-row,.bath-counter,.cat-extra-grid,.nego-input-row,.client-info-box,.area-row,.summary,.quote-actions,.quote-doc';
    if (e.target.closest(stopZones)) return;
    togItem(itemEl.dataset.id);
  });
}

function togItem(id) {
  const it = findItem(id);
  // cat-extra / bath-demo / bath-water / bath-rooms 는 별도 상태로 관리 → s.on=true 고정
  // 이 타입들은 내부 버튼으로만 동작 — .item 클릭 시 아무것도 안 함
  if (it?.type === 'cat-extra' || it?.type === 'divider' ||
      it?.type === 'nego' || it?.type === 'bath-demo' ||
      it?.type === 'bath-rooms' || it?.type === 'wall-paper-name' ||
      it?.type === 'elec-pkg') return;
  const s = sel[id]; s.on = !s.on;
  if (s.on) {
    s.q = (it?.pyAuto) ? Math.max(1, Math.round(getPyung())) : 1;
    if (it?.type === 'select-price') s.selectIdx = 0;
    if (it?.type === 'auto-labor' || it?.type === 'auto-waste') s.val = 0;
  }
  if(isYanguMode){renderYanguItems();}else{renderItems();}
  calc();
}
function adjQ(id, d) { const s = sel[id]; if(!s) return; s.q = Math.max(1, (s.q||1)+d); if(isYanguMode){renderYanguItems();}else{renderItems();} calc(); }
function setQv(id, v) { if(!sel[id]) return; sel[id].q = Math.max(1, parseInt(v)||1); if(isYanguMode){renderYanguItems();}else{renderItems();} calc(); }
function setVal(id, v) { sel[id].val = parseFloat(v)||0; calc(); }
function setSelect(id, v) { sel[id].selectIdx = parseInt(v); calc(); }
function toggleFD(fid) { const fs=floorDemoSel[fid]; fs.on=!fs.on; renderItems(); calc(); }
function adjFD(fid, d) { const fs=floorDemoSel[fid]; fs.q=Math.max(1,fs.q+d); renderItems(); calc(); }
function setFD(fid, v) { floorDemoSel[fid].q=Math.max(1,parseInt(v)||1); calc(); }

/* ════════ 금액 계산 ════════ */
function calcTotals() {
  let baseSub = 0;
  const catMap = {};
  const rows = []; // { catName, label, detail, qty, u, unitP, amt }

  // 기본 견적서 모드면 DATA 항목은 계산하지 않음 (tplCollectRows 사용)
  // 양우 모드면 양우아파트만, 일반 모드면 양우아파트 제외
  const dataToCalc = isTplMode
    ? {}
    : isYanguMode
    ? { '양우아파트': DATA['양우아파트'] }
    : Object.fromEntries(Object.entries(DATA).filter(([k]) => k !== '양우아파트'));

  // 양우 모드에서 현재 섹션 추적 (divider label을 catName으로 사용)
  let yanguCurrentSection = '양우아파트';

  Object.entries(dataToCalc).forEach(([catName, cat]) => {
    cat.items.forEach(it => {
      if (it.pct) return;
      if (it.type === 'divider') {
        // 양우 모드에서 섹션명을 catName으로 사용
        if (isYanguMode && it.label) yanguCurrentSection = it.label;
        return;
      }
      const s = sel[it.id];
      // 양우 모드에서는 섹션별 catName 사용
      const effectiveCatName = isYanguMode ? yanguCurrentSection : catName;

      // cat-extra / bath-rooms / bath-water 는 s.on 체크 없이 항상 계산
      if (it.type === 'cat-extra') {
        const st = catExtraState[it.id];
        if (!st) return;
        const extraAmt = st.amt || 0;
        const extraNego = st.nego || 0;
        if (!extraAmt && !extraNego) return;
        if (extraAmt > 0) {
          catMap[effectiveCatName] = (catMap[effectiveCatName]||0) + extraAmt;
          baseSub += extraAmt;
          rows.push({ catName: effectiveCatName, label: st.text || '기타', detail:'직접 입력', qty:1, u:'식', unitP:extraAmt, amt:extraAmt });
        }
        if (extraNego > 0) {
          catMap[effectiveCatName] = (catMap[effectiveCatName]||0) - extraNego;
          baseSub -= extraNego;
          rows.push({ catName: effectiveCatName, label: `네고 (${st.negoText||'할인'})`, detail:'차감', qty:1, u:'식', unitP:-extraNego, amt:-extraNego });
        }
        return;
      }

      if (it.type === 'bath-rooms') {
        const BLABELS = { std:'베이직형', high:'스탠다드형', prem:'프리미엄형' };
        bathRooms.forEach((r, i) => {
          const a = calcBathRoomAmt(r);
          if (!a) return;
          const BPRICES_B = { std:2900000, high:4300000, prem:5200000 };
          const baseA = BPRICES_B[r.type] || 0;
          rows.push({ catName: effectiveCatName, label:`욕실 ${i+1} — ${BLABELS[r.type]}`, detail:'기본', qty:1, u:'실', unitP:baseA, amt:baseA });
          BATH_OPTS.forEach(o => {
            if (r.opts[o.key]) rows.push({ catName: effectiveCatName, label:`욕실 ${i+1} — ${o.label}`, detail:'', qty:1, u:'개', unitP:o.p, amt:o.p });
          });
          const fan = BATH_FAN_OPTS[r.opts.fan];
          if (fan && fan.p > 0) rows.push({ catName: effectiveCatName, label:`욕실 ${i+1} — ${fan.label}`, detail:'환풍기', qty:1, u:'개', unitP:fan.p, amt:fan.p });
          // ★ catMap/baseSub 합산
          catMap[effectiveCatName] = (catMap[effectiveCatName]||0) + a;
          baseSub += a;
        });
        return;
      }



      if (!s?.on) return;

      let amt = 0;

      if (it.type === 'elec-pkg') {
        if (!elecPkg.type) return;
        const py = getPyung();
        const a = getElecPrice(py, elecPkg.type);
        if (!a) return;
        const typeLabel = ELEC_TYPES.find(t=>t.key===elecPkg.type)?.label || '';
        catMap[effectiveCatName] = (catMap[effectiveCatName]||0) + a;
        baseSub += a;
        rows.push({ catName: effectiveCatName, label:`전기·조명 ${typeLabel} 패키지`, detail:`${getPyungLabel(py)} 기준`, qty:1, u:'식', unitP:a, amt:a });
        return;
      }

      if (it.type === 'bath-demo') {
        // 욕실 철거 계산
        const BATH_DEMO_P = 800000;
        if (bathDemoState.living) {
          catMap[effectiveCatName] = (catMap[effectiveCatName]||0) + BATH_DEMO_P;
          baseSub += BATH_DEMO_P;
          rows.push({ catName: effectiveCatName, label:'욕실 철거 — 거실 욕실', detail:'올철거', qty:1, u:'개소', unitP:BATH_DEMO_P, amt:BATH_DEMO_P });
        }
        if (bathDemoState.master) {
          catMap[effectiveCatName] = (catMap[effectiveCatName]||0) + BATH_DEMO_P;
          baseSub += BATH_DEMO_P;
          rows.push({ catName: effectiveCatName, label:'욕실 철거 — 안방 욕실', detail:'올철거', qty:1, u:'개소', unitP:BATH_DEMO_P, amt:BATH_DEMO_P });
        }
        return;
      }

      let unitP = it.p || 0;
      let detail = it.d;
      let qtyLabel = s.q;

      if (it.type === 'auto-labor') {
        const py = getPyung();
        const autoCount = getLaborCount(py);
        const adj = s.val || 0;
        const count = autoCount + adj;
        const a = count * 250000;
        if (!a) return;
        catMap[effectiveCatName] = (catMap[effectiveCatName]||0) + a;
        baseSub += a;
        rows.push({ catName: effectiveCatName, label:'인건비', detail:`${py}평 기준 ${count}품`, qty:count, u:'품', unitP:250000, amt:a });
        return;
      }

      if (it.type === 'auto-waste') {
        const py = getPyung();
        const autoCount = getWasteCount(py);
        const adj = s.val || 0;
        const count = Math.max(1, autoCount + adj);
        const a = count * 450000;
        if (!a) return;
        catMap[effectiveCatName] = (catMap[effectiveCatName]||0) + a;
        baseSub += a;
        rows.push({ catName: effectiveCatName, label:'폐기물', detail:`${py}평 기준 ${count}대`, qty:count, u:'대', unitP:450000, amt:a });
        return;
      }


      if (it.type === 'floor-demo') {
        // 마루 철거 세부 합산
        FLOOR_DEMO_TYPES.forEach(ft => {
          const fs = floorDemoSel[ft.id];
          if (!fs.on) return;
          const a = ft.p * fs.q;
          amt += a;
          rows.push({ catName: effectiveCatName, label: `마루 철거 — ${ft.n}`, detail:'', qty:fs.q, u:(ft.u||'평'), unitP:ft.p, amt:a });
        });
        if (amt > 0) catMap[effectiveCatName] = (catMap[effectiveCatName]||0) + amt;
        baseSub += amt;
        return;
      }

      if (it.type === 'select-price') {
        const opt = it.options[s.selectIdx];
        if (!opt || opt.p === 0) return;
        amt = opt.p;
        detail = opt.label;
        qtyLabel = 1;
      } else if (it.type === 'input') {
        amt = s.val || 0;
        if (!amt) return;
        unitP = amt;
        qtyLabel = 1;
      } else {
        amt = unitP * s.q;
        qtyLabel = s.q;
      }

      if (!amt) return;
      catMap[effectiveCatName] = (catMap[effectiveCatName]||0) + amt;
      baseSub += amt;
      rows.push({ catName: effectiveCatName, label: it.n, detail, qty: qtyLabel, u: it.u, unitP, amt });
    });
  });

  // ── 화장실 방수 계산 ──
  if (!isTplMode && bathWaterList.length > 0) {
    bathWaterList.forEach((r, i) => {
      const t = BATH_WATER_TYPES.find(t=>t.key===r.type);
      if (!t) return;
      const a = t.p;
      catMap[isYanguMode ? yanguCurrentSection : '설비'] = (catMap[isYanguMode ? yanguCurrentSection : '설비']||0) + a;
      baseSub += a;
      rows.push({ catName: isYanguMode ? '② 설비' : '설비', label:`화장실 방수 ${i+1}개소 — ${t.label}`, detail:t.desc, qty:1, u:'개소', unitP:a, amt:a });
    });
  }

  // ── 욕실 방수 1차+2~3차 동시 선택 시 할인 처리 ──
  // 1차(plm_water1) + 2~3차(plm_water2) 동시 선택 시: 2~3차 400,000 → 200,000 (개소당 -20만)
  const w1 = sel['plm_water1'];
  const w2 = sel['plm_water2'];
  if (!isTplMode && w1?.on && w2?.on) {
    const comboQty = Math.min(w1.q, w2.q);
    const discount = comboQty * 200000; // 개소당 20만 할인
    if (discount > 0) {
      catMap[isYanguMode ? yanguCurrentSection : '설비'] = (catMap[isYanguMode ? yanguCurrentSection : '설비'] || 0) - discount;
      baseSub -= discount;
      rows.push({ catName: isYanguMode ? '② 설비' : '설비', label:'욕실 방수 동시선택 할인', detail:`1차+2~3차 ${comboQty}개소`, qty:comboQty, u:'개소', unitP:-200000, amt:-discount });
    }
  }

  // ── 우수관 방수 + 교체 동시 선택 시 세트 할인 ──
  // 세트: 방수(25만) + 교체(35만) = 60만 → 50만 (개소당 10만 할인)
  // 수량 다를 경우: 최소값만큼 세트, 나머지는 개별 단가 적용
  // 예) 방수2 + 교체1 → 1세트(50만) + 방수1개(25만) = 75만
  const drain1 = sel['plm_drain1'];
  const drain2 = sel['plm_drain2'];
  if (!isTplMode && drain1?.on && drain2?.on) {
    const setQty   = Math.min(drain1.q, drain2.q); // 세트 적용 수량
    const extra1   = drain1.q - setQty;             // 방수 단독 잉여
    const extra2   = drain2.q - setQty;             // 교체 단독 잉여

    // 현재 rows에 이미 개별 단가로 계산된 금액이 들어있음
    // 실제 내야 할 금액으로 보정
    const currentCharged = (250000 * drain1.q) + (350000 * drain2.q);
    const correctAmt     = (500000 * setQty) + (250000 * extra1) + (350000 * extra2);
    const discount       = currentCharged - correctAmt;

    if (discount > 0) {
      catMap[isYanguMode ? yanguCurrentSection : '설비'] = (catMap[isYanguMode ? yanguCurrentSection : '설비'] || 0) - discount;
      baseSub -= discount;
      rows.push({
        catName: '설비',
        label:  `우수관 세트 할인 (${setQty}세트)`,
        detail: `방수+교체 세트 500,000원/세트`,
        qty: setQty, u: '세트', unitP: -100000, amt: -discount
      });
    }
  }

  // ── 기본 견적서 모드 항목 + 특이사항 (모든 모드 공통) ──
  const extraRows = [
    ...(isTplMode && typeof tplCollectRows === 'function' ? tplCollectRows() : []),
    ...(typeof specialRows === 'function' ? specialRows() : []),
  ];
  extraRows.forEach(r => {
    rows.push(r);
    catMap[r.catName] = (catMap[r.catName] || 0) + r.amt;
    baseSub += r.amt;
  });

  // pct 항목 (업체 이윤 등) — 현재 모드에서 계산하는 카테고리만, 특이사항 포함 금액 기준
  let pctSub = 0;
  Object.entries(dataToCalc).forEach(([catName, cat]) => {
    let section = catName; // 양우 모드는 구분선(divider) 섹션명 사용
    cat.items.forEach(it => {
      if (it.type === 'divider' && it.label) { section = it.label; return; }
      if (!it.pct) return;
      const s = sel[it.id];
      if (!s?.on) return;
      const pctCat = isYanguMode ? section : catName;
      const amt = Math.round(baseSub * it.pct);
      catMap[pctCat] = (catMap[pctCat]||0) + amt;
      pctSub += amt;
      rows.push({ catName: pctCat, label: it.n, detail:`합계 ${fmt(baseSub)}원의 ${(it.pct*100).toFixed(0)}%`, qty:1, u:'식', unitP:amt, amt });
    });
  });
  // 기본 견적서 모드의 감리비(업체이윤)
  if (isTplMode && tplState && tplState.feeRate > 0) {
    const amt = Math.round(baseSub * tplState.feeRate / 100 / 1000) * 1000;
    catMap['기타'] = (catMap['기타']||0) + amt;
    pctSub += amt;
    rows.push({ catName: '기타', label: '감리비 (업체이윤)', detail:`합계 ${fmt(baseSub)}원의 ${tplState.feeRate}%`, qty:1, u:'식', unitP:amt, amt });
  }

  const sub   = baseSub + pctSub;
  const vat   = Math.round(sub * 0.1);
  const total = sub + vat;
  const nego = negoAmt || 0;
  const subAfterNego = Math.max(0, sub - nego);
  const vatAfterNego = Math.round(subAfterNego * 0.1);
  const totalAfterNego = subAfterNego + vatAfterNego;
  return { sub, vat, total, catMap, rows, nego, subAfterNego, vatAfterNego, totalAfterNego };
}

/* ════════ 요약 렌더 ════════ */
function calc() {
  const py = getPyung();
  document.getElementById('sqm').textContent = `(약 ${Math.round(py*3.3)}㎡)`;
  const { sub, vat, total, catMap, rows, nego, subAfterNego, vatAfterNego, totalAfterNego } = calcTotals();
  renderTabs(); // 금액 변경 시 탭 배지 갱신
  const perPyAfter = py > 0 ? Math.round(subAfterNego/py) : 0;
  // 소계카드: 네고 있으면 취소선 + 할인 표시
  const subCardInner = nego > 0
    ? `<span style="text-decoration:line-through;color:var(--tx3);font-size:14px">${fmt(sub)}원</span><span class="nego-sub">− ${fmt(nego)}원 할인</span>`
    : `${fmt(sub)}원`;

  document.getElementById('scards').innerHTML = `
    <div class="scard">
      <div class="slabel">소계 (VAT 제외)</div>
      <div class="sval">${subCardInner}</div>
    </div>
    <div class="scard">
      <div class="slabel">부가세 10%</div>
      <div class="sval">${fmt(vatAfterNego)}원</div>
    </div>
    <div class="scard">
      <div class="slabel">합계 (VAT 포함)</div>
      <div class="sval hi">${fmt(totalAfterNego)}원</div>
    </div>
    <div class="scard">
      <div class="slabel">평당 단가</div>
      <div class="sval">${py>0?fmt(perPyAfter)+'원':'-'}</div>
    </div>`;

  const entries = Object.entries(catMap).filter(([,v])=>v!==0);
  if (!entries.length) {
    document.getElementById('srows').innerHTML = '<p class="empty">항목을 선택하면 견적이 표시됩니다.</p>';
  } else {
    const rowsHtml = entries.map(([k,v]) =>
      `<div class="srow"><span class="lbl">${k}</span><span class="val">${fmt(v)}원</span></div>`
    ).join('');
    const negoHtml = nego > 0
      ? `<div class="srow nego-row"><span class="lbl">🔻 네고 / 할인</span><span class="val nego-val">− ${fmt(nego)}원</span></div>`
      : '';
    const totHtml = `<div class="srow tot"><span class="lbl">최종 합계</span><span class="val" style="color:var(--info-tx)">${fmt(subAfterNego)}원</span></div>`;
    document.getElementById('srows').innerHTML = rowsHtml + negoHtml + totHtml;
  }

  renderQuoteDoc({ sub, vat, total, catMap, rows, nego, subAfterNego, vatAfterNego, totalAfterNego });
}

/* ════════ 견적서 렌더 ════════ */
function renderQuoteDoc(totals) {
  if (!totals) totals = calcTotals();
  const { sub, vat, total, catMap, rows, nego, subAfterNego, vatAfterNego, totalAfterNego } = totals;

  // 계약 라벨 항상 현재 payRatio로 갱신
  const r = payRatio;
  document.querySelectorAll('.qc-label-deposit').forEach(el => el.textContent = `계약금 (${r.deposit}%)`);
  document.querySelectorAll('.qc-label-mid').forEach(el => el.textContent = `중도금 (${r.mid}%)`);
  document.querySelectorAll('.qc-label-final').forEach(el => el.textContent = `잔금 (${r.final}%)`);
  const noteText = `계약금 ${r.deposit}%, 중도금 ${r.mid}%, 잔금 ${r.final}%`;
  ['pay-note-d','pay-note-s'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent=noteText; });

  const clientDate   = document.getElementById('clientDate').value || '';
  const clientName   = document.getElementById('clientName').value || '';
  const clientPhone  = document.getElementById('clientPhone').value || '';
  const clientAddr   = document.getElementById('clientAddr').value || '';
  const clientPeriod = document.getElementById('clientPeriod').value || '';
  const clientNote   = document.getElementById('clientNote').value || '';

  const dateStr = clientDate.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1년 $2월 $3일');
  document.getElementById('qi-date').textContent   = dateStr;
  document.getElementById('qi-client').textContent = `${clientName} / ${clientPhone}`;
  document.getElementById('qi-addr').textContent   = clientAddr;
  document.getElementById('qi-period').textContent = clientPeriod;
  document.getElementById('qi-note').textContent   = clientNote;

  // 그룹핑
  const grouped = {};
  rows.forEach(r => {
    if (!grouped[r.catName]) grouped[r.catName] = [];
    // 도배지명 메모가 있으면 도배 카테고리 첫 항목에 추가
    grouped[r.catName].push(r);
  });

  // ── 상세 견적서 tbody ──
  let detailHtml = '';
  Object.entries(grouped).forEach(([cat, list]) => {
    const catTotal = list.reduce((s,r)=>s+r.amt,0);
    detailHtml += `<tr class="qrow-cat">
      <td>${cat}</td><td colspan="4"></td>
      <td class="q-amount">${fmt(catTotal)}</td></tr>`;
    list.forEach((r, ri) => {
      const up = r.incl ? '' : (r.unitP ? fmt(r.unitP) : '-');
      // 도배 카테고리 첫 항목에 도배지명 표시
      const wallNote = (cat === '도배' && ri === 0 && wallPaperName)
        ? `<br><span class="q-detail" style="color:#2563eb;font-weight:600">📋 도배지: ${wallPaperName}</span>` : '';
      detailHtml += `<tr>
        <td></td>
        <td class="q-name">${r.label}${r.detail?`<br><span class="q-detail">${r.detail}</span>`:''}${wallNote}</td>
        <td class="q-center">${r.u}</td>
        <td class="q-center">${r.qty}</td>
        <td class="q-price">${up}</td>
        <td class="q-amount">${r.incl ? '<span class="q-detail">포함</span>' : fmt(r.amt)}</td></tr>`;
    });
  });
  if (!detailHtml) detailHtml = `<tr><td colspan="6" class="empty">선택된 항목이 없습니다.</td></tr>`;

  // ── 간략 견적서 tbody ──
  let simpleHtml = '';
  Object.entries(grouped).forEach(([cat, list]) => {
    const catTotal = list.reduce((s,r)=>s+r.amt,0);
    simpleHtml += `<tr>
      <td class="q-name" style="font-weight:600">${cat}</td>
      <td colspan="4"></td>
      <td class="q-amount">${fmt(catTotal)}</td></tr>`;
  });
  if (!simpleHtml) simpleHtml = `<tr><td colspan="6" class="empty">선택된 항목이 없습니다.</td></tr>`;

  document.getElementById('qitem-body-detail').innerHTML = detailHtml;
  document.getElementById('qitem-body-simple').innerHTML = simpleHtml;

  ['qf-sub-d','qf-sub-s'].forEach(id => document.getElementById(id).textContent = fmtW(sub) + (nego>0?` (네고 − ${fmt(nego)}원)`:''));
  ['qf-vat-d','qf-vat-s'].forEach(id => document.getElementById(id).textContent = fmtW(vatAfterNego));
  ['qf-total-d','qf-total-s'].forEach(id => document.getElementById(id).textContent = fmtW(totalAfterNego));

  const dep = Math.round(totalAfterNego * r.deposit / 100);
  const mid = Math.round(totalAfterNego * r.mid / 100);
  const fin = Math.round(totalAfterNego * r.final / 100);
  ['qc-deposit-d','qc-deposit-s'].forEach(id => document.getElementById(id).textContent = fmtW(dep));
  ['qc-mid-d','qc-mid-s'].forEach(id => document.getElementById(id).textContent = fmtW(mid));
  ['qc-final-d','qc-final-s'].forEach(id => document.getElementById(id).textContent = fmtW(fin));
  // 비율 입력창 동기화
  const di = document.getElementById('pay-deposit'); if(di) di.value = r.deposit;
  const mi = document.getElementById('pay-mid');     if(mi) mi.value = r.mid;
  const fi = document.getElementById('pay-final');   if(fi) fi.value = r.final;
}

/* ════════ 인쇄 모드 ════════ */
let printMode = 'detail';
function setPrintMode(m) {
  printMode = m;
  document.getElementById('quote-detail').classList.toggle('print-hidden', m !== 'detail');
  document.getElementById('quote-simple').classList.toggle('print-hidden', m !== 'simple');
}

/* ════════ 엑셀 다운로드 ════════ */
async function downloadExcel() {
  const { sub, rows, nego, subAfterNego, vatAfterNego, totalAfterNego } = calcTotals();
  const clientDate   = document.getElementById('clientDate').value || today();
  const clientName   = document.getElementById('clientName').value || '고객';
  const clientPhone  = document.getElementById('clientPhone').value || '';
  const clientAddr   = document.getElementById('clientAddr').value || '';
  const clientPeriod = document.getElementById('clientPeriod').value || '';
  const clientNote   = document.getElementById('clientNote').value || '';
  const er = payRatio;

  const grouped = {};
  rows.forEach(r => { if (!grouped[r.catName]) grouped[r.catName]=[]; grouped[r.catName].push(r); });

  const wb = new ExcelJS.Workbook();
  wb.creator = '라인 인테리어';
  wb.created = new Date();

  // ── 헬퍼 ──
  const BLK  = { type:'pattern', pattern:'solid', fgColor:{argb:'FF1C1917'} };
  const BLUE = { type:'pattern', pattern:'solid', fgColor:{argb:'FF2563EB'} };
  const GRY  = { type:'pattern', pattern:'solid', fgColor:{argb:'FFF4F4F5'} };
  const CAT  = { type:'pattern', pattern:'solid', fgColor:{argb:'FFE8E5E2'} };
  const WH   = { type:'pattern', pattern:'solid', fgColor:{argb:'FFFFFFFF'} };
  const thin = { style:'thin', color:{argb:'FFCCCCCC'} };
  const med  = { style:'medium', color:{argb:'FF888888'} };
  const thk  = { style:'thick', color:{argb:'FF1C1917'} };
  const bord = (t,r,b,l) => ({ top:t, right:r, bottom:b, left:l });
  const numFmt = '#,##0';
  const fontWh = { name:'맑은 고딕', size:10, bold:true, color:{argb:'FFFFFFFF'} };
  const fontBk = { name:'맑은 고딕', size:10, bold:true, color:{argb:'FF1C1917'} };
  const fontNm = { name:'맑은 고딕', size:9,  color:{argb:'FF333333'} };
  const fontSm = { name:'맑은 고딕', size:8,  color:{argb:'FF666666'} };
  const fontBl = { name:'맑은 고딕', size:10, bold:true, color:{argb:'FF2563EB'} };
  const alignRC = { horizontal:'right', vertical:'middle' };
  const alignCC = { horizontal:'center', vertical:'middle' };
  const alignLC = { horizontal:'left', vertical:'middle' };

  function buildSheet(wb, sheetName, isDetail) {
    const ws = wb.addWorksheet(sheetName, { views:[{showGridLines:false}] });
    ws.columns = [
      {width:14}, {width:isDetail?40:30}, {width:8}, {width:8}, {width:14}, {width:16}
    ];

    let r = 1;
    const C = (ri, ci) => ws.getCell(ri, ci);
    const merge = (r1,c1,r2,c2) => ws.mergeCells(r1,c1,r2,c2);
    const setR = (ri, height=18) => { ws.getRow(ri).height = height; };

    // ── 1행: 로고 + 제목 ──
    setR(r, 30);
    merge(r,1,r,3); C(r,1).value='라인 인테리어';
    C(r,1).font = { name:'맑은 고딕', size:16, bold:true, color:{argb:'FF2563EB'} };
    C(r,1).alignment = alignLC;
    merge(r,4,r,6); C(r,4).value = isDetail ? '견  적  서' : '견  적  서  (요약)';
    C(r,4).font = { name:'맑은 고딕', size:16, bold:true, color:{argb:'FF1C1917'}, italic:true };
    C(r,4).alignment = alignRC;
    r++;

    // ── 구분선 ──
    setR(r, 4);
    for(let c=1;c<=6;c++){C(r,c).fill=BLK; C(r,c).border=bord(thk,thk,thk,thk);}
    merge(r,1,r,6);
    r++;

    // ── 고객 정보 테이블 ──
    const infoRows = [
      ['의뢰일', clientDate, '상호', '라인 인테리어'],
      ['고객명 / 연락처', `${clientName} / ${clientPhone}`, '등록번호', '296-24-02323'],
      ['주소 / 평형', clientAddr, '담당자', '라인 인테리어'],
      ['시공 예상기간', clientPeriod, '연락처', '010-6420-3155'],
    ];
    if (isDetail) infoRows.push(['특이사항', clientNote, '', '']);

    infoRows.forEach(([la, va, lb, vb]) => {
      setR(r, 17);
      merge(r,1,r,1); C(r,1).value = la;
      C(r,1).font = {...fontBk, size:9}; C(r,1).fill = GRY; C(r,1).alignment = alignLC;
      merge(r,2,r,3); C(r,2).value = va;
      C(r,2).font = fontNm; C(r,2).fill = WH; C(r,2).alignment = alignLC;
      C(r,4).value = lb; C(r,4).font = {...fontBk,size:9}; C(r,4).fill = GRY; C(r,4).alignment = alignLC;
      merge(r,5,r,6); C(r,5).value = vb;
      C(r,5).font = fontNm; C(r,5).fill = WH; C(r,5).alignment = alignLC;
      for(let c=1;c<=6;c++) C(r,c).border = bord(thin,thin,thin,thin);
      r++;
    });
    r++;

    // ── 헤더 행 ──
    setR(r, 20);
    const hdrs = isDetail
      ? ['품명','내용','단위','수량','단가','견적가']
      : ['항목','','','','','금액'];
    hdrs.forEach((h,i) => {
      C(r, i+1).value = h;
      C(r, i+1).font  = fontWh;
      C(r, i+1).fill  = BLK;
      C(r, i+1).alignment = i>=2 ? alignCC : alignLC;
      C(r, i+1).border = bord(med,med,med,med);
    });
    if (!isDetail) merge(r,1,r,5);
    r++;

    // ── 데이터 행 ──
    Object.entries(grouped).forEach(([cat, list]) => {
      const catTotal = list.reduce((s,x)=>s+x.amt,0);
      // 카테고리 헤더
      setR(r, 18);
      merge(r,1,r,5); C(r,1).value = cat;
      C(r,1).font = fontBk; C(r,1).fill = CAT; C(r,1).alignment = alignLC;
      C(r,6).value = catTotal; C(r,6).numFmt = numFmt;
      C(r,6).font = fontBk; C(r,6).fill = CAT; C(r,6).alignment = alignRC;
      for(let c=1;c<=6;c++) C(r,c).border = bord(thin,thin,thin,thin);
      r++;

      if (isDetail) {
        list.forEach(item => {
          setR(r, 16);
          C(r,1).value = '';
          C(r,2).value = item.label + (item.detail ? `
(${item.detail})` : '');
          C(r,2).font  = { name:'맑은 고딕', size:9, color:{argb:'FF27272A'} };
          C(r,2).alignment = { ...alignLC, wrapText:true };
          C(r,3).value = item.u; C(r,3).alignment = alignCC; C(r,3).font = fontNm;
          C(r,4).value = item.qty; C(r,4).alignment = alignCC; C(r,4).font = fontNm;
          C(r,5).value = item.incl ? '' : (item.unitP||0); C(r,5).numFmt = numFmt; C(r,5).alignment = alignRC;
          C(r,5).font = { name:'맑은 고딕', size:9, color:{argb:'FF78716C'} };
          C(r,6).value = item.incl ? '포함' : item.amt; C(r,6).numFmt = numFmt; C(r,6).alignment = alignRC;
          C(r,6).font = item.amt < 0
            ? { name:'맑은 고딕', size:9, bold:true, color:{argb:'FFDC2626'} }
            : { name:'맑은 고딕', size:9, bold:true, color:{argb:'FF1C1917'} };
          for(let c=1;c<=6;c++) C(r,c).border = bord(thin,thin,thin,thin);
          r++;
        });
      }
    });

    // ── 소계/부가세/합계 ──
    setR(r, 5); r++;

    const totRows = [
      ['소 계 (부가세 제외)', subAfterNego + nego, false],
    ];
    if (nego > 0) totRows.push([`네고 / 할인`, -nego, true]);
    totRows.push(['부가세 (10%)', vatAfterNego, false]);

    totRows.forEach(([lbl, val, isRed]) => {
      setR(r, 16);
      merge(r,1,r,5); C(r,1).value = lbl;
      C(r,1).font = {...fontBk, size:9}; C(r,1).fill = GRY;
      C(r,1).alignment = alignRC;
      C(r,6).value = val; C(r,6).numFmt = numFmt;
      C(r,6).font = { name:'맑은 고딕', size:10, bold:true,
        color:{argb: isRed ? 'FFDC2626':'FF1C1917'} };
      C(r,6).alignment = alignRC;
      for(let c=1;c<=6;c++) C(r,c).border = bord(thin,thin,thin,thin);
      r++;
    });

    // 총 공사 금액 (강조)
    setR(r, 24);
    merge(r,1,r,5); C(r,1).value = '총  공사  금액';
    C(r,1).font = { name:'맑은 고딕', size:11, bold:true, color:{argb:'FFFFFFFF'} };
    C(r,1).fill = BLK; C(r,1).alignment = alignRC;
    C(r,6).value = totalAfterNego; C(r,6).numFmt = numFmt;
    C(r,6).font = { name:'맑은 고딕', size:13, bold:true, color:{argb:'FFFFFFFF'} };
    C(r,6).fill = BLUE; C(r,6).alignment = alignRC;
    for(let c=1;c<=6;c++) C(r,c).border = bord(thk,thk,thk,thk);
    r++;

    // ── 계약금/중도금/잔금 ──
    setR(r, 5); r++;
    setR(r, 20);
    const dep = Math.round(totalAfterNego*er.deposit/100);
    const mid = Math.round(totalAfterNego*er.mid/100);
    const fin = Math.round(totalAfterNego*er.final/100);
    const pCells = [
      [`계약금 (${er.deposit}%)`, dep],
      [`중도금 (${er.mid}%)`,     mid],
      [`잔금 (${er.final}%)`,     fin],
    ];
    const cw = [1,3,5];
    const vw = [2,4,6];
    pCells.forEach(([lbl,val],i) => {
      C(r,cw[i]).value = lbl; C(r,cw[i]).font = {...fontBk,size:9};
      C(r,cw[i]).fill = GRY; C(r,cw[i]).alignment = alignCC;
      C(r,vw[i]).value = val; C(r,vw[i]).numFmt = numFmt;
      C(r,vw[i]).font = fontBl; C(r,vw[i]).alignment = alignRC;
      C(r,cw[i]).border = bord(med,thin,med,med);
      C(r,vw[i]).border = bord(med,med,med,thin);
    });
    r++;

    // ── 비고 ──
    setR(r, 5); r++;
    [`부가세 별도 견적입니다. (계약금 ${er.deposit}%, 중도금 ${er.mid}%, 잔금 ${er.final}% 기준)`,
     '본 업체는 전문 기공 인력만 시공합니다. (연습생, 외국인 인력 제한)'].forEach(txt => {
      setR(r, 14);
      merge(r,1,r,6); C(r,1).value = txt;
      C(r,1).font = { name:'맑은 고딕', size:8, italic:true, color:{argb:'FF666666'} };
      C(r,1).alignment = alignLC;
      r++;
    });

    // ── 서명란 ──
    setR(r, 5); r++;
    setR(r, 22);
    merge(r,1,r,3); C(r,1).value = '상기와 같이 계약합니다.';
    C(r,1).font = {...fontBk, size:10};  C(r,1).alignment = alignLC;
    merge(r,4,r,6); C(r,4).value = '계약자 서명 : _______________________';
    C(r,4).font = fontBk; C(r,4).alignment = alignRC;
  }

  buildSheet(wb, '상세견적서', true);
  buildSheet(wb, '요약견적서', false);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const fname = `라인인테리어_견적서_${clientName}_${clientDate}.xlsx`;
  a.download = fname;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ════════ 계약 비율 설정 ════════ */
function updatePayRatio() {
  const d = parseInt(document.getElementById('pay-deposit')?.value) || 0;
  const m = parseInt(document.getElementById('pay-mid')?.value) || 0;
  const f = parseInt(document.getElementById('pay-final')?.value) || 0;
  const sum = d + m + f;
  const errEl = document.getElementById('pay-ratio-err');
  if (sum !== 100) {
    if (errEl) errEl.textContent = `합계 ${sum}% — 100%가 되어야 합니다`;
    return;
  }
  if (errEl) errEl.textContent = '';
  payRatio = { deposit: d, mid: m, final: f };
  // 비고 문구 동적 갱신
  const noteText = `계약금 ${d}%, 중도금 ${m}%, 잔금 ${f}%`;
  ['pay-note-d','pay-note-s'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = noteText;
  });
  renderQuoteDoc();
}

/* ════════ 저장 / 불러오기 / 공유 ════════ */

function getSnapshot() {
  return {
    v: 1,
    ts: Date.now(),
    pyung: getPyung(),
    clientName:   document.getElementById('clientName').value,
    clientPhone:  document.getElementById('clientPhone').value,
    clientAddr:   document.getElementById('clientAddr').value,
    clientPeriod: document.getElementById('clientPeriod').value,
    clientNote:   document.getElementById('clientNote').value,
    clientDate:   document.getElementById('clientDate').value,
    sel: JSON.parse(JSON.stringify(sel)),
    bathRooms: JSON.parse(JSON.stringify(bathRooms)),
    bathDemoState: JSON.parse(JSON.stringify(bathDemoState)),
    catExtraState: JSON.parse(JSON.stringify(catExtraState)),
    wallPaperName,
    elecPkg: JSON.parse(JSON.stringify(elecPkg)),
    negoAmt,
    payRatio: JSON.parse(JSON.stringify(payRatio)),
    floorDemoSel: JSON.parse(JSON.stringify(floorDemoSel)),
    mode: isTplMode ? 'tpl' : isYanguMode ? 'yangu' : 'normal',
    tpl: isTplMode && tplState ? JSON.parse(JSON.stringify(tplState)) : null,
    specials: JSON.parse(JSON.stringify(specials)),
  };
}

function applySnapshot(snap) {
  if (!snap || snap.v !== 1) { alert('올바른 견적 파일이 아닙니다.'); return; }
  document.getElementById('pyung').value = snap.pyung || 32;
  document.getElementById('clientName').value   = snap.clientName || '';
  document.getElementById('clientPhone').value  = snap.clientPhone || '';
  document.getElementById('clientAddr').value   = snap.clientAddr || '';
  document.getElementById('clientPeriod').value = snap.clientPeriod || '';
  document.getElementById('clientNote').value   = snap.clientNote || '';
  document.getElementById('clientDate').value   = snap.clientDate || '';
  // 상태 복원
  Object.assign(sel, snap.sel || {});
  bathRooms     = snap.bathRooms || [];
  bathDemoState = snap.bathDemoState || { living:false, master:false };
  Object.assign(catExtraState, snap.catExtraState || {});
  wallPaperName = snap.wallPaperName || '';
  elecPkg       = snap.elecPkg || { type: null };
  negoAmt       = snap.negoAmt || 0;
  if (snap.payRatio) payRatio = snap.payRatio;
  Object.assign(floorDemoSel, snap.floorDemoSel || {});
  renderTabs();
  if (typeof tplApplySnapshot === 'function') tplApplySnapshot(snap); // 모드·기본 견적서·특이사항 복원
  else renderItems();
  calc(); syncSimpleInfo?.();
}

/* ── 로컬 저장 ── */
function saveQuote() {
  const name = document.getElementById('clientName').value || '견적';
  const key  = 'quote_' + Date.now();
  const snap = getSnapshot();
  snap.label = name + ' (' + new Date().toLocaleDateString('ko-KR') + ')';
  try {
    localStorage.setItem(key, JSON.stringify(snap));
    loadSavedList();
    showToast('💾 저장 완료: ' + snap.label);
  } catch(e) {
    alert('저장 실패: ' + e.message);
  }
}

function loadSavedList() {
  const list = document.getElementById('saved-list');
  if (!list) return;
  const keys = Object.keys(localStorage).filter(k => k.startsWith('quote_')).sort().reverse();
  if (!keys.length) {
    list.innerHTML = '<p class="saved-empty">저장된 견적이 없습니다.</p>';
    return;
  }
  list.innerHTML = keys.map(k => {
    const snap = JSON.parse(localStorage.getItem(k) || '{}');
    const { sub, total } = calcTotalsFromSnap(snap);
    return `<div class="saved-item">
      <div class="saved-item-info">
        <div class="saved-item-label">${snap.mode === 'tpl' ? `<span class="saved-tag">📋 ${esc(snap.tpl?.name || '기본 견적서')}</span>` : snap.mode === 'yangu' ? '<span class="saved-tag">🏢 양우</span>' : ''}${snap.label || '견적'}</div>
        <div class="saved-item-amt">${fmt(sub)}원 (VAT포함 ${fmt(total)}원)</div>
      </div>
      <div class="saved-item-btns">
        <button class="saved-btn load" onclick="loadQuote('${k}')">불러오기</button>
        <button class="saved-btn share" onclick="shareQuoteKey('${k}')">공유</button>
        <button class="saved-btn del" onclick="deleteQuote('${k}')">삭제</button>
      </div>
    </div>`;
  }).join('');
}

function calcTotalsFromSnap(snap) {
  // 임시로 상태 바꿔서 계산 후 복원
  const origSel = JSON.parse(JSON.stringify(sel));
  const origBath = JSON.parse(JSON.stringify(bathRooms));
  const origElec = JSON.parse(JSON.stringify(elecPkg));
  const origNego = negoAmt;
  const orig = { isTplMode, isYanguMode, tplState, specials };
  Object.assign(sel, snap.sel || {});
  bathRooms = snap.bathRooms || [];
  elecPkg   = snap.elecPkg || { type: null };
  negoAmt   = snap.negoAmt || 0;
  isTplMode   = snap.mode === 'tpl' && !!snap.tpl;
  isYanguMode = snap.mode === 'yangu';
  tplState    = snap.tpl || null;
  specials    = snap.specials || [];
  let result;
  try { result = calcTotals(); }
  finally {
    Object.assign(sel, origSel);
    bathRooms = origBath;
    elecPkg   = origElec;
    negoAmt   = origNego;
    ({ isTplMode, isYanguMode, tplState, specials } = orig);
  }
  return result;
}

function loadQuote(key) {
  const snap = JSON.parse(localStorage.getItem(key) || 'null');
  if (!snap) { alert('불러오기 실패'); return; }
  applySnapshot(snap);
  document.getElementById('load-modal').classList.add('hidden');
  showToast('📂 불러오기 완료: ' + snap.label);
}

function deleteQuote(key) {
  if (!confirm('이 견적을 삭제할까요?')) return;
  localStorage.removeItem(key);
  loadSavedList();
}

/* ── URL 공유 ── */
// 공유 링크용: 켜진 항목만 남기고 기본 견적서는 바뀐 값만 담아 링크 길이를 줄임
function compactSnap(snap) {
  const c = JSON.parse(JSON.stringify(snap));
  const keep = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v && (v.on || v.val || v.text || v.amt || v.nego)));
  c.sel = keep(c.sel);
  c.floorDemoSel = keep(c.floorDemoSel);
  c.catExtraState = keep(c.catExtraState);
  if (c.tpl && typeof tplPack === 'function') c.tpl = tplPack(c.tpl);
  return c;
}
function shareUrl(snap) {
  const encoded = btoa(encodeURIComponent(JSON.stringify(compactSnap(snap))));
  return location.href.split('?')[0] + '?q=' + encodeURIComponent(encoded);
}

function shareQuote() {
  const snap = getSnapshot();
  const url = shareUrl(snap);
  if (url.length > 20000) {
    // 너무 길면 클립보드에 JSON 복사
    navigator.clipboard?.writeText(JSON.stringify(snap)).then(() => {
      showToast('📋 견적 데이터 클립보드 복사 완료! (붙여넣기로 공유)');
    });
    return;
  }
  navigator.clipboard?.writeText(url).then(() => {
    showToast('🔗 공유 링크 복사 완료!');
  }).catch(() => {
    prompt('아래 링크를 복사하세요:', url);
  });
}

function shareQuoteKey(key) {
  const snap = JSON.parse(localStorage.getItem(key) || 'null');
  if (!snap) return;
  const url = shareUrl(snap);
  navigator.clipboard?.writeText(url).then(() => {
    showToast('🔗 공유 링크 복사 완료!');
  }).catch(() => {
    prompt('아래 링크를 복사하세요:', url);
  });
}

/* ── URL에서 견적 불러오기 ── */
function loadFromURL() {
  const params = new URLSearchParams(location.search);
  const q = params.get('q');
  if (!q) return;
  try {
    // 예전 링크는 base64의 '+'가 공백으로 바뀌어 들어오므로 되돌림
    const snap = JSON.parse(decodeURIComponent(atob(q.replace(/ /g, '+'))));
    if (snap.tpl && typeof tplUnpack === 'function') snap.tpl = tplUnpack(snap.tpl);
    applySnapshot(snap);
    showToast('🔗 공유된 견적을 불러왔습니다!');
  } catch(e) {
    console.warn('URL 견적 불러오기 실패:', e);
  }
}

/* ── 토스트 알림 ── */
function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ════════ 초기화 ════════ */
function resetAll() {
  Object.keys(sel).forEach(id => { sel[id] = { on:false, q:1, val:0, selectIdx:0 }; });
  Object.keys(floorDemoSel).forEach(id => { floorDemoSel[id] = { on:false, q:1 }; });
  bathRooms = [];
  negoAmt = 0;
  bathWaterList = [];
  bathDemoState = { living: false, master: false };
  wallPaperName = '';
  elecPkg = { type: null };
  Object.keys(catExtraState).forEach(id => { catExtraState[id] = { text:'', amt:0, nego:0 }; });
  document.getElementById('nego-input') && (document.getElementById('nego-input').value = '');
  if (typeof tplOnReset === 'function') tplOnReset(); // 특이사항 비우기 + 기본 견적서 원래대로
  else renderItems();
  calc();
}
