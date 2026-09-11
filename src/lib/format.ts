// 화면 표기는 모두 한국(ko-KR) 형식을 따른다.

const currencyFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });

export function formatWon(value: number): string {
  if (!Number.isFinite(value)) return "₩0";
  return currencyFormatter.format(Math.round(value));
}

/** 큰 금액을 만/억 단위로 줄여 표기 (예: 168만) */
export function formatWonShort(value: number): string {
  const v = Math.round(value);
  if (Math.abs(v) >= 100_000_000) return `${numberFormatter.format(v / 100_000_000)}억`;
  if (Math.abs(v) >= 10_000) return `${numberFormatter.format(v / 10_000)}만`;
  return formatWon(v);
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return numberFormatter.format(value);
}

export function formatQty(value: number, unit: string): string {
  return `${formatNumber(value)}${unit}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** a 기준으로 b 까지 남은 일수 */
export function daysBetween(fromIso: string, toIsoStr: string): number {
  const a = new Date(`${fromIso}T00:00:00`).getTime();
  const b = new Date(`${toIsoStr}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function daysUntil(iso: string): number {
  return daysBetween(todayIso(), iso);
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

export function formatWeekday(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ko-KR", { weekday: "short" });
}

export function formatDateTime(isoDateTime: string): string {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return isoDateTime;
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "3일 남음" / "오늘 만료" / "2일 경과" */
export function formatRemainingDays(days: number): string {
  if (days < 0) return `${Math.abs(days)}일 경과`;
  if (days === 0) return "오늘 만료";
  return `${days}일 남음`;
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(digits)}%`;
}

export function formatSignedPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "0%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}
