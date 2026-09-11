import { useEffect, useMemo, useState } from "react";
import type { AdjustmentReason, StockOutReason, TransactionType } from "../types";
import { useStore } from "../store";
import {
  adjustmentReasonLabel,
  stockOutReasonLabel,
  transactionTypeLabel,
} from "../lib/labels";
import { formatNumber, formatWon, todayIso } from "../lib/format";
import { Button, Field, Modal, Select, TextInput } from "./ui";
import { checkPriceDeviation, priceAlertLabel, recentPriceStats } from "../lib/priceTrend";

export default function StockMoveModal({
  open,
  type,
  initialIngredientId,
  onClose,
}: {
  open: boolean;
  type: TransactionType;
  initialIngredientId?: string;
  onClose: () => void;
}) {
  const { data, moveStock } = useStore();
  const active = useMemo(() => data.ingredients.filter((i) => i.active), [data.ingredients]);

  const [ingredientId, setIngredientId] = useState(initialIngredientId ?? active[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [absolute, setAbsolute] = useState("0");
  const [unitCost, setUnitCost] = useState("0");
  const [reason, setReason] = useState<string>("COOKING");
  const [supplierId, setSupplierId] = useState("");
  const [expiry, setExpiry] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");

  const ingredient = data.ingredients.find((i) => i.id === ingredientId);

  useEffect(() => {
    if (!open) return;
    const id = initialIngredientId ?? active[0]?.id ?? "";
    setIngredientId(id);
    const ing = data.ingredients.find((i) => i.id === id);
    setQuantity("1");
    setAbsolute(ing ? String(ing.stock) : "0");
    setUnitCost(ing ? String(ing.costPerUnit) : "0");
    setSupplierId(ing?.supplierId ?? "");
    setExpiry(ing?.expiryDate ?? todayIso());
    setReason(type === "STOCK_OUT" ? "COOKING" : type === "ADJUSTMENT" ? "COUNT_DIFF" : "PURCHASE");
    setMemo("");
    setError("");
    // initialIngredientId 가 바뀔 때마다 폼을 초기화한다
  }, [open, initialIngredientId, type, active, data.ingredients]);

  useEffect(() => {
    if (!ingredient) return;
    setAbsolute(String(ingredient.stock));
    setUnitCost(String(ingredient.costPerUnit));
    setSupplierId(ingredient.supplierId);
    setExpiry(ingredient.expiryDate);
  }, [ingredient]);

  if (!ingredient) return null;

  const qty = Number(quantity) || 0;
  const abs = Number(absolute) || 0;
  const cost = Number(unitCost) || 0;

  // 입고 단가가 최근 평균에서 크게 벗어나면 확인시켜 준다
  const priceAlert =
    type === "STOCK_IN" ? checkPriceDeviation(cost, recentPriceStats(ingredientId, data.transactions)) : null;

  const resultingStock =
    type === "STOCK_IN"
      ? ingredient.stock + qty
      : type === "STOCK_OUT"
        ? ingredient.stock - qty
        : abs;

  const submit = () => {
    setError("");

    if (type !== "ADJUSTMENT") {
      if (qty <= 0) {
        setError("수량은 0보다 커야 합니다.");
        return;
      }
      if (type === "STOCK_OUT" && qty > ingredient.stock) {
        setError("현재 재고보다 많은 수량을 출고할 수 없습니다.");
        return;
      }
    } else if (abs < 0) {
      setError("재고 수량은 0 이상이어야 합니다.");
      return;
    }

    moveStock({
      ingredientId,
      type,
      quantity: qty,
      absoluteStock: type === "ADJUSTMENT" ? abs : undefined,
      reason: reason as StockOutReason | AdjustmentReason,
      unitCost: type === "STOCK_IN" ? cost : ingredient.costPerUnit,
      supplierId: type === "STOCK_IN" ? supplierId : undefined,
      // 유통기한·공급업체 갱신은 재고 반영과 같은 동작 안에서 처리된다
      newExpiryDate: type === "STOCK_IN" ? expiry : undefined,
      memo: memo.trim() || undefined,
    });

    onClose();
  };

  const titles: Record<TransactionType, string> = {
    STOCK_IN: "입고 등록",
    STOCK_OUT: "출고 등록",
    ADJUSTMENT: "재고 조정",
  };
  const subtitles: Record<TransactionType, string> = {
    STOCK_IN: "매입한 원재료를 재고에 반영합니다",
    STOCK_OUT: "사용·폐기한 수량을 재고에서 차감합니다",
    ADJUSTMENT: "실사 결과에 맞춰 재고를 맞춥니다",
  };

  return (
    <Modal
      open={open}
      title={titles[type]}
      subtitle={subtitles[type]}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit}>
            {transactionTypeLabel[type]} 확인
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="원재료">
          <Select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)}>
            {active.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} · {i.note} (재고 {formatNumber(i.stock)}
                {i.unit})
              </option>
            ))}
          </Select>
        </Field>

        {type === "ADJUSTMENT" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label={`실사 재고 (${ingredient.unit})`} hint={`장부 재고 ${formatNumber(ingredient.stock)}${ingredient.unit}`}>
              <TextInput
                type="number"
                step="0.1"
                value={absolute}
                onChange={(e) => setAbsolute(e.target.value)}
              />
            </Field>
            <Field label="조정 사유">
              <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                {Object.entries(adjustmentReasonLabel).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label={`수량 (${ingredient.unit})`}>
              <TextInput
                type="number"
                step="0.1"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>
            {type === "STOCK_OUT" ? (
              <Field label="출고 사유">
                <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                  {Object.entries(stockOutReasonLabel).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field
                label="단가 (원)"
                hint={
                  priceAlert
                    ? `${priceAlertLabel(priceAlert)} (최근 평균 ${formatWon(
                        Math.round(priceAlert.stats.avg),
                      )})`
                    : undefined
                }
              >
                <TextInput
                  type="number"
                  min="0"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                />
              </Field>
            )}
          </div>
        )}

        {type === "STOCK_IN" && (
          <div className="grid grid-cols-2 gap-3">
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
            <Field label="유통기한">
              <TextInput type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </Field>
          </div>
        )}

        <Field label="메모 (선택)">
          <TextInput
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="특이사항을 입력하세요"
          />
        </Field>

        <div className="rounded-xl border border-[#FFE9C7] bg-[#FFF4E5] px-3 py-2.5 text-[12px] text-[#9C5A1A]">
          처리 후 재고:{" "}
          <strong>
            {formatNumber(Math.max(0, resultingStock))}
            {ingredient.unit}
          </strong>
          {type === "STOCK_IN" && (
            <>
              {" "}
              · 매입 금액 <strong>{formatWon(qty * cost)}</strong>
            </>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-[#FFD6C7] bg-[#FFF0EE] px-3 py-2.5 text-[12px] font-medium text-[#B42318]">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
