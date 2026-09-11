import { useMemo, useState } from "react";
import { Clock, MapPin, Pencil, Phone, Plus, Truck } from "lucide-react";
import type { Supplier } from "../types";
import { useStore } from "../store";
import { makeId } from "../lib/storage";
import { formatNumber, formatWon } from "../lib/format";
import { Button, Card, EmptyState, Field, Modal, SectionTitle, TextInput } from "../components/ui";

function blank(): Supplier {
  return {
    id: "",
    name: "",
    phone: "",
    address: "",
    specialty: "",
    leadTimeDays: 1,
    orderCutoff: "15:00",
    active: true,
  };
}

export default function Suppliers() {
  const { data, upsertSupplier, deleteSupplier } = useStore();
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const active = data.suppliers.filter((s) => s.active);

  const stats = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const i of data.ingredients) {
      if (!i.active) continue;
      const cur = map.get(i.supplierId) ?? { count: 0, value: 0 };
      cur.count += 1;
      cur.value += i.stock * i.costPerUnit;
      map.set(i.supplierId, cur);
    }
    return map;
  }, [data.ingredients]);

  const startNew = () => {
    setEditing(blank());
    setError("");
    setOpen(true);
  };

  const startEdit = (s: Supplier) => {
    setEditing({ ...s });
    setError("");
    setOpen(true);
  };

  const save = () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      setError("공급업체명을 입력해주세요.");
      return;
    }
    if (editing.leadTimeDays < 0) {
      setError("리드타임은 0일 이상이어야 합니다.");
      return;
    }
    upsertSupplier({ ...editing, id: editing.id || makeId("sup"), name: editing.name.trim() });
    setOpen(false);
  };

  const remove = () => {
    if (!editing?.id) return;
    const inUse = data.ingredients.some((i) => i.active && i.supplierId === editing.id);
    if (inUse) {
      setError("이 공급업체를 사용하는 원재료가 있어 삭제할 수 없습니다.");
      return;
    }
    if (window.confirm(`'${editing.name}'을(를) 목록에서 제외할까요?`)) {
      deleteSupplier(editing.id);
      setOpen(false);
    }
  };

  const set = <K extends keyof Supplier>(k: K, v: Supplier[K]) =>
    setEditing((e) => (e ? { ...e, [k]: v } : e));

  return (
    <div className="space-y-4">
      <SectionTitle
        title="공급업체"
        subtitle={`${active.length}개 업체 · 리드타임은 발주 제안에 그대로 반영됩니다`}
        right={
          <Button variant="primary" onClick={startNew}>
            <Plus className="h-3.5 w-3.5" />
            공급업체 등록
          </Button>
        }
      />

      {active.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Truck className="h-8 w-8" />}
            title="등록된 공급업체가 없습니다"
            action={
              <Button variant="primary" onClick={startNew}>
                공급업체 등록
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((s) => {
            const st = stats.get(s.id) ?? { count: 0, value: 0 };
            const items = data.ingredients.filter((i) => i.active && i.supplierId === s.id);
            return (
              <Card key={s.id} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0F4C5C] text-[13px] font-bold text-white">
                      {s.name.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold">{s.name}</div>
                      <div className="truncate text-[11px] text-[#6B7280]">{s.specialty}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => startEdit(s)}
                    aria-label="수정"
                    className="rounded-lg border border-[#E5E7EB] p-1.5 text-[#6B7280] hover:bg-[#F9FAFB]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-4 space-y-2 text-[12px] text-[#4B5563]">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
                    {s.phone || "번호 없음"}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
                    {s.address || "주소 없음"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
                    리드타임 {s.leadTimeDays}일 · 발주 마감 {s.orderCutoff}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[#F3F4F6] pt-4">
                  <div>
                    <div className="text-[11px] text-[#9CA3AF]">공급 원재료</div>
                    <div className="text-[13px] font-semibold">
                      {st.count}종 · {formatWon(st.value)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {items.slice(0, 6).map((i) => (
                    <span
                      key={i.id}
                      className="whitespace-nowrap rounded-full border border-[#E5E7EB] bg-[#F8F9FB] px-2 py-1 text-[10px]"
                    >
                      {i.name} {formatNumber(i.stock)}
                      {i.unit}
                    </span>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={open && editing !== null}
        title={editing?.id ? "공급업체 수정" : "공급업체 등록"}
        onClose={() => setOpen(false)}
        footer={
          <>
            {editing?.id && (
              <Button variant="danger" onClick={remove} className="mr-auto">
                목록에서 제외
              </Button>
            )}
            <Button onClick={() => setOpen(false)}>취소</Button>
            <Button variant="primary" onClick={save}>
              저장
            </Button>
          </>
        }
      >
        {editing && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="공급업체명">
              <TextInput value={editing.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="연락처">
              <TextInput
                value={editing.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="051-123-4567"
              />
            </Field>
            <Field label="주소">
              <TextInput value={editing.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <Field label="주요 품목">
              <TextInput
                value={editing.specialty}
                onChange={(e) => set("specialty", e.target.value)}
                placeholder="예: 신선 해산물"
              />
            </Field>
            <Field label="리드타임 (일)" hint="발주 후 입고까지 걸리는 일수">
              <TextInput
                type="number"
                min="0"
                value={editing.leadTimeDays}
                onChange={(e) => set("leadTimeDays", Number(e.target.value))}
              />
            </Field>
            <Field label="발주 마감 시각">
              <TextInput
                type="time"
                value={editing.orderCutoff}
                onChange={(e) => set("orderCutoff", e.target.value)}
              />
            </Field>
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-xl border border-[#FFD6C7] bg-[#FFF0EE] px-3 py-2.5 text-[12px] font-medium text-[#B42318]">
            {error}
          </div>
        )}
      </Modal>
    </div>
  );
}
