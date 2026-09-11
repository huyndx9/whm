import { useState, type ReactNode } from "react";

/**
 * 차트 색 토큰.
 * 값은 dataviz 검증 스크립트로 흰색(#ffffff) 표면 기준 통과를 확인한 조합이다.
 *  - 매출 구성 2계열(원가/마진): 인접 대비 CVD ΔE 24.7 / 일반 시야 ΔE 33.6
 *  - 분류별 원가 4단계: 단일 색상, 명도 단조 증가, 가장 밝은 단계 대비 2.11:1
 */
export const VIZ = {
  cost: "#eb6834",
  margin: "#2a78d6",
  ramp: ["#1c5cab", "#2a78d6", "#5598e7", "#86b6ef"],
  rampLight: "#cde2fb",
  good: "#0ca30c",
  warning: "#fab219",
  critical: "#d03b3b",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  muted: "#898781",
  ink: "#0b0b0b",
  inkSoft: "#52514e",
  surface: "#ffffff",
} as const;

/** 마우스를 올린 지점에 뜨는 말풍선 */
function Tooltip({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: ReactNode;
}) {
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[11px] leading-relaxed shadow-lg"
      style={{ left: `${x}%`, top: `${y}%`, minWidth: 130 }}
    >
      {children}
    </div>
  );
}

export function ChartLegend({
  items,
}: {
  items: { color: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-[11px] text-[#52514e]">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export interface StackedPoint {
  /** 고유 키. 요일 라벨은 기간 안에서 반복되므로 키로 쓸 수 없다 */
  id: string;
  /** 축에 표기할 짧은 라벨 (요일) */
  label: string;
  /** 말풍선에 표기할 전체 라벨 (날짜) */
  fullLabel: string;
  /** 강조할 지점 (오늘) */
  highlight?: boolean;
  cost: number;
  margin: number;
}

/**
 * 매출 구성 막대.
 * 원가와 마진을 쌓아 올려 전체 높이가 곧 매출이 되도록 했다.
 * 두 값의 단위가 같으므로 축은 하나만 쓴다.
 */
export function StackedRevenueChart({
  data,
  formatValue,
}: {
  data: StackedPoint[];
  formatValue: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 760;
  const H = 240;
  const PAD_L = 8;
  const PAD_R = 8;
  const PAD_T = 18;
  const PAD_B = 26;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const totals = data.map((d) => d.cost + d.margin);
  const max = Math.max(...totals, 1);
  const n = data.length || 1;
  const slot = plotW / n;
  const barW = Math.min(30, slot * 0.62);
  const GAP = 2; // 쌓인 두 조각 사이 표면 간격

  const maxIndex = totals.indexOf(Math.max(...totals));
  const gridLines = [0.25, 0.5, 0.75, 1];

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }} role="img">
        {/* 눈금선 - 배경으로 물러나 있어야 한다 */}
        {gridLines.map((g) => (
          <line
            key={g}
            x1={PAD_L}
            x2={W - PAD_R}
            y1={PAD_T + plotH * (1 - g)}
            y2={PAD_T + plotH * (1 - g)}
            stroke={VIZ.grid}
            strokeWidth={1}
          />
        ))}
        <line
          x1={PAD_L}
          x2={W - PAD_R}
          y1={PAD_T + plotH}
          y2={PAD_T + plotH}
          stroke={VIZ.axis}
          strokeWidth={1}
        />

        {data.map((d, i) => {
          const total = d.cost + d.margin;
          const cx = PAD_L + slot * i + slot / 2;
          const x = cx - barW / 2;
          const totalH = (total / max) * plotH;
          const costH = total > 0 ? (d.cost / total) * totalH : 0;
          const marginH = Math.max(0, totalH - costH - GAP);
          const baseY = PAD_T + plotH;
          const active = hover === i;

          return (
            <g key={d.id} opacity={hover === null || active ? 1 : 0.45}>
              {/* 원가 - 바닥에 붙는 조각 */}
              <rect
                x={x}
                y={baseY - costH}
                width={barW}
                height={Math.max(0, costH)}
                fill={VIZ.cost}
                rx={0}
              />
              {/* 마진 - 위쪽 끝만 둥글게 */}
              <rect
                x={x}
                y={baseY - costH - GAP - marginH}
                width={barW}
                height={marginH}
                fill={VIZ.margin}
                rx={4}
              />
              {/* 오늘 표시 */}
              {d.highlight && (
                <rect
                  x={x - 3}
                  y={baseY - totalH - 5}
                  width={barW + 6}
                  height={totalH + 8}
                  fill="none"
                  stroke={VIZ.axis}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  rx={6}
                />
              )}
              {/* 직접 표기는 최고점에만 - 모든 막대에 숫자를 붙이지 않는다 */}
              {i === maxIndex && (
                <text
                  x={cx}
                  y={baseY - totalH - 7}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill={VIZ.ink}
                >
                  {formatValue(total)}
                </text>
              )}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill={VIZ.muted}>
                {d.label}
              </text>
              {/* 마크보다 큰 히트 영역 */}
              <rect
                x={PAD_L + slot * i}
                y={PAD_T}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>

      {hover !== null && data[hover] && (
        <Tooltip
          x={((PAD_L + slot * hover + slot / 2) / W) * 100}
          y={((PAD_T + plotH * (1 - (data[hover].cost + data[hover].margin) / max)) / H) * 100 - 2}
        >
          <div className="font-semibold text-[#0b0b0b]">{data[hover].fullLabel}</div>
          <div className="mt-1 flex justify-between gap-3 text-[#52514e]">
            <span>매출</span>
            <span className="font-medium text-[#0b0b0b]">
              {formatValue(data[hover].cost + data[hover].margin)}
            </span>
          </div>
          <div className="flex justify-between gap-3 text-[#52514e]">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: VIZ.cost }} />
              원가
            </span>
            <span>{formatValue(data[hover].cost)}</span>
          </div>
          <div className="flex justify-between gap-3 text-[#52514e]">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: VIZ.margin }} />
              마진
            </span>
            <span>{formatValue(data[hover].margin)}</span>
          </div>
          <div className="mt-1 flex justify-between gap-3 border-t border-[#F3F4F6] pt-1 text-[#52514e]">
            <span>원가율</span>
            <span className="font-medium">
              {(data[hover].cost + data[hover].margin > 0
                ? (data[hover].cost / (data[hover].cost + data[hover].margin)) * 100
                : 0
              ).toFixed(1)}
              %
            </span>
          </div>
        </Tooltip>
      )}
    </div>
  );
}

/**
 * 원가율 하나를 보여 주는 지표.
 * 원형 그래프 대신 목표 구간을 띠로 깔고 현재 값을 표시한다.
 */
export function CostRatioBullet({
  value,
  targetMin = 30,
  targetMax = 38,
  max = 60,
}: {
  value: number;
  targetMin?: number;
  targetMax?: number;
  max?: number;
}) {
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  const state = value <= targetMax ? "good" : value <= targetMax + 7 ? "warning" : "critical";
  const stateColor =
    state === "good" ? VIZ.good : state === "warning" ? VIZ.warning : VIZ.critical;
  const stateLabel = state === "good" ? "적정" : state === "warning" ? "주의" : "높음";

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-[28px] font-bold leading-none tracking-tight">
          {value.toFixed(1)}%
        </span>
        {/* 상태는 색만으로 전달하지 않고 항상 글자를 함께 붙인다 */}
        <span
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: `${stateColor}1a`, color: state === "warning" ? "#8a6100" : stateColor }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: stateColor }} />
          {stateLabel}
        </span>
      </div>

      <div className="relative mt-3 h-3 w-full rounded-full bg-[#F3F4F6]">
        {/* 목표 구간 */}
        <div
          className="absolute top-0 h-full rounded-full bg-[#cde2fb]"
          style={{ left: pct(targetMin), width: `calc(${pct(targetMax)} - ${pct(targetMin)})` }}
        />
        {/* 현재 값 */}
        <div
          className="absolute top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full"
          style={{ left: pct(value), background: VIZ.ink }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-[#898781]">
        <span>0%</span>
        <span>
          목표 {targetMin}~{targetMax}%
        </span>
        <span>{max}%</span>
      </div>
    </div>
  );
}

export interface ShareItem {
  label: string;
  value: number;
  percent: number;
}

/** 분류별 비중 - 색은 크기 순서를 나타내므로 한 가지 색의 명도 단계만 쓴다 */
export function ShareBars({
  items,
  formatValue,
}: {
  items: ShareItem[];
  formatValue: (n: number) => string;
}) {
  const maxPct = Math.max(...items.map((i) => i.percent), 1);
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div key={item.label} className="group">
          <div className="flex items-baseline justify-between gap-2 text-[12px]">
            <span className="truncate font-medium text-[#0b0b0b]">{item.label}</span>
            <span className="shrink-0 text-[11px] text-[#52514e]">
              {item.percent.toFixed(1)}% · {formatValue(item.value)}
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#F3F4F6]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(item.percent / maxPct) * 100}%`,
                background: VIZ.ramp[Math.min(i, VIZ.ramp.length - 1)],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface HeatCell {
  /** 0=일 ~ 6=토 */
  weekday: number;
  /** 0 이 가장 오래된 주 */
  week: number;
  date: string;
  value: number;
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/** 요일 × 주차 히트맵 - 값의 크기를 한 색상의 진하기로 표현한다 */
export function WeekdayHeatmap({
  cells,
  weeks,
  formatValue,
}: {
  cells: HeatCell[];
  weeks: number;
  formatValue: (n: number) => string;
}) {
  const [hover, setHover] = useState<HeatCell | null>(null);
  const max = Math.max(...cells.map((c) => c.value), 1);

  const colorFor = (v: number): string => {
    if (v <= 0) return "#F3F4F6";
    const t = v / max;
    if (t > 0.8) return VIZ.ramp[0];
    if (t > 0.6) return VIZ.ramp[1];
    if (t > 0.4) return VIZ.ramp[2];
    if (t > 0.2) return VIZ.ramp[3];
    return VIZ.rampLight;
  };

  const byKey = new Map(cells.map((c) => [`${c.week}-${c.weekday}`, c]));

  return (
    <div className="relative">
      <div className="flex gap-1.5">
        {/* 요일 라벨 */}
        <div className="flex w-6 shrink-0 flex-col gap-1.5 pt-[18px]">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="flex h-5 items-center text-[10px] text-[#898781]">
              {w}
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex gap-1.5">
            {Array.from({ length: weeks }, (_, week) => (
              <div key={week} className="flex flex-col gap-1.5">
                <div className="h-[14px] text-center text-[9px] text-[#898781]">
                  {week === weeks - 1 ? "이번주" : `${weeks - 1 - week}주전`}
                </div>
                {WEEKDAY_LABELS.map((_, weekday) => {
                  const cell = byKey.get(`${week}-${weekday}`);
                  return (
                    <div
                      key={weekday}
                      onMouseEnter={() => cell && setHover(cell)}
                      onMouseLeave={() => setHover(null)}
                      className="h-5 w-6 rounded-[4px] transition-transform hover:scale-110"
                      style={{
                        background: cell ? colorFor(cell.value) : "transparent",
                        border: cell ? "none" : "1px dashed #F3F4F6",
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-[#898781]">
        <span>적음</span>
        {[VIZ.rampLight, ...VIZ.ramp].reverse().map((c) => (
          <span key={c} className="h-3 w-3 rounded-[3px]" style={{ background: c }} />
        ))}
        <span>많음</span>
      </div>

      {hover && (
        <div className="pointer-events-none absolute right-0 top-0 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[11px] shadow-lg">
          <div className="font-semibold text-[#0b0b0b]">{hover.date}</div>
          <div className="mt-0.5 text-[#52514e]">매출 {formatValue(hover.value)}</div>
        </div>
      )}
    </div>
  );
}
