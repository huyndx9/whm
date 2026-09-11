import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Scale, Search } from "lucide-react";
import type { TransactionType } from "../types";
import { useStore } from "../store";
import { reasonLabel, transactionTypeLabel } from "../lib/labels";
import { formatDateShort, formatNumber, formatWon } from "../lib/format";
import { Badge, Card, EmptyState, Select, TextInput, Button } from "../components/ui";
import { downloadCsv } from "../lib/csv";

const TYPE_FILTERS: { id: TransactionType | "ALL"; label: string }[] = [
  { id: "ALL", label: "전체" },
  { id: "STOCK_IN", label: "입고" },
  { id: "STOCK_OUT", label: "출고" },
  { id: "ADJUSTMENT", label: "재고 조정" },
];

export default function Transactions() {
  const { data, ingredientById, supplierById } = useStore();
  const [type, setType] = useState<TransactionType | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [days, setDays] = useState("7");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const limitDays = Number(days);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - limitDays);
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    return data.transactions
      .filter((t) => {
        if (t.date < cutoffIso) return false;
        if (type !== "ALL" && t.type !== type) return false;
        if (!q) return true;
        const ing = ingredientById(t.ingredientId);
        return (
          (ing?.name.toLowerCase().includes(q) ?? false) ||
          (ing?.note.toLowerCase().includes(q) ?? false) ||
          reasonLabel(t.reason).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [data.transactions, type, query, days, ingredientById]);

  const totals = useMemo(() => {
    let inAmt = 0;
    let outAmt = 0;
    for (const t of filtered) {
      if (t.type === "STOCK_IN") inAmt += t.amount;
      if (t.type === "STOCK_OUT") outAmt += t.amount;
    }
    return { inAmt, outAmt };
  }, [filtered]);

  const exportCsv = () => {
    downloadCsv(
      "입출고내역",
      ["일자", "구분", "원재료", "수량", "단위", "사유", "단가", "금액", "공급업체", "메모"],
      filtered.map((t) => {
        const ing = ingredientById(t.ingredientId);
        return [
          t.date,
          transactionTypeLabel[t.type],
          ing?.name ?? "",
          t.quantity,
          ing?.unit ?? "",
          reasonLabel(t.reason),
          t.unitCost,
          t.amount,
          t.supplierId ? (supplierById(t.supplierId)?.name ?? "") : "",
          t.memo ?? "",
        ];
      }),
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-[12px] text-[#6B7280]">입고 금액</div>
          <div className="mt-1 text-[20px] font-bold text-[#0F4C5C]">{formatWon(totals.inAmt)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[12px] text-[#6B7280]">출고 원가</div>
          <div className="mt-1 text-[20px] font-bold text-[#B45309]">
            {formatWon(totals.outAmt)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[12px] text-[#6B7280]">건수</div>
          <div className="mt-1 text-[20px] font-bold">{filtered.length}건</div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="원재료, 사유 검색..."
            className="pl-9"
          />
        </div>
        <Select value={days} onChange={(e) => setDays(e.target.value)} className="w-auto">
          <option value="7">최근 7일</option>
          <option value="30">최근 30일</option>
          <option value="90">최근 90일</option>
        </Select>
        <div className="flex gap-1.5">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setType(f.id)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                type === f.id
                  ? "border-transparent bg-[#111827] text-white"
                  : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" />
          CSV 내보내기
        </Button>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState title="해당 기간의 내역이 없습니다" description="기간이나 조건을 바꿔보세요" />
        ) : (
          <div className="divide-y divide-[#F3F4F6]">
            {filtered.slice(0, 200).map((t) => {
              const ing = ingredientById(t.ingredientId);
              const isIn = t.type === "STOCK_IN";
              const isAdj = t.type === "ADJUSTMENT";
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white ${
                      isAdj ? "bg-[#6B7280]" : isIn ? "bg-[#0F4C5C]" : "bg-[#FF6B35]"
                    }`}
                  >
                    {isAdj ? (
                      <Scale className="h-4 w-4" />
                    ) : isIn ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">
                      {transactionTypeLabel[t.type]} {formatNumber(t.quantity)}
                      {ing?.unit} · {ing?.name ?? "삭제된 품목"}
                    </div>
                    <div className="truncate text-[11px] text-[#6B7280]">
                      {formatDateShort(t.date)} · {reasonLabel(t.reason)} · {formatWon(t.amount)}
                      {t.memo ? ` · ${t.memo}` : ""}
                    </div>
                  </div>
                  <Badge
                    className={
                      t.reason === "COOKING"
                        ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]"
                        : t.reason === "DISPOSAL" || t.reason === "LOSS"
                          ? "border-[#FFD6C7] bg-[#FFF0EE] text-[#B42318]"
                          : "border-[#E5E7EB] bg-[#F3F4F6] text-[#6B7280]"
                    }
                  >
                    {reasonLabel(t.reason)}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      {filtered.length > 200 && (
        <p className="text-center text-[11px] text-[#9CA3AF]">
          최근 200건만 표시됩니다. 전체 내역은 CSV로 내려받으세요.
        </p>
      )}
    </div>
  );
}
