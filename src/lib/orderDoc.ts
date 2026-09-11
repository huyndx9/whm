import type { Ingredient, PurchaseOrder, Supplier } from "../types";
import { downloadCsvRows } from "./csv";
import { formatDate, formatNumber, todayIso } from "./format";

export interface OrderDocInput {
  order: PurchaseOrder;
  supplier: Supplier | undefined;
  restaurantName: string;
  ingredientById: (id: string) => Ingredient | undefined;
}

interface DocLine {
  no: number;
  name: string;
  note: string;
  quantity: string;
  unit: string;
}

function buildLines({ order, ingredientById }: OrderDocInput): DocLine[] {
  return order.lines.map((line, index) => {
    const ing = ingredientById(line.ingredientId);
    return {
      no: index + 1,
      name: ing?.name ?? "삭제된 품목",
      note: ing?.note ?? "",
      quantity: formatNumber(line.quantity),
      unit: ing?.unit ?? "",
    };
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 인쇄와 파일 저장이 같은 결과가 되도록 발주서를 하나의 HTML 문서로 만든다.
 *
 * 단가·금액 칸은 비워 둔다. 수산물은 시세가 매일 바뀌어 값은 공급업체가 정하는 것이
 * 맞고, 우리가 미리 적어 보내면 오히려 혼선이 생긴다. 실제 단가는 물건이 들어온 뒤
 * 영수증을 스캔하면서 기록된다.
 */
export function buildPurchaseOrderHtml(input: OrderDocInput): string {
  const { order, supplier, restaurantName } = input;
  const lines = buildLines(input);
  const totalQty = order.lines.reduce((a, l) => a + l.quantity, 0);

  // 손으로 적어 넣을 여유 칸을 몇 줄 남겨 둔다
  const blankRows = Math.max(0, 8 - lines.length);

  const rowsHtml = lines
    .map(
      (l) => `
        <tr>
          <td class="c">${l.no}</td>
          <td class="name">${escapeHtml(l.name)}</td>
          <td class="muted">${escapeHtml(l.note)}</td>
          <td class="r strong">${escapeHtml(l.quantity)}</td>
          <td class="c">${escapeHtml(l.unit)}</td>
          <td class="fill"></td>
          <td class="fill"></td>
          <td class="fill"></td>
        </tr>`,
    )
    .join("");

  const blankHtml = Array.from({ length: blankRows })
    .map(
      () => `
        <tr class="blank">
          <td class="c">&nbsp;</td><td></td><td></td><td></td>
          <td></td><td class="fill"></td><td class="fill"></td><td class="fill"></td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>발주서 ${escapeHtml(order.code)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px;
    background: #f4f4f2;
    color: #111827;
    font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
    font-size: 13px;
    line-height: 1.5;
  }
  .sheet {
    max-width: 780px;
    margin: 0 auto;
    background: #fff;
    padding: 32px 30px 28px;
    border: 1px solid #d7d7d2;
  }
  h1 {
    margin: 0 0 4px;
    font-size: 26px;
    letter-spacing: 14px;
    text-align: center;
    font-weight: 700;
  }
  .rule { height: 3px; background: #0f4c5c; margin: 10px 0 20px; }
  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border: 1px solid #d7d7d2;
    border-bottom: 0;
    margin-bottom: 20px;
  }
  .meta .row { display: flex; border-bottom: 1px solid #d7d7d2; min-width: 0; }
  .meta .row + .row { border-left: 1px solid #d7d7d2; }
  .meta .k {
    flex: none;
    width: 92px;
    padding: 7px 10px;
    background: #f3f5f6;
    font-weight: 600;
    color: #4b5563;
    white-space: nowrap;
  }
  .meta .v { flex: 1; padding: 7px 10px; min-width: 0; }
  .items-wrap { overflow-x: auto; }
  table.items {
    width: 100%;
    min-width: 620px;
    border-collapse: collapse;
    table-layout: fixed;
  }
  table.items td { word-break: keep-all; overflow-wrap: anywhere; }
  table.items th, table.items td { border: 1px solid #cfcfca; padding: 8px 8px; }
  table.items th {
    background: #0f4c5c;
    color: #fff;
    font-weight: 600;
    font-size: 12px;
    white-space: nowrap;
  }
  table.items td { height: 34px; }
  .c { text-align: center; }
  .r { text-align: right; }
  .strong { font-weight: 700; }
  .name { font-weight: 600; }
  .muted { color: #6b7280; font-size: 12px; }
  /* 공급업체가 채워 넣을 칸 */
  .fill { background: #fcfcf8; }
  tr.blank td { color: #cfcfca; }
  tfoot td {
    background: #f3f5f6;
    font-weight: 700;
  }
  .notes { margin-top: 16px; font-size: 12px; color: #4b5563; }
  .notes p { margin: 4px 0; }
  .sign { margin-top: 26px; display: flex; justify-content: flex-end; gap: 26px; }
  .sign div { text-align: center; font-size: 12px; color: #6b7280; }
  .sign .line { width: 130px; border-bottom: 1px solid #9ca3af; height: 30px; }
  .toolbar { max-width: 780px; margin: 0 auto 14px; text-align: right; }
  .toolbar button {
    font: inherit;
    font-weight: 600;
    padding: 9px 16px;
    border-radius: 10px;
    border: 0;
    background: #0f4c5c;
    color: #fff;
    cursor: pointer;
  }
  @media (max-width: 820px) {
    body { padding: 10px; }
    .sheet { padding: 18px 14px; }
    h1 { font-size: 20px; letter-spacing: 7px; }
    .meta .k, .meta .v { padding: 5px 7px; font-size: 12px; }
    .meta .k { width: 76px; }
    table.items th { font-size: 11px; padding: 6px 4px; }
    table.items td { font-size: 12px; padding: 6px 4px; height: 30px; }
  }
  @media (max-width: 560px) {
    .meta { grid-template-columns: 1fr; }
    .meta .row + .row { border-left: 0; }
    .toolbar { max-width: none; }
  }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { border: 0; padding: 0; max-width: none; }
    .toolbar { display: none !important; }
    .items-wrap { overflow: visible; }
    table.items { min-width: 0; }
    .meta { grid-template-columns: 1fr 1fr; }
    .meta .row + .row { border-left: 1px solid #d7d7d2; }
  }
</style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">인쇄 / PDF 저장</button></div>
  <div class="sheet">
    <h1>발주서</h1>
    <div class="rule"></div>

    <div class="meta">
      <div class="row"><span class="k">공급업체</span><span class="v">${escapeHtml(supplier?.name ?? "")}</span></div>
      <div class="row"><span class="k">발주 번호</span><span class="v">${escapeHtml(order.code)}</span></div>
      <div class="row"><span class="k">연락처</span><span class="v">${escapeHtml(supplier?.phone ?? "")}</span></div>
      <div class="row"><span class="k">발주일</span><span class="v">${escapeHtml(formatDate(todayIso()))}</span></div>
      <div class="row"><span class="k">주문 매장</span><span class="v">${escapeHtml(restaurantName)}</span></div>
      <div class="row"><span class="k">희망 입고일</span><span class="v"><strong>${escapeHtml(formatDate(order.expectedDate))}</strong></span></div>
    </div>

    <div class="items-wrap">
    <table class="items">
      <thead>
        <tr>
          <th style="width:6%">번호</th>
          <th style="width:21%">원재료명</th>
          <th style="width:21%">품목 설명</th>
          <th style="width:11%">발주 수량</th>
          <th style="width:8%">단위</th>
          <th style="width:11%">단가</th>
          <th style="width:13%">금액</th>
          <th style="width:9%">비고</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}${blankHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" class="c">합계</td>
          <td class="r">${escapeHtml(formatNumber(totalQty))}</td>
          <td></td>
          <td class="fill"></td>
          <td class="fill"></td>
          <td class="fill"></td>
        </tr>
      </tfoot>
    </table>
    </div>

    <div class="notes">
      <p>※ 단가와 금액은 공급업체에서 기입해주세요.</p>
      <p>※ 수량 변경이 필요하면 비고란에 적어주시면 됩니다.</p>
    </div>

    <div class="sign">
      <div><div class="line"></div>담당자</div>
      <div><div class="line"></div>확인</div>
    </div>
  </div>
</body>
</html>`;
}

function fileBase(input: OrderDocInput): string {
  return `발주서-${input.supplier?.name ?? "공급업체"}-${input.order.code}`;
}

/** 보기 좋은 발주서를 HTML 파일로 저장 (브라우저에서 열면 인쇄·PDF 저장 가능) */
export function downloadPurchaseOrderHtml(input: OrderDocInput): void {
  const blob = new Blob([buildPurchaseOrderHtml(input)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase(input)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 새 창에서 발주서를 열고 바로 인쇄 창을 띄운다 */
export function printPurchaseOrder(input: OrderDocInput): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.write(buildPurchaseOrderHtml(input));
  win.document.close();
  win.focus();
  // 글꼴과 표가 다 그려진 뒤에 인쇄 창을 띄운다
  win.setTimeout(() => win.print(), 350);
  return true;
}

/**
 * 엑셀로 열고 싶을 때를 위한 CSV.
 * 모든 행의 칸 수를 표 본문과 똑같이 맞춘다. 첫 줄에 쉼표가 없으면
 * 엑셀이 구분자를 못 찾아 전체를 한 칸에 몰아넣기 때문이다.
 */
export function downloadPurchaseOrderCsv(input: OrderDocInput): void {
  const { order, supplier, restaurantName } = input;
  const lines = buildLines(input);
  const COLS = 8;
  const pad = (cells: (string | number)[]): (string | number)[] => {
    const row = [...cells];
    while (row.length < COLS) row.push("");
    return row;
  };

  const rows: (string | number)[][] = [
    pad(["발주서"]),
    pad([]),
    pad(["발주 번호", order.code, "", "발주일", formatDate(todayIso())]),
    pad(["공급업체", supplier?.name ?? "", "", "희망 입고일", formatDate(order.expectedDate)]),
    pad(["연락처", supplier?.phone ?? ""]),
    pad(["주문 매장", restaurantName]),
    pad([]),
    pad(["번호", "원재료명", "품목 설명", "발주 수량", "단위", "단가", "금액", "비고"]),
    ...lines.map((l) => pad([l.no, l.name, l.note, l.quantity, l.unit])),
    pad([]),
    pad(["합계", "", "", formatNumber(order.lines.reduce((a, l) => a + l.quantity, 0))]),
    pad([]),
    pad(["※ 단가와 금액은 공급업체에서 기입해주세요."]),
    pad(["※ 수량 변경이 필요하면 비고란에 적어주시면 됩니다."]),
  ];

  downloadCsvRows("발주서", rows, `${fileBase(input)}.csv`);
}
