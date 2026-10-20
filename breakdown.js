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

// 지난 견적서 「원가 · 상세내역」 열에 적힌 단가 (업체 단가표에 없는 인건비·자재비) — g: 공정 묶음
const BD_COMMON = [
  { g: '욕실', k: '자재', n: '욕실 타일 자재비 (1칸)', u: '칸', p: 1300000, src: '양우 605호 「자재비 130」 · 304호 85 · 주공 160~180' },
  { g: '욕실', k: '인건비', n: '타일공', u: '품', p: 350000, src: '「타일 1품」 35만 · 「타일 2품 70」' },
  { g: '욕실', k: '인건비', n: '도기 세팅 (기본)', u: '칸', p: 250000, src: '「도기세팅(기본25+휴젠뜨3+천장기본)」 · 중흥 34' },
  { g: '욕실', k: '자재', n: '휴젠뜨 환풍기', u: '개', p: 30000, src: '「기본25+휴젠뜨3」' },
  { g: '욕실', k: '인건비', n: '메지', u: '칸', p: 220000, src: '「메지 - 22만」' },
  { g: '욕실', k: '기타', n: '방수 (1칸)', u: '칸', p: 200000, src: '「2칸 방수 40만」' },
  { g: '욕실', k: '자재', n: '젠다이 (벽돌+미장)', u: '식', p: 350000, src: '양우 304호 「35만 (벽돌+미장 등)」' },
  { g: '욕실', k: '자재', n: '도기 (변기·세면대)', u: '세트', p: 280000, src: '「변기, 세면대 나무 2개씩 : 56만」' },
  { g: '타일', k: '인건비', n: '타일공', u: '품', p: 350000, src: '「인건비 1품 : 36만」 · 「타일 2품 70」' },
  { g: '타일', k: '자재', n: '현관 바닥 타일', u: '박스', p: 25000, src: '「25000*3박스 + 부자재」' },
  { g: '타일', k: '자재', n: '주방 벽 타일', u: '박스', p: 15000, src: '「15000*4박스 + 부자재」' },
  { g: '타일', k: '자재', n: '발코니·세탁실 타일', u: '박스', p: 13000, src: '「13000*6(세탁+건조)」' },
  { g: '타일', k: '자재', n: '1200×600 포세린 타일', u: '박스', p: 35000, src: '「1200*600 24박스(84만)」' },
  { g: '철거', k: '인건비', n: '철거 인건비', u: '품', p: 250000, src: '「인건비 25만*4품」 · 「철거 2명(50)」' },
  { g: '철거', k: '기타', n: '폐기물 (1회)', u: '회', p: 200000, src: '「28일 : 25만 / 14일 : 23만」 · 16~19만' },
  { g: '철거', k: '인건비', n: '데모도 (보조)', u: '품', p: 200000, src: '「데모도 3품」 — 단가는 현장마다' },
  { g: '목공', k: '인건비', n: '목수', u: '품', p: null, src: '품 단가 기본 35만 (마지막에 쓴 값)' },
  { g: '목공', k: '자재', n: '목재 자재 (각재·합판)', u: '식', p: 200000, src: '「목수1품+자재비20만」' },
  { g: '필름', k: '인건비', n: '필름공', u: '품', p: 250000, src: '「필름 25만*8품 + 40만」' },
  { g: '필름', k: '자재', n: '필름 자재', u: '식', p: 400000, src: '「+ 40만」 (평당 10~12만)' },
  { g: '도배', k: '인건비', n: '도배공', u: '품', p: 250000, src: '「25만*4품」' },
  { g: '도배', k: '자재', n: '실크벽지 (신한)', u: '평', p: 7000, src: '「신한 80평 7000 [56만]」' },
  { g: '기타', k: '기타', n: '공사신고·관리비', u: '식', p: 150000, src: '「관15원+알바10만+보양재」' },
  { g: '기타', k: '인건비', n: '알바 (보양·정리)', u: '회', p: 100000, src: '「알바10만」' },
];

// 공정·항목 → 관련 자재 (업체 단가표 공정 + 위 BD_COMMON 묶음 + 가구 단가)
function bdRelated(proc, n) {
  const t = `${proc} ${n}`;
  if (/욕실|화장실/.test(proc) || /욕실|욕조|양변기|세면|도기|젠다이/.test(n)) return { cats: ['욕실', '부자재'], g: ['욕실'], label: '욕실' };
  if (proc === '타일' || /타일/.test(n)) return { cats: ['부자재'], g: ['타일'], label: '타일' };
  if (/철거|폐기물|샌딩|단차/.test(t)) return { cats: ['철거'], g: ['철거'], label: '철거' };
  if (proc === '가구' || /싱크|붙박이|신발장|가구|수납/.test(n)) return { cats: [], g: [], furn: true, label: '가구' };
  if (/도배|벽지/.test(n)) return { cats: ['도배', '부자재'], g: ['도배'], label: '도배' };
  if (/바닥|마루|장판|데코/.test(n)) return { cats: ['바닥재', '철거'], g: [], label: '바닥재' };
  if (proc === '도배·바닥재') return { cats: ['도배', '바닥재', '부자재'], g: ['도배'], label: '도배·바닥재' };
  if (/중문/.test(t)) return { cats: ['중문', '문·몰딩'], g: ['목공'], label: '중문' };
  if (/도장|탄성|페인트/.test(t)) return { cats: ['도장'], g: [], label: '도장' };
  if (/필름/.test(t)) return { cats: [], g: ['필름'], label: '필름' };
  if (/전기|조명|전등|콘센트|스위치|감지기/.test(t)) return { cats: [], g: ['전기'], label: '전기·조명' };
  if (/문|몰딩|걸레/.test(n)) return { cats: ['문·몰딩', '부자재'], g: ['목공'], label: '문·몰딩' };
  if (proc === '목공' || /천장|목공|가벽|단열/.test(n)) return { cats: ['목공 자재', '문·몰딩', '부자재'], g: ['목공'], label: '목공' };
  if (proc === '기타') return { cats: ['부자재'], g: ['기타'], label: '기타' };
  return { cats: [], g: [], label: proc };
}

// 고를 수 있는 자재 전체 목록 (업체 단가표 + 지난 견적 단가 + 가구 단가)
function bdCatalog() {
  const out = [];
  (typeof VENDOR_PRICES !== 'undefined' ? VENDOR_PRICES : []).forEach((x, i) => out.push({
    id: 'v' + i, src: 'v', cat: x.cat, k: x.cat === '부자재' ? '부자재' : '자재', n: x.n, spec: x.spec || '', u: x.u,
    p: vNet(x), from: `${x.vendor.replace(/ \(.*\)$/, '')}${x.date ? ' ' + x.date : ''}`, label: bdVendorLabel(x) }));
  BD_COMMON.forEach((x, i) => out.push({ id: 'c' + i, src: 'c', cat: x.g, k: x.k, n: x.n, spec: '', u: x.u,
    p: x.p == null ? bdLaborRate() : x.p, from: '지난 견적 ' + x.src, label: x.n }));
  (typeof FURN_ROWS !== 'undefined' ? FURN_ROWS : []).forEach(r => r.kinds.forEach(([kn, p], j) => out.push({
    id: `f${r.key}${j}`, src: 'f', cat: '가구', k: '자재', n: kn ? `${r.n} (${kn})` : r.n, spec: '', u: r.u, p,
    from: '코렉스 퍼니처 단가' + (r.min ? ` · 최소 ${fmt(r.min)}` : ''), label: kn ? `${r.n} (${kn})` : r.n })));
  return out;
}
let bdShowAll = false;
let bdPickQuery = '';
function bdPickRows() {
  const item = bdTargetItem();
  const proc = bdTarget.kind === 'o' ? '선택 옵션' : tplState.blocks[bdTarget.bi].proc;
  const rel = bdRelated(proc, item.n);
  const q = bdPickQuery.trim().toLowerCase();
  const all = bdCatalog();
  const related = all.filter(x => x.src === 'v' ? rel.cats.includes(x.cat) : x.src === 'c' ? rel.g.includes(x.cat) : !!rel.furn);
  // 지난 견적 단가 → 이 공정 업체 단가 (rel.cats 순서) → 부자재 순으로
  const rank = x => x.src === 'c' ? -1 : x.src === 'f' ? 0 : rel.cats.indexOf(x.cat);
  related.sort((a, b) => rank(a) - rank(b));
  const base = bdShowAll || !related.length ? all : related;
  return { rel, related, rows: base.filter(x => !q || [x.n, x.spec, x.from, x.cat].join(' ').toLowerCase().includes(q)) };
}
function bdPickHtml() {
  const { rel, related, rows } = bdPickRows();
  const showingAll = bdShowAll || !related.length;
  let html = '', grp = null;
  rows.slice(0, 400).forEach(x => {
    const g = x.src === 'c' ? '지난 견적서 단가 (원가 · 상세내역 열)' : x.src === 'f' ? '가구 (코렉스 퍼니처)' : `${x.cat} · ${x.from}`;
    if (g !== grp) { grp = g; html += `<div class="bd-pk-g">${esc(g)}</div>`; }
    html += `<div class="bd-pk-row"><span class="bd-pk-k k-${esc(x.k)}">${esc(x.k)}</span>
      <span class="bd-pk-n"><b>${esc(x.n)}</b>${x.spec ? ` <small>${esc(x.spec)}</small>` : ''}${x.src === 'c' ? `<small class="bd-pk-src">${esc(x.from)}</small>` : ''}</span>
      <span class="bd-pk-p">${fmt(x.p)}<small>/${esc(x.u)}</small></span>
      <button class="bd-pk-add" onclick="bdPickAdd('${x.id}')" aria-label="${esc(x.n)} 넣기">＋</button></div>`;
  });
  return `<div class="bd-pk">
    <div class="bd-pk-top">
      <b>📦 ${showingAll ? '전체 자재' : `「${esc(rel.label)}」 관련 자재`}</b> <small>${rows.length}개</small>
      <input id="bd-pk-q" type="search" placeholder="🔍 검색" value="${esc(bdPickQuery)}" oninput="bdPickSearch(this.value)" aria-label="자재 검색">
      ${related.length ? `<button class="bd-pk-all" onclick="bdToggleAll()">${bdShowAll ? '관련 자재만 보기' : '전체 자재 보기'}</button>` : ''}
    </div>
    ${!related.length ? `<p class="bd-pk-empty">「${esc(rel.label)}」에 맞는 업체 단가가 아직 없어서 전체 목록을 보여드려요. 없는 건 아래 + 자재로 직접 넣으세요.</p>` : ''}
    <div class="bd-pk-list" id="bd-pk-list">${html || '<p class="bd-pk-empty">찾는 자재가 없습니다. 「전체 자재 보기」를 누르거나 직접 입력하세요.</p>'}</div>
  </div>`;
}
function bdRenderPick() { const el = document.getElementById('bd-pick'); if (el) el.innerHTML = bdPickHtml(); }
function bdToggleAll() { bdShowAll = !bdShowAll; bdRenderPick(); }
function bdPickSearch(v) {
  bdPickQuery = v;
  const el = document.getElementById('bd-pk-list');
  if (!el) return;
  const tmp = document.createElement('div'); tmp.innerHTML = bdPickHtml();
  el.innerHTML = tmp.querySelector('#bd-pk-list').innerHTML;
  const cnt = document.querySelector('.bd-pk-top small'); if (cnt) cnt.textContent = tmp.querySelector('.bd-pk-top small').textContent;
}
function bdPickAdd(id) {
  const x = bdCatalog().find(c => c.id === id);
  if (!x) return;
  // 비어 있는 같은 구분 줄이 있으면 거기에, 없으면 새 줄
  const empty = bdState.rows.find(r => r.k === x.k && !r.n && !Number(r.p));
  const row = { k: x.k, n: x.label, u: x.u, p: x.p, q: 1, per: false, memo: x.src === 'c' ? x.from : '' };
  if (empty) Object.assign(empty, row); else bdState.rows.push(row);
  renderBreakdown();
  showToast(`＋ ${x.n} 넣었습니다 — 수량을 맞춰주세요`);
}
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
  // 공정에 맞는 인건비 줄 (욕실·타일 → 타일공, 철거 → 철거 인건비, 도배 → 도배공 …, 그 외 목수)
  const proc = bdTarget?.kind === 'b' ? tplState.blocks[bdTarget.bi].proc : '';
  const rel = bdRelated(proc, item.n);
  const lab = BD_COMMON.find(x => rel.g.includes(x.g) && x.k === '인건비');
  const labRow = lab && lab.p != null
    ? { k: '인건비', n: lab.n, u: lab.u, p: lab.p, q: 1, per: false, memo: '지난 견적 ' + lab.src }
    : { k: '인건비', n: '목수', u: '품', p: labor, q: 1, per: false, memo: '' };
  return { count: 0, mult: BD_MULT_DEFAULT, preset: '', desc: item.d || '',
    rows: [{ k: '자재', n: '', u: '', p: 0, q: 1, per: false, memo: '' }, labRow] };
}

function openBreakdown(kind, bi, ii) {
  bdTarget = { kind, bi, ii };
  const item = bdTargetItem();
  bdState = item.bd ? JSON.parse(JSON.stringify(item.bd)) : bdNewState(item);
  bdShowAll = false; bdPickQuery = '';
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
  const list = bdPickRows().rows; // 자동완성도 지금 보이는 목록(관련 자재 / 전체)과 같게
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
        <td class="xs-in"><input type="text" list="bd-vendor-list" value="${esc(r.n)}" placeholder="${r.k === '자재' ? '업체 단가표에서 고르거나 직접 입력' : r.k === '인건비' ? '목수 / 타일공 / 보조 등' : '내용'}" onchange="bdName(${i},this.value)" aria-label="내용">
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
    <div id="bd-pick">${bdPickHtml()}</div>
    <datalist id="bd-vendor-list">${list.map(x => `<option value="${esc(x.label)}">${fmt(x.p)}/${esc(x.u)}</option>`).join('')}</datalist>
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
  const x = bdCatalog().find(c => c.label === v);
  if (x) { r.p = x.p; r.u = x.u; if (x.src === 'c') r.memo = x.from; renderBreakdown(); return; }
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

// 시트 「상세내역」 칸에 들어갈 짧은 메모 (예: 예림 민자 문짝 7짝 + 경첩·손잡이 7개 + 목수 1품)
function bdMemoText() {
  return bdState.rows.filter(r => bdRowCost(r)).map(r => `${(r.n || r.k).split(' · ')[0]} ${r.q}${r.u || ''}`).join(' + ').slice(0, 120);
}
function applyBreakdown() {
  const { cost, price } = bdTotals();
  if (!cost) { alert('단가와 수량을 넣어주세요.'); return; }
  const item = bdTargetItem();
  if (!item.bd) item.bdOrig = { p: item.p, d: item.d, note: item.note || '', f: item.f || '', c: item.c ?? null, m: item.m || '' };
  item.c = cost;
  item.m = bdMemoText();
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
