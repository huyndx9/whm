import type { Ingredient, MenuItem, SaleRecord, Transaction } from "../types";
import { addDays, todayIso } from "./format";

export interface RecipeCostLine {
  ingredient: Ingredient | undefined;
  quantity: number;
  cost: number;
  /** 이 원재료가 원가에서 차지하는 비중(%) */
  share: number;
  /** 현재 재고로 몇 인분까지 만들 수 있는가 */
  possibleServings: number;
}

export interface MenuCost {
  menu: MenuItem;
  lines: RecipeCostLine[];
  /** 1인분 원가 */
  cost: number;
  /** 판매가 - 원가 */
  margin: number;
  /** 원가율(%) */
  costRatio: number;
  /** 현재 재고로 만들 수 있는 인분 수. 재료가 없으면 0 */
  makeableServings: number;
  /** 재고가 모자라 병목이 되는 원재료 */
  bottleneck: Ingredient | undefined;
  /** 레시피에 등록되지 않았거나 삭제된 원재료가 있는가 */
  hasMissingIngredient: boolean;
}

export function computeMenuCost(menu: MenuItem, ingredients: Ingredient[]): MenuCost {
  const byId = new Map(ingredients.map((i) => [i.id, i]));

  const raw = menu.lines.map((line) => {
    const ingredient = byId.get(line.ingredientId);
    const cost = ingredient ? line.quantity * ingredient.costPerUnit : 0;
    const possibleServings =
      ingredient && line.quantity > 0
        ? Math.floor(ingredient.stock / line.quantity)
        : Number.POSITIVE_INFINITY;
    return { ingredient, quantity: line.quantity, cost, possibleServings };
  });

  const cost = raw.reduce((a, l) => a + l.cost, 0);

  const lines: RecipeCostLine[] = raw.map((l) => ({
    ...l,
    share: cost > 0 ? (l.cost / cost) * 100 : 0,
  }));

  // 재료 중 가장 적게 만들 수 있는 것이 전체 생산 가능 수량을 결정한다
  let makeableServings = Number.POSITIVE_INFINITY;
  let bottleneck: Ingredient | undefined;
  for (const l of lines) {
    if (!l.ingredient) continue;
    if (l.possibleServings < makeableServings) {
      makeableServings = l.possibleServings;
      bottleneck = l.ingredient;
    }
  }
  if (!Number.isFinite(makeableServings)) makeableServings = 0;

  return {
    menu,
    lines,
    cost,
    margin: menu.price - cost,
    costRatio: menu.price > 0 ? (cost / menu.price) * 100 : 0,
    makeableServings,
    bottleneck,
    hasMissingIngredient: raw.some((l) => !l.ingredient) || menu.lines.length === 0,
  };
}

export function buildMenuCosts(menuItems: MenuItem[], ingredients: Ingredient[]): MenuCost[] {
  return menuItems
    .filter((m) => m.active)
    .map((m) => computeMenuCost(m, ingredients))
    .sort((a, b) => b.margin - a.margin);
}

export interface SalesSummary {
  revenue: number;
  cost: number;
  margin: number;
  /** 원가율(%) */
  costRatio: number;
  servings: number;
  orders: number;
}

export function summarizeSales(sales: SaleRecord[]): SalesSummary {
  let revenue = 0;
  let cost = 0;
  let servings = 0;
  for (const s of sales) {
    revenue += s.revenue;
    cost += s.cost;
    servings += s.servings;
  }
  return {
    revenue,
    cost,
    margin: revenue - cost,
    costRatio: revenue > 0 ? (cost / revenue) * 100 : 0,
    servings,
    orders: sales.length,
  };
}

export function salesInRange(sales: SaleRecord[], days: number): SaleRecord[] {
  const from = addDays(todayIso(), -(days - 1));
  return sales.filter((s) => s.date >= from);
}

export interface DailySales {
  date: string;
  revenue: number;
  cost: number;
  margin: number;
  servings: number;
}

/** 최근 n일 일별 매출·원가 */
export function dailySalesSeries(sales: SaleRecord[], days: number): DailySales[] {
  const today = todayIso();
  const map = new Map<string, DailySales>();
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    map.set(date, { date, revenue: 0, cost: 0, margin: 0, servings: 0 });
  }
  for (const s of sales) {
    const entry = map.get(s.date);
    if (!entry) continue;
    entry.revenue += s.revenue;
    entry.cost += s.cost;
    entry.margin += s.revenue - s.cost;
    entry.servings += s.servings;
  }
  return [...map.values()];
}

export interface MenuPerformance {
  menu: MenuItem;
  servings: number;
  revenue: number;
  cost: number;
  margin: number;
  costRatio: number;
}

export function menuPerformance(
  menuItems: MenuItem[],
  sales: SaleRecord[],
  days: number,
): MenuPerformance[] {
  const scoped = salesInRange(sales, days);
  const byMenu = new Map<string, { servings: number; revenue: number; cost: number }>();
  for (const s of scoped) {
    const cur = byMenu.get(s.menuItemId) ?? { servings: 0, revenue: 0, cost: 0 };
    cur.servings += s.servings;
    cur.revenue += s.revenue;
    cur.cost += s.cost;
    byMenu.set(s.menuItemId, cur);
  }

  const menuById = new Map(menuItems.map((m) => [m.id, m]));
  return [...byMenu.entries()]
    .map(([id, v]) => {
      const menu = menuById.get(id);
      if (!menu) return null;
      return {
        menu,
        servings: v.servings,
        revenue: v.revenue,
        cost: v.cost,
        margin: v.revenue - v.cost,
        costRatio: v.revenue > 0 ? (v.cost / v.revenue) * 100 : 0,
      };
    })
    .filter((r): r is MenuPerformance => r !== null)
    .sort((a, b) => b.margin - a.margin);
}

/**
 * 판매 등록 시 실제로 차감될 원재료 소요량을 합산한다.
 * 같은 원재료를 쓰는 메뉴가 여러 개면 하나로 묶어서 보여 준다.
 */
export interface ConsumptionLine {
  ingredient: Ingredient;
  required: number;
  available: number;
  shortage: number;
}

export function computeConsumption(
  cart: { menuItem: MenuItem; servings: number }[],
  ingredients: Ingredient[],
): ConsumptionLine[] {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const required = new Map<string, number>();

  for (const { menuItem, servings } of cart) {
    if (servings <= 0) continue;
    for (const line of menuItem.lines) {
      required.set(
        line.ingredientId,
        (required.get(line.ingredientId) ?? 0) + line.quantity * servings,
      );
    }
  }

  return [...required.entries()]
    .map(([id, qty]) => {
      const ingredient = byId.get(id);
      if (!ingredient) return null;
      const need = Number(qty.toFixed(3));
      return {
        ingredient,
        required: need,
        available: ingredient.stock,
        shortage: Math.max(0, Number((need - ingredient.stock).toFixed(3))),
      };
    })
    .filter((l): l is ConsumptionLine => l !== null)
    .sort((a, b) => b.shortage - a.shortage || b.required - a.required);
}

/** 요일별 매출 패턴 (0=일 ~ 6=토) */
export function weekdayPattern(sales: SaleRecord[], days: number): { weekday: number; revenue: number; count: number }[] {
  const scoped = salesInRange(sales, days);
  const buckets = Array.from({ length: 7 }, (_, weekday) => ({ weekday, revenue: 0, count: 0 }));
  const seenDates = new Map<number, Set<string>>();

  for (const s of scoped) {
    const wd = new Date(`${s.date}T00:00:00`).getDay();
    buckets[wd].revenue += s.revenue;
    const set = seenDates.get(wd) ?? new Set<string>();
    set.add(s.date);
    seenDates.set(wd, set);
  }
  for (const b of buckets) b.count = seenDates.get(b.weekday)?.size ?? 0;
  return buckets;
}

export interface HeatCellData {
  weekday: number;
  week: number;
  date: string;
  value: number;
}

/**
 * 요일 × 주차 히트맵용 데이터.
 * 이번 주 토요일까지 채운 뒤 지정한 주 수만큼 거슬러 올라간다.
 */
export function salesHeatmap(sales: SaleRecord[], weeks: number): HeatCellData[] {
  const today = todayIso();
  const todayDow = new Date(`${today}T00:00:00`).getDay();
  // 이번 주 일요일
  const thisSunday = addDays(today, -todayDow);
  const firstSunday = addDays(thisSunday, -(weeks - 1) * 7);

  const revenueByDate = new Map<string, number>();
  for (const s of sales) revenueByDate.set(s.date, (revenueByDate.get(s.date) ?? 0) + s.revenue);

  const cells: HeatCellData[] = [];
  for (let week = 0; week < weeks; week++) {
    for (let weekday = 0; weekday < 7; weekday++) {
      const date = addDays(firstSunday, week * 7 + weekday);
      // 아직 오지 않은 날은 칸을 비워 둔다
      if (date > today) continue;
      cells.push({ weekday, week, date, value: revenueByDate.get(date) ?? 0 });
    }
  }
  return cells;
}

/** 메뉴 판매로 발생한 출고인지 판별 */
export function isRecipeTransaction(t: Transaction): boolean {
  return t.type === "STOCK_OUT" && t.reason === "COOKING" && Boolean(t.sourceDocId);
}
