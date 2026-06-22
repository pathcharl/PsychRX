import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "light" | "dark";
  href?: string;
}

export function Logo({
  className,
  variant = "dark",
  href = "/",
}: LogoProps) {
  return (
    <Link
      href={href}
      className={cn(
        "font-heading text-xl font-bold tracking-tight sm:text-2xl",
        variant === "light" ? "text-white" : "text-navy",
        className
      )}
    >
      Psych<span className="text-teal">Rx</span>
    </Link>
  );
}
