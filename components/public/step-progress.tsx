"use client";

import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface StepProgressProps {
  currentStep: number;
  totalSteps: number;
  label?: string;
  className?: string;
}

export function StepProgress({
  currentStep,
  totalSteps,
  label,
  className,
}: StepProgressProps) {
  const value = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        {label ? (
          <span className="font-medium text-psych-text">{label}</span>
        ) : (
          <span className="font-medium text-psych-text">
            Step {currentStep} of {totalSteps}
          </span>
        )}
        <span className="text-muted-foreground">{value}%</span>
      </div>
      <Progress value={value}>
        <ProgressTrack className="h-2 bg-navy/10">
          <ProgressIndicator className="bg-teal" />
        </ProgressTrack>
      </Progress>
    </div>
  );
}
