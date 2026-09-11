import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// SDK 의 zodOutputFormat 은 zod v4 스키마를 요구한다 (zod 3.25 가 제공하는 하위 경로)
import { z } from "zod/v4";
import type { ExtractionResult, OcrProvider } from "./types";
import { splitDataUrl } from "./types";
import { todayIso } from "../format";

const InvoiceSchema = z.object({
  supplier_name: z.string().describe("공급업체(거래처) 상호. 못 찾으면 빈 문자열"),
  invoice_date: z.string().describe("거래 일자 yyyy-mm-dd. 못 찾으면 빈 문자열"),
  lines: z.array(
    z.object({
      name: z.string().describe("품목명. 영수증에 적힌 그대로"),
      quantity: z.number().describe("수량. 숫자만"),
      unit: z.string().describe("단위 (kg, 개, 봉, 박스, 병, L 등). 없으면 빈 문자열"),
      unit_price: z.number().describe("단가(원). 없으면 0"),
      amount: z.number().describe("공급가액/금액(원). 없으면 0"),
    }),
  ),
});

const SYSTEM_PROMPT = `당신은 한국 식당의 매입 영수증·거래명세서를 판독하는 도우미입니다.
사진에서 품목 표를 찾아 각 줄의 품목명, 수량, 단위, 단가, 금액을 정확히 추출하세요.

규칙:
- 품목 줄만 추출합니다. 합계, 소계, 부가세, 공급가액 합계, 배송비 같은 요약 행은 제외합니다.
- 숫자의 천 단위 쉼표는 제거하고 숫자만 반환합니다.
- 수량과 단위가 "5kg"처럼 붙어 있으면 수량 5, 단위 kg 로 나눕니다.
- 단가가 없고 금액과 수량만 있으면 단가는 금액 ÷ 수량 으로 계산합니다.
- 글자가 흐려 확신이 없으면 추측하지 말고 그 값은 0 또는 빈 문자열로 둡니다.
- 날짜는 반드시 yyyy-mm-dd 형식으로 변환합니다.`;

export function createClaudeProvider(apiKey: string, model: string): OcrProvider {
  return {
    id: "claude",

    isAvailable: () => apiKey.trim().length > 0,

    unavailableReason: () =>
      "Claude API 키가 등록되지 않았습니다. 설정 화면에서 키를 입력해주세요.",

    async extract(imageDataUrl, onProgress): Promise<ExtractionResult> {
      const { mediaType, base64 } = splitDataUrl(imageDataUrl);
      onProgress?.("이미지를 분석하는 중입니다...");

      const client = new Anthropic({
        apiKey,
        // 브라우저에서 직접 호출하기 위한 옵션. 키는 이 사용자의 기기에만 저장된다.
        dangerouslyAllowBrowser: true,
      });

      const response = await client.messages.parse({
        model,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        output_config: {
          format: zodOutputFormat(InvoiceSchema),
          effort: "medium",
        },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                  data: base64,
                },
              },
              {
                type: "text",
                text: "이 매입 영수증에서 품목 내역을 추출해주세요.",
              },
            ],
          },
        ],
      });

      const parsed = response.parsed_output;
      if (!parsed) {
        throw new Error("영수증을 인식하지 못했습니다. 더 선명한 사진으로 다시 시도해주세요.");
      }

      onProgress?.("품목을 정리하는 중입니다...");

      return {
        supplierName: parsed.supplier_name ?? "",
        invoiceDate: /^\d{4}-\d{2}-\d{2}$/.test(parsed.invoice_date)
          ? parsed.invoice_date
          : todayIso(),
        lines: parsed.lines
          .filter((l) => l.name.trim().length > 0)
          .map((l) => {
            const quantity = Number(l.quantity) || 0;
            const amount = Number(l.amount) || 0;
            let unitPrice = Number(l.unit_price) || 0;
            if (unitPrice === 0 && amount > 0 && quantity > 0) {
              unitPrice = Math.round(amount / quantity);
            }
            return {
              name: l.name.trim(),
              quantity,
              unit: (l.unit ?? "").trim(),
              unitPrice,
              amount: amount > 0 ? amount : Math.round(unitPrice * quantity),
            };
          }),
        rawText: JSON.stringify(parsed, null, 2),
      };
    },
  };
}
