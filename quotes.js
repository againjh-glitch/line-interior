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
    <button class="xs-cloud${qcOn() ? ' on' : ''}" id="xs-cloud" onclick="openCloudSetup()" title="여러 컴퓨터·휴대폰에서 같은 견적 목록">${esc(qcText || (qcOn() ? '☁ 웹 저장' : '☁ 웹 저장 설정'))}</button>
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
  if (qcOn()) qcSync(); // 다른 컴퓨터에서 저장한 견적 받아오기
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
      ${qcOn() ? `<span>☁ 웹 저장 연결됨 — 연결한 컴퓨터·휴대폰끼리 같은 목록이에요. <a href="#" onclick="event.preventDefault();qcSync()">지금 동기화</a></span>`
        : `<span>지금은 <b>이 브라우저</b>에만 저장돼요. <a href="#" onclick="event.preventDefault();openCloudSetup()">☁ 웹 저장 연결</a>하면 다른 컴퓨터·휴대폰에서도 보여요. 또는 →</span>`}
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
  qcAfterDelete(k);
}

document.addEventListener('DOMContentLoaded', () => {
  // 예전 📂 불러오기 버튼도 새 목록으로
  const old = document.getElementById('btn-load');
  if (old) old.replaceWith(Object.assign(old.cloneNode(true), { onclick: openQuoteList }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeQuoteList(); });
  // 백업 가져오기 후 목록·개수 갱신
  document.getElementById('backup-file')?.addEventListener('change', () => setTimeout(() => { qlRefreshBar(); renderQuoteList(); }, 400));
});

/* ═════════ ☁ 웹 저장: 저장된 견적서를 비공개 GitHub 저장소와 동기화 ═════════
 *  욕실 견적서(bath.html)와 같은 연결 정보(bath-cloud-v1)를 씁니다 — 한 번 연결하면 두 화면 모두 동기화.
 *  견적 1개 = estimates/<quote_…>.json. 같은 견적을 두 곳에서 고치면 마지막에 저장한 쪽이 남습니다.
 *  토큰은 각 컴퓨터 브라우저에만 저장됩니다. */
const QC_CFG = 'bath-cloud-v1', QC_ST = 'est-cloud-state-v1', QC_DIR = 'estimates';
const qcGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const qcSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const qcCfg = () => qcGet(QC_CFG, {});
const qcOn = () => { const c = qcCfg(); return !!(c.repo && c.token); };
const qcB64 = s => { const u = new TextEncoder().encode(s); let b = ''; for (let i = 0; i < u.length; i += 0x8000) b += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(b); };
const qcUnB64 = b => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, '')), c => c.charCodeAt(0)));
let qcText = '';

async function qcApi(method, path, body) {
  const c = qcCfg();
  const r = await fetch(`https://api.github.com/repos/${c.repo}/contents/${path}`, { method, cache: 'no-store',
    headers: { Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: body ? JSON.stringify(body) : undefined });
  if (r.status === 404) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(r.status === 401 ? '토큰이 맞지 않거나 만료됐어요' : r.status === 403 ? '토큰에 이 저장소 쓰기 권한이 없어요' : (j.message || '오류') + ' (' + r.status + ')'); e.status = r.status; throw e; }
  return j;
}
async function qcPut(path, data, sha, msg) {
  const body = { message: msg, content: qcB64(JSON.stringify(data)) };
  if (sha) body.sha = sha;
  try { return (await qcApi('PUT', path, body)).content.sha; }
  catch (e) {
    if (e.status !== 409 && e.status !== 422) throw e;
    const cur = await qcApi('GET', path);
    if (cur) body.sha = cur.sha; else delete body.sha;
    return (await qcApi('PUT', path, body)).content.sha;
  }
}
function qcStatus(t, bad) {
  qcText = t;
  const el = document.getElementById('xs-cloud');
  if (el) { el.textContent = t; el.classList.toggle('bad', !!bad); el.classList.toggle('on', qcOn() && !bad); }
}

let qcBusy = null, qcAgain = false;
async function qcSync() {
  if (!qcOn()) { qcStatus('☁ 웹 저장 설정'); return; }
  if (qcBusy) { qcAgain = true; return qcBusy; }
  qcBusy = (async () => {
    qcStatus('☁ 동기화 중…');
    const st = qcGet(QC_ST, { shas: {}, at: {} });
    const dir = await qcApi('GET', QC_DIR) || [];
    const remote = new Map((Array.isArray(dir) ? dir : []).filter(f => /^quote_.*\.json$/.test(f.name)).map(f => [f.name.slice(0, -5), f.sha]));
    // ① 받기 — 다른 컴퓨터에서 저장·고친 견적
    for (const [id, sha] of remote) {
      const loc = qlSnap(id);
      if (st.shas[id] === sha && loc) continue;
      const f = await qcApi('GET', `${QC_DIR}/${id}.json`); if (!f) continue;
      const data = JSON.parse(qcUnB64(f.content || ''));
      if (!loc || (data.ts || 0) > (loc.ts || 0)) localStorage.setItem(id, JSON.stringify(data));
      st.shas[id] = f.sha; st.at[id] = data.ts || 0;
    }
    // ② 다른 컴퓨터에서 지운 견적은 여기서도 지움 (그 뒤 여기서 고친 적이 없을 때만)
    qlKeys().forEach(id => {
      if (!remote.has(id) && st.shas[id] && (qlSnap(id)?.ts || 0) <= (st.at[id] || 0)) {
        localStorage.removeItem(id); delete st.shas[id]; delete st.at[id];
        if (currentQuoteKey === id) currentQuoteKey = null;
      }
    });
    // ③ 올리기 — 여기서 새로 저장했거나 더 최근에 고친 견적
    for (const id of qlKeys()) {
      const s = qlSnap(id); if (!s) continue;
      if (remote.has(id) && (s.ts || 0) <= (st.at[id] || 0)) continue;
      st.shas[id] = await qcPut(`${QC_DIR}/${id}.json`, s, remote.get(id) || st.shas[id], `견적 저장: ${s.clientName || '견적'} ${s.clientAddr || ''}`.trim());
      st.at[id] = s.ts || 0;
    }
    st.last = Date.now();
    qcSet(QC_ST, st);
    if (typeof loadSavedList === 'function') loadSavedList();
    qlRefreshBar();
    if (!document.getElementById('ql-modal')?.classList.contains('hidden')) renderQuoteList();
    qcStatus('☁ 동기화됨 ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
  })().catch(e => { qcStatus('☁ 동기화 실패', true); console.warn(e); })
     .finally(() => { qcBusy = null; if (qcAgain) { qcAgain = false; setTimeout(qcSync, 300); } });
  return qcBusy;
}
function qcAfterSave() { if (qcOn()) qcSync(); }
async function qcAfterDelete(id) {
  if (!qcOn()) return;
  const st = qcGet(QC_ST, { shas: {}, at: {} });
  try {
    const cur = await qcApi('GET', `${QC_DIR}/${id}.json`);
    if (cur) await qcApi('DELETE', `${QC_DIR}/${id}.json`, { message: '견적 삭제 ' + id, sha: cur.sha });
    delete st.shas[id]; delete st.at[id]; qcSet(QC_ST, st);
    qcStatus('☁ 동기화됨 ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
  } catch (e) { qcStatus('☁ 삭제 동기화 실패', true); }
}

function openCloudSetup() {
  let m = document.getElementById('qc-modal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'qc-modal'; m.className = 'modal-overlay hidden';
    m.innerHTML = `<div class="modal-box modal-qc"><div class="modal-header"><span class="modal-title">☁ 웹 저장 (여러 컴퓨터에서 같은 견적 목록)</span>
      <button class="modal-close" onclick="document.getElementById('qc-modal').classList.add('hidden')" aria-label="닫기">✕</button></div><div id="qc-body" class="qc-body"></div></div>`;
    m.addEventListener('click', e => { if (e.target === m) m.classList.add('hidden'); });
    document.body.appendChild(m);
  }
  const c = qcCfg(), st = qcGet(QC_ST, {});
  document.getElementById('qc-body').innerHTML = `
    <p class="qc-hint">저장된 견적서를 <b>비공개 GitHub 저장소</b>에 올려서, 연결한 컴퓨터·휴대폰끼리 같은 목록을 봐요. 💾 저장·삭제할 때와 사이트를 열 때 자동으로 맞춰집니다.
      <b>욕실 자재 견적서에서 이미 연결했다면 그대로 쓰여요.</b>${st.last ? `<br>마지막 동기화: ${esc(new Date(st.last).toLocaleString('ko-KR'))}` : ''}</p>
    <details class="qc-guide"${c.token ? '' : ' open'}><summary>처음 한 번 준비하기 (5분)</summary>
      <ol>
        <li><a href="https://github.com/new" target="_blank" rel="noopener">github.com/new</a> → 이름 <b>line-interior-data</b>, <b>Private</b> 선택, 「Add a README file」 체크 → Create repository</li>
        <li><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">토큰 만들기</a> (Fine-grained token) → Repository access: <b>Only select repositories → line-interior-data</b> → Permissions › Repository › <b>Contents: Read and write</b> → Generate → <code>github_pat_…</code> 복사</li>
        <li>아래에 저장소 이름과 토큰을 넣고 「연결」. 다른 컴퓨터·휴대폰에서도 같은 토큰으로 한 번씩 연결하면 끝.</li>
      </ol>
      <p class="qc-hint">토큰은 그 기기 브라우저에만 저장돼요. 공용 PC에는 넣지 마세요. 손님 이름·연락처가 들어가니 저장소는 꼭 <b>Private</b>로 만들어 주세요.</p>
    </details>
    <label class="qc-f">저장소 <input type="text" id="qc-repo" value="${esc(c.repo || 'againjh-glitch/line-interior-data')}" placeholder="아이디/저장소이름"></label>
    <label class="qc-f">토큰 <input type="password" id="qc-token" value="${esc(c.token || '')}" placeholder="github_pat_…" autocomplete="off"></label>
    <div class="qc-btns"><button class="go" id="qc-go">연결하고 지금 동기화</button>${c.token ? '<button id="qc-off">이 기기에서 연결 끊기</button>' : ''}</div>
    <div id="qc-msg" class="qc-hint"></div>`;
  m.classList.remove('hidden');
  document.getElementById('qc-go').onclick = async () => {
    const repo = document.getElementById('qc-repo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    const token = document.getElementById('qc-token').value.trim();
    const msg = document.getElementById('qc-msg');
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !token) { msg.textContent = '저장소(아이디/이름)와 토큰을 넣어 주세요.'; return; }
    msg.textContent = '⏳ 연결 중…';
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}`, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } });
      if (r.status === 404) throw new Error('저장소를 찾을 수 없어요 (이름이나 토큰 권한 확인)');
      if (r.status === 401) throw new Error('토큰이 맞지 않아요');
      const info = await r.json();
      if (info.private === false) throw new Error('이 저장소는 공개(Public)예요. 손님 정보가 공개되니 Private 저장소를 써 주세요.');
      qcSet(QC_CFG, { repo, token });
      await qcSync();
      msg.innerHTML = qcText.includes('실패') ? '❌ 동기화하지 못했어요. 토큰의 Contents 권한을 확인해 주세요.' : `✅ 연결됐어요. 저장된 견적 ${qlKeys().length}개가 맞춰졌어요.`;
    } catch (e) { msg.textContent = '❌ ' + e.message; qcStatus('☁ 웹 저장 설정', true); }
  };
  const off = document.getElementById('qc-off');
  if (off) off.onclick = () => {
    if (!confirm('이 기기에서 웹 저장 연결을 끊을까요? (욕실 견적서 연결도 같이 끊겨요. 저장된 견적은 이 기기에 남아요)')) return;
    qcSet(QC_CFG, {}); qcSet(QC_ST, { shas: {}, at: {} });
    qcStatus('☁ 웹 저장 설정'); m.classList.add('hidden');
  };
}

document.addEventListener('DOMContentLoaded', () => {
  if (qcOn()) qcSync(); else qcStatus('☁ 웹 저장 설정');
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && qcOn()) qcSync(); });
  document.getElementById('backup-file')?.addEventListener('change', () => setTimeout(qcAfterSave, 800));
});
