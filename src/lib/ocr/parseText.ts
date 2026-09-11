import type { ExtractedLine } from "./types";

const SUMMARY_WORDS = [
  "합계",
  "소계",
  "총액",
  "총계",
  "부가세",
  "부가가치세",
  "공급가액",
  "세액",
  "배송비",
  "운임",
  "할인",
  "청구",
  "입금",
  "잔액",
  "받을금액",
  "결제",
];

const UNIT_WORDS = ["kg", "g", "ml", "l", "개", "봉", "팩", "박스", "병", "통", "포", "말", "속"];

function toNumber(raw: string): number {
  const n = Number(raw.replace(/[,\s원]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * OCR 로 얻은 평문에서 품목 줄을 최대한 뽑아낸다.
 * "바지락 10kg 15,000 150,000" 같은 형태를 가정한다.
 */
export function parseReceiptText(text: string): ExtractedLine[] {
  const out: ExtractedLine[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length < 3) continue;
    if (SUMMARY_WORDS.some((w) => line.includes(w))) continue;

    // 줄에서 숫자(천단위 쉼표 포함)를 모두 찾는다
    const numbers = [...line.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => ({
      value: toNumber(m[0]),
      index: m.index ?? 0,
      text: m[0],
    }));
    if (numbers.length < 2) continue;

    // 품목명 = 첫 숫자 앞의 한글/영문 부분
    const namePart = line.slice(0, numbers[0].index).trim().replace(/[|:.\-]+$/, "");
    const name = namePart.replace(/^\d+[.)]\s*/, "").trim();
    if (!name || !/[가-힣A-Za-z]/.test(name)) continue;

    // 단위: 첫 숫자 바로 뒤에 붙은 단위 문자열
    const afterFirst = line.slice(numbers[0].index + numbers[0].text.length).trim();
    const unitMatch = /^([A-Za-z가-힣]+)/.exec(afterFirst);
    let unit = "";
    if (unitMatch) {
      const candidate = unitMatch[1].toLowerCase();
      const hit = UNIT_WORDS.find((u) => candidate.startsWith(u));
      if (hit) unit = hit === "l" ? "L" : hit;
    }

    const quantity = numbers[0].value;
    // 마지막 숫자를 금액, 그 앞을 단가로 본다
    const amount = numbers[numbers.length - 1].value;
    let unitPrice = numbers.length >= 3 ? numbers[numbers.length - 2].value : 0;
    if (unitPrice === 0 && quantity > 0 && amount > 0) {
      unitPrice = Math.round(amount / quantity);
    }

    if (quantity <= 0 || amount <= 0) continue;

    out.push({ name, quantity, unit, unitPrice, amount });
  }

  return out;
}

/** 텍스트에서 yyyy-mm-dd / yyyy.mm.dd / yyyy년 m월 d일 형태의 날짜를 찾는다 */
export function findInvoiceDate(text: string): string {
  const dash = /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/.exec(text);
  if (dash) {
    const [, y, m, d] = dash;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const korean = /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(text);
  if (korean) {
    const [, y, m, d] = korean;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}
