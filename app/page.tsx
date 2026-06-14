import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <Badge variant="secondary">Setup complete</Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">PsychRx</h1>
        <p className="max-w-md text-muted-foreground">
          Your Next.js 14 app is wired up with Tailwind, shadcn/ui, Supabase,
          Stripe, Twilio, and more.
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Get started</CardTitle>
          <CardDescription>
            Edit <code className="rounded bg-muted px-1 py-0.5">app/page.tsx</code>{" "}
            to build your first screen.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button>Primary action</Button>
          <Button variant="outline">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
        </CardContent>
      </Card>
    </main>
  );
}
