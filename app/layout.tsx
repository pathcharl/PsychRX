import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { dmSans, playfairDisplay } from "@/lib/fonts";
import { AuthHashHandler } from "@/components/auth/auth-hash-handler";

export const metadata: Metadata = {
  title: "PsychRx — Mental Health Care Matched to You",
  description:
    "Board-certified therapists and psychiatric providers. Major insurance accepted. Sessions available this week.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(dmSans.variable, playfairDisplay.variable, "font-sans")}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-psych-bg text-psych-text antialiased"
      >
        <AuthHashHandler />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
