import React, { CSSProperties } from "react";

export type Tone = "safe" | "warn" | "danger" | "empty";

export const TONE_BG: Record<Tone, string> = {
  safe: "bg-progress-safe",
  warn: "bg-progress-warn",
  danger: "bg-progress-danger",
  empty: "bg-progress-empty",
};

/** green -> yellow -> red based on percentage used. Adjust thresholds here. */
export function getTone(pct: number): Tone {
  if (pct <= 0) return "empty";
  if (pct >= 90) return "danger";
  if (pct >= 70) return "warn";
  return "safe";
}

export function getPct(value: number, max: number): number {
  return max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
}

interface HatchedProgressBarProps {
  /** Current value (default 0) */
  value?: number;
  /** Maximum value (default 100) */
  max?: number;
  /** Bar height in px */
  height?: number;
  /** Gap between segments in px */
  gap?: number;
  /** Corner radius in px */
  radius?: number;
  /** Override the automatic fill colour, e.g. "bg-primary" */
  fillcolor?: string;
}

export default function HatchedProgressBar({
  value = 0,
  max = 100,
  height = 24,
  gap = 6,
  radius = 8,
  fillcolor,
}: HatchedProgressBarProps) {
  const pct = getPct(value, max);
  const fillClass = fillcolor ?? TONE_BG[getTone(pct)];

  const base: CSSProperties = {
    height,
    borderRadius: radius,
    border: "2px solid #00000094",
    boxSizing: "border-box",
  };

  // Hatch lines only; background colour comes from Tailwind classes
  const hatch = (lineColor: string): CSSProperties => ({
    backgroundImage: `repeating-linear-gradient(
      -60deg,
      transparent 0,
      transparent 9px,
      ${lineColor} 9px,
      ${lineColor} 10px
    )`,
  });

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ display: "flex", width: "100%", gap }}
    >
      {/* Filled part: always on the left, coloured by tone */}
      {pct > 0 && (
        <div
          className={fillClass}
          style={{
            ...base,
            ...hatch("rgba(0,0,0,0.25)"),
            flex: `0 0 calc(${pct}% - ${pct < 100 ? gap / 2 : 0}px)`,
            transition: "flex-basis 0.4s ease",
          }}
        />
      )}

      {/* Remaining part: always the empty colour, hidden at 100% */}
      {pct < 100 && (
        <div
          className={TONE_BG.empty}
          style={{
            ...base,
            ...hatch("rgba(0,0,0,0.12)"),
            flex: 1,
          }}
        />
      )}
    </div>
  );
}