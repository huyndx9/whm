import type {
  AppData,
  Ingredient,
  MenuItem,
  SaleRecord,
  Supplier,
  Transaction,
} from "../types";
import { addDays, todayIso } from "./format";

export const DEFAULT_SETTINGS: AppData["settings"] = {
  restaurantName: "택이네 조개전골",
  safetyDays: 2,
  forecastWindowDays: 21,
  expiryWarningDays: 3,
  ocrProvider: "demo",
  claudeApiKey: "",
  claudeModel: "claude-opus-5",
};

const suppliers: Supplier[] = [
  { id: "sup-busan", name: "부산수산", phone: "051-123-4567", address: "부산 자갈치", specialty: "신선 조개·연체류", leadTimeDays: 1, orderCutoff: "15:00", active: true },
  { id: "sup-tongyeong", name: "통영수산", phone: "055-234-5678", address: "경남 통영시", specialty: "가리비, 전복", leadTimeDays: 2, orderCutoff: "14:00", active: true },
  { id: "sup-namhae", name: "남해수산", phone: "055-345-6789", address: "경남 남해군", specialty: "굴, 조개류", leadTimeDays: 2, orderCutoff: "14:00", active: true },
  { id: "sup-yeosu", name: "여수수산", phone: "061-456-7890", address: "전남 여수시", specialty: "여수 돌문어, 산낙지", leadTimeDays: 1, orderCutoff: "13:00", active: true },
  { id: "sup-pyeongtaek", name: "평택농장", phone: "031-456-7890", address: "경기 평택시", specialty: "신선 채소·김치", leadTimeDays: 1, orderCutoff: "17:00", active: true },
  { id: "sup-nonghyup", name: "농협유통", phone: "02-567-8901", address: "서울 농협", specialty: "육류, 가공식품, 양념", leadTimeDays: 2, orderCutoff: "16:00", active: true },
  { id: "sup-wando", name: "완도수산", phone: "061-678-9012", address: "전남 완도군", specialty: "다시마, 해조류", leadTimeDays: 3, orderCutoff: "13:00", active: true },
  { id: "sup-hite", name: "하이트진로 도매", phone: "02-3210-5555", address: "서울 청담", specialty: "주류, 음료", leadTimeDays: 2, orderCutoff: "12:00", active: true },
];

type SeedIngredient = Omit<Ingredient, "expiryDate"> & { shelfLifeDays: number };

/**
 * 단가는 실제 도매가 수준으로 맞춰 두었다.
 * 레시피 원가가 이 값으로 계산되므로 여기 숫자가 곧 원가율이 된다.
 */
const baseIngredients: SeedIngredient[] = [
  // 조개·해산물
  { id: "ing-01", name: "바지락", note: "국물용 조개", categoryId: "SEAFOOD", unit: "kg", stock: 14, minStock: 6, parStock: 36, costPerUnit: 9000, supplierId: "sup-busan", location: "냉장고 A1", active: true, shelfLifeDays: 2 },
  { id: "ing-02", name: "모시조개", note: "전골용 조개", categoryId: "SEAFOOD", unit: "kg", stock: 4, minStock: 5, parStock: 28, costPerUnit: 12000, supplierId: "sup-busan", location: "냉장고 A1", active: true, shelfLifeDays: 1 },
  { id: "ing-03", name: "가리비", note: "구이·전골용", categoryId: "SEAFOOD", unit: "kg", stock: 8, minStock: 4, parStock: 16, costPerUnit: 22000, supplierId: "sup-tongyeong", location: "냉장고 A2", active: true, shelfLifeDays: 2 },
  { id: "ing-04", name: "굴", note: "생굴", categoryId: "SEAFOOD", unit: "kg", stock: 1.5, minStock: 3, parStock: 8, costPerUnit: 18000, supplierId: "sup-namhae", location: "냉장고 A2", active: true, shelfLifeDays: 1 },
  { id: "ing-05", name: "낙지", note: "산낙지", categoryId: "SEAFOOD", unit: "kg", stock: 4, minStock: 2, parStock: 8, costPerUnit: 24000, supplierId: "sup-yeosu", location: "냉장고 B1", active: true, shelfLifeDays: 2 },
  { id: "ing-06", name: "새우", note: "흰다리새우·튀김용", categoryId: "SEAFOOD", unit: "kg", stock: 6, minStock: 3, parStock: 12, costPerUnit: 22000, supplierId: "sup-busan", location: "냉장고 B1", active: true, shelfLifeDays: 2 },
  { id: "ing-07", name: "오징어", note: "튀김용 물오징어", categoryId: "SEAFOOD", unit: "kg", stock: 0, minStock: 2, parStock: 6, costPerUnit: 15000, supplierId: "sup-busan", location: "냉장고 B1", active: true, shelfLifeDays: 2 },
  { id: "ing-19", name: "돌문어", note: "여수 산지 직송", categoryId: "SEAFOOD", unit: "kg", stock: 3, minStock: 1.5, parStock: 6, costPerUnit: 24000, supplierId: "sup-yeosu", location: "냉장고 A2", active: true, shelfLifeDays: 2 },
  { id: "ing-20", name: "전복", note: "토핑용 활전복", categoryId: "SEAFOOD", unit: "개", stock: 30, minStock: 14, parStock: 60, costPerUnit: 1000, supplierId: "sup-tongyeong", location: "냉장고 A2", active: true, shelfLifeDays: 3 },

  // 육류
  { id: "ing-21", name: "소고기 샤브용", note: "얇게 썬 우삼겹", categoryId: "MEAT", unit: "kg", stock: 4, minStock: 2, parStock: 8, costPerUnit: 24000, supplierId: "sup-nonghyup", location: "냉장고 B2", active: true, shelfLifeDays: 3 },
  { id: "ing-22", name: "삼겹살", note: "삼합구이용", categoryId: "MEAT", unit: "kg", stock: 6, minStock: 3, parStock: 12, costPerUnit: 14000, supplierId: "sup-nonghyup", location: "냉장고 B2", active: true, shelfLifeDays: 4 },

  // 채소
  { id: "ing-08", name: "팽이버섯", note: "전골·샤브용", categoryId: "VEGETABLE", unit: "봉", stock: 20, minStock: 12, parStock: 60, costPerUnit: 900, supplierId: "sup-nonghyup", location: "냉장 창고", active: true, shelfLifeDays: 5 },
  { id: "ing-09", name: "배추", note: "알배기 배추", categoryId: "VEGETABLE", unit: "kg", stock: 20, minStock: 10, parStock: 40, costPerUnit: 2500, supplierId: "sup-pyeongtaek", location: "냉장 창고", active: true, shelfLifeDays: 7 },
  { id: "ing-10", name: "미나리", note: "전골·칼국수용", categoryId: "VEGETABLE", unit: "kg", stock: 8, minStock: 5, parStock: 16, costPerUnit: 5000, supplierId: "sup-pyeongtaek", location: "냉장 창고", active: true, shelfLifeDays: 3 },
  { id: "ing-11", name: "대파", note: "국물용 대파", categoryId: "VEGETABLE", unit: "kg", stock: 10, minStock: 5, parStock: 20, costPerUnit: 3500, supplierId: "sup-pyeongtaek", location: "냉장 창고", active: true, shelfLifeDays: 6 },
  { id: "ing-12", name: "청양고추", note: "전골·칼국수 기본", categoryId: "VEGETABLE", unit: "kg", stock: 3, minStock: 2, parStock: 8, costPerUnit: 8000, supplierId: "sup-nonghyup", location: "냉장 창고", active: true, shelfLifeDays: 6 },
  { id: "ing-13", name: "깻잎", note: "삼합·낙지 곁들임", categoryId: "VEGETABLE", unit: "kg", stock: 2, minStock: 2, parStock: 6, costPerUnit: 10000, supplierId: "sup-pyeongtaek", location: "냉장 창고", active: true, shelfLifeDays: 4 },
  { id: "ing-23", name: "김치", note: "삼합·볶음밥용", categoryId: "VEGETABLE", unit: "kg", stock: 10, minStock: 5, parStock: 20, costPerUnit: 4000, supplierId: "sup-pyeongtaek", location: "냉장 창고", active: true, shelfLifeDays: 30 },

  // 육수·양념
  { id: "ing-14", name: "사골 육수", note: "전골·칼국수 베이스", categoryId: "BROTH", unit: "L", stock: 40, minStock: 20, parStock: 100, costPerUnit: 2500, supplierId: "sup-nonghyup", location: "냉동고 C1", active: true, shelfLifeDays: 60 },
  { id: "ing-15", name: "다시마", note: "건다시마", categoryId: "BROTH", unit: "kg", stock: 2, minStock: 1, parStock: 6, costPerUnit: 15000, supplierId: "sup-wando", location: "건조 창고", active: true, shelfLifeDays: 240 },
  { id: "ing-16", name: "된장", note: "재래식 된장", categoryId: "SAUCE", unit: "kg", stock: 5, minStock: 2, parStock: 10, costPerUnit: 6000, supplierId: "sup-nonghyup", location: "건조 창고", active: true, shelfLifeDays: 180 },
  { id: "ing-17", name: "고춧가루", note: "얼큰 국물용", categoryId: "SAUCE", unit: "kg", stock: 4, minStock: 2, parStock: 8, costPerUnit: 15000, supplierId: "sup-nonghyup", location: "건조 창고", active: true, shelfLifeDays: 120 },
  { id: "ing-18", name: "참기름", note: "볶음밥·양념용", categoryId: "SAUCE", unit: "병", stock: 10, minStock: 5, parStock: 20, costPerUnit: 7000, supplierId: "sup-nonghyup", location: "건조 창고", active: true, shelfLifeDays: 365 },

  // 면·가공식품·유제품
  { id: "ing-24", name: "칼국수면", note: "생면", categoryId: "NOODLE", unit: "kg", stock: 8, minStock: 4, parStock: 16, costPerUnit: 3000, supplierId: "sup-nonghyup", location: "냉장 창고", active: true, shelfLifeDays: 5 },
  { id: "ing-25", name: "군만두", note: "냉동 6개 1인분", categoryId: "PROCESSED", unit: "개", stock: 120, minStock: 60, parStock: 240, costPerUnit: 300, supplierId: "sup-nonghyup", location: "냉동고 C1", active: true, shelfLifeDays: 180 },
  { id: "ing-26", name: "돈까스", note: "냉동 등심 돈까스", categoryId: "PROCESSED", unit: "개", stock: 20, minStock: 10, parStock: 40, costPerUnit: 2200, supplierId: "sup-nonghyup", location: "냉동고 C1", active: true, shelfLifeDays: 180 },
  { id: "ing-27", name: "오뎅", note: "사각 어묵", categoryId: "PROCESSED", unit: "개", stock: 80, minStock: 40, parStock: 160, costPerUnit: 150, supplierId: "sup-nonghyup", location: "냉장 창고", active: true, shelfLifeDays: 10 },
  { id: "ing-28", name: "햇반", note: "즉석밥 210g", categoryId: "PROCESSED", unit: "개", stock: 60, minStock: 30, parStock: 120, costPerUnit: 800, supplierId: "sup-nonghyup", location: "건조 창고", active: true, shelfLifeDays: 365 },
  { id: "ing-29", name: "쌀", note: "볶음밥용", categoryId: "ETC", unit: "kg", stock: 20, minStock: 10, parStock: 40, costPerUnit: 3000, supplierId: "sup-nonghyup", location: "건조 창고", active: true, shelfLifeDays: 365 },
  { id: "ing-30", name: "모짜렐라 치즈", note: "치즈 토핑용", categoryId: "DAIRY", unit: "kg", stock: 3, minStock: 1, parStock: 6, costPerUnit: 12000, supplierId: "sup-nonghyup", location: "냉장 창고", active: true, shelfLifeDays: 30 },

  // 주류·음료
  { id: "ing-31", name: "소주", note: "참이슬·처음처럼", categoryId: "BEVERAGE", unit: "병", stock: 96, minStock: 48, parStock: 192, costPerUnit: 1400, supplierId: "sup-hite", location: "주류 창고", active: true, shelfLifeDays: 365 },
  { id: "ing-32", name: "맥주", note: "테라·카스 500ml", categoryId: "BEVERAGE", unit: "병", stock: 72, minStock: 36, parStock: 144, costPerUnit: 1800, supplierId: "sup-hite", location: "주류 창고", active: true, shelfLifeDays: 365 },
  { id: "ing-33", name: "청하", note: "청주", categoryId: "BEVERAGE", unit: "병", stock: 24, minStock: 12, parStock: 48, costPerUnit: 2500, supplierId: "sup-hite", location: "주류 창고", active: true, shelfLifeDays: 365 },
  { id: "ing-34", name: "매화수", note: "매실주", categoryId: "BEVERAGE", unit: "병", stock: 18, minStock: 10, parStock: 36, costPerUnit: 2800, supplierId: "sup-hite", location: "주류 창고", active: true, shelfLifeDays: 365 },
  { id: "ing-35", name: "음료수", note: "콜라·사이다 캔", categoryId: "BEVERAGE", unit: "개", stock: 60, minStock: 30, parStock: 120, costPerUnit: 700, supplierId: "sup-hite", location: "주류 창고", active: true, shelfLifeDays: 365 },
];

/** 조개전골 4인분 베이스. 스페셜 메뉴가 이 위에 토핑을 얹는다 */
const HOTPOT_4 = [
  { ingredientId: "ing-01", quantity: 0.8 },
  { ingredientId: "ing-02", quantity: 0.55 },
  { ingredientId: "ing-03", quantity: 0.15 },
  { ingredientId: "ing-14", quantity: 2.6 },
  { ingredientId: "ing-09", quantity: 0.5 },
  { ingredientId: "ing-10", quantity: 0.25 },
  { ingredientId: "ing-11", quantity: 0.15 },
  { ingredientId: "ing-12", quantity: 0.04 },
  { ingredientId: "ing-08", quantity: 2 },
  { ingredientId: "ing-15", quantity: 0.02 },
];

/** 조개칼국수 1인분 베이스 */
const KALGUKSU = [
  { ingredientId: "ing-01", quantity: 0.15 },
  { ingredientId: "ing-24", quantity: 0.2 },
  { ingredientId: "ing-14", quantity: 0.7 },
  { ingredientId: "ing-11", quantity: 0.03 },
  { ingredientId: "ing-10", quantity: 0.03 },
  { ingredientId: "ing-15", quantity: 0.005 },
  { ingredientId: "ing-12", quantity: 0.01 },
];

/**
 * 실제 매장 메뉴판 그대로.
 * 재료 소요량은 원가율 30~45% 가 나오도록 잡은 추정치이며, 설정 > 메뉴·레시피에서
 * 실제 레시피에 맞게 고칠 수 있다.
 */
const menuItems: MenuItem[] = [
  // ─── 조개전골 ────────────────────────────────────────────────
  {
    id: "menu-hp2", name: "조개전골 (2인)", note: "기본 조개전골", categoryId: "HOTPOT", price: 49000, active: true,
    lines: [
      { ingredientId: "ing-01", quantity: 0.5 }, { ingredientId: "ing-02", quantity: 0.35 },
      { ingredientId: "ing-03", quantity: 0.1 }, { ingredientId: "ing-14", quantity: 1.5 },
      { ingredientId: "ing-09", quantity: 0.3 }, { ingredientId: "ing-10", quantity: 0.15 },
      { ingredientId: "ing-11", quantity: 0.1 }, { ingredientId: "ing-12", quantity: 0.02 },
      { ingredientId: "ing-08", quantity: 1 }, { ingredientId: "ing-15", quantity: 0.01 },
    ],
  },
  {
    id: "menu-hp3", name: "조개전골 (3인)", note: "기본 조개전골", categoryId: "HOTPOT", price: 60000, active: true,
    lines: [
      { ingredientId: "ing-01", quantity: 0.65 }, { ingredientId: "ing-02", quantity: 0.45 },
      { ingredientId: "ing-03", quantity: 0.12 }, { ingredientId: "ing-14", quantity: 2 },
      { ingredientId: "ing-09", quantity: 0.4 }, { ingredientId: "ing-10", quantity: 0.2 },
      { ingredientId: "ing-11", quantity: 0.12 }, { ingredientId: "ing-12", quantity: 0.03 },
      { ingredientId: "ing-08", quantity: 2 }, { ingredientId: "ing-15", quantity: 0.015 },
    ],
  },
  { id: "menu-hp4", name: "조개전골 (4인)", note: "기본 조개전골", categoryId: "HOTPOT", price: 71000, active: true, lines: HOTPOT_4 },
  {
    id: "menu-hp-special", name: "스페셜 조개전골", note: "4인 + 토핑 1가지 (낙지 기준으로 계산)", categoryId: "HOTPOT", price: 82000, active: true,
    lines: [...HOTPOT_4, { ingredientId: "ing-05", quantity: 0.3 }],
  },
  {
    id: "menu-hp-octopus", name: "스페셜 문어", note: "4인 + 문어", categoryId: "HOTPOT", price: 87000, active: true,
    lines: [...HOTPOT_4, { ingredientId: "ing-19", quantity: 0.4 }],
  },
  {
    id: "menu-hp-emperor", name: "황제 스페셜", note: "4인 + 낙지·전복·문어·소고기", categoryId: "HOTPOT", price: 110000, active: true,
    lines: [
      ...HOTPOT_4,
      { ingredientId: "ing-05", quantity: 0.25 }, { ingredientId: "ing-20", quantity: 5 },
      { ingredientId: "ing-19", quantity: 0.25 }, { ingredientId: "ing-21", quantity: 0.15 },
    ],
  },

  // ─── 조개삼합구이 ─────────────────────────────────────────────
  {
    id: "menu-gr-s", name: "조개삼합구이 小 (2인)", note: "조개 + 삼겹살 + 김치", categoryId: "GRILL", price: 59000, active: true,
    lines: [
      { ingredientId: "ing-01", quantity: 0.4 }, { ingredientId: "ing-02", quantity: 0.3 },
      { ingredientId: "ing-03", quantity: 0.3 }, { ingredientId: "ing-06", quantity: 0.2 },
      { ingredientId: "ing-22", quantity: 0.3 }, { ingredientId: "ing-23", quantity: 0.2 },
      { ingredientId: "ing-11", quantity: 0.05 }, { ingredientId: "ing-12", quantity: 0.02 },
    ],
  },
  {
    id: "menu-gr-m", name: "조개삼합구이 中 (3인)", note: "조개 + 삼겹살 + 김치", categoryId: "GRILL", price: 74000, active: true,
    lines: [
      { ingredientId: "ing-01", quantity: 0.55 }, { ingredientId: "ing-02", quantity: 0.4 },
      { ingredientId: "ing-03", quantity: 0.4 }, { ingredientId: "ing-06", quantity: 0.28 },
      { ingredientId: "ing-22", quantity: 0.4 }, { ingredientId: "ing-23", quantity: 0.28 },
      { ingredientId: "ing-11", quantity: 0.07 }, { ingredientId: "ing-12", quantity: 0.03 },
    ],
  },
  {
    id: "menu-gr-l", name: "조개삼합구이 大 (3~4인)", note: "조개 + 삼겹살 + 김치", categoryId: "GRILL", price: 89000, active: true,
    lines: [
      { ingredientId: "ing-01", quantity: 0.7 }, { ingredientId: "ing-02", quantity: 0.5 },
      { ingredientId: "ing-03", quantity: 0.5 }, { ingredientId: "ing-06", quantity: 0.35 },
      { ingredientId: "ing-22", quantity: 0.5 }, { ingredientId: "ing-23", quantity: 0.35 },
      { ingredientId: "ing-11", quantity: 0.08 }, { ingredientId: "ing-12", quantity: 0.04 },
    ],
  },
  { id: "menu-gr-meat", name: "고기추가", note: "조개삼합 토핑", categoryId: "GRILL", price: 15000, active: true, lines: [{ ingredientId: "ing-22", quantity: 0.3 }] },
  {
    id: "menu-gr-seafood", name: "해물추가", note: "조개삼합 토핑", categoryId: "GRILL", price: 20000, active: true,
    lines: [{ ingredientId: "ing-06", quantity: 0.15 }, { ingredientId: "ing-03", quantity: 0.15 }, { ingredientId: "ing-07", quantity: 0.1 }],
  },
  {
    id: "menu-gr-rice", name: "볶음밥", note: "조개삼합 토핑", categoryId: "GRILL", price: 3000, active: true,
    lines: [{ ingredientId: "ing-29", quantity: 0.12 }, { ingredientId: "ing-23", quantity: 0.05 }, { ingredientId: "ing-18", quantity: 0.01 }, { ingredientId: "ing-11", quantity: 0.01 }],
  },

  // ─── 칼국수 (2인 이상 주문 가능) ────────────────────────────────
  { id: "menu-kg", name: "조개칼국수", note: "2인 이상 주문", categoryId: "NOODLE_DISH", price: 11000, active: true, lines: KALGUKSU },
  { id: "menu-kg-spicy", name: "얼큰조개칼국수", note: "2인 이상 주문", categoryId: "NOODLE_DISH", price: 11000, active: true, lines: [...KALGUKSU, { ingredientId: "ing-17", quantity: 0.015 }] },
  { id: "menu-kg-mix", name: "모듬칼국수", note: "조개칼국수 + 소고기샤브", categoryId: "NOODLE_DISH", price: 13000, active: true, lines: [...KALGUKSU, { ingredientId: "ing-21", quantity: 0.05 }] },
  { id: "menu-kg-mix-spicy", name: "얼큰모듬칼국수", note: "얼큰조개칼국수 + 소고기샤브", categoryId: "NOODLE_DISH", price: 13000, active: true, lines: [...KALGUKSU, { ingredientId: "ing-17", quantity: 0.015 }, { ingredientId: "ing-21", quantity: 0.05 }] },

  // ─── 토핑메뉴 ─────────────────────────────────────────────────
  { id: "menu-tp-oct-s", name: "살아있는 여수돌문어 小", note: "무게에 따라 가격 변동 가능", categoryId: "TOPPING", price: 30000, active: true, lines: [{ ingredientId: "ing-19", quantity: 0.5 }] },
  { id: "menu-tp-oct-l", name: "살아있는 여수돌문어 大", note: "무게에 따라 가격 변동 가능", categoryId: "TOPPING", price: 40000, active: true, lines: [{ ingredientId: "ing-19", quantity: 0.75 }] },
  { id: "menu-tp-nakji", name: "산낙지", note: "전골 토핑", categoryId: "TOPPING", price: 15000, active: true, lines: [{ ingredientId: "ing-05", quantity: 0.25 }] },
  { id: "menu-tp-abalone", name: "전복 (7미)", note: "전골 토핑", categoryId: "TOPPING", price: 15000, active: true, lines: [{ ingredientId: "ing-20", quantity: 7 }] },
  { id: "menu-tp-octopus", name: "문어", note: "전골 토핑", categoryId: "TOPPING", price: 20000, active: true, lines: [{ ingredientId: "ing-19", quantity: 0.35 }] },
  {
    id: "menu-tp-beef", name: "소고기샤브 (300g+야채)", note: "전골 토핑", categoryId: "TOPPING", price: 20000, active: true,
    lines: [{ ingredientId: "ing-21", quantity: 0.3 }, { ingredientId: "ing-09", quantity: 0.1 }, { ingredientId: "ing-08", quantity: 1 }],
  },
  { id: "menu-tp-clam", name: "조개추가", note: "전골 토핑", categoryId: "TOPPING", price: 11000, active: true, lines: [{ ingredientId: "ing-01", quantity: 0.25 }, { ingredientId: "ing-02", quantity: 0.15 }] },

  // ─── 사이드메뉴 ───────────────────────────────────────────────
  { id: "menu-sd-mandu", name: "군만두 (6개)", note: "", categoryId: "SIDE", price: 5000, active: true, lines: [{ ingredientId: "ing-25", quantity: 6 }] },
  { id: "menu-sd-squid", name: "오징어튀김 (1마리)", note: "", categoryId: "SIDE", price: 8000, active: true, lines: [{ ingredientId: "ing-07", quantity: 0.2 }] },
  { id: "menu-sd-shrimp", name: "새우튀김 (10마리)", note: "", categoryId: "SIDE", price: 10000, active: true, lines: [{ ingredientId: "ing-06", quantity: 0.15 }] },
  { id: "menu-sd-tonkatsu", name: "돈까스", note: "", categoryId: "SIDE", price: 8000, active: true, lines: [{ ingredientId: "ing-26", quantity: 1 }, { ingredientId: "ing-09", quantity: 0.05 }] },
  { id: "menu-sd-cheese-tonkatsu", name: "치즈돈까스", note: "", categoryId: "SIDE", price: 9000, active: true, lines: [{ ingredientId: "ing-26", quantity: 1 }, { ingredientId: "ing-30", quantity: 0.05 }, { ingredientId: "ing-09", quantity: 0.05 }] },
  { id: "menu-sd-noodle", name: "칼국수사리", note: "전골에 추가", categoryId: "SIDE", price: 2500, active: true, lines: [{ ingredientId: "ing-24", quantity: 0.2 }] },
  { id: "menu-sd-cheese", name: "치즈추가", note: "전골·삼합 공통", categoryId: "SIDE", price: 3000, active: true, lines: [{ ingredientId: "ing-30", quantity: 0.08 }] },
  { id: "menu-sd-odeng", name: "오뎅추가 (1개)", note: "", categoryId: "SIDE", price: 500, active: true, lines: [{ ingredientId: "ing-27", quantity: 1 }] },
  { id: "menu-sd-veg", name: "야채추가", note: "", categoryId: "SIDE", price: 2000, active: true, lines: [{ ingredientId: "ing-09", quantity: 0.1 }, { ingredientId: "ing-08", quantity: 0.5 }] },
  { id: "menu-sd-rice", name: "공깃밥 (햇반)", note: "", categoryId: "SIDE", price: 2000, active: true, lines: [{ ingredientId: "ing-28", quantity: 1 }] },

  // ─── 주류 ─────────────────────────────────────────────────────
  { id: "menu-dr-soju", name: "소주", note: "", categoryId: "DRINK", price: 5000, active: true, lines: [{ ingredientId: "ing-31", quantity: 1 }] },
  { id: "menu-dr-beer", name: "맥주", note: "", categoryId: "DRINK", price: 5000, active: true, lines: [{ ingredientId: "ing-32", quantity: 1 }] },
  { id: "menu-dr-chungha", name: "청하", note: "", categoryId: "DRINK", price: 6000, active: true, lines: [{ ingredientId: "ing-33", quantity: 1 }] },
  { id: "menu-dr-maehwasu", name: "매화수", note: "", categoryId: "DRINK", price: 6000, active: true, lines: [{ ingredientId: "ing-34", quantity: 1 }] },
  { id: "menu-dr-soft", name: "음료수", note: "콜라·사이다", categoryId: "DRINK", price: 2000, active: true, lines: [{ ingredientId: "ing-35", quantity: 1 }] },
];

/** 재현 가능한 난수 - 새로고침해도 데모 데이터가 흔들리지 않는다 */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 메뉴별 하루 평균 판매 수량 (평일 기준). 없는 메뉴는 1 로 본다 */
const BASE_SERVINGS: Record<string, number> = {
  "menu-hp2": 10, "menu-hp3": 5, "menu-hp4": 4, "menu-hp-special": 2, "menu-hp-octopus": 1.5, "menu-hp-emperor": 0.7,
  "menu-gr-s": 4, "menu-gr-m": 2, "menu-gr-l": 2, "menu-gr-meat": 2, "menu-gr-seafood": 1.5, "menu-gr-rice": 6,
  "menu-kg": 8, "menu-kg-spicy": 6, "menu-kg-mix": 3, "menu-kg-mix-spicy": 2,
  "menu-tp-oct-s": 1, "menu-tp-oct-l": 0.7, "menu-tp-nakji": 3, "menu-tp-abalone": 2, "menu-tp-octopus": 2, "menu-tp-beef": 3, "menu-tp-clam": 4,
  "menu-sd-mandu": 5, "menu-sd-squid": 3, "menu-sd-shrimp": 4, "menu-sd-tonkatsu": 3, "menu-sd-cheese-tonkatsu": 2,
  "menu-sd-noodle": 8, "menu-sd-cheese": 3, "menu-sd-odeng": 6, "menu-sd-veg": 3, "menu-sd-rice": 15,
  "menu-dr-soju": 20, "menu-dr-beer": 15, "menu-dr-chungha": 3, "menu-dr-maehwasu": 2, "menu-dr-soft": 8,
};

/** 원재료 분류별 입고 주기(일) */
const RESTOCK_EVERY: Record<Ingredient["categoryId"], number> = {
  SEAFOOD: 2,
  VEGETABLE: 3,
  MEAT: 3,
  DAIRY: 5,
  NOODLE: 3,
  PROCESSED: 7,
  BROTH: 7,
  SAUCE: 14,
  BEVERAGE: 7,
  ETC: 14,
};

interface History {
  transactions: Transaction[];
  sales: SaleRecord[];
}

/**
 * 지난 60일 이력을 만든다.
 * 핵심: 출고는 임의로 만들지 않고 **판매 → 레시피 → 원재료 차감** 순서로 생성한다.
 * 그래야 매출·원가·재고 사용량이 서로 앞뒤가 맞는다.
 */
function buildHistory(ingredients: Ingredient[]): History {
  const rand = makeRandom(20260911);
  const transactions: Transaction[] = [];
  const sales: SaleRecord[] = [];
  const today = todayIso();
  const HISTORY_DAYS = 60;
  const ingById = new Map(ingredients.map((i) => [i.id, i]));

  for (let back = HISTORY_DAYS; back >= 0; back--) {
    const date = addDays(today, -back);
    const weekday = new Date(`${date}T00:00:00`).getDay(); // 0=일
    // 금·토 성수기, 일요일 준성수기, 평일은 한산한 식당 패턴
    const weekdayFactor =
      weekday === 5 ? 1.5 : weekday === 6 ? 1.6 : weekday === 0 ? 1.2 : 0.8;
    // 오늘은 아직 영업 중이므로 일부만 반영
    const dayFactor = back === 0 ? 0.35 : 1;

    const used = new Map<string, number>();

    for (const menu of menuItems) {
      const base = BASE_SERVINGS[menu.id] ?? 1;
      const noise = 0.75 + rand() * 0.5;
      const servings = Math.max(0, Math.round(base * weekdayFactor * noise * dayFactor));
      if (servings === 0) continue;

      let unitCost = 0;
      for (const line of menu.lines) {
        const ing = ingById.get(line.ingredientId);
        if (!ing) continue;
        unitCost += line.quantity * ing.costPerUnit;
        used.set(line.ingredientId, (used.get(line.ingredientId) ?? 0) + line.quantity * servings);
      }

      sales.push({
        id: `seed-sale-${menu.id}-${back}`,
        date,
        createdAt: `${date}T20:00:00`,
        menuItemId: menu.id,
        servings,
        revenue: menu.price * servings,
        cost: Math.round(unitCost * servings),
      });
    }

    for (const [ingredientId, qty] of used) {
      const ing = ingById.get(ingredientId);
      if (!ing || qty <= 0) continue;
      const rounded = Number(qty.toFixed(2));
      transactions.push({
        id: `seed-out-${ingredientId}-${back}`,
        date,
        createdAt: `${date}T20:05:00`,
        ingredientId,
        type: "STOCK_OUT",
        quantity: rounded,
        unitCost: ing.costPerUnit,
        amount: Math.round(rounded * ing.costPerUnit),
        reason: "COOKING",
        memo: "메뉴 판매에 따른 자동 차감",
        sourceDocId: `seed-day-${back}`,
      });
    }

    // 가끔 발생하는 폐기·직원 식사 (신선 재료 위주)
    if (back > 0 && rand() > 0.72) {
      const fresh = ingredients.filter((i) => i.categoryId === "SEAFOOD" || i.categoryId === "VEGETABLE");
      const pick = fresh[Math.floor(rand() * fresh.length)];
      const qty = Number((0.2 + rand() * 0.8).toFixed(1));
      transactions.push({
        id: `seed-waste-${back}`,
        date,
        createdAt: `${date}T22:00:00`,
        ingredientId: pick.id,
        type: "STOCK_OUT",
        quantity: qty,
        unitCost: pick.costPerUnit,
        amount: Math.round(qty * pick.costPerUnit),
        reason: rand() > 0.45 ? "DISPOSAL" : "STAFF_MEAL",
      });
    }

    // 분류별 주기에 맞춘 입고
    if (back > 0) {
      for (const ing of ingredients) {
        const every = RESTOCK_EVERY[ing.categoryId];
        if (back % every !== 0) continue;
        const dailyNeed = (used.get(ing.id) ?? 0) || ing.parStock * 0.08;
        const qty = Number((dailyNeed * every * 1.05).toFixed(ing.unit === "개" || ing.unit === "병" || ing.unit === "봉" ? 0 : 1));
        if (qty <= 0) continue;
        transactions.push({
          id: `seed-in-${ing.id}-${back}`,
          date,
          createdAt: `${date}T08:00:00`,
          ingredientId: ing.id,
          type: "STOCK_IN",
          quantity: qty,
          unitCost: ing.costPerUnit,
          amount: Math.round(qty * ing.costPerUnit),
          reason: "PURCHASE",
          supplierId: ing.supplierId,
        });
      }
    }
  }

  transactions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  sales.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { transactions, sales };
}

export function createSeedData(): AppData {
  const today = todayIso();
  const ingredients: Ingredient[] = baseIngredients.map(({ shelfLifeDays, ...rest }) => ({
    ...rest,
    expiryDate: addDays(today, Math.max(0, shelfLifeDays - (shelfLifeDays > 30 ? 10 : 1))),
  }));

  const { transactions, sales } = buildHistory(ingredients);

  return {
    version: 3,
    ingredients,
    suppliers,
    transactions,
    purchaseOrders: [],
    invoices: [],
    menuItems,
    sales,
    shiftCloses: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}
