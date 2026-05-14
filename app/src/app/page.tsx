import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

async function getPublishedEvents(): Promise<EventRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("is_published", true)
    .is("archived_at", null)
    .order("starts_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load events", error);
    return [];
  }
  return (data ?? []) as EventRow[];
}

export default async function HomePage() {
  const events = await getPublishedEvents();

  return (
    <main className="flex-1">
      <header className="bg-[var(--color-tl-green-dark)] text-white px-6 py-12 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.14em] opacity-70 mb-2">
          Trail Life USA · Troop MN-9871
        </div>
        <h1 className="text-3xl font-extrabold">Troop Signups</h1>
        <p className="opacity-80 mt-2 text-sm max-w-md mx-auto">
          Active signup events for the troop. Tap one to view details and commit.
        </p>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-10">
        {events.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid gap-3">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.slug}`}
                  className="block border-2 border-stone-200 hover:border-[var(--color-tl-green-mid)] rounded-xl p-5 bg-white transition-colors"
                >
                  <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-tl-green-mid)] mb-1">
                    {event.season ?? "Event"}
                  </div>
                  <div className="text-lg font-bold">{event.title}</div>
                  {event.subtitle ? (
                    <p className="text-sm text-stone-600 mt-1">{event.subtitle}</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="border-2 border-dashed border-stone-300 rounded-xl px-6 py-12 text-center text-stone-600">
      <p className="font-semibold mb-2">No published events yet.</p>
      <p className="text-sm">
        Leaders can create events from the{" "}
        <Link href="/admin" className="text-[var(--color-tl-green-mid)] underline">
          admin dashboard
        </Link>
        .
      </p>
    </div>
  );
}
