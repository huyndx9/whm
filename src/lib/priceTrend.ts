import type { Transaction } from "../types";
import { addDays, todayIso } from "./format";

export interface PriceStats {
  /** 최근 입고 단가 평균 */
  avg: number;
  /** 평균을 낸 입고 건수 */
  samples: number;
  min: number;
  max: number;
  /** 가장 최근 입고 단가 */
  latest: number;
}

/**
 * 과거 입고 기록에서 단가 통계를 낸다.
 * 표본이 너무 적으면(기본 2건 미만) 비교 기준으로 삼을 수 없으므로 null 을 준다.
 */
export function recentPriceStats(
  ingredientId: string,
  transactions: Transaction[],
  windowDays = 60,
  minSamples = 2,
): PriceStats | null {
  const from = addDays(todayIso(), -windowDays);
  const rows = transactions
    .filter(
      (t) =>
        t.ingredientId === ingredientId &&
        t.type === "STOCK_IN" &&
        t.date >= from &&
        t.unitCost > 0,
    )
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (rows.length < minSamples) return null;

  const prices = rows.map((t) => t.unitCost);
  return {
    avg: prices.reduce((a, b) => a + b, 0) / prices.length,
    samples: prices.length,
    min: Math.min(...prices),
    max: Math.max(...prices),
    latest: prices[prices.length - 1],
  };
}

export interface PriceAlert {
  stats: PriceStats;
  /** 평균 대비 증감률(%) */
  deviationPercent: number;
  direction: "up" | "down";
  /** notice = 눈여겨볼 수준, warning = 확인이 필요한 수준 */
  level: "notice" | "warning";
}

const NOTICE_THRESHOLD = 10;
const WARNING_THRESHOLD = 20;

/** 이번에 찍힌 단가가 최근 평균에서 얼마나 벗어났는지 */
export function checkPriceDeviation(
  unitPrice: number,
  stats: PriceStats | null,
): PriceAlert | null {
  if (!stats || stats.avg <= 0 || unitPrice <= 0) return null;
  const deviationPercent = ((unitPrice - stats.avg) / stats.avg) * 100;
  if (Math.abs(deviationPercent) < NOTICE_THRESHOLD) return null;
  return {
    stats,
    deviationPercent,
    direction: deviationPercent > 0 ? "up" : "down",
    level: Math.abs(deviationPercent) >= WARNING_THRESHOLD ? "warning" : "notice",
  };
}

/** "단가가 최근 평균보다 18% 높습니다" 형태의 안내 문구 */
export function priceAlertLabel(alert: PriceAlert): string {
  const pct = Math.abs(alert.deviationPercent).toFixed(0);
  return alert.direction === "up"
    ? `단가가 최근 평균보다 ${pct}% 높습니다`
    : `단가가 최근 평균보다 ${pct}% 낮습니다`;
}

export interface PricePoint {
  date: string;
  unitCost: number;
}

/** 단가 추이 - 최근 입고 순서대로 */
export function priceHistory(
  ingredientId: string,
  transactions: Transaction[],
  windowDays = 90,
): PricePoint[] {
  const from = addDays(todayIso(), -windowDays);
  return transactions
    .filter(
      (t) =>
        t.ingredientId === ingredientId &&
        t.type === "STOCK_IN" &&
        t.date >= from &&
        t.unitCost > 0,
    )
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((t) => ({ date: t.date, unitCost: t.unitCost }));
}
