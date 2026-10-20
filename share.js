/**
 * share.js — 고객용 견적서 링크 만들기 / 읽기
 *
 * 서버 없이 견적 내용을 링크(#뒤)에 압축해서 담습니다.
 *  - 링크를 받은 고객은 view.html에서 그 견적서만 볼 수 있습니다 (수정 불가).
 *  - '#' 뒤 내용은 인터넷으로 전송되지 않고 고객 브라우저 안에서만 풀립니다.
 *  - 고객 연락처는 링크에 넣지 않습니다.
 */

// 견적서에 찍히는 업체 정보 — 바뀌면 여기만 고치세요
const COMPANY = {
  name: '라인 인테리어',
  reg:  '296-24-02323',
  mgr:  '라인 인테리어',
  tel:  '010-6420-3155',
};

/* ── base64url ── */
function b64urlEncode(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ── 압축해서 문자열로 / 되돌리기 (첫 글자: 1=압축, 0=압축 안 함) ── */
async function packQuote(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'undefined') return '0' + b64urlEncode(bytes);
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return '1' + b64urlEncode(new Uint8Array(await new Response(stream).arrayBuffer()));
}
async function unpackQuote(str) {
  const flag = str[0];
  let bytes = b64urlDecode(str.slice(1));
  if (flag === '1') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
