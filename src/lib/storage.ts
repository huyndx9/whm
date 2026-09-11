import type { AppData } from "../types";
import { createSeedData, DEFAULT_SETTINGS } from "./seed";

// v2: 메뉴·레시피와 판매 기록이 추가되면서 과거 이력도 판매 기반으로 다시 생성된다.
// 예전 키(v1)에 저장된 데이터는 레시피와 앞뒤가 맞지 않으므로 이어서 쓰지 않는다.
// v3: 실제 매장 메뉴판(38개 메뉴, 35개 원재료)으로 시드를 다시 만들었다.
const STORAGE_KEY = "taekine-inventory-v3";

/**
 * 스캔한 영수증 이미지는 용량이 커서 localStorage 한도를 넘길 수 있다.
 * 저장할 때는 최근 것만 남기고 이미지 원본은 잘라 낸다.
 */
const MAX_STORED_INVOICES = 20;

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedData();
    const parsed = JSON.parse(raw) as Partial<AppData>;
    if (!parsed || !Array.isArray(parsed.ingredients)) return createSeedData();

    return {
      version: parsed.version ?? 1,
      ingredients: parsed.ingredients ?? [],
      suppliers: parsed.suppliers ?? [],
      transactions: parsed.transactions ?? [],
      purchaseOrders: parsed.purchaseOrders ?? [],
      invoices: parsed.invoices ?? [],
      menuItems: parsed.menuItems ?? [],
      sales: parsed.sales ?? [],
      shiftCloses: parsed.shiftCloses ?? [],
      // 설정은 항목이 추가될 수 있으므로 기본값 위에 덮어쓴다
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    // 저장된 데이터가 깨졌으면 시드로 되돌린다
    return createSeedData();
  }
}

export function saveData(data: AppData): void {
  try {
    const slim: AppData = {
      ...data,
      invoices: data.invoices.slice(-MAX_STORED_INVOICES).map((inv) => ({
        ...inv,
        // 이미 반영된 영수증의 이미지는 보관하지 않는다
        imageDataUrl: inv.committed ? "" : inv.imageDataUrl,
      })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
  } catch (err) {
    // 용량 초과 시 이미지를 모두 버리고 한 번 더 시도
    try {
      const minimal: AppData = {
        ...data,
        invoices: data.invoices.slice(-5).map((inv) => ({ ...inv, imageDataUrl: "" })),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
    } catch {
      console.warn("저장 공간이 부족해 데이터를 저장하지 못했습니다.", err);
    }
  }
}

export function resetData(): AppData {
  localStorage.removeItem(STORAGE_KEY);
  return createSeedData();
}

export function exportJson(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
