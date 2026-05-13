import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { EventRow, SlotRow } from "@/lib/supabase/types";
import { EditEventClient } from "./edit-client";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
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

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <Link
            href="/admin"
            className="text-sm text-[var(--color-tl-green-mid)] hover:underline"
          >
            ← back to events
          </Link>
          <h1 className="text-2xl font-bold mt-1">{event.title}</h1>
          <p className="text-xs text-stone-500">
            slug <code className="text-stone-700">{event.slug}</code> ·{" "}
            {event.is_published ? "Published" : "Draft"}
            {event.archived_at ? " · Archived" : ""}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href={`/events/${event.slug}`}
            target="_blank"
            className="font-semibold text-stone-600 hover:underline"
          >
            View public ↗
          </Link>
          <Link
            href={`/admin/events/${event.slug}/signups`}
            className="font-semibold text-[var(--color-tl-green-mid)] hover:underline"
          >
            View signups
          </Link>
        </div>
      </div>

      <EditEventClient
        initialEvent={event}
        initialSlots={(slots ?? []) as SlotRow[]}
      />
    </main>
  );
}
