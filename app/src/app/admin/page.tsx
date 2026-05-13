import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type EventWithCounts = EventRow & {
  slot_count: number;
  signup_count: number;
};

async function loadEvents(): Promise<EventWithCounts[]> {
  const supabase = await getSupabaseServerClient();
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("archived_at", { ascending: true, nullsFirst: true })
    .order("starts_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (!events) return [];

  // Cheap counts in two batches — fine at troop scale.
  const ids = events.map((e) => e.id);
  if (ids.length === 0) return [];

  const { data: slots } = await supabase
    .from("slots")
    .select("id, event_id")
    .in("event_id", ids);
  const slotsByEvent = new Map<string, string[]>();
  (slots ?? []).forEach((s) => {
    const list = slotsByEvent.get(s.event_id as string) ?? [];
    list.push(s.id as string);
    slotsByEvent.set(s.event_id as string, list);
  });

  const allSlotIds = (slots ?? []).map((s) => s.id as string);
  const signupsBySlot = new Map<string, number>();
  if (allSlotIds.length > 0) {
    const { data: signups } = await supabase
      .from("signups")
      .select("slot_id")
      .in("slot_id", allSlotIds);
    (signups ?? []).forEach((su) => {
      const key = su.slot_id as string;
      signupsBySlot.set(key, (signupsBySlot.get(key) ?? 0) + 1);
    });
  }

  return events.map((event) => {
    const eventSlots = slotsByEvent.get(event.id) ?? [];
    const signupCount = eventSlots.reduce(
      (sum, sid) => sum + (signupsBySlot.get(sid) ?? 0),
      0,
    );
    return {
      ...(event as EventRow),
      slot_count: eventSlots.length,
      signup_count: signupCount,
    };
  });
}

export default async function AdminHome() {
  const events = await loadEvents();
  const active = events.filter((e) => !e.archived_at);
  const archived = events.filter((e) => e.archived_at);

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-sm text-stone-600">
            Manage signup events for Troop MN-9871.
          </p>
        </div>
        <Link
          href="/admin/events/new"
          className="bg-[var(--color-tl-green-mid)] text-white font-semibold px-4 py-2 rounded-lg text-sm"
        >
          + New event
        </Link>
      </header>

      <EventList title="Active" events={active} />
      {archived.length > 0 ? (
        <EventList title="Archived" events={archived} muted />
      ) : null}
    </main>
  );
}

function EventList({
  title,
  events,
  muted = false,
}: {
  title: string;
  events: EventWithCounts[];
  muted?: boolean;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
        {title}
      </h2>
      {events.length === 0 ? (
        <div className="border-2 border-dashed border-stone-200 rounded-xl p-6 text-sm text-stone-500 text-center">
          No {title.toLowerCase()} events.
        </div>
      ) : (
        <ul className="grid gap-2">
          {events.map((e) => (
            <li
              key={e.id}
              className={`border border-stone-200 rounded-xl p-4 bg-white ${
                muted ? "opacity-70" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-xs text-stone-500 uppercase tracking-wider">
                    {e.season ?? "—"} ·{" "}
                    {e.is_published ? "Published" : "Draft"}
                    {e.archived_at ? " · Archived" : ""}
                  </div>
                  <div className="font-bold text-lg">{e.title}</div>
                  <div className="text-xs text-stone-600 mt-1">
                    {e.slot_count} slots · {e.signup_count} signups · slug{" "}
                    <code className="text-stone-700">{e.slug}</code>
                  </div>
                </div>
                <div className="flex gap-2 text-sm">
                  <Link
                    href={`/admin/events/${e.slug}/edit`}
                    className="font-semibold text-[var(--color-tl-green-mid)] hover:underline"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/admin/events/${e.slug}/signups`}
                    className="font-semibold text-[var(--color-tl-green-mid)] hover:underline"
                  >
                    Signups
                  </Link>
                  <Link
                    href={`/events/${e.slug}`}
                    target="_blank"
                    className="font-semibold text-stone-600 hover:underline"
                  >
                    Public ↗
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
