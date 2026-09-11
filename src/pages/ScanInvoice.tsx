import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  TrendingDown,
  TrendingUp,
  Check,
  FileText,
  ImageUp,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { PageId } from "../App";
import type { ScanLine, ScannedInvoice } from "../types";
import { useStore } from "../store";
import { getProvider, matchIngredient, matchSupplier } from "../lib/ocr";
import { ocrProviderLabel } from "../lib/labels";
import { formatNumber, formatWon, todayIso } from "../lib/format";
import { makeId } from "../lib/storage";
import { Badge, Button, Card, Field, Select, TextInput } from "../components/ui";
import { checkPriceDeviation, priceAlertLabel, recentPriceStats } from "../lib/priceTrend";

type Phase = "idle" | "preview" | "working" | "review" | "error";

/** 사진을 그대로 보내면 용량이 크므로 긴 변 1600px 로 줄이고 JPEG 로 다시 인코딩한다 */
async function downscaleImage(file: File, maxSide = 1600): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("이미지를 열지 못했습니다."));
    el.src = dataUrl;
  });

  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  if (scale === 1 && dataUrl.startsWith("data:image/jpeg")) return dataUrl;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function ScanInvoice({ onNavigate }: { onNavigate: (id: PageId) => void }) {
  const { data, moveStock, upsertInvoice } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [image, setImage] = useState("");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [lines, setLines] = useState<ScanLine[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [rawText, setRawText] = useState("");
  const [showRaw, setShowRaw] = useState(false);

  const provider = useMemo(() => getProvider(data.settings), [data.settings]);
  const activeIngredients = useMemo(
    () => data.ingredients.filter((i) => i.active),
    [data.ingredients],
  );

  /** 이번에 찍힌 단가가 최근 입고 평균에서 얼마나 벗어났는지 */
  const priceAlertFor = (line: ScanLine) => {
    if (!line.matchedIngredientId) return null;
    const stats = recentPriceStats(line.matchedIngredientId, data.transactions);
    return checkPriceDeviation(line.unitPrice, stats);
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    try {
      const dataUrl = await downscaleImage(file);
      setImage(dataUrl);
      setPhase("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "이미지를 불러오지 못했습니다.");
      setPhase("error");
    }
  };

  const runScan = async () => {
    if (!provider.isAvailable()) {
      setError(provider.unavailableReason());
      setPhase("error");
      return;
    }
    setPhase("working");
    setProgress("준비하는 중입니다...");
    setError("");

    try {
      const result = await provider.extract(image, setProgress);

      const matchedSupplier = matchSupplier(result.supplierName, data.suppliers);
      setSupplierId(matchedSupplier ?? data.suppliers[0]?.id ?? "");
      setInvoiceDate(result.invoiceDate || todayIso());
      setRawText(result.rawText);

      setLines(
        result.lines.map((l) => {
          const m = matchIngredient(l.name, activeIngredients);
          return {
            id: makeId("line"),
            rawName: l.name,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: l.unitPrice,
            amount: l.amount,
            matchedIngredientId: m.ingredientId,
            confidence: m.confidence,
            include: m.ingredientId !== null,
          };
        }),
      );

      if (result.lines.length === 0) {
        setError(
          "품목을 한 줄도 찾지 못했습니다. 표 전체가 잘 보이도록 다시 촬영하거나, 설정에서 인식 방식을 바꿔보세요.",
        );
        setPhase("error");
        return;
      }
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "인식에 실패했습니다.");
      setPhase("error");
    }
  };

  const updateLine = (id: string, patch: Partial<ScanLine>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const includedLines = lines.filter((l) => l.include && l.matchedIngredientId);
  const totalAmount = includedLines.reduce((a, l) => a + l.amount, 0);
  const unmatched = lines.filter((l) => !l.matchedIngredientId).length;

  const commit = () => {
    if (includedLines.length === 0) {
      setError("반영할 품목이 없습니다. 원재료를 연결하고 체크해주세요.");
      return;
    }

    const invoiceId = makeId("inv");

    moveStock(
      includedLines.map((l) => ({
        ingredientId: l.matchedIngredientId!,
        type: "STOCK_IN" as const,
        quantity: l.quantity,
        reason: "SCAN" as const,
        unitCost: l.unitPrice,
        supplierId,
        sourceDocId: invoiceId,
        date: invoiceDate,
        memo: `영수증 스캔: ${l.rawName}`,
      })),
    );

    const invoice: ScannedInvoice = {
      id: invoiceId,
      createdAt: new Date().toISOString(),
      imageDataUrl: image,
      provider: data.settings.ocrProvider,
      rawText,
      supplierId: supplierId || null,
      invoiceDate,
      lines,
      committed: true,
    };
    upsertInvoice(invoice);

    reset();
    window.alert(`입고 처리가 완료되었습니다. ${includedLines.length}개 품목이 재고에 반영되었습니다.`);
    onNavigate("inventory");
  };

  const reset = () => {
    setPhase("idle");
    setImage("");
    setLines([]);
    setRawText("");
    setError("");
    setProgress("");
    setShowRaw(false);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">영수증 스캔으로 입고</h2>
            <p className="mt-1 text-[12px] text-[#6B7280]">
              매입 영수증을 촬영하면 품목·수량·단가를 읽어 입고 항목을 자동으로 채웁니다. 확인 후
              한 번만 누르면 재고에 반영됩니다.
            </p>
          </div>
          <Badge className="border-[#E5E7EB] bg-[#F8F9FB] text-[#4B5563]">
            현재 인식 방식: {ocrProviderLabel[data.settings.ocrProvider]}
          </Badge>
        </div>

        {phase === "idle" && (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#0F4C5C]/30 bg-[#0F4C5C]/[0.03] px-6 py-10 transition-colors hover:bg-[#0F4C5C]/[0.06]"
            >
              <Camera className="h-7 w-7 text-[#0F4C5C]" />
              <span className="text-[13px] font-bold text-[#0F4C5C]">영수증 촬영</span>
              <span className="text-[11px] text-[#6B7280]">휴대폰 카메라로 바로 찍기</span>
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#E5E7EB] px-6 py-10 transition-colors hover:bg-[#F9FAFB]"
            >
              <ImageUp className="h-7 w-7 text-[#9CA3AF]" />
              <span className="text-[13px] font-bold text-[#374151]">사진 불러오기</span>
              <span className="text-[11px] text-[#6B7280]">갤러리나 파일에서 선택</span>
            </button>
          </div>
        )}

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void pick(e.target.files?.[0])}
        />

        {(phase === "preview" || phase === "working") && image && (
          <div className="mt-5 flex flex-col gap-4 sm:flex-row">
            <img
              src={image}
              alt="선택한 영수증 사진"
              className="max-h-[320px] w-full rounded-xl border border-[#E5E7EB] object-contain sm:w-1/2"
            />
            <div className="flex flex-1 flex-col justify-center gap-3">
              {phase === "working" ? (
                <div className="flex items-center gap-2 text-[13px] font-medium text-[#0F4C5C]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {progress || "인식하는 중입니다..."}
                </div>
              ) : (
                <>
                  <p className="text-[12px] text-[#6B7280]">
                    표의 품목·수량·금액이 또렷하게 보이는지 확인한 뒤 인식을 시작하세요.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={() => void runScan()}>
                      <FileText className="h-3.5 w-3.5" />
                      인식 시작
                    </Button>
                    <Button onClick={reset}>
                      <RotateCcw className="h-3.5 w-3.5" />
                      다시 선택
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="mt-5 space-y-3">
            <div className="flex items-start gap-2 rounded-xl border border-[#FFD6C7] bg-[#FFF0EE] px-3 py-3 text-[12px] text-[#B42318]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={reset}>
                <RotateCcw className="h-3.5 w-3.5" />
                다시 시도
              </Button>
              <Button onClick={() => onNavigate("settings")}>설정 열기</Button>
            </div>
          </div>
        )}
      </Card>

      {phase === "review" && (
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-bold">인식 결과 확인</h3>
              <p className="mt-1 text-[12px] text-[#6B7280]">
                잘못 읽은 값은 직접 고칠 수 있습니다. 반영할 품목만 체크하세요.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowRaw((v) => !v)}>
                {showRaw ? "원문 숨기기" : "인식 원문 보기"}
              </Button>
              <Button onClick={reset}>
                <Trash2 className="h-3.5 w-3.5" />
                취소
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="공급업체">
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                {data.suppliers
                  .filter((s) => s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="입고 일자">
              <TextInput
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </Field>
          </div>

          {unmatched > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#FFE9C7] bg-[#FFF4E5] px-3 py-2.5 text-[12px] text-[#9C5A1A]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {unmatched}개 품목은 등록된 원재료와 연결되지 않았습니다. 직접 원재료를 선택하거나
                체크를 해제하세요.
              </span>
            </div>
          )}

          {showRaw && (
            <pre className="mt-4 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-[#E5E7EB] bg-[#F8F9FB] p-3 text-[11px] text-[#4B5563]">
              {rawText || "원문이 없습니다."}
            </pre>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-[#F3F4F6] text-[11px] font-semibold tracking-wide text-[#9CA3AF]">
                  <th className="px-2 py-2.5 w-10">반영</th>
                  <th className="px-2 py-2.5">영수증 품목</th>
                  <th className="px-2 py-2.5">연결할 원재료</th>
                  <th className="px-2 py-2.5 w-24">수량</th>
                  <th className="px-2 py-2.5 w-28">단가</th>
                  <th className="px-2 py-2.5 w-28">금액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {lines.map((l) => {
                  const matched = l.matchedIngredientId
                    ? data.ingredients.find((i) => i.id === l.matchedIngredientId)
                    : undefined;
                  return (
                    <tr key={l.id} className={l.include ? "" : "opacity-50"}>
                      <td className="px-2 py-2.5">
                        <input
                          type="checkbox"
                          checked={l.include}
                          onChange={(e) => updateLine(l.id, { include: e.target.checked })}
                          className="h-4 w-4 accent-[#0F4C5C]"
                          aria-label={`${l.rawName} 반영`}
                        />
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="text-[12px] font-semibold">{l.rawName}</div>
                        <div className="text-[10px] text-[#9CA3AF]">
                          {l.unit ? `단위 ${l.unit}` : "단위 없음"}
                          {l.matchedIngredientId && (
                            <> · 자동 연결 신뢰도 {Math.round(l.confidence * 100)}%</>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <Select
                          value={l.matchedIngredientId ?? ""}
                          onChange={(e) =>
                            updateLine(l.id, {
                              matchedIngredientId: e.target.value || null,
                              include: e.target.value !== "",
                            })
                          }
                        >
                          <option value="">연결 안 함</option>
                          {activeIngredients.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} · {i.note}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-1">
                          <TextInput
                            type="number"
                            step="0.1"
                            min="0"
                            value={l.quantity}
                            onChange={(e) =>
                              updateLine(l.id, {
                                quantity: Number(e.target.value),
                                amount: Math.round(Number(e.target.value) * l.unitPrice),
                              })
                            }
                            className="text-right"
                          />
                          <span className="text-[11px] text-[#6B7280]">{matched?.unit ?? ""}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <TextInput
                          type="number"
                          min="0"
                          value={l.unitPrice}
                          onChange={(e) =>
                            updateLine(l.id, {
                              unitPrice: Number(e.target.value),
                              amount: Math.round(l.quantity * Number(e.target.value)),
                            })
                          }
                          className="text-right"
                        />
                        {(() => {
                          const alert = priceAlertFor(l);
                          if (!alert) return null;
                          const up = alert.direction === "up";
                          const tone = up
                            ? alert.level === "warning"
                              ? "border-[#FFD6C7] bg-[#FFF0EE] text-[#B42318]"
                              : "border-[#FFE9C7] bg-[#FFF4E5] text-[#9C5A1A]"
                            : "border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]";
                          return (
                            <div className="mt-1.5">
                              <Badge className={tone}>
                                {up ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                {priceAlertLabel(alert)}
                              </Badge>
                              <div className="mt-0.5 text-[10px] text-[#9CA3AF]">
                                최근 평균 {formatWon(Math.round(alert.stats.avg))} (
                                {alert.stats.samples}건)
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-2 py-2.5 text-right text-[12px] font-medium">
                        {formatWon(l.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-[#F8F9FB] px-4 py-3">
            <div className="text-[12px] text-[#4B5563]">
              반영할 품목 <strong>{includedLines.length}개</strong> · 합계{" "}
              <strong>{formatWon(totalAmount)}</strong>
            </div>
            <Button variant="primary" onClick={commit} disabled={includedLines.length === 0}>
              <Check className="h-3.5 w-3.5" />
              재고에 반영하기
            </Button>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-[#FFD6C7] bg-[#FFF0EE] px-3 py-2.5 text-[12px] font-medium text-[#B42318]">
              {error}
            </div>
          )}
        </Card>
      )}

      {/* 지난 스캔 기록 */}
      {data.invoices.length > 0 && phase === "idle" && (
        <Card className="p-5">
          <h3 className="text-[14px] font-semibold">지난 스캔 기록</h3>
          <div className="mt-3 divide-y divide-[#F3F4F6]">
            {[...data.invoices]
              .reverse()
              .slice(0, 10)
              .map((inv) => {
                const applied = inv.lines.filter((l) => l.include && l.matchedIngredientId);
                return (
                  <div key={inv.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <FileText className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
                    <span className="text-[12px] font-medium">{inv.invoiceDate}</span>
                    <span className="text-[11px] text-[#6B7280]">
                      {data.suppliers.find((s) => s.id === inv.supplierId)?.name ?? "미지정"} ·{" "}
                      {applied.length}개 품목 ·{" "}
                      {formatWon(applied.reduce((a, l) => a + l.amount, 0))}
                    </span>
                    <span className="ml-auto text-[11px] text-[#9CA3AF]">
                      {formatNumber(inv.lines.length)}줄 인식
                    </span>
                  </div>
                );
              })}
          </div>
        </Card>
      )}
    </div>
  );
}
