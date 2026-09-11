import { todayIso } from "./format";

type Cell = string | number;

function escapeCell(value: Cell): string {
  const s = String(value ?? "");
  // 쉼표, 따옴표, 줄바꿈이 들어 있으면 따옴표로 감싼다
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * 한국어가 깨지지 않도록 UTF-8 BOM 을 붙여서 내려받는다.
 * (BOM 이 없으면 엑셀이 한글을 깨진 글자로 연다)
 */
export function downloadCsv(baseName: string, headers: string[], rows: Cell[][]): void {
  downloadCsvRows(baseName, [headers, ...rows]);
}

/**
 * 표 형태가 아닌 문서(머리글 블록이 있는 발주서 등)를 위해
 * 행을 그대로 받아 내려받는다.
 */
export function downloadCsvRows(baseName: string, rows: Cell[][], fileName?: string): void {
  const body = rows.map((r) => r.map(escapeCell).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName ?? `${baseName}-${todayIso()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
