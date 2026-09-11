import type { Ingredient, ShiftClose, ShiftCloseLine } from "../types";

/**
 * 실사 입력값과 장부 재고를 비교해 마감 라인을 만든다.
 * 차이가 없는 품목은 기록할 필요가 없으므로 제외한다.
 */
export function buildShiftCloseLines(
  ingredients: Ingredient[],
  counts: Record<string, number>,
): ShiftCloseLine[] {
  const lines: ShiftCloseLine[] = [];
  for (const ing of ingredients) {
    if (!ing.active) continue;
    const counted = counts[ing.id];
    if (counted === undefined || !Number.isFinite(counted) || counted < 0) continue;

    const variance = Number((counted - ing.stock).toFixed(3));
    if (variance === 0) continue;

    lines.push({
      ingredientId: ing.id,
      bookStock: ing.stock,
      countedStock: counted,
      variance,
      varianceValue: Math.round(variance * ing.costPerUnit),
    });
  }
  return lines;
}

export interface ShiftCloseSummary {
  lineCount: number;
  shortageCount: number;
  surplusCount: number;
  /** 손실(-)과 잉여(+)를 합친 순액 */
  netValue: number;
  /** 손실만 따로 합친 금액 (항상 0 이하) */
  shortageValue: number;
}

export function summarizeShiftClose(lines: ShiftCloseLine[]): ShiftCloseSummary {
  let netValue = 0;
  let shortageValue = 0;
  let shortageCount = 0;
  let surplusCount = 0;

  for (const l of lines) {
    netValue += l.varianceValue;
    if (l.variance < 0) {
      shortageCount++;
      shortageValue += l.varianceValue;
    } else if (l.variance > 0) {
      surplusCount++;
    }
  }

  return {
    lineCount: lines.length,
    shortageCount,
    surplusCount,
    netValue,
    shortageValue,
  };
}

export interface ChronicShrinkRow {
  ingredient: Ingredient;
  /** 손실이 잡힌 마감 횟수 */
  occurrences: number;
  /** 누적 손실 금액 (음수) */
  totalValue: number;
  /** 누적 손실 수량 (음수) */
  totalQty: number;
}

/**
 * 마감 이력을 누적해 반복적으로 손실이 나는 원재료를 찾는다.
 * 한 번의 큰 실수보다 "매번 조금씩 비는" 품목이 운영 문제를 드러낸다.
 */
export function chronicShrink(
  shiftCloses: ShiftClose[],
  ingredients: Ingredient[],
  limit = 5,
): ChronicShrinkRow[] {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const agg = new Map<string, { occurrences: number; value: number; qty: number }>();

  for (const close of shiftCloses) {
    for (const line of close.lines) {
      if (line.variance >= 0) continue;
      const cur = agg.get(line.ingredientId) ?? { occurrences: 0, value: 0, qty: 0 };
      cur.occurrences += 1;
      cur.value += line.varianceValue;
      cur.qty += line.variance;
      agg.set(line.ingredientId, cur);
    }
  }

  return [...agg.entries()]
    .map(([id, v]) => {
      const ingredient = byId.get(id);
      if (!ingredient) return null;
      return {
        ingredient,
        occurrences: v.occurrences,
        totalValue: v.value,
        totalQty: Number(v.qty.toFixed(2)),
      };
    })
    .filter((r): r is ChronicShrinkRow => r !== null)
    .sort((a, b) => a.totalValue - b.totalValue)
    .slice(0, limit);
}
