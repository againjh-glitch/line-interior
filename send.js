/**
 * send.js — 공유 버튼 두 가지
 *
 *  📤 고객에게 공유 : 고객이 보는 견적서. 품명·내용과 견적가만 (내부 참고 정보·고객 연락처 제외)
 *  🔗 일반 공유     : 가족·직원용. 기존 견적 범위·포함 빈도·비고까지 보이고,
 *                     「계산기에서 열어 수정」으로 그대로 이어서 작업 가능
 *
 * 💾 저장을 누르면 고객에게 공유 창이 자동으로 열립니다.
 * share.js(압축)와 app.js(calcTotals)를 사용합니다.
 */

const SHARE_KINDS = {
  c: {
    title: '📤 고객에게 공유',
    intro: '고객은 링크를 열면 <b>이 견적서만</b> 볼 수 있습니다. <b>품명·내용과 견적가만</b> 보이고 기존 견적 범위·포함 빈도·비고는 보이지 않습니다. (수정 불가, 인쇄·PDF 저장 가능)',
    smsToCustomer: true,
  },
  g: {
    title: '🔗 일반 공유 (내부 확인용)',
    intro: '가족·직원에게 보내는 링크입니다. <b>기존 견적 범위·포함 빈도·비고</b>까지 보이고, 「✏️ 계산기에서 열어 수정」 버튼으로 이어서 작업할 수 있습니다. <b>고객에게는 보내지 마세요.</b>',
    smsToCustomer: false,
  },
};

// 공유할 견적 내용 — kind 'c'(고객용) / 'g'(일반·내부용)
function buildShareQuote(kind) {
  const t = calcTotals();
  const v = id => (document.getElementById(id)?.value || '').trim();
  const internal = kind === 'g';
  const q = {
    v: 2, k: kind,
    co: COMPANY,
    c: { name: v('clientName'), addr: v('clientAddr'), period: v('clientPeriod'), date: v('clientDate'), note: v('clientNote') },
    title: isTplMode && tplState ? tplState.name : '',
    rows: t.rows.map(r => {
      // 고객용은 줄 금액을 담지 않음 (공정 합계 cats만)
      const base = [r.catName, r.label, r.detail || '', internal ? (r.amt || 0) : 0, r.incl ? 1 : 0];
      return internal ? [...base, r.range || '', r.f || '', r.note || ''] : base;
    }),
    cats: internal ? null : t.rows.reduce((m, r) => { m[r.catName] = (m[r.catName] || 0) + (r.amt || 0); return m; }, {}),
    sub: t.sub, nego: t.nego || 0, subN: t.subAfterNego, vat: t.vatAfterNego, total: t.totalAfterNego,
    pay: { ...payRatio },
    at: Date.now(),
  };
  // 일반 공유는 계산기에서 다시 열 수 있도록 작업 상태도 담음 (고객 연락처 제외)
  if (internal) { q.edit = compactSnap(getSnapshot()); q.edit.clientPhone = ''; }
  return q;
}

async function shareLink(kind) {
  const data = await packQuote(buildShareQuote(kind));
  return new URL('view.html', location.href.split('#')[0].split('?')[0]).href + '#q=' + data;
}

function shareMessageText(kind, url) {
  const name = (document.getElementById('clientName').value || '').trim().replace(/\s*님$/, '');
  const { totalAfterNego } = calcTotals();
  if (kind === 'g') {
    return `[${COMPANY.name} 내부] ${name ? name + ' 님 ' : ''}견적 확인 부탁드려요.\n` +
           `총 ${fmt(totalAfterNego)}원 (부가세 포함)\n${url}`;
  }
  return `[${COMPANY.name}] ${name ? name + ' 님, ' : ''}요청하신 인테리어 견적서입니다.\n` +
         `총 공사금액 ${fmt(totalAfterNego)}원 (부가세 포함)\n\n아래 링크에서 확인하실 수 있습니다.\n${url}\n\n문의: ${COMPANY.tel}`;
}

let lastSendUrl = '';
let lastSendKind = 'c';
async function openSendModal(kind, afterSave) {
  lastSendKind = kind;
  const K = SHARE_KINDS[kind];
  document.getElementById('send-title').textContent = K.title;
  const body = document.getElementById('send-body');
  document.getElementById('send-modal').classList.remove('hidden');
  if (!calcTotals().rows.length) {
    body.innerHTML = '<p class="send-msg">견적 항목이 없습니다. 항목을 고른 뒤 다시 눌러주세요.</p>';
    return;
  }
  body.innerHTML = '<p class="send-msg">링크를 만드는 중…</p>';
  try {
    lastSendUrl = await shareLink(kind);
  } catch (e) {
    body.innerHTML = `<p class="send-msg">링크를 만들지 못했습니다: ${esc(e.message)}</p>`;
    return;
  }
  const phoneShown = document.getElementById('clientPhone').value || '';
  const smsSub = K.smsToCustomer ? (phoneShown ? esc(phoneShown) : '번호 입력 필요') : '받는 사람 직접 선택';
  body.innerHTML = `
    ${afterSave ? '<p class="send-done">💾 저장했습니다. 고객에게 보낼 견적서 링크가 만들어졌어요.</p>' : ''}
    ${kind === 'g' ? '<p class="send-warn">🔒 내부 확인용 링크입니다</p>' : ''}
    <p class="send-msg">${K.intro} 견적을 고치면 링크를 다시 보내주세요.</p>
    <label class="send-label" for="send-text">보낼 메시지</label>
    <textarea id="send-text" class="send-text" rows="7">${esc(shareMessageText(kind, lastSendUrl))}</textarea>
    <div class="send-btns">
      <button class="send-btn sms" onclick="sendSms()">💬 문자 보내기<small>${smsSub}</small></button>
      ${navigator.share ? '<button class="send-btn share" onclick="sendShare()">📤 카카오톡 등으로 공유</button>' : ''}
      <button class="send-btn copy" onclick="sendCopy()">📋 메시지 복사</button>
      <button class="send-btn link" onclick="sendCopyLink()">🔗 링크만 복사</button>
      <button class="send-btn view" onclick="window.open(lastSendUrl,'_blank')">👀 ${kind === 'g' ? '받는 화면' : '고객 화면'} 미리보기</button>
    </div>
    <button class="send-switch" onclick="openSendModal('${kind === 'c' ? 'g' : 'c'}')">${kind === 'c' ? '🔗 대신 일반 공유(내부용) 링크 만들기' : '📤 대신 고객에게 공유 링크 만들기'}</button>`;
}
function closeSendModal() { document.getElementById('send-modal').classList.add('hidden'); }

function sendSms() {
  const text = document.getElementById('send-text').value;
  let phone = '';
  if (SHARE_KINDS[lastSendKind].smsToCustomer) {
    phone = (document.getElementById('clientPhone').value || '').replace(/[^\d+]/g, '');
    if (!phone) { alert('위쪽 「연락처」 칸에 고객 휴대폰 번호를 넣어주세요.'); return; }
  }
  // iOS·안드로이드 모두에서 열리는 형식 (일반 공유는 받는 사람을 직접 고름)
  location.href = `sms:${phone}?&body=${encodeURIComponent(text)}`;
}
async function sendShare() {
  const text = document.getElementById('send-text').value;
  try {
    await navigator.share({ title: `${COMPANY.name} 견적서`, text: text.replace(lastSendUrl, '').trim(), url: lastSendUrl });
  } catch (e) { /* 사용자가 취소 */ }
}
async function copyText(t, msg) {
  try { await navigator.clipboard.writeText(t); showToast(msg); }
  catch (e) { prompt('아래 내용을 복사하세요', t); }
}
function sendCopy() { copyText(document.getElementById('send-text').value, '📋 메시지를 복사했습니다. 카톡·문자에 붙여넣으세요'); }
function sendCopyLink() { copyText(lastSendUrl, lastSendKind === 'g' ? '🔗 일반 공유 링크를 복사했습니다' : '🔗 고객용 링크를 복사했습니다'); }

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-send')?.addEventListener('click', () => openSendModal('c'));
  document.getElementById('btn-general')?.addEventListener('click', () => openSendModal('g'));
  // 견적 저장 직후 자동으로 고객에게 공유 창 열기 (app.js의 저장이 먼저 실행됨)
  document.getElementById('btn-save')?.addEventListener('click', () => {
    if (calcTotals().rows.length) openSendModal('c', true);
  });
  const m = document.getElementById('send-modal');
  m?.addEventListener('click', e => { if (e.target === m) closeSendModal(); });
});
