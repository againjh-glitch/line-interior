/**
 * bath-photo.js — 손글씨 견적서·현장 요청서 사진으로 칸 채우기
 *
 *  두 가지 방법
 *   ① 📷 사진 올리기: 이 브라우저에서 Claude API로 사진을 읽음 (API 키 필요, 키는 이 브라우저에만 저장)
 *   ② 채우기 링크 / 붙여넣기: Claude 채팅에 사진을 올리고 받은 링크(bath.html#fill=…)나 내용을 붙여넣음
 *  어느 쪽이든 bath.js 의 BATH.applyFill(data) 로 채웁니다. 손글씨 원문은 칸 아래에 📷 로 남겨서 확인할 수 있어요.
 *
 *  data 형식 (JSON)
 *   { "info":  { "date": "2026-10-21", "shop": "라인", "tel": "010-…", "addr": "…" },
 *     "lines": [ { "no": 8, "name": "압착", "n": "자재 목록의 정확한 이름 또는 손글씨", "raw": "압착 3개", "spec": "", "q": 3, "memo": "" } ],   ← 욕실 견적서 1~27번
 *     "rows":  [ { "d": "1/6", "who": "", "place": "안방", "n": "MDF", "spec": "12T", "q": 7, "u": "장", "memo": "", "raw": "MD 12T 7장" } ] }  ← 현장 요청
 */
(function () {
'use strict';
const LS_KEY = 'bath-claude-key', LS_MODEL = 'bath-claude-model';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = { get: k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }, set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} } };
const MODELS = [['claude-sonnet-5-5', 'Sonnet 5.5 (기본 · 저렴)'], ['claude-opus-5-5', 'Opus 5.5 (더 정확 · 약 2배 비용)']];

function openModal(title, html) {
  $('#b-modal-title').textContent = title;
  $('#b-modal-body').innerHTML = html;
  $('#b-modal').classList.remove('hidden');
}

/* ── 사진 읽기 창 ── */
function openPhoto() {
  const key = ls.get(LS_KEY), model = ls.get(LS_MODEL) || MODELS[0][0];
  openModal('📷 사진으로 채우기', `
    <div class="ph-tabs"><button class="on" data-ph="api">사진 올리기</button><button data-ph="paste">링크·내용 붙여넣기</button></div>
    <div data-phbox="api">
      <p class="b-hint">손글씨 <b>욕실 견적서</b>(1~27번 양식)나 <b>현장 자재 요청서 / 자재 메모</b> 사진을 올리면 칸을 자동으로 채워요. 채운 칸 아래에 📷 손글씨 원문이 남으니 한 번 확인해 주세요.</p>
      <label class="ph-file"><input type="file" id="ph-file" accept="image/*" capture="environment"><span>📷 사진 찍기 / 고르기</span></label>
      <div id="ph-preview"></div>
      <details class="ph-key"${key ? '' : ' open'}>
        <summary>${key ? '🔑 API 키 저장됨 (바꾸기)' : '🔑 처음 한 번: Claude API 키 넣기'}</summary>
        <p class="b-hint">사진 읽기는 Claude API로 해요. <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>에서 만든 키(sk-ant-…)를 넣으면 <b>이 브라우저에만</b> 저장되고, 사진은 Anthropic으로만 보내집니다. 사진 1장에 보통 몇십 원 정도예요. 공용 컴퓨터에서는 저장하지 마세요.</p>
        <input type="password" id="ph-key" placeholder="sk-ant-…" value="${esc(key)}" autocomplete="off">
        <select id="ph-model">${MODELS.map(([v, t]) => `<option value="${v}"${v === model ? ' selected' : ''}>${t}</option>`).join('')}</select>
        ${key ? '<button class="ph-forget" id="ph-forget">키 지우기</button>' : ''}
      </details>
      <button class="b-addline ph-go" id="ph-go" disabled>사진 읽어서 채우기</button>
      <div id="ph-status" class="b-hint"></div>
    </div>
    <div data-phbox="paste" class="hidden">
      <p class="b-hint">API 키가 없으면: <b>Claude 채팅</b>에 사진을 올리고 "욕실 견적서 채우기 링크 만들어줘"라고 하면 링크를 받을 수 있어요. 받은 <b>링크</b>를 누르거나, 링크·내용을 아래에 붙여넣으세요.</p>
      <textarea id="ph-paste" rows="7" placeholder="https://againjh-glitch.github.io/line-interior/bath.html#fill=…  또는  { &quot;lines&quot;: [ … ] }"></textarea>
      <button class="b-addline ph-go" id="ph-paste-go">붙여넣은 내용으로 채우기</button>
      <div id="ph-paste-status" class="b-hint"></div>
    </div>`);
  document.querySelectorAll('.ph-tabs button').forEach(b => b.onclick = () => {
    document.querySelectorAll('.ph-tabs button').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('[data-phbox]').forEach(x => x.classList.toggle('hidden', x.dataset.phbox !== b.dataset.ph));
  });
  let img = null;
  $('#ph-file').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    $('#ph-status').textContent = '사진 준비 중…';
    try { img = await shrink(f); $('#ph-preview').innerHTML = `<img src="data:image/jpeg;base64,${img}" alt="올린 사진">`; $('#ph-go').disabled = false; $('#ph-status').textContent = ''; }
    catch (err) { $('#ph-status').textContent = '사진을 열 수 없어요: ' + err.message; }
  };
  $('#ph-key').oninput = e => ls.set(LS_KEY, e.target.value.trim());
  $('#ph-model').onchange = e => ls.set(LS_MODEL, e.target.value);
  if ($('#ph-forget')) $('#ph-forget').onclick = () => { ls.set(LS_KEY, ''); openPhoto(); };
  $('#ph-go').onclick = async () => {
    const k = ($('#ph-key').value || '').trim();
    if (!k) { $('#ph-status').textContent = '먼저 API 키를 넣어 주세요 (또는 「링크·내용 붙여넣기」를 쓰세요).'; document.querySelector('.ph-key').open = true; return; }
    ls.set(LS_KEY, k);
    $('#ph-go').disabled = true; $('#ph-status').innerHTML = '⏳ 손글씨 읽는 중… (보통 10~30초)';
    try {
      const data = await readPhoto(img, k, $('#ph-model').value);
      showResult(BATH.applyFill(data));
    } catch (err) {
      $('#ph-status').textContent = '❌ ' + err.message; $('#ph-go').disabled = false;
    }
  };
  $('#ph-paste-go').onclick = () => {
    try { showResult(BATH.applyFill(parsePaste($('#ph-paste').value))); }
    catch (err) { $('#ph-paste-status').textContent = '❌ ' + err.message; }
  };
}

/* 사진 줄이기 (긴 변 1800px, JPEG) — 비용·시간 절약 */
function shrink(file) {
  return new Promise((ok, bad) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const m = 1800, sc = Math.min(1, m / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    im.onerror = () => { URL.revokeObjectURL(url); bad(new Error('이미지 파일이 아니에요')); };
    im.src = url;
  });
}

function prompt() {
  const lines = BATH.lines().map(l => `${l.no}${l.sub ? ` [${l.group || '청소건/수전'}] ${l.name}/` : ` ${l.name}`}`).join('\n');
  const cat = {}; BATH.catalog().forEach(([c, n]) => (cat[c] = cat[c] || []).push(n));
  const catTxt = Object.entries(cat).map(([c, ns]) => `## ${c}\n${ns.join('\n')}`).join('\n');
  const req = BATH.reqCatalog().map(([n, s, u]) => `${n}${s ? ' | ' + s : ''}${u ? ' | ' + u : ''}`).join('\n');
  return `사진은 한국 인테리어 회사의 손글씨 자재 문서입니다. 두 종류 중 하나예요.
(A) 「견적서」 양식: 번호 1~27 줄이 인쇄된 욕실 자재 견적서. 8~15번과 26번 줄은 한 줄 안에 「본드/ 압착/ …」처럼 여러 칸이 있어요.
(B) 그 외: 「현장 자재 요청서」나 다이어리 메모처럼 자유롭게 적은 자재 목록.

JSON 하나만 출력하세요 (설명·코드블록 없이).
{"kind":"bath" 또는 "req",
 "info":{"date":"YYYY-MM-DD 또는 빈칸","shop":"상호","tel":"전화번호","addr":"주소","site":"현장명(메모 맨 위 등에 있으면)"},
 "lines":[{"no":번호,"name":"그 칸 이름(아래 목록 그대로)","n":"제품명","raw":"손글씨 그대로","spec":"규격","q":숫자 또는 "","memo":"비고"}],
 "rows":[{"d":"날짜","who":"이름","place":"사용 장소","n":"품명","spec":"규격","q":숫자 또는 "","u":"단위(장·개·단·갑·박스 등)","memo":"비고","raw":"손글씨 그대로"}]}
(A)면 lines만, (B)면 rows만 채우세요.

규칙
- 손글씨가 아래 자재 목록의 어떤 제품인지 확실하면 n에 목록 이름을 글자 그대로 쓰고, 애매하면 손글씨 그대로 쓰세요. raw에는 항상 손글씨 원문.
- 수량은 숫자만 (「3개」→3, 「2조」→2). 수량 대신 「현장확인」 같은 말이면 q는 ""로 하고 memo에.
- 여러 줄을 묶는 괄호·화살표·「set」 표시는 묶인 줄마다 같은 값을 넣고 memo에 「세트」「1~4번 동일」 등을 적어요.
- 줄을 그어 지운 글씨, 「X」 표시 칸은 빼요. 인쇄된 선택지 중 동그라미 친 것(예: 도무스/정심/편심 중 편심)은 n에 반영.
- 「각 1개씩」처럼 여러 줄에 걸친 공통 메모는 각 줄에 적용.
- 한 칸에 제품이 여러 개면 같은 no·name으로 여러 개 넣어요.

(A) 견적서 칸 목록 (번호 [묶음] 이름):
${lines}

욕실 자재 목록 (분류별):
${catTxt}

(B) 업체 단가표 자재 (품명 | 규격 | 단위):
${req}`;
}

async function readPhoto(b64, apiKey, model) {
  if (!b64) throw new Error('사진을 먼저 골라 주세요');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model, max_tokens: 6000,
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text: prompt() }] }] }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = j.error && j.error.message || res.statusText;
    if (res.status === 401) throw new Error('API 키가 맞지 않아요. 키를 다시 확인해 주세요.');
    if (res.status === 429) throw new Error('요청이 많아요. 잠시 후 다시 해 주세요.');
    throw new Error(`Claude API 오류 (${res.status}): ${msg}`);
  }
  const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  return parsePaste(text);
}

/* 링크(#fill=…) · JSON 둘 다 받음 */
function parsePaste(t) {
  t = String(t || '').trim();
  if (!t) throw new Error('붙여넣은 내용이 없어요');
  const m = t.match(/#fill=([A-Za-z0-9_\-]+)/);
  if (m) return decodeFill(m[1]);
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('채우기 내용을 찾지 못했어요');
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { throw new Error('내용 형식이 맞지 않아요'); }
}
function decodeFill(s) {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b + '==='.slice((b.length + 3) % 4));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function showResult(r) {
  const tab = r.bath ? 'form' : 'req';
  BATH.showTab(tab);
  openModal('✅ 채웠어요', `
    <p>${r.bath ? `욕실 견적서 <b>${r.bath}칸</b>` : ''}${r.bath && r.req ? ', ' : ''}${r.req ? `현장 요청 <b>${r.req}줄</b>` : ''}을 채웠어요.${!r.bath && !r.req ? ' — 읽은 자재가 없어요. 사진이 흐리지 않은지 확인해 주세요.' : ''}</p>
    <p class="b-hint">칸 아래 <b>📷</b> 는 손글씨 원문이에요. 자재 목록과 맞춰 넣은 이름이 맞는지 한 번 훑어봐 주세요.</p>
    ${r.noPrice.length ? `<p class="b-hint">⚠ 단가가 없는 품목: ${[...new Set(r.noPrice)].map(esc).join(', ')} — 제품명 칸을 눌러 목록에서 고르거나 단가를 넣으세요.</p>` : ''}
    ${r.skipped.length ? `<p class="b-hint">칸을 못 찾은 것: ${r.skipped.map(esc).join(', ')}</p>` : ''}
    <div class="q-list"><div class="q-item"><div class="t">마음에 안 들면 채우기 전으로 되돌릴 수 있어요.</div><button id="ph-undo">↩ 되돌리기</button><button class="go" onclick="closeModal()">확인</button></div></div>`);
  $('#ph-undo').onclick = () => { BATH.undoFill(); closeModal(); };
}

const clearHash = () => { try { history.replaceState(null, '', location.pathname + '#form'); } catch (e) {} };
window.bathFillFromLink = code => {
  let data;
  try { data = decodeFill(code); } catch (e) { openModal('채우기 링크', '<p>링크가 잘렸거나 맞지 않아요. 링크 전체를 다시 복사해 주세요.</p>'); return; }
  const n = (data.lines || []).length + (data.rows || []).length;
  openModal('📷 채우기 링크', `<p>사진에서 읽은 자재 <b>${n}개</b>로 칸을 채울까요?${data.info && data.info.addr ? `<br><small>${esc(data.info.addr)}</small>` : ''}</p>
    <p class="b-hint">지금 견적서의 빈 칸에 채워 넣어요. 새 현장이면 먼저 💾 저장 후 🆕 새 견적을 눌러 두세요.</p>
    <div class="q-list"><div class="q-item"><div class="t"></div><button onclick="closeModal()">취소</button><button class="go" id="ph-link-go">채우기</button></div></div>`);
  $('#ph-link-go').onclick = () => { clearHash(); showResult(BATH.applyFill(data)); };
  document.querySelector('#b-modal-body button:not(.go)').addEventListener('click', clearHash);
};

document.querySelectorAll('[data-photo]').forEach(b => b.onclick = openPhoto);
// 채우기 링크 (bath.html#fill=…): Claude 채팅에서 사진을 읽어 만들어 준 링크
const checkHash = () => { const h = (location.hash || '').slice(1); if (h.startsWith('fill=')) window.bathFillFromLink(h.slice(5)); };
checkHash();
window.addEventListener('hashchange', checkHash);
})();
