import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, MessageSquare, Printer } from "lucide-react";
import type { OrderDocInput } from "../lib/orderDoc";
import {
  buildPurchaseOrderHtml,
  downloadPurchaseOrderCsv,
  downloadPurchaseOrderHtml,
  printPurchaseOrder,
} from "../lib/orderDoc";
import { Button, Modal } from "./ui";

export default function PurchaseOrderModal({
  open,
  input,
  onClose,
  onSendMessage,
}: {
  open: boolean;
  input: OrderDocInput | null;
  onClose: () => void;
  onSendMessage?: () => void;
}) {
  const [notice, setNotice] = useState("");

  // 미리보기와 저장되는 파일이 같은 HTML 이어야 보이는 대로 출력된다
  const html = useMemo(() => (input ? buildPurchaseOrderHtml(input) : ""), [input]);

  if (!input) return null;

  const doPrint = () => {
    const ok = printPurchaseOrder(input);
    setNotice(
      ok
        ? ""
        : "새 창이 차단되었습니다. 브라우저의 팝업 차단을 해제하거나 아래에서 파일로 저장해주세요.",
    );
  };

  return (
    <Modal
      open={open}
      title={`발주서 ${input.order.code}`}
      subtitle={`${input.supplier?.name ?? "공급업체"} · 단가는 공급업체가 기입하도록 비워 두었습니다`}
      onClose={onClose}
      wide
      footer={
        <>
          {onSendMessage && (
            <Button onClick={onSendMessage} className="mr-auto">
              <MessageSquare className="h-3.5 w-3.5" />
              문자 보내기
            </Button>
          )}
          <Button onClick={() => downloadPurchaseOrderCsv(input)}>
            <FileSpreadsheet className="h-3.5 w-3.5" />
            엑셀(CSV)
          </Button>
          <Button onClick={() => downloadPurchaseOrderHtml(input)}>
            <Download className="h-3.5 w-3.5" />
            파일 저장
          </Button>
          <Button variant="primary" onClick={doPrint}>
            <Printer className="h-3.5 w-3.5" />
            인쇄 / PDF 저장
          </Button>
        </>
      }
    >
      <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
        <iframe
          title={`발주서 ${input.order.code} 미리보기`}
          srcDoc={html}
          className="h-[460px] w-full border-0 bg-white"
        />
      </div>

      <p className="mt-3 text-[11px] text-[#9CA3AF]">
        인쇄 창에서 대상을 &quot;PDF로 저장&quot;으로 고르면 PDF 파일이 됩니다. 카카오톡으로
        보낼 때는 PDF가 가장 깔끔합니다.
      </p>

      {notice && (
        <div className="mt-3 rounded-xl border border-[#FFE9C7] bg-[#FFF4E5] px-3 py-2.5 text-[12px] font-medium text-[#9C5A1A]">
          {notice}
        </div>
      )}
    </Modal>
  );
}
