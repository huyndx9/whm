import { useMemo, useState } from "react";
import { Download, Info, TrendingDown, TrendingUp, Trash2 } from "lucide-react";
import type { ForecastRow } from "../lib/forecast";
import { inventoryTurnover } from "../lib/forecast";
import { useStore } from "../store";
import {
  formatNumber,
  formatPercent,
  formatSignedPercent,
  formatWon,
} from "../lib/format";
import { Badge, Card, EmptyState, MiniBar, SectionTitle, Select, Button } from "../components/ui";
import { CategoryBadge } from "../components/badges";
import { downloadCsv } from "../lib/csv";

type SortKey = "urgency" | "stockout" | "usage" | "waste";

export default function Forecast({ rows }: { rows: ForecastRow[] }) {
  const { data } = useStore();
  const [sort, setSort] = useState<SortKey>("urgency");

  const sorted = useMemo(() => {
    const copy = [...rows];
    switch (sort) {
      case "stockout":
        return copy.sort((a, b) => {
          const av = a.daysUntilStockout ?? Number.POSITIVE_INFINITY;
          const bv = b.daysUntilStockout ?? Number.POSITIVE_INFINITY;
          return av - bv;
        });
      case "usage":
        return copy.sort((a, b) => b.stats.dailyUsage - a.stats.dailyUsage);
      case "waste":
        return copy.sort((a, b) => b.stats.wasteRate - a.stats.wasteRate);
      default:
        return copy.sort((a, b) => b.urgency - a.urgency);
    }
  }, [rows, sort]);

  const summary = useMemo(() => {
    const totalWasteQty = rows.reduce((a, r) => a + r.stats.disposalQty, 0);
    const totalOut = rows.reduce((a, r) => a + r.stats.totalOut, 0);
    const wasteRate = totalOut > 0 ? (totalWasteQty / totalOut) * 100 : 0;
    const wasteCost = rows.reduce(
      (a, r) => a + r.stats.disposalQty * r.ingredient.costPerUnit,
      0,
    );
    const atRiskCost = rows.reduce((a, r) => a + r.atRiskQty * r.ingredient.costPerUnit, 0);
    const turnover = inventoryTurnover(
      data.ingredients,
      data.transactions,
      data.settings.forecastWindowDays,
    );
    return { wasteRate, wasteCost, atRiskCost, turnover };
  }, [rows, data.ingredients, data.transactions, data.settings.forecastWindowDays]);

  const exportCsv = () => {
    downloadCsv(
      "수요예측",
      [
        "원재료",
        "현재 재고",
        "단위",
        "일 평균 사용량",
        "최근 7일 평균",
        "직전 7일 평균",
        "증감률(%)",
        "소진 예상일수",
        "소진 예상일",
        "재주문점",
        "권장 발주 수량",
        "권장 발주 금액",
        "예측 신뢰도",
        "폐기율(%)",
      ],
      sorted.map((r) => [
        r.ingredient.name,
        r.ingredient.stock,
        r.ingredient.unit,
        r.stats.dailyUsage.toFixed(2),
        r.stats.recentDaily.toFixed(2),
        r.stats.previousDaily.toFixed(2),
        r.stats.trendPercent.toFixed(1),
        r.daysUntilStockout !== null ? Math.floor(r.daysUntilStockout) : "",
        r.stockoutDate ?? "",
        r.reorderPoint.toFixed(1),
        r.recommendedQty,
        r.recommendedCost,
        r.stats.confidence,
        r.stats.wasteRate.toFixed(1),
      ]),
    );
  };

  return (
    <div className="space-y-4">
      <Card className="flex items-start gap-3 border-[#BFDBFE] bg-[#EFF6FF] p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1D4ED8]" />
        <div className="text-[12px] leading-relaxed text-[#1E3A8A]">
          최근 <strong>{data.settings.forecastWindowDays}일</strong>의 출고 기록을 가중 평균해
          하루 사용량을 계산합니다. 폐기·손실은 수요에서 제외하고 별도의 폐기율로 보여 줍니다.
          재주문점은 <strong>리드타임 + 안전 {data.settings.safetyDays}일</strong> 동안 쓸 양에 최소
          재고를 더한 값입니다.
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="text-[12px] text-[#6B7280]">폐기율</div>
          <div className="mt-1 text-[20px] font-bold">{formatPercent(summary.wasteRate)}</div>
          <div className="mt-1 text-[11px] text-[#9CA3AF]">
            폐기 손실 {formatWon(summary.wasteCost)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[12px] text-[#6B7280]">유통기한 내 소진 불가 예상</div>
          <div className="mt-1 text-[20px] font-bold text-[#B45309]">
            {formatWon(summary.atRiskCost)}
          </div>
          <div className="mt-1 text-[11px] text-[#9CA3AF]">지금 사용 속도 기준</div>
        </Card>
        <Card className="p-4">
          <div className="text-[12px] text-[#6B7280]">재고 회전율</div>
          <div className="mt-1 text-[20px] font-bold">{summary.turnover.toFixed(2)}회</div>
          <div className="mt-1 text-[11px] text-[#9CA3AF]">
            최근 {data.settings.forecastWindowDays}일 기준
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[12px] text-[#6B7280]">발주 필요 품목</div>
          <div className="mt-1 text-[20px] font-bold text-[#B42318]">
            {rows.filter((r) => r.needsOrder).length}종
          </div>
          <div className="mt-1 text-[11px] text-[#9CA3AF]">
            예상 금액 {formatWon(rows.reduce((a, r) => a + r.recommendedCost, 0))}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-auto">
          <option value="urgency">위험도 순</option>
          <option value="stockout">소진 임박 순</option>
          <option value="usage">사용량 많은 순</option>
          <option value="waste">폐기율 높은 순</option>
        </Select>
        <Button onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" />
          CSV 내보내기
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-[#F3F4F6] px-5 py-3">
          <SectionTitle title="품목별 수요 예측" subtitle="소진 예상 시점과 권장 발주량" />
        </div>
        {sorted.length === 0 ? (
          <EmptyState title="예측할 품목이 없습니다" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-[#F3F4F6] text-[11px] font-semibold tracking-wide text-[#9CA3AF]">
                  <th className="px-5 py-2.5">원재료</th>
                  <th className="px-3 py-2.5">하루 사용량</th>
                  <th className="px-3 py-2.5">추세</th>
                  <th className="px-3 py-2.5">소진 예상</th>
                  <th className="px-3 py-2.5">재주문점</th>
                  <th className="px-3 py-2.5">권장 발주</th>
                  <th className="px-3 py-2.5">폐기율</th>
                  <th className="px-3 py-2.5">신뢰도</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {sorted.map((r) => (
                  <tr key={r.ingredient.id} className="hover:bg-[#FAFBFC]">
                    <td className="px-5 py-3">
                      <div className="text-[13px] font-semibold">{r.ingredient.name}</div>
                      <div className="mt-1">
                        <CategoryBadge categoryId={r.ingredient.categoryId} />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-[12px]">
                      <span className="font-semibold">{formatNumber(r.stats.dailyUsage)}</span>
                      <span className="text-[#6B7280]">{r.ingredient.unit}/일</span>
                    </td>
                    <td className="px-3 py-3">
                      {r.stats.previousDaily === 0 ? (
                        <span className="text-[11px] text-[#9CA3AF]">-</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium ${
                            r.stats.trendPercent > 5
                              ? "text-[#B42318]"
                              : r.stats.trendPercent < -5
                                ? "text-[#16A34A]"
                                : "text-[#6B7280]"
                          }`}
                        >
                          {r.stats.trendPercent >= 0 ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5" />
                          )}
                          {formatSignedPercent(r.stats.trendPercent, 0)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {r.daysUntilStockout === null ? (
                        <span className="text-[11px] text-[#9CA3AF]">사용 기록 없음</span>
                      ) : (
                        <>
                          <div
                            className={`whitespace-nowrap text-[12px] font-semibold ${
                              r.daysUntilStockout <= 2 ? "text-[#B42318]" : ""
                            }`}
                          >
                            {Math.floor(r.daysUntilStockout)}일 후
                          </div>
                          <div className="whitespace-nowrap text-[10px] text-[#9CA3AF]">
                            {r.stockoutDate}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-[12px] text-[#4B5563]">
                      {formatNumber(r.reorderPoint)}
                      {r.ingredient.unit}
                    </td>
                    <td className="px-3 py-3">
                      {r.needsOrder ? (
                        <>
                          <div className="whitespace-nowrap text-[12px] font-bold text-[#B45309]">
                            {formatNumber(r.recommendedQty)}
                            {r.ingredient.unit}
                          </div>
                          <div className="whitespace-nowrap text-[10px] text-[#9CA3AF]">
                            {formatWon(r.recommendedCost)}
                          </div>
                        </>
                      ) : (
                        <span className="text-[11px] text-[#9CA3AF]">불필요</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1 whitespace-nowrap text-[12px] ${
                          r.stats.wasteRate > 10 ? "font-semibold text-[#B42318]" : "text-[#6B7280]"
                        }`}
                      >
                        {r.stats.wasteRate > 10 && <Trash2 className="h-3.5 w-3.5" />}
                        {formatPercent(r.stats.wasteRate, 0)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="w-[64px]">
                        <MiniBar
                          ratio={r.stats.confidence}
                          className={
                            r.stats.confidence >= 0.7
                              ? "bg-[#16A34A]"
                              : r.stats.confidence >= 0.4
                                ? "bg-[#FF9500]"
                                : "bg-[#D1D5DB]"
                          }
                        />
                      </div>
                      <Badge className="mt-1 border-transparent bg-transparent px-0 text-[10px] text-[#9CA3AF]">
                        {r.stats.confidence >= 0.7
                          ? "높음"
                          : r.stats.confidence >= 0.4
                            ? "보통"
                            : "낮음"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
