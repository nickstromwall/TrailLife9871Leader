import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { EventRow, SignupRow, SlotRow } from "@/lib/supabase/types";
import { SignupsClient } from "./signups-client";

export const dynamic = "force-dynamic";

export default async function SignupsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<EventRow>();
  if (!event) notFound();

  const { data: slots } = await supabase
    .from("slots")
    .select("*")
    .eq("event_id", event.id)
    .order("sort_order", { ascending: true });

  const slotIds = (slots ?? []).map((s) => s.id);
  const { data: signups } =
    slotIds.length > 0
      ? await supabase
          .from("signups")
          .select("*")
          .in("slot_id", slotIds)
          .order("created_at", { ascending: false })
      : { data: [] as SignupRow[] };

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <Link
        href="/admin"
        className="text-sm text-[var(--color-tl-green-mid)] hover:underline"
      >
        ← back to events
      </Link>
      <h1 className="text-2xl font-bold mt-1">{event.title} · Signups</h1>
      <p className="text-xs text-stone-500 mb-6">
        slug <code className="text-stone-700">{event.slug}</code>
      </p>

      <SignupsClient
        event={event}
        slots={(slots ?? []) as SlotRow[]}
        signups={(signups ?? []) as SignupRow[]}
      />
    </main>
  );
}
