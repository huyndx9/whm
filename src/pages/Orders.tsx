import { useMemo, useState } from "react";
import { CalendarDays, Check, FileText, MessageSquare, Package, Send, Sparkles, Trash2, Truck } from "lucide-react";
import type { Ingredient, PurchaseOrder, PurchaseOrderLine } from "../types";
import type { ForecastRow } from "../lib/forecast";
import { buildWeekdayForecast, type WeekdayForecastRow } from "../lib/weekdayForecast";
import { useStore } from "../store";
import { makeId } from "../lib/storage";
import { addDays, formatDateShort, formatNumber, formatWeekday, formatWon, todayIso } from "../lib/format";
import { Button, Card, EmptyState, SectionTitle, Select, TextInput } from "../components/ui";
import { OrderStatusBadge } from "../components/badges";
import OrderMessageModal from "../components/OrderMessageModal";
import { formatOrderMessage } from "../lib/message";
import type { OrderDocInput } from "../lib/orderDoc";
import PurchaseOrderModal from "../components/PurchaseOrderModal";

/** 두 예측 방식이 공통으로 내놓는 최소 형태. 발주서·문자 생성은 이것만 본다 */
interface ProposalLine {
  ingredient: Ingredient;
  recommendedQty: number;
}

type ProposalMode = "reorder" | "weekday";

const WEEK_OPTIONS = [3, 4, 6, 8];

export default function Orders({ rows }: { rows: ForecastRow[] }) {
  const { data, upsertOrder, deleteOrder, receiveOrder, ingredientById, supplierById } = useStore();
  const [draftQty, setDraftQty] = useState<Record<string, string>>({});
  const [messageText, setMessageText] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<PurchaseOrder | null>(null);
  const [docOrder, setDocOrder] = useState<PurchaseOrder | null>(null);
  const [mode, setMode] = useState<ProposalMode>("reorder");
  const [targetDate, setTargetDate] = useState(addDays(todayIso(), 1));
  const [weeks, setWeeks] = useState(4);

  /** 요일 기준 예측 - 목표일과 같은 요일의 최근 N주 실적으로 계산 */
  const weekday = useMemo(
    () => buildWeekdayForecast(data.ingredients, data.suppliers, data.transactions, targetDate, weeks),
    [data.ingredients, data.suppliers, data.transactions, targetDate, weeks],
  );
  const weekdayById = useMemo(
    () => new Map(weekday.rows.map((r) => [r.ingredient.id, r])),
    [weekday],
  );

  /** 발주서 문서에 넘길 값 */
  const docInput = (o: PurchaseOrder): OrderDocInput => ({
    order: o,
    supplier: supplierById(o.supplierId),
    restaurantName: data.settings.restaurantName,
    ingredientById,
  });

  /** 발주가 필요한 품목을 공급업체별로 묶는다 */
  const bySupplier = useMemo(() => {
    const source: ProposalLine[] =
      mode === "weekday"
        ? weekday.rows.filter((r) => r.needsOrder)
        : rows.filter((r) => r.needsOrder && r.recommendedQty > 0);
    const map = new Map<string, ProposalLine[]>();
    for (const r of source) {
      const key = r.ingredient.supplierId;
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [rows, weekday, mode]);

  const rowById = useMemo(() => new Map(rows.map((r) => [r.ingredient.id, r])), [rows]);

  const qtyFor = (r: ProposalLine): number => {
    const raw = draftQty[r.ingredient.id];
    if (raw === undefined) return r.recommendedQty;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const createOrder = (supplierId: string, list: ProposalLine[]) => {
    const supplier = supplierById(supplierId);
    const lines: PurchaseOrderLine[] = list
      .map((r) => ({
        ingredientId: r.ingredient.id,
        quantity: qtyFor(r),
        unitCost: r.ingredient.costPerUnit,
      }))
      .filter((l) => l.quantity > 0);

    if (lines.length === 0) {
      window.alert("발주 수량을 입력해주세요.");
      return;
    }

    const seq = data.purchaseOrders.length + 1;
    const order: PurchaseOrder = {
      id: makeId("po"),
      code: `발주-${todayIso().replace(/-/g, "")}-${String(seq).padStart(2, "0")}`,
      supplierId,
      status: "DRAFT",
      createdAt: new Date().toISOString(),
      expectedDate: addDays(todayIso(), supplier?.leadTimeDays ?? 1),
      lines,
    };
    upsertOrder(order);

    // 만들자마자 발주서를 띄워 준다. 버튼이 동작했는지 바로 알 수 있고,
    // 여기서 인쇄하거나 파일로 저장하면 된다.
    setJustCreated(order);
    setDocOrder(order);

    // 반영한 품목의 임시 입력값을 비운다
    setDraftQty((prev) => {
      const next = { ...prev };
      for (const l of lines) delete next[l.ingredientId];
      return next;
    });
  };

  /** 발주 제안 묶음을 그대로 문자로 만든다 */
  const messageFromProposal = (supplierId: string, list: ProposalLine[]): string => {
    const supplier = supplierById(supplierId);
    return formatOrderMessage({
      restaurantName: data.settings.restaurantName,
      supplierName: supplier?.name ?? "공급업체",
      expectedDate: addDays(todayIso(), supplier?.leadTimeDays ?? 1),
      lines: list.map((r) => ({
        name: r.ingredient.name,
        quantity: qtyFor(r),
        unit: r.ingredient.unit,
      })),
    });
  };

  /** 이미 만들어진 발주서를 문자로 만든다 */
  const messageFromOrder = (o: PurchaseOrder): string =>
    formatOrderMessage({
      restaurantName: data.settings.restaurantName,
      supplierName: supplierById(o.supplierId)?.name ?? "공급업체",
      expectedDate: o.expectedDate,
      code: o.code,
      lines: o.lines.map((l) => {
        const ing = ingredientById(l.ingredientId);
        return {
          name: ing?.name ?? "삭제된 품목",
          quantity: l.quantity,
          unit: ing?.unit ?? "",
        };
      }),
    });

  const switchMode = (next: ProposalMode) => {
    setMode(next);
    setDraftQty({});
  };

  const orderTotal = (o: PurchaseOrder): number =>
    o.lines.reduce((a, l) => a + l.quantity * l.unitCost, 0);

  const openOrders = data.purchaseOrders.filter(
    (o) => o.status === "DRAFT" || o.status === "SENT",
  );
  const doneOrders = data.purchaseOrders
    .filter((o) => o.status === "RECEIVED" || o.status === "CANCELLED")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div className="space-y-5">
      {justCreated && (
        <Card className="border-[#BBF7D0] bg-[#F0FDF4] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#16A34A] text-white">
              <Check className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-[#166534]">
                발주서가 만들어졌습니다
              </div>
              <div className="mt-0.5 text-[11px] text-[#15803D]">
                {justCreated.code} · {supplierById(justCreated.supplierId)?.name} ·{" "}
                {justCreated.lines.length}개 품목
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => setDocOrder(justCreated)}>
                <FileText className="h-3.5 w-3.5" />
                발주서 보기
              </Button>
              <Button onClick={() => setMessageText(messageFromOrder(justCreated))}>
                <MessageSquare className="h-3.5 w-3.5" />
                문자 보내기
              </Button>
              <Button onClick={() => setJustCreated(null)}>확인</Button>
            </div>
          </div>
        </Card>
      )}

      {/* 발주 제안 */}
      <Card className="p-5">
        <SectionTitle
          title="발주 제안"
          subtitle={
            mode === "weekday"
              ? "목표일과 같은 요일의 지난 실적으로 필요량을 계산합니다"
              : "재고가 재주문점 이하로 내려간 품목을 공급업체별로 묶었습니다"
          }
          right={
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#FFE9C7] bg-[#FFF4E5] px-3 py-1 text-[11px] font-semibold text-[#B45309]">
              <Sparkles className="h-3.5 w-3.5" />
              {bySupplier.reduce((a, [, l]) => a + l.length, 0)}종 제안
            </span>
          }
        />

        {/* 예측 방식 */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {(
              [
                ["reorder", "재주문점 기준"],
                ["weekday", "요일 기준"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => switchMode(id)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  mode === id
                    ? "border-transparent bg-[#0F4C5C] text-white"
                    : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "weekday" && (
            <>
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-[#9CA3AF]" />
                <TextInput
                  type="date"
                  min={todayIso()}
                  value={targetDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setTargetDate(e.target.value);
                      setDraftQty({});
                    }
                  }}
                  className="w-auto"
                />
              </div>
              <Select
                value={weeks}
                onChange={(e) => {
                  setWeeks(Number(e.target.value));
                  setDraftQty({});
                }}
                className="w-auto"
              >
                {WEEK_OPTIONS.map((w) => (
                  <option key={w} value={w}>
                    최근 {w}주
                  </option>
                ))}
              </Select>
            </>
          )}
        </div>

        {mode === "weekday" && (
          <div className="mt-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2.5 text-[12px] leading-relaxed text-[#1E3A8A]">
            <strong>
              {formatDateShort(targetDate)} ({formatWeekday(targetDate)})
            </strong>{" "}
            기준 · 최근 {weeks}주의 {formatWeekday(targetDate)}요일 중{" "}
            <strong>{weekday.sampleDates.length}일</strong> 영업 실적으로 평균을 냈습니다
            {weekday.sampleDates.length > 0 && (
              <span className="text-[#3B5BA5]">
                {" "}
                ({weekday.sampleDates.map((d) => formatDateShort(d)).join(", ")})
              </span>
            )}
            . {weekday.interimDays > 0 && (
              <>
                목표일 전 <strong>{weekday.interimDays}일</strong>간 예상 사용량을 먼저 빼고 부족분을
                계산합니다.
              </>
            )}
            {weekday.interimDays === 0 && "권장량 = 요일 평균 사용량 − 현재 재고 입니다."}
          </div>
        )}

        {bySupplier.length === 0 ? (
          <EmptyState
            icon={<Check className="h-8 w-8" />}
            title="지금 발주할 품목이 없습니다"
            description="모든 원재료가 재주문점 위에 있습니다"
          />
        ) : (
          <div className="mt-4 space-y-4">
            {bySupplier.map(([supplierId, list]) => {
              const supplier = supplierById(supplierId);
              const totalQty = list.reduce((a, r) => a + qtyFor(r), 0);
              return (
                <div key={supplierId} className="rounded-2xl border border-[#E5E7EB] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F4C5C] text-[11px] font-bold text-white">
                        {supplier?.name.slice(0, 2) ?? "??"}
                      </div>
                      <div>
                        <div className="text-[13px] font-bold">{supplier?.name ?? "미지정"}</div>
                        <div className="text-[11px] text-[#6B7280]">
                          리드타임 {supplier?.leadTimeDays ?? 1}일 · 마감{" "}
                          {supplier?.orderCutoff ?? "-"} · 예상 입고{" "}
                          {formatDateShort(addDays(todayIso(), supplier?.leadTimeDays ?? 1))}
                        </div>
                        <div className="text-[11px] text-[#9CA3AF]">
                          {list.length}개 품목 · 총 {formatNumber(totalQty)} 단위
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => setMessageText(messageFromProposal(supplierId, list))}>
                        <MessageSquare className="h-3.5 w-3.5" />
                        문자 만들기
                      </Button>
                      <Button variant="primary" onClick={() => createOrder(supplierId, list)}>
                        <Package className="h-3.5 w-3.5" />
                        발주서 만들기
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {list.map((r) => (
                      <div
                        key={r.ingredient.id}
                        className="flex flex-wrap items-center gap-3 rounded-xl bg-[#F8F9FB] px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-semibold">{r.ingredient.name}</div>
                          {mode === "weekday" ? (
                            <WeekdayLineDetail row={weekdayById.get(r.ingredient.id)} />
                          ) : (
                            <ReorderLineDetail row={rowById.get(r.ingredient.id)} />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <TextInput
                            type="number"
                            min="0"
                            step="0.5"
                            value={draftQty[r.ingredient.id] ?? String(r.recommendedQty)}
                            onChange={(e) =>
                              setDraftQty((p) => ({ ...p, [r.ingredient.id]: e.target.value }))
                            }
                            className="w-24 text-right"
                          />
                          <span className="w-8 text-[12px] text-[#6B7280]">
                            {r.ingredient.unit}
                          </span>

                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 진행 중 발주서 */}
      <Card className="p-5">
        <SectionTitle title="진행 중인 발주서" subtitle="발주 완료 후 입고 처리하면 재고에 반영됩니다" />
        {openOrders.length === 0 ? (
          <EmptyState title="진행 중인 발주서가 없습니다" />
        ) : (
          <div className="mt-4 space-y-3">
            {openOrders.map((o) => (
              <div key={o.id} className="rounded-2xl border border-[#E5E7EB] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold">{o.code}</span>
                      <OrderStatusBadge status={o.status} />
                    </div>
                    <div className="mt-1 text-[11px] text-[#6B7280]">
                      {supplierById(o.supplierId)?.name} · {o.lines.length}개 품목 ·{" "}
                      {formatWon(orderTotal(o))} · 예상 입고 {formatDateShort(o.expectedDate)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setDocOrder(o)}>
                      <FileText className="h-3.5 w-3.5" />
                      발주서 보기
                    </Button>
                    <Button onClick={() => setMessageText(messageFromOrder(o))}>
                      <MessageSquare className="h-3.5 w-3.5" />
                      문자 보내기
                    </Button>
                    {o.status === "DRAFT" && (
                      <Button onClick={() => upsertOrder({ ...o, status: "SENT" })}>
                        <Send className="h-3.5 w-3.5" />
                        발주 확정
                      </Button>
                    )}
                    {o.status === "SENT" && (
                      <Button variant="primary" onClick={() => receiveOrder(o)}>
                        <Truck className="h-3.5 w-3.5" />
                        입고 처리
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (window.confirm(`${o.code} 발주서를 삭제할까요?`)) deleteOrder(o.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {o.lines.map((l) => {
                    const ing = ingredientById(l.ingredientId);
                    return (
                      <span
                        key={l.ingredientId}
                        className="whitespace-nowrap rounded-full border border-[#E5E7EB] bg-[#F8F9FB] px-2 py-1 text-[11px]"
                      >
                        {ing?.name} {formatNumber(l.quantity)}
                        {ing?.unit}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 지난 발주서 */}
      {doneOrders.length > 0 && (
        <Card className="p-5">
          <SectionTitle title="지난 발주 내역" />
          <div className="mt-4 divide-y divide-[#F3F4F6]">
            {doneOrders.slice(0, 20).map((o) => (
              <div key={o.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="text-[12px] font-semibold">{o.code}</span>
                <OrderStatusBadge status={o.status} />
                <span className="text-[11px] text-[#6B7280]">
                  {supplierById(o.supplierId)?.name} · {formatWon(orderTotal(o))}
                </span>
                <span className="ml-auto text-[11px] text-[#9CA3AF]">
                  {o.receivedAt ? `${formatDateShort(o.receivedAt.slice(0, 10))} 입고` : ""}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
      <PurchaseOrderModal
        open={docOrder !== null}
        input={docOrder ? docInput(docOrder) : null}
        onClose={() => setDocOrder(null)}
        onSendMessage={
          docOrder
            ? () => {
                setMessageText(messageFromOrder(docOrder));
                setDocOrder(null);
              }
            : undefined
        }
      />

      <OrderMessageModal
        open={messageText !== null}
        text={messageText ?? ""}
        onClose={() => setMessageText(null)}
      />
    </div>
  );
}

function ReorderLineDetail({ row }: { row: ForecastRow | undefined }) {
  if (!row) return null;
  const u = row.ingredient.unit;
  return (
    <div className="text-[11px] text-[#6B7280]">
      현재 {formatNumber(row.ingredient.stock)}
      {u} · 재주문점 {formatNumber(row.reorderPoint)}
      {u}
      {row.daysUntilStockout !== null && ` · ${Math.floor(row.daysUntilStockout)}일 후 소진`}
    </div>
  );
}

function WeekdayLineDetail({ row }: { row: WeekdayForecastRow | undefined }) {
  if (!row) return null;
  const u = row.ingredient.unit;
  return (
    <div className="text-[11px] text-[#6B7280]">
      <div>
        요일 평균 <strong className="text-[#111827]">{formatNumber(row.avgUsage)}{u}</strong>
        {" · "}현재 {formatNumber(row.ingredient.stock)}
        {u}
        {row.interimUsage > 0 && (
          <>
            {" · "}그 전 {formatNumber(row.interimUsage)}
            {u} 사용 예상
          </>
        )}
        {" · "}목표일 재고 {formatNumber(row.projectedStock)}
        {u}
      </div>
      {row.samples.length > 0 && (
        <div className="mt-0.5 text-[10px] text-[#9CA3AF]">
          {row.samples.map((s) => `${formatDateShort(s.date)} ${formatNumber(s.qty)}${u}`).join(" · ")}
          {row.samples.length >= 2 && ` · 최대 ${formatNumber(row.maxUsage)}${u}`}
        </div>
      )}
    </div>
  );
}
