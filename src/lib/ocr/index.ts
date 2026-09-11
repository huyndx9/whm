import type { Settings } from "../../types";
import { createClaudeProvider } from "./claudeProvider";
import { createDemoProvider } from "./demoProvider";
import { createTesseractProvider } from "./tesseractProvider";
import type { OcrProvider } from "./types";

export function getProvider(settings: Settings): OcrProvider {
  switch (settings.ocrProvider) {
    case "claude":
      return createClaudeProvider(settings.claudeApiKey, settings.claudeModel);
    case "tesseract":
      return createTesseractProvider();
    default:
      return createDemoProvider();
  }
}

export * from "./types";
export * from "./match";
