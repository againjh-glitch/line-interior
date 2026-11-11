/**
 * xl-line.js — 엑셀 저장 (손님용 / 업체용), 라인 인테리어 기존 엑셀 견적서와 같은 양식
 *
 *  손님용 : 품명 | 내용 | 견적가                (B~H열, 인쇄 영역 B1:H…)
 *  업체용 : 품명 | 내용 | 견적가 | 원가 | 상세내역 (B~J열) + 원가 합·예상 이익·마진
 *
 *  견적가 칸은 시트와 같이 통비용(금액 줄 + 「포함」 줄)은 합친 칸, 나눠 받는 줄은 따로.
 *  합계·부가세·계약금은 엑셀 수식으로 넣어서 엑셀에서 금액을 고치면 같이 바뀝니다.
 *  기본 견적서(시트) 화면에서만 씀 — 일반 계산기 화면은 예전 엑셀 저장(downloadExcel).
 */

const XL_FONT = '함초롬바탕';
const XL_NUM = '#,##0_);[Red]\\(#,##0\\)';
const XL_FILL = {
  gold: 'FFFFE699',   // 의뢰일·고객명 등 머리 칸 (엑셀 테마 강조4 60%)
  head: 'FFF2F2F2',   // 표 머리·품명 칸
  blue: 'FFDAE3F3',   // 견적 금액·계약금
  blue2: 'FFB4C6E7',  // 총 금액
  cost: 'FFFFFF00',   // 원가 칸 (업체용)
  profit: 'FFFFC000',
};
const XL_NOTE = ' 본 업체는 전문 기공 인력만 시공합니다. (연습생, 외국인 인력 제한)\n' +
  ' 본 업체는 자재수급 업체와의 협약으로 고급 자재를 좋은 가격에 들여왔기 때문에\n' +
  ' 타 인테리어 업체보다 합리적인 가격으로 견적을 드립니다.';

let xlImgCache = null;
async function xlImages() {
  if (xlImgCache) return xlImgCache;
  const get = async u => { try { const r = await fetch(u); return r.ok ? await r.arrayBuffer() : null; } catch (e) { return null; } };
  xlImgCache = { logo: await get('img/line-logo.png'), card: await get('img/line-card.png') };
  return xlImgCache;
}

// 엑셀 내용 칸(D~G, 한글 약 28자) 기준 줄 수 → 행 높이
function xlRowHeight(text, base = 19.5) {
  const w = s => [...s].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0);
  const lines = String(text || '').split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(w(l) / 58)), 0);
  return Math.max(base, lines * 14 + 5);
}

async function downloadLineExcel(kind) {
  if (!isTplMode || !tplState) { downloadExcel(); return; }
  const vendor = kind === 'vendor';
  const v = id => (document.getElementById(id)?.value || '').trim();
  const t = calcTotals();
  const wb = new ExcelJS.Workbook();
  wb.creator = '라인 인테리어'; wb.created = new Date();
  const ws = wb.addWorksheet('견적서', { views: [{ showGridLines: false }] });
  const lastCol = vendor ? 'J' : 'H';
  ws.columns = [7.5, 14.6, 15.6, 16.6, 2.8, 12.6, 24.4, 11.8, 17, 45.6].slice(0, vendor ? 10 : 8).map(width => ({ width }));

  // ── 헬퍼 ──
  const thin = { style: 'thin' }, med = { style: 'medium' };
  const cell = (a, val, o = {}) => {
    const c = ws.getCell(a);
    if (val !== undefined) c.value = val;
    c.font = { name: XL_FONT, size: o.size || 10, bold: !!o.bold, color: o.color ? { argb: o.color } : undefined };
    c.alignment = { horizontal: o.h || 'center', vertical: 'middle', wrapText: o.wrap !== false };
    if (o.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.fill } };
    if (o.num) c.numFmt = o.num;
    return c;
  };
  // 범위 전체에 얇은 테두리 + 바깥쪽 굵은 테두리, 필요하면 합치기
  const box = (rng, o = {}) => {
    const [a, b] = rng.split(':'); const s = ws.getCell(a), e = ws.getCell(b || a);
    for (let r = s.row; r <= e.row; r++) for (let c = s.col; c <= e.col; c++) {
      const x = ws.getCell(r, c);
      x.border = {
        top: r === s.row && o.top ? med : thin, bottom: r === e.row && o.bottom ? med : thin,
        left: c === s.col && o.left ? med : thin, right: c === e.col && o.right ? med : thin,
      };
      if (o.fill) x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.fill } };
    }
    if (b && b !== a) ws.mergeCells(rng);
  };
  const H = (r, h) => { ws.getRow(r).height = h; };
  const won = d => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? `${m[1]}년 ${+m[2]}월 ${+m[3]}일` : d; };

  // ── 머리 (1~13행) ──
  [[1, 33], [2, 14.25], [3, 31.5], [4, 8.25], [5, 21], [6, 32.25], [7, 21], [8, 34.5], [9, 21], [10, 21], [11, 21], [12, 8.25], [13, 25.5], [14, 8.25], [15, 21]].forEach(([r, h]) => H(r, h));
  ws.mergeCells('B1:H1'); cell('B1', '라인 인테리어', { size: 11, h: 'right' });
  ws.mergeCells('B3:H3'); cell('B3', '견 적 서', { size: 24 });
  const label = (a, txt) => cell(a, txt, { fill: XL_FILL.gold });
  label('B5', '의뢰일 / 경로'); box('B5', { left: 1, top: 1 });
  box('C5:D5', { top: 1 }); cell('C5', '');
  label('F5', '상호'); box('F5', { left: 1, top: 1 });
  box('G5:H5', { top: 1, right: 1 }); cell('G5', '라인 인테리어');
  label('B6', '고객명 / 연락처'); box('B6', { left: 1 });
  box('C6:D6'); cell('C6', [v('clientName'), v('clientPhone')].filter(Boolean).join(' / '), { bold: true });
  label('F6', '등록번호'); box('F6', { left: 1 });
  box('G6:H6', { right: 1 }); cell('G6', `${COMPANY.reg}\n(업태 : 건설업 / 종목 : 인테리어)`);
  label('B7', '주소 / 평형'); box('B7:B8', { left: 1 });
  box('C7:D8'); cell('C7', v('clientAddr'));
  label('F7', '담당자'); box('F7:F11', { left: 1, bottom: 1 });
  box('G7:H11', { right: 1, bottom: 1 });
  [['B9', '실측 여부', ''], ['B10', '시공 예상기간', v('clientPeriod')], ['B11', '견적서 작성일', won(v('clientDate') || today())]].forEach(([a, l, val], i) => {
    const r = +a.slice(1);
    label(a, l); box(a, { left: 1, bottom: i === 2 });
    box(`C${r}:D${r}`, { bottom: i === 2 }); cell(`C${r}`, val);
  });
  label('B13', '특이사항'); box('B13', { left: 1, top: 1, bottom: 1 });
  box('C13:H13', { top: 1, bottom: 1, right: 1 }); cell('C13', v('clientNote'), { h: 'left' });
  if (v('clientNote')) H(13, Math.max(25.5, xlRowHeight(v('clientNote'), 25.5)));

  // ── 표 머리 (15행) ──
  const HR = 15;
  cell(`B${HR}`, '품 명', { bold: true, fill: XL_FILL.head }); box(`B${HR}`, { top: 1, bottom: 1, left: 1 });
  box(`C${HR}:G${HR}`, { top: 1, bottom: 1 }); cell(`C${HR}`, '내 용', { bold: true, fill: XL_FILL.head }); ws.getCell(`C${HR}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_FILL.head } };
  cell(`H${HR}`, '견적가', { bold: true, fill: XL_FILL.head }); box(`H${HR}`, { top: 1, bottom: 1, left: 1, right: 1 });
  if (vendor) {
    cell(`I${HR}`, '원가', { bold: true, fill: XL_FILL.head }); box(`I${HR}`, { top: 1, bottom: 1, left: 1, right: 1 });
    cell(`J${HR}`, '상세내역', { bold: true, fill: XL_FILL.head, h: 'left' }); box(`J${HR}`, { top: 1, bottom: 1, right: 1 });
  }

  // ── 본문: 기본 공사 → 선택 옵션(적용) → 특이사항 ──
  const blocks = tplState.blocks.map(b => ({ proc: b.proc, items: b.items.filter(i => i.on) })).filter(b => b.items.length);
  const opts = tplState.options.filter(o => o.on);
  if (opts.length) blocks.push({ proc: '선택 옵션', items: opts.map(o => ({ ...o, p: o.p })) });
  const sps = typeof specialRows === 'function' ? specialRows() : [];
  if (sps.length) blocks.push({ proc: '특이사항', items: sps.map(s => ({ n: s.label, d: [s.detail, s.qty !== 1 ? `${s.qty}${s.u} × ${fmt(s.unitP)}` : ''].filter(Boolean).join(' / '), p: s.amt })) });

  let r = HR + 1;
  const first = r;
  blocks.forEach(b => {
    const r0 = r;
    // 견적가 칸 묶음: 금액 줄 + 아래 「포함」 줄
    const span = b.items.map(() => 0); let head = -1;
    b.items.forEach((x, k) => { if (x.p != null || head < 0) { head = k; span[k] = 1; } else span[head]++; });
    b.items.forEach((x, k) => {
      const rr = r + k;
      H(rr, xlRowHeight(x.d));
      cell(`C${rr}`, x.n); box(`C${rr}`, { left: 1, top: k === 0 });
      box(`D${rr}:G${rr}`, { top: k === 0 }); cell(`D${rr}`, x.d || '', { h: 'left' });
      if (span[k]) {
        const rng = span[k] > 1 ? `H${rr}:H${rr + span[k] - 1}` : `H${rr}`;
        box(rng, { left: 1, right: 1, top: 1 });
        cell(`H${rr}`, x.p == null ? null : Number(x.p), { num: XL_NUM });
      }
      if (vendor) {
        cell(`I${rr}`, x.c == null || x.c === '' ? null : Number(x.c), { num: XL_NUM, fill: x.c ? XL_FILL.cost : undefined });
        box(`I${rr}`, { left: 1, right: 1, top: k === 0 });
        cell(`J${rr}`, x.m || '', { h: 'left' }); box(`J${rr}`, { right: 1, top: k === 0 });
      }
    });
    r += b.items.length;
    box(`B${r0}:B${r - 1}`, { left: 1, top: 1, bottom: 1, fill: XL_FILL.head });
    cell(`B${r0}`, b.proc, { fill: XL_FILL.head });
  });
  // 현장관리비·할인 (사이트와 같은 계산)
  const lastItem = r - 1;
  const extra = [];
  if (tplState.feeRate > 0) extra.push(['현장관리비', `현장관리비 및 일반관리비 (공정관리·현장운영·품질관리 등) — 공사금액의 ${tplState.feeRate}%`, { formula: `ROUND(SUM(H${first}:H${lastItem})*${tplState.feeRate}%,-3)` }]);
  if (negoAmt > 0) extra.push(['할인', '할인 / 네고', -negoAmt]);
  if (extra.length) {
    const r0 = r;
    extra.forEach(([n, d, val], k) => {
      H(r, xlRowHeight(d));
      cell(`C${r}`, n); box(`C${r}`, { left: 1, top: k === 0 });
      box(`D${r}:G${r}`, { top: k === 0 }); cell(`D${r}`, d, { h: 'left' });
      box(`H${r}`, { left: 1, right: 1, top: 1 }); cell(`H${r}`, val, { num: XL_NUM });
      if (vendor) { box(`I${r}`, { left: 1, right: 1, top: k === 0 }); box(`J${r}`, { right: 1, top: k === 0 }); }
      r++;
    });
    box(`B${r0}:B${r - 1}`, { left: 1, top: 1, bottom: 1, fill: XL_FILL.head }); cell(`B${r0}`, '관리비 · 할인', { fill: XL_FILL.head });
  }
  const last = r - 1;
  // 표 아래 굵은 선
  for (let c = 2; c <= (vendor ? 10 : 8); c++) { const x = ws.getCell(last, c); x.border = { ...x.border, bottom: med }; }

  // ── 합계 ──
  H(r, 8.25); r++;
  const RT = r, RV = r + 1, RF = r + 2;
  [[RT, '총 공사 금액', { formula: `SUM(H${first}:H${last})` }, {}], [RV, '부가세 (영수증, 계산서, 카드+10%)', { formula: `D${RT}*10%` }, {}],
   [RF, '견적 금액', { formula: `D${RT}+D${RV}` }, { bold: true, fill: XL_FILL.blue }]].forEach(([rr, l, f, o], k) => {
    H(rr, 21);
    box(`B${rr}:C${rr}`, { left: 1, top: k !== 1, bottom: k > 0, fill: o.fill }); cell(`B${rr}`, l, o);
    box(`D${rr}:H${rr}`, { right: 1, top: k !== 1, bottom: k > 0, fill: o.fill }); cell(`D${rr}`, f, { ...o, num: XL_NUM });
  });
  if (vendor) {
    cell(`I${RT}`, { formula: `SUM(I${first}:I${last})` }, { num: XL_NUM, size: 11 }); cell(`J${RT}`, '← 원가 합계', { h: 'left', size: 10 });
    cell(`I${RF}`, { formula: `D${RT}-I${RT}` }, { num: XL_NUM, size: 11, fill: XL_FILL.profit }); cell(`J${RF}`, { formula: `IF(D${RT}=0,0,I${RF}/D${RT})` }, { num: '"예상 이익 · 마진 "0.0%', h: 'left', size: 11, fill: XL_FILL.cost });
    cell(`I${RV}`, '원가는 내부용 (고객에게 보내지 마세요)', { size: 9, color: 'FF9A3412' });
  }
  r = RF + 1;
  H(r, 8.25); r++;
  H(r, 78.75); box(`B${r}:H${r}`, { left: 1, right: 1, top: 1, bottom: 1 }); cell(`B${r}`, XL_NOTE, { h: 'left' }); r++;
  H(r, 8.25); r++;
  H(r, 21); ws.mergeCells(`B${r}:G${r}`); cell(`B${r}`, '공사대금 지급 안내 (계약 시 지급일 확정)', { size: 11, h: 'left', bold: true });
  for (let c = 2; c <= 8; c++) ws.getCell(r, c).border = { bottom: med }; r++;
  const pay = [['계약금', payRatio.deposit], ['중도금', payRatio.mid], ['잔금', payRatio.final]];
  const R1 = r;
  pay.forEach(([l, pct], k) => {
    H(r, 21);
    box(`B${r}:C${r}`, { left: 1, top: k === 0, fill: XL_FILL.blue }); cell(`B${r}`, `${l}(${pct}%)`, { size: 11, fill: XL_FILL.blue });
    box(`D${r}:H${r}`, { right: 1, top: k === 0 });
    cell(`D${r}`, k < 2 ? { formula: `ROUND(D${RF}*${pct}%,0)` } : { formula: `D${R1 + 3}-(D${R1}+D${R1 + 1})` }, { size: 11, num: XL_NUM });
    r++;
  });
  H(r, 21);
  box(`B${r}:C${r}`, { left: 1, top: 1, bottom: 1, fill: XL_FILL.blue2 }); cell(`B${r}`, '총 금액', { size: 11, fill: XL_FILL.blue2 });
  box(`D${r}:H${r}`, { right: 1, top: 1, bottom: 1, fill: XL_FILL.blue2 }); cell(`D${r}`, { formula: `D${RF}` }, { size: 11, num: XL_NUM, fill: XL_FILL.blue2 }); r++;
  H(r, 8.25); r++;
  [['공사 기간', v('clientPeriod')], ['공사 완료일', '']].forEach(([l, val], k) => {
    H(r, 21);
    box(`B${r}:C${r}`, { left: 1, top: k === 0, bottom: k === 1, fill: XL_FILL.blue }); cell(`B${r}`, l, { size: 11, fill: XL_FILL.blue });
    box(`D${r}:H${r}`, { right: 1, top: k === 0, bottom: k === 1 }); cell(`D${r}`, val, { size: 11 });
    r++;
  });
  const end = r - 1;

  // ── 로고·명함 그림 ──
  const img = await xlImages();
  if (img.logo) ws.addImage(wb.addImage({ buffer: img.logo, extension: 'png' }), { tl: { col: 6.15, row: 0.1 }, ext: { width: 92, height: 60 } });
  if (img.card) ws.addImage(wb.addImage({ buffer: img.card, extension: 'png' }), { tl: { col: 6.05, row: 6.08 }, ext: { width: 262, height: 144 } });

  // ── 인쇄: A4 세로, 가로 1쪽 맞춤 ──
  ws.pageSetup = { paperSize: 9, orientation: vendor ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0.43, right: 0.43, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 }, horizontalCentered: true,
    printArea: `B1:${lastCol}${end}` };

  const buf = await wb.xlsx.writeBuffer();
  const name = (v('clientName') || '고객').replace(/\s*님$/, '').replace(/[\\/:*?"<>|]/g, '');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = `라인인테리어_견적서_${name}_${v('clientDate') || today()}_${vendor ? '업체용' : '손님용'}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  showToast(vendor ? '⬇ 업체용 엑셀을 저장했어요 (원가·상세내역 포함 — 고객에게 보내지 마세요)' : '⬇ 손님용 엑셀을 저장했어요');
}
