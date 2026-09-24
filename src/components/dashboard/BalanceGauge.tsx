import React, { useId } from "react";
import { formatCurrency } from "@/lib/currency";
import { useProfile } from "@/hooks/useProfile";

type Tone = "safe" | "warn" | "danger";

/** Neon colours per state: `arc` is the ring + glow, `text` is the % label. */
const TONES: Record<Tone, { arc: string; text: string }> = {
  safe: { arc: "#88BB22", text: "#22C06B" }, // green
  warn: { arc: "#F5B800", text: "#E0A100" }, // yellow
  danger: { arc: "#F0453A", text: "#E5342A" }, // red
};

/** green -> yellow -> red based on pct. Adjust thresholds here. */
function getTone(pct: number): Tone {
  if (pct >= 90) return "danger";
  if (pct >= 70) return "warn";
  return "safe";
}

// Geometry (viewBox units)
const VB_TOP = 80;
const VB_W = 1300;
const VB_H = 1000;
const CX = 650;
const CY = 685;
const R = 563; // main ring radius
const R_INNER = 503; // thin decorative ring
const START = 150; // degrees, clockwise from 3 o'clock
const SWEEP = 240;

function polar(r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

function arcPath(r: number): string {
  const [sx, sy] = polar(r, START);
  const [ex, ey] = polar(r, START + SWEEP);
  return `M ${sx} ${sy} A ${r} ${r} 0 1 1 ${ex} ${ey}`;
}

interface BalanceGaugeProps {
  /** Balance to show in the centre */
  balance: number | string;
  /** Percentage 0-100: drives the arc, the label and the colour */
  pct: number;
  className?: string;
}

export default function BalanceGauge({
  balance,
  pct,
  className,
}: BalanceGaugeProps) {
  const glowId = useId().replace(/:/g, "");
  const safePct = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  const tone = TONES[getTone(safePct)];
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "NGN";

  const balanceText =
    typeof balance === "number"
      ? balance.toLocaleString("en-US", { maximumFractionDigits: 0 })
      : balance;

  // Shrink long numbers so they stay inside the ring
  const balanceSize = Math.min(180, 1600 / Math.max(balanceText.length, 1));

  const path = arcPath(R);
  const dash = `${safePct} 100`;
  const arcStyle: React.CSSProperties = {
    transition: "stroke-dasharray 0.6s ease, stroke 0.3s ease",
  };

  return (
   <svg
  viewBox={`0 ${VB_TOP} ${VB_W} ${VB_H - VB_TOP}`}
  className={className}
  style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
  role="img"
  aria-label={`Balance ${balanceText}, ${safePct.toFixed(1)}%`}
>
      <defs>
        <filter
          id={glowId}
          filterUnits="userSpaceOnUse"
          x={0}
          y={0}
          width={VB_W}
          height={VB_H}
        >
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>

      {/* Thin grey rings */}
      <path
        d={arcPath(R_INNER)}
        fill="none"
        stroke="#E4E4E4"
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d={path}
        fill="none"
        stroke="#E4E4E4"
        strokeWidth={5}
        strokeLinecap="round"
      />

      {safePct > 0 && (
        <>
          {/* Neon glow */}
          <path
            d={path}
            pathLength={100}
            fill="none"
            stroke={tone.arc}
            strokeWidth={38}
            strokeLinecap="round"
            strokeDasharray={dash}
            opacity={0.55}
            filter={`url(#${glowId})`}
            style={arcStyle}
          />
          {/* Crisp arc */}
          <path
            d={path}
            pathLength={100}
            fill="none"
            stroke={tone.arc}
            strokeWidth={38}
            strokeLinecap="round"
            strokeDasharray={dash}
            style={arcStyle}
          />
        </>
      )}

      {/* Percentage */}
  <text
  x={CX}
  y={443}
  textAnchor="middle"
  fontSize={66}
  fill={tone.text}
  className="font-sans font-bold"
  style={{ transition: "fill 0.3s ease" }}
>
  {safePct.toFixed(1)}%
</text>

      
   {/* Label */}
<text
  x={CX}
  y={625}
  textAnchor="middle"
  fontSize={56}
  className="font-sans font-semibold uppercase tracking-wide fill-muted"
>
  Balance
</text>

      {/* Balance */}
<text
  x={CX}
  y={860}
  textAnchor="middle"
  fontSize={balanceSize}
  fill="#B4A6F5"
  className="font-sans font-bold"
>
  {formatCurrency(Number(balance), currency)}
</text>
    </svg>
  );
}
