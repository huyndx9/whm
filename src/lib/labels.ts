// 화면에 렌더링되는 모든 enum 값은 이 파일을 거쳐 한국어로 변환된다.
import type {
  AdjustmentReason,
  CategoryId,
  ExpiryStatus,
  MenuCategory,
  OcrProviderId,
  PurchaseOrderStatus,
  ReasonCode,
  StockInReason,
  StockOutReason,
  StockStatus,
  TransactionType,
} from "../types";

export const transactionTypeLabel: Record<TransactionType, string> = {
  STOCK_IN: "입고",
  STOCK_OUT: "출고",
  ADJUSTMENT: "재고 조정",
};

export const stockOutReasonLabel: Record<StockOutReason, string> = {
  COOKING: "조리 사용",
  DISPOSAL: "폐기",
  LOSS: "손실",
  SAMPLE: "샘플",
  STAFF_MEAL: "직원 식사",
  ETC: "기타",
};

export const adjustmentReasonLabel: Record<AdjustmentReason, string> = {
  COUNT_DIFF: "실사 차이",
  DAMAGE: "파손",
  LOST: "분실",
  DISPOSAL: "폐기",
  SYSTEM_ERROR: "시스템 오류",
  ETC: "기타",
};

export const stockInReasonLabel: Record<StockInReason, string> = {
  PURCHASE: "매입",
  RETURN_IN: "반품 입고",
  SCAN: "영수증 스캔",
  ETC: "기타",
};

const allReasonLabels: Record<string, string> = {
  ...stockOutReasonLabel,
  ...adjustmentReasonLabel,
  ...stockInReasonLabel,
};

export function reasonLabel(code: ReasonCode | string): string {
  return allReasonLabels[code] ?? "기타";
}

export const categoryLabel: Record<CategoryId, string> = {
  SEAFOOD: "해산물",
  VEGETABLE: "채소",
  MEAT: "육류",
  SAUCE: "소스/양념",
  BROTH: "육수",
  NOODLE: "면류",
  PROCESSED: "가공식품",
  DAIRY: "유제품",
  BEVERAGE: "주류/음료",
  ETC: "기타",
};

export const categoryOrder: CategoryId[] = [
  "SEAFOOD",
  "VEGETABLE",
  "MEAT",
  "SAUCE",
  "BROTH",
  "NOODLE",
  "PROCESSED",
  "DAIRY",
  "BEVERAGE",
  "ETC",
];

export const menuCategoryLabel: Record<MenuCategory, string> = {
  HOTPOT: "조개전골",
  GRILL: "조개삼합구이",
  NOODLE_DISH: "칼국수",
  TOPPING: "토핑",
  SIDE: "사이드",
  DRINK: "주류",
};

export const menuCategoryOrder: MenuCategory[] = [
  "HOTPOT",
  "GRILL",
  "NOODLE_DISH",
  "TOPPING",
  "SIDE",
  "DRINK",
];

export const menuCategoryStyle: Record<MenuCategory, { bg: string; text: string; border: string }> = {
  HOTPOT: { bg: "bg-[#ECFEFF]", text: "text-[#0F4C5C]", border: "border-[#A5F3FC]" },
  GRILL: { bg: "bg-[#FEF2F2]", text: "text-[#DC2626]", border: "border-[#FECACA]" },
  NOODLE_DISH: { bg: "bg-[#FFF7ED]", text: "text-[#EA580C]", border: "border-[#FED7AA]" },
  TOPPING: { bg: "bg-[#F5F3FF]", text: "text-[#7C3AED]", border: "border-[#DDD6FE]" },
  SIDE: { bg: "bg-[#F0FDF4]", text: "text-[#16A34A]", border: "border-[#BBF7D0]" },
  DRINK: { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]", border: "border-[#BFDBFE]" },
};

export const stockStatusLabel: Record<StockStatus, string> = {
  OK: "정상",
  LOW: "재고 부족",
  OUT: "품절",
};

export const expiryStatusLabel: Record<ExpiryStatus, string> = {
  FRESH: "여유",
  SOON: "유통기한 임박",
  TODAY: "오늘 만료",
  EXPIRED: "유통기한 경과",
};

export const purchaseOrderStatusLabel: Record<PurchaseOrderStatus, string> = {
  DRAFT: "작성 중",
  SENT: "발주 완료",
  RECEIVED: "입고 완료",
  CANCELLED: "취소",
};

export const ocrProviderLabel: Record<OcrProviderId, string> = {
  claude: "Claude 이미지 인식 (정확도 높음)",
  tesseract: "기기 내 인식 (오프라인, 무료)",
  demo: "예시 데이터 (설정 없이 체험)",
};

/** 화면에 보이는 카테고리별 색상 팔레트 */
export const categoryStyle: Record<
  CategoryId,
  { bg: string; text: string; border: string; dot: string; solid: string }
> = {
  SEAFOOD: {
    bg: "bg-[#ECFEFF]",
    text: "text-[#0E7490]",
    border: "border-[#A5F3FC]",
    dot: "bg-[#0E7490]",
    solid: "bg-[#0E7490]",
  },
  VEGETABLE: {
    bg: "bg-[#F0FDF4]",
    text: "text-[#16A34A]",
    border: "border-[#BBF7D0]",
    dot: "bg-[#16A34A]",
    solid: "bg-[#16A34A]",
  },
  MEAT: {
    bg: "bg-[#FEF2F2]",
    text: "text-[#DC2626]",
    border: "border-[#FECACA]",
    dot: "bg-[#DC2626]",
    solid: "bg-[#DC2626]",
  },
  SAUCE: {
    bg: "bg-[#FFF7ED]",
    text: "text-[#EA580C]",
    border: "border-[#FED7AA]",
    dot: "bg-[#EA580C]",
    solid: "bg-[#EA580C]",
  },
  BROTH: {
    bg: "bg-[#ECFEFF]",
    text: "text-[#0F4C5C]",
    border: "border-[#A5F3FC]",
    dot: "bg-[#0F4C5C]",
    solid: "bg-[#0F4C5C]",
  },
  NOODLE: {
    bg: "bg-[#FEFCE8]",
    text: "text-[#A16207]",
    border: "border-[#FDE68A]",
    dot: "bg-[#CA8A04]",
    solid: "bg-[#CA8A04]",
  },
  PROCESSED: {
    bg: "bg-[#F5F3FF]",
    text: "text-[#7C3AED]",
    border: "border-[#DDD6FE]",
    dot: "bg-[#7C3AED]",
    solid: "bg-[#7C3AED]",
  },
  DAIRY: {
    bg: "bg-[#FEFCE8]",
    text: "text-[#A16207]",
    border: "border-[#FDE68A]",
    dot: "bg-[#CA8A04]",
    solid: "bg-[#CA8A04]",
  },
  BEVERAGE: {
    bg: "bg-[#EFF6FF]",
    text: "text-[#1D4ED8]",
    border: "border-[#BFDBFE]",
    dot: "bg-[#1D4ED8]",
    solid: "bg-[#1D4ED8]",
  },
  ETC: {
    bg: "bg-[#F9FAFB]",
    text: "text-[#6B7280]",
    border: "border-[#E5E7EB]",
    dot: "bg-[#6B7280]",
    solid: "bg-[#6B7280]",
  },
};

export const stockStatusStyle: Record<StockStatus, { bg: string; text: string; dot: string }> = {
  OK: { bg: "bg-[#F0FDF4]", text: "text-[#16A34A]", dot: "bg-[#00C950]" },
  LOW: { bg: "bg-[#FFF4E5]", text: "text-[#B45309]", dot: "bg-[#FF9500]" },
  OUT: { bg: "bg-[#FFF0EE]", text: "text-[#B42318]", dot: "bg-[#FF3B30]" },
};

export const expiryStatusStyle: Record<ExpiryStatus, { bg: string; text: string; border: string }> = {
  FRESH: { bg: "bg-[#F9FAFB]", text: "text-[#6B7280]", border: "border-[#E5E7EB]" },
  SOON: { bg: "bg-[#FFF4E5]", text: "text-[#9C5A1A]", border: "border-[#FFE9C7]" },
  TODAY: { bg: "bg-[#FFF0EE]", text: "text-[#B42318]", border: "border-[#FFD6C7]" },
  EXPIRED: { bg: "bg-[#FFF0EE]", text: "text-[#B42318]", border: "border-[#FFD6C7]" },
};

export const purchaseOrderStatusStyle: Record<
  PurchaseOrderStatus,
  { bg: string; text: string; border: string }
> = {
  DRAFT: { bg: "bg-[#F3F4F6]", text: "text-[#6B7280]", border: "border-[#E5E7EB]" },
  SENT: { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]", border: "border-[#BFDBFE]" },
  RECEIVED: { bg: "bg-[#F0FDF4]", text: "text-[#16A34A]", border: "border-[#BBF7D0]" },
  CANCELLED: { bg: "bg-[#FFF0EE]", text: "text-[#B42318]", border: "border-[#FFD6C7]" },
};
