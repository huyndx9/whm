import { useMemo, useState } from "react";
import {
  Download,
  PackageMinus,
  PackagePlus,
  Pencil,
  Plus,
  Scale,
  Search,
} from "lucide-react";
import type { CategoryId, Ingredient, StockStatus, TransactionType } from "../types";
import type { ForecastRow } from "../lib/forecast";
import { useStore } from "../store";
import { categoryLabel, stockStatusLabel } from "../lib/labels";
import { daysUntil, formatNumber, formatWon } from "../lib/format";
import { Button, Card, EmptyState, MiniBar, Select, TextInput } from "../components/ui";
import { CategoryBadge, ExpiryBadge, StockStatusBadge } from "../components/badges";
import IngredientModal from "../components/IngredientModal";
import StockMoveModal from "../components/StockMoveModal";
import { downloadCsv } from "../lib/csv";

type StatusFilter = "ALL" | StockStatus | "EXPIRING";

export default function Inventory({ rows }: { rows: ForecastRow[] }) {
  const { data } = useStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId | "ALL">("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [creating, setCreating] = useState(false);
  const [move, setMove] = useState<{ type: TransactionType; id?: string } | null>(null);

  const categories = useMemo(() => {
    const set = new Map<CategoryId, number>();
    for (const r of rows) set.set(r.ingredient.categoryId, (set.get(r.ingredient.categoryId) ?? 0) + 1);
    return [...set.entries()];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const i = r.ingredient;
      const matchQ =
        !q ||
        i.name.toLowerCase().includes(q) ||
        i.note.toLowerCase().includes(q) ||
        (r.supplier?.name.toLowerCase().includes(q) ?? false);
      const matchC = category === "ALL" || i.categoryId === category;
      const matchS =
        status === "ALL" ||
        (status === "EXPIRING" ? r.expiryStatus !== "FRESH" : r.stockStatus === status);
      return matchQ && matchC && matchS;
    });
  }, [rows, query, category, status]);

  const exportCsv = () => {
    downloadCsv(
      `재고현황-${data.settings.restaurantName}`,
      [
        "원재료명",
        "품목 설명",
        "분류",
        "현재 재고",
        "단위",
        "최소 재고",
        "적정 재고",
        "재고 상태",
        "유통기한",
        "남은 일수",
        "공급업체",
        "보관 위치",
        "단가",
        "재고 금액",
        "일 평균 사용량",
        "소진 예상일",
      ],
      filtered.map((r) => [
        r.ingredient.name,
        r.ingredient.note,
        categoryLabel[r.ingredient.categoryId],
        r.ingredient.stock,
        r.ingredient.unit,
        r.ingredient.minStock,
        r.ingredient.parStock,
        stockStatusLabel[r.stockStatus],
        r.ingredient.expiryDate,
        daysUntil(r.ingredient.expiryDate),
        r.supplier?.name ?? "",
        r.ingredient.location,
        r.ingredient.costPerUnit,
        Math.round(r.ingredient.stock * r.ingredient.costPerUnit),
        r.stats.dailyUsage.toFixed(2),
        r.stockoutDate ?? "",
      ]),
    );
  };

  const statusFilters: { id: StatusFilter; label: string }[] = [
    { id: "ALL", label: "전체" },
    { id: "OK", label: "정상" },
    { id: "LOW", label: "재고 부족" },
    { id: "OUT", label: "품절" },
    { id: "EXPIRING", label: "유통기한 임박" },
  ];

  return (
    <div className="space-y-4">
      {/* 검색 및 동작 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="원재료, 공급업체 검색..."
            className="pl-9"
          />
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5" />
          원재료 등록
        </Button>
        <Button onClick={() => setMove({ type: "STOCK_IN" })}>
          <PackagePlus className="h-3.5 w-3.5" />
          입고
        </Button>
        <Button onClick={() => setMove({ type: "STOCK_OUT" })}>
          <PackageMinus className="h-3.5 w-3.5" />
          출고
        </Button>
        <Button onClick={() => setMove({ type: "ADJUSTMENT" })}>
          <Scale className="h-3.5 w-3.5" />
          재고 조정
        </Button>
        <Button onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" />
          CSV 내보내기
        </Button>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryId | "ALL")}
          className="w-auto"
        >
          <option value="ALL">전체 분류 ({rows.length})</option>
          {categories.map(([c, n]) => (
            <option key={c} value={c}>
              {categoryLabel[c]} ({n})
            </option>
          ))}
        </Select>
        <div className="flex flex-wrap gap-1.5">
          {statusFilters.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatus(f.id)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                status === f.id
                  ? "border-transparent bg-[#111827] text-white"
                  : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#F3F4F6] px-5 py-3">
          <h3 className="text-[14px] font-semibold">재고 목록</h3>
          <span className="whitespace-nowrap rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-medium text-[#6B7280]">
            {filtered.length}개 품목
          </span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="조건에 맞는 원재료가 없습니다"
            description="검색어나 필터를 바꿔보세요"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left">
              <thead>
                <tr className="border-b border-[#F3F4F6] text-[11px] font-semibold tracking-wide text-[#9CA3AF]">
                  <th className="px-5 py-2.5">원재료</th>
                  <th className="px-3 py-2.5">재고</th>
                  <th className="px-3 py-2.5">상태</th>
                  <th className="px-3 py-2.5">유통기한</th>
                  <th className="px-3 py-2.5">소진 예상</th>
                  <th className="px-3 py-2.5">단가</th>
                  <th className="px-3 py-2.5 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {filtered.map((r) => {
                  const i = r.ingredient;
                  const ratio = i.parStock > 0 ? i.stock / i.parStock : 0;
                  return (
                    <tr key={i.id} className="hover:bg-[#FAFBFC]">
                      <td className="px-5 py-3">
                        <div className="text-[13px] font-semibold">{i.name}</div>
                        <div className="text-[11px] text-[#6B7280]">{i.note}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <CategoryBadge categoryId={i.categoryId} />
                          <span className="whitespace-nowrap text-[10px] text-[#9CA3AF]">
                            {i.location}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="whitespace-nowrap text-[13px] font-semibold">
                          {formatNumber(i.stock)}
                          <span className="ml-0.5 text-[11px] font-medium text-[#6B7280]">
                            {i.unit}
                          </span>
                        </div>
                        <div className="mt-1 w-[90px]">
                          <MiniBar
                            ratio={ratio}
                            className={
                              r.stockStatus === "OUT"
                                ? "bg-[#FF3B30]"
                                : r.stockStatus === "LOW"
                                  ? "bg-[#FF9500]"
                                  : "bg-[#0F4C5C]"
                            }
                          />
                        </div>
                        <div className="mt-0.5 whitespace-nowrap text-[10px] text-[#9CA3AF]">
                          최소 {formatNumber(i.minStock)}
                          {i.unit} · 적정 {formatNumber(i.parStock)}
                          {i.unit}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <StockStatusBadge status={r.stockStatus} />
                      </td>
                      <td className="px-3 py-3">
                        <ExpiryBadge days={daysUntil(i.expiryDate)} status={r.expiryStatus} />
                        <div className="mt-1 whitespace-nowrap text-[10px] text-[#9CA3AF]">
                          {i.expiryDate}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {r.daysUntilStockout === null ? (
                          <span className="text-[11px] text-[#9CA3AF]">사용 기록 없음</span>
                        ) : (
                          <>
                            <div className="whitespace-nowrap text-[12px] font-semibold">
                              {Math.floor(r.daysUntilStockout)}일 후
                            </div>
                            <div className="whitespace-nowrap text-[10px] text-[#9CA3AF]">
                              하루 {formatNumber(r.stats.dailyUsage)}
                              {i.unit} 사용
                            </div>
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#374151]">
                        {formatWon(i.costPerUnit)}/{i.unit}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <IconBtn
                            title="입고"
                            onClick={() => setMove({ type: "STOCK_IN", id: i.id })}
                          >
                            <PackagePlus className="h-3.5 w-3.5" />
                          </IconBtn>
                          <IconBtn
                            title="출고"
                            onClick={() => setMove({ type: "STOCK_OUT", id: i.id })}
                          >
                            <PackageMinus className="h-3.5 w-3.5" />
                          </IconBtn>
                          <IconBtn title="수정" onClick={() => setEditing(i)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </IconBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <IngredientModal
        open={creating || editing !== null}
        ingredient={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
      <StockMoveModal
        open={move !== null}
        type={move?.type ?? "STOCK_IN"}
        initialIngredientId={move?.id}
        onClose={() => setMove(null)}
      />
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB]"
    >
      {children}
    </button>
  );
}
