import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function createEvent(formData: FormData) {
  "use server";
  const supabase = await getSupabaseServerClient();

  const slug = String(formData.get("slug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const subtitle = String(formData.get("subtitle") ?? "").trim() || null;
  const season = String(formData.get("season") ?? "").trim() || null;
  const theme = String(formData.get("theme") ?? "trail-life-green");
  const cloneSourceSlug = String(formData.get("clone_from") ?? "").trim();

  if (!slug || !title) {
    throw new Error("slug and title are required");
  }

  if (cloneSourceSlug) {
    // Use the RPC so all slots get copied atomically.
    const { data: source } = await supabase
      .from("events")
      .select("id")
      .eq("slug", cloneSourceSlug)
      .maybeSingle();
    if (!source) {
      throw new Error(`No event with slug ${cloneSourceSlug} to clone from`);
    }
    const { error } = await supabase.rpc("clone_event", {
      source_event_id: source.id,
      new_slug: slug,
      new_season: season,
      new_title: title,
      new_subtitle: subtitle,
    });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("events").insert({
      slug,
      title,
      subtitle,
      season,
      theme,
      is_published: false,
    });
    if (error) throw error;
  }

  redirect(`/admin/events/${slug}/edit`);
}

async function loadCloneSources() {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("events")
    .select("slug, title, season")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export default async function NewEventPage() {
  const cloneSources = await loadCloneSources();

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      <Link
        href="/admin"
        className="text-sm text-[var(--color-tl-green-mid)] hover:underline"
      >
        ← back to events
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">New event</h1>
      <p className="text-sm text-stone-600 mb-6">
        Start from scratch or clone an existing event&apos;s slots (great for
        rolling over to next season).
      </p>

      <form action={createEvent} className="space-y-4 bg-white border border-stone-200 rounded-2xl p-6">
        <Field
          name="slug"
          label="Slug"
          required
          placeholder="leadership-adults-2027-28"
          help="URL-safe identifier. Lowercase, dashes, no spaces."
        />
        <Field
          name="title"
          label="Title"
          required
          placeholder="Adult Volunteer Roles · 2027–2028"
        />
        <Field
          name="subtitle"
          label="Subtitle"
          placeholder="Step up and serve. Trail Life MN-9871 leadership signup."
        />
        <Field
          name="season"
          label="Season"
          placeholder="2027-2028"
          help="Human-readable season label. Shown on cards."
        />
        <div>
          <label className="text-sm font-semibold block mb-1">Theme</label>
          <select
            name="theme"
            defaultValue="trail-life-green"
            className="w-full border-2 border-stone-200 rounded-lg px-3 py-2"
          >
            <option value="trail-life-green">Trail Life green</option>
            <option value="trail-life-gold">Trail Life gold</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>

        {cloneSources.length > 0 ? (
          <div>
            <label className="text-sm font-semibold block mb-1">
              Clone slots from (optional)
            </label>
            <select
              name="clone_from"
              defaultValue=""
              className="w-full border-2 border-stone-200 rounded-lg px-3 py-2"
            >
              <option value="">— start with no slots —</option>
              {cloneSources.map((src) => (
                <option key={src.slug} value={src.slug}>
                  {src.title}
                  {src.season ? ` (${src.season})` : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-stone-500 mt-1">
              All slots will be duplicated; signups will not. Prefilled names
              are copied — edit them after creation if a prefill changed.
            </p>
          </div>
        ) : null}

        <button
          type="submit"
          className="w-full bg-[var(--color-tl-green-mid)] text-white font-semibold py-2.5 rounded-lg"
        >
          Create event
        </button>
      </form>
    </main>
  );
}

function Field({
  name,
  label,
  placeholder,
  required = false,
  help,
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  help?: string;
}) {
  return (
    <div>
      <label className="text-sm font-semibold block mb-1">
        {label}
        {required ? " *" : ""}
      </label>
      <input
        type="text"
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full border-2 border-stone-200 rounded-lg px-3 py-2"
      />
      {help ? (
        <p className="text-xs text-stone-500 mt-1">{help}</p>
      ) : null}
    </div>
  );
}
