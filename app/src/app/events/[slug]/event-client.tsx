"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  EventWithSlots,
  SignupRow,
  SlotWithSignups,
} from "@/lib/supabase/types";
import {
  slotDisplayNames,
  slotFilledCount,
  slotStatus,
} from "@/lib/supabase/types";

type SyncState = "live" | "offline";

export function EventClient({ event }: { event: EventWithSlots }) {
  const [slots, setSlots] = useState<SlotWithSignups[]>(event.slots);
  const [openSlotId, setOpenSlotId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("live");

  // Group slots by group_label preserving sort_order.
  const grouped = useMemo(() => groupSlots(slots), [slots]);

  // Realtime: subscribe to signups for this event's slot ids.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const slotIds = new Set(slots.map((s) => s.id));

    const channel = supabase
      .channel(`event:${event.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "signups" },
        (payload: { new: SignupRow }) => {
          const row = payload.new;
          if (!slotIds.has(row.slot_id)) return;
          setSlots((prev) =>
            prev.map((slot) =>
              slot.id === row.slot_id
                ? {
                    ...slot,
                    signups: dedupeAppend(slot.signups, row),
                  }
                : slot,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "signups" },
        (payload: { old: SignupRow }) => {
          const row = payload.old;
          if (!slotIds.has(row.slot_id)) return;
          setSlots((prev) =>
            prev.map((slot) =>
              slot.id === row.slot_id
                ? {
                    ...slot,
                    signups: slot.signups.filter((s) => s.id !== row.id),
                  }
                : slot,
            ),
          );
        },
      )
      .subscribe((status: string) => {
        setSyncState(status === "SUBSCRIBED" ? "live" : "offline");
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // We don't want to resubscribe on every slot mutation; the slot id set
    // is stable once the event has loaded, so we key off event.id only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  const total = slots.reduce((sum, s) => sum + s.spots, 0);
  const filled = slots.reduce((sum, s) => sum + slotFilledCount(s), 0);
  const pct = total > 0 ? Math.min(100, (filled / total) * 100) : 0;
  const openSlot = openSlotId ? slots.find((s) => s.id === openSlotId) ?? null : null;

  return (
    <main className="flex-1">
      <header className="bg-[var(--color-tl-green-dark)] text-white px-6 pt-9 pb-5 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.14em] opacity-70 mb-1.5">
          Trail Life USA · Troop MN-9871
        </div>
        <h1 className="text-2xl font-extrabold leading-tight">{event.title}</h1>
        {event.subtitle ? (
          <p className="opacity-80 mt-1.5 text-sm">{event.subtitle}</p>
        ) : null}
      </header>

      <div className="bg-[var(--color-tl-green-mid)] px-5 py-4 text-center">
        <div className="text-white font-bold text-base mb-2.5">
          <span>{filled}</span> of <span>{total}</span> spots filled
        </div>
        <div className="max-w-[480px] mx-auto h-2.5 rounded-full bg-white/25 overflow-hidden">
          <div
            className="h-full bg-[var(--color-tl-gold)] rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <SyncPill state={syncState} />
      </div>

      <section className="max-w-[1100px] mx-auto px-5 pb-8">
        {grouped.map((group) => (
          <div key={group.label ?? "_"}>
            {group.label ? (
              <h2 className="text-center text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-stone-500 pt-5 pb-1">
                {group.label}
              </h2>
            ) : null}
            <div className="grid gap-3.5 grid-cols-[repeat(auto-fill,minmax(270px,1fr))] py-3">
              {group.slots.map((slot) => (
                <SlotCard
                  key={slot.id}
                  slot={slot}
                  onOpen={() => setOpenSlotId(slot.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      {openSlot ? (
        <SignupModal
          slot={openSlot}
          eventTheme={event.theme}
          onClose={() => setOpenSlotId(null)}
          onOptimisticSignup={(signup) => {
            setSlots((prev) =>
              prev.map((s) =>
                s.id === signup.slot_id
                  ? { ...s, signups: dedupeAppend(s.signups, signup) }
                  : s,
              ),
            );
          }}
        />
      ) : null}
    </main>
  );
}

// ============================================================
// SUBCOMPONENTS
// ============================================================

function SyncPill({ state }: { state: SyncState }) {
  const isLive = state === "live";
  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-white/80 mt-1.5">
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          isLive
            ? "bg-emerald-300 animate-pulse"
            : "bg-red-300"
        }`}
      />
      {isLive ? "Live — updates instantly" : "Offline — showing last known state"}
    </div>
  );
}

function SlotCard({
  slot,
  onOpen,
}: {
  slot: SlotWithSignups;
  onOpen: () => void;
}) {
  const status = slotStatus(slot);
  const filled = slotFilledCount(slot);
  const isFilled = status === "filled";
  const isLeadership = slot.leadership;
  const names = slotDisplayNames(slot);
  const left = slot.spots - filled;

  const borderClass = isLeadership
    ? isFilled
      ? "border-[var(--color-tl-gold-border)] bg-amber-50"
      : "border-[var(--color-tl-gold)]"
    : isFilled
      ? "border-emerald-500 bg-emerald-50"
      : "border-stone-200 hover:border-[var(--color-tl-green-mid)]";

  return (
    <button
      type="button"
      disabled={isFilled || slot.is_locked}
      onClick={onOpen}
      className={`relative text-left bg-white border-2 rounded-xl p-4 transition-all ${borderClass} ${
        isFilled || slot.is_locked
          ? "cursor-default"
          : "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
      }`}
    >
      {isFilled ? (
        <div
          className={`absolute top-3.5 right-3.5 w-6 h-6 rounded-full grid place-items-center text-xs font-bold ${
            isLeadership
              ? "bg-[var(--color-tl-gold)] text-stone-900"
              : "bg-emerald-500 text-white"
          }`}
        >
          ✓
        </div>
      ) : null}
      <span
        className={`inline-block text-[0.68rem] font-bold uppercase tracking-[0.09em] px-2 py-0.5 rounded-full mb-2 ${
          isFilled
            ? isLeadership
              ? "bg-amber-100 text-amber-900"
              : "bg-emerald-100 text-emerald-900"
            : isLeadership
              ? "bg-amber-100 text-amber-900"
              : "bg-stone-100 text-stone-600"
        }`}
      >
        {isLeadership
          ? isFilled
            ? "★ Leadership · Filled"
            : "★ Leadership Role"
          : isFilled
            ? "Filled"
            : "Open"}
      </span>
      <h3 className="text-base font-bold leading-tight">{slot.title}</h3>
      {slot.subtitle ? (
        <p className="text-sm text-stone-600 leading-snug mt-1">
          {slot.subtitle}
        </p>
      ) : null}
      {slot.time_commitment ? (
        <p className="text-xs text-stone-500 mt-2.5">
          <strong className="text-[var(--color-tl-green-mid)]">Time:</strong>{" "}
          {slot.time_commitment}
        </p>
      ) : null}
      {slot.spots > 1 ? (
        <p className="text-xs text-violet-700 font-bold mt-1.5">
          {isFilled ? `${slot.spots}/${slot.spots}` : `${left} of ${slot.spots}`} spots{" "}
          {isFilled ? "filled" : "open"}
        </p>
      ) : null}
      {names.length > 0 ? (
        <p className="text-sm text-emerald-900 font-semibold mt-2.5">
          ✓ {names.slice(0, 3).join(", ")}
          {names.length > 3 ? ` +${names.length - 3}` : ""}
        </p>
      ) : null}
    </button>
  );
}

function SignupModal({
  slot,
  eventTheme,
  onClose,
  onOptimisticSignup,
}: {
  slot: SlotWithSignups;
  eventTheme: string;
  onClose: () => void;
  onOptimisticSignup: (s: SignupRow) => void;
}) {
  const [step, setStep] = useState<"cta" | "form" | "success">("cta");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGold = eventTheme === "trail-life-gold" || slot.leadership;
  const filled = slotFilledCount(slot);
  const left = slot.spots - filled;

  async function submit() {
    if (!name.trim() || !email.trim() || !agreed) return;
    setSubmitting(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("signups")
      .insert({
        slot_id: slot.id,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
      })
      .select()
      .single();

    if (error || !data) {
      setSubmitting(false);
      setError(error?.message ?? "Signup failed. Please try again.");
      return;
    }
    onOptimisticSignup(data as SignupRow);
    setStep("success");
    setTimeout(() => onClose(), 2800);
  }

  return (
    <div
      className="fixed inset-0 bg-black/55 z-50 overflow-y-auto p-4 grid place-items-start"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden my-auto">
        <header
          className={`text-white px-6 py-5 relative ${
            isGold
              ? "bg-gradient-to-br from-[var(--color-tl-green-dark)] via-[#4A7C59] to-[var(--color-tl-gold)]"
              : "bg-[var(--color-tl-green-dark)]"
          }`}
        >
          <button
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/15 grid place-items-center text-base"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
          <div className="text-[0.68rem] font-bold uppercase tracking-[0.1em] opacity-75 mb-1.5">
            {slot.leadership ? "★ Leadership Role" : "Volunteer Role"}
          </div>
          <h2 className="text-2xl font-extrabold leading-tight">{slot.title}</h2>
          {slot.scripture ? (
            <p className="italic text-sm opacity-85 mt-2 leading-snug">
              {slot.scripture}
            </p>
          ) : null}
        </header>

        <div className="px-6 pt-5 pb-2">
          {(slot.time_commitment || slot.reports_to || slot.spots > 1) && (
            <div className="flex gap-4 flex-wrap p-3 bg-stone-50 rounded-lg mb-4">
              {slot.time_commitment ? (
                <Meta label="Time" value={slot.time_commitment} />
              ) : null}
              {slot.reports_to ? (
                <Meta label="Reports to" value={slot.reports_to} />
              ) : null}
              {slot.spots > 1 ? (
                <Meta label="Spots" value={`${left} of ${slot.spots}`} />
              ) : null}
            </div>
          )}

          {slot.description ? (
            <p className="text-stone-900 leading-relaxed mb-4">
              {slot.description}
            </p>
          ) : null}

          {slot.success_bullets.length > 0 ? (
            <Bullets label="What success looks like" items={slot.success_bullets} />
          ) : null}
          {slot.not_this_bullets.length > 0 ? (
            <Bullets
              label="This role is NOT"
              items={slot.not_this_bullets}
              isNotList
            />
          ) : null}
        </div>

        <div className="px-6 pt-2 pb-6">
          {step === "cta" ? (
            <button
              className={`w-full font-bold py-3.5 rounded-full text-white ${
                isGold
                  ? "bg-gradient-to-r from-[var(--color-tl-green-mid)] to-[var(--color-tl-gold)]"
                  : "bg-[var(--color-tl-green-mid)] hover:bg-[var(--color-tl-green-dark)]"
              }`}
              onClick={() => setStep("form")}
            >
              {slot.leadership ? "I Want This Leadership Role" : "I Want This Role"}
            </button>
          ) : step === "form" ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <input
                type="text"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border-2 border-stone-200 rounded-lg px-3 py-2.5 text-base"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border-2 border-stone-200 rounded-lg px-3 py-2.5 text-base"
                required
              />
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border-2 border-stone-200 rounded-lg px-3 py-2.5 text-base"
              />
              <label className="flex items-start gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  I commit to serve as <strong>{slot.title}</strong> for Troop MN-9871.
                </span>
              </label>
              {error ? (
                <p className="text-red-700 text-sm">{error}</p>
              ) : null}
              <button
                type="submit"
                disabled={
                  submitting || !name.trim() || !email.trim() || !agreed
                }
                className={`w-full font-bold py-3.5 rounded-full text-white disabled:opacity-40 disabled:cursor-not-allowed ${
                  isGold
                    ? "bg-gradient-to-r from-[var(--color-tl-green-mid)] to-[var(--color-tl-gold)]"
                    : "bg-[var(--color-tl-green-mid)]"
                }`}
              >
                {submitting ? "Submitting…" : "I'm In"}
              </button>
            </form>
          ) : (
            <div className="text-center py-2">
              <p className="text-emerald-700 font-bold text-lg mb-1">
                {slot.leadership ? "You stepped up!" : "You're on the team!"}
              </p>
              <p className="text-sm text-stone-600">
                {name}, leaders will confirm <strong>{slot.title}</strong> with
                you at the next meeting.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <strong className="block text-[0.68rem] uppercase tracking-wider text-stone-500">
        {label}
      </strong>
      <span className="text-sm font-semibold text-stone-900">{value}</span>
    </div>
  );
}

function Bullets({
  label,
  items,
  isNotList = false,
}: {
  label: string;
  items: string[];
  isNotList?: boolean;
}) {
  return (
    <div className="mb-4">
      <h4 className="text-[0.7rem] font-bold uppercase tracking-wider text-stone-500 mb-2">
        {label}
      </h4>
      <ul className="space-y-1.5">
        {items.map((item, idx) => (
          <li
            key={idx}
            className={`text-sm pl-5 relative leading-snug ${
              isNotList ? "text-stone-600" : "text-stone-900"
            }`}
          >
            <span
              className={`absolute left-0 font-bold ${
                isNotList ? "text-stone-400" : "text-[var(--color-tl-green-mid)]"
              }`}
            >
              {isNotList ? "—" : "✓"}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

type Group = { label: string | null; slots: SlotWithSignups[] };

function groupSlots(slots: SlotWithSignups[]): Group[] {
  const map = new Map<string, SlotWithSignups[]>();
  const order: (string | null)[] = [];
  for (const slot of slots) {
    const key = slot.group_label ?? "_none";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(slot.group_label ?? null);
    }
    map.get(key)!.push(slot);
  }
  return order.map((label) => ({
    label,
    slots: map.get(label ?? "_none")!,
  }));
}

function dedupeAppend(list: SignupRow[], item: SignupRow): SignupRow[] {
  if (list.some((s) => s.id === item.id)) return list;
  return [...list, item];
}
