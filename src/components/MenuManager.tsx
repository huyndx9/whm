import { useMemo, useState } from "react";
import { AlertTriangle, ChefHat, Pencil, Plus } from "lucide-react";
import type { MenuItem } from "../types";
import { useStore } from "../store";
import { buildMenuCosts } from "../lib/menu";
import { menuCategoryLabel, menuCategoryStyle } from "../lib/labels";
import { formatNumber, formatPercent, formatWon } from "../lib/format";
import { Badge, Button, Card, EmptyState, MiniBar, SectionTitle } from "./ui";
import MenuModal from "./MenuModal";

export default function MenuManager() {
  const { data } = useStore();
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [creating, setCreating] = useState(false);

  const costs = useMemo(
    () => buildMenuCosts(data.menuItems, data.ingredients),
    [data.menuItems, data.ingredients],
  );

  const avgRatio = useMemo(() => {
    const valid = costs.filter((c) => c.menu.price > 0);
    if (valid.length === 0) return 0;
    return valid.reduce((a, c) => a + c.costRatio, 0) / valid.length;
  }, [costs]);

  return (
    <div className="space-y-4">
      <SectionTitle
        title="메뉴 · 레시피"
        subtitle="메뉴마다 1인분 재료를 등록해두면 판매 등록 시 재고가 자동으로 차감됩니다"
        right={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" />
            메뉴 등록
          </Button>
        }
      />

      {costs.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-[11px] text-[#6B7280]">등록된 메뉴</div>
            <div className="mt-1 text-[18px] font-bold">{costs.length}개</div>
          </Card>
          <Card className="p-4">
            <div className="text-[11px] text-[#6B7280]">평균 원가율</div>
            <div
              className={`mt-1 text-[18px] font-bold ${
                avgRatio > 40 ? "text-[#B42318]" : "text-[#16A34A]"
              }`}
            >
              {formatPercent(avgRatio)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-[11px] text-[#6B7280]">지금 만들 수 없는 메뉴</div>
            <div className="mt-1 text-[18px] font-bold text-[#B45309]">
              {costs.filter((c) => c.makeableServings === 0).length}개
            </div>
          </Card>
        </div>
      )}

      {costs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ChefHat className="h-8 w-8" />}
            title="등록된 메뉴가 없습니다"
            description="메뉴와 재료를 등록하면 원가와 재고 차감이 자동으로 계산됩니다"
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                메뉴 등록
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {costs.map((c) => {
            const style = menuCategoryStyle[c.menu.categoryId];
            const ratioTone =
              c.costRatio > 45
                ? "text-[#B42318]"
                : c.costRatio > 35
                  ? "text-[#B45309]"
                  : "text-[#16A34A]";
            return (
              <Card key={c.menu.id} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-bold">{c.menu.name}</span>
                      <Badge className={`${style.bg} ${style.text} ${style.border}`}>
                        {menuCategoryLabel[c.menu.categoryId]}
                      </Badge>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-[#6B7280]">{c.menu.note}</div>
                  </div>
                  <button
                    onClick={() => setEditing(c.menu)}
                    aria-label="메뉴 수정"
                    className="shrink-0 rounded-lg border border-[#E5E7EB] p-1.5 text-[#6B7280] hover:bg-[#F9FAFB]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="text-[10px] text-[#9CA3AF]">판매가</div>
                    <div className="mt-0.5 text-[13px] font-bold">{formatWon(c.menu.price)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#9CA3AF]">원가</div>
                    <div className="mt-0.5 text-[13px] font-bold">{formatWon(c.cost)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#9CA3AF]">마진</div>
                    <div className="mt-0.5 text-[13px] font-bold">{formatWon(c.margin)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#9CA3AF]">원가율</div>
                    <div className={`mt-0.5 text-[13px] font-bold ${ratioTone}`}>
                      {formatPercent(c.costRatio, 0)}
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <MiniBar
                    ratio={c.costRatio / 100}
                    className={
                      c.costRatio > 45
                        ? "bg-[#FF3B30]"
                        : c.costRatio > 35
                          ? "bg-[#FF9500]"
                          : "bg-[#16A34A]"
                    }
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.lines.slice(0, 6).map((l, i) => (
                    <span
                      key={`${l.ingredient?.id ?? i}`}
                      className="whitespace-nowrap rounded-full border border-[#E5E7EB] bg-[#F8F9FB] px-2 py-1 text-[10px]"
                    >
                      {l.ingredient?.name ?? "삭제된 재료"} {formatNumber(l.quantity)}
                      {l.ingredient?.unit ?? ""}
                    </span>
                  ))}
                  {c.lines.length > 6 && (
                    <span className="whitespace-nowrap rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px] text-[#6B7280]">
                      외 {c.lines.length - 6}가지
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[#F3F4F6] pt-3">
                  <span className="text-[11px] text-[#6B7280]">
                    현재 재고로 <strong>{formatNumber(c.makeableServings)}인분</strong> 가능
                  </span>
                  {c.makeableServings === 0 && (
                    <Badge className="border-[#FFD6C7] bg-[#FFF0EE] text-[#B42318]">
                      <AlertTriangle className="h-3 w-3" />
                      재료 부족
                      {c.bottleneck ? ` · ${c.bottleneck.name}` : ""}
                    </Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <MenuModal
        open={creating || editing !== null}
        menu={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    </div>
  );
}
