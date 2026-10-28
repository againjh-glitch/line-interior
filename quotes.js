/**
 * quotes.js — 💾 저장 · 📝 새로 작성 · 📂 저장된 견적서 보기
 *
 *  시트 위쪽 막대에 세 버튼과 「지금 견적」 상태를 보여줍니다.
 *  - 💾 저장       : 지금 열린 견적이 있으면 그 견적에 덮어쓰고, 없으면 새로 저장 (app.js saveQuote)
 *  - 📝 새로 작성  : 고객 정보·금액·특이사항을 비우고 지금 아파트 기본 견적서로 다시 시작
 *  - 📂 저장된 견적서 : 저장한 견적 목록 — 검색, 공정별 금액 미리보기, 열기, 복사해서 새로, 삭제
 *
 *  저장은 이 브라우저(localStorage)에 됩니다. 다른 컴퓨터로 옮길 때는 목록 위 「백업 내보내기/가져오기」.
 */

const qlKeys = () => Object.keys(localStorage).filter(k => k.startsWith('quote_')).sort().reverse();
const qlSnap = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const qlDate = t => t ? new Date(t).toLocaleString('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
let qlQuery = '';
let qlOpen = null; // 미리보기 펼친 견적

function qlBarHtml() {
  const s = currentQuoteKey && qlSnap(currentQuoteKey);
  const n = qlKeys().length;
  const status = s
    ? `<span class="xs-qstat on">📄 지금 견적: <b>${esc(s.clientName || '이름 없음')}</b>${s.clientAddr ? ' · ' + esc(s.clientAddr) : ''} <small>저장 ${esc(qlDate(s.ts))}</small></span>`
    : `<span class="xs-qstat">📄 새 견적 <small>(아직 저장 안 함)</small></span>`;
  return `<button class="xs-qbtn save" onclick="qlSave()">💾 저장</button>
    <button class="xs-qbtn" onclick="qlNew()">📝 새로 작성</button>
    <button class="xs-qbtn" onclick="openQuoteList()">📂 저장된 견적서 <span class="xs-qn">${n}</span></button>
    ${status}`;
}
function qlRefreshBar() { const el = document.getElementById('xs-qbar'); if (el) el.innerHTML = qlBarHtml(); }

function qlSave() {
  if (!(document.getElementById('clientName').value || '').trim() &&
      !confirm('고객명이 비어 있어요. 「견적」이라는 이름으로 저장할까요?')) return;
  saveQuote();
}

function qlNew() {
  if (!confirm('새 견적을 작성할까요?\n지금 화면의 고객 정보·금액·특이사항이 비워집니다. (저장한 견적은 목록에 그대로 있어요)')) return;
  resetAll(); // 금액·특이사항·할인 초기화 + 지금 아파트 기본 견적서로
  ['clientName', 'clientPhone', 'clientAddr', 'clientPeriod', 'clientNote'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('clientDate').value = today();
  currentQuoteKey = null;
  if (isTplMode) renderTpl();
  calc(); renderQuoteDoc?.();
  qlRefreshBar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast('📝 새 견적을 작성합니다. 위쪽 탭에서 아파트를 고르세요');
}

/* ── 저장된 견적서 목록 ── */
function openQuoteList() {
  let m = document.getElementById('ql-modal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'ql-modal'; m.className = 'modal-overlay hidden';
    m.innerHTML = `<div class="modal-box modal-ql">
      <div class="modal-header"><span class="modal-title">📂 저장된 견적서</span>
        <button class="modal-close" onclick="closeQuoteList()" aria-label="닫기">✕</button></div>
      <div id="ql-body" class="ql-body"></div></div>`;
    m.addEventListener('click', e => { if (e.target === m) closeQuoteList(); });
    document.body.appendChild(m);
  }
  qlOpen = null;
  renderQuoteList();
  m.classList.remove('hidden');
  setTimeout(() => document.getElementById('ql-q')?.focus(), 50);
}
function closeQuoteList() { document.getElementById('ql-modal')?.classList.add('hidden'); }

function qlInfo(k) {
  const s = qlSnap(k);
  if (!s) return null;
  let t = { rows: [], subAfterNego: 0, totalAfterNego: 0 };
  try { t = calcTotalsFromSnap(s); } catch (e) { /* 예전 형식 */ }
  return { k, s, t, ts: s.ts || Number(k.slice(6)), tpl: s.mode === 'tpl' ? (s.tpl?.name || '기본 견적서') : s.mode === 'yangu' ? '양우 계산기' : '일반 계산기' };
}

function renderQuoteList() {
  const body = document.getElementById('ql-body');
  if (!body) return;
  const q = qlQuery.trim().toLowerCase();
  const all = qlKeys().map(qlInfo).filter(Boolean);
  const list = all.filter(x => !q || [x.s.clientName, x.s.clientAddr, x.s.clientNote, x.s.label, x.tpl].join(' ').toLowerCase().includes(q));
  body.innerHTML = `
    <div class="ql-top">
      <input id="ql-q" type="search" class="ql-search" placeholder="🔍 고객명·주소·아파트 검색" value="${esc(qlQuery)}" oninput="qlQuery=this.value;renderQuoteList();this.focus();this.setSelectionRange(this.value.length,this.value.length)">
      <span class="ql-count">${list.length} / ${all.length}건</span>
    </div>
    <div class="ql-list">${list.length ? list.map(qlItemHtml).join('') : `<p class="ql-empty">${all.length ? '찾는 견적이 없습니다.' : '아직 저장한 견적이 없어요. 시트 위 💾 저장을 누르면 여기에 쌓입니다.'}</p>`}</div>
    <div class="ql-foot">
      <span>저장은 <b>이 브라우저</b>에만 됩니다. 다른 컴퓨터·휴대폰으로 옮길 때는 →</span>
      <button class="backup-btn" onclick="exportAll()">⬇ 백업 내보내기</button>
      <button class="backup-btn" onclick="document.getElementById('backup-file').click()">⬆ 백업 가져오기</button>
    </div>`;
}

function qlItemHtml(x) {
  const { k, s, t } = x;
  const cur = k === currentQuoteKey;
  const open = qlOpen === k;
  return `<div class="ql-item${cur ? ' cur' : ''}${open ? ' open' : ''}">
    <div class="ql-row" onclick="qlToggle('${k}')">
      <div class="ql-main">
        <div class="ql-name">${esc(s.clientName || '이름 없음')}${cur ? ' <span class="ql-cur">지금 보는 견적</span>' : ''}</div>
        <div class="ql-sub">${esc(s.clientAddr || '')}${s.clientAddr ? ' · ' : ''}<span class="ql-tpl">${esc(x.tpl)}</span></div>
        <div class="ql-date">저장 ${esc(qlDate(x.ts))}${s.clientNote ? ' · ' + esc(s.clientNote) : ''}</div>
      </div>
      <div class="ql-amt"><b>${fmt(t.subAfterNego || 0)}원</b><small>VAT 포함 ${fmt(t.totalAfterNego || 0)}</small></div>
    </div>
    ${open ? qlPreviewHtml(x) : ''}
    <div class="ql-btns">
      <button class="ql-b go" onclick="qlLoad('${k}')">✏️ 열기</button>
      <button class="ql-b" onclick="qlToggle('${k}')">${open ? '▲ 접기' : '👀 미리보기'}</button>
      <button class="ql-b" onclick="qlCopy('${k}')" title="이 견적을 바탕으로 다른 고객 견적 만들기">📄 복사해서 새로</button>
      <button class="ql-b del" onclick="qlDel('${k}')">삭제</button>
    </div>
  </div>`;
}

function qlPreviewHtml({ s, t }) {
  const cats = [];
  (t.rows || []).forEach(r => {
    let c = cats.find(x => x.n === r.catName);
    if (!c) cats.push(c = { n: r.catName, amt: 0, items: [] });
    c.amt += r.amt || 0;
    c.items.push(r.label);
  });
  return `<div class="ql-prev">
    <table class="ql-tbl"><thead><tr><th>공정</th><th>내용</th><th>견적가</th></tr></thead><tbody>
      ${cats.map(c => `<tr><td class="ql-c">${esc(c.n)}</td><td class="ql-i">${esc(c.items.join(', '))}</td><td class="ql-n">${fmt(c.amt)}</td></tr>`).join('')}
    </tbody><tfoot>
      ${t.nego ? `<tr><td colspan="2">할인</td><td class="ql-n">-${fmt(t.nego)}</td></tr>` : ''}
      <tr><td colspan="2">총 공사 금액 (현금, 부가세 별도)</td><td class="ql-n"><b>${fmt(t.subAfterNego || 0)}</b></td></tr>
      <tr><td colspan="2">견적 금액 (부가세 포함)</td><td class="ql-n">${fmt(t.totalAfterNego || 0)}</td></tr>
    </tfoot></table>
    ${s.clientPhone ? `<div class="ql-meta">연락처 ${esc(s.clientPhone)}${s.clientPeriod ? ' · 공사 기간 ' + esc(s.clientPeriod) : ''}</div>` : ''}
  </div>`;
}

function qlToggle(k) { qlOpen = qlOpen === k ? null : k; renderQuoteList(); }
function qlLoad(k) { loadQuote(k); closeQuoteList(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function qlCopy(k) {
  loadQuote(k);
  currentQuoteKey = null; // 저장하면 새 견적으로 따로 남음
  ['clientName', 'clientPhone', 'clientAddr', 'clientNote'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('clientDate').value = today();
  if (isTplMode) renderTpl();
  calc(); renderQuoteDoc?.(); qlRefreshBar();
  closeQuoteList();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast('📄 복사했습니다. 고객 정보를 넣고 💾 저장하면 새 견적으로 저장돼요');
}
function qlDel(k) {
  const s = qlSnap(k);
  if (!confirm(`「${s?.clientName || '이 견적'}」 견적을 삭제할까요? 되돌릴 수 없어요.`)) return;
  localStorage.removeItem(k);
  if (currentQuoteKey === k) currentQuoteKey = null;
  loadSavedList(); qlRefreshBar(); renderQuoteList();
}

document.addEventListener('DOMContentLoaded', () => {
  // 예전 📂 불러오기 버튼도 새 목록으로
  const old = document.getElementById('btn-load');
  if (old) old.replaceWith(Object.assign(old.cloneNode(true), { onclick: openQuoteList }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeQuoteList(); });
  // 백업 가져오기 후 목록·개수 갱신
  document.getElementById('backup-file')?.addEventListener('change', () => setTimeout(() => { qlRefreshBar(); renderQuoteList(); }, 400));
});
