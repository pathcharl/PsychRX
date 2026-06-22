import { cn } from "@/lib/utils";
import { fillRateStroke } from "@/lib/admin/utils";

interface FillRateGaugeProps {
  rate: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  labelClassName?: string;
  light?: boolean;
}

export function FillRateGauge({
  rate,
  size = 96,
  strokeWidth = 8,
  className,
  labelClassName,
  light = false,
}: FillRateGaugeProps) {
  const clamped = Math.max(0, Math.min(100, rate));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          stroke={light ? "rgba(255,255,255,0.15)" : "rgba(27,43,75,0.1)"}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          stroke={fillRateStroke(clamped)}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <span
        className={cn(
          "absolute font-heading font-bold",
          light ? "text-white" : "text-navy",
          labelClassName
        )}
        style={{ fontSize: size * 0.22 }}
      >
        {Math.round(clamped)}%
      </span>
    </div>
  );
}
