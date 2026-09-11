import type { ExtractionResult, OcrProvider } from "./types";
import { todayIso } from "../format";

/**
 * API 키 없이도 스캔 → 검토 → 반영 흐름 전체를 체험할 수 있도록 하는 제공자.
 * 실제 이미지를 읽지 않고 시드 원재료와 맞물리는 예시 명세서를 돌려준다.
 */
export function createDemoProvider(): OcrProvider {
  return {
    id: "demo",
    isAvailable: () => true,
    unavailableReason: () => "",

    async extract(_imageDataUrl, onProgress): Promise<ExtractionResult> {
      onProgress?.("예시 데이터를 불러오는 중입니다...");
      await new Promise((r) => setTimeout(r, 900));
      onProgress?.("품목을 정리하는 중입니다...");
      await new Promise((r) => setTimeout(r, 400));

      // 단가는 시드 매입가와 비슷하게 두되, 바지락만 일부러 비싸게 잡아
      // 단가 급등 경고가 어떻게 보이는지 확인할 수 있게 했다
      const lines = [
        { name: "바지락", quantity: 10, unit: "kg", unitPrice: 11200, amount: 112000 },
        { name: "모시조개", quantity: 8, unit: "kg", unitPrice: 14000, amount: 112000 },
        { name: "굴", quantity: 6, unit: "kg", unitPrice: 18500, amount: 111000 },
        { name: "오징어", quantity: 5, unit: "kg", unitPrice: 15000, amount: 75000 },
        // 일부러 우리 원재료에 없는 품목을 섞어 매칭 실패 처리를 보여 준다
        { name: "멍게", quantity: 2, unit: "kg", unitPrice: 22000, amount: 44000 },
      ];

      return {
        supplierName: "부산수산",
        invoiceDate: todayIso(),
        lines,
        rawText: [
          "부산수산 거래명세서",
          `일자 ${todayIso()}`,
          ...lines.map(
            (l) =>
              `${l.name} ${l.quantity}${l.unit} ${l.unitPrice.toLocaleString()} ${l.amount.toLocaleString()}`,
          ),
          `합계 ${lines.reduce((a, l) => a + l.amount, 0).toLocaleString()}`,
        ].join("\n"),
      };
    },
  };
}
