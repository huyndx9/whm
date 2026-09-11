import { useEffect, useState } from "react";
import type { CategoryId, Ingredient, Unit } from "../types";
import { useStore } from "../store";
import { categoryLabel, categoryOrder } from "../lib/labels";
import { addDays, todayIso } from "../lib/format";
import { makeId } from "../lib/storage";
import { Button, Field, Modal, Select, TextInput } from "./ui";

const UNITS: Unit[] = ["kg", "g", "L", "ml", "개", "봉", "팩", "박스", "병", "통"];

function blank(supplierId: string): Ingredient {
  return {
    id: "",
    name: "",
    note: "",
    categoryId: "SEAFOOD",
    unit: "kg",
    stock: 0,
    minStock: 1,
    parStock: 5,
    costPerUnit: 0,
    supplierId,
    location: "",
    expiryDate: addDays(todayIso(), 7),
    active: true,
  };
}

export default function IngredientModal({
  open,
  ingredient,
  onClose,
}: {
  open: boolean;
  /** null 이면 신규 등록 */
  ingredient: Ingredient | null;
  onClose: () => void;
}) {
  const { data, upsertIngredient, deleteIngredient } = useStore();
  const [form, setForm] = useState<Ingredient>(blank(data.suppliers[0]?.id ?? ""));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(ingredient ? { ...ingredient } : blank(data.suppliers[0]?.id ?? ""));
    setError("");
  }, [open, ingredient, data.suppliers]);

  const set = <K extends keyof Ingredient>(key: K, value: Ingredient[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    if (!form.name.trim()) {
      setError("원재료명을 입력해주세요.");
      return;
    }
    if (form.minStock < 0 || form.parStock < 0 || form.costPerUnit < 0) {
      setError("수량과 단가는 0 이상이어야 합니다.");
      return;
    }
    if (form.parStock < form.minStock) {
      setError("적정 재고는 최소 재고보다 크거나 같아야 합니다.");
      return;
    }
    upsertIngredient({ ...form, id: form.id || makeId("ing"), name: form.name.trim() });
    onClose();
  };

  const remove = () => {
    if (!ingredient) return;
    if (window.confirm(`'${ingredient.name}'을(를) 목록에서 제외할까요? 지난 입출고 내역은 그대로 남습니다.`)) {
      deleteIngredient(ingredient.id);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      title={ingredient ? "원재료 수정" : "원재료 등록"}
      subtitle={ingredient ? `${ingredient.name} · ${ingredient.note}` : "새 원재료를 추가합니다"}
      onClose={onClose}
      wide
      footer={
        <>
          {ingredient && (
            <Button variant="danger" onClick={remove} className="mr-auto">
              목록에서 제외
            </Button>
          )}
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit}>
            저장
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="원재료명">
          <TextInput
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="예: 바지락"
          />
        </Field>
        <Field label="품목 설명">
          <TextInput
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="예: 국물용 조개"
          />
        </Field>

        <Field label="분류">
          <Select
            value={form.categoryId}
            onChange={(e) => set("categoryId", e.target.value as CategoryId)}
          >
            {categoryOrder.map((c) => (
              <option key={c} value={c}>
                {categoryLabel[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="단위">
          <Select value={form.unit} onChange={(e) => set("unit", e.target.value as Unit)}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={`현재 재고 (${form.unit})`}>
          <TextInput
            type="number"
            step="0.1"
            value={form.stock}
            onChange={(e) => set("stock", Number(e.target.value))}
          />
        </Field>
        <Field label="단가 (원)">
          <TextInput
            type="number"
            min="0"
            value={form.costPerUnit}
            onChange={(e) => set("costPerUnit", Number(e.target.value))}
          />
        </Field>

        <Field
          label={`최소 재고 (${form.unit})`}
          hint="이 수량 이하로 내려가면 재고 부족으로 표시됩니다"
        >
          <TextInput
            type="number"
            step="0.1"
            min="0"
            value={form.minStock}
            onChange={(e) => set("minStock", Number(e.target.value))}
          />
        </Field>
        <Field label={`적정 재고 (${form.unit})`} hint="발주 시 이 수량까지 채우도록 제안합니다">
          <TextInput
            type="number"
            step="0.1"
            min="0"
            value={form.parStock}
            onChange={(e) => set("parStock", Number(e.target.value))}
          />
        </Field>

        <Field label="공급업체">
          <Select value={form.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
            {data.suppliers
              .filter((s) => s.active)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="보관 위치">
          <TextInput
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="예: 냉장고 A1"
          />
        </Field>

        <Field label="유통기한">
          <TextInput
            type="date"
            value={form.expiryDate}
            onChange={(e) => set("expiryDate", e.target.value)}
          />
        </Field>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-[#FFD6C7] bg-[#FFF0EE] px-3 py-2.5 text-[12px] font-medium text-[#B42318]">
          {error}
        </div>
      )}
    </Modal>
  );
}
