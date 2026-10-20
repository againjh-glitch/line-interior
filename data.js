/**
 * data.js — 인테리어 견적 계산기 자재 데이터 v5
 * 메뉴 순서: 철거 > 설비 > 중문 > 목공 > 욕실 > 타일 > 도배 > 창호 > 마루 > 장판·데코 > 방범창 > 전기·조명 > 가구·설비 > 기타
 *
 * type 필드:
 *   'simple'   : 체크 + 수량 (기본)
 *   'qty-only' : 수량만 (체크 없이 숫자 입력)
 *   'select'   : 드롭다운 선택
 *   'input'    : 직접 금액 입력
 *   'custom'   : 별도 렌더 로직 (special:true 로 표시)
 */

const DATA = {

  /* ════════════════════════════════
     1. 철거
  ════════════════════════════════ */
  "철거": { items: [
    {
      id:"dem_labor", n:"인건비", d:"평수에 따라 품 수 자동 계산 (품당 250,000원)",
      type:"auto-labor", special:true
    },

    {
      id:"dem_floor_type", n:"마루 철거", d:"종류 선택 후 평수 입력",
      type:"floor-demo", special:true
    },
    {
      id:"dem_waste", n:"폐기물", d:"평수에 따라 차량 수 자동 계산 (차량당 450,000원)",
      type:"auto-waste", special:true
    },

    {
      id:"dem_bath_demo", n:"욕실 철거", d:"개소별 80만원 — 거실/안방 각각 선택",
      type:"bath-demo", special:true
    },
    { id:"dem_extra", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },
  ]},


  /* ════════════════════════════════
     2. 창호 (방범창 포함)
  ════════════════════════════════ */
  "창호": { items: [
    // ── 창호 ──
    { id:"win_div1", n:"", d:"", type:"divider", label:"창호" },
    { id:"w1",  n:"발코니이중창 2W",          d:"VBF242-4TM 26T 로이유리 자동핸들4P",   u:"개", p:1557444, type:"stepper" },
    { id:"w2",  n:"발코니이중창 3W",          d:"VBF242-4TM 26T 로이유리 자동핸들4P",   u:"개", p:2316444, type:"stepper" },
    { id:"w3",  n:"발코니단창 2W",            d:"VBF140PMT 26T 로이유리 자동핸들2P",    u:"개", p:548167,  type:"stepper" },
    { id:"w4",  n:"이중창 2W",               d:"VBF230-4PM 24T 투명/블투명 크리센트",  u:"개", p:630000,  type:"stepper" },
    { id:"w5",  n:"이중창 3W",               d:"VBF230-4PM 내부24T / 외부24T 투명",    u:"개", p:1344000, type:"stepper" },
    { id:"w6",  n:"공틀단창 2W/3W",          d:"UBF225TM 24T 투명유리 크리센트",       u:"개", p:587500,  type:"stepper" },
    { id:"w7",  n:"KCC HWONE 141단창 발코니", d:"삼성/두산 48평형 TPS 단열/26T 로이",  u:"개", p:850000,  type:"stepper" },
    { id:"w8",  n:"KCC HWONE 225공틀단창",    d:"삼성/두산 48평형 TPS 단열/22T 로이",  u:"개", p:950000,  type:"stepper" },
    { id:"w9",  n:"창호 철거비 (30평형)",     d:"기존 창호 철거 및 폐기물 처리",        u:"식", p:400000,  type:"simple"  },
    { id:"w10", n:"양중비",                   d:"자재 운반 양중비용",                    u:"식", p:200000,  type:"simple"  },
    // ── 방범창 ──
    { id:"win_div2", n:"", d:"", type:"divider", label:"방범창" },
    { id:"s1", n:"방범 입구현관 1200×2300",  d:"고구려시스템", u:"개", p:488000, type:"stepper" },
    { id:"s2", n:"방범창 900×1200",          d:"고구려시스템", u:"개", p:329000, type:"stepper" },
    { id:"s3", n:"방범창 1200×2100 거실",    d:"고구려시스템", u:"개", p:467000, type:"stepper" },
    { id:"s4", n:"방범창 900×2200 다용도실", d:"고구려시스템", u:"개", p:426000, type:"stepper" },
    { id:"s5", n:"방범창 주방 600×500",      d:"고구려시스템", u:"개", p:205000, type:"stepper" },
    { id:"win_extra", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },
  ]},

  /* ════════════════════════════════
     2. 설비
  ════════════════════════════════ */
  "설비": { items: [
    { id:"plm_water1", n:"욕실 방수 — 1차",   d:"개소당 200,000원",                          type:"stepper", u:"개소", p:200000 },
    { id:"plm_water2", n:"욕실 방수 — 2~3차", d:"단독 400,000원 · 1차와 동시 시 200,000원", type:"stepper", u:"개소", p:400000 },
    { id:"plm_sink",   n:"싱크대 수도",     d:"싱크대 수도 내림/올림",           type:"simple", u:"식", p:150000 },
    { id:"plm_bath",   n:"욕실 배관",       d:"욕실 배관 개당 350,000원",        type:"stepper",u:"개", p:350000 },
    { id:"plm_drain1", n:"우수관 방수",     d:"개당 250,000원 (교체와 동시 선택 시 세트 500,000원)", type:"stepper",u:"개", p:250000 },
    { id:"plm_drain2", n:"우수관 교체",     d:"개당 350,000원 (방수와 동시 선택 시 세트 500,000원)", type:"stepper",u:"개", p:350000 },
    { id:"plm_living", n:"거실 확장 (단열포함)", d:"2,500,000원",                type:"simple", u:"식", p:2500000 },
    { id:"plm_room",   n:"방 확장 (단열포함)",   d:"개당 2,000,000원",           type:"stepper",u:"개", p:2000000 },
    { id:"plm_extra", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },
  ]},

  /* ════════════════════════════════
     3. 중문
  ════════════════════════════════ */
  "중문": { items: [
    { id:"door_4f",  n:"초슬림 3연동",  d:"490,000원",  type:"simple", u:"개", p:490000 },
    { id:"door_sw1", n:"스윙 외도어",   d:"660,000원",  type:"simple", u:"개", p:660000 },
    { id:"door_sw2", n:"스윙 양개도어", d:"730,000원",  type:"simple", u:"개", p:730000 },
    { id:"door_sl",  n:"원슬라이딩",   d:"550,000원",  type:"simple", u:"개", p:550000 },
    { id:"door_4s",  n:"4연동",         d:"980,000원",  type:"simple", u:"개", p:980000 },
    // 구분선
    { id:"door_divider", n:"", d:"", type:"divider" },
    // 추가 옵션
    { id:"door_opt_size",   n:"옵션 — 사이즈 추가", d:"1개당 30,000원",  type:"stepper", u:"개", p:30000 },
    { id:"door_opt_band",   n:"옵션 — 띠장 추가",   d:"20,000원",        type:"simple",  u:"개", p:20000 },
    {
      id:"door_opt_glass", n:"옵션 — 유리 종류", d:"모루세로 3만 / 샤틴 6만 / 부식망입 6만 / 망입 10만",
      type:"select-price",
      options:[
        {label:"선택 안함", p:0},
        {label:"모루세로",  p:30000},
        {label:"샤틴",      p:60000},
        {label:"부식망입",  p:60000},
        {label:"망입",      p:100000},
      ]
    },
    { id:"door_opt_design", n:"옵션 — 디자인 추가", d:"50,000원",       type:"simple",  u:"개", p:50000 },
    {
      id:"door_opt_color", n:"옵션 — 색상 추가", d:"3만 / 5만 / 8만",
      type:"select-price",
      options:[
        {label:"선택 안함", p:0},
        {label:"색상추가 3만", p:30000},
        {label:"색상추가 5만", p:50000},
        {label:"색상추가 8만", p:80000},
      ]
    },
    { id:"door_opt_gansal",  n:"옵션 — 간살",   d:"400,000원", type:"simple", u:"식", p:400000 },
    { id:"door_opt_damper",  n:"옵션 — 댐퍼",   d:"130,000원", type:"simple", u:"식", p:130000 },
    { id:"door_opt_labor",   n:"옵션 — 인건비", d:"금액 직접 입력", type:"input", u:"원" },
    { id:"door_extra", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },
  ]},

  /* ════════════════════════════════
     4. 목공
  ════════════════════════════════ */
  "목공": { items: [
    // 인건비
    { id:"carp_labor", n:"인건비", d:"1품당 350,000원 — 품 수 선택", type:"stepper", u:"품", p:350000 },

    // ── 예림 / 영림 더도어 ──
    { id:"carp_divider1", n:"", d:"", type:"divider", label:"예림 / 영림 더도어" },
    { id:"carp_door_only", n:"문만",              d:"250,000원/개",   type:"stepper", u:"개",  p:287500 },
    { id:"carp_door_set",  n:"세트 (문+문틀 12mm)", d:"450,000원/세트", type:"stepper", u:"세트", p:517500 },

    // ── 추가 옵션 ──
    { id:"carp_divider2", n:"", d:"", type:"divider", label:"추가 옵션" },
    { id:"carp_yerim_punch", n:"타공문",   d:"300,000원/개", type:"stepper", u:"개", p:345000 },
    { id:"carp_yerim_custom",n:"그외 색상", d:"20,000원/개",  type:"stepper", u:"개", p:20000  },
    { id:"carp_young_hp",    n:"HP",       d:"30,000원/개",  type:"stepper", u:"개", p:34500  },

    // ── 목공 작업 ──
    { id:"carp_divider3", n:"", d:"", type:"divider", label:"목공 작업" },
    { id:"carp_artwall",  n:"아트월 (반매립장)", d:"800,000원",       type:"simple",  u:"식", p:920000 },
    { id:"carp_insul",    n:"단열",              d:"1면당 300,000원", type:"stepper", u:"면", p:345000 },

    { id:"carp_extra", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },
  ]},

  /* ════════════════════════════════
     5. 욕실 — 욕실별 타입+옵션 통합
  ════════════════════════════════ */
  "욕실": { items: [
    { id:"bath_rooms", n:"욕실 수 선택", d:"욕실 갯수를 먼저 선택하세요", type:"bath-rooms", special:true },
    { id:"bath_extra", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },
  ]},

  /* ════════════════════════════════
     6. 타일
  ════════════════════════════════ */
  "타일": { items: [
    { id:"tile_enter", n:"현관 (600×600)",  d:"250,000원",              type:"simple",  u:"식", p:250000 },
    { id:"tile_balc",  n:"발코니 (300×300)",d:"1EA당 200,000원",        type:"stepper", u:"EA", p:200000 },
    { id:"tile_kitchen",n:"주방벽 (600×600)",d:"350,000원",             type:"simple",  u:"식", p:350000 },
    { id:"tile_extra", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },
  ]},

  /* ════════════════════════════════
     7. 도배
  ════════════════════════════════ */
  "도배": { items: [
    { id:"wall_21", n:"21평 (4품)",  d:"도배지 포함 · 2,400,000원", type:"simple", u:"식", p:2400000 },
    { id:"wall_24", n:"24평 (5품)",  d:"도배지 포함 · 2,800,000원", type:"simple", u:"식", p:2800000 },
    { id:"wall_32", n:"32평 (7품)",  d:"도배지 포함 · 3,400,000원", type:"simple", u:"식", p:3400000 },
    { id:"wall_42", n:"42평 (9품)",  d:"도배지 포함 · 3,800,000원", type:"simple", u:"식", p:3800000 },
    { id:"wall_48", n:"48평 (10품)", d:"도배지 포함 · 4,400,000원", type:"simple", u:"식", p:4400000 },
    { id:"wall_add",  n:"품 추가",    d:"1품당 300,000원", type:"stepper", u:"품", p:300000 },
    { id:"wall_paper_name", n:"도배지명 메모", d:"사용할 도배지 브랜드/제품명 입력", type:"wall-paper-name", special:true },
    { id:"wall_extra", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },
  ]},
  /* ════════════════════════════════
     9. 마루
  ════════════════════════════════ */
  "마루": { items: [

    // ── LX하우시스 (LG) ──
    { id:"fx_lx_div", n:"", d:"", type:"divider", label:"LX하우시스 (LG)" },
    { id:"f1",  n:"강마루 강그린프로",    d:"LX · 95x800x6.0T",                  u:"평", p:100600,  type:"pyung-unit", pyAuto:true },
    { id:"f2",  n:"강마루 강그린슈퍼",    d:"LX · 95x800x6.0T",                  u:"평", p:112100, type:"pyung-unit", pyAuto:true },
    { id:"f3",  n:"강마루 강그린와이드",  d:"LX · 125x1200x7.5T",                u:"평", p:117900, type:"pyung-unit", pyAuto:true },
    { id:"f4",  n:"강마루 강그린사각",    d:"LX · 295x595x7.5T",                 u:"평", p:127600, type:"pyung-unit", pyAuto:true },
    { id:"f5",  n:"강마루 강그린프로맥스",d:"LX · 165x1200x7.0T",                u:"평", p:117300, type:"pyung-unit", pyAuto:true },
    { id:"f6",  n:"프리미엄합판 165",     d:"LX · 165x1200x7.5T",                u:"평", p:127600, type:"pyung-unit", pyAuto:true },
    { id:"f7",  n:"프리미엄합판 사각400", d:"LX · 395x790x7.8T (신제품)",        u:"평", p:134600, type:"pyung-unit", pyAuto:true },
    { id:"f8",  n:"에디톤 바닥재 4P",     d:"LX · 450x900x5.0T",                 u:"평", p:142600, type:"pyung-unit", pyAuto:true },
    { id:"f9",  n:"에디톤 정사각/스퀘어", d:"LX · 600x600x5.0T",                 u:"평", p:158700, type:"pyung-unit", pyAuto:true },
    { id:"f10", n:"에디톤 마루",          d:"LX · 180x1220x5.0T",                u:"평", p:149500, type:"pyung-unit", pyAuto:true },

    // ── 동화마루 ──
    { id:"fx_dh_div", n:"", d:"", type:"divider", label:"동화마루" },
    { id:"f11", n:"나투스강 오리진 (95x800x7.5)", d:"동화 · 자재+시공",          u:"평", p:154100, type:"pyung-unit", pyAuto:true },
    { id:"f11b",n:"나투스강 강포레 (95x800x6)",   d:"동화 · 자재+시공",          u:"평", p:142600, type:"pyung-unit", pyAuto:true },
    { id:"f11c",n:"나투스강 듀오 (115x800x7.5)",  d:"동화 · 자재+시공",          u:"평", p:140300, type:"pyung-unit", pyAuto:true },
    { id:"f12", n:"나투스강 듀오텍스처",           d:"동화 · 자재+시공",          u:"평", p:169000, type:"pyung-unit", pyAuto:true },
    { id:"f12b",n:"나투스강 듀오텍스처 맥스",      d:"동화 · 자재+시공",          u:"평", p:193200, type:"pyung-unit", pyAuto:true },
    { id:"f12c",n:"나투스강 텍스처 (143x1205x7.5)",d:"동화 · 자재+시공",         u:"평", p:163300, type:"pyung-unit", pyAuto:true },
    { id:"f13", n:"강 스퀘어 직각 (597x597x9.5)", d:"동화 · 0.9평 포장단위",     u:"평", p:196600, type:"pyung-unit", pyAuto:true },
    { id:"f13b",n:"강 스퀘어 직각 (597x1205x9.5)",d:"동화 · 자재+시공",          u:"평", p:186300, type:"pyung-unit", pyAuto:true },
    { id:"f14", n:"나투스 진 그란데 (325x805x7)", d:"동화 · 진마루",              u:"평", p:136800, type:"pyung-unit", pyAuto:true },
    { id:"f14b",n:"나투스 진 테라 (161x1205x7)",  d:"동화 · 진마루",              u:"평", p:136800, type:"pyung-unit", pyAuto:true },
    { id:"f15", n:"진그란데 스퀘어직각",           d:"동화 · 시공포함",            u:"평", p:163300, type:"pyung-unit", pyAuto:true },
    { id:"f15b",n:"진그란데 스퀘어 어징",          d:"동화 · 자재+시공",           u:"평", p:170200, type:"pyung-unit", pyAuto:true },
    { id:"f16", n:"강화마루 클릭 (190x1200x8)",   d:"동화 · 강화마루",             u:"평", p:97700,  type:"pyung-unit", pyAuto:true },
    { id:"f16b",n:"강화마루 클릭S (190x1200x7)",  d:"동화 · 강화마루",             u:"평", p:96600,  type:"pyung-unit", pyAuto:true },

    // ── 이건마루 ──
    { id:"fx_ik_div", n:"", d:"", type:"divider", label:"이건마루" },
    { id:"ik1", n:"구정 강마루",              d:"이건 · 전수종 · 115,000원/평",   u:"평", p:132200, type:"pyung-unit", pyAuto:true },
    { id:"ik2", n:"115폭 모던강마루",         d:"이건 · 전수종 · 105,000원/평",   u:"평", p:120700, type:"pyung-unit", pyAuto:true },
    { id:"ik3", n:"브러쉬 골드 (천연무늬목)", d:"이건 · 티크스카치/티크러스틱",   u:"평", p:184000, type:"pyung-unit", pyAuto:true },
    { id:"ik4", n:"브러쉬 골드 기타수종",     d:"이건 · 애쉬아몬드/오크클레식 등", u:"평", p:172500, type:"pyung-unit", pyAuto:true },
    { id:"ik5", n:"프레스티지 (천연무늬목)",  d:"이건 · 티크/러스틱윌넛",         u:"평", p:189700, type:"pyung-unit", pyAuto:true },
    { id:"ik6", n:"프레스티지 기타수종",      d:"이건 · 그외 수종",                u:"평", p:178200, type:"pyung-unit", pyAuto:true },
    { id:"ik7", n:"블론테",                   d:"이건 · 전수종",                   u:"평", p:189700, type:"pyung-unit", pyAuto:true },
    { id:"ik8", n:"165 그랜드텍스처",         d:"이건 · 전수종",                   u:"평", p:143800, type:"pyung-unit", pyAuto:true },
    { id:"ik9", n:"115 프리미엄 텍스처",      d:"이건 · 전수종",                   u:"평", p:141400, type:"pyung-unit", pyAuto:true },

    // ── 구정마루 ──
    { id:"fx_gj_div", n:"", d:"", type:"divider", label:"구정마루" },
    { id:"gj1", n:"강마루 헤링본 (오크,허니티크 등)", d:"구정 · 자재+시공",        u:"평", p:172500, type:"pyung-unit", pyAuto:true },
    { id:"gj2", n:"해링본 브러쉬 골드 티크",  d:"구정 · 천연무늬목",               u:"평", p:218500, type:"pyung-unit", pyAuto:true },
    { id:"gj3", n:"해링본 브러쉬 골드 기타",  d:"구정 · 천연무늬목",               u:"평", p:207000, type:"pyung-unit", pyAuto:true },
    { id:"gj4", n:"마블러스 리브 (393x797x7.7t)", d:"구정 · 자재+시공",           u:"평", p:147200, type:"pyung-unit", pyAuto:true },
    { id:"gj5", n:"마블러스 뮤즈 (393x1200x7.7t)",d:"구정 · 자재+시공",           u:"평", p:161000, type:"pyung-unit", pyAuto:true },
    { id:"gj6", n:"마블러스 젠 (597x597x8.7t)",   d:"구정 · 자재+시공",           u:"평", p:176000, type:"pyung-unit", pyAuto:true },
    { id:"gj7", n:"마블러스 듀스 (597x1210x8.7t)",d:"구정 · 자재+시공",           u:"평", p:201200, type:"pyung-unit", pyAuto:true },
    { id:"gj8", n:"마블러스 엘 (900x900x8.7t)",   d:"구정 · 자재+시공",           u:"평", p:241500, type:"pyung-unit", pyAuto:true },

    // ── 공통 시공 ──
    { id:"fx_etc_div", n:"", d:"", type:"divider", label:"시공 공통" },
    { id:"f19", n:"기본 시공비",          d:"기본 진입비용 (10평 기준)",           u:"식", p:250000, type:"simple" },
    // ── 장판·데코 ──
    { id:"fx_jp_div", n:"", d:"", type:"divider", label:"장판 · 데코타일" },
// ── LX하우시스 (LG) ──
    { id:"lf_lx_div", n:"", d:"", type:"divider", label:"LX하우시스 (LG)" },
    { id:"lf1",  n:"뉴청맥 1.8T 장판",        d:"LX 시트 · 자재+시공",          u:"평", p:31700,  type:"pyung-unit", pyAuto:true },
    { id:"lf2",  n:"은행목 2.0T 장판",         d:"LX 시트 · 자재+시공",          u:"평", p:45500,  type:"pyung-unit", pyAuto:true },
    { id:"lf3",  n:"지아자연애 2.2T",          d:"LX 시트 · 자재+시공",          u:"평", p:59900,  type:"pyung-unit", pyAuto:true },
    { id:"lf4",  n:"지아사랑애 2.7T",          d:"LX 시트 · 자재+시공",          u:"평", p:85800,  type:"pyung-unit", pyAuto:true },
    { id:"lf4b", n:"지아사랑애 3.2T",          d:"LX 시트 · 자재+시공",          u:"평", p:98200,  type:"pyung-unit", pyAuto:true },
    { id:"lf4c", n:"지아소리잠 4.5T",          d:"LX 시트 · 자재+시공",          u:"평", p:114200,  type:"pyung-unit", pyAuto:true },
    { id:"lf5",  n:"엑스컴포트 5.0T",          d:"LX 시트 · 자재+시공",          u:"평", p:130600, type:"pyung-unit", pyAuto:true },
    { id:"lf6",  n:"보타닉 데코타일",          d:"LX · 450x450x3.0T · 자재+시공", u:"평", p:51700,  type:"pyung-unit", pyAuto:true },
    { id:"lf7",  n:"에코노플러스 데코타일",    d:"LX · 450x450x3.0T · 자재+시공", u:"평", p:63800,  type:"pyung-unit", pyAuto:true },
    { id:"lf8",  n:"하우스 스타일 데코타일",   d:"LX · 600x600x3.0T · 자재+시공", u:"평", p:77000,  type:"pyung-unit", pyAuto:true },
    { id:"lf10", n:"프레스티지 스톤",          d:"LX · S(T)600x600 · 자재+시공",  u:"평", p:90800,  type:"pyung-unit", pyAuto:true },

    // ── 대진장판 ──
    { id:"lf_dj_div", n:"", d:"", type:"divider", label:"대진장판" },
    { id:"dj1",  n:"대진장판 1.8T (롤)",       d:"대진 · 시공비 포함 · 22,300원/평", u:"평", p:25600,  type:"pyung-unit", pyAuto:true },
    { id:"dj2",  n:"대진장판 1.8T (절단)",      d:"대진 · 시공비 포함 · 24,100원/평", u:"평", p:27700,  type:"pyung-unit", pyAuto:true },
    { id:"dj3",  n:"대진장판 2.2T",             d:"대진 · 시공비 포함 · 36,800원/평", u:"평", p:42300,  type:"pyung-unit", pyAuto:true },
    { id:"dj4",  n:"대진장판 3.2T",             d:"대진 · 시공비 포함 · 57,700원/평", u:"평", p:66400,  type:"pyung-unit", pyAuto:true },
    { id:"dj5",  n:"대진장판 5T",               d:"대진 · 시공비 포함 · 79,700원/평", u:"평", p:91700,  type:"pyung-unit", pyAuto:true },

    // ── 대진 데코타일 ──
    { id:"lf_djd_div", n:"", d:"", type:"divider", label:"대진 데코타일" },
    { id:"dj6",  n:"일반 데코타일",             d:"대진 데코리아 · 시공비 포함",      u:"평", p:40200,  type:"pyung-unit", pyAuto:true },
    { id:"dj7",  n:"600각/470각 유광 (4칼라)",  d:"대진 데코리아 · 시공비 포함",      u:"평", p:41400,  type:"pyung-unit", pyAuto:true },
    { id:"dj8",  n:"고급 하우스 데코타일",      d:"대진 데코리아 · 시공비 포함",      u:"평", p:55200,  type:"pyung-unit", pyAuto:true },
    { id:"dj9",  n:"OA타일 (대전방지용)",       d:"대진 데코리아 · 시공비 포함",      u:"평", p:82800,  type:"pyung-unit", pyAuto:true },

    { id:"floor_extra", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },
  ]},  /* ════════════════════════════════
     12. 전기·조명
  ════════════════════════════════ */
  "전기·조명": { items: [
    // 평형별 패키지 선택
    { id:"elec_pkg", n:"전기·조명 패키지", d:"평형에 따라 자동 단가 적용", type:"elec-pkg", special:true },

    // 추가 공사 (별도)
    { id:"elx_div", n:"", d:"", type:"divider", label:"추가 공사 (별도)" },
    { id:"e_up",   n:"승압",                     d:"500,000원",              u:"식", p:500000,  type:"simple"  },
    { id:"e_con",  n:"콘센트 신설",               d:"15만/개소",              u:"개소",p:150000, type:"stepper" },
    { id:"e_sw",   n:"스위치 신설",               d:"10만/개소",              u:"개소",p:100000, type:"stepper" },
    { id:"e_line", n:"전기 신규 입선",            d:"20만/회로",              u:"회로",p:200000, type:"stepper" },
    { id:"e_ind",  n:"인덕션 배선",               d:"200,000원",              u:"식", p:200000,  type:"simple"  },
    { id:"e_pan",  n:"분전함 교체",               d:"250,000원",              u:"식", p:250000,  type:"simple"  },
    { id:"e_brk",  n:"차단기 교체",               d:"250,000원",              u:"식", p:250000,  type:"simple"  },
    { id:"e_wall", n:"벽까기",                    d:"10만/개소",              u:"개소",p:100000, type:"stepper" },
    { id:"elec_extra", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },
  ]},

  /* ════════════════════════════════
     13. 가구·설비
  ════════════════════════════════ */
  "가구·설비": { items: [
    { id:"fu1",  n:"싱크대 예림 기본형",    d:"주방가구 예림 기준",    u:"식",   p:2800000, type:"simple" },
    { id:"fu2",  n:"싱크대 예림 프리미엄",  d:"듀이클라우드+상판 포함",u:"식",   p:4200000, type:"simple" },
    { id:"fu3",  n:"인조대리석 상판",       d:"현대 아틱아이스 기준",  u:"식",   p:900000,  type:"simple" },
    { id:"fu4",  n:"후드 하츠 침니",        d:"설치비 포함",           u:"개",   p:400000,  type:"stepper"},
    { id:"fu5",  n:"사각볼+수전 하츠",      d:"세트",                  u:"세트", p:400000,  type:"simple" },
    { id:"fu6",  n:"신발장 중/하부 조명",   d:"제작+설치",             u:"식",   p:800000,  type:"simple" },
    { id:"fu7",  n:"붙박이장 철거",         d:"개당",                  u:"개",   p:200000,  type:"stepper"},
    { id:"fu8",  n:"싱크대 배관 철거",      d:"기존 배관 철거",        u:"식",   p:150000,  type:"simple" },
    { id:"fu9",  n:"실리콘 마감 전체",      d:"집 전체 실리콘 마감",   u:"식",   p:350000,  type:"simple" },
    { id:"fu10", n:"탄성코트 발코니",       d:"프리미엄 탄성코팅",     u:"개소", p:450000,  type:"stepper"},
    { id:"furn_extra", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },
  ]},

  /* ════════════════════════════════
     14. 기타
  ════════════════════════════════ */
  "기타": { items: [
    { id:"etc1", n:"잡비 (식대·부자재·유류비)", d:"현장 잡비",              u:"식", p:500000,  type:"simple"  },
    { id:"etc2", n:"업체 이윤 (공사금액 10%)",  d:"합계의 10% 자동 계산",   u:"식", p:0, pct:0.1 },
    { id:"etc3", n:"입주청소",                   d:"기본 입주청소",           u:"식", p:300000,  type:"simple"  },
    { id:"etc4", n:"공사신고+보양비",            d:"승강기 사용료+보양비",    u:"식", p:300000,  type:"simple"  },
    { id:"etc5", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },
    { id:"etc_nego", n:"네고 / 할인", d:"마이너스(-) 금액 입력 — 총액에서 차감", type:"nego", special:true },
  ]},
  /* ════════════════════════════════
     양우아파트 — 풀 견적 패키지
     32평 기준, 카테고리별 쭉 선택
  ════════════════════════════════ */
  "양우아파트": { items: [

    // ── 1. 철거 ──
    { id:"yw_div1", n:"", d:"", type:"divider", label:"① 철거" },
    { id:"yw_dem_labor",n:"인건비",       d:"철거 인건비 — 1품당 250,000원",   type:"stepper", u:"품", p:250000 },
    { id:"yw_dem1",  n:"가구 철거",       d:"신발장·싱크대·거실장 등",          type:"simple",  u:"식", p:1500000 },
    { id:"yw_dem2",  n:"목공 철거",       d:"몰딩·욕실문·천정 등 기본 철거",   type:"simple",  u:"식", p:500000  },
    { id:"yw_dem3",  n:"마루 철거",       d:"거실 강마루/장판 철거",            type:"simple",  u:"식", p:300000  },
    { id:"yw_dem4",  n:"거실 욕실 철거",  d:"기본 철거 (덧방 포함)",            type:"simple",  u:"식", p:700000  },
    { id:"yw_dem5",  n:"안방 욕실 철거",  d:"기본 철거 (덧방 포함)",            type:"simple",  u:"식", p:600000  },
    { id:"yw_dem_bdr",n:"욕실 올철거",    d:"타일 완전 철거 + 방수 포함",       type:"stepper", u:"실", p:800000  },
    { id:"yw_dem6",  n:"폐기물 (2대)",    d:"1톤 트럭 2대 기준",                type:"simple",  u:"식", p:900000  },
    { id:"yw_dem7",  n:"폐기물 (3대)",    d:"1톤 트럭 3대 기준",                type:"simple",  u:"식", p:1350000 },
    { id:"yw_ex1", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },

    // ── 2. 설비 ──
    { id:"yw_div2", n:"", d:"", type:"divider", label:"② 설비" },
    { id:"yw_plm1",  n:"싱크대 수도",     d:"싱크대 수도 내림/올림",            type:"simple",  u:"식", p:150000  },
    { id:"yw_plm2",  n:"욕실 배관",       d:"욕실 배관 개당 350,000원",         type:"stepper", u:"개", p:350000  },
    { id:"yw_plm3",  n:"우수관 방수",     d:"개당 250,000원",                   type:"stepper", u:"개", p:250000  },
    { id:"yw_plm4",  n:"우수관 교체",     d:"개당 350,000원",                   type:"stepper", u:"개", p:350000  },
    { id:"yw_plm5",  n:"거실 확장 (단열포함)", d:"2,500,000원",                type:"simple",  u:"식", p:2500000 },
    { id:"yw_plm6",  n:"방 확장 (단열포함)",   d:"개당 2,000,000원",           type:"stepper", u:"개", p:2000000 },
    { id:"yw_ex2", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },

    // ── 3. 창호 ──
    { id:"yw_div3a", n:"", d:"", type:"divider", label:"③ 창호" },
    { id:"yw_win1",  n:"발코니이중창 2W", d:"VBF242-4TM 26T 로이유리 자동핸들4P", type:"stepper", u:"개", p:1557444 },
    { id:"yw_win2",  n:"발코니이중창 3W", d:"VBF242-4TM 26T 로이유리 자동핸들4P", type:"stepper", u:"개", p:2316444 },
    { id:"yw_win3",  n:"이중창 2W",       d:"VBF230-4PM 24T 투명 크리센트",     type:"stepper", u:"개", p:630000  },
    { id:"yw_win4",  n:"공틀단창",        d:"UBF225TM 24T 투명유리 크리센트",   type:"stepper", u:"개", p:587500  },
    { id:"yw_win5",  n:"창호 철거비",     d:"기존 창호 철거 + 폐기물",          type:"simple",  u:"식", p:400000  },
    { id:"yw_win6",  n:"방범창 900×1200", d:"고구려시스템",                     type:"stepper", u:"개", p:329000  },
    { id:"yw_win7",  n:"방범창 거실 1200×2100",d:"고구려시스템",               type:"stepper", u:"개", p:467000  },
    { id:"yw_ex3", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },

    // ── 4. 중문 ──
    { id:"yw_div3", n:"", d:"", type:"divider", label:"④ 중문" },
    { id:"yw_mid1",  n:"초슬림 3연동",    d:"490,000원",                        type:"simple",  u:"개", p:490000  },
    { id:"yw_mid2",  n:"스윙 외도어",     d:"660,000원",                        type:"simple",  u:"개", p:660000  },
    { id:"yw_mid3",  n:"스윙 양개도어",   d:"730,000원",                        type:"simple",  u:"개", p:730000  },
    { id:"yw_mid4",  n:"원슬라이딩",      d:"550,000원",                        type:"simple",  u:"개", p:550000  },
    { id:"yw_mid5",  n:"4연동",           d:"980,000원",                        type:"simple",  u:"개", p:980000  },
    { id:"yw_mid_sz",n:"중문 사이즈 추가",d:"1개당 30,000원",                   type:"stepper", u:"개", p:30000   },
    { id:"yw_mid_gn",n:"중문 간살",       d:"400,000원",                        type:"simple",  u:"식", p:400000  },
    { id:"yw_mid_dp",n:"중문 댐퍼",       d:"130,000원",                        type:"simple",  u:"식", p:130000  },
    { id:"yw_ex4", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },

    // ── 5. 목공 ──
    { id:"yw_div4", n:"", d:"", type:"divider", label:"⑤ 목공" },
    { id:"yw_carp0", n:"인건비",          d:"1품당 350,000원",                  type:"stepper", u:"품", p:350000  },
    { id:"yw_carp1", n:"문만 (예림/영림)",d:"250,000원/개",                     type:"stepper", u:"개", p:250000  },
    { id:"yw_carp1s",n:"세트 (문+문틀)",  d:"450,000원/세트",                   type:"stepper", u:"세트", p:450000},
    { id:"yw_carp1p",n:"타공문",          d:"300,000원/개",                     type:"stepper", u:"개", p:300000  },
    { id:"yw_carp2", n:"실링팬 설치",     d:"설치비 포함",                      type:"stepper", u:"개", p:120000  },
    { id:"yw_carp3", n:"몰딩",            d:"거실+방 전체 상·하단 몰딩",        type:"simple",  u:"식", p:1000000 },
    { id:"yw_carp4", n:"단열 (1면당)",    d:"외벽 목공 단열",                   type:"stepper", u:"면", p:300000  },
    { id:"yw_carp5", n:"천장 작업",       d:"공용부 천장+커튼박스",             type:"simple",  u:"식", p:600000  },
    { id:"yw_carp6", n:"아트월 (반매립장)",d:"800,000원",                        type:"simple",  u:"식", p:800000  },
    { id:"yw_ex5", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },

    // ── 6. 욕실 ──
    { id:"yw_div5", n:"", d:"", type:"divider", label:"⑥ 욕실 (거실·안방)" },
    { id:"yw_bt_pkg",n:"욕실 패키지",     d:"욕실 수와 타입 선택",              type:"bath-rooms", special:true },
    { id:"yw_bt1",   n:"욕실 타일 시공",  d:"벽 300×600 + 바닥 300×300",        type:"stepper", u:"실", p:2300000 },
    { id:"yw_bt2",   n:"양변기 (대림)",   d:"투피스 치마형 림리스",             type:"stepper", u:"개", p:294300  },
    { id:"yw_bt3",   n:"세면기 (대림)",   d:"벽붙이 세면대",                    type:"stepper", u:"개", p:167000  },
    { id:"yw_bt4",   n:"슬라이드 수납장 1200",d:"더존 댐핑 + 조명",             type:"stepper", u:"개", p:190000  },
    { id:"yw_bt5",   n:"수전금구 세트",   d:"세면·샤워수전 + 악세사리",         type:"stepper", u:"식", p:200000  },
    { id:"yw_bt5u",  n:"수전금구 업그레이드",d:"+300,000원",                     type:"stepper", u:"개", p:300000  },
    { id:"yw_bt6",   n:"환풍기 기본",     d:"일반 환풍기",                      type:"stepper", u:"개", p:100000  },
    { id:"yw_bt6u",  n:"환풍기 휴젠뜨",  d:"+300,000원 업그레이드",             type:"stepper", u:"개", p:300000  },
    { id:"yw_bt7",   n:"파티션 (조적+유리)",d:"",                               type:"stepper", u:"식", p:700000  },
    { id:"yw_bt8",   n:"천정·매입등",     d:"평돔 + 매입등",                    type:"stepper", u:"실", p:230000  },
    { id:"yw_bt9",   n:"욕조",            d:"욕조 1600×750 + 벽면 타일",        type:"stepper", u:"개", p:350000  },
    { id:"yw_bt10",  n:"젠다이 (조적)",   d:"150,000원",                        type:"stepper", u:"개", p:150000  },
    { id:"yw_bt11",  n:"해바라기 수전",   d:"150,000원",                        type:"stepper", u:"개", p:150000  },
    { id:"yw_bt12",  n:"베란다 벽면 타일",d:"베란다 옆면 타일 교체",            type:"stepper", u:"개소", p:450000 },
    { id:"yw_btw1",  n:"욕실 방수 1차",   d:"개소당 200,000원",                 type:"stepper", u:"개소", p:200000 },
    { id:"yw_btw2",  n:"욕실 방수 2~3차", d:"단독 400,000원",                   type:"stepper", u:"개소", p:400000 },
    { id:"yw_ex6", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },

    // ── 7. 타일 ──
    { id:"yw_div7", n:"", d:"", type:"divider", label:"⑦ 타일" },
    { id:"yw_tl1",   n:"현관 타일 600×600",  d:"포세린/폴리싱 기준",           type:"simple",  u:"식", p:250000  },
    { id:"yw_tl2",   n:"주방벽 타일 600×600",d:"포세린 기준",                  type:"simple",  u:"식", p:350000  },
    { id:"yw_tl3",   n:"발코니 타일",        d:"EA당 200,000원",               type:"stepper", u:"EA", p:200000  },
    { id:"yw_ex7", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },

    // ── 8. 도배 ──
    { id:"yw_div8", n:"", d:"", type:"divider", label:"⑧ 도배" },
    { id:"yw_wp1",   n:"32평 (7품) — 도배지 포함", d:"340,000원",              type:"simple",  u:"식", p:3400000 },
    { id:"yw_wp2",   n:"42평 (9품) — 도배지 포함", d:"380,000원",              type:"simple",  u:"식", p:3800000 },
    { id:"yw_wp3",   n:"품 추가",           d:"1품당 300,000원",               type:"stepper", u:"품", p:300000  },
    { id:"yw_ex8", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },

    // ── 9. 마루·바닥재 ──
    { id:"yw_div9", n:"", d:"", type:"divider", label:"⑨ 마루 · 바닥재" },
    { id:"yw_fl1",   n:"LX 강그린프로",    d:"95x800x6.0T 시공포함",           type:"simple",  u:"식", p:2870000 },
    { id:"yw_fl2",   n:"LX 강그린슈퍼",    d:"95x800x6.0T 시공포함",           type:"simple",  u:"식", p:3033000 },
    { id:"yw_fl3",   n:"동화 나투스 진",   d:"그란데 시공포함 (32평 기준)",     type:"simple",  u:"식", p:3808000 },
    { id:"yw_fl4",   n:"동화 나투스강",    d:"강포레6T 시공포함",              type:"simple",  u:"식", p:3968000 },
    { id:"yw_fl5",   n:"이건 강마루",      d:"전수종 시공포함",                type:"simple",  u:"식", p:3680000 },
    { id:"yw_fl6",   n:"구정 마블러스 젠", d:"597x597x8.7T 시공포함",          type:"simple",  u:"식", p:4896000 },
    { id:"yw_fl7",   n:"대진장판 2.2T",    d:"드림크리마 마필 시공포함",        type:"simple",  u:"식", p:1177600 },
    { id:"yw_fl8",   n:"대진장판 3.2T",    d:"시공포함",                       type:"simple",  u:"식", p:1846400 },
    { id:"yw_fl9",   n:"LX 지아자연애 2.2T장판",d:"시공포함",                  type:"simple",  u:"식", p:1667200 },
    { id:"yw_ex9", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },

    // ── 10. 전기·조명 ──
    { id:"yw_div10", n:"", d:"", type:"divider", label:"⑩ 전기·조명" },
    { id:"yw_el_pkg",n:"전기·조명 패키지", d:"평형별 자동 단가",               type:"elec-pkg", special:true },
    { id:"yw_el1",   n:"전등 전체",        d:"LED 엣지·매립등·베란다·현관",   type:"simple",  u:"식", p:2700000 },
    { id:"yw_el2",   n:"스위치·콘센트 교체",d:"전체 국산 프리미엄",            type:"simple",  u:"식", p:900000  },
    { id:"yw_el3",   n:"인덕션 라인",      d:"라인 신설 + 콘센트 2구",         type:"simple",  u:"식", p:200000  },
    { id:"yw_el4",   n:"소방 감지기",      d:"감지기4+주방화재1+가스1",         type:"simple",  u:"식", p:250000  },
    { id:"yw_el5",   n:"실링팬",           d:"설치비 포함",                    type:"stepper", u:"개", p:120000  },
    { id:"yw_el6",   n:"콘센트 신설",      d:"15만/개소",                      type:"stepper", u:"개소", p:150000 },
    { id:"yw_el7",   n:"스위치 신설",      d:"10만/개소",                      type:"stepper", u:"개소", p:100000 },
    { id:"yw_ex10", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },

    // ── 11. 가구·설비 ──
    { id:"yw_div11", n:"", d:"", type:"divider", label:"⑪ 가구·설비" },
    { id:"yw_fu1",   n:"싱크대 기본형",    d:"예림 + 현대 상판",               type:"simple",  u:"식", p:2800000 },
    { id:"yw_fu1p",  n:"싱크대 프리미엄",  d:"예림 듀이클라우드 + 현대 상판",  type:"simple",  u:"식", p:4200000 },
    { id:"yw_fu2",   n:"주방 악세사리",    d:"사각볼·거위목·후드·인덕션(하츠)", type:"simple",  u:"식", p:400000  },
    { id:"yw_fu3",   n:"신발장",           d:"중·하부 + 조명",                 type:"simple",  u:"식", p:800000  },
    { id:"yw_fu4",   n:"붙박이장",         d:"제작+설치",                      type:"stepper", u:"개", p:500000  },
    { id:"yw_fu5",   n:"탄성 코트",        d:"발코니 1개소 프리미엄 세라믹",    type:"stepper", u:"개소", p:450000 },
    { id:"yw_ex11", n:"기타 / 네고", d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },

    // ── 12. 기타 ──
    { id:"yw_div13", n:"", d:"", type:"divider", label:"⑫ 기타" },
    { id:"yw_etc1",  n:"공사 신고·보양비", d:"주민동의·엘리베이터·동선 보양",  type:"simple",  u:"식", p:300000  },
    { id:"yw_etc2",  n:"실리콘 마감",      d:"전체 실리콘 마감",               type:"simple",  u:"식", p:350000  },
    { id:"yw_etc3",  n:"잡비",             d:"식대·부자재·유류비",             type:"simple",  u:"식", p:500000  },
    { id:"yw_etc4",  n:"입주청소",         d:"기본 입주청소",                   type:"simple",  u:"식", p:300000  },
    { id:"yw_etc5",  n:"업체 이윤 10%",    d:"공사대금의 10% 자동",             type:"simple",  u:"식", p:0, pct:0.1 },
    { id:"yw_extra", n:"기타 / 네고",      d:"수기 메모 + 금액 입력 · 네고 마이너스 처리", type:"cat-extra", special:true },
  ]},

};

/* 마루 철거 세부 단가 (floor-demo 전용) */
const FLOOR_DEMO_TYPES = [
  { id:"fd_ganghwa_only", n:"강마루 철거",             p:25000 },
  { id:"fd_ganghwa_sand", n:"강마루 철거 후 샌딩",     p:28000 },
  { id:"fd_ganghwa",      n:"강화마루 철거",           p:18000 },
  { id:"fd_deco",         n:"데코타일 철거",           p:20000 },
  { id:"fd_polish",       n:"폴리싱타일 철거",         p:65000 },
];
