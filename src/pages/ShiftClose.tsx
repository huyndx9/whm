import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  RotateCcw,
  Search,
  TrendingDown,
} from "lucide-react";
import type { CategoryId } from "../types";
import { useStore } from "../store";
import { buildShiftCloseLines, chronicShrink, summarizeShiftClose } from "../lib/shiftClose";
import { categoryLabel } from "../lib/labels";
import { formatDateTime, formatNumber, formatWon } from "../lib/format";
import {
  Button,
  Card,
  EmptyState,
  Field,
  SectionTitle,
  Select,
  TextArea,
  TextInput,
} from "../components/ui";
import { CategoryBadge } from "../components/badges";

export default function ShiftClosePage() {
  const { data, recordShiftClose } = useStore();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId | "ALL">("ALL");
  const [onlyTouched, setOnlyTouched] = useState(false);
  const [memo, setMemo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const active = useMemo(() => data.ingredients.filter((i) => i.active), [data.ingredients]);

  const categories = useMemo(() => {
    const set = new Map<CategoryId, number>();
    for (const i of active) set.set(i.categoryId, (set.get(i.categoryId) ?? 0) + 1);
    return [...set.entries()];
  }, [active]);

  const isTouched = (id: string): boolean =>
    counts[id] !== undefined && counts[id].trim() !== "";

  /** 입력값을 숫자로. 비어 있으면 장부 재고를 그대로 쓴다(=차이 없음) */
  const countedOf = (id: string, book: number): number => {
    if (!isTouched(id)) return book;
    const n = Number(counts[id]);
    return Number.isFinite(n) && n >= 0 ? n : book;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return active.filter((i) => {
      const matchQ = !q || i.name.toLowerCase().includes(q) || i.note.toLowerCase().includes(q);
      const matchC = category === "ALL" || i.categoryId === category;
      const touched = counts[i.id] !== undefined && counts[i.id].trim() !== "";
      return matchQ && matchC && (!onlyTouched || touched);
    });
  }, [active, query, category, onlyTouched, counts]);

  /** 실제로 차이가 발생한 항목만 */
  const pendingLines = useMemo(() => {
    const numeric: Record<string, number> = {};
    for (const ing of active) {
      const raw = counts[ing.id];
      if (raw === undefined || raw.trim() === "") continue;
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) numeric[ing.id] = n;
    }
    return buildShiftCloseLines(active, numeric);
  }, [active, counts]);

  const summary = summarizeShiftClose(pendingLines);

  const ingredientById = useMemo(
    () => new Map(data.ingredients.map((i) => [i.id, i])),
    [data.ingredients],
  );

  const history = useMemo(
    () => [...data.shiftCloses].sort((a, b) => (a.closedAt < b.closedAt ? 1 : -1)),
    [data.shiftCloses],
  );

  const chronic = useMemo(
    () => chronicShrink(data.shiftCloses, data.ingredients, 5),
    [data.shiftCloses, data.ingredients],
  );

  const submit = () => {
    if (pendingLines.length === 0) {
      window.alert("장부와 차이가 있는 품목이 없습니다. 실사 수량을 입력해주세요.");
      return;
    }

    const shortage = summary.shortageValue;
    const message =
      shortage < 0
        ? `${summary.lineCount}개 품목에서 차이가 확인되었습니다.\n손실 금액 ${formatWon(
            Math.abs(shortage),
          )}\n\n실사 수량으로 재고를 맞추고 마감하시겠습니까?`
        : `${summary.lineCount}개 품목의 재고를 실사 수량으로 맞추고 마감하시겠습니까?`;
    if (!window.confirm(message)) return;

    const numeric: Record<string, number> = {};
    for (const l of pendingLines) numeric[l.ingredientId] = l.countedStock;

    recordShiftClose(numeric, memo.trim() || undefined);
    setCounts({});
    setMemo("");
    setOnlyTouched(false);
  };

  return (
    <div className="space-y-5">
      <Card className="flex items-start gap-3 border-[#BFDBFE] bg-[#EFF6FF] p-4">
        <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1D4ED8]" />
        <div className="text-[12px] leading-relaxed text-[#1E3A8A]">
          영업이 끝나고 남은 재고를 세어 입력하세요. 판매 등록으로 레시피만큼 이미 차감된{" "}
          <strong>장부 재고</strong>와 비교해 차이를 계산합니다. 차이가 계속 마이너스로 나오는
          품목은 <strong>과다 사용이나 손실</strong>을 의심해볼 수 있습니다. 입력하지 않은 품목은
          차이 없음으로 보고 건너뜁니다.
        </div>
      </Card>

      {/* 실사 입력 */}
      <Card className="overflow-hidden">
        <div className="border-b border-[#F3F4F6] px-5 py-4">
          <SectionTitle
            title="재고 실사 입력"
            subtitle="세어 본 수량만 입력하면 됩니다"
            right={
              Object.keys(counts).length > 0 ? (
                <Button onClick={() => setCounts({})}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  입력 비우기
                </Button>
              ) : undefined
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[#F3F4F6] px-5 py-3">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="원재료 검색..."
              className="pl-9"
            />
          </div>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryId | "ALL")}
            className="w-auto"
          >
            <option value="ALL">전체 분류 ({active.length})</option>
            {categories.map(([c, n]) => (
              <option key={c} value={c}>
                {categoryLabel[c]} ({n})
              </option>
            ))}
          </Select>
          <button
            onClick={() => setOnlyTouched((v) => !v)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              onlyTouched
                ? "border-transparent bg-[#111827] text-white"
                : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB]"
            }`}
          >
            입력한 항목만
          </button>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="조건에 맞는 원재료가 없습니다" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-[#F3F4F6] text-[11px] font-semibold tracking-wide text-[#9CA3AF]">
                  <th className="px-5 py-2.5">원재료</th>
                  <th className="px-3 py-2.5">장부 재고</th>
                  <th className="w-[150px] px-3 py-2.5">실사 수량</th>
                  <th className="px-3 py-2.5">차이</th>
                  <th className="px-3 py-2.5">차이 금액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {filtered.map((ing) => {
                  const counted = countedOf(ing.id, ing.stock);
                  const variance = Number((counted - ing.stock).toFixed(3));
                  const varianceValue = Math.round(variance * ing.costPerUnit);
                  const touched = isTouched(ing.id);
                  const showDiff = touched && variance !== 0;
                  return (
                    <tr key={ing.id} className={touched ? "bg-[#FAFBFC]" : ""}>
                      <td className="px-5 py-3">
                        <div className="text-[13px] font-semibold">{ing.name}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <CategoryBadge categoryId={ing.categoryId} />
                          <span className="whitespace-nowrap text-[10px] text-[#9CA3AF]">
                            {ing.location}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-[13px] text-[#4B5563]">
                        {formatNumber(ing.stock)}
                        <span className="ml-0.5 text-[11px] text-[#9CA3AF]">{ing.unit}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <TextInput
                            type="number"
                            step="0.1"
                            min="0"
                            inputMode="decimal"
                            value={counts[ing.id] ?? ""}
                            placeholder={String(ing.stock)}
                            onChange={(e) =>
                              setCounts((c) => ({ ...c, [ing.id]: e.target.value }))
                            }
                            className="text-right"
                          />
                          <span className="w-6 text-[12px] text-[#6B7280]">{ing.unit}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {!showDiff ? (
                          <span className="text-[12px] text-[#9CA3AF]">-</span>
                        ) : (
                          <span
                            className={`text-[13px] font-bold ${
                              variance < 0 ? "text-[#B42318]" : "text-[#1D4ED8]"
                            }`}
                          >
                            {variance > 0 ? "+" : ""}
                            {formatNumber(variance)}
                            <span className="ml-0.5 text-[11px] font-medium">{ing.unit}</span>
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {!showDiff ? (
                          <span className="text-[12px] text-[#9CA3AF]">-</span>
                        ) : (
                          <span
                            className={`text-[12px] font-medium ${
                              variance < 0 ? "text-[#B42318]" : "text-[#1D4ED8]"
                            }`}
                          >
                            {varianceValue > 0 ? "+" : "-"}
                            {formatWon(Math.abs(varianceValue))}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 마감 확정 */}
      <Card className="p-5">
        <SectionTitle title="마감 확정" subtitle="차이가 있는 품목만 재고 조정으로 기록됩니다" />

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryTile label="차이 발생 품목" value={`${summary.lineCount}개`} />
          <SummaryTile
            label="부족"
            value={`${summary.shortageCount}개`}
            tone={summary.shortageCount > 0 ? "danger" : "default"}
          />
          <SummaryTile
            label="초과"
            value={`${summary.surplusCount}개`}
            tone={summary.surplusCount > 0 ? "info" : "default"}
          />
          <SummaryTile
            label="손실 금액"
            value={formatWon(Math.abs(summary.shortageValue))}
            tone={summary.shortageValue < 0 ? "danger" : "default"}
          />
        </div>

        <div className="mt-4">
          <Field label="메모 (선택)">
            <TextArea
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="예: 저녁 마감, 홀 담당 김OO"
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-[#F8F9FB] px-4 py-3">
          <div className="text-[12px] text-[#4B5563]">
            {summary.lineCount === 0 ? (
              "실사 수량을 입력하면 여기에 차이가 표시됩니다."
            ) : (
              <>
                <strong>{summary.lineCount}개</strong> 품목의 재고가 실사 수량으로 조정됩니다.
              </>
            )}
          </div>
          <Button variant="primary" onClick={submit} disabled={summary.lineCount === 0}>
            <ClipboardCheck className="h-3.5 w-3.5" />
            마감 확정
          </Button>
        </div>
      </Card>

      {/* 반복 손실 */}
      {chronic.length > 0 && (
        <Card className="p-5">
          <SectionTitle
            title="반복해서 손실이 나는 원재료"
            subtitle="마감 이력을 누적해 계산했습니다. 과다 사용이나 관리 문제를 의심해보세요"
          />
          <div className="mt-4 space-y-2.5">
            {chronic.map((c) => (
              <div
                key={c.ingredient.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-[#F3F4F6] px-3 py-2.5"
              >
                <TrendingDown className="h-4 w-4 shrink-0 text-[#B42318]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-semibold">{c.ingredient.name}</div>
                  <div className="text-[11px] text-[#6B7280]">
                    마감 {c.occurrences}회에서 부족 · 누적 {formatNumber(Math.abs(c.totalQty))}
                    {c.ingredient.unit}
                  </div>
                </div>
                <div className="shrink-0 text-[12px] font-bold text-[#B42318]">
                  -{formatWon(Math.abs(c.totalValue))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 마감 이력 */}
      <Card className="p-5">
        <SectionTitle title="마감 이력" />
        {history.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="h-8 w-8" />}
            title="아직 마감 기록이 없습니다"
            description="첫 마감을 확정하면 여기에 쌓입니다"
          />
        ) : (
          <div className="mt-4 divide-y divide-[#F3F4F6]">
            {history.slice(0, 30).map((close) => {
              const s = summarizeShiftClose(close.lines);
              const open = expanded === close.id;
              return (
                <div key={close.id} className="py-2.5">
                  <button
                    onClick={() => setExpanded(open ? null : close.id)}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold">
                        {formatDateTime(close.closedAt)}
                      </div>
                      <div className="truncate text-[11px] text-[#6B7280]">
                        {s.lineCount}개 품목 · 부족 {s.shortageCount} · 초과 {s.surplusCount}
                        {close.memo ? ` · ${close.memo}` : ""}
                      </div>
                    </div>
                    <div
                      className={`shrink-0 text-[12px] font-bold ${
                        s.netValue < 0 ? "text-[#B42318]" : "text-[#1D4ED8]"
                      }`}
                    >
                      {s.netValue < 0 ? "-" : "+"}
                      {formatWon(Math.abs(s.netValue))}
                    </div>
                  </button>

                  {open && (
                    <div className="mt-2 overflow-x-auto rounded-xl border border-[#F3F4F6]">
                      <table className="w-full min-w-[520px] text-left">
                        <thead>
                          <tr className="bg-[#F8F9FB] text-[10px] font-semibold text-[#9CA3AF]">
                            <th className="px-3 py-2">원재료</th>
                            <th className="px-3 py-2">장부</th>
                            <th className="px-3 py-2">실사</th>
                            <th className="px-3 py-2">차이</th>
                            <th className="px-3 py-2">금액</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F3F4F6]">
                          {close.lines.map((l) => {
                            const ing = ingredientById.get(l.ingredientId);
                            return (
                              <tr key={l.ingredientId} className="text-[11px]">
                                <td className="px-3 py-2 font-medium">
                                  {ing?.name ?? "삭제된 품목"}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-[#6B7280]">
                                  {formatNumber(l.bookStock)}
                                  {ing?.unit}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-[#6B7280]">
                                  {formatNumber(l.countedStock)}
                                  {ing?.unit}
                                </td>
                                <td
                                  className={`whitespace-nowrap px-3 py-2 font-semibold ${
                                    l.variance < 0 ? "text-[#B42318]" : "text-[#1D4ED8]"
                                  }`}
                                >
                                  {l.variance > 0 ? "+" : ""}
                                  {formatNumber(l.variance)}
                                  {ing?.unit}
                                </td>
                                <td
                                  className={`whitespace-nowrap px-3 py-2 ${
                                    l.varianceValue < 0 ? "text-[#B42318]" : "text-[#1D4ED8]"
                                  }`}
                                >
                                  {l.varianceValue > 0 ? "+" : "-"}
                                  {formatWon(Math.abs(l.varianceValue))}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "info";
}) {
  const cls =
    tone === "danger"
      ? "border-[#FFD6C7] bg-[#FFF0EE]"
      : tone === "info"
        ? "border-[#BFDBFE] bg-[#EFF6FF]"
        : "border-[#E5E7EB] bg-[#F8F9FB]";
  const valueCls =
    tone === "danger" ? "text-[#B42318]" : tone === "info" ? "text-[#1D4ED8]" : "";
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${cls}`}>
      <div className="text-[11px] text-[#6B7280]">{label}</div>
      <div className={`mt-1 text-[15px] font-bold ${valueCls}`}>{value}</div>
    </div>
  );
}
