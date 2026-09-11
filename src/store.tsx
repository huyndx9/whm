import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type {
  AppData,
  Ingredient,
  MenuItem,
  PurchaseOrder,
  ReasonCode,
  SaleRecord,
  ScannedInvoice,
  ShiftClose,
  Settings,
  Supplier,
  Transaction,
  TransactionType,
} from "./types";
import { loadData, makeId, resetData, saveData } from "./lib/storage";
import { buildShiftCloseLines } from "./lib/shiftClose";
import { todayIso } from "./lib/format";

export interface StockMoveInput {
  ingredientId: string;
  type: TransactionType;
  quantity: number;
  reason: ReasonCode;
  memo?: string;
  supplierId?: string;
  unitCost?: number;
  /** 재고 조정에서 "실제 재고 값"을 직접 지정할 때 사용 */
  absoluteStock?: number;
  sourceDocId?: string;
  date?: string;
  /** 입고와 함께 유통기한을 갱신할 때 사용 */
  newExpiryDate?: string;
}

type Action =
  | { type: "REPLACE"; data: AppData }
  | { type: "MOVE_STOCK"; inputs: StockMoveInput[] }
  | { type: "UPSERT_INGREDIENT"; ingredient: Ingredient }
  | { type: "DELETE_INGREDIENT"; id: string }
  | { type: "UPSERT_SUPPLIER"; supplier: Supplier }
  | { type: "DELETE_SUPPLIER"; id: string }
  | { type: "UPSERT_ORDER"; order: PurchaseOrder }
  | { type: "DELETE_ORDER"; id: string }
  | { type: "UPSERT_INVOICE"; invoice: ScannedInvoice }
  | { type: "UPSERT_MENU"; menu: MenuItem }
  | { type: "DELETE_MENU"; id: string }
  | { type: "RECORD_SALES"; sales: SaleRecord[]; moves: StockMoveInput[] }
  | { type: "RECORD_SHIFT_CLOSE"; close: ShiftClose; moves: StockMoveInput[] }
  | { type: "UPDATE_SETTINGS"; patch: Partial<Settings> };

function applyMoves(data: AppData, inputs: StockMoveInput[]): AppData {
  const ingredients = [...data.ingredients];
  const newTxs: Transaction[] = [];
  const nowIso = new Date().toISOString();

  for (const input of inputs) {
    const idx = ingredients.findIndex((i) => i.id === input.ingredientId);
    if (idx < 0) continue;
    const ing = ingredients[idx];
    const unitCost = input.unitCost ?? ing.costPerUnit;

    let delta: number;
    let quantity: number;

    if (input.type === "ADJUSTMENT" && input.absoluteStock !== undefined) {
      // 실사 결과를 그대로 반영: 차이만큼 움직인다
      delta = input.absoluteStock - ing.stock;
      quantity = Math.abs(delta);
    } else if (input.type === "STOCK_IN") {
      quantity = Math.abs(input.quantity);
      delta = quantity;
    } else if (input.type === "STOCK_OUT") {
      quantity = Math.abs(input.quantity);
      delta = -quantity;
    } else {
      quantity = Math.abs(input.quantity);
      delta = input.quantity; // 조정은 부호를 그대로 사용
    }

    if (quantity === 0 && input.type !== "ADJUSTMENT") continue;

    const nextStock = Math.max(0, Number((ing.stock + delta).toFixed(3)));
    const isIn = input.type === "STOCK_IN";
    // 품목 정보 갱신은 반드시 이 안에서 함께 처리한다. 밖에서 upsertIngredient 를
    // 따로 호출하면 갱신 전 스냅샷을 덮어써서 방금 더한 재고가 사라진다.
    ingredients[idx] = {
      ...ing,
      stock: nextStock,
      // 입고 시 단가·공급업체·유통기한을 최신값으로 갱신
      costPerUnit: isIn && input.unitCost ? input.unitCost : ing.costPerUnit,
      supplierId: isIn && input.supplierId ? input.supplierId : ing.supplierId,
      expiryDate: isIn && input.newExpiryDate ? input.newExpiryDate : ing.expiryDate,
    };

    newTxs.push({
      id: makeId("tx"),
      date: input.date ?? todayIso(),
      createdAt: nowIso,
      ingredientId: ing.id,
      type: input.type,
      quantity: Number(quantity.toFixed(3)),
      unitCost,
      amount: Math.round(quantity * unitCost),
      reason: input.reason,
      memo: input.memo,
      supplierId: input.supplierId,
      sourceDocId: input.sourceDocId,
    });
  }

  return { ...data, ingredients, transactions: [...data.transactions, ...newTxs] };
}

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case "REPLACE":
      return action.data;

    case "MOVE_STOCK":
      return applyMoves(state, action.inputs);

    case "UPSERT_INGREDIENT": {
      const exists = state.ingredients.some((i) => i.id === action.ingredient.id);
      return {
        ...state,
        ingredients: exists
          ? state.ingredients.map((i) => (i.id === action.ingredient.id ? action.ingredient : i))
          : [...state.ingredients, action.ingredient],
      };
    }

    case "DELETE_INGREDIENT":
      return {
        ...state,
        // 거래 이력이 남아 있으므로 완전 삭제 대신 비활성 처리
        ingredients: state.ingredients.map((i) =>
          i.id === action.id ? { ...i, active: false } : i,
        ),
      };

    case "UPSERT_SUPPLIER": {
      const exists = state.suppliers.some((s) => s.id === action.supplier.id);
      return {
        ...state,
        suppliers: exists
          ? state.suppliers.map((s) => (s.id === action.supplier.id ? action.supplier : s))
          : [...state.suppliers, action.supplier],
      };
    }

    case "DELETE_SUPPLIER":
      return {
        ...state,
        suppliers: state.suppliers.map((s) =>
          s.id === action.id ? { ...s, active: false } : s,
        ),
      };

    case "UPSERT_ORDER": {
      const exists = state.purchaseOrders.some((o) => o.id === action.order.id);
      return {
        ...state,
        purchaseOrders: exists
          ? state.purchaseOrders.map((o) => (o.id === action.order.id ? action.order : o))
          : [...state.purchaseOrders, action.order],
      };
    }

    case "DELETE_ORDER":
      return {
        ...state,
        purchaseOrders: state.purchaseOrders.filter((o) => o.id !== action.id),
      };

    case "UPSERT_INVOICE": {
      const exists = state.invoices.some((v) => v.id === action.invoice.id);
      return {
        ...state,
        invoices: exists
          ? state.invoices.map((v) => (v.id === action.invoice.id ? action.invoice : v))
          : [...state.invoices, action.invoice],
      };
    }

    case "UPSERT_MENU": {
      const exists = state.menuItems.some((m) => m.id === action.menu.id);
      return {
        ...state,
        menuItems: exists
          ? state.menuItems.map((m) => (m.id === action.menu.id ? action.menu : m))
          : [...state.menuItems, action.menu],
      };
    }

    case "DELETE_MENU":
      return {
        ...state,
        // 판매 이력이 남아 있으므로 완전 삭제 대신 비활성 처리
        menuItems: state.menuItems.map((m) =>
          m.id === action.id ? { ...m, active: false } : m,
        ),
      };

    case "RECORD_SALES": {
      // 판매 기록과 그에 따른 원재료 차감을 한 번에 반영해야
      // 중간 상태(재고만 줄고 매출은 없는)가 생기지 않는다
      const afterStock = applyMoves(state, action.moves);
      return { ...afterStock, sales: [...afterStock.sales, ...action.sales] };
    }

    case "RECORD_SHIFT_CLOSE": {
      // 실사 반영과 마감 기록은 한 동작으로 처리해야 장부만 바뀌고
      // 기록은 빠지는 중간 상태가 생기지 않는다
      const afterStock = applyMoves(state, action.moves);
      return { ...afterStock, shiftCloses: [...afterStock.shiftCloses, action.close] };
    }

    case "UPDATE_SETTINGS":
      return { ...state, settings: { ...state.settings, ...action.patch } };

    default:
      return state;
  }
}

interface StoreValue {
  data: AppData;
  moveStock: (inputs: StockMoveInput | StockMoveInput[]) => void;
  upsertIngredient: (ingredient: Ingredient) => void;
  deleteIngredient: (id: string) => void;
  upsertSupplier: (supplier: Supplier) => void;
  deleteSupplier: (id: string) => void;
  upsertOrder: (order: PurchaseOrder) => void;
  deleteOrder: (id: string) => void;
  receiveOrder: (order: PurchaseOrder) => void;
  upsertInvoice: (invoice: ScannedInvoice) => void;
  upsertMenu: (menu: MenuItem) => void;
  deleteMenu: (id: string) => void;
  /** 판매 등록 - 매출 기록과 레시피 기반 원재료 차감을 함께 처리한다 */
  recordSales: (cart: { menuItem: MenuItem; servings: number }[], memo?: string) => void;
  /** 일일 마감 - 실사 수량을 반영하고 차이를 기록한다 */
  recordShiftClose: (counts: Record<string, number>, memo?: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetAll: () => void;
  importData: (data: AppData) => void;
  ingredientById: (id: string) => Ingredient | undefined;
  supplierById: (id: string) => Supplier | undefined;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, loadData);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const moveStock = useCallback((inputs: StockMoveInput | StockMoveInput[]) => {
    dispatch({ type: "MOVE_STOCK", inputs: Array.isArray(inputs) ? inputs : [inputs] });
  }, []);

  const receiveOrder = useCallback((order: PurchaseOrder) => {
    dispatch({
      type: "MOVE_STOCK",
      inputs: order.lines.map((line) => ({
        ingredientId: line.ingredientId,
        type: "STOCK_IN" as const,
        quantity: line.quantity,
        reason: "PURCHASE" as ReasonCode,
        unitCost: line.unitCost,
        supplierId: order.supplierId,
        sourceDocId: order.id,
        memo: `발주서 ${order.code} 입고`,
      })),
    });
    dispatch({
      type: "UPSERT_ORDER",
      order: { ...order, status: "RECEIVED", receivedAt: new Date().toISOString() },
    });
  }, []);

  const recordSales = useCallback(
    (cart: { menuItem: MenuItem; servings: number }[], memo?: string) => {
      const date = todayIso();
      const nowIso = new Date().toISOString();
      const sales: SaleRecord[] = [];
      const byId = new Map(data.ingredients.map((i) => [i.id, i]));
      // 같은 원재료를 쓰는 메뉴가 여러 개면 하나의 출고로 합친다
      const consumption = new Map<string, number>();

      for (const { menuItem, servings } of cart) {
        if (servings <= 0) continue;
        const saleId = makeId("sale");
        let unitCost = 0;

        for (const line of menuItem.lines) {
          const ing = byId.get(line.ingredientId);
          if (!ing) continue;
          unitCost += line.quantity * ing.costPerUnit;
          consumption.set(
            line.ingredientId,
            (consumption.get(line.ingredientId) ?? 0) + line.quantity * servings,
          );
        }

        sales.push({
          id: saleId,
          date,
          createdAt: nowIso,
          menuItemId: menuItem.id,
          servings,
          revenue: menuItem.price * servings,
          cost: Math.round(unitCost * servings),
          memo,
        });
      }

      if (sales.length === 0) return;

      const docId = makeId("saledoc");
      const moves: StockMoveInput[] = [...consumption.entries()].map(([ingredientId, qty]) => ({
        ingredientId,
        type: "STOCK_OUT" as const,
        quantity: Number(qty.toFixed(3)),
        reason: "COOKING" as ReasonCode,
        sourceDocId: docId,
        date,
        memo: "메뉴 판매에 따른 자동 차감",
      }));

      dispatch({ type: "RECORD_SALES", sales, moves });
    },
    [data.ingredients],
  );

  const recordShiftClose = useCallback(
    (counts: Record<string, number>, memo?: string) => {
      const lines = buildShiftCloseLines(data.ingredients, counts);
      if (lines.length === 0) return;

      const closeId = makeId("close");
      const date = todayIso();

      // 차이가 난 품목만 실사 값으로 맞춘다
      const moves: StockMoveInput[] = lines.map((l) => ({
        ingredientId: l.ingredientId,
        type: "ADJUSTMENT" as const,
        quantity: Math.abs(l.variance),
        absoluteStock: l.countedStock,
        reason: "COUNT_DIFF" as ReasonCode,
        sourceDocId: closeId,
        date,
        memo: "일일 마감 실사",
      }));

      dispatch({
        type: "RECORD_SHIFT_CLOSE",
        close: {
          id: closeId,
          date,
          closedAt: new Date().toISOString(),
          lines,
          memo,
        },
        moves,
      });
    },
    [data.ingredients],
  );

  const ingredientMap = useMemo(
    () => new Map(data.ingredients.map((i) => [i.id, i])),
    [data.ingredients],
  );
  const supplierMap = useMemo(
    () => new Map(data.suppliers.map((s) => [s.id, s])),
    [data.suppliers],
  );

  const value = useMemo<StoreValue>(
    () => ({
      data,
      moveStock,
      upsertIngredient: (ingredient) => dispatch({ type: "UPSERT_INGREDIENT", ingredient }),
      deleteIngredient: (id) => dispatch({ type: "DELETE_INGREDIENT", id }),
      upsertSupplier: (supplier) => dispatch({ type: "UPSERT_SUPPLIER", supplier }),
      deleteSupplier: (id) => dispatch({ type: "DELETE_SUPPLIER", id }),
      upsertOrder: (order) => dispatch({ type: "UPSERT_ORDER", order }),
      deleteOrder: (id) => dispatch({ type: "DELETE_ORDER", id }),
      receiveOrder,
      upsertInvoice: (invoice) => dispatch({ type: "UPSERT_INVOICE", invoice }),
      upsertMenu: (menu) => dispatch({ type: "UPSERT_MENU", menu }),
      deleteMenu: (id) => dispatch({ type: "DELETE_MENU", id }),
      recordSales,
      recordShiftClose,
      updateSettings: (patch) => dispatch({ type: "UPDATE_SETTINGS", patch }),
      resetAll: () => dispatch({ type: "REPLACE", data: resetData() }),
      importData: (next) => dispatch({ type: "REPLACE", data: next }),
      ingredientById: (id) => ingredientMap.get(id),
      supplierById: (id) => supplierMap.get(id),
    }),
    [data, moveStock, receiveOrder, recordSales, recordShiftClose, ingredientMap, supplierMap],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("StoreProvider 안에서만 사용할 수 있습니다.");
  return ctx;
}
