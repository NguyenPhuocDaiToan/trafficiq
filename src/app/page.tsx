import Link from "next/link";

export const metadata = {
  title: "TrafficIQ",
  description: "Campaign landing + tracking platform.",
  robots: { index: false, follow: false },
};

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
      <h1 className="font-mono text-3xl font-bold">TrafficIQ</h1>
      <p className="text-muted-foreground">
        Landing SSR + redirect tracking + postback conversion. Traffic thật đi vào
        qua <code>/go/[token]</code> và <code>/c/[slug]</code>, không qua trang này.
      </p>
      <div className="flex gap-4 text-sm">
        <Link href="/admin" className="cursor-pointer text-primary underline">
          Control plane
        </Link>
        <Link href="/privacy" className="cursor-pointer text-primary underline">
          Privacy
        </Link>
        <Link href="/api/health" className="cursor-pointer text-primary underline">
          Health
        </Link>
      </div>
    </main>
  );
}
