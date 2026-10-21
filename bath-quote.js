/**
 * bath-quote.js — 업체(여기가 우리집 등)가 보는 견적 요청 화면 (bath-quote.html#q=…)
 *
 *  · 라인 인테리어가 보낸 제품명·규격·수량·비고만 보입니다 (우리 쪽 단가는 링크에 없음).
 *  · 업체가 단가를 넣고 「보내기」 → 회신 링크(bath.html#reply=…)를 문자·카톡으로 보냄.
 *  · 넣던 단가는 업체 브라우저에 임시 저장되어 새로고침해도 남습니다.
 */
(function () {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = n => (n === '' || n == null || isNaN(n)) ? '' : Math.round(Number(n)).toLocaleString('ko-KR');
const num = v => { const s = String(v ?? '').replace(/[,\s원]/g, ''); if (s === '') return ''; const n = Number(s); return isNaN(n) ? '' : n; };
let Q = null, P = {}, KEY = '';
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ P, vat: $('#vq-vat').value, memo: $('#vq-memo').value })); } catch (e) {} };

async function start() {
  const h = (location.hash || '').slice(1);
  if (!h.startsWith('q=')) { $('#vq-main').innerHTML = '<p class="b-hint">견적 요청 링크가 아니에요. 받은 링크 전체를 다시 열어 주세요.</p>'; return; }
  try { Q = await unpackQuote(h.slice(2)); } catch (e) { $('#vq-main').innerHTML = '<p class="b-hint">링크가 잘렸거나 맞지 않아요. 받은 링크 전체를 다시 열어 주세요.</p>'; return; }
  KEY = 'bq-' + (Q.qid || 'x');
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  P = saved.P || {};
  render(saved);
}

function render(saved) {
  const i = Q.info || {};
  document.title = `욕실 자재 견적 요청 — ${Q.from || ''}`;
  $('#vq-sub').textContent = `${Q.from || ''} → ${Q.to || ''} 담당자님`;
  $('#vq-main').innerHTML = `
    <div class="vq-intro">안녕하세요, <b>${esc(Q.from || '')}</b>입니다. 아래 자재의 <b>단가</b>를 노란 칸에 넣고 맨 아래 <b>「보내기」</b>를 눌러 주세요. <small>(넣는 중인 단가는 이 휴대폰·PC에 임시 저장돼요)</small></div>
    <div class="pp-paper">
      <div class="pp-title">견 적 서</div>
      <div class="pp-head">
        <label>일자: <b>${esc(i.date || '')}</b></label>
        <label>상호: <b>${esc(Q.from || '')}</b></label>
        <label class="pp-tel">전화번호: <b>${esc(Q.fromTel || '')}</b></label>
        <label class="pp-addr">주소: <b>${esc(i.addr || '')}</b>${i.memo ? ` <small>· ${esc(i.memo)}</small>` : ''}</label>
      </div>
      <table class="pp vq">
        <colgroup><col class="c-no"><col class="c-nm"><col><col class="c-spec"><col class="c-q"><col class="c-p"><col class="c-p"><col class="c-memo"></colgroup>
        <thead><tr><th>No</th><th>품명</th><th>제품명</th><th>규격</th><th>수량</th><th>단가</th><th>금액</th><th>비고</th></tr></thead>
        <tbody>${Q.lines.map((l, k) => `<tr>
          <td class="c">${esc(l.no)}</td><td class="c">${esc(l.nm)}</td><td>${esc(l.n)}</td><td>${esc(l.spec)}</td><td class="n">${esc(l.q)}</td>
          <td class="vq-in"><input type="text" inputmode="numeric" class="vq-p" data-k="${k}" value="${won(P[l.id])}" aria-label="${esc(l.n)} 단가"></td>
          <td class="n" data-amt="${k}"></td><td>${esc(l.memo)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="6" class="c">합 계</td><td class="n" id="vq-sum"></td><td></td></tr></tfoot>
      </table>
      <div class="vq-foot">
        <span>단가 기준</span><select id="vq-vat"><option>별도</option><option>포함</option></select>
        <span>전달 메모</span><textarea id="vq-memo" rows="2" placeholder="예: 거울은 다른 모델로 대체 가능합니다"></textarea>
      </div>
      <button class="vq-send" id="vq-send">📤 ${esc(Q.from || '')}에 보내기</button>
      <div id="vq-done" class="vq-done"></div>
    </div>`;
  $('#vq-vat').value = saved.vat || '별도';
  $('#vq-memo').value = saved.memo || '';
  document.querySelectorAll('.vq-p').forEach(el => {
    el.addEventListener('input', () => { P[Q.lines[el.dataset.k].id] = num(el.value); totals(); save(); });
    el.addEventListener('blur', () => { el.value = won(P[Q.lines[el.dataset.k].id]); });
  });
  $('#vq-vat').onchange = save; $('#vq-memo').oninput = save;
  $('#vq-send').onclick = send;
  totals();
}
function totals() {
  let sum = 0;
  Q.lines.forEach((l, k) => {
    const p = P[l.id], q = Number(l.q) || (l.q === '' ? 1 : 0);
    const a = (p === '' || p == null) ? '' : p * (l.q === '' ? 1 : Number(l.q));
    $(`[data-amt="${k}"]`).textContent = won(a) + (a !== '' && l.q === '' ? ' (수량 미정)' : '');
    if (a !== '') sum += a;
  });
  $('#vq-sum').textContent = won(sum) + '원';
}

async function send() {
  const filled = Q.lines.filter(l => P[l.id] !== '' && P[l.id] != null).length;
  if (!filled) { alert('단가를 하나 이상 넣어 주세요.'); return; }
  if (filled < Q.lines.length && !confirm(`${Q.lines.length}개 중 ${filled}개만 단가가 있어요. 이대로 보낼까요?`)) return;
  const reply = { v: 1, qid: Q.qid, from: Q.to || '업체', at: new Date().toISOString(), vat: $('#vq-vat').value, memo: $('#vq-memo').value.trim(),
    lines: Q.lines.map(l => ({ id: l.id, n: l.n, p: P[l.id] ?? '' })) };
  const url = new URL('bath.html', location.href).href.split('#')[0] + '#reply=' + await packQuote(reply);
  const text = `[${reply.from}] 욕실 자재 견적 보내드립니다${(Q.info || {}).addr ? ' (' + Q.info.addr + ')' : ''}.\n${url}`;
  const tel = String(Q.fromTel || '').replace(/[^\d]/g, '');
  $('#vq-done').innerHTML = `
    <p class="b-hint">✅ 보낼 준비가 됐어요. 아래 버튼으로 <b>${esc(Q.from || '')}</b>에 보내 주세요.</p>
    <div class="q-list"><div class="q-item"><div class="t"></div>
      <button class="go" id="vq-sms">💬 문자로 보내기</button>${navigator.share ? '<button id="vq-share">📤 카톡 등 공유</button>' : ''}<button id="vq-copy">📋 복사</button></div></div>
    <input type="text" id="vq-link" readonly value="${esc(url)}" style="margin-top:8px">`;
  $('#vq-sms').onclick = () => { location.href = `sms:${tel}?&body=${encodeURIComponent(text)}`; };
  if ($('#vq-share')) $('#vq-share').onclick = async () => { try { await navigator.share({ title: '욕실 자재 견적', text: text.replace(url, '').trim(), url }); } catch (e) {} };
  $('#vq-copy').onclick = async () => { try { await navigator.clipboard.writeText(text); $('#vq-copy').textContent = '✅ 복사됨'; } catch (e) { $('#vq-link').select(); } };
  $('#vq-done').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
start();
})();
