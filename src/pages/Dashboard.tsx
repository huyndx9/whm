import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ChefHat,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { PageId } from "../App";
import type { ForecastRow } from "../lib/forecast";
import { costByCategory, totalInventoryValue } from "../lib/forecast";
import {
  dailySalesSeries,
  menuPerformance,
  salesHeatmap,
  salesInRange,
  summarizeSales,
} from "../lib/menu";
import { useStore } from "../store";
import {
  daysUntil,
  formatDateShort,
  formatNumber,
  formatSignedPercent,
  formatWon,
  formatWonShort,
  formatWeekday,
  todayIso,
} from "../lib/format";
import { categoryLabel } from "../lib/labels";
import { Button, Card, EmptyState, MiniBar, SectionTitle } from "../components/ui";
import { ExpiryBadge, StockStatusBadge } from "../components/badges";
import {
  ChartLegend,
  CostRatioBullet,
  ShareBars,
  StackedRevenueChart,
  VIZ,
  WeekdayHeatmap,
} from "../components/charts";

const RANGES = [
  { days: 7, label: "7일" },
  { days: 14, label: "14일" },
  { days: 30, label: "30일" },
];

export default function Dashboard({
  rows,
  onNavigate,
}: {
  rows: ForecastRow[];
  onNavigate: (id: PageId) => void;
}) {
  const { data } = useStore();
  const [range, setRange] = useState(14);

  const today = todayIso();

  const todaySummary = useMemo(
    () => summarizeSales(data.sales.filter((s) => s.date === today)),
    [data.sales, today],
  );

  const rangeSummary = useMemo(
    () => summarizeSales(salesInRange(data.sales, range)),
    [data.sales, range],
  );

  const prevSummary = useMemo(() => {
    const all = salesInRange(data.sales, range * 2);
    const recent = new Set(salesInRange(data.sales, range).map((s) => s.id));
    return summarizeSales(all.filter((s) => !recent.has(s.id)));
  }, [data.sales, range]);

  const revenueTrend =
    prevSummary.revenue > 0
      ? ((rangeSummary.revenue - prevSummary.revenue) / prevSummary.revenue) * 100
      : 0;

  const inventoryValue = useMemo(
    () => totalInventoryValue(data.ingredients),
    [data.ingredients],
  );

  const lowCount = rows.filter((r) => r.stockStatus !== "OK").length;
  const expiringCount = rows.filter((r) => r.expiryStatus !== "FRESH").length;
  const needOrder = rows.filter((r) => r.needsOrder);

  const chartData = useMemo(
    () =>
      dailySalesSeries(data.sales, range).map((d) => ({
        id: d.date,
        label: formatWeekday(d.date),
        fullLabel: `${formatDateShort(d.date)} (${formatWeekday(d.date)})`,
        cost: d.cost,
        margin: Math.max(0, d.margin),
        highlight: d.date === today,
      })),
    [data.sales, range, today],
  );

  const heat = useMemo(() => salesHeatmap(data.sales, 8), [data.sales]);

  const byCat = useMemo(() => {
    const all = costByCategory(data.ingredients, data.transactions, range);
    // 상위 4개만 개별로 보여 주고 나머지는 묶는다
    const top = all.slice(0, 4);
    const rest = all.slice(4);
    if (rest.length === 0) return top.map((c) => ({ ...c, name: categoryLabel[c.categoryId] }));
    const restCost = rest.reduce((a, c) => a + c.cost, 0);
    const restPct = rest.reduce((a, c) => a + c.percent, 0);
    return [
      ...top.map((c) => ({ ...c, name: categoryLabel[c.categoryId] })),
      { categoryId: "ETC" as const, cost: restCost, percent: restPct, name: "그 외" },
    ];
  }, [data.ingredients, data.transactions, range]);

  const topMenus = useMemo(
    () => menuPerformance(data.menuItems, data.sales, range).slice(0, 5),
    [data.menuItems, data.sales, range],
  );

  const attention = rows.filter((r) => r.urgency > 0).slice(0, 6);

  return (
    <div className="space-y-5">
      {/* 기간 선택 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-[#52514e]">분석 기간</span>
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setRange(r.days)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                range === r.days
                  ? "border-transparent bg-[#0F4C5C] text-white"
                  : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB]"
              }`}
            >
              최근 {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* 핵심 지표 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#52514e]">오늘 매출</span>
            <ChefHat className="h-4 w-4 text-[#898781]" />
          </div>
          <div className="mt-2 text-[24px] font-bold leading-none tracking-tight">
            {formatWon(todaySummary.revenue)}
          </div>
          <div className="mt-2 text-[11px] text-[#898781]">
            {todaySummary.servings}인분 · 마진 {formatWon(todaySummary.margin)}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#52514e]">
              최근 {range}일 원가율
            </span>
          </div>
          <div className="mt-2">
            <CostRatioBullet value={rangeSummary.costRatio} />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#52514e]">총 재고 금액</span>
            <Wallet className="h-4 w-4 text-[#898781]" />
          </div>
          <div className="mt-2 text-[24px] font-bold leading-none tracking-tight">
            {formatWon(inventoryValue)}
          </div>
          <div className="mt-2 text-[11px] text-[#898781]">
            원재료 {data.ingredients.filter((i) => i.active).length}종
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#52514e]">확인 필요</span>
            <AlertTriangle
              className="h-4 w-4"
              style={{ color: lowCount + expiringCount > 0 ? VIZ.critical : VIZ.good }}
            />
          </div>
          <div className="mt-2 text-[24px] font-bold leading-none tracking-tight">
            {lowCount + expiringCount}건
          </div>
          <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-[#898781]">
            <span className="inline-flex items-center gap-1">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: VIZ.warning }}
              />
              재고 부족 {lowCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: VIZ.critical }}
              />
              유통기한 {expiringCount}
            </span>
          </div>
        </Card>
      </div>

      {/* 조치 필요 배너 */}
      {attention.length > 0 && (
        <Card className="border-[#FFD6C7] bg-gradient-to-br from-[#FFF7F2] to-[#FFEFEB] p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF6B35] text-white">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[13px] font-bold">
                  오늘 확인 필요 — {rows.filter((r) => r.urgency > 0).length}건
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {attention.map((r) => (
                    <span
                      key={r.ingredient.id}
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-[#FFD6C7] bg-white px-2 py-1 text-[11px] font-medium text-[#9C3A1A]"
                    >
                      {r.ingredient.name}
                      <span className="text-[#B45309]">
                        {r.stockStatus === "OUT"
                          ? "품절"
                          : r.stockStatus === "LOW"
                            ? "재고 부족"
                            : `유통기한 ${daysUntil(r.ingredient.expiryDate)}일`}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 lg:ml-auto">
              <Button variant="primary" onClick={() => onNavigate("orders")}>
                <ShoppingCart className="h-3.5 w-3.5" />
                발주하기
              </Button>
              <Button onClick={() => onNavigate("inventory")}>재고 보기</Button>
            </div>
          </div>
        </Card>
      )}

      {/* 매출 구성 추이 */}
      <Card className="p-5">
        <SectionTitle
          title="매출 구성 추이"
          subtitle="막대 전체 높이가 매출이고, 아래쪽이 원가입니다"
          right={
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#E5E7EB] bg-[#F8F9FB] px-2.5 py-1 text-[11px] font-medium text-[#52514e]">
              {revenueTrend >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" style={{ color: VIZ.good }} />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" style={{ color: VIZ.critical }} />
              )}
              직전 {range}일 대비 {formatSignedPercent(revenueTrend)}
            </span>
          }
        />

        <div className="mt-3">
          <ChartLegend
            items={[
              { color: VIZ.margin, label: "마진" },
              { color: VIZ.cost, label: "원가" },
            ]}
          />
        </div>

        <div className="mt-2">
          <StackedRevenueChart data={chartData} formatValue={formatWonShort} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label={`최근 ${range}일 매출`} value={formatWon(rangeSummary.revenue)} />
          <MiniStat label="원가 합계" value={formatWon(rangeSummary.cost)} />
          <MiniStat label="마진 합계" value={formatWon(rangeSummary.margin)} />
          <MiniStat
            label="권장 발주 금액"
            value={formatWon(rows.reduce((a, r) => a + r.recommendedCost, 0))}
            tone={needOrder.length > 0 ? "warn" : "default"}
          />
        </div>
      </Card>

      {/* 요일 패턴 + 분류별 비중 */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <SectionTitle
            title="요일별 매출 패턴"
            subtitle="색이 진할수록 매출이 높은 날입니다"
          />
          <div className="mt-4">
            <WeekdayHeatmap cells={heat} weeks={8} formatValue={formatWon} />
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle
            title={`최근 ${range}일 분류별 원가`}
            subtitle="어떤 분류에 돈이 가장 많이 쓰였는지"
          />
          <div className="mt-4">
            {byCat.length === 0 ? (
              <EmptyState title="사용 내역이 없습니다" />
            ) : (
              <ShareBars
                items={byCat.map((c) => ({
                  label: c.name,
                  value: c.cost,
                  percent: c.percent,
                }))}
                formatValue={formatWon}
              />
            )}
          </div>
        </Card>
      </div>

      {/* 메뉴 실적 + 조치 필요 */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title={`최근 ${range}일 메뉴 실적`} subtitle="마진 기여 순" />
          <div className="mt-4 space-y-3">
            {topMenus.length === 0 && <EmptyState title="판매 기록이 없습니다" />}
            {topMenus.map((m, i) => (
              <div key={m.menu.id} className="flex items-center gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-[11px] font-bold">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12px] font-semibold">{m.menu.name}</span>
                    <span className="shrink-0 text-[11px] text-[#898781]">
                      {m.servings}인분 · 원가율 {m.costRatio.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <MiniBar
                      ratio={m.margin / (topMenus[0]?.margin || 1)}
                      className="bg-[#2a78d6]"
                    />
                  </div>
                </div>
                <div className="w-[80px] shrink-0 text-right text-[11px] text-[#52514e]">
                  {formatWon(m.margin)}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col p-5">
          <SectionTitle title="조치가 필요한 품목" subtitle="위험도 순" />
          <div className="mt-4 flex-1 space-y-2.5">
            {attention.length === 0 && (
              <EmptyState title="알림 없음" description="재고 상태가 안정적입니다 🎉" />
            )}
            {attention.map((r) => (
              <div
                key={r.ingredient.id}
                className="flex items-center gap-3 rounded-xl border border-[#F3F4F6] px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-semibold">{r.ingredient.name}</div>
                  <div className="mt-0.5 truncate text-[11px] text-[#898781]">
                    재고 {formatNumber(r.ingredient.stock)}
                    {r.ingredient.unit}
                    {r.daysUntilStockout !== null &&
                      ` · ${Math.floor(r.daysUntilStockout)}일 후 소진`}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StockStatusBadge status={r.stockStatus} />
                  {r.expiryStatus !== "FRESH" && (
                    <ExpiryBadge
                      days={daysUntil(r.ingredient.expiryDate)}
                      status={r.expiryStatus}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
          {rows.filter((r) => r.urgency > 0).length > attention.length && (
            <button
              onClick={() => onNavigate("inventory")}
              className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[#0F4C5C] hover:underline"
            >
              전체 보기 <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </Card>
      </div>

    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn";
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        tone === "warn" ? "border-[#FFE9C7] bg-[#FFF4E5]" : "border-[#E5E7EB] bg-[#F8F9FB]"
      }`}
    >
      <div className="text-[11px] text-[#52514e]">{label}</div>
      <div className="mt-1 text-[14px] font-bold">{value}</div>
    </div>
  );
}
