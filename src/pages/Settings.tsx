import { useRef, useState } from "react";
import { AlertTriangle, Download, Eye, EyeOff, RotateCcw, Upload } from "lucide-react";
import type { AppData, OcrProviderId } from "../types";
import { useStore } from "../store";
import { ocrProviderLabel } from "../lib/labels";
import { exportJson } from "../lib/storage";
import { todayIso } from "../lib/format";
import { Button, Card, Field, SectionTitle, Select, TextInput } from "../components/ui";
import MenuManager from "../components/MenuManager";

type Tab = "menu" | "general" | "forecast" | "ocr" | "data";

const TABS: { id: Tab; label: string }[] = [
  { id: "menu", label: "메뉴 · 레시피" },
  { id: "general", label: "매장 정보" },
  { id: "forecast", label: "예측 기준" },
  { id: "ocr", label: "영수증 인식" },
  { id: "data", label: "데이터 관리" },
];

const MODELS = [
  { id: "claude-opus-5", label: "Claude Opus 5 (가장 정확)" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 (빠르고 저렴)" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (가장 저렴)" },
];

export default function SettingsPage() {
  const { data, updateSettings, resetAll, importData } = useStore();
  const s = data.settings;
  const [showKey, setShowKey] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<Tab>("menu");

  const backup = () => {
    const blob = new Blob([exportJson(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `재고데이터-백업-${todayIso()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as AppData;
      if (!Array.isArray(parsed.ingredients)) throw new Error("형식이 올바르지 않습니다.");
      if (
        window.confirm("현재 데이터를 백업 파일로 덮어씁니다. 계속할까요?")
      ) {
        importData(parsed);
        setMessage("데이터를 복원했습니다.");
      }
    } catch {
      setMessage("백업 파일을 읽지 못했습니다. 올바른 파일인지 확인해주세요.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      {/* 탭 */}
      <div className="flex flex-wrap gap-1.5 border-b border-[#E5E7EB] pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
              tab === t.id
                ? "border-transparent bg-[#0F4C5C] text-white"
                : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "menu" && <MenuManager />}

      <div className={`max-w-3xl space-y-5 ${tab === "menu" ? "hidden" : ""}`}>
      {tab === "general" && (
      <Card className="p-5">
        <SectionTitle title="매장 정보" />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="매장명">
            <TextInput
              value={s.restaurantName}
              onChange={(e) => updateSettings({ restaurantName: e.target.value })}
            />
          </Field>
        </div>
      </Card>
      )}

      {tab === "forecast" && (
      <Card className="p-5">
        <SectionTitle
          title="예측 기준"
          subtitle="발주 제안과 소진 예상일 계산에 사용됩니다"
        />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="사용량 평균 기간 (일)" hint="길수록 안정적, 짧을수록 최근 추세 반영">
            <TextInput
              type="number"
              min="7"
              max="90"
              value={s.forecastWindowDays}
              onChange={(e) =>
                updateSettings({ forecastWindowDays: Math.max(7, Number(e.target.value)) })
              }
            />
          </Field>
          <Field label="안전 재고 일수" hint="리드타임에 더해 확보할 여유 일수">
            <TextInput
              type="number"
              min="0"
              max="14"
              value={s.safetyDays}
              onChange={(e) => updateSettings({ safetyDays: Math.max(0, Number(e.target.value)) })}
            />
          </Field>
          <Field label="유통기한 임박 기준 (일)">
            <TextInput
              type="number"
              min="1"
              max="14"
              value={s.expiryWarningDays}
              onChange={(e) =>
                updateSettings({ expiryWarningDays: Math.max(1, Number(e.target.value)) })
              }
            />
          </Field>
        </div>
      </Card>
      )}

      {tab === "ocr" && (
      <Card className="p-5">
        <SectionTitle
          title="영수증 인식 방식"
          subtitle="영수증 사진에서 품목을 읽어 내는 방법을 고릅니다"
        />
        <div className="mt-4 space-y-4">
          <Field label="인식 방식">
            <Select
              value={s.ocrProvider}
              onChange={(e) => updateSettings({ ocrProvider: e.target.value as OcrProviderId })}
            >
              {Object.entries(ocrProviderLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>

          {s.ocrProvider === "claude" && (
            <>
              <Field
                label="Claude API 키"
                hint="키는 이 기기의 브라우저에만 저장되며 다른 곳으로 전송되지 않습니다."
              >
                <div className="flex gap-2">
                  <TextInput
                    type={showKey ? "text" : "password"}
                    value={s.claudeApiKey}
                    onChange={(e) => updateSettings({ claudeApiKey: e.target.value })}
                    placeholder="sk-ant-..."
                    autoComplete="off"
                  />
                  <Button onClick={() => setShowKey((v) => !v)} title={showKey ? "숨기기" : "보기"}>
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </Field>

              <Field label="사용할 모델">
                <Select
                  value={s.claudeModel}
                  onChange={(e) => updateSettings({ claudeModel: e.target.value })}
                >
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="flex items-start gap-2 rounded-xl border border-[#FFE9C7] bg-[#FFF4E5] px-3 py-2.5 text-[12px] text-[#9C5A1A]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  브라우저에서 직접 API를 호출하므로, 이 화면을 여러 사람이 쓰는 공용 PC라면 키가
                  노출될 수 있습니다. 개인 기기에서만 사용하고, 스캔 1건마다 API 사용료가
                  청구됩니다.
                </span>
              </div>
            </>
          )}

          {s.ocrProvider === "tesseract" && (
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FB] px-3 py-2.5 text-[12px] text-[#4B5563]">
              기기 안에서 글자를 읽으므로 무료이고 인터넷이 없어도 됩니다. 다만 영수증 인쇄 상태에
              따라 인식률이 낮을 수 있어, 결과를 반드시 확인하고 수정해야 합니다.
            </div>
          )}

          {s.ocrProvider === "demo" && (
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FB] px-3 py-2.5 text-[12px] text-[#4B5563]">
              실제 사진을 읽지 않고 예시 명세서를 보여 줍니다. 설정 없이 스캔부터 재고 반영까지
              전체 흐름을 확인할 때 사용하세요.
            </div>
          )}
        </div>
      </Card>
      )}

      {tab === "data" && (
      <Card className="p-5">
        <SectionTitle
          title="데이터 관리"
          subtitle="모든 데이터는 이 브라우저에 저장됩니다. 정기적으로 백업하세요."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={backup}>
            <Download className="h-3.5 w-3.5" />
            백업 파일 내려받기
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />
            백업 파일 복원
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => void restore(e.target.files?.[0])}
          />
          <Button
            variant="danger"
            onClick={() => {
              if (
                window.confirm(
                  "모든 재고·입출고·발주 데이터를 지우고 예시 데이터로 되돌립니다. 계속할까요?",
                )
              ) {
                resetAll();
                setMessage("예시 데이터로 초기화했습니다.");
              }
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            예시 데이터로 초기화
          </Button>
        </div>
        {message && (
          <div className="mt-3 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2.5 text-[12px] font-medium text-[#16A34A]">
            {message}
          </div>
        )}
      </Card>
      )}
      </div>
    </div>
  );
}
