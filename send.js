/**
 * send.js — 「고객에게 보내기」
 *
 * 견적을 저장하면 바로 고객용 링크를 만들어 보내기 창을 띄웁니다.
 * 문자(휴대폰 번호 자동 입력) · 카카오톡 등 공유 · 링크 복사 · 미리보기.
 * share.js(압축)와 app.js(calcTotals)를 사용합니다.
 */

// 고객 화면에 보낼 견적 내용 (계산 결과만, 내부 정보·고객 연락처 제외)
function buildCustomerQuote() {
  const t = calcTotals();
  const v = id => (document.getElementById(id)?.value || '').trim();
  return {
    v: 1,
    co: COMPANY,
    c: { name: v('clientName'), addr: v('clientAddr'), period: v('clientPeriod'), date: v('clientDate'), note: v('clientNote') },
    title: isTplMode && tplState ? tplState.name : '',
    rows: t.rows.map(r => [r.catName, r.label, r.detail || '', r.qty ?? '', r.u || '', r.unitP || 0, r.amt || 0, r.incl ? 1 : 0]),
    sub: t.sub, nego: t.nego || 0, subN: t.subAfterNego, vat: t.vatAfterNego, total: t.totalAfterNego,
    pay: { ...payRatio },
    at: Date.now(),
  };
}

async function customerLink() {
  const data = await packQuote(buildCustomerQuote());
  return new URL('view.html', location.href.split('#')[0].split('?')[0]).href + '#q=' + data;
}

function sendMessageText(url) {
  const name = (document.getElementById('clientName').value || '').trim();
  const { totalAfterNego } = calcTotals();
  return `[${COMPANY.name}] ${name ? name.replace(/\s*님$/, '') + ' 님, ' : ''}요청하신 인테리어 견적서입니다.\n` +
         `총 공사금액 ${fmt(totalAfterNego)}원 (부가세 포함)\n\n아래 링크에서 확인하실 수 있습니다.\n${url}\n\n문의: ${COMPANY.tel}`;
}

let lastSendUrl = '';
async function openSendModal(afterSave) {
  const { rows } = calcTotals();
  const body = document.getElementById('send-body');
  if (!rows.length) {
    body.innerHTML = '<p class="send-msg">견적 항목이 없습니다. 항목을 고른 뒤 다시 눌러주세요.</p>';
    document.getElementById('send-modal').classList.remove('hidden');
    return;
  }
  body.innerHTML = '<p class="send-msg">링크를 만드는 중…</p>';
  document.getElementById('send-modal').classList.remove('hidden');
  try {
    lastSendUrl = await customerLink();
  } catch (e) {
    body.innerHTML = `<p class="send-msg">링크를 만들지 못했습니다: ${esc(e.message)}</p>`;
    return;
  }
  const phone = (document.getElementById('clientPhone').value || '').replace(/[^\d+]/g, '');
  const canShare = !!navigator.share;
  body.innerHTML = `
    ${afterSave ? '<p class="send-done">💾 저장했습니다. 고객에게 보낼 견적서 링크가 만들어졌어요.</p>' : ''}
    <p class="send-msg">고객은 링크를 열면 <b>이 견적서만</b> 볼 수 있습니다 (수정 불가, 인쇄·PDF 저장 가능). 견적을 고치면 링크를 다시 보내주세요.</p>
    <label class="send-label">보낼 메시지</label>
    <textarea id="send-text" class="send-text" rows="7">${esc(sendMessageText(lastSendUrl))}</textarea>
    <div class="send-btns">
      <button class="send-btn sms" onclick="sendSms()">💬 문자 보내기${phone ? `<small>${esc(document.getElementById('clientPhone').value)}</small>` : '<small>번호 입력 필요</small>'}</button>
      ${canShare ? '<button class="send-btn share" onclick="sendShare()">📤 카카오톡 등으로 공유</button>' : ''}
      <button class="send-btn copy" onclick="sendCopy()">📋 메시지 복사</button>
      <button class="send-btn link" onclick="sendCopyLink()">🔗 링크만 복사</button>
      <button class="send-btn view" onclick="window.open(lastSendUrl,'_blank')">👀 고객 화면 미리보기</button>
    </div>`;
}
function closeSendModal() { document.getElementById('send-modal').classList.add('hidden'); }

function sendSms() {
  const raw = document.getElementById('clientPhone').value || '';
  const phone = raw.replace(/[^\d+]/g, '');
  if (!phone) { alert('위쪽 「연락처」 칸에 고객 휴대폰 번호를 넣어주세요.'); return; }
  const text = document.getElementById('send-text').value;
  // iOS·안드로이드 모두에서 열리는 형식
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
function sendCopyLink() { copyText(lastSendUrl, '🔗 고객용 링크를 복사했습니다'); }

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-send')?.addEventListener('click', () => openSendModal(false));
  // 견적 저장 직후 자동으로 보내기 창 열기 (app.js의 저장이 먼저 실행됨)
  document.getElementById('btn-save')?.addEventListener('click', () => {
    if (calcTotals().rows.length) openSendModal(true);
  });
  const m = document.getElementById('send-modal');
  m?.addEventListener('click', e => { if (e.target === m) closeSendModal(); });
});
