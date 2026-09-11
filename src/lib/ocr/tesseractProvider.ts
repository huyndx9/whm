import type { ExtractionResult, OcrProvider } from "./types";
import { findInvoiceDate, parseReceiptText } from "./parseText";
import { todayIso } from "../format";

export function createTesseractProvider(): OcrProvider {
  return {
    id: "tesseract",
    isAvailable: () => true,
    unavailableReason: () => "",

    async extract(imageDataUrl, onProgress): Promise<ExtractionResult> {
      onProgress?.("인식 엔진을 불러오는 중입니다...");
      // 번들 크기를 줄이기 위해 실제로 쓸 때만 불러온다
      const { createWorker } = await import("tesseract.js");

      const worker = await createWorker("kor+eng", 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") {
            onProgress?.(`글자를 읽는 중입니다... ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      try {
        const { data } = await worker.recognize(imageDataUrl);
        const text = data.text ?? "";
        onProgress?.("품목을 정리하는 중입니다...");
        const lines = parseReceiptText(text);
        return {
          supplierName: "",
          invoiceDate: findInvoiceDate(text) || todayIso(),
          lines,
          rawText: text,
        };
      } finally {
        await worker.terminate();
      }
    },
  };
}
