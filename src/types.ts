// Domain model. Code identifiers stay English; every value rendered to the
// screen is converted to Korean through src/lib/labels.ts.

export type Unit = "kg" | "g" | "L" | "ml" | "개" | "봉" | "팩" | "박스" | "병" | "통";

export type CategoryId =
  | "SEAFOOD"
  | "VEGETABLE"
  | "MEAT"
  | "SAUCE"
  | "BROTH"
  | "NOODLE"
  | "PROCESSED"
  | "DAIRY"
  | "BEVERAGE"
  | "ETC";

export type TransactionType = "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT";

export type StockOutReason =
  | "COOKING"
  | "DISPOSAL"
  | "LOSS"
  | "SAMPLE"
  | "STAFF_MEAL"
  | "ETC";

export type AdjustmentReason =
  | "COUNT_DIFF"
  | "DAMAGE"
  | "LOST"
  | "DISPOSAL"
  | "SYSTEM_ERROR"
  | "ETC";

export type StockInReason = "PURCHASE" | "RETURN_IN" | "SCAN" | "ETC";

export type ReasonCode = StockOutReason | AdjustmentReason | StockInReason;

export type StockStatus = "OK" | "LOW" | "OUT";
export type ExpiryStatus = "FRESH" | "SOON" | "TODAY" | "EXPIRED";

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  specialty: string;
  /** 발주 후 입고까지 걸리는 일수 */
  leadTimeDays: number;
  /** 당일 발주 마감 시각 "15:00" */
  orderCutoff: string;
  active: boolean;
}

export interface Ingredient {
  id: string;
  name: string;
  note: string;
  categoryId: CategoryId;
  unit: Unit;
  stock: number;
  /** 이 아래로 내려가면 재고 부족 */
  minStock: number;
  /** 발주 시 채워 넣을 목표 재고 */
  parStock: number;
  costPerUnit: number;
  supplierId: string;
  location: string;
  /** ISO yyyy-mm-dd */
  expiryDate: string;
  active: boolean;
}

export interface Transaction {
  id: string;
  /** ISO yyyy-mm-dd */
  date: string;
  createdAt: string;
  ingredientId: string;
  type: TransactionType;
  /** 항상 양수. 부호는 type 이 결정한다 */
  quantity: number;
  unitCost: number;
  amount: number;
  reason: ReasonCode;
  memo?: string;
  supplierId?: string;
  /** 스캔한 영수증 또는 발주서 id */
  sourceDocId?: string;
}

export type PurchaseOrderStatus = "DRAFT" | "SENT" | "RECEIVED" | "CANCELLED";

export interface PurchaseOrderLine {
  ingredientId: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  code: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  createdAt: string;
  expectedDate: string;
  receivedAt?: string;
  lines: PurchaseOrderLine[];
  memo?: string;
}

export interface ScanLine {
  id: string;
  rawName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  matchedIngredientId: string | null;
  /** 0..1 자동 매칭 신뢰도 */
  confidence: number;
  /** 사용자가 이 줄을 반영할지 */
  include: boolean;
}

export type OcrProviderId = "claude" | "tesseract" | "demo";

export interface ScannedInvoice {
  id: string;
  createdAt: string;
  imageDataUrl: string;
  provider: OcrProviderId;
  rawText: string;
  supplierId: string | null;
  invoiceDate: string;
  lines: ScanLine[];
  committed: boolean;
}

/** 실제 메뉴판의 구역과 일치시킨다 */
export type MenuCategory = "HOTPOT" | "GRILL" | "NOODLE_DISH" | "TOPPING" | "SIDE" | "DRINK";

/** 메뉴 1인분(1접시)에 들어가는 원재료 소요량 */
export interface RecipeLine {
  ingredientId: string;
  /** 원재료의 기본 단위 기준 소요량 */
  quantity: number;
}

export interface MenuItem {
  id: string;
  name: string;
  note: string;
  categoryId: MenuCategory;
  /** 판매가 (원) */
  price: number;
  lines: RecipeLine[];
  active: boolean;
}

/** 판매 등록 1건 - 이 기록이 원재료 출고를 만들어 낸다 */
export interface SaleRecord {
  id: string;
  date: string;
  createdAt: string;
  menuItemId: string;
  /** 판매 수량(인분) */
  servings: number;
  /** 판매 시점의 판매가 합계 */
  revenue: number;
  /** 판매 시점의 원가 합계 */
  cost: number;
  memo?: string;
}

/** 마감 실사에서 품목 하나의 결과 */
export interface ShiftCloseLine {
  ingredientId: string;
  /** 마감 시점의 장부(시스템) 재고 - 판매/입출고가 모두 반영된 값 */
  bookStock: number;
  /** 직접 세어 본 실제 재고 */
  countedStock: number;
  /** 실사 - 장부. 음수면 손실 */
  variance: number;
  /** 차이를 금액으로 환산한 값 */
  varianceValue: number;
}

/** 일일 마감(재고 실사) 기록 */
export interface ShiftClose {
  id: string;
  date: string;
  closedAt: string;
  lines: ShiftCloseLine[];
  memo?: string;
}

export interface Settings {
  restaurantName: string;
  /** 안전 재고 일수 - 리드타임에 더해 여유분을 계산 */
  safetyDays: number;
  /** 사용량 평균을 낼 기간 */
  forecastWindowDays: number;
  /** 유통기한 임박 기준 일수 */
  expiryWarningDays: number;
  ocrProvider: OcrProviderId;
  claudeApiKey: string;
  claudeModel: string;
}

export interface AppData {
  version: number;
  ingredients: Ingredient[];
  suppliers: Supplier[];
  transactions: Transaction[];
  purchaseOrders: PurchaseOrder[];
  invoices: ScannedInvoice[];
  menuItems: MenuItem[];
  sales: SaleRecord[];
  shiftCloses: ShiftClose[];
  settings: Settings;
}
