import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChefHat, Minus, Plus, RotateCcw } from "lucide-react";
import type { PageId } from "../App";
import { useStore } from "../store";
import {
  buildMenuCosts,
  computeConsumption,
  dailySalesSeries,
  menuPerformance,
  summarizeSales,
} from "../lib/menu";
import { menuCategoryLabel, menuCategoryOrder, menuCategoryStyle } from "../lib/labels";
import type { MenuCategory } from "../types";
import { formatNumber, formatPercent, formatWon, todayIso } from "../lib/format";
import { Badge, Button, Card, EmptyState, MiniBar, SectionTitle } from "../components/ui";

export default function Sales({ onNavigate }: { onNavigate: (id: PageId) => void }) {
  const { data, recordSales } = useStore();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [category, setCategory] = useState<MenuCategory | "ALL">("ALL");
  const [error, setError] = useState("");

  const costs = useMemo(
    () => buildMenuCosts(data.menuItems, data.ingredients),
    [data.menuItems, data.ingredients],
  );

  const cartEntries = useMemo(
    () =>
      costs
        .filter((c) => (cart[c.menu.id] ?? 0) > 0)
        .map((c) => ({ menuItem: c.menu, servings: cart[c.menu.id], cost: c })),
    [costs, cart],
  );

  const consumption = useMemo(
    () => computeConsumption(cartEntries, data.ingredients),
    [cartEntries, data.ingredients],
  );

  const shortages = consumption.filter((c) => c.shortage > 0);

  const cartTotals = useMemo(() => {
    let revenue = 0;
    let cost = 0;
    let servings = 0;
    for (const e of cartEntries) {
      revenue += e.menuItem.price * e.servings;
      cost += e.cost.cost * e.servings;
      servings += e.servings;
    }
    return { revenue, cost, margin: revenue - cost, servings };
  }, [cartEntries]);

  const today = todayIso();
  const todaySales = useMemo(
    () => data.sales.filter((s) => s.date === today),
    [data.sales, today],
  );
  const todaySummary = summarizeSales(todaySales);
  const week = useMemo(() => dailySalesSeries(data.sales, 7), [data.sales]);
  const topMenus = useMemo(
    () => menuPerformance(data.menuItems, data.sales, 7).slice(0, 5),
    [data.menuItems, data.sales],
  );

  const bump = (id: string, delta: number) =>
    setCart((c) => {
      const next = Math.max(0, (c[id] ?? 0) + delta);
      const copy = { ...c };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });

  const submit = () => {
    setError("");
    if (cartEntries.length === 0) {
      setError("판매할 메뉴를 선택해주세요.");
      return;
    }
    if (shortages.length > 0) {
      const names = shortages.map((s) => s.ingredient.name).join(", ");
      if (
        !window.confirm(
          `재고가 부족한 재료가 있습니다: ${names}\n그래도 판매를 등록할까요? 재고는 0까지만 차감됩니다.`,
        )
      ) {
        return;
      }
    }
    recordSales(cartEntries.map((e) => ({ menuItem: e.menuItem, servings: e.servings })));
    setCart({});
  };

  if (costs.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<ChefHat className="h-8 w-8" />}
          title="등록된 메뉴가 없습니다"
          description="설정 화면의 메뉴·레시피 탭에서 메뉴를 먼저 등록해주세요"
          action={
            <Button variant="primary" onClick={() => onNavigate("settings")}>
              설정으로 이동
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* 오늘 요약 */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Card className="p-4">
          <div className="text-[12px] text-[#6B7280]">오늘 매출</div>
          <div className="mt-1 text-[20px] font-bold">{formatWon(todaySummary.revenue)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[12px] text-[#6B7280]">오늘 원가</div>
          <div className="mt-1 text-[20px] font-bold text-[#B45309]">
            {formatWon(todaySummary.cost)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[12px] text-[#6B7280]">오늘 마진</div>
          <div className="mt-1 text-[20px] font-bold text-[#16A34A]">
            {formatWon(todaySummary.margin)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[12px] text-[#6B7280]">원가율</div>
          <div className="mt-1 text-[20px] font-bold">
            {formatPercent(todaySummary.costRatio)}
          </div>
          <div className="mt-1 text-[11px] text-[#9CA3AF]">{todaySummary.servings}인분 판매</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* 메뉴 선택 */}
        <Card className="p-5 xl:col-span-2">
          <SectionTitle
            title="판매 등록"
            subtitle="판매한 메뉴와 인분 수를 누르면 재료가 자동으로 차감됩니다"
            right={
              Object.keys(cart).length > 0 ? (
                <Button onClick={() => setCart({})}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  비우기
                </Button>
              ) : undefined
            }
          />

          {/* 메뉴판 구역 그대로 나눠서 빨리 찾게 한다 */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {(["ALL", ...menuCategoryOrder] as const).map((c) => {
              const count = c === "ALL" ? costs.length : costs.filter((x) => x.menu.categoryId === c).length;
              if (c !== "ALL" && count === 0) return null;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    category === c
                      ? "border-transparent bg-[#111827] text-white"
                      : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB]"
                  }`}
                >
                  {c === "ALL" ? "전체" : menuCategoryLabel[c]} {count}
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {costs.filter((c) => category === "ALL" || c.menu.categoryId === category).map((c) => {
              const count = cart[c.menu.id] ?? 0;
              const style = menuCategoryStyle[c.menu.categoryId];
              const soldOut = c.makeableServings === 0;
              return (
                <div
                  key={c.menu.id}
                  className={`rounded-2xl border p-3.5 transition-colors ${
                    count > 0 ? "border-[#0F4C5C] bg-[#0F4C5C]/[0.04]" : "border-[#E5E7EB] bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-bold">{c.menu.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <Badge className={`${style.bg} ${style.text} ${style.border}`}>
                          {menuCategoryLabel[c.menu.categoryId]}
                        </Badge>
                        <span className="text-[11px] text-[#6B7280]">
                          {formatWon(c.menu.price)}
                        </span>
                      </div>
                    </div>
                    {soldOut && (
                      <Badge className="border-[#FFD6C7] bg-[#FFF0EE] text-[#B42318]">
                        재료 부족
                      </Badge>
                    )}
                  </div>

                  <div className="mt-2 text-[11px] text-[#9CA3AF]">
                    원가 {formatWon(c.cost)} · 원가율 {formatPercent(c.costRatio, 0)} · 최대{" "}
                    {formatNumber(c.makeableServings)}인분
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => bump(c.menu.id, -1)}
                      disabled={count === 0}
                      aria-label={`${c.menu.name} 수량 줄이기`}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#4B5563] disabled:opacity-40"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <div className="flex-1 text-center text-[16px] font-bold">{count}</div>
                    <button
                      onClick={() => bump(c.menu.id, 1)}
                      aria-label={`${c.menu.name} 수량 늘리기`}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F4C5C] text-white"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 차감 미리보기 */}
        <Card className="flex flex-col p-5">
          <SectionTitle title="차감될 재료" subtitle="선택한 메뉴에 필요한 재료 합계" />

          {cartEntries.length === 0 ? (
            <EmptyState title="선택한 메뉴가 없습니다" description="왼쪽에서 메뉴를 선택하세요" />
          ) : (
            <>
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[#F8F9FB] p-3 text-center">
                <div>
                  <div className="text-[10px] text-[#9CA3AF]">매출</div>
                  <div className="mt-0.5 text-[13px] font-bold">
                    {formatWon(cartTotals.revenue)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#9CA3AF]">원가</div>
                  <div className="mt-0.5 text-[13px] font-bold text-[#B45309]">
                    {formatWon(cartTotals.cost)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#9CA3AF]">마진</div>
                  <div className="mt-0.5 text-[13px] font-bold text-[#16A34A]">
                    {formatWon(cartTotals.margin)}
                  </div>
                </div>
              </div>

              {shortages.length > 0 && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#FFD6C7] bg-[#FFF0EE] px-3 py-2.5 text-[11px] text-[#B42318]">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {shortages.map((s) => s.ingredient.name).join(", ")}의 재고가 부족합니다.
                  </span>
                </div>
              )}

              <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
                {consumption.map((c) => (
                  <div key={c.ingredient.id} className="rounded-xl border border-[#F3F4F6] px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[12px] font-medium">
                        {c.ingredient.name}
                      </span>
                      <span
                        className={`shrink-0 text-[11px] font-semibold ${
                          c.shortage > 0 ? "text-[#B42318]" : "text-[#4B5563]"
                        }`}
                      >
                        {formatNumber(c.required)}
                        {c.ingredient.unit}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <MiniBar
                        ratio={c.available > 0 ? c.required / c.available : 1}
                        className={c.shortage > 0 ? "bg-[#FF3B30]" : "bg-[#0F4C5C]"}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-[#9CA3AF]">
                      보유 {formatNumber(c.available)}
                      {c.ingredient.unit}
                      {c.shortage > 0 && ` · ${formatNumber(c.shortage)}${c.ingredient.unit} 부족`}
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="primary" onClick={submit} className="mt-4 w-full">
                <Check className="h-3.5 w-3.5" />
                {cartTotals.servings}인분 판매 등록
              </Button>
              {error && (
                <div className="mt-2 rounded-xl border border-[#FFD6C7] bg-[#FFF0EE] px-3 py-2 text-[11px] font-medium text-[#B42318]">
                  {error}
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* 최근 실적 */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="최근 7일 매출" />
          <div className="mt-4 flex h-[150px] items-end gap-2">
            {week.map((d) => {
              const max = Math.max(...week.map((w) => w.revenue), 1);
              return (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="text-[9px] text-[#9CA3AF]">
                    {d.revenue > 0 ? Math.round(d.revenue / 10000) + "만" : ""}
                  </div>
                  <div className="flex w-full flex-col justify-end" style={{ height: "100px" }}>
                    <div
                      className="w-full rounded-t-lg bg-[#0F4C5C]"
                      style={{ height: `${Math.max(4, (d.revenue / max) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-[#9CA3AF]">
                    {new Date(`${d.date}T00:00:00`).toLocaleDateString("ko-KR", {
                      weekday: "short",
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="최근 7일 인기 메뉴" subtitle="마진 기여 순" />
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
                    <span className="shrink-0 text-[11px] text-[#6B7280]">{m.servings}인분</span>
                  </div>
                  <div className="mt-1.5">
                    <MiniBar
                      ratio={m.margin / (topMenus[0]?.margin || 1)}
                      className="bg-[#16A34A]"
                    />
                  </div>
                </div>
                <div className="w-[76px] shrink-0 text-right text-[11px] text-[#9CA3AF]">
                  {formatWon(m.margin)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
