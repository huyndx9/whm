import type {
  ExpiryStatus,
  Ingredient,
  Settings,
  StockStatus,
  Supplier,
  Transaction,
} from "../types";
import { addDays, daysBetween, daysUntil, todayIso } from "./format";

/** 프로젝트 규칙: 재고 > 최소 재고 → 정상 / 0 초과 최소 이하 → 부족 / 0 → 품절 */
export function getStockStatus(ing: Ingredient): StockStatus {
  if (ing.stock <= 0) return "OUT";
  if (ing.stock <= ing.minStock) return "LOW";
  return "OK";
}

export function getExpiryStatus(ing: Ingredient, warningDays: number): ExpiryStatus {
  const d = daysUntil(ing.expiryDate);
  if (d < 0) return "EXPIRED";
  if (d === 0) return "TODAY";
  if (d <= warningDays) return "SOON";
  return "FRESH";
}

export interface UsageStats {
  /** 가중 이동평균 기준 하루 평균 사용량 */
  dailyUsage: number;
  /** 최근 7일 평균 */
  recentDaily: number;
  /** 그 이전 7일 평균 */
  previousDaily: number;
  /** 최근 7일 vs 이전 7일 변화율(%) */
  trendPercent: number;
  /** 사용량의 변동계수 - 클수록 들쭉날쭉 */
  volatility: number;
  /** 예측 신뢰도 0..1 */
  confidence: number;
  /** 관측된 날 수 */
  observedDays: number;
  totalOut: number;
  disposalQty: number;
  /** 폐기 비율(%) */
  wasteRate: number;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * 품목별 일자별 출고량 맵을 만든다.
 * 조리 사용/직원 식사/샘플만 "수요"로 본다. 폐기·손실은 수요가 아니므로
 * 예측에서 제외하되 폐기율 지표로 따로 보여 준다.
 */
function dailyOutMap(
  txs: Transaction[],
  ingredientId: string,
  fromIso: string,
): { demand: Map<string, number>; disposal: number; totalOut: number } {
  const demand = new Map<string, number>();
  let disposal = 0;
  let totalOut = 0;

  for (const t of txs) {
    if (t.ingredientId !== ingredientId) continue;
    if (t.type !== "STOCK_OUT") continue;
    if (t.date < fromIso) continue;

    totalOut += t.quantity;
    if (t.reason === "DISPOSAL" || t.reason === "LOSS") {
      disposal += t.quantity;
      continue;
    }
    demand.set(t.date, (demand.get(t.date) ?? 0) + t.quantity);
  }
  return { demand, disposal, totalOut };
}

export function computeUsageStats(
  ingredientId: string,
  txs: Transaction[],
  windowDays: number,
): UsageStats {
  const today = todayIso();
  const from = addDays(today, -windowDays);
  const { demand, disposal, totalOut } = dailyOutMap(txs, ingredientId, from);

  // 창 안의 모든 날짜를 0으로 채워야 "안 쓴 날"도 평균에 반영된다.
  const series: { date: string; qty: number }[] = [];
  for (let i = windowDays; i >= 1; i--) {
    const date = addDays(today, -i);
    series.push({ date, qty: demand.get(date) ?? 0 });
  }

  const values = series.map((s) => s.qty);
  const observedDays = values.length;

  // 최근일수록 큰 가중치(선형 가중 이동평균)
  let weighted = 0;
  let weightSum = 0;
  values.forEach((v, i) => {
    const w = i + 1;
    weighted += v * w;
    weightSum += w;
  });
  const dailyUsage = weightSum > 0 ? weighted / weightSum : 0;

  const last7 = values.slice(-7);
  const prev7 = values.slice(-14, -7);
  const recentDaily = last7.length ? sum(last7) / last7.length : 0;
  const previousDaily = prev7.length ? sum(prev7) / prev7.length : 0;
  const trendPercent =
    previousDaily > 0 ? ((recentDaily - previousDaily) / previousDaily) * 100 : 0;

  const mean = values.length ? sum(values) / values.length : 0;
  const variance = values.length
    ? sum(values.map((v) => (v - mean) ** 2)) / values.length
    : 0;
  const stdev = Math.sqrt(variance);
  const volatility = mean > 0 ? stdev / mean : 0;

  const daysWithData = values.filter((v) => v > 0).length;
  const dataScore = Math.min(1, daysWithData / 14);
  const stabilityScore = Math.max(0, 1 - Math.min(1, volatility));
  const confidence = Number((dataScore * 0.6 + stabilityScore * 0.4).toFixed(2));

  return {
    dailyUsage,
    recentDaily,
    previousDaily,
    trendPercent,
    volatility,
    confidence,
    observedDays,
    totalOut,
    disposalQty: disposal,
    wasteRate: totalOut > 0 ? (disposal / totalOut) * 100 : 0,
  };
}

export interface ForecastRow {
  ingredient: Ingredient;
  supplier: Supplier | undefined;
  stats: UsageStats;
  stockStatus: StockStatus;
  expiryStatus: ExpiryStatus;
  /** 재고 소진까지 남은 일수. 사용량이 0이면 null */
  daysUntilStockout: number | null;
  /** 소진 예상 날짜 */
  stockoutDate: string | null;
  /** 리드타임 + 안전일수를 버티기 위한 재주문점 */
  reorderPoint: number;
  /** 지금 발주해야 하는가 */
  needsOrder: boolean;
  /** 권장 발주 수량 */
  recommendedQty: number;
  /** 권장 발주 금액 */
  recommendedCost: number;
  /** 유통기한 내에 다 못 쓸 것으로 보이는 수량 */
  atRiskQty: number;
  /** 정렬용 위험도 점수 - 높을수록 급함 */
  urgency: number;
}

/** 주문 단위에 맞춰 올림 (소수 단위 품목은 0.5 단위) */
export function roundOrderQty(qty: number, unit: string): number {
  if (qty <= 0) return 0;
  const integerUnits = ["개", "봉", "팩", "박스", "병", "통"];
  if (integerUnits.includes(unit)) return Math.ceil(qty);
  return Math.ceil(qty * 2) / 2;
}

export function buildForecast(
  ingredients: Ingredient[],
  suppliers: Supplier[],
  txs: Transaction[],
  settings: Settings,
): ForecastRow[] {
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const today = todayIso();

  return ingredients
    .filter((i) => i.active)
    .map((ingredient) => {
      const supplier = supplierById.get(ingredient.supplierId);
      const stats = computeUsageStats(ingredient.id, txs, settings.forecastWindowDays);
      const leadTime = supplier?.leadTimeDays ?? 1;
      const coverDays = leadTime + settings.safetyDays;

      const daysUntilStockout =
        stats.dailyUsage > 0.01 ? ingredient.stock / stats.dailyUsage : null;
      const stockoutDate =
        daysUntilStockout !== null && Number.isFinite(daysUntilStockout)
          ? addDays(today, Math.floor(daysUntilStockout))
          : null;

      // 재주문점: 리드타임 동안 쓸 양 + 최소 재고(안전재고)
      const reorderPoint = stats.dailyUsage * coverDays + ingredient.minStock;

      // 목표: 적정 재고(par)까지 채우되, 최소한 재주문점은 넘기도록
      const target = Math.max(ingredient.parStock, reorderPoint);
      const rawQty = target - ingredient.stock;
      const needsOrder = ingredient.stock <= reorderPoint;
      const recommendedQty = needsOrder ? roundOrderQty(rawQty, ingredient.unit) : 0;

      // 유통기한까지 소비 가능한 양을 넘어서는 재고 = 폐기 위험
      const daysToExpiry = daysBetween(today, ingredient.expiryDate);
      const consumable = stats.dailyUsage * Math.max(0, daysToExpiry);
      const atRiskQty =
        stats.dailyUsage > 0.01 ? Math.max(0, ingredient.stock - consumable) : 0;

      const stockStatus = getStockStatus(ingredient);
      const expiryStatus = getExpiryStatus(ingredient, settings.expiryWarningDays);

      let urgency = 0;
      if (stockStatus === "OUT") urgency += 100;
      else if (stockStatus === "LOW") urgency += 60;
      if (expiryStatus === "EXPIRED") urgency += 80;
      else if (expiryStatus === "TODAY") urgency += 50;
      else if (expiryStatus === "SOON") urgency += 25;
      if (needsOrder) urgency += 30;
      if (daysUntilStockout !== null) urgency += Math.max(0, 20 - daysUntilStockout);

      return {
        ingredient,
        supplier,
        stats,
        stockStatus,
        expiryStatus,
        daysUntilStockout,
        stockoutDate,
        reorderPoint,
        needsOrder,
        recommendedQty,
        recommendedCost: recommendedQty * ingredient.costPerUnit,
        atRiskQty,
        urgency,
      };
    })
    .sort((a, b) => b.urgency - a.urgency);
}

export interface DailyCost {
  date: string;
  cost: number;
  qty: number;
}

/** 최근 n일 일별 사용 원가 */
export function dailyCostSeries(txs: Transaction[], days: number): DailyCost[] {
  const today = todayIso();
  const map = new Map<string, DailyCost>();
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    map.set(date, { date, cost: 0, qty: 0 });
  }
  for (const t of txs) {
    if (t.type !== "STOCK_OUT") continue;
    const entry = map.get(t.date);
    if (!entry) continue;
    entry.cost += t.amount;
    entry.qty += t.quantity;
  }
  return [...map.values()];
}

/** 향후 n일 예상 사용 원가 - 요일 패턴을 반영한 단순 예측 */
export function projectedCostSeries(
  ingredients: Ingredient[],
  txs: Transaction[],
  settings: Settings,
  days: number,
): DailyCost[] {
  const today = todayIso();

  // 요일별 계수를 과거 데이터에서 뽑는다
  const byWeekday = new Map<number, number[]>();
  const history = dailyCostSeries(txs, settings.forecastWindowDays);
  for (const d of history) {
    const wd = new Date(`${d.date}T00:00:00`).getDay();
    const arr = byWeekday.get(wd) ?? [];
    arr.push(d.cost);
    byWeekday.set(wd, arr);
  }
  const overallAvg =
    history.length > 0 ? sum(history.map((h) => h.cost)) / history.length : 0;

  const factorFor = (wd: number): number => {
    const arr = byWeekday.get(wd);
    if (!arr || arr.length === 0 || overallAvg <= 0) return 1;
    const avg = sum(arr) / arr.length;
    return avg / overallAvg;
  };

  const out: DailyCost[] = [];
  for (let i = 1; i <= days; i++) {
    const date = addDays(today, i);
    const wd = new Date(`${date}T00:00:00`).getDay();
    out.push({ date, cost: Math.round(overallAvg * factorFor(wd)), qty: 0 });
  }
  // 사용하지 않는 인자 경고 방지를 위해 참조
  void ingredients;
  return out;
}

export interface TopUsageRow {
  ingredient: Ingredient;
  qty: number;
  cost: number;
}

export function topUsage(
  ingredients: Ingredient[],
  txs: Transaction[],
  days: number,
  limit = 5,
): TopUsageRow[] {
  const today = todayIso();
  const from = addDays(today, -days);
  const byId = new Map<string, { qty: number; cost: number }>();

  for (const t of txs) {
    if (t.type !== "STOCK_OUT" || t.date < from) continue;
    const cur = byId.get(t.ingredientId) ?? { qty: 0, cost: 0 };
    cur.qty += t.quantity;
    cur.cost += t.amount;
    byId.set(t.ingredientId, cur);
  }

  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  return [...byId.entries()]
    .map(([id, v]) => {
      const ingredient = ingById.get(id);
      return ingredient ? { ingredient, qty: v.qty, cost: v.cost } : null;
    })
    .filter((r): r is TopUsageRow => r !== null)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, limit);
}

export interface CategoryCost {
  categoryId: Ingredient["categoryId"];
  cost: number;
  percent: number;
}

export function costByCategory(
  ingredients: Ingredient[],
  txs: Transaction[],
  days: number,
): CategoryCost[] {
  const today = todayIso();
  const from = addDays(today, -days);
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const byCat = new Map<Ingredient["categoryId"], number>();

  for (const t of txs) {
    if (t.type !== "STOCK_OUT" || t.date < from) continue;
    const ing = ingById.get(t.ingredientId);
    if (!ing) continue;
    byCat.set(ing.categoryId, (byCat.get(ing.categoryId) ?? 0) + t.amount);
  }

  const total = sum([...byCat.values()]);
  return [...byCat.entries()]
    .map(([categoryId, cost]) => ({
      categoryId,
      cost,
      percent: total > 0 ? (cost / total) * 100 : 0,
    }))
    .sort((a, b) => b.cost - a.cost);
}

export function totalInventoryValue(ingredients: Ingredient[]): number {
  return ingredients
    .filter((i) => i.active)
    .reduce((acc, i) => acc + i.stock * i.costPerUnit, 0);
}

/** 재고 회전율 - 기간 사용액 / 평균 재고액 */
export function inventoryTurnover(
  ingredients: Ingredient[],
  txs: Transaction[],
  days: number,
): number {
  const today = todayIso();
  const from = addDays(today, -days);
  const used = txs
    .filter((t) => t.type === "STOCK_OUT" && t.date >= from)
    .reduce((a, t) => a + t.amount, 0);
  const value = totalInventoryValue(ingredients);
  return value > 0 ? used / value : 0;
}
