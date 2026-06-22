import { PublicFooter } from "@/components/public/public-footer";
import { PublicNav } from "@/components/public/public-nav";
import { cn } from "@/lib/utils";

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  hideNav?: boolean;
  footerNote?: string;
}

export function PageShell({ children, className, hideNav, footerNote }: PageShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      {!hideNav && <PublicNav />}
      <main className={cn("flex-1", className)}>{children}</main>
      <PublicFooter footerNote={footerNote} />
    </div>
  );
}
