import type { OcrProviderId } from "../../types";

/** OCR 가 뽑아낸 한 줄 - 아직 우리 원재료와 연결되기 전 상태 */
export interface ExtractedLine {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

export interface ExtractionResult {
  supplierName: string;
  invoiceDate: string;
  lines: ExtractedLine[];
  rawText: string;
}

export interface OcrProvider {
  id: OcrProviderId;
  /** 지금 이 환경에서 쓸 수 있는지 (예: API 키 유무) */
  isAvailable(): boolean;
  /** 사용할 수 없을 때 화면에 보여 줄 한국어 안내 */
  unavailableReason(): string;
  extract(imageDataUrl: string, onProgress?: (msg: string) => void): Promise<ExtractionResult>;
}

/** data:image/jpeg;base64,xxxx → { mediaType, base64 } */
export function splitDataUrl(dataUrl: string): { mediaType: string; base64: string } {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("이미지 형식을 읽을 수 없습니다.");
  return { mediaType: match[1], base64: match[2] };
}
