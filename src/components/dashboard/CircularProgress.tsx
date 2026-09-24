import { cn } from "@/lib/utils";

interface CircularProgressProps {
  percentage: number; // 0-100+
  size?: number;
  strokeWidth?: number;
  className?: string;
  trackColor?: string;
  progressColor?: string;
}

/**
 * Renders the ring as SVG (geometry only) and the "72%" label as normal
 * HTML text absolutely positioned on top. A previous implementation used
 * rotated <text> inside the SVG for this label, which rendered fine on
 * desktop but silently failed to paint on iOS Safari. Never reintroduce
 * SVG text here for a value the user needs to read.
 */
export function CircularProgress({
  percentage,
  size = 56,
  strokeWidth = 5,
  className,
  trackColor = "#EDEAF5",
  progressColor = "#3F9142",
}: CircularProgressProps) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-foreground">
        {Math.round(percentage)}%
      </span>
    </div>
  );
}
