import { useEffect, useRef, useState } from "react";
import { Check, Copy, MessageSquare } from "lucide-react";
import { copyText } from "../lib/clipboard";
import { Button, Modal, TextArea } from "./ui";

export default function OrderMessageModal({
  open,
  text,
  onClose,
}: {
  open: boolean;
  text: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setState("idle");
  }, [open, text]);

  const doCopy = async () => {
    const ok = await copyText(text);
    setState(ok ? "copied" : "failed");
    // 자동 복사가 막힌 환경(창이 비활성 상태 등)에서는 바로 Ctrl+C 할 수 있게 잡아 준다
    if (!ok) {
      areaRef.current?.focus();
      areaRef.current?.select();
    }
  };

  return (
    <Modal
      open={open}
      title="발주 문자 보내기"
      subtitle="복사한 뒤 카카오톡 대화방에 붙여넣으세요"
      onClose={onClose}
      wide
      footer={
        <>
          <Button onClick={onClose}>닫기</Button>
          <Button variant="primary" onClick={doCopy}>
            {state === "copied" ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {state === "copied" ? "복사됨" : "복사하기"}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-2 rounded-xl border border-[#E5E7EB] bg-[#F8F9FB] px-3 py-2.5 text-[12px] text-[#4B5563]">
        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[#9CA3AF]" />
        <span>
          아래 내용을 복사해 공급업체 카카오톡 대화방에 붙여넣으면 됩니다. 필요하면 문구를
          직접 고쳐서 보내셔도 됩니다.
        </span>
      </div>

      <TextArea
        ref={areaRef}
        value={text}
        readOnly
        rows={14}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-3 text-[12px] leading-relaxed"
      />

      {state === "copied" && (
        <div className="mt-3 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2.5 text-[12px] font-medium text-[#16A34A]">
          클립보드에 복사되었습니다. 카카오톡을 열어 붙여넣기 하세요.
        </div>
      )}
      {state === "failed" && (
        <div className="mt-3 rounded-xl border border-[#FFE9C7] bg-[#FFF4E5] px-3 py-2.5 text-[12px] font-medium text-[#9C5A1A]">
          자동 복사가 되지 않았습니다. 위 내용을 직접 선택해서 복사해주세요.
        </div>
      )}
    </Modal>
  );
}
