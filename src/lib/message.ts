import { formatDate, formatNumber } from "./format";

export interface OrderMessageLine {
  name: string;
  quantity: number;
  unit: string;
}

export interface OrderMessageInput {
  restaurantName: string;
  supplierName: string;
  /** 희망 입고일 ISO */
  expectedDate: string;
  lines: OrderMessageLine[];
  /** 발주서 번호 - 있으면 제목에 붙인다 */
  code?: string;
}

/**
 * 카카오톡 대화방에 그대로 붙여넣을 수 있는 발주 문자.
 * 이모지 없이 담백하게 - 받는 쪽이 어떤 분이든 무난하도록.
 */
export function formatOrderMessage(input: OrderMessageInput): string {
  const items = input.lines
    .filter((l) => l.quantity > 0)
    .map((l) => `- ${l.name} ${formatNumber(l.quantity)}${l.unit}`)
    .join("\n");

  return [
    `[${input.restaurantName}] 발주 요청${input.code ? ` (${input.code})` : ""}`,
    "",
    `${input.supplierName}님, 안녕하세요.`,
    "아래 품목으로 발주 부탁드립니다.",
    "",
    items,
    "",
    `총 ${input.lines.filter((l) => l.quantity > 0).length}개 품목`,
    `희망 입고일: ${formatDate(input.expectedDate)}`,
    "",
    "확인 후 회신 부탁드립니다. 감사합니다.",
  ].join("\n");
}
