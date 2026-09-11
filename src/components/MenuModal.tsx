import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { MenuCategory, MenuItem, RecipeLine } from "../types";
import { useStore } from "../store";
import { computeMenuCost } from "../lib/menu";
import { menuCategoryLabel, menuCategoryOrder } from "../lib/labels";
import { formatNumber, formatPercent, formatWon } from "../lib/format";
import { makeId } from "../lib/storage";
import { Button, Field, MiniBar, Modal, Select, TextInput } from "./ui";

function blank(): MenuItem {
  return {
    id: "",
    name: "",
    note: "",
    categoryId: "HOTPOT",
    price: 0,
    lines: [],
    active: true,
  };
}

export default function MenuModal({
  open,
  menu,
  onClose,
}: {
  open: boolean;
  /** null 이면 신규 등록 */
  menu: MenuItem | null;
  onClose: () => void;
}) {
  const { data, upsertMenu, deleteMenu } = useStore();
  const [form, setForm] = useState<MenuItem>(blank());
  const [error, setError] = useState("");

  const activeIngredients = useMemo(
    () => data.ingredients.filter((i) => i.active),
    [data.ingredients],
  );

  useEffect(() => {
    if (!open) return;
    setForm(menu ? { ...menu, lines: menu.lines.map((l) => ({ ...l })) } : blank());
    setError("");
  }, [open, menu]);

  const cost = useMemo(
    () => computeMenuCost(form, data.ingredients),
    [form, data.ingredients],
  );

  const set = <K extends keyof MenuItem>(k: K, v: MenuItem[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setLine = (index: number, patch: Partial<RecipeLine>) =>
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));

  const addLine = () => {
    // 아직 쓰지 않은 원재료를 기본값으로 고른다
    const used = new Set(form.lines.map((l) => l.ingredientId));
    const next = activeIngredients.find((i) => !used.has(i.id)) ?? activeIngredients[0];
    if (!next) return;
    setForm((f) => ({ ...f, lines: [...f.lines, { ingredientId: next.id, quantity: 0.1 }] }));
  };

  const removeLine = (index: number) =>
    setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== index) }));

  const submit = () => {
    if (!form.name.trim()) {
      setError("메뉴명을 입력해주세요.");
      return;
    }
    if (form.price <= 0) {
      setError("판매가를 입력해주세요.");
      return;
    }
    if (form.lines.length === 0) {
      setError("재료를 한 가지 이상 추가해주세요.");
      return;
    }
    if (form.lines.some((l) => l.quantity <= 0)) {
      setError("재료 소요량은 0보다 커야 합니다.");
      return;
    }
    const ids = form.lines.map((l) => l.ingredientId);
    if (new Set(ids).size !== ids.length) {
      setError("같은 원재료가 중복으로 들어가 있습니다.");
      return;
    }
    upsertMenu({ ...form, id: form.id || makeId("menu"), name: form.name.trim() });
    onClose();
  };

  const remove = () => {
    if (!menu) return;
    if (window.confirm(`'${menu.name}'을(를) 메뉴에서 제외할까요? 지난 판매 기록은 그대로 남습니다.`)) {
      deleteMenu(menu.id);
      onClose();
    }
  };

  const ratioTone =
    cost.costRatio > 45 ? "text-[#B42318]" : cost.costRatio > 35 ? "text-[#B45309]" : "text-[#16A34A]";

  return (
    <Modal
      open={open}
      title={menu ? "메뉴 수정" : "메뉴 등록"}
      subtitle="1인분 기준 재료 소요량을 입력하면 원가가 자동으로 계산됩니다"
      onClose={onClose}
      wide
      footer={
        <>
          {menu && (
            <Button variant="danger" onClick={remove} className="mr-auto">
              메뉴에서 제외
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
        <Field label="메뉴명">
          <TextInput
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="예: 조개전골 (2인)"
          />
        </Field>
        <Field label="메뉴 설명">
          <TextInput
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="예: 간판 메뉴"
          />
        </Field>
        <Field label="분류">
          <Select
            value={form.categoryId}
            onChange={(e) => set("categoryId", e.target.value as MenuCategory)}
          >
            {menuCategoryOrder.map((c) => (
              <option key={c} value={c}>
                {menuCategoryLabel[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="판매가 (원)">
          <TextInput
            type="number"
            min="0"
            step="100"
            value={form.price}
            onChange={(e) => set("price", Number(e.target.value))}
          />
        </Field>
      </div>

      {/* 원가 요약 */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FB] px-3 py-2.5">
          <div className="text-[11px] text-[#6B7280]">1인분 원가</div>
          <div className="mt-1 text-[15px] font-bold">{formatWon(cost.cost)}</div>
        </div>
        <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FB] px-3 py-2.5">
          <div className="text-[11px] text-[#6B7280]">마진</div>
          <div className="mt-1 text-[15px] font-bold">{formatWon(cost.margin)}</div>
        </div>
        <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FB] px-3 py-2.5">
          <div className="text-[11px] text-[#6B7280]">원가율</div>
          <div className={`mt-1 text-[15px] font-bold ${ratioTone}`}>
            {formatPercent(cost.costRatio)}
          </div>
        </div>
      </div>

      {/* 재료 목록 */}
      <div className="mt-5">
        <div className="flex items-center justify-between">
          <h4 className="text-[13px] font-bold">재료 구성 (1인분 기준)</h4>
          <Button onClick={addLine} disabled={activeIngredients.length === 0}>
            <Plus className="h-3.5 w-3.5" />
            재료 추가
          </Button>
        </div>

        {form.lines.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-[#E5E7EB] px-3 py-6 text-center text-[12px] text-[#9CA3AF]">
            아직 재료가 없습니다. 재료를 추가하면 원가가 계산됩니다.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {form.lines.map((line, index) => {
              const detail = cost.lines[index];
              const ing = detail?.ingredient;
              return (
                <div
                  key={`${line.ingredientId}-${index}`}
                  className="flex flex-wrap items-center gap-2 rounded-xl bg-[#F8F9FB] px-3 py-2.5"
                >
                  <div className="min-w-[150px] flex-1">
                    <Select
                      value={line.ingredientId}
                      onChange={(e) => setLine(index, { ingredientId: e.target.value })}
                    >
                      {activeIngredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} · {i.note}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TextInput
                      type="number"
                      step="0.005"
                      min="0"
                      value={line.quantity}
                      onChange={(e) => setLine(index, { quantity: Number(e.target.value) })}
                      className="w-24 text-right"
                    />
                    <span className="w-8 text-[12px] text-[#6B7280]">{ing?.unit ?? ""}</span>
                  </div>
                  <div className="w-[96px] text-right">
                    <div className="text-[12px] font-medium">{formatWon(detail?.cost ?? 0)}</div>
                    <div className="mt-1">
                      <MiniBar ratio={(detail?.share ?? 0) / 100} className="bg-[#0F4C5C]" />
                    </div>
                  </div>
                  <button
                    onClick={() => removeLine(index)}
                    aria-label="재료 삭제"
                    className="rounded-lg border border-[#E5E7EB] bg-white p-1.5 text-[#B42318] hover:bg-[#FFF0EE]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {form.lines.length > 0 && (
          <p className="mt-3 text-[11px] text-[#9CA3AF]">
            현재 재고로 만들 수 있는 수량: <strong>{formatNumber(cost.makeableServings)}인분</strong>
            {cost.bottleneck && ` · 가장 먼저 떨어지는 재료: ${cost.bottleneck.name}`}
          </p>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-[#FFD6C7] bg-[#FFF0EE] px-3 py-2.5 text-[12px] font-medium text-[#B42318]">
          {error}
        </div>
      )}
    </Modal>
  );
}
