import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  EventRow,
  SlotRow,
  SignupRow,
  SlotWithSignups,
  EventWithSlots,
} from "@/lib/supabase/types";
import { EventClient } from "./event-client";

export const dynamic = "force-dynamic";

async function loadEvent(slug: string): Promise<EventWithSlots | null> {
  const supabase = await getSupabaseServerClient();
  const { data: event, error } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<EventRow>();

  if (error || !event) return null;

  const { data: slots } = await supabase
    .from("slots")
    .select("*")
    .eq("event_id", event.id)
    .order("sort_order", { ascending: true });

  const { data: signups } = await supabase
    .from("signups")
    .select("*")
    .in("slot_id", (slots ?? []).map((s) => s.id) as string[]);

  const slotsWithSignups: SlotWithSignups[] = (slots ?? []).map((slot) => ({
    ...(slot as SlotRow),
    signups: (signups ?? []).filter(
      (su) => su.slot_id === slot.id,
    ) as SignupRow[],
  }));

  return { ...event, slots: slotsWithSignups };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) notFound();
  if (!event.is_published) {
    return <UnpublishedNotice slug={slug} />;
  }

  return <EventClient event={event} />;
}

function UnpublishedNotice({ slug }: { slug: string }) {
  return (
    <main className="flex-1 grid place-items-center px-6 py-20 text-center">
      <div>
        <p className="text-stone-700 font-semibold mb-2">
          This event isn&apos;t published yet.
        </p>
        <p className="text-sm text-stone-500 mb-6">
          Leaders can publish it from the admin dashboard. Slug:{" "}
          <code className="text-stone-700">{slug}</code>.
        </p>
        <Link href="/" className="underline text-[var(--color-tl-green-mid)]">
          ← back to all events
        </Link>
      </div>
    </main>
  );
}
