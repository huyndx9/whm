import type { Ingredient, Supplier, Transaction } from "../types";
import { addDays, daysBetween, todayIso } from "./format";
import { roundOrderQty } from "./forecast";

/**
 * 요일 기준 발주 예측.
 *
 * 식당 수요는 요일에 크게 좌우된다. "목요일에 쓸 양"은 지난 며칠 평균보다
 * 지난 몇 주의 목요일 실적으로 보는 편이 훨씬 정확하다.
 *
 * 계산 순서:
 *  1. 목표일과 같은 요일을 최근 N주에서 찾는다 (영업한 날만)
 *  2. 그 날들의 원재료별 사용량을 평균 낸다
 *  3. 오늘부터 목표일 전날까지도 같은 방식으로 예상 사용량을 구해 재고에서 뺀다
 *  4. 목표일 평균 사용량 − 목표일 예상 재고 = 권장 발주량
 */

export interface WeekdaySample {
  date: string;
  qty: number;
}

export interface WeekdayForecastRow {
  ingredient: Ingredient;
  supplier: Supplier | undefined;
  /** 같은 요일 주차별 실제 사용량 (최근 순) */
  samples: WeekdaySample[];
  /** 영업한 주 수 */
  sampleCount: number;
  /** 목표일 예상 사용량 (같은 요일 평균) */
  avgUsage: number;
  maxUsage: number;
  minUsage: number;
  /** 오늘 이후 목표일 전날까지 예상 사용량 */
  interimUsage: number;
  /** 목표일 아침에 남아 있을 것으로 보이는 재고 */
  projectedStock: number;
  /** 권장 발주량 */
  recommendedQty: number;
  needsOrder: boolean;
}

export interface WeekdayForecast {
  targetDate: string;
  /** 0=일 ~ 6=토 */
  weekday: number;
  weeks: number;
  /** 실제로 평균에 쓰인 날짜 (영업일) */
  sampleDates: string[];
  /** 목표일까지 남은 중간 일수 */
  interimDays: number;
  rows: WeekdayForecastRow[];
}

/** 원재료·날짜별 수요량. 폐기·손실은 수요가 아니므로 뺀다 */
function buildDemandIndex(txs: Transaction[]): {
  byDate: Map<string, Map<string, number>>;
  openDays: Set<string>;
} {
  const byDate = new Map<string, Map<string, number>>();
  const openDays = new Set<string>();

  for (const t of txs) {
    if (t.type !== "STOCK_OUT") continue;
    if (t.reason === "DISPOSAL" || t.reason === "LOSS") continue;
    openDays.add(t.date);
    const day = byDate.get(t.date) ?? new Map<string, number>();
    day.set(t.ingredientId, (day.get(t.ingredientId) ?? 0) + t.quantity);
    byDate.set(t.date, day);
  }
  return { byDate, openDays };
}

/**
 * 어떤 요일의 최근 N주 영업일을 찾는다.
 * 오늘은 아직 영업 중이라 완전한 하루가 아니므로 제외한다.
 */
function sameWeekdayDates(
  weekday: number,
  weeks: number,
  openDays: Set<string>,
  today: string,
): string[] {
  const out: string[] = [];
  const todayWeekday = new Date(`${today}T00:00:00`).getDay();
  // 오늘보다 앞선 가장 가까운 해당 요일
  let back = (todayWeekday - weekday + 7) % 7;
  if (back === 0) back = 7;
  let date = addDays(today, -back);

  // 휴무일은 건너뛰되 너무 멀리 거슬러 올라가진 않는다
  let guard = weeks * 3;
  while (out.length < weeks && guard-- > 0) {
    if (openDays.has(date)) out.push(date);
    date = addDays(date, -7);
  }
  return out;
}

export function buildWeekdayForecast(
  ingredients: Ingredient[],
  suppliers: Supplier[],
  txs: Transaction[],
  targetDate: string,
  weeks = 4,
): WeekdayForecast {
  const today = todayIso();
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const { byDate, openDays } = buildDemandIndex(txs);
  const targetWeekday = new Date(`${targetDate}T00:00:00`).getDay();

  const sampleDates = sameWeekdayDates(targetWeekday, weeks, openDays, today);

  // 요일별 평균을 한 번만 계산해 두고 중간 일수 예측에도 쓴다
  const weekdayAvg = new Map<number, Map<string, number>>();
  const avgFor = (weekday: number): Map<string, number> => {
    const cached = weekdayAvg.get(weekday);
    if (cached) return cached;
    const dates = sameWeekdayDates(weekday, weeks, openDays, today);
    const sums = new Map<string, number>();
    for (const d of dates) {
      const day = byDate.get(d);
      if (!day) continue;
      for (const [id, qty] of day) sums.set(id, (sums.get(id) ?? 0) + qty);
    }
    const avg = new Map<string, number>();
    if (dates.length > 0) {
      for (const [id, total] of sums) avg.set(id, total / dates.length);
    }
    weekdayAvg.set(weekday, avg);
    return avg;
  };

  // 오늘 다음날부터 목표일 전날까지
  const interimDays = Math.max(0, daysBetween(today, targetDate) - 1);
  const interimTotals = new Map<string, number>();
  for (let i = 1; i <= interimDays; i++) {
    const d = addDays(today, i);
    const wd = new Date(`${d}T00:00:00`).getDay();
    for (const [id, qty] of avgFor(wd)) {
      interimTotals.set(id, (interimTotals.get(id) ?? 0) + qty);
    }
  }

  const targetAvg = avgFor(targetWeekday);

  const rows: WeekdayForecastRow[] = ingredients
    .filter((i) => i.active)
    .map((ingredient) => {
      const samples: WeekdaySample[] = sampleDates.map((d) => ({
        date: d,
        qty: byDate.get(d)?.get(ingredient.id) ?? 0,
      }));
      const qtys = samples.map((s) => s.qty);
      const avgUsage = targetAvg.get(ingredient.id) ?? 0;
      const interimUsage = interimTotals.get(ingredient.id) ?? 0;
      const projectedStock = Math.max(0, ingredient.stock - interimUsage);
      const shortage = avgUsage - projectedStock;
      const recommendedQty = roundOrderQty(shortage, ingredient.unit);

      return {
        ingredient,
        supplier: supplierById.get(ingredient.supplierId),
        samples,
        sampleCount: sampleDates.length,
        avgUsage,
        maxUsage: qtys.length ? Math.max(...qtys) : 0,
        minUsage: qtys.length ? Math.min(...qtys) : 0,
        interimUsage,
        projectedStock,
        recommendedQty,
        needsOrder: recommendedQty > 0,
      };
    })
    .sort((a, b) => b.recommendedQty * b.ingredient.costPerUnit - a.recommendedQty * a.ingredient.costPerUnit);

  return { targetDate, weekday: targetWeekday, weeks, sampleDates, interimDays, rows };
}
