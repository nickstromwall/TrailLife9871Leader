"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { EventRow, SlotRow } from "@/lib/supabase/types";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function EditEventClient({
  initialEvent,
  initialSlots,
}: {
  initialEvent: EventRow;
  initialSlots: SlotRow[];
}) {
  const router = useRouter();
  const [event, setEvent] = useState<EventRow>(initialEvent);
  const [slots, setSlots] = useState<SlotRow[]>(initialSlots);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const supabase = getSupabaseBrowserClient();

  async function saveEvent(patch: Partial<EventRow>) {
    setStatus({ kind: "saving" });
    const next = { ...event, ...patch };
    setEvent(next);
    const { error } = await supabase
      .from("events")
      .update(patch)
      .eq("id", event.id);
    if (error) {
      setStatus({ kind: "error", message: error.message });
      return;
    }
    setStatus({ kind: "saved" });
    router.refresh();
  }

  async function saveSlot(slotId: string, patch: Partial<SlotRow>) {
    setStatus({ kind: "saving" });
    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, ...patch } : s)),
    );
    const { error } = await supabase
      .from("slots")
      .update(patch)
      .eq("id", slotId);
    if (error) {
      setStatus({ kind: "error", message: error.message });
      return;
    }
    setStatus({ kind: "saved" });
  }

  async function addSlot() {
    const sortOrder =
      slots.reduce((max, s) => Math.max(max, s.sort_order), -1) + 1;
    const { data, error } = await supabase
      .from("slots")
      .insert({
        event_id: event.id,
        sort_order: sortOrder,
        title: "New role",
        spots: 1,
      })
      .select()
      .single();
    if (error || !data) {
      setStatus({ kind: "error", message: error?.message ?? "Failed to add slot" });
      return;
    }
    setSlots((prev) => [...prev, data as SlotRow]);
  }

  async function deleteSlot(slotId: string) {
    if (
      !window.confirm(
        "Delete this slot? Any signups attached to it will be deleted too.",
      )
    ) {
      return;
    }
    const { error } = await supabase.from("slots").delete().eq("id", slotId);
    if (error) {
      setStatus({ kind: "error", message: error.message });
      return;
    }
    setSlots((prev) => prev.filter((s) => s.id !== slotId));
  }

  async function reorderSlot(slotId: string, dir: -1 | 1) {
    const idx = slots.findIndex((s) => s.id === slotId);
    if (idx === -1) return;
    const swap = idx + dir;
    if (swap < 0 || swap >= slots.length) return;
    const a = slots[idx];
    const b = slots[swap];
    const newSlots = [...slots];
    newSlots[idx] = { ...b, sort_order: a.sort_order };
    newSlots[swap] = { ...a, sort_order: b.sort_order };
    setSlots(newSlots);
    await Promise.all([
      supabase.from("slots").update({ sort_order: a.sort_order }).eq("id", b.id),
      supabase.from("slots").update({ sort_order: b.sort_order }).eq("id", a.id),
    ]);
  }

  return (
    <div className="space-y-6">
      <section className="bg-white border border-stone-200 rounded-2xl p-6">
        <h2 className="font-bold mb-3">Event details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextField
            label="Title"
            value={event.title}
            onChange={(v) => saveEvent({ title: v })}
          />
          <TextField
            label="Subtitle"
            value={event.subtitle ?? ""}
            onChange={(v) => saveEvent({ subtitle: v || null })}
          />
          <TextField
            label="Season"
            value={event.season ?? ""}
            onChange={(v) => saveEvent({ season: v || null })}
          />
          <SelectField
            label="Theme"
            value={event.theme}
            options={[
              { value: "trail-life-green", label: "Trail Life green" },
              { value: "trail-life-gold", label: "Trail Life gold" },
              { value: "neutral", label: "Neutral" },
            ]}
            onChange={(v) => saveEvent({ theme: v as EventRow["theme"] })}
          />
        </div>

        <div className="flex gap-2 mt-4 flex-wrap items-center">
          <ToggleButton
            on={event.is_published}
            label={event.is_published ? "Published" : "Draft"}
            onClick={() => saveEvent({ is_published: !event.is_published })}
          />
          <ToggleButton
            on={!!event.archived_at}
            label={event.archived_at ? "Archived" : "Active"}
            onClick={() =>
              saveEvent({
                archived_at: event.archived_at ? null : new Date().toISOString(),
              })
            }
          />
          <span className="text-xs text-stone-500 ml-auto">
            {status.kind === "saving"
              ? "Saving…"
              : status.kind === "saved"
                ? "Saved"
                : status.kind === "error"
                  ? `Error: ${status.message}`
                  : ""}
          </span>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Slots ({slots.length})</h2>
          <button
            onClick={addSlot}
            className="text-sm font-semibold bg-[var(--color-tl-green-mid)] text-white px-3 py-1.5 rounded-lg"
          >
            + Add slot
          </button>
        </div>
        <div className="space-y-3">
          {slots.map((slot, idx) => (
            <SlotEditor
              key={slot.id}
              slot={slot}
              index={idx}
              total={slots.length}
              onChange={(patch) => saveSlot(slot.id, patch)}
              onDelete={() => deleteSlot(slot.id)}
              onMoveUp={() => reorderSlot(slot.id, -1)}
              onMoveDown={() => reorderSlot(slot.id, 1)}
            />
          ))}
          {slots.length === 0 ? (
            <div className="border-2 border-dashed border-stone-200 rounded-xl p-6 text-sm text-stone-500 text-center">
              No slots yet. Click &quot;Add slot&quot; above.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function SlotEditor({
  slot,
  index,
  total,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  slot: SlotRow;
  index: number;
  total: number;
  onChange: (patch: Partial<SlotRow>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="font-semibold text-left flex-1"
        >
          {expanded ? "▼" : "▶"} {slot.title || "(untitled)"}
          {slot.spots > 1 ? (
            <span className="text-xs text-stone-500 ml-2">
              × {slot.spots} seats
            </span>
          ) : null}
          {slot.leadership ? (
            <span className="text-[0.65rem] uppercase tracking-wider text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded ml-2">
              Leadership
            </span>
          ) : null}
          {slot.prefilled_names.length > 0 ? (
            <span className="text-xs text-stone-500 ml-2">
              ✓ {slot.prefilled_names.join(", ")}
            </span>
          ) : null}
        </button>
        <div className="flex gap-1 text-xs">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="px-2 py-1 text-stone-500 disabled:opacity-30"
            title="Move up"
          >
            ↑
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="px-2 py-1 text-stone-500 disabled:opacity-30"
            title="Move down"
          >
            ↓
          </button>
          <button
            onClick={onDelete}
            className="px-2 py-1 text-red-700 hover:underline"
          >
            Delete
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextField
            label="Title"
            value={slot.title}
            onChange={(v) => onChange({ title: v })}
          />
          <TextField
            label="Group label"
            value={slot.group_label ?? ""}
            onChange={(v) => onChange({ group_label: v || null })}
          />
          <TextField
            label="Subtitle"
            value={slot.subtitle ?? ""}
            onChange={(v) => onChange({ subtitle: v || null })}
          />
          <TextField
            label="Time commitment"
            value={slot.time_commitment ?? ""}
            onChange={(v) => onChange({ time_commitment: v || null })}
          />
          <TextField
            label="Reports to"
            value={slot.reports_to ?? ""}
            onChange={(v) => onChange({ reports_to: v || null })}
          />
          <TextField
            label="Scripture"
            value={slot.scripture ?? ""}
            onChange={(v) => onChange({ scripture: v || null })}
          />
          <NumberField
            label="Spots"
            value={slot.spots}
            min={1}
            onChange={(v) => onChange({ spots: v })}
          />
          <CheckboxField
            label="Leadership role"
            value={slot.leadership}
            onChange={(v) => onChange({ leadership: v })}
          />
          <div className="md:col-span-2">
            <TextareaField
              label="Description"
              value={slot.description ?? ""}
              onChange={(v) => onChange({ description: v || null })}
            />
          </div>
          <div className="md:col-span-2">
            <JsonListField
              label="What success looks like (one per line)"
              value={slot.success_bullets}
              onChange={(v) => onChange({ success_bullets: v })}
            />
          </div>
          <div className="md:col-span-2">
            <JsonListField
              label="This role is NOT (one per line)"
              value={slot.not_this_bullets}
              onChange={(v) => onChange({ not_this_bullets: v })}
            />
          </div>
          <div className="md:col-span-2">
            <JsonListField
              label="Prefilled names (one per line)"
              value={slot.prefilled_names}
              onChange={(v) => onChange({ prefilled_names: v })}
              help="Names that are already committed to this role. Counts toward filled."
            />
          </div>
          <CheckboxField
            label="Locked (no new signups)"
            value={slot.is_locked}
            onChange={(v) => onChange({ is_locked: v })}
          />
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// FIELDS
// ============================================================

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <div className="font-semibold mb-1">{label}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onChange(e.target.value)}
        className="w-full border-2 border-stone-200 rounded-lg px-3 py-2"
      />
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <div className="font-semibold mb-1">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full border-2 border-stone-200 rounded-lg px-3 py-2"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-sm">
      <div className="font-semibold mb-1">{label}</div>
      <input
        type="number"
        value={value}
        min={min}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className="w-full border-2 border-stone-200 rounded-lg px-3 py-2"
      />
    </label>
  );
}

function CheckboxField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold pt-6">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <div className="font-semibold mb-1">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-2 border-stone-200 rounded-lg px-3 py-2"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function JsonListField({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  help?: string;
}) {
  return (
    <label className="block text-sm">
      <div className="font-semibold mb-1">{label}</div>
      <textarea
        value={value.join("\n")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
          )
        }
        rows={Math.max(3, value.length + 1)}
        className="w-full border-2 border-stone-200 rounded-lg px-3 py-2"
      />
      {help ? <p className="text-xs text-stone-500 mt-1">{help}</p> : null}
    </label>
  );
}

function ToggleButton({
  on,
  label,
  onClick,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full border-2 ${
        on
          ? "bg-emerald-50 border-emerald-300 text-emerald-800"
          : "bg-stone-100 border-stone-200 text-stone-600"
      }`}
    >
      {label}
    </button>
  );
}
